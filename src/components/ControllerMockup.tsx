"use client";

import { useEffect, useState } from "react";
import { ButtonConfig, PortConfig, JoystickConfig, KEY_MAP } from "@/lib/keymap";

const arduinoToBrowserKey: Record<string, string> = {};
for (const [browserKey, val] of Object.entries(KEY_MAP)) {
  arduinoToBrowserKey[val.arduino] = browserKey;
}

function resolveBrowserKey(arduinoKey: string) {
  return arduinoToBrowserKey[arduinoKey] ?? arduinoKey;
}

interface Props {
  buttons: ButtonConfig[];
  ports: PortConfig[];
  joysticks: JoystickConfig[];
}

// ABXY colours matching Xbox
const ABXY = [
  { label: "A", color: "#22c55e", glow: "rgba(34,197,94,0.7)" },
  { label: "B", color: "#ef4444", glow: "rgba(239,68,68,0.7)" },
  { label: "X", color: "#3b82f6", glow: "rgba(59,130,246,0.7)" },
  { label: "Y", color: "#eab308", glow: "rgba(234,179,8,0.7)" },
];

export default function ControllerMockup({ buttons, ports, joysticks }: Props) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const down = (e: KeyboardEvent) =>
      setPressedKeys((p) => { const n = new Set(p); n.add(e.key); return n; });
    const up = (e: KeyboardEvent) =>
      setPressedKeys((p) => { const n = new Set(p); n.delete(e.key); return n; });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const isPressed = (arduinoKey: string) => {
    if (!arduinoKey) return false;
    return pressedKeys.has(resolveBrowserKey(arduinoKey));
  };

  const allInputs = [...buttons, ...ports];

  // Map inputs to controller regions
  // Face buttons: first 4 → ABXY diamond (right side)
  // D-pad: joystick[0] or buttons 4-7
  // Bumpers: next two buttons
  // Center: next two buttons
  const facebtns = allInputs.slice(0, 4);
  const bumpers = allInputs.slice(4, 6);
  const centerBtns = allInputs.slice(6, 8);
  const extraBtns = allInputs.slice(8);

  const hasJoy0 = joysticks.length > 0;
  const hasJoy1 = joysticks.length > 1;

  const dpadJoy = joysticks[0] ?? null;
  const rsJoy = joysticks[1] ?? null;

  // Helpers
  const isJoyDir = (joy: JoystickConfig | null, dir: "up"|"down"|"left"|"right") => {
    if (!joy) return false;
    const k = dir === "up" ? joy.upKey : dir === "down" ? joy.downKey : dir === "left" ? joy.leftKey : joy.rightKey;
    return pressedKeys.has(resolveBrowserKey(k));
  };

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Controller SVG */}
      <div style={{ width: "100%", maxWidth: 560 }}>
        <svg
          viewBox="0 0 560 340"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "auto", overflow: "visible" }}
        >
          <defs>
            <filter id="glow-green">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-red">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-blue">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="btn-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="bodyGrad" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#2d3748" />
              <stop offset="100%" stopColor="#111827" />
            </radialGradient>
            <radialGradient id="bodyShine" cx="50%" cy="0%" r="60%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          {/* ── Controller body ── */}
          {/* Main body shape — Xbox One-like silhouette */}
          <path
            d="
              M 140 60
              C 140 40, 160 28, 190 28
              L 370 28
              C 400 28, 420 40, 420 60
              L 430 90
              C 455 90, 500 110, 510 145
              C 520 170, 510 200, 490 215
              L 460 230
              C 445 260, 430 300, 415 320
              C 405 335, 385 340, 365 340
              L 340 340
              C 320 340, 305 328, 298 315
              L 280 290
              L 262 315
              C 255 328, 240 340, 220 340
              L 195 340
              C 175 340, 155 335, 145 320
              C 130 300, 115 260, 100 230
              L 70 215
              C 50 200, 40 170, 50 145
              C 60 110, 105 90, 130 90
              Z
            "
            fill="url(#bodyGrad)"
            stroke="rgba(75,85,99,0.7)"
            strokeWidth="1.5"
          />
          {/* Surface shine */}
          <path
            d="
              M 140 60
              C 140 40, 160 28, 190 28
              L 370 28
              C 400 28, 420 40, 420 60
              L 430 90
              C 455 90, 500 110, 510 145
              C 520 170, 510 200, 490 215
              L 460 230
              C 445 260, 430 300, 415 320
              C 405 335, 385 340, 365 340
              L 340 340
              C 320 340, 305 328, 298 315
              L 280 290
              L 262 315
              C 255 328, 240 340, 220 340
              L 195 340
              C 175 340, 155 335, 145 320
              C 130 300, 115 260, 100 230
              L 70 215
              C 50 200, 40 170, 50 145
              C 60 110, 105 90, 130 90
              Z
            "
            fill="url(#bodyShine)"
          />

          {/* ── Bumpers (LB / RB) ── */}
          <BumperLeft
            label={bumpers[0]?.name || bumpers[0]?.keyDisplay || "LB"}
            pressed={bumpers[0] ? isPressed(bumpers[0].arduinoKey) : false}
          />
          <BumperRight
            label={bumpers[1]?.name || bumpers[1]?.keyDisplay || "RB"}
            pressed={bumpers[1] ? isPressed(bumpers[1].arduinoKey) : false}
          />

          {/* ── Left Thumbstick (top-left) ── */}
          <ThumbStick
            cx={170} cy={130}
            joy={hasJoy0 ? dpadJoy : null}
            pressedKeys={pressedKeys}
            label="LS"
          />

          {/* ── D-Pad (bottom-left) ── */}
          <DPadSvg
            cx={150} cy={225}
            joy={dpadJoy}
            isJoyDir={isJoyDir}
            fallbackBtns={!hasJoy0 ? allInputs.slice(0, 4) : []}
            isPressed={isPressed}
          />

          {/* ── ABXY Face Buttons (top-right) ── */}
          <FaceButtons
            cx={385} cy={130}
            btns={facebtns}
            isPressed={isPressed}
          />

          {/* ── Right Thumbstick (bottom-right) ── */}
          <ThumbStick
            cx={395} cy={225}
            joy={hasJoy1 ? rsJoy : null}
            pressedKeys={pressedKeys}
            label="RS"
          />

          {/* ── Center guide button ── */}
          <circle cx={280} cy={85} r={18}
            fill="linear-gradient(135deg,#1d4ed8,#1e40af)"
            style={{ fill: "#1e3a5f" }}
            stroke="rgba(59,130,246,0.5)" strokeWidth="1.5"
          />
          <circle cx={280} cy={85} r={12}
            fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="1"
          />
          {/* Xbox logo-like circle */}
          <circle cx={280} cy={85} r={6} fill="rgba(59,130,246,0.4)" />

          {/* ── Center small buttons (View / Menu) ── */}
          <CenterBtn
            x={232} y={100}
            label={centerBtns[0]?.name || centerBtns[0]?.keyDisplay || "View"}
            pressed={centerBtns[0] ? isPressed(centerBtns[0].arduinoKey) : false}
          />
          <CenterBtn
            x={300} y={100}
            label={centerBtns[1]?.name || centerBtns[1]?.keyDisplay || "Menu"}
            pressed={centerBtns[1] ? isPressed(centerBtns[1].arduinoKey) : false}
          />

          {/* Extra buttons spill into a row */}
          {extraBtns.map((btn, i) => {
            const px = 180 + i * 44;
            const py = 265;
            const on = isPressed(btn.arduinoKey);
            return (
              <g key={btn.id}>
                <rect x={px - 18} y={py - 10} width={36} height={20} rx={6}
                  fill={on ? "#3b82f6" : "#1f2937"}
                  stroke={on ? "#3b82f6" : "rgba(75,85,99,0.5)"}
                  strokeWidth="1"
                  style={{ filter: on ? "drop-shadow(0 0 6px rgba(59,130,246,0.7))" : "none" }}
                />
                <text x={px} y={py + 4} textAnchor="middle" fontSize="7" fontWeight="700"
                  fill={on ? "#fff" : "#6b7280"} fontFamily="system-ui,sans-serif">
                  {btn.name || btn.keyDisplay || `B${i + 9}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Key indicators row */}
      {allInputs.length > 0 && (
        <div className="flex gap-2 flex-wrap justify-center max-w-xl">
          {allInputs.map((btn, idx) => {
            const on = isPressed(btn.arduinoKey);
            return (
              <div key={btn.id} className={[
                "px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-all duration-75",
                on
                  ? "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-105"
                  : "bg-gray-800 border-gray-700 text-gray-500",
              ].join(" ")}>
                {btn.name || btn.keyDisplay || `Btn ${idx + 1}`}
              </div>
            );
          })}
        </div>
      )}
      {allInputs.length === 0 && (
        <p className="text-xs text-gray-600">Configure buttons to see them mapped on the controller</p>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function BumperLeft({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <g>
      <path
        d="M 130 62 C 130 48, 148 38, 168 38 L 235 38 C 250 38, 258 46, 256 60 L 248 78 L 130 78 Z"
        fill={pressed ? "#3b82f6" : "#1f2937"}
        stroke={pressed ? "#3b82f6" : "rgba(75,85,99,0.6)"}
        strokeWidth="1.5"
        style={{ filter: pressed ? "drop-shadow(0 0 8px rgba(59,130,246,0.7))" : "none", transition: "all 0.07s" }}
      />
      <text x={191} y={63} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={pressed ? "#fff" : "#9ca3af"} fontFamily="system-ui,sans-serif">{label}</text>
    </g>
  );
}

function BumperRight({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <g>
      <path
        d="M 430 62 C 430 48, 412 38, 392 38 L 325 38 C 310 38, 302 46, 304 60 L 312 78 L 430 78 Z"
        fill={pressed ? "#3b82f6" : "#1f2937"}
        stroke={pressed ? "#3b82f6" : "rgba(75,85,99,0.6)"}
        strokeWidth="1.5"
        style={{ filter: pressed ? "drop-shadow(0 0 8px rgba(59,130,246,0.7))" : "none", transition: "all 0.07s" }}
      />
      <text x={367} y={63} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={pressed ? "#fff" : "#9ca3af"} fontFamily="system-ui,sans-serif">{label}</text>
    </g>
  );
}

function ThumbStick({ cx, cy, joy, pressedKeys, label }: {
  cx: number; cy: number;
  joy: JoystickConfig | null;
  pressedKeys: Set<string>;
  label: string;
}) {
  const isDir = (k: string) => pressedKeys.has(arduinoToBrowserKey[k] ?? k);
  const anyPressed = joy ? (isDir(joy.upKey) || isDir(joy.downKey) || isDir(joy.leftKey) || isDir(joy.rightKey)) : false;

  const dx = joy ? (isDir(joy.rightKey) ? 5 : isDir(joy.leftKey) ? -5 : 0) : 0;
  const dy = joy ? (isDir(joy.downKey) ? 5 : isDir(joy.upKey) ? -5 : 0) : 0;

  return (
    <g>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={24}
        fill="#111827" stroke="rgba(75,85,99,0.5)" strokeWidth="1.5"
      />
      {/* Stick cap */}
      <circle cx={cx + dx} cy={cy + dy} r={16}
        fill={anyPressed ? "#374151" : "#1f2937"}
        stroke={anyPressed ? "rgba(156,163,175,0.6)" : "rgba(75,85,99,0.4)"}
        strokeWidth="1.5"
        style={{
          filter: anyPressed ? "drop-shadow(0 0 6px rgba(156,163,175,0.4))" : "none",
          transition: "all 0.06s",
        }}
      />
      {/* Grip texture dots */}
      {[[-5,-5],[-5,0],[-5,5],[0,-5],[0,5],[5,-5],[5,0],[5,5]].map(([ddx,ddy], i) => (
        <circle key={i} cx={cx + dx + ddx} cy={cy + dy + ddy} r={1}
          fill="rgba(156,163,175,0.15)" />
      ))}
      <text x={cx} y={cy + 38} textAnchor="middle" fontSize="8" fontWeight="600"
        fill="rgba(156,163,175,0.4)" fontFamily="system-ui,sans-serif">{label}</text>
    </g>
  );
}

function DPadSvg({ cx, cy, joy, isJoyDir, fallbackBtns, isPressed }: {
  cx: number; cy: number;
  joy: JoystickConfig | null;
  isJoyDir: (j: JoystickConfig | null, d: "up"|"down"|"left"|"right") => boolean;
  fallbackBtns: (ButtonConfig | PortConfig)[];
  isPressed: (k: string) => boolean;
}) {
  const up    = joy ? isJoyDir(joy, "up")    : (fallbackBtns[0] ? isPressed(fallbackBtns[0].arduinoKey) : false);
  const down  = joy ? isJoyDir(joy, "down")  : (fallbackBtns[1] ? isPressed(fallbackBtns[1].arduinoKey) : false);
  const left  = joy ? isJoyDir(joy, "left")  : (fallbackBtns[2] ? isPressed(fallbackBtns[2].arduinoKey) : false);
  const right = joy ? isJoyDir(joy, "right") : (fallbackBtns[3] ? isPressed(fallbackBtns[3].arduinoKey) : false);

  const arm = (active: boolean, x: number, y: number, w: number, h: number) => ({
    fill: active ? "#4b5563" : "#1f2937",
    stroke: active ? "rgba(156,163,175,0.7)" : "rgba(75,85,99,0.5)",
    filter: active ? "drop-shadow(0 0 5px rgba(156,163,175,0.5))" : "none",
  });

  const s = 13; // half-width of arm
  const l = 26; // arm length from center

  return (
    <g>
      {/* Center hub */}
      <rect x={cx - s} y={cy - s} width={s*2} height={s*2} rx="3"
        fill="#161f2e" stroke="rgba(75,85,99,0.4)" strokeWidth="1" />
      {/* Up */}
      <rect x={cx - s} y={cy - s - l} width={s*2} height={l} rx="3 3 0 0"
        {...arm(up, cx - s, cy - s - l, s*2, l)}
        style={{ transition: "all 0.06s", transform: up ? `translate(0, 1px)` : undefined }}
      />
      {/* Down */}
      <rect x={cx - s} y={cy + s} width={s*2} height={l} rx="0 0 3 3"
        {...arm(down, cx - s, cy + s, s*2, l)}
        style={{ transition: "all 0.06s", transform: down ? `translate(0, -1px)` : undefined }}
      />
      {/* Left */}
      <rect x={cx - s - l} y={cy - s} width={l} height={s*2} rx="3 0 0 3"
        {...arm(left, cx - s - l, cy - s, l, s*2)}
        style={{ transition: "all 0.06s", transform: left ? `translate(1px, 0)` : undefined }}
      />
      {/* Right */}
      <rect x={cx + s} y={cy - s} width={l} height={s*2} rx="0 3 3 0"
        {...arm(right, cx + s, cy - s, l, s*2)}
        style={{ transition: "all 0.06s", transform: right ? `translate(-1px, 0)` : undefined }}
      />
      {/* Arrow indicators */}
      <text x={cx} y={cy - s - 10} textAnchor="middle" fontSize="10" fill={up ? "#e5e7eb" : "#374151"}>▲</text>
      <text x={cx} y={cy + s + 18} textAnchor="middle" fontSize="10" fill={down ? "#e5e7eb" : "#374151"}>▼</text>
      <text x={cx - s - 14} y={cy + 4} textAnchor="middle" fontSize="10" fill={left ? "#e5e7eb" : "#374151"}>◀</text>
      <text x={cx + s + 14} y={cy + 4} textAnchor="middle" fontSize="10" fill={right ? "#e5e7eb" : "#374151"}>▶</text>
    </g>
  );
}

function FaceButtons({ cx, cy, btns, isPressed }: {
  cx: number; cy: number;
  btns: (ButtonConfig | PortConfig)[];
  isPressed: (k: string) => boolean;
}) {
  // ABXY diamond: top=Y(3), left=X(2), right=B(1), bottom=A(0)
  const r = 14;
  const gap = 30;
  const positions: [number, number, number][] = [
    // [dx, dy, abxyIndex]
    [0, -gap, 3],   // Y top
    [-gap, 0, 2],   // X left
    [gap, 0, 1],    // B right
    [0, gap, 0],    // A bottom
  ];

  return (
    <g>
      {positions.map(([dx, dy, abxyIdx]) => {
        const btn = btns[abxyIdx] ?? null;
        const col = ABXY[abxyIdx];
        const on = btn ? isPressed(btn.arduinoKey) : false;
        const displayLabel = btn?.keyDisplay || btn?.name || col.label;
        return (
          <g key={abxyIdx}>
            <circle
              cx={cx + dx} cy={cy + dy} r={r}
              fill={on ? col.color : "#1f2937"}
              stroke={on ? col.color : "rgba(75,85,99,0.5)"}
              strokeWidth="1.5"
              style={{
                filter: on ? `drop-shadow(0 0 8px ${col.glow})` : "none",
                transform: on ? "scale(0.93)" : "scale(1)",
                transformOrigin: `${cx + dx}px ${cy + dy}px`,
                transition: "all 0.06s",
              }}
            />
            <text
              x={cx + dx} y={cy + dy + 4}
              textAnchor="middle" fontSize="8" fontWeight="800"
              fill={on ? "#fff" : col.color}
              fontFamily="system-ui,sans-serif"
              style={{ opacity: on ? 1 : 0.7 }}
            >
              {displayLabel.length > 3 ? displayLabel.slice(0, 3) : displayLabel}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CenterBtn({ x, y, label, pressed }: { x: number; y: number; label: string; pressed: boolean }) {
  return (
    <g>
      <rect x={x - 20} y={y - 9} width={40} height={18} rx={9}
        fill={pressed ? "#374151" : "#1f2937"}
        stroke={pressed ? "rgba(156,163,175,0.6)" : "rgba(75,85,99,0.4)"}
        strokeWidth="1"
        style={{ filter: pressed ? "drop-shadow(0 0 4px rgba(156,163,175,0.4))" : "none", transition: "all 0.07s" }}
      />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="7" fontWeight="600"
        fill={pressed ? "#e5e7eb" : "#6b7280"} fontFamily="system-ui,sans-serif">
        {label.length > 5 ? label.slice(0, 5) : label}
      </text>
    </g>
  );
}
