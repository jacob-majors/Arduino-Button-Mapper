#!/bin/bash
# Double-click this file to start the Arduino Button Mapper backend

cd "$(dirname "$0")/backend"

# Load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

echo "Starting Arduino Button Mapper backend..."
node server.js
