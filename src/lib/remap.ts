import {
  type ButtonConfig,
  type IRSensorConfig,
  type JoystickConfig,
  type LedConfig,
  type PortConfig,
  type SipPuffConfig,
  generateSketch,
} from "@/lib/keymap";

export interface RemapEntry {
  id: string;
  name: string;
  type: "button" | "port" | "ir" | "sipPuff" | "joystick-up" | "joystick-down" | "joystick-left" | "joystick-right" | "joystick-btn";
  pin: string;
  arduinoKey: string;
  newKey: string;
  newDisplay: string;
}

type EmbeddedButton = {
  t?: "button" | "port";
  p: number;
  k: string;
  kd?: string;
  n: string;
  m: number;
  lp?: number;
  lm?: 0 | 1;
  st?: "switch" | "button";
};

type EmbeddedIR = {
  p: number;
  k: string;
  kd?: string;
  n: string;
  ah?: boolean;
  m?: number;
  lp?: number;
  lm?: 0 | 1;
};

type EmbeddedSipPuff = {
  p: number;
  k: string;
  kd?: string;
  n: string;
  m?: number;
  lp?: number;
  lm?: 0 | 1;
};

type EmbeddedJoystick = {
  x: number;
  y: number;
  bp: number;
  u: string;
  ud?: string;
  d: string;
  dd?: string;
  l: string;
  ld?: string;
  r: string;
  rd?: string;
  bk: string;
  bkd?: string;
  n: string;
  dz?: number;
  ix?: boolean;
  iy?: boolean;
  lp?: number;
  lm?: 0 | 1;
  mm?: boolean;
  ms?: number;
  mb?: "left" | "right" | "middle";
};

export interface EmbeddedRemapConfig {
  v: number;
  id?: string;
  leds?: LedConfig;
  b: EmbeddedButton[];
  ir: EmbeddedIR[];
  sp: EmbeddedSipPuff[];
  j: EmbeddedJoystick[];
}

export interface StandaloneDeviceConfig {
  leds: LedConfig;
  buttons: ButtonConfig[];
  ports: PortConfig[];
  irSensors: IRSensorConfig[];
  sipPuffs: SipPuffConfig[];
  joysticks: JoystickConfig[];
}

export interface ParsedRemapPayload {
  entries: RemapEntry[];
  rawConfig: EmbeddedRemapConfig;
  deviceConfig: StandaloneDeviceConfig | null;
}

export function arduinoKeyDisplay(k: string): string {
  if (!k || k === "0") return "—";
  if (k.startsWith("KEY_")) {
    const map: Record<string, string> = {
      KEY_UP_ARROW: "↑", KEY_DOWN_ARROW: "↓", KEY_LEFT_ARROW: "←", KEY_RIGHT_ARROW: "→",
      KEY_RETURN: "Enter", KEY_BACKSPACE: "Backspace", KEY_TAB: "Tab", KEY_ESC: "Escape",
      KEY_DELETE: "Delete", KEY_INSERT: "Insert", KEY_HOME: "Home", KEY_END: "End",
      KEY_PAGE_UP: "PgUp", KEY_PAGE_DOWN: "PgDn", KEY_CAPS_LOCK: "Caps",
      KEY_F1: "F1", KEY_F2: "F2", KEY_F3: "F3", KEY_F4: "F4", KEY_F5: "F5", KEY_F6: "F6",
      KEY_F7: "F7", KEY_F8: "F8", KEY_F9: "F9", KEY_F10: "F10", KEY_F11: "F11", KEY_F12: "F12",
    };
    return map[k] ?? k;
  }
  return k === " " ? "Space" : k.toUpperCase();
}

function buttonModeFromEmbedded(mode: number): ButtonConfig["mode"] {
  if (mode === 2) return "power";
  if (mode === 1) return "toggle";
  return "momentary";
}

function inputModeFromEmbedded(mode: number): "hold" | "tap" {
  return mode === 3 ? "tap" : "hold";
}

function buildStandaloneConfig(cfg: EmbeddedRemapConfig): StandaloneDeviceConfig | null {
  if (cfg.v < 2 || !cfg.leds) return null;

  const buttons: ButtonConfig[] = [];
  const ports: PortConfig[] = [];

  cfg.b?.forEach((b, i) => {
    const entry: ButtonConfig = {
      id: `${b.t ?? "button"}-${i}`,
      name: b.n || `${b.t === "port" ? "Port" : "Button"} D${b.p}`,
      pin: b.p,
      keyDisplay: b.kd || arduinoKeyDisplay(b.k),
      arduinoKey: b.k,
      mode: buttonModeFromEmbedded(b.m),
      ledPin: b.lp ?? -1,
      ledMode: b.lm === 1 ? "always" : "active",
      inputMode: inputModeFromEmbedded(b.m),
      subtype: b.st ?? "switch",
    };
    if (b.t === "port") ports.push(entry);
    else buttons.push(entry);
  });

  const irSensors: IRSensorConfig[] = (cfg.ir ?? []).map((ir, i) => ({
    id: `ir-${i}`,
    name: ir.n || `IR Sensor D${ir.p}`,
    pin: ir.p,
    keyDisplay: ir.kd || arduinoKeyDisplay(ir.k),
    arduinoKey: ir.k,
    mode: ir.m === 1 ? "toggle" : "momentary",
    activeHigh: ir.ah ?? false,
    ledPin: ir.lp ?? -1,
    ledMode: ir.lm === 1 ? "always" : "active",
    inputMode: ir.m === 2 ? "tap" : "hold",
  }));

  const sipPuffs: SipPuffConfig[] = (cfg.sp ?? []).map((sp, i) => ({
    id: `sp-${i}`,
    name: sp.n || `Sip & Puff D${sp.p}`,
    pin: sp.p,
    key: sp.k,
    keyDisplay: sp.kd || arduinoKeyDisplay(sp.k),
    ledPin: sp.lp ?? -1,
    ledMode: sp.lm === 1 ? "always" : "active",
    inputMode: sp.m === 1 ? "tap" : "hold",
  }));

  const joysticks: JoystickConfig[] = (cfg.j ?? []).map((j, i) => ({
    id: `joy-${i}`,
    name: j.n || "Joystick",
    xPin: j.x,
    yPin: j.y,
    buttonPin: j.bp ?? -1,
    upKey: j.u,
    upDisplay: j.ud || arduinoKeyDisplay(j.u),
    downKey: j.d,
    downDisplay: j.dd || arduinoKeyDisplay(j.d),
    leftKey: j.l,
    leftDisplay: j.ld || arduinoKeyDisplay(j.l),
    rightKey: j.r,
    rightDisplay: j.rd || arduinoKeyDisplay(j.r),
    buttonKey: j.bk || "",
    buttonDisplay: j.bkd || arduinoKeyDisplay(j.bk || ""),
    deadzone: j.dz ?? 200,
    invertX: !!j.ix,
    invertY: !!j.iy,
    ledPin: j.lp ?? -1,
    ledMode: j.lm === 1 ? "always" : "active",
    mouseMode: !!j.mm,
    mouseSpeed: j.ms ?? 8,
    mouseClickBtn: j.mb ?? "left",
  }));

  return {
    leds: cfg.leds,
    buttons,
    ports,
    irSensors,
    sipPuffs,
    joysticks,
  };
}

export function parseRemapPayload(json: string): ParsedRemapPayload {
  const cfg: EmbeddedRemapConfig = JSON.parse(json);
  const entries: RemapEntry[] = [];

  cfg.b?.forEach((b, i) => {
    entries.push({
      id: `b-${i}`,
      name: b.n || `${b.t === "port" ? "Port" : "Button"} D${b.p}`,
      type: b.t === "port" ? "port" : "button",
      pin: `D${b.p}`,
      arduinoKey: b.k,
      newKey: b.k,
      newDisplay: b.kd || arduinoKeyDisplay(b.k),
    });
  });

  cfg.ir?.forEach((ir, i) => {
    entries.push({
      id: `ir-${i}`,
      name: ir.n || `IR Sensor D${ir.p}`,
      type: "ir",
      pin: `D${ir.p}`,
      arduinoKey: ir.k,
      newKey: ir.k,
      newDisplay: ir.kd || arduinoKeyDisplay(ir.k),
    });
  });

  cfg.sp?.forEach((sp, i) => {
    entries.push({
      id: `sp-${i}`,
      name: sp.n || `Sip & Puff D${sp.p}`,
      type: "sipPuff",
      pin: `D${sp.p}`,
      arduinoKey: sp.k,
      newKey: sp.k,
      newDisplay: sp.kd || arduinoKeyDisplay(sp.k),
    });
  });

  cfg.j?.forEach((j, i) => {
    const dirs: { type: RemapEntry["type"]; label: string; key: string; kd?: string }[] = [
      { type: "joystick-up", label: "↑ Up", key: j.u, kd: j.ud },
      { type: "joystick-down", label: "↓ Down", key: j.d, kd: j.dd },
      { type: "joystick-left", label: "← Left", key: j.l, kd: j.ld },
      { type: "joystick-right", label: "→ Right", key: j.r, kd: j.rd },
    ];
    if (j.bp >= 0 && j.bk) dirs.push({ type: "joystick-btn", label: "⏺ Click", key: j.bk, kd: j.bkd });
    dirs.forEach((d, di) => {
      entries.push({
        id: `j-${i}-${di}`,
        name: `${j.n || "Joystick"} ${d.label}`,
        type: d.type,
        pin: `A${j.x}`,
        arduinoKey: d.key,
        newKey: d.key,
        newDisplay: d.kd || arduinoKeyDisplay(d.key),
      });
    });
  });

  return {
    entries,
    rawConfig: cfg,
    deviceConfig: buildStandaloneConfig(cfg),
  };
}

export function buildRemappedSketch(deviceConfig: StandaloneDeviceConfig, entries: RemapEntry[]): string {
  const buttons = deviceConfig.buttons.map((b, i) => {
    const e = entries.find((entry) => entry.id === `b-${i}`);
    return e ? { ...b, arduinoKey: e.newKey, keyDisplay: e.newDisplay } : b;
  });

  const ports = deviceConfig.ports.map((p, i) => {
    const buttonIndex = deviceConfig.buttons.length + i;
    const e = entries.find((entry) => entry.id === `b-${buttonIndex}`);
    return e ? { ...p, arduinoKey: e.newKey, keyDisplay: e.newDisplay } : p;
  });

  const irSensors = deviceConfig.irSensors.map((ir, i) => {
    const e = entries.find((entry) => entry.id === `ir-${i}`);
    return e ? { ...ir, arduinoKey: e.newKey, keyDisplay: e.newDisplay } : ir;
  });

  const sipPuffs = deviceConfig.sipPuffs.map((sp, i) => {
    const e = entries.find((entry) => entry.id === `sp-${i}`);
    return e ? { ...sp, key: e.newKey, keyDisplay: e.newDisplay } : sp;
  });

  const joysticks = deviceConfig.joysticks.map((joy, i) => {
    const up = entries.find((entry) => entry.id === `j-${i}-0`);
    const down = entries.find((entry) => entry.id === `j-${i}-1`);
    const left = entries.find((entry) => entry.id === `j-${i}-2`);
    const right = entries.find((entry) => entry.id === `j-${i}-3`);
    const btn = entries.find((entry) => entry.id === `j-${i}-4`);
    return {
      ...joy,
      ...(up ? { upKey: up.newKey, upDisplay: up.newDisplay } : {}),
      ...(down ? { downKey: down.newKey, downDisplay: down.newDisplay } : {}),
      ...(left ? { leftKey: left.newKey, leftDisplay: left.newDisplay } : {}),
      ...(right ? { rightKey: right.newKey, rightDisplay: right.newDisplay } : {}),
      ...(btn ? { buttonKey: btn.newKey, buttonDisplay: btn.newDisplay } : {}),
    };
  });

  return generateSketch(
    buttons,
    deviceConfig.leds,
    ports,
    irSensors,
    sipPuffs,
    joysticks,
  );
}
