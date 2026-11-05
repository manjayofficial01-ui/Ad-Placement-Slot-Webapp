NEWSPAPER AD PLANNER - JEV CONNECTION FIX v2

IMPORTANT FIRST STEPS
- Revoke the API key pasted into chat and create a replacement in your TypeSafe
  console. No key has been embedded in this package.
- In your current planner use Save JSON before switching versions. Import that
  JSON in this app with Open JSON. Browser storage differs between a local HTML
  file and a server URL; exporting/importing preserves your existing layout.
- Close the OLD planner server terminal with Ctrl+C before launching this one.

START THE FIXED APP
1. Extract the WHOLE ZIP to a folder first. Do not run inside the ZIP preview.
2. Install Python 3.10 or newer if it is not already installed. No pip packages
   are required. This package optionally uses certifi if it is already installed.
3. Windows: double-click START_WINDOWS.bat.
   macOS: run START_MAC.command. If macOS blocks the downloaded launcher, use
   a Terminal in the extracted folder and run: python3 start_planner.py
   Linux: run START_LINUX.sh, or: python3 start_planner.py
4. The launcher opens http://127.0.0.1:8765. Keep its terminal open.
5. Confirm the page banner says Local server connected (v2).
6. Enter the REPLACEMENT TypeSafe API key. Leave Remember key on this device
   selected, then click Save settings / key and Test connection.
7. Enable Use Jev for automatic placement and run Automatically place ads.
8. Next time run the launcher again. Your remembered key is reused. Closing the
   browser or stopping the server does not remove it.

DO NOT DOUBLE-CLICK THE HTML FOR JEV
Direct-file mode still supports offline planning, but Jev requires the local
server. In direct-file mode this version shows launcher instructions instead
of attempting another failing browser API request. The app never calls a
public CORS proxy and never disables browser security or TLS verification.

WHAT CHANGED
The previous direct-browser fetch could not tell browser/CORS blocking apart
from network failure. This version removes that route entirely:
  Browser -> same-origin local server -> official TypeSafe HTTPS API
The server sends the Bearer authentication header to the fixed endpoint:
  https://api.typesafe.ai/v1/systemone
The request and response follow TypeSafe's typed-question API.
The browser only calls its own server. Upstream browser CORS restrictions do
not apply to the server's HTTPS request.

DIAGNOSTICS
- No valid key configured: enter a replacement TypeSafe key and Save.
- TypeSafe HTTP 401: TypeSafe rejected the key; replace it and Save again.
- HTTP 403: check account/model access.
- HTTP 429: rate-limited; wait and retry.
- DNS error: check this computer's internet/DNS/firewall access.
- TLS certificate error: update Python/system CA certificates. On python.org
  macOS installations, run the supplied Install Certificates.command. Do not
  disable certificate verification. A corporate HTTPS proxy may need your
  administrator to install its trusted CA correctly.
- Timeout: check network access and retry. TypeSafe calls time out after 25s.
- Local server unavailable: keep its terminal running; restart the launcher.
- Port 8765 already in use: stop the OLD planner server, then launch v2.
- Wrong server version: stop the old server, launch this package, reload.
- HTTP 400/422: request rejected by the API; review size/schema and app version.
These messages identify classes of error; the package cannot guarantee external
API availability or account permissions.

KEY STORAGE
Remembered keys are saved on your own computer in your user profile:
  .newspaper-ad-planner/jev-key.json
The file is NOT encrypted. Unix-like systems use owner-only folder and file
permissions. Windows uses inherited user-profile permissions. Use only on a
trusted personal device. This server has no multi-user account authentication
and must not be exposed to the internet.
A key pasted into the settings field exists in the browser tab until saved;
saving it for remembered use clears that field and does not copy the key into
browser localStorage. The saved key is not sent back to the browser. It is
excluded from planner JSON, CSV, TXT, and print output.
Forget saved key removes the persistent server copy while the server is running.
Uncheck Remember and Save to remove any saved copy while retaining an entered
key only in the current tab for session-only use.
The app does not print keys, echo upstream error bodies, or include keys in
its test report. Do not type a key into ad text or placement preferences.

PRESERVED FEATURES
- Floating inventory and individual advertisement deletion.
- Manual placement, full-bottom-support checks, bounds and overlap validation.
- Normal and full-page automatic CC limits; width/pairing preferences.
- Place remaining preserves manual positions; Rebuild asks for confirmation.
- Undo/Redo, JSON backup/import, CSV, and Print/PDF.
- Page-by-page numbered TXT output, copy all/copy a page, and page filtering.
- Output format: 1. Agency 8x25 Advertiser (Pg 1)
- Ads are sorted by actual page then original input order with continuous
  numbering and a blank line between ads. Newly entered spelling and size
  notation are retained. Unplaced ads stay in inventory, not in placed results.
- Trailing (Pg n) input tags can now optionally constrain and directly place
  advertisements onto their designated pages using the "Place ads at page numbers
  from (Pg n) tags" checkbox or the "Place tagged ads directly" button. When
  enabled, newly added or existing tagged ads are immediately placed onto their
  specified pages with full bottom support and capacity checking. When disabled,
  tags remain descriptive labels.
- Exceptional 50 cm single-page advertisements (any column width 1-8 x 50 cm)
  are supported. When booked, a 50 cm ad automatically readjusts the target page
  to a 50 cm board height (400 CC physical capacity). The exceptional ad fills
  the full height of its own columns, and the free columns beside it accept
  other advertisements (manually, automatically, or via page tags) up to the
  50 cm page height with full bottom support. Multiple normal advertisements
  can NEVER stack past a page's height; normal pages remain strictly capped
  at 48 cm height (384 CC).

JEV BEHAVIOR AND LIMITS
Local code generates multiple valid greedy layouts. Jev chooses between distinct
layouts tied for the best placed CC and ad count from that set. If only one
candidate remains, no Jev call is needed. Invalid/low-confidence responses or API
failures use the best local layout. The 65% threshold is a starter policy, not a
calibrated accuracy guarantee. No method here guarantees optimal packing.
AI calls transmit candidate advertisement details and your preferences to
TypeSafe and may incur account usage charges. Offline mode makes no AI calls.
Review layouts before publication.

TEST SCOPE
Tests passed in Chromium using a real local HTTP server with a simulated
TypeSafe transport. Verified connection flow, saved-key reuse/forget, CSRF
protection/refresh, 12-ad example output, AI choice/fallbacks, and Undo/Redo.
The provider error classifier was separately checked with simulated HTTP, DNS,
TLS certificate, and timeout failures. No real TypeSafe request was run and the
key pasted into chat was neither used nor embedded. Test with your replacement
key on your computer to verify live account/network access.

Official API details: https://docs.typesafe.ai/api
Browser CORS explanation: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors
