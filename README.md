# Arduino Button Mapper

A web app for programming an Arduino Leonardo to map physical buttons to keyboard inputs. Wire buttons to digital pins, assign keys in the UI, then upload directly to your board.

## Architecture

- `frontend/` — Next.js 14 app, deployable to Vercel
- `backend/` — Local Node.js/Express server that communicates with the Arduino hardware via `arduino-cli`

The frontend calls the backend at `http://localhost:3001` by default (configurable via `NEXT_PUBLIC_BACKEND_URL`).

---

## Prerequisites

1. **Node.js** (v18 or later) — https://nodejs.org
2. **arduino-cli** — https://arduino.github.io/arduino-cli/installation/
3. **Arduino AVR core** (required for Leonardo):
   ```bash
   arduino-cli core install arduino:avr
   ```

---

## Running Locally

### 1. Start the backend

```bash
cd backend
npm install
npm start
```

The backend listens on `http://localhost:3001`. Keep this terminal open while using the app.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Deploying the Frontend to Vercel

The frontend can be deployed to Vercel so you can access the UI from any browser — but the **backend must still run locally** on the machine connected to the Arduino.

```bash
cd frontend
npx vercel
```

After deploying, set the environment variable in your Vercel project settings:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

> Note: even when the frontend is hosted on Vercel, `NEXT_PUBLIC_BACKEND_URL` should point to `http://localhost:3001` on your local machine, since that's where the Arduino is physically connected. The browser makes these API calls directly, not through Vercel's servers.

---

## Hardware Setup

1. Connect each button between a digital pin (2–13) and **GND**.
2. No external resistors needed — the sketch uses `INPUT_PULLUP` mode, which enables the Arduino's internal pull-up resistors.
3. When a button is pressed (pin pulled LOW), the mapped key is sent to the host computer as a USB HID keyboard event.

```
Arduino Pin 2  ──┤ Button ├── GND
Arduino Pin 3  ──┤ Button ├── GND
...
```

---

## Usage

1. **Select Port** — Choose the serial port your Arduino Leonardo is connected to. Click the refresh icon if it doesn't appear.
2. **Configure Buttons** — Add button cards. For each one, select the Arduino pin and click the key input field, then press the key you want to map.
3. **Upload** — Click "Upload to Arduino". Watch the log for compile and upload progress.
4. **Preview Sketch** — Use "View Sketch" or "Preview Sketch" to see the generated `.ino` file before uploading.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No ports listed | Make sure Arduino is plugged in, backend is running, and `arduino-cli` is installed |
| Compile fails | Run `arduino-cli core install arduino:avr` and try again |
| Upload fails | Check the port is correct; try pressing the Arduino's reset button and uploading immediately |
| Backend connection refused | Make sure `npm start` is running in the `backend/` directory |
