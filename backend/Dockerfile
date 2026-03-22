FROM node:20-slim

# Install arduino-cli and the arduino:avr core (which provides Keyboard.h)
# ca-certificates is required for HTTPS downloads of the package index
RUN apt-get update && apt-get install -y curl tar ca-certificates && \
    curl -fsSL https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_64bit.tar.gz \
      | tar -xz -C /usr/local/bin arduino-cli && \
    arduino-cli config init && \
    arduino-cli core update-index --log-level warn && \
    arduino-cli core install arduino:avr --log-level warn && \
    # Verify Keyboard.h landed — build fails here if the core is missing \
    ls /root/.arduino15/packages/arduino/hardware/avr/*/libraries/Keyboard/src/Keyboard.h && \
    echo "✓ Keyboard.h verified" && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./

EXPOSE 3001
CMD ["node", "server.js"]
