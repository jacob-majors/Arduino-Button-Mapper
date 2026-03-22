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
  return `'${k}'`;
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

  if (configured.length === 0 && !hasSensors) {
    return [
      "#include <Keyboard.h>",
      "",
      "// No buttons or sensors configured yet.",
      "// Add inputs and assign keys in the configurator.",
      "",
      "void setup() {",
      "  Keyboard.begin();",
      "}",
      "",
      "void loop() {}",
    ].join("\n");
  }

  // ── Buttons / ports ───────────────────────────────────────────────────────

  const n = configured.length;

  const btnComments = configured
    .map((b, i) => {
      const label = b.name ? `: ${b.name}` : "";
      const key = b.mode === "power" ? "POWER TOGGLE" : `${b.keyDisplay || b.arduinoKey}`;
      return `// Button ${i + 1}${label} — Pin ${b.pin} → ${key} (${b.mode})`;
    })
    .join("\n");

  const btnPins    = configured.map((b) => b.pin).join(", ");
  const btnKeys    = configured.map((b) =>
    b.mode === "power" ? "0" : keyLiteral(b.arduinoKey)
  ).join(", ");
  const btnModes   = configured.map((b) =>
    b.mode === "power" ? "2" : b.mode === "toggle" ? "1" : "0"
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
    const irModes = irSensors.map((s) => s.mode === "toggle" ? "1" : "0").join(", ");
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
const int irModes[${m}] = {${irModes}}; // 0=momentary 1=toggle
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
      spLoop += `    { bool pressed = (digitalRead(SP${i}_PIN) == LOW);
      if (pressed && !sp${i}Pressed && SP${i}_KEY != 0) { Keyboard.press(SP${i}_KEY); sp${i}Pressed = true; }
      if (!pressed && sp${i}Pressed && SP${i}_KEY != 0) { Keyboard.release(SP${i}_KEY); sp${i}Pressed = false; }${hasLed ? `
      digitalWrite(${ledPin}, ${alwaysOn ? "HIGH" : "pressed ? HIGH : LOW"});` : ""}
    }\n`;
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

    joyGlobals = `\n${joyCmt}\n`;
    const joyBtnSetups: string[] = [];

    joysticks.forEach((j, i) => {
      joyGlobals += `const int JOY${i}_X = A${j.xPin};\n`;
      joyGlobals += `const int JOY${i}_Y = A${j.yPin};\n`;
      joyGlobals += `const int JOY${i}_DZ = ${j.deadzone};\n`;
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
    const joyLedSetup = joysticks.filter((j) => (j.ledPin ?? -1) >= 0).map((j) => `  pinMode(${j.ledPin}, OUTPUT); digitalWrite(${j.ledPin}, ${j.ledMode === "always" ? "HIGH" : "LOW"});`).join("\n");
    if (joyLedSetup) joySetup = (joySetup ? joySetup + "\n" : "") + joyLedSetup;

    joyLoop = `  // ── Joysticks\n  if (systemActive) {\n`;
    joysticks.forEach((j, i) => {
      const xi = j.invertX ? `-(analogRead(JOY${i}_X) - 512)` : `analogRead(JOY${i}_X) - 512`;
      const yi = j.invertY ? `-(analogRead(JOY${i}_Y) - 512)` : `analogRead(JOY${i}_Y) - 512`;
      const hasBtn = j.buttonPin >= 0 && j.buttonKey;
      joyLoop += `    { int x = ${xi}; int y = ${yi};
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
    });
    joyLoop += `  }`;
  }

  // ── Assemble ──────────────────────────────────────────────────────────────

  const allLoopParts = [irLoop, spLoop, joyLoop].filter(Boolean);

  const btnSection = n > 0 ? `
${btnComments}

const int numButtons = ${n};
const int buttonPins[${n}] = {${btnPins}};
const int keyValues[${n}] = {${btnKeys}};
const int buttonModes[${n}] = {${btnModes}}; // 0=momentary 1=toggle 2=power
const int buttonLedPins[${n}] = {${btnLedPins}}; // -1 = no LED
bool lastButtonState[${n}];
bool toggleState[${n}] = {${configured.map(() => "false").join(", ")}};` : "";

  const btnLoopBody = n > 0 ? `  for (int i = 0; i < numButtons; i++) {
    bool state = digitalRead(buttonPins[i]);
    if (state != lastButtonState[i]) {
      delay(20);
      state = digitalRead(buttonPins[i]);
      if (state != lastButtonState[i]) {
        if (buttonModes[i] == 2) {
          if (state == LOW) {
            systemActive = !systemActive;
            if (!systemActive) Keyboard.releaseAll();
            updateLEDs();
            if (buttonLedPins[i] >= 0) digitalWrite(buttonLedPins[i], systemActive ? HIGH : LOW);
          }
        } else if (systemActive) {
          if (buttonModes[i] == 0) {
            if (state == LOW) Keyboard.press(keyValues[i]);
            else Keyboard.release(keyValues[i]);
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

  return `#include <Keyboard.h>
${btnSection}
bool systemActive = true;
${ledSection}${irGlobals}${spGlobals}${joyGlobals}
void setup() {
${allSetupParts.join("\n")}
  updateLEDs();
  Keyboard.begin();
}

void loop() {
${btnLoopBody}
${allLoopParts.join("\n")}
}
`;
}
