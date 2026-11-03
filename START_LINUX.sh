#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 start_planner.py
elif command -v python >/dev/null 2>&1; then
  python start_planner.py
else
  printf '\nPython was not found. Install Python 3.10 or newer and try again.\n'
fi
printf '\nPress Return to close. '
read answer
