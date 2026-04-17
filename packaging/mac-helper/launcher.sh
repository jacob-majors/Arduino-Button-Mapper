#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES_DIR="$APP_ROOT/Resources"
BACKEND_DIR="$RESOURCES_DIR/backend"
APP_SUPPORT_DIR="$HOME/Library/Application Support/Arduino Button Mapper Helper"
LOG_DIR="$HOME/Library/Logs/Arduino Button Mapper Helper"
PID_FILE="$APP_SUPPORT_DIR/helper.pid"
LOG_FILE="$LOG_DIR/helper.log"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

mkdir -p "$APP_SUPPORT_DIR" "$LOG_DIR"

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  osascript -e 'display dialog "Node.js was not found. Install Node.js first, then open Arduino Button Mapper Helper again." buttons {"OK"} default button "OK"' >/dev/null 2>&1 || true
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" >/dev/null 2>&1; then
    osascript -e 'display notification "Local helper is already running on localhost:3001." with title "Arduino Button Mapper Helper"' >/dev/null 2>&1 || true
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if lsof -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1; then
  osascript -e 'display notification "A process is already using localhost:3001." with title "Arduino Button Mapper Helper"' >/dev/null 2>&1 || true
  exit 0
fi

(
  cd "$BACKEND_DIR"
  nohup "$NODE_BIN" server.js >>"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
) >/dev/null 2>&1

sleep 1
STARTED_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -n "$STARTED_PID" ] && kill -0 "$STARTED_PID" >/dev/null 2>&1; then
  osascript -e 'display notification "Local helper started in the background." with title "Arduino Button Mapper Helper"' >/dev/null 2>&1 || true
  exit 0
fi

rm -f "$PID_FILE"
osascript -e "display dialog \"The local helper could not start. Check the log at:\n$LOG_FILE\" buttons {\"OK\"} default button \"OK\"" >/dev/null 2>&1 || true
exit 1
