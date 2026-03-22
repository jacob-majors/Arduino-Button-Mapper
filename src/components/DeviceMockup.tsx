"use client";

import { useEffect, useState, useRef } from "react";
import { ButtonConfig, LedConfig, PortConfig, KEY_MAP } from "@/lib/keymap";

// Reverse map: arduinoKey → browser e.key (for special keys like KEY_UP_ARROW → ArrowUp)
const arduinoToBrowserKey: Record<string, string> = {};
for (const [browserKey, val] of Object.entries(KEY_MAP)) {
  arduinoToBrowserKey[val.arduino] = browserKey;
}

interface Props {
  buttons: ButtonConfig[];
  leds: LedConfig;
  ports: PortConfig[];
}

interface PropsWithView extends Props {
  view?: "mockup" | "inputs";
}

export default function DeviceMockup({ buttons, leds, ports, view = "mockup" }: PropsWithView) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [systemOn, setSystemOn] = useState(true);
  const prevPowerRef = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) =>
      setPressedKeys((p) => { const n = new Set(p); n.add(e.key); return n; });
    const up = (e: KeyboardEvent) =>
      setPressedKeys((p) => { const n = new Set(p); n.delete(e.key); return n; });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const leftBtn = buttons[0] ?? null;
  const rightBtn = buttons[1] ?? null;
  const powerBtn = buttons.find((b) => b.mode === "power") ?? null;

  const isKeyPressed = (btn: ButtonConfig | null) => {
    if (!btn?.arduinoKey) return false;
    // arduinoKey may be an Arduino constant (e.g. "KEY_UP_ARROW") — map back to browser key
    const browserKey = arduinoToBrowserKey[btn.arduinoKey] ?? btn.arduinoKey;
    return pressedKeys.has(browserKey);
  };

  const powerKeyPressed = powerBtn
    ? isKeyPressed(powerBtn)
    : pressedKeys.has("Enter");

  // Toggle system on leading edge of power press
  useEffect(() => {
    if (powerKeyPressed && !prevPowerRef.current) {
      setSystemOn((s) => !s);
    }
    prevPowerRef.current = powerKeyPressed;
  }, [powerKeyPressed]);

  const leftActive = systemOn && isKeyPressed(leftBtn);
  const rightActive = systemOn && isKeyPressed(rightBtn);

  // LEDs
  const greenLit = leds.enabled ? systemOn : systemOn;
  const redLit = leds.enabled ? !systemOn : !systemOn;

  // Simulate click press
  const [simLeft, setSimLeft] = useState(false);
  const [simRight, setSimRight] = useState(false);

  const pressButton = (side: "left" | "right") => {
    if (!systemOn) return;
    if (side === "left") { setSimLeft(true); setTimeout(() => setSimLeft(false), 120); }
    else { setSimRight(true); setTimeout(() => setSimRight(false), 120); }
  };

  const leftOn = leftActive || simLeft;
  const rightOn = rightActive || simRight;

  const modeColors: Record<string, string> = {
    momentary: "bg-blue-900/40 text-blue-300 border-blue-700/50",
    toggle: "bg-violet-900/40 text-violet-300 border-violet-700/50",
    power: "bg-amber-900/40 text-amber-300 border-amber-700/50",
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {view === "inputs" && (
        <div className="w-full max-w-2xl">
          {buttons.length === 0 && ports.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-6">No inputs configured yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {buttons.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-1">Buttons</p>
                  {buttons.map((b, i) => {
                    const browserKey = arduinoToBrowserKey[b.arduinoKey] ?? b.arduinoKey;
                    const active = systemOn && pressedKeys.has(browserKey);
                    return (
                      <div key={b.id} className={[
                        "flex items-center gap-3 px-3 py-2 rounded-xl border transition-all",
                        active ? "bg-blue-500/15 border-blue-500/40" : "bg-gray-900 border-gray-800",
                      ].join(" ")}>
                        <span className="text-[10px] font-mono text-gray-600 w-5 text-right">{i + 1}</span>
                        <div className={["w-2 h-2 rounded-full flex-shrink-0 transition-all",
                          active ? "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" : "bg-gray-700"].join(" ")} />
                        <span className="text-sm text-gray-200 flex-1 font-medium">{b.name || `Button ${i + 1}`}</span>
                        <span className="font-mono text-xs text-gray-500">D{b.pin}</span>
                        <span className={["text-[10px] px-1.5 py-0.5 rounded border font-medium", modeColors[b.mode] ?? modeColors.momentary].join(" ")}>{b.mode}</span>
                        {b.keyDisplay && (
                          <span className="font-mono text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded text-gray-300">{b.keyDisplay}</span>
                        )}
                        {(b.ledPin ?? -1) >= 0 && (
                          <span className="text-[10px] text-yellow-500 font-mono">💡D{b.ledPin}</span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {ports.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-1 mt-2">Port Inputs</p>
                  {ports.map((p, i) => {
                    const browserKey = arduinoToBrowserKey[p.arduinoKey] ?? p.arduinoKey;
                    const active = systemOn && pressedKeys.has(browserKey);
                    return (
                      <div key={p.id} className={[
                        "flex items-center gap-3 px-3 py-2 rounded-xl border transition-all",
                        active ? "bg-sky-500/15 border-sky-500/40" : "bg-gray-900 border-gray-800",
                      ].join(" ")}>
                        <span className="text-[10px] font-mono text-gray-600 w-5 text-right">⊙</span>
                        <div className={["w-2 h-2 rounded-full flex-shrink-0 transition-all",
                          active ? "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" : "bg-gray-700"].join(" ")} />
                        <span className="text-sm text-gray-200 flex-1 font-medium">{p.name || `Port ${i + 1}`}</span>
                        <span className="font-mono text-xs text-gray-500">D{p.pin}</span>
                        <span className={["text-[10px] px-1.5 py-0.5 rounded border font-medium", modeColors[p.mode] ?? modeColors.momentary].join(" ")}>{p.mode}</span>
                        {p.keyDisplay && (
                          <span className="font-mono text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded text-gray-300">{p.keyDisplay}</span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
          <p className="text-[11px] text-gray-600 text-center mt-4">Press mapped keys to see inputs light up</p>
        </div>
      )}

      {view === "mockup" && <div className="flex flex-col items-center gap-5 w-full">
      {/* ── Device body ──────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: 680,
          maxWidth: "100%",
          height: 240,
          background: "linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          borderRadius: 38,
          border: "1.5px solid rgba(56,189,248,0.18)",
          boxShadow: "0 12px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
          userSelect: "none",
        }}
      >
        {/* Subtle surface shimmer */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 38, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.06) 0%, transparent 60%)",
        }} />

        {/* ── LEFT large button ────────────────────────────────── */}
        <button
          onClick={() => pressButton("left")}
          style={{
            position: "absolute",
            left: 22,
            top: "50%",
            transform: `translateY(-50%) ${leftOn ? "scale(0.965)" : "scale(1)"}`,
            width: 194,
            height: 194,
            borderRadius: "50%",
            background: leftOn
              ? "radial-gradient(circle at 38% 36%, #22d3ee, #0891b2)"
              : "radial-gradient(circle at 38% 36%, #0e7490, #164e63)",
            border: `3px solid ${leftOn ? "#06b6d4" : "#0e4f6e"}`,
            boxShadow: leftOn
              ? "0 0 0 4px rgba(34,211,238,0.25), 0 0 40px rgba(34,211,238,0.55), inset 0 3px 10px rgba(0,0,0,0.3)"
              : "0 6px 22px rgba(0,0,0,0.6), inset 0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            transition: "all 0.08s ease",
            cursor: systemOn ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            opacity: systemOn ? 1 : 0.55,
          }}
        >
          {leftBtn?.name && (
            <span style={{
              position: "absolute", bottom: 24,
              fontSize: 11, color: leftOn ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)", fontWeight: 700,
              textShadow: leftOn ? "0 0 8px rgba(34,211,238,0.8)" : "none", letterSpacing: "0.05em",
              transition: "all 0.1s",
            }}>
              {leftBtn.name}
            </span>
          )}
          {leftOn && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "radial-gradient(circle at 50% 40%, rgba(34,211,238,0.25), transparent 65%)",
            }} />
          )}
        </button>

        {/* ── CENTER controls ──────────────────────────────────── */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          {/* LED indicators */}
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {/* Green LED — system on */}
            <div style={{
              width: 11, height: 11, borderRadius: "50%",
              background: greenLit ? "#4ade80" : "#1a3020",
              boxShadow: greenLit ? "0 0 10px 3px rgba(74,222,128,0.7)" : "none",
              border: "1.5px solid rgba(0,0,0,0.25)",
              transition: "all 0.2s",
            }} />
            {/* Red LED — system off */}
            <div style={{
              width: 11, height: 11, borderRadius: "50%",
              background: redLit ? "#f87171" : "#3a1010",
              boxShadow: redLit ? "0 0 10px 3px rgba(248,113,113,0.7)" : "none",
              border: "1.5px solid rgba(0,0,0,0.25)",
              transition: "all 0.2s",
            }} />
          </div>

          {/* Power button */}
          <button
            onClick={() => setSystemOn((s) => !s)}
            style={{
              width: 60, height: 60, borderRadius: "50%",
              background: systemOn
                ? (powerKeyPressed ? "#0f2030" : "linear-gradient(145deg, #1e3a5f, #0f172a)")
                : "linear-gradient(145deg, #1a1a1a, #0a0a0a)",
              border: `2px solid ${systemOn ? "rgba(56,189,248,0.5)" : "rgba(100,100,100,0.3)"}`,
              boxShadow: powerKeyPressed
                ? "inset 0 3px 7px rgba(0,0,0,0.5)"
                : systemOn
                ? "0 0 16px rgba(56,189,248,0.3), 0 4px 12px rgba(0,0,0,0.5)"
                : "0 4px 10px rgba(0,0,0,0.4)",
              cursor: "pointer",
              transform: powerKeyPressed ? "scale(0.94)" : "scale(1)",
              transition: "all 0.1s ease",
              position: "relative",
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {/* Left half divider (from the reference image) */}
            <div style={{
              position: "absolute", left: 0, top: 0, width: "50%", height: "100%",
              background: "rgba(0,0,0,0.15)",
              borderRight: `1px solid ${systemOn ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)"}`,
            }} />
            {/* Power icon */}
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ position: "relative", zIndex: 1 }}>
              <path d="M12 3v6" stroke={systemOn ? "#38bdf8" : "#555"} strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M6.34 6.34a8 8 0 1 0 11.32 0" stroke={systemOn ? "#38bdf8" : "#555"} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </svg>
          </button>

          {/* System status label */}
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            color: systemOn ? "#38bdf8" : "#475569",
            textTransform: "uppercase",
            textShadow: systemOn ? "0 0 8px rgba(56,189,248,0.6)" : "none",
            transition: "all 0.2s",
          }}>
            {systemOn ? "ON" : "OFF"}
          </span>
        </div>

        {/* ── RIGHT large button ───────────────────────────────── */}
        <button
          onClick={() => pressButton("right")}
          style={{
            position: "absolute",
            right: 22,
            top: "50%",
            transform: `translateY(-50%) ${rightOn ? "scale(0.965)" : "scale(1)"}`,
            width: 194,
            height: 194,
            borderRadius: "50%",
            background: rightOn
              ? "radial-gradient(circle at 38% 36%, #c084fc, #7c3aed)"
              : "radial-gradient(circle at 38% 36%, #6d28d9, #3b0764)",
            border: `3px solid ${rightOn ? "#a855f7" : "#4c1d95"}`,
            boxShadow: rightOn
              ? "0 0 0 4px rgba(192,132,252,0.25), 0 0 40px rgba(192,132,252,0.55), inset 0 3px 10px rgba(0,0,0,0.3)"
              : "0 6px 22px rgba(0,0,0,0.6), inset 0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            transition: "all 0.08s ease",
            cursor: systemOn ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: systemOn ? 1 : 0.55,
          }}
        >
          {rightBtn?.name && (
            <span style={{
              fontSize: 11, color: rightOn ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)", fontWeight: 700,
              textShadow: rightOn ? "0 0 8px rgba(192,132,252,0.8)" : "none", letterSpacing: "0.05em",
              transition: "all 0.1s",
            }}>
              {rightBtn.name}
            </span>
          )}
          {rightOn && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "radial-gradient(circle at 50% 40%, rgba(192,132,252,0.25), transparent 65%)",
            }} />
          )}
        </button>
      </div>

      {/* ── Key indicators ───────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap justify-center">
        {[...buttons, ...ports].map((btn, idx) => {
          const isPort = idx >= buttons.length;
          const active = btn.mode === "power"
            ? powerKeyPressed
            : systemOn && !!(btn.arduinoKey && pressedKeys.has(btn.arduinoKey));
          return (
            <div key={btn.id} className={[
              "px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all duration-75",
              active
                ? btn.mode === "power"
                  ? "bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/40 scale-105"
                  : isPort
                  ? "bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/40 scale-105"
                  : "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-105"
                : "bg-gray-800 border-gray-700 text-gray-500",
            ].join(" ")}>
              {isPort && <span className={`mr-1 text-[9px] ${active ? "text-sky-200" : "text-gray-600"}`}>⊙</span>}
              {btn.name || (isPort ? `Port ${idx - buttons.length + 1}` : `Btn ${idx + 1}`)}
              {btn.mode === "power" ? (
                <span className={`ml-1 ${active ? "text-amber-200" : "text-gray-600"}`}>[PWR]</span>
              ) : btn.keyDisplay ? (
                <span className={`ml-1 ${active ? "text-blue-200" : "text-gray-600"}`}>[{btn.keyDisplay}]</span>
              ) : null}
            </div>
          );
        })}
        {buttons.length === 0 && ports.length === 0 && (
          <p className="text-xs text-gray-600">Configure buttons to see them here</p>
        )}
      </div>

      <p className="text-[11px] text-gray-600">
        Click the buttons or press mapped keys to test · Power button toggles the system
      </p>
    </div>}
    </div>
  );
}
