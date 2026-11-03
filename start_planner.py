#!/usr/bin/env python3
"""Newspaper Ad Planner v2: same-origin Jev proxy, personal-device use only."""
import json
import os
import secrets
import socket
import ssl
import sys
import threading
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
HOST, PORT = '127.0.0.1', 8765
ALLOWED_ORIGINS = {f'http://127.0.0.1:{PORT}', f'http://localhost:{PORT}'}
KEY_DIR = Path.home() / '.newspaper-ad-planner'
KEY_FILE = KEY_DIR / 'jev-key.json'
TOKEN = secrets.token_urlsafe(32)
LOCK = threading.Lock()
ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

class APIProblem(Exception):
    def __init__(self, status, code, message):
        self.status, self.code, self.message = status, code, message
        super().__init__(message)

def valid_key(key):
    return isinstance(key, str) and 1 <= len(key) <= 4096 and key.isascii() and not any(c.isspace() or ord(c) < 33 or ord(c) == 127 for c in key)

def read_key():
    with LOCK:
        try:
            value = json.loads(KEY_FILE.read_text(encoding='utf-8')).get('key', '')
            return value if valid_key(value) else ''
        except (OSError, ValueError, AttributeError):
            return ''

def store_key(value):
    with LOCK:
        if not value:
            KEY_FILE.unlink(missing_ok=True)
            return
        KEY_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
        if os.name != 'nt':
            KEY_DIR.chmod(0o700)
        temp = KEY_DIR / ('key-' + secrets.token_hex(8) + '.tmp')
        try:
            fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump({'key': value}, f)
            os.replace(temp, KEY_FILE)
        finally:
            temp.unlink(missing_ok=True)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise APIProblem(502, 'redirect', 'TypeSafe returned an unexpected redirect. Request stopped to protect your API key.')

def call_provider(payload, key):
    context = ssl.create_default_context()
    try:
        import certifi
        context.load_verify_locations(certifi.where())
    except ImportError:
        pass
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=context))
    request = urllib.request.Request(ENDPOINT, data=json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8'), method='POST', headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with opener.open(request, timeout=25) as response:
            raw = response.read(4000001)
        if len(raw) > 4000000:
            raise APIProblem(502, 'response_size', 'TypeSafe returned an unexpectedly large response.')
        try:
            result = json.loads(raw)
        except (ValueError, UnicodeError):
            raise APIProblem(502, 'invalid_response', 'TypeSafe returned a non-JSON response. Check any firewall or proxy between this device and TypeSafe.')
        if not isinstance(result, dict) or not isinstance(result.get('answers'), dict):
            raise APIProblem(502, 'invalid_response', 'TypeSafe returned an unexpected response format.')
        return result
    except urllib.error.HTTPError as e:
        messages = {
            400: 'TypeSafe rejected the request (HTTP 400). Check request size and question format.',
            401: 'TypeSafe rejected the API key (HTTP 401). Enter a current TypeSafe key and Save again.',
            403: 'TypeSafe denied access (HTTP 403). Check account permissions and model access.',
            404: 'TypeSafe endpoint not found (HTTP 404). Check API endpoint configuration.',
            413: 'TypeSafe request too large (HTTP 413). Reduce the advertisement list.',
            422: 'TypeSafe rejected the request schema (HTTP 422). Check the app/API version.',
            429: 'TypeSafe rate limit reached (HTTP 429). Wait before trying again.',
            500: 'TypeSafe server error (HTTP 500). Try again later.',
            502: 'TypeSafe bad gateway (HTTP 502). Try again later.',
            503: 'TypeSafe service unavailable (HTTP 503). Try again later.',
            529: 'TypeSafe is overloaded (HTTP 529). Try again later.'
        }
        status = e.code if e.code in (400, 401, 403, 413, 422, 429) else 502
        raise APIProblem(status, 'upstream_http', messages.get(e.code, f'TypeSafe returned HTTP {e.code}. Try again later.'))
    except (TimeoutError, socket.timeout):
        raise APIProblem(504, 'upstream_timeout', 'The local server could not get a TypeSafe response within 25 seconds. Check the internet connection and retry.')
    except urllib.error.URLError as e:
        reason = e.reason
        if isinstance(reason, ssl.SSLCertVerificationError):
            raise APIProblem(502, 'tls_certificate', 'TLS certificate verification failed on this computer. Update Python/system CA certificates; on python.org macOS installs run Install Certificates.command. Do not disable certificate verification.')
        if isinstance(reason, socket.gaierror):
            raise APIProblem(502, 'dns', 'This computer could not resolve api.typesafe.ai. Check DNS, internet access, or firewall settings.')
        if isinstance(reason, (TimeoutError, socket.timeout)):
            raise APIProblem(504, 'upstream_timeout', 'TypeSafe connection timed out. Check internet access and retry.')
        raise APIProblem(502, 'network', 'The local server could not connect to TypeSafe. Check internet access, VPN/proxy settings, or firewall restrictions.')
    except ssl.SSLError:
        raise APIProblem(502, 'tls', 'TLS connection to TypeSafe failed. Check system time, Python certificates, and any HTTPS-inspecting proxy.')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def origin(self):
        host = self.headers.get('Host', '')
        return 'http://' + host if host in (f'127.0.0.1:{PORT}', f'localhost:{PORT}', f'[::1]:{PORT}') else None

    def respond(self, status, data, content_type='application/json'):
        raw = json.dumps(data).encode('utf-8') if content_type == 'application/json' else data
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if not self.origin():
            return self.respond(403, {'code': 'host', 'error': 'Invalid host.'})
        if self.path == '/api/status':
            return self.respond(200, {'app': 'newspaper-ad-planner', 'version': 2, 'hasKey': bool(read_key()), 'csrf': TOKEN})
        if self.path in ('/', '/newspaper_ad_planner_jev_fixed.html'):
            try:
                return self.respond(200, (ROOT / 'newspaper_ad_planner_jev_fixed.html').read_bytes(), 'text/html; charset=utf-8')
            except OSError:
                return self.respond(500, {'error': 'Keep the planner HTML file beside start_planner.py.'})
        return self.respond(404, {'error': 'Not found.'})

    def do_POST(self):
        origin = self.origin()
        req_origin = self.headers.get('Origin')
        req_referer = self.headers.get('Referer', '')
        origin_ok = (req_origin in ALLOWED_ORIGINS) or (not req_origin and any(req_referer.startswith(o) for o in ALLOWED_ORIGINS))
        if not origin or not origin_ok:
            return self.respond(403, {'code': 'origin', 'error': 'Open the planner using the local server launcher.'})
        if not secrets.compare_digest(self.headers.get('X-Planner-CSRF', ''), TOKEN):
            return self.respond(403, {'code': 'csrf', 'error': 'Server restarted. Reload the planner page.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1500000:
                return self.respond(413, {'code': 'size', 'error': 'Request too large or empty.'})
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError()
            if self.path == '/api/key':
                if body.get('forget') is True:
                    store_key('')
                else:
                    key = body.get('key', '')
                    if isinstance(key, str):
                        key = key.strip()
                    if not valid_key(key):
                        return self.respond(400, {'code': 'key_format', 'error': 'Enter a nonempty API key without internal whitespace.'})
                    store_key(key)
                return self.respond(200, {'hasKey': bool(read_key())})
            if self.path != '/api/jev':
                return self.respond(404, {'error': 'Not found.'})
            key = body.get('key') or read_key()
            if isinstance(key, str):
                key = key.strip()
            if not valid_key(key):
                return self.respond(400, {'code': 'missing_key', 'error': 'No valid key configured. Enter a TypeSafe API key and click Save.'})
            payload = body.get('request')
            model_name = payload.get('model') if isinstance(payload, dict) else None
            if not isinstance(payload, dict) or not isinstance(model_name, str) or not model_name or 'state' not in payload or not isinstance(payload.get('questions'), dict) or not payload['questions']:
                return self.respond(400, {'code': 'schema', 'error': 'Invalid Jev request structure.'})
            return self.respond(200, call_provider(payload, key))
        except APIProblem as e:
            return self.respond(e.status, {'code': e.code, 'error': e.message})
        except (ValueError, TypeError, UnicodeError):
            return self.respond(400, {'code': 'json', 'error': 'Malformed JSON request.'})
        except OSError:
            return self.respond(500, {'code': 'local_storage', 'error': 'Local operation failed. Check user-profile folder permissions.'})
        except Exception:
            return self.respond(500, {'code': 'internal', 'error': 'Local server error. Restart the launcher and retry.'})

def main():
    if sys.version_info < (3, 10):
        print('Python 3.10 or newer is required.')
        return 1
    if not (ROOT / 'newspaper_ad_planner_jev_fixed.html').is_file():
        print('Extract the complete ZIP first. The HTML file must be beside start_planner.py.')
        return 1
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        print('Port 8765 is already in use. Close the OLD planner server, then run this launcher again.')
        return 1
    url = f'http://{HOST}:{PORT}'
    print(f'Newspaper Ad Planner v2: {url}')
    print('Keep this terminal open. Press Ctrl+C to stop.')
    print('No API keys are printed. This server is for your own device only.')
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0

if __name__ == '__main__':
    sys.exit(main())
