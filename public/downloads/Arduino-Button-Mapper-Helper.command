#!/bin/bash
# Arduino Button Mapper Local Helper
# Place this file next to the extracted helper package, then double-click it.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -d "$SCRIPT_DIR/backend" ]; then
  cd "$SCRIPT_DIR/backend" || exit 1
elif [ -d "$SCRIPT_DIR/../backend" ]; then
  cd "$SCRIPT_DIR/../backend" || exit 1
else
  osascript -e 'display dialog "Could not find a backend folder next to this helper launcher. Put this file inside the helper package folder, then open it again." buttons {"OK"} default button "OK"' >/dev/null 2>&1
  echo "Could not find a backend folder next to this helper launcher."
  echo "Put this file inside the helper package folder, then open it again."
  read -r -p "Press Enter to close..."
  exit 1
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "Starting Arduino Button Mapper local helper on http://localhost:3001 ..."
node server.js
