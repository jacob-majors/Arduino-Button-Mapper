FROM node:20-slim

# Force cache bust on every push so Railway always re-runs core install
ARG CACHEBUST=3

# Install arduino-cli + arduino:avr core (Keyboard.h lives inside that core)
RUN apt-get update && apt-get install -y --no-install-recommends curl tar ca-certificates && \
    curl -fsSL https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_64bit.tar.gz \
      | tar -xz -C /usr/local/bin arduino-cli && \
    arduino-cli version && \
    arduino-cli config init && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr && \
    # Hard fail if Keyboard.h is missing after install
    find /root/.arduino15/packages/arduino/hardware/avr -name "Keyboard.h" | grep -q Keyboard.h && \
    echo "✓ Keyboard.h present" && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./

EXPOSE 3001
CMD ["node", "server.js"]
