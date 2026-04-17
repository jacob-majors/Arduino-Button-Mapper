FROM node:20-slim

# Force cache bust
ARG CACHEBUST=6

# arduino:avr 1.8.6+ no longer bundles Keyboard.h inside the platform —
# it must be installed as a separate library.
RUN apt-get update && apt-get install -y --no-install-recommends curl tar ca-certificates && \
    curl -fsSL https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_64bit.tar.gz \
      | tar -xz -C /usr/local/bin arduino-cli && \
    arduino-cli version && \
    arduino-cli config init && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr && \
    arduino-cli lib install "Keyboard" "Mouse" && \
    find /root -name "Keyboard.h" 2>/dev/null | grep -q . && \
    echo "✓ Keyboard.h verified" && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./

EXPOSE 3001
CMD ["node", "server.js"]
