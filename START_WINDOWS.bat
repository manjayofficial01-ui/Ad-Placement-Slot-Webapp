@echo off
setlocal
cd /d "%~dp0"
echo Starting Newspaper Ad Planner v2...
where py >nul 2>nul
if not errorlevel 1 (
  py -3 start_planner.py
  goto done
)
where python >nul 2>nul
if not errorlevel 1 (
  python start_planner.py
  goto done
)
where python3 >nul 2>nul
if not errorlevel 1 (
  python3 start_planner.py
  goto done
)
echo Python was not found. Install Python 3.10 or newer, then run this launcher again.
:done
pause
