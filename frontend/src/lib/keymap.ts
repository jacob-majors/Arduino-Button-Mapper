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
}

/** Analog sip-and-puff sensor — sip and puff map to separate keys */
export interface SipPuffConfig {
  id: string;
  name: string;
  analogPin: number;     // 0–5 → A0–A5
  sipKey: string;
  sipDisplay: string;
  puffKey: string;
  puffDisplay: string;
  sipThreshold: number;  // analog value below which = sip  (default 300)
  puffThreshold: number; // analog value above which = puff (default 700)
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  const btnPins  = configured.map((b) => b.pin).join(", ");
  const btnKeys  = configured.map((b) =>
    b.mode === "power" ? "0" : keyLiteral(b.arduinoKey)
  ).join(", ");
  const btnModes = configured.map((b) =>
    b.mode === "power" ? "2" : b.mode === "toggle" ? "1" : "0"
  ).join(", ");

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

    irGlobals = `
${irCmt}
const int numIR = ${m};
const int irPins[${m}] = {${irPins}};
const int irKeys[${m}] = {${irKeys}};
const int irModes[${m}] = {${irModes}}; // 0=momentary 1=toggle
const bool irActiveHigh[${m}] = {${irAH}};
bool lastIRState[${m}];
bool irToggleState[${m}] = {${irSensors.map(() => "false").join(", ")}};
`;

    irSetup = `  for (int i = 0; i < numIR; i++) {
    pinMode(irPins[i], INPUT);
    lastIRState[i] = irActiveHigh[i] ? LOW : HIGH; // start inactive
  }`;

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
      }
    }
  }`;
  }

  // ── Sip & puff ────────────────────────────────────────────────────────────

  let spGlobals = "";
  let spLoop    = "";

  if (sipPuffs.length > 0) {
    const spCmt = sipPuffs
      .map((s, i) => `// Sip&Puff ${i + 1}${s.name ? `: ${s.name}` : ""} — A${s.analogPin}`)
      .join("\n");

    spGlobals = `\n${spCmt}\n`;
    sipPuffs.forEach((s, i) => {
      spGlobals += `const int SP${i}_PIN = A${s.analogPin};\n`;
      spGlobals += `const int SP${i}_SIP_KEY = ${keyLiteral(s.sipKey)};\n`;
      spGlobals += `const int SP${i}_PUFF_KEY = ${keyLiteral(s.puffKey)};\n`;
      spGlobals += `const int SP${i}_SIP_THR = ${s.sipThreshold};\n`;
      spGlobals += `const int SP${i}_PUFF_THR = ${s.puffThreshold};\n`;
      spGlobals += `bool sp${i}Sip = false, sp${i}Puff = false;\n`;
    });

    spLoop = `  // ── Sip & puff\n  if (systemActive) {\n`;
    sipPuffs.forEach((s, i) => {
      spLoop += `    { int v = analogRead(SP${i}_PIN);
      if (v < SP${i}_SIP_THR) {
        if (!sp${i}Sip  && SP${i}_SIP_KEY  != 0) { Keyboard.press(SP${i}_SIP_KEY);  sp${i}Sip  = true; }
        if ( sp${i}Puff && SP${i}_PUFF_KEY != 0) { Keyboard.release(SP${i}_PUFF_KEY); sp${i}Puff = false; }
      } else if (v > SP${i}_PUFF_THR) {
        if (!sp${i}Puff && SP${i}_PUFF_KEY != 0) { Keyboard.press(SP${i}_PUFF_KEY); sp${i}Puff = true; }
        if ( sp${i}Sip  && SP${i}_SIP_KEY  != 0) { Keyboard.release(SP${i}_SIP_KEY);  sp${i}Sip  = false; }
      } else {
        if (sp${i}Sip  && SP${i}_SIP_KEY  != 0) { Keyboard.release(SP${i}_SIP_KEY);  sp${i}Sip  = false; }
        if (sp${i}Puff && SP${i}_PUFF_KEY != 0) { Keyboard.release(SP${i}_PUFF_KEY); sp${i}Puff = false; }
      } }\n`;
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
      }${hasBtn ? `
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
          }
        } else if (systemActive) {
          if (buttonModes[i] == 0) {
            if (state == LOW) Keyboard.press(keyValues[i]);
            else Keyboard.release(keyValues[i]);
          } else {
            if (state == LOW) {
              toggleState[i] = !toggleState[i];
              if (toggleState[i]) Keyboard.press(keyValues[i]);
              else Keyboard.release(keyValues[i]);
            }
          }
        }
        lastButtonState[i] = state;
      }
    }
  }` : "";

  const btnSetup = n > 0 ? `  for (int i = 0; i < numButtons; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
    lastButtonState[i] = HIGH;
  }` : "";

  const allSetupParts = [btnSetup, ledSetup, irSetup, joySetup].filter(Boolean);

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
