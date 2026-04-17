# Arduino Button Mapper

A web app for programming an Arduino Leonardo as a USB HID controller — map physical buttons, joysticks, IR sensors, and sip/puff inputs to keyboard keys or gamepad inputs. Configure everything in the browser, then compile and flash directly to your board.

## Architecture

| Layer | Stack | Hosting |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS | Vercel |
| Backend | Node.js / Express + `arduino-cli` | Railway (Docker) |
| Database / Auth | Supabase | Supabase cloud |

The frontend can talk to either:
- a hosted backend set in `NEXT_PUBLIC_BACKEND_URL` for the **Web Compiler** path
- a local helper running on `http://localhost:3001` for the **Local Helper** path

Both backends compile sketches with `arduino-cli`, and flashing to the board still uses the **Web Serial API** in the browser (Chrome/Edge only).

---

## Features

### Configure tab
- Add **buttons**, **joysticks**, **IR sensors**, and **sip/puff** inputs, each mapped to an Arduino pin and a keyboard key or HID action
- Per-button **LED** pin assignment
- Switch between **Web Compiler** and **Local Helper** upload methods
- **Wiring diagram** modal showing how to connect each component
- **Board connection** modal — lists already-granted serial ports, or opens the browser's native Web Serial picker to grant a new one
- Live **sketch preview** (generated `.ino` before upload)

### Test tab
- **Controller mockup** — flat-UI diagram showing all mapped inputs on a gamepad layout (D-pad, face buttons, bumpers, triggers, thumbsticks, pads)
- **All Inputs** view — table of every configured input and its current state
- **Games** — Dino run, Snake, and Pong, playable with your mapped controller
- **Serial monitor** — live serial output from the connected Arduino, with toggle open/close

### Saves & sharing
- Supabase-backed auto-save with 1.5 s debounce
- Named saves — switch between multiple configs from the save dropdown
- **Share link** — generates a public URL others can open to load a read-only copy of any save
- **Import / Export** JSON for offline backup

### Admin panel
- Feature toggles: Games, Wiring diagram, Controller mockup, Upload, LEDs, Sensors, Buttons
- Maintenance mode with custom welcome message
- Accessible to admin accounts only

---

## Prerequisites

1. **Node.js** v18 or later — https://nodejs.org
2. **arduino-cli** (for local backend) — https://arduino.github.io/arduino-cli/installation/
3. After installing `arduino-cli`, install the AVR core and required libraries:
   ```bash
   arduino-cli core update-index
   arduino-cli core install arduino:avr
   arduino-cli lib install "Keyboard" "Mouse"
   ```
4. A **Supabase** project for auth and saves (see Environment Variables below)
5. **Chrome or Edge** for Web Serial API support

---

## Running Locally

### 1. Start the local helper / backend

```bash
cd backend
npm install
npm start
```

The local helper listens on `http://localhost:3001`.

If you want the website to use that helper instead of the hosted compiler, switch the in-app Upload Method to `Local Helper`.

### 2. Start the frontend

```bash
npm install
npm run dev
```

Open http://localhost:3000 in Chrome or Edge.

---

## Environment Variables

Create a `.env.local` in the project root:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

For the hosted backend deployment, the `arduino-cli` installation and AVR core setup are handled automatically by the Dockerfile — no manual setup needed.

---

## Deploying

### Frontend → Vercel

```bash
npx vercel
```

Set the same environment variables in your Vercel project settings. Point `NEXT_PUBLIC_BACKEND_URL` at your Railway backend URL.

### Hosted Backend → Railway

The `backend/` directory contains a `Dockerfile` that installs `arduino-cli`, the `arduino:avr` core, and the `Keyboard`/`Mouse` libraries at build time. Push to Railway and it builds automatically.

### Local Helper Package

If you want uploads to work without depending on the hosted compiler, ship a small helper package that includes:
- `backend/`
- `Arduino-Button-Mapper-Helper.command` for macOS
- `Arduino-Button-Mapper-Helper.bat` for Windows

The UI already supports switching users to that local helper mode.

---

## Hardware Setup

Target board: **Arduino Leonardo** (or any ATmega32U4-based board).

Connect each button between a digital pin (2–13) and **GND** — the sketch uses `INPUT_PULLUP`, so no external resistors are needed.

```
Arduino Pin 2  ──┤ Button ├── GND
Arduino Pin 3  ──┤ Button ├── GND
...
```

For LEDs, connect each LED + resistor (220 Ω) between the assigned pin and GND.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No ports listed | Plug in the Arduino, use Chrome/Edge, and click "Connect new board…" to grant serial access |
| Compile fails — Keyboard.h not found | Run `arduino-cli lib install "Keyboard" "Mouse"` on the machine running the backend |
| Upload fails | Verify the correct port is selected; try pressing the Arduino's reset button and re-uploading |
| Backend connection refused | Start the local helper on `localhost:3001`, or switch back to the Web Compiler method |
| Web Serial not available | Use Chrome or Edge — Firefox does not support the Web Serial API |
