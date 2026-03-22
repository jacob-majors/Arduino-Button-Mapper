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

// Face button colours (cycling)
const FACE_COLORS = [
  { idle: "#1e3a5f", active: "#3b82f6", shadow: "rgba(59,130,246,0.6)" },
  { idle: "#3a1e1e", active: "#ef4444", shadow: "rgba(239,68,68,0.6)" },
  { idle: "#1e3a20", active: "#22c55e", shadow: "rgba(34,197,94,0.6)" },
  { idle: "#2e1e3a", active: "#a855f7", shadow: "rgba(168,85,247,0.6)" },
  { idle: "#3a3a1e", active: "#eab308", shadow: "rgba(234,179,8,0.6)" },
  { idle: "#1e3a3a", active: "#06b6d4", shadow: "rgba(6,182,212,0.6)" },
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

  // All inputs combined
  const allButtons = [...buttons, ...ports];

  // Split into left (first half) and right (second half)
  const mid = Math.ceil(allButtons.length / 2);
  const leftBtns = allButtons.slice(0, mid);
  const rightBtns = allButtons.slice(mid);

  const hasJoystick = joysticks.length > 0;

  return (
    <div className="flex justify-center">
      <div
        className="relative select-none"
        style={{
          width: 560,
          maxWidth: "100%",
          height: 240,
          background: "linear-gradient(160deg, #111827 0%, #1f2937 50%, #111827 100%)",
          borderRadius: "50% 50% 38% 38% / 40% 40% 60% 60%",
          border: "1.5px solid rgba(75,85,99,0.6)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Left grip bump */}
        <div style={{
          position: "absolute", left: -8, bottom: 10,
          width: 80, height: 100,
          background: "linear-gradient(160deg, #1f2937, #111827)",
          borderRadius: "40% 20% 50% 50%",
          border: "1.5px solid rgba(75,85,99,0.4)",
          borderTop: "none",
        }} />
        {/* Right grip bump */}
        <div style={{
          position: "absolute", right: -8, bottom: 10,
          width: 80, height: 100,
          background: "linear-gradient(160deg, #1f2937, #111827)",
          borderRadius: "20% 40% 50% 50%",
          border: "1.5px solid rgba(75,85,99,0.4)",
          borderTop: "none",
        }} />

        {/* Left side buttons */}
        <div style={{
          position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)",
          display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
        }}>
          {hasJoystick ? (
            // D-pad for first joystick
            <DPad joystick={joysticks[0]} pressedKeys={pressedKeys} />
          ) : (
            leftBtns.map((btn, i) => (
              <ControllerButton key={btn.id} btn={btn} color={FACE_COLORS[i % FACE_COLORS.length]} pressed={isPressed(btn.arduinoKey)} />
            ))
          )}
        </div>

        {/* Center area */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {/* Small center buttons (Select / Start style) */}
            <div style={{
              width: 28, height: 12, borderRadius: 6,
              background: "#374151", border: "1px solid #4b5563",
            }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#374151", border: "1px solid #4b5563" }} />
            <div style={{
              width: 28, height: 12, borderRadius: 6,
              background: "#374151", border: "1px solid #4b5563",
            }} />
          </div>
          <div style={{
            fontSize: 9, color: "rgba(156,163,175,0.5)", letterSpacing: "0.1em",
            textTransform: "uppercase", fontWeight: 700,
          }}>controller</div>
        </div>

        {/* Right side — face buttons */}
        <div style={{
          position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)",
        }}>
          {rightBtns.length > 0 ? (
            <FaceButtonCluster btns={rightBtns} colors={FACE_COLORS} isPressed={isPressed} />
          ) : (
            hasJoystick && joysticks[1] ? (
              <DPad joystick={joysticks[1]} pressedKeys={pressedKeys} />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

function ControllerButton({ btn, color, pressed }: {
  btn: ButtonConfig | PortConfig;
  color: { idle: string; active: string; shadow: string };
  pressed: boolean;
}) {
  return (
    <div style={{
      width: 48, height: 28, borderRadius: 8,
      background: pressed ? color.active : color.idle,
      border: `1.5px solid ${pressed ? color.active : "rgba(75,85,99,0.5)"}`,
      boxShadow: pressed ? `0 0 12px ${color.shadow}` : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 1,
      transition: "all 0.06s",
      transform: pressed ? "scale(0.94)" : "scale(1)",
    }}>
      <span style={{ fontSize: 9, color: pressed ? "#fff" : "#6b7280", fontWeight: 700, letterSpacing: "0.04em" }}>
        {btn.name || btn.keyDisplay || "—"}
      </span>
      {btn.keyDisplay && btn.name && (
        <span style={{ fontSize: 7, color: pressed ? "rgba(255,255,255,0.7)" : "#4b5563", fontFamily: "monospace" }}>
          [{btn.keyDisplay}]
        </span>
      )}
    </div>
  );
}

function FaceButtonCluster({ btns, colors, isPressed }: {
  btns: (ButtonConfig | PortConfig)[];
  colors: typeof FACE_COLORS;
  isPressed: (k: string) => boolean;
}) {
  // Layout: up to 4 in diamond, rest in a row below
  const top = btns[0] ?? null;
  const left = btns[1] ?? null;
  const right = btns[2] ?? null;
  const bottom = btns[3] ?? null;
  const extra = btns.slice(4);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "32px 32px 32px", gridTemplateRows: "32px 32px 32px", gap: 4 }}>
        {/* Top */}
        {top && <FaceBtn btn={top} color={colors[0]} pressed={isPressed(top.arduinoKey)} style={{ gridColumn: 2, gridRow: 1 }} />}
        {/* Left */}
        {left && <FaceBtn btn={left} color={colors[1]} pressed={isPressed(left.arduinoKey)} style={{ gridColumn: 1, gridRow: 2 }} />}
        {/* Right */}
        {right && <FaceBtn btn={right} color={colors[2]} pressed={isPressed(right.arduinoKey)} style={{ gridColumn: 3, gridRow: 2 }} />}
        {/* Bottom */}
        {bottom && <FaceBtn btn={bottom} color={colors[3]} pressed={isPressed(bottom.arduinoKey)} style={{ gridColumn: 2, gridRow: 3 }} />}
      </div>
      {extra.length > 0 && (
        <div style={{ display: "flex", gap: 4 }}>
          {extra.map((btn, i) => (
            <FaceBtn key={btn.id} btn={btn} color={colors[(i + 4) % colors.length]} pressed={isPressed(btn.arduinoKey)} style={{}} />
          ))}
        </div>
      )}
    </div>
  );
}

function FaceBtn({ btn, color, pressed, style }: {
  btn: ButtonConfig | PortConfig;
  color: { idle: string; active: string; shadow: string };
  pressed: boolean;
  style: React.CSSProperties;
}) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      background: pressed ? color.active : color.idle,
      border: `1.5px solid ${pressed ? color.active : "rgba(75,85,99,0.5)"}`,
      boxShadow: pressed ? `0 0 14px ${color.shadow}, inset 0 1px 0 rgba(255,255,255,0.2)` : "inset 0 2px 4px rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.06s",
      transform: pressed ? "scale(0.9)" : "scale(1)",
      cursor: "default",
      ...style,
    }}>
      <span style={{ fontSize: 8, color: pressed ? "#fff" : "#6b7280", fontWeight: 700, textAlign: "center", lineHeight: 1.1, padding: "0 2px" }}>
        {btn.keyDisplay || btn.name || "·"}
      </span>
    </div>
  );
}

function DPad({ joystick, pressedKeys }: { joystick: JoystickConfig; pressedKeys: Set<string> }) {
  const isDown = (k: string) => pressedKeys.has(resolveBrowserKey(k));
  const up    = isDown(joystick.upKey);
  const down  = isDown(joystick.downKey);
  const left  = isDown(joystick.leftKey);
  const right = isDown(joystick.rightKey);

  const arrowStyle = (active: boolean): React.CSSProperties => ({
    width: 28, height: 28,
    background: active ? "#3b82f6" : "#1f2937",
    border: `1.5px solid ${active ? "#3b82f6" : "rgba(75,85,99,0.5)"}`,
    boxShadow: active ? "0 0 10px rgba(59,130,246,0.7)" : "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.06s",
    transform: active ? "scale(0.9)" : "scale(1)",
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px 28px 28px", gridTemplateRows: "28px 28px 28px", gap: 3 }}>
      <div style={{ gridColumn: 2, gridRow: 1, ...arrowStyle(up) }}>
        <span style={{ color: up ? "#fff" : "#4b5563", fontSize: 12, lineHeight: 1 }}>▲</span>
      </div>
      <div style={{ gridColumn: 1, gridRow: 2, ...arrowStyle(left) }}>
        <span style={{ color: left ? "#fff" : "#4b5563", fontSize: 12, lineHeight: 1 }}>◀</span>
      </div>
      <div style={{ gridColumn: 2, gridRow: 2, background: "#111827", border: "1.5px solid rgba(75,85,99,0.3)", borderRadius: 4 }} />
      <div style={{ gridColumn: 3, gridRow: 2, ...arrowStyle(right) }}>
        <span style={{ color: right ? "#fff" : "#4b5563", fontSize: 12, lineHeight: 1 }}>▶</span>
      </div>
      <div style={{ gridColumn: 2, gridRow: 3, ...arrowStyle(down) }}>
        <span style={{ color: down ? "#fff" : "#4b5563", fontSize: 12, lineHeight: 1 }}>▼</span>
      </div>
    </div>
  );
}
