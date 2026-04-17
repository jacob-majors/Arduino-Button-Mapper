#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Arduino Button Mapper Helper.app"
BUILD_ROOT="$ROOT_DIR/.build/mac-helper"
APP_DIR="$BUILD_ROOT/$APP_NAME"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"
OUTPUT_ZIP="$ROOT_DIR/public/downloads/Arduino-Button-Mapper-Helper-Mac.zip"

rm -rf "$BUILD_ROOT"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cp "$ROOT_DIR/packaging/mac-helper/Info.plist" "$APP_DIR/Contents/Info.plist"
cp "$ROOT_DIR/packaging/mac-helper/launcher.sh" "$MACOS_DIR/Arduino Button Mapper Helper"
chmod +x "$MACOS_DIR/Arduino Button Mapper Helper"

cp -R "$ROOT_DIR/backend" "$RESOURCES_DIR/backend"
rm -rf "$RESOURCES_DIR/backend/.git" "$RESOURCES_DIR/backend/node_modules/.cache" 2>/dev/null || true
cp "$ROOT_DIR/public/downloads/LOCAL-HELPER-README.txt" "$RESOURCES_DIR/LOCAL-HELPER-README.txt"

rm -f "$OUTPUT_ZIP"
ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$OUTPUT_ZIP"

echo "Built $OUTPUT_ZIP"
