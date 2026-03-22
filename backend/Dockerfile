FROM node:20-slim

# Install arduino-cli
RUN apt-get update && apt-get install -y curl tar && \
    curl -fsSL https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_64bit.tar.gz \
      | tar -xz -C /usr/local/bin arduino-cli && \
    arduino-cli core update-index && \
    arduino-cli core install arduino:avr && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/server.js ./

EXPOSE 3001
CMD ["node", "server.js"]
