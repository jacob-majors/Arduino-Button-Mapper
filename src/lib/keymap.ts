export const KEY_MAP: Record<string, { display: string; arduino: string }> = {
  Enter: { display: "Enter", arduino: "KEY_RETURN" },
  Backspace: { display: "Backspace", arduino: "KEY_BACKSPACE" },
  Tab: { display: "Tab", arduino: "KEY_TAB" },
  Escape: { display: "Escape", arduino: "KEY_ESC" },
  " ": { display: "Space", arduino: " " },
  ArrowUp: { display: "Arrow Up", arduino: "KEY_UP_ARROW" },
  ArrowDown: { display: "Arrow Down", arduino: "KEY_DOWN_ARROW" },
  ArrowLeft: { display: "Arrow Left", arduino: "KEY_LEFT_ARROW" },
  ArrowRight: { display: "Arrow Right", arduino: "KEY_RIGHT_ARROW" },
  Delete: { display: "Delete", arduino: "KEY_DELETE" },
  Insert: { display: "Insert", arduino: "KEY_INSERT" },
  Home: { display: "Home", arduino: "KEY_HOME" },
  End: { display: "End", arduino: "KEY_END" },
  PageUp: { display: "Page Up", arduino: "KEY_PAGE_UP" },
  PageDown: { display: "Page Down", arduino: "KEY_PAGE_DOWN" },
  CapsLock: { display: "Caps Lock", arduino: "KEY_CAPS_LOCK" },
  F1: { display: "F1", arduino: "KEY_F1" },
  F2: { display: "F2", arduino: "KEY_F2" },
  F3: { display: "F3", arduino: "KEY_F3" },
  F4: { display: "F4", arduino: "KEY_F4" },
  F5: { display: "F5", arduino: "KEY_F5" },
  F6: { display: "F6", arduino: "KEY_F6" },
  F7: { display: "F7", arduino: "KEY_F7" },
  F8: { display: "F8", arduino: "KEY_F8" },
  F9: { display: "F9", arduino: "KEY_F9" },
  F10: { display: "F10", arduino: "KEY_F10" },
  F11: { display: "F11", arduino: "KEY_F11" },
  F12: { display: "F12", arduino: "KEY_F12" },
};

export type ButtonMode = "momentary" | "toggle" | "power";

export interface ButtonConfig {
  id: string;
  name: string;
  pin: number;
  keyDisplay: string;
  arduinoKey: string;
  mode: ButtonMode;
  ledPin: number;        // -1 = no LED
  ledMode: "active" | "always";  // active = on while pressed/toggled, always = always on
  inputMode?: "hold" | "tap";    // hold = key held while pressed; tap = single press per click
  subtype?: "switch" | "button"; // cosmetic UI label
}

export interface LedConfig {
  enabled: boolean;
  onPin: number;   // LED that lights when system is ON
  offPin: number;  // LED that lights when system is OFF
}

// PortConfig is the same shape as ButtonConfig — ports are just back-panel buttons
export type PortConfig = ButtonConfig;

// ─── Sensor types ─────────────────────────────────────────────────────────────

/** IR proximity/break-beam sensor wired to a digital pin */
export interface IRSensorConfig {
  id: string;
  name: string;
  pin: number;           // digital pin
  keyDisplay: string;
  arduinoKey: string;
  mode: "momentary" | "toggle";
  activeHigh: boolean;   // true = trigger when pin reads HIGH (some modules invert)
  ledPin: number;        // -1 = no LED
  ledMode: "active" | "always";
  inputMode?: "hold" | "tap";    // hold = key held while active; tap = single press per activation
}

/** Analog sip-and-puff sensor — sip and puff map to separate keys */
export interface SipPuffConfig {
  id: string;
  name: string;
  pin: number;           // digital pin (2–13)
  key: string;
  keyDisplay: string;
  ledPin: number;        // -1 = no LED
  ledMode: "active" | "always";
  inputMode: "hold" | "tap"; // hold = key held while active; tap = single press per activation
}

/** Analog joystick (X/Y axes) with optional digital click button */
export interface JoystickConfig {
  id: string;
  name: string;
  xPin: number;          // analog pin 0–5
  yPin: number;          // analog pin 0–5
  buttonPin: number;     // digital pin; -1 = no button
  upKey: string;    upDisplay: string;
  downKey: string;  downDisplay: string;
  leftKey: string;  leftDisplay: string;
  rightKey: string; rightDisplay: string;
  buttonKey: string; buttonDisplay: string;
  deadzone: number;      // 0–512; default 200
  invertX: boolean;
  invertY: boolean;
  ledPin: number;        // -1 = no LED
  ledMode: "active" | "always";  // active = on while any axis moves or btn pressed
  mouseMode?: boolean;   // true = move the mouse cursor instead of pressing keys
  mouseSpeed?: number;   // 1–20, default 8 — pixels per loop at full deflection
  mouseClickBtn?: "left" | "right" | "middle"; // which mouse button the click pin fires
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map an Arduino key constant back to the browser e.key value */
export function arduinoToBrowserKey(arduinoKey: string): string {
  for (const [browserKey, val] of Object.entries(KEY_MAP)) {
    if (val.arduino === arduinoKey) return browserKey;
  }
  return arduinoKey; // single printable chars are already the browser key
}

export function resolveKey(
  event: KeyboardEvent
): { display: string; arduino: string } | null {
  if (KEY_MAP[event.key]) return KEY_MAP[event.key];
  const ignored = ["Meta", "Control", "Alt", "Shift", "OS", "AltGraph"];
  if (ignored.includes(event.key)) return null;
  if (event.key.length === 1) return { display: event.key.toUpperCase(), arduino: event.key };
  return null;
}

function keyLiteral(k: string): string {
  if (!k) return "0";
  if (k.startsWith("KEY_")) return k;
  // Only single printable ASCII chars are valid char literals in Arduino C
  if (k.length !== 1 || k.charCodeAt(0) < 32 || k.charCodeAt(0) > 126) return "0";
  // Escape backslash and single-quote so they don't break the C literal
  const escaped = k === "\\" ? "\\\\" : k === "'" ? "\\'" : k;
  return `'${escaped}'`;
}

// ─── Sketch generation ────────────────────────────────────────────────────────

export function generateSketch(
  buttons: ButtonConfig[],
  leds: LedConfig,
  ports: PortConfig[] = [],
  irSensors: IRSensorConfig[] = [],
  sipPuffs: SipPuffConfig[] = [],
  joysticks: JoystickConfig[] = [],
): string {
  const allInputs = [...buttons, ...ports];
  const configured = allInputs.filter((b) => b.mode === "power" || b.arduinoKey);
  const hasSensors = irSensors.length > 0 || sipPuffs.length > 0 || joysticks.length > 0;

  // ── Buttons / ports ───────────────────────────────────────────────────────

  const n = configured.length;

  const safeName = (s: string) => s.replace(/[\r\n*/]/g, " ").trim();
  const btnComments = configured
    .map((b, i) => {
      const label = b.name ? `: ${safeName(b.name)}` : "";
      const key = b.mode === "power" ? "POWER TOGGLE" : `${b.keyDisplay || b.arduinoKey}`;
      return `// Button ${i + 1}${label} — Pin ${b.pin} → ${key} (${b.mode})`;
    })
    .join("\n");

  const btnPins    = configured.map((b) => b.pin).join(", ");
  const btnKeys    = configured.map((b) =>
    b.mode === "power" ? "0" : keyLiteral(b.arduinoKey)
  ).join(", ");
  const btnModes   = configured.map((b) =>
    b.mode === "power" ? "2" : b.mode === "toggle" ? "1" : (b.inputMode ?? "hold") === "tap" ? "3" : "0"
  ).join(", ");
  const btnLedPins = configured.map((b) => (b.ledPin ?? -1)).join(", ");
  const hasAnyLed  = configured.some((b) => (b.ledPin ?? -1) >= 0);

  const ledSection = leds.enabled
    ? `\n// LED pins\nconst int LED_ON_PIN = ${leds.onPin};   // lights when system is active\nconst int LED_OFF_PIN = ${leds.offPin}; // lights when system is off\n\nvoid updateLEDs() {\n  digitalWrite(LED_ON_PIN, systemActive ? HIGH : LOW);\n  digitalWrite(LED_OFF_PIN, systemActive ? LOW : HIGH);\n}\n`
    : `\nvoid updateLEDs() { /* LEDs not configured */ }\n`;

  const ledSetup = leds.enabled
    ? `  pinMode(LED_ON_PIN, OUTPUT);\n  pinMode(LED_OFF_PIN, OUTPUT);`
    : "";

  // ── IR sensors ────────────────────────────────────────────────────────────

  let irGlobals = "";
  let irSetup   = "";
  let irLoop    = "";

  if (irSensors.length > 0) {
    const m = irSensors.length;
    const irPins  = irSensors.map((s) => s.pin).join(", ");
    const irKeys  = irSensors.map((s) => keyLiteral(s.arduinoKey)).join(", ");
    const irModes = irSensors.map((s) => s.mode === "toggle" ? "1" : (s.inputMode ?? "hold") === "tap" ? "2" : "0").join(", ");
    const irAH    = irSensors.map((s) => s.activeHigh ? "true" : "false").join(", ");
    const irCmt   = irSensors
      .map((s, i) => `// IR ${i + 1}${s.name ? `: ${s.name}` : ""} — Pin ${s.pin} active ${s.activeHigh ? "HIGH" : "LOW"}`)
      .join("\n");
    const hasIrLed = irSensors.some((s) => (s.ledPin ?? -1) >= 0);
    const irLedPinsArr = irSensors.map((s) => s.ledPin ?? -1).join(", ");
    const irLedModesArr = irSensors.map((s) => s.ledMode === "always" ? "1" : "0").join(", ");

    irGlobals = `
${irCmt}
const int numIR = ${m};
const int irPins[${m}] = {${irPins}};
const int irKeys[${m}] = {${irKeys}};
const int irModes[${m}] = {${irModes}}; // 0=hold 1=toggle 2=tap
const bool irActiveHigh[${m}] = {${irAH}};
bool lastIRState[${m}];
bool irToggleState[${m}] = {${irSensors.map(() => "false").join(", ")}};${hasIrLed ? `
const int irLedPins[${m}] = {${irLedPinsArr}};
const int irLedModes[${m}] = {${irLedModesArr}}; // 0=active 1=always` : ""}
`;

    irSetup = `  for (int i = 0; i < numIR; i++) {
    pinMode(irPins[i], INPUT);
    lastIRState[i] = irActiveHigh[i] ? LOW : HIGH;
  }${hasIrLed ? `
  for (int i = 0; i < numIR; i++) {
    if (irLedPins[i] >= 0) { pinMode(irLedPins[i], OUTPUT); digitalWrite(irLedPins[i], irLedModes[i] == 1 ? HIGH : LOW); }
  }` : ""}`;

    irLoop = `  // ── IR sensors
  if (systemActive) {
    for (int i = 0; i < numIR; i++) {
      bool raw   = digitalRead(irPins[i]);
      bool now   = irActiveHigh[i] ? (raw == HIGH) : (raw == LOW);
      bool last  = irActiveHigh[i] ? (lastIRState[i] == HIGH) : (lastIRState[i] == LOW);
      if (now != last) {
        if (irModes[i] == 0) {
          if (now) Keyboard.press(irKeys[i]); else Keyboard.release(irKeys[i]);
        } else if (irModes[i] == 2) {
          if (now) { Keyboard.press(irKeys[i]); delay(30); Keyboard.release(irKeys[i]); }
        } else if (now) {
          irToggleState[i] = !irToggleState[i];
          if (irToggleState[i]) Keyboard.press(irKeys[i]); else Keyboard.release(irKeys[i]);
        }
        lastIRState[i] = raw;
      }${hasIrLed ? `
      if (irLedPins[i] >= 0 && irLedModes[i] == 0) digitalWrite(irLedPins[i], now ? HIGH : LOW);` : ""}
    }
  }`;
  }

  // ── Sip & puff ────────────────────────────────────────────────────────────

  let spGlobals = "";
  let spLoop    = "";
  let spSetup   = "";

  if (sipPuffs.length > 0) {
    const spCmt = sipPuffs
      .map((s, i) => `// Sip&Puff ${i + 1}${s.name ? `: ${s.name}` : ""} — D${s.pin}`)
      .join("\n");

    spGlobals = `\n${spCmt}\n`;
    sipPuffs.forEach((s, i) => {
      spGlobals += `const int SP${i}_PIN = ${s.pin};\n`;
      spGlobals += `const int SP${i}_KEY = ${keyLiteral(s.key)};\n`;
      spGlobals += `bool sp${i}Pressed = false;\n`;
    });

    spSetup = sipPuffs.map((s, i) => `  pinMode(SP${i}_PIN, INPUT_PULLUP);`).join("\n");
    const spLedSetup = sipPuffs.filter((s) => (s.ledPin ?? -1) >= 0).map((s) => `  pinMode(${s.ledPin}, OUTPUT); digitalWrite(${s.ledPin}, ${s.ledMode === "always" ? "HIGH" : "LOW"});`).join("\n");
    if (spLedSetup) spSetup += "\n" + spLedSetup;

    spLoop = `  // ── Sip & puff\n  if (systemActive) {\n`;
    sipPuffs.forEach((s, i) => {
      const hasLed = (s.ledPin ?? -1) >= 0;
      const ledPin = s.ledPin ?? -1;
      const alwaysOn = s.ledMode === "always";
      const isTap = (s.inputMode ?? "hold") === "tap";
      if (isTap) {
        // Tap mode: one keypress per activation, even if held
        spLoop += `    { bool pressed = (digitalRead(SP${i}_PIN) == LOW);
      if (pressed && !sp${i}Pressed && SP${i}_KEY != 0) { Keyboard.press(SP${i}_KEY); delay(30); Keyboard.release(SP${i}_KEY); sp${i}Pressed = true; }
      if (!pressed) { sp${i}Pressed = false; }${hasLed ? `
      digitalWrite(${ledPin}, ${alwaysOn ? "HIGH" : "pressed ? HIGH : LOW"});` : ""}
    }\n`;
      } else {
        // Hold mode: key held while sensor is active
        spLoop += `    { bool pressed = (digitalRead(SP${i}_PIN) == LOW);
      if (pressed && !sp${i}Pressed && SP${i}_KEY != 0) { Keyboard.press(SP${i}_KEY); sp${i}Pressed = true; }
      if (!pressed && sp${i}Pressed && SP${i}_KEY != 0) { Keyboard.release(SP${i}_KEY); sp${i}Pressed = false; }${hasLed ? `
      digitalWrite(${ledPin}, ${alwaysOn ? "HIGH" : "pressed ? HIGH : LOW"});` : ""}
    }\n`;
      }
    });
    spLoop += `  }`;
  }

  // ── Joysticks ─────────────────────────────────────────────────────────────

  let joyGlobals = "";
  let joySetup   = "";
  let joyLoop    = "";

  if (joysticks.length > 0) {
    const joyCmt = joysticks
      .map((j, i) => `// Joystick ${i + 1}${j.name ? `: ${j.name}` : ""} — X=A${j.xPin} Y=A${j.yPin}`)
      .join("\n");

    joyGlobals = `\n${joyCmt}\n
int applyJoystickDeadzone(int value, int deadzone) {
  if (abs(value) <= deadzone) return 0;
  return value > 0 ? value - deadzone : value + deadzone;
}

int scaleJoystickMouseDelta(int value, int deadzone, int speed) {
  int adjusted = applyJoystickDeadzone(value, deadzone);
  if (adjusted == 0) return 0;
  long span = max(1, 512 - deadzone);
  long magnitude = ((long)abs(adjusted) * speed) / span;
  if (magnitude < 1) magnitude = 1;
  if (magnitude > speed) magnitude = speed;
  return adjusted > 0 ? (int)magnitude : -(int)magnitude;
}

void updateJoystickCenter(int rawValue, int &centerValue, int deadzone) {
  int driftWindow = max(8, deadzone / 3);
  if (abs(rawValue - centerValue) <= driftWindow) {
    centerValue = (centerValue * 7 + rawValue) / 8;
  }
}
`;
    const joyBtnSetups: string[] = [];

    joysticks.forEach((j, i) => {
      joyGlobals += `const int JOY${i}_X = A${j.xPin};\n`;
      joyGlobals += `const int JOY${i}_Y = A${j.yPin};\n`;
      joyGlobals += `const int JOY${i}_DZ = ${j.deadzone};\n`;
      joyGlobals += `int joy${i}CenterX = 512;\n`;
      joyGlobals += `int joy${i}CenterY = 512;\n`;
      joyGlobals += `const int JOY${i}_UP    = ${keyLiteral(j.upKey)};\n`;
      joyGlobals += `const int JOY${i}_DOWN  = ${keyLiteral(j.downKey)};\n`;
      joyGlobals += `const int JOY${i}_LEFT  = ${keyLiteral(j.leftKey)};\n`;
      joyGlobals += `const int JOY${i}_RIGHT = ${keyLiteral(j.rightKey)};\n`;
      joyGlobals += `bool joy${i}U=false, joy${i}D=false, joy${i}L=false, joy${i}R=false;\n`;
      if ((j.ledPin ?? -1) >= 0) joyGlobals += `const int JOY${i}_LED = ${j.ledPin};\nconst int JOY${i}_LED_MODE = ${j.ledMode === "always" ? "1" : "0"}; // 0=active 1=always\n`;

      if (j.buttonPin >= 0 && j.buttonKey) {
        joyGlobals += `const int JOY${i}_BTN = ${j.buttonPin};\n`;
        joyGlobals += `const int JOY${i}_BTN_KEY = ${keyLiteral(j.buttonKey)};\n`;
        joyGlobals += `bool joy${i}BtnLast = HIGH;\n`;
        joyBtnSetups.push(`  pinMode(JOY${i}_BTN, INPUT_PULLUP);`);
      }
    });

    if (joyBtnSetups.length > 0) {
      joySetup = joyBtnSetups.join("\n");
    }
    const joyCalibrationSetup = joysticks.map((_, i) => `  { long sx = 0; long sy = 0;
    for (int sample = 0; sample < 16; sample++) {
      sx += analogRead(JOY${i}_X);
      sy += analogRead(JOY${i}_Y);
      delay(2);
    }
    joy${i}CenterX = sx / 16;
    joy${i}CenterY = sy / 16;
  }`).join("\n");
    joySetup = (joySetup ? joySetup + "\n" : "") + joyCalibrationSetup;
    const joyLedSetup = joysticks.filter((j) => (j.ledPin ?? -1) >= 0).map((j) => `  pinMode(${j.ledPin}, OUTPUT); digitalWrite(${j.ledPin}, ${j.ledMode === "always" ? "HIGH" : "LOW"});`).join("\n");
    if (joyLedSetup) joySetup = (joySetup ? joySetup + "\n" : "") + joyLedSetup;

    joyLoop = `  // ── Joysticks\n  if (systemActive) {\n`;
    joysticks.forEach((j, i) => {
      const xi = j.invertX ? `-(rawX - joy${i}CenterX)` : `rawX - joy${i}CenterX`;
      const yi = j.invertY ? `-(rawY - joy${i}CenterY)` : `rawY - joy${i}CenterY`;
      const hasBtn = j.buttonPin >= 0 && j.buttonKey;
      const isMouse = !!j.mouseMode;
      const spd = j.mouseSpeed ?? 8;

      if (isMouse) {
        const mouseBtn = j.mouseClickBtn === "right" ? "MOUSE_RIGHT" : j.mouseClickBtn === "middle" ? "MOUSE_MIDDLE" : "MOUSE_LEFT";
        // Mouse mode: calibrate joystick center, then scale movement from the post-deadzone range.
        joyLoop += `    { int rawX = analogRead(JOY${i}_X); int rawY = analogRead(JOY${i}_Y);
      updateJoystickCenter(rawX, joy${i}CenterX, JOY${i}_DZ);
      updateJoystickCenter(rawY, joy${i}CenterY, JOY${i}_DZ);
      int x = ${xi}; int y = ${yi};
      int dx = scaleJoystickMouseDelta(x, JOY${i}_DZ, ${spd});
      int dy = scaleJoystickMouseDelta(y, JOY${i}_DZ, ${spd});
      if (dx != 0 || dy != 0) Mouse.move(dx, dy, 0);${(j.ledPin ?? -1) >= 0 ? `
      if (JOY${i}_LED_MODE == 1) digitalWrite(JOY${i}_LED, HIGH);
      else digitalWrite(JOY${i}_LED, (dx != 0 || dy != 0) ? HIGH : LOW);` : ""}${hasBtn ? `
      // Click button → ${mouseBtn}
      bool bs = digitalRead(JOY${i}_BTN);
      if (bs != joy${i}BtnLast) { delay(20); bs = digitalRead(JOY${i}_BTN); }
      if (bs != joy${i}BtnLast) {
        if (bs == LOW) Mouse.press(${mouseBtn}); else Mouse.release(${mouseBtn});
        joy${i}BtnLast = bs;
      }` : ""}
    }\n`;
      } else {
        // Key mode: digital press/release per direction
        joyLoop += `    { int rawX = analogRead(JOY${i}_X); int rawY = analogRead(JOY${i}_Y);
      updateJoystickCenter(rawX, joy${i}CenterX, JOY${i}_DZ);
      updateJoystickCenter(rawY, joy${i}CenterY, JOY${i}_DZ);
      int x = ${xi}; int y = ${yi};
      // Y axis
      if (y < -JOY${i}_DZ) {
        if (!joy${i}U && JOY${i}_UP   != 0) { Keyboard.press(JOY${i}_UP);   joy${i}U=true; }
        if ( joy${i}D && JOY${i}_DOWN != 0) { Keyboard.release(JOY${i}_DOWN); joy${i}D=false; }
      } else if (y > JOY${i}_DZ) {
        if (!joy${i}D && JOY${i}_DOWN != 0) { Keyboard.press(JOY${i}_DOWN); joy${i}D=true; }
        if ( joy${i}U && JOY${i}_UP   != 0) { Keyboard.release(JOY${i}_UP);  joy${i}U=false; }
      } else {
        if (joy${i}U && JOY${i}_UP   != 0) { Keyboard.release(JOY${i}_UP);   joy${i}U=false; }
        if (joy${i}D && JOY${i}_DOWN != 0) { Keyboard.release(JOY${i}_DOWN); joy${i}D=false; }
      }
      // X axis
      if (x < -JOY${i}_DZ) {
        if (!joy${i}L && JOY${i}_LEFT  != 0) { Keyboard.press(JOY${i}_LEFT);  joy${i}L=true; }
        if ( joy${i}R && JOY${i}_RIGHT != 0) { Keyboard.release(JOY${i}_RIGHT); joy${i}R=false; }
      } else if (x > JOY${i}_DZ) {
        if (!joy${i}R && JOY${i}_RIGHT != 0) { Keyboard.press(JOY${i}_RIGHT); joy${i}R=true; }
        if ( joy${i}L && JOY${i}_LEFT  != 0) { Keyboard.release(JOY${i}_LEFT); joy${i}L=false; }
      } else {
        if (joy${i}L && JOY${i}_LEFT  != 0) { Keyboard.release(JOY${i}_LEFT);  joy${i}L=false; }
        if (joy${i}R && JOY${i}_RIGHT != 0) { Keyboard.release(JOY${i}_RIGHT); joy${i}R=false; }
      }${(j.ledPin ?? -1) >= 0 ? `
      if (JOY${i}_LED_MODE == 1) digitalWrite(JOY${i}_LED, HIGH);
      else { bool active = joy${i}U || joy${i}D || joy${i}L || joy${i}R; digitalWrite(JOY${i}_LED, active ? HIGH : LOW); }` : ""}${hasBtn ? `
      // Click button
      bool bs = digitalRead(JOY${i}_BTN);
      if (bs != joy${i}BtnLast) { delay(20); bs = digitalRead(JOY${i}_BTN); }
      if (bs != joy${i}BtnLast) {
        if (bs == LOW) Keyboard.press(JOY${i}_BTN_KEY); else Keyboard.release(JOY${i}_BTN_KEY);
        joy${i}BtnLast = bs;
      }` : ""}
    }\n`;
      }
    });
    joyLoop += `  }`;
  }

  // ── Site identifier + config hash ────────────────────────────────────────
  const configPayload = JSON.stringify({ b: buttons.map(x=>x.pin), ir: irSensors.map(x=>x.pin), sp: sipPuffs.map(x=>x.pin), j: joysticks.map(x=>x.xPin) });
  let _h = 0;
  for (let _i = 0; _i < configPayload.length; _i++) { _h = Math.imul(31, _h) + configPayload.charCodeAt(_i) | 0; }
  const configId = ((_h >>> 0).toString(16).padStart(8, "0")).toUpperCase();

  const headerComment = `// ════════════════════════════════════════════════════
//  Arduino Button Mapper
//  arduino.jacobmajors.com
//  Config ID: ${configId}
// ════════════════════════════════════════════════════
`;

  // ── Assemble ──────────────────────────────────────────────────────────────

  const allLoopParts = [irLoop, spLoop, joyLoop].filter(Boolean);
  const hasMouseJoy = joysticks.some((j) => j.mouseMode);

  const btnSection = n > 0 ? `
${btnComments}

const int numButtons = ${n};
const int buttonPins[${n}] = {${btnPins}};
const int keyValues[${n}] = {${btnKeys}};
const int buttonModes[${n}] = {${btnModes}}; // 0=hold 1=toggle 2=power 3=tap
const int buttonLedPins[${n}] = {${btnLedPins}}; // -1 = no LED
bool lastButtonState[${n}];
bool toggleState[${n}] = {${configured.map(() => "false").join(", ")}};` : "";

  const resetRuntimeStateParts: string[] = [`  Keyboard.releaseAll();`];
  if (hasMouseJoy) {
    resetRuntimeStateParts.push(
      "  Mouse.release(MOUSE_LEFT);",
      "  Mouse.release(MOUSE_RIGHT);",
      "  Mouse.release(MOUSE_MIDDLE);",
    );
  }
  if (n > 0) {
    resetRuntimeStateParts.push(
      `  for (int i = 0; i < numButtons; i++) {
    if (buttonModes[i] != 2) {
      lastButtonState[i] = HIGH;
      if (buttonModes[i] == 1) toggleState[i] = false;
      if (buttonLedPins[i] >= 0) digitalWrite(buttonLedPins[i], LOW);
    }
  }`,
    );
  }
  if (irSensors.length > 0) {
    resetRuntimeStateParts.push(
      `  for (int i = 0; i < numIR; i++) {
    lastIRState[i] = irActiveHigh[i] ? LOW : HIGH;
    irToggleState[i] = false;${irSensors.some((s) => (s.ledPin ?? -1) >= 0) ? `
    if (irLedPins[i] >= 0) digitalWrite(irLedPins[i], irLedModes[i] == 1 ? HIGH : LOW);` : ""}
  }`,
    );
  }
  if (sipPuffs.length > 0) {
    resetRuntimeStateParts.push(...sipPuffs.map((s, i) => {
      const hasLed = (s.ledPin ?? -1) >= 0;
      return `  sp${i}Pressed = false;${hasLed ? `\n  digitalWrite(${s.ledPin}, ${s.ledMode === "always" ? "HIGH" : "LOW"});` : ""}`;
    }));
  }
  if (joysticks.length > 0) {
    resetRuntimeStateParts.push(...joysticks.flatMap((j, i) => {
      const lines = [
        `  joy${i}U = false;`,
        `  joy${i}D = false;`,
        `  joy${i}L = false;`,
        `  joy${i}R = false;`,
      ];
      if ((j.ledPin ?? -1) >= 0) lines.push(`  digitalWrite(JOY${i}_LED, ${j.ledMode === "always" ? "HIGH" : "LOW"});`);
      if (j.buttonPin >= 0 && j.buttonKey) lines.push(`  joy${i}BtnLast = HIGH;`);
      return lines;
    }));
  }

  const resetRuntimeStateSection = `
void resetRuntimeState(int powerButtonIndex) {
${resetRuntimeStateParts.join("\n")}
${n > 0 ? `  if (powerButtonIndex >= 0 && powerButtonIndex < ${n}) {
    lastButtonState[powerButtonIndex] = LOW;
  }` : ""}
}`;

  const btnLoopBody = n > 0 ? `  for (int i = 0; i < numButtons; i++) {
    bool state = digitalRead(buttonPins[i]);
    if (state != lastButtonState[i]) {
      delay(20);
      state = digitalRead(buttonPins[i]);
      if (state != lastButtonState[i]) {
        if (buttonModes[i] == 2) {
          if (state == LOW) {
            systemActive = !systemActive;
            resetRuntimeState(i);
            updateLEDs();
            if (buttonLedPins[i] >= 0) digitalWrite(buttonLedPins[i], systemActive ? HIGH : LOW);
          }
        } else if (systemActive) {
          if (buttonModes[i] == 0) {
            if (state == LOW) Keyboard.press(keyValues[i]);
            else Keyboard.release(keyValues[i]);
            if (buttonLedPins[i] >= 0) digitalWrite(buttonLedPins[i], state == LOW ? HIGH : LOW);
          } else if (buttonModes[i] == 3) {
            if (state == LOW) { Keyboard.press(keyValues[i]); delay(30); Keyboard.release(keyValues[i]); }
            if (buttonLedPins[i] >= 0) digitalWrite(buttonLedPins[i], state == LOW ? HIGH : LOW);
          } else {
            if (state == LOW) {
              toggleState[i] = !toggleState[i];
              if (toggleState[i]) Keyboard.press(keyValues[i]);
              else Keyboard.release(keyValues[i]);
              if (buttonLedPins[i] >= 0) digitalWrite(buttonLedPins[i], toggleState[i] ? HIGH : LOW);
            }
          }
        }
        lastButtonState[i] = state;
      }
    }
  }` : "";

  const btnLedSetup = hasAnyLed ? `  for (int i = 0; i < numButtons; i++) {
    if (buttonLedPins[i] >= 0) {
      pinMode(buttonLedPins[i], OUTPUT);
      digitalWrite(buttonLedPins[i], LOW);
    }
  }` : "";

  const btnSetup = n > 0 ? `  for (int i = 0; i < numButtons; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
    lastButtonState[i] = HIGH;
  }
${btnLedSetup}` : "";

  const allSetupParts = [btnSetup, ledSetup, irSetup, spSetup, joySetup].filter(Boolean);

  // ── Compact remap config embedded in sketch ──────────────────────────────
  const remapConfig = JSON.stringify({
    v: 2,
    id: configId,
    leds,
    b: [
      ...buttons.map((b) => ({
        t: "button" as const,
        p: b.pin,
        k: b.arduinoKey,
        kd: b.keyDisplay,
        n: b.name,
        m: b.mode === "toggle" ? 1 : b.mode === "power" ? 2 : (b.inputMode ?? "hold") === "tap" ? 3 : 0,
        lp: b.ledPin,
        lm: b.ledMode === "always" ? 1 : 0,
        st: b.subtype ?? "switch",
      })),
      ...ports.map((p) => ({
        t: "port" as const,
        p: p.pin,
        k: p.arduinoKey,
        kd: p.keyDisplay,
        n: p.name,
        m: p.mode === "toggle" ? 1 : p.mode === "power" ? 2 : (p.inputMode ?? "hold") === "tap" ? 3 : 0,
        lp: p.ledPin,
        lm: p.ledMode === "always" ? 1 : 0,
        st: p.subtype ?? "switch",
      })),
    ],
    ir: irSensors.map((ir) => ({
      p: ir.pin,
      k: ir.arduinoKey,
      kd: ir.keyDisplay,
      n: ir.name,
      ah: ir.activeHigh,
      m: ir.mode === "toggle" ? 1 : (ir.inputMode ?? "hold") === "tap" ? 2 : 0,
      lp: ir.ledPin,
      lm: ir.ledMode === "always" ? 1 : 0,
    })),
    sp: sipPuffs.map((sp) => ({
      p: sp.pin,
      k: sp.key,
      kd: sp.keyDisplay,
      n: sp.name || "Sip & Puff",
      m: sp.inputMode === "tap" ? 1 : 0,
      lp: sp.ledPin,
      lm: sp.ledMode === "always" ? 1 : 0,
    })),
    j: joysticks.map((j) => ({
      x: j.xPin,
      y: j.yPin,
      bp: j.buttonPin,
      u: j.upKey,
      ud: j.upDisplay,
      d: j.downKey,
      dd: j.downDisplay,
      l: j.leftKey,
      ld: j.leftDisplay,
      r: j.rightKey,
      rd: j.rightDisplay,
      bk: j.buttonKey,
      bkd: j.buttonDisplay,
      n: j.name,
      dz: j.deadzone,
      ix: j.invertX,
      iy: j.invertY,
      lp: j.ledPin,
      lm: j.ledMode === "always" ? 1 : 0,
      mm: !!j.mouseMode,
      ms: j.mouseSpeed ?? 8,
      mb: j.mouseClickBtn ?? "left",
    })),
  });
  // Escape for C string literal
  const remapJson = remapConfig.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const remapSection = `
// ── Remap protocol ────────────────────────────────────────────────────────
const char REMAP_CONFIG[] = "${remapJson}";
String _serialBuf = "";
void checkSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\\n' || c == '\\r') {
      String cmd = _serialBuf;
      _serialBuf = "";
      if (cmd.startsWith("REMAP")) {
        Serial.println(F("CONFIG_START"));
        Serial.println(REMAP_CONFIG);
        Serial.println(F("CONFIG_END"));
      }
    } else if (_serialBuf.length() < 16) {
      _serialBuf += c;
    }
  }
}`;

  return `${headerComment}#include <Keyboard.h>${hasMouseJoy ? "\n#include <Mouse.h>" : ""}
${btnSection}
bool systemActive = true;
${ledSection}${irGlobals}${spGlobals}${joyGlobals}${remapSection}${resetRuntimeStateSection}
void setup() {
  Serial.begin(9600);
${allSetupParts.join("\n")}
  updateLEDs();
  Keyboard.begin();${hasMouseJoy ? "\n  Mouse.begin();" : ""}
}

void loop() {
  checkSerial();
${btnLoopBody}
${allLoopParts.join("\n")}
}
`;
}
