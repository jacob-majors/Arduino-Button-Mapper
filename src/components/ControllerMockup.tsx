"use client";

import { useEffect, useState } from "react";
import { ButtonConfig, PortConfig, JoystickConfig, KEY_MAP } from "@/lib/keymap";

const arduinoToBrowserKey: Record<string, string> = {};
for (const [browserKey, val] of Object.entries(KEY_MAP)) {
  arduinoToBrowserKey[val.arduino] = browserKey;
}

function resolveBrowserKey(k: string) {
  return arduinoToBrowserKey[k] ?? k;
}

interface Props {
  buttons: ButtonConfig[];
  ports: PortConfig[];
  joysticks: JoystickConfig[];
}

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

  const isPressed = (arduinoKey: string) =>
    !!arduinoKey && pressedKeys.has(resolveBrowserKey(arduinoKey));

  const isDirPressed = (joy: JoystickConfig | null, dir: "up" | "down" | "left" | "right") => {
    if (!joy) return false;
    const k = dir === "up" ? joy.upKey : dir === "down" ? joy.downKey : dir === "left" ? joy.leftKey : joy.rightKey;
    return pressedKeys.has(resolveBrowserKey(k));
  };

  const allInputs = [...buttons, ...ports];

  // Slot mapping (by index in allInputs)
  const face = [allInputs[0], allInputs[1], allInputs[2], allInputs[3]]; // Y X B A
  const lb   = allInputs[4];
  const rb   = allInputs[5];
  const lt   = allInputs[6];
  const rt   = allInputs[7];
  const viewBtn  = allInputs[8];
  const menuBtn  = allInputs[9];
  const leftPad  = allInputs[10];
  const rightPad = allInputs[11];

  const joy0 = joysticks[0] ?? null;
  const joy1 = joysticks[1] ?? null;

  // Slot helper
  const label = (slot: typeof allInputs[0] | undefined, fallback: string) =>
    slot?.keyDisplay || slot?.name || fallback;

  const btnClass = (active: boolean) =>
    [
      "flex items-center justify-center rounded-lg border text-[11px] font-semibold uppercase tracking-wide transition-all duration-75 select-none",
      active
        ? "bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-[0_0_10px_rgba(59,130,246,0.35)]"
        : "bg-gray-800/70 border-gray-700/60 text-gray-400",
    ].join(" ");

  return (
    <div className="flex flex-col items-center gap-0 select-none w-full">
      {/* ── Bumper row (above body) ── */}
      <div className="flex justify-between w-full max-w-2xl px-8 mb-1">
        {/* Left bumpers */}
        <div className="flex gap-2">
          <div className={[btnClass(lt ? isPressed(lt.arduinoKey) : false), "w-16 h-9"].join(" ")}>
            {label(lt, "LT")}
          </div>
          <div className={[btnClass(lb ? isPressed(lb.arduinoKey) : false), "w-16 h-9"].join(" ")}>
            {label(lb, "LB")}
          </div>
        </div>
        {/* Right bumpers */}
        <div className="flex gap-2">
          <div className={[btnClass(rb ? isPressed(rb.arduinoKey) : false), "w-16 h-9"].join(" ")}>
            {label(rb, "RB")}
          </div>
          <div className={[btnClass(rt ? isPressed(rt.arduinoKey) : false), "w-16 h-9"].join(" ")}>
            {label(rt, "RT")}
          </div>
        </div>
      </div>

      {/* ── Main body ── */}
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-700/50 flex flex-col gap-0"
        style={{ background: "linear-gradient(160deg,#1a1f2e 0%,#141824 100%)" }}
      >
        {/* Top section: D-pad | Center | Face */}
        <div className="flex items-start gap-0 px-6 pt-5 pb-3">

          {/* ── D-Pad ── */}
          <div className="flex flex-col items-center gap-2 w-40 flex-shrink-0">
            <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-1">D-Pad</span>
            <div className="grid grid-cols-3 grid-rows-3 gap-1.5" style={{ width: 112, height: 112 }}>
              {/* Up */}
              <div className="col-start-2 row-start-1">
                <div className={[btnClass(isDirPressed(joy0, "up")), "w-full h-full aspect-square"].join(" ")}>▲</div>
              </div>
              {/* Left */}
              <div className="col-start-1 row-start-2">
                <div className={[btnClass(isDirPressed(joy0, "left")), "w-full h-full aspect-square"].join(" ")}>◀</div>
              </div>
              {/* Center */}
              <div className="col-start-2 row-start-2 bg-gray-800/40 rounded border border-gray-700/30" />
              {/* Right */}
              <div className="col-start-3 row-start-2">
                <div className={[btnClass(isDirPressed(joy0, "right")), "w-full h-full aspect-square"].join(" ")}>▶</div>
              </div>
              {/* Down */}
              <div className="col-start-2 row-start-3">
                <div className={[btnClass(isDirPressed(joy0, "down")), "w-full h-full aspect-square"].join(" ")}>▼</div>
              </div>
            </div>
          </div>

          {/* ── Center ── */}
          <div className="flex-1 flex flex-col items-center gap-3 pt-1">
            {/* View / Guide / Menu */}
            <div className="flex items-center gap-2">
              <div className={[btnClass(viewBtn ? isPressed(viewBtn.arduinoKey) : false), "px-4 h-8 min-w-[62px]"].join(" ")}>
                {label(viewBtn, "View")}
              </div>
              {/* Guide button */}
              <div className="w-8 h-8 rounded-lg border border-gray-700/50 bg-gray-800/70 flex items-center justify-center text-gray-600">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <rect x="1" y="3" width="14" height="2" rx="1"/>
                  <rect x="1" y="7" width="14" height="2" rx="1"/>
                  <rect x="1" y="11" width="14" height="2" rx="1"/>
                </svg>
              </div>
              <div className={[btnClass(menuBtn ? isPressed(menuBtn.arduinoKey) : false), "px-4 h-8 min-w-[62px]"].join(" ")}>
                {label(menuBtn, "Menu")}
              </div>
            </div>

            {/* LS / RS click buttons */}
            <div className="flex items-center gap-6">
              <div className={[btnClass(false), "w-14 h-8 text-[10px]"].join(" ")}>LS</div>
              <div className={[btnClass(false), "w-14 h-8 text-[10px]"].join(" ")}>RS</div>
            </div>

            {/* Thumbstick circles */}
            <div className="flex items-center gap-8">
              <ThumbStick
                active={isDirPressed(joy0, "up") || isDirPressed(joy0, "down") || isDirPressed(joy0, "left") || isDirPressed(joy0, "right")}
                dx={isDirPressed(joy0, "right") ? 4 : isDirPressed(joy0, "left") ? -4 : 0}
                dy={isDirPressed(joy0, "down") ? 4 : isDirPressed(joy0, "up") ? -4 : 0}
                label="L Stick"
              />
              <ThumbStick
                active={isDirPressed(joy1, "up") || isDirPressed(joy1, "down") || isDirPressed(joy1, "left") || isDirPressed(joy1, "right")}
                dx={isDirPressed(joy1, "right") ? 4 : isDirPressed(joy1, "left") ? -4 : 0}
                dy={isDirPressed(joy1, "down") ? 4 : isDirPressed(joy1, "up") ? -4 : 0}
                label="R Stick"
              />
            </div>
          </div>

          {/* ── Face Buttons ── */}
          <div className="flex flex-col items-center gap-2 w-40 flex-shrink-0">
            <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Face</span>
            {/* Y top */}
            <div className="flex justify-center">
              <div className={[btnClass(face[0] ? isPressed(face[0].arduinoKey) : false), "w-10 h-10"].join(" ")}>
                {label(face[0], "Y")}
              </div>
            </div>
            {/* X  B */}
            <div className="flex gap-1.5">
              <div className={[btnClass(face[1] ? isPressed(face[1].arduinoKey) : false), "w-10 h-10"].join(" ")}>
                {label(face[1], "X")}
              </div>
              <div className={[btnClass(face[2] ? isPressed(face[2].arduinoKey) : false), "w-10 h-10"].join(" ")}>
                {label(face[2], "B")}
              </div>
            </div>
            {/* A bottom */}
            <div className="flex justify-center">
              <div className={[btnClass(face[3] ? isPressed(face[3].arduinoKey) : false), "w-10 h-10"].join(" ")}>
                {label(face[3], "A")}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom pads ── */}
        <div className="flex gap-3 px-4 pb-4">
          <Pad
            label="Left Pad"
            value={label(leftPad, leftPad ? (leftPad.keyDisplay || leftPad.name || "") : "")}
            active={leftPad ? isPressed(leftPad.arduinoKey) : false}
          />
          <Pad
            label="Right Pad"
            value={label(rightPad, rightPad ? (rightPad.keyDisplay || rightPad.name || "") : "")}
            active={rightPad ? isPressed(rightPad.arduinoKey) : false}
          />
        </div>
      </div>

      {/* Slot legend */}
      {allInputs.length > 0 && (
        <div className="flex gap-1.5 flex-wrap justify-center mt-3 max-w-2xl">
          {allInputs.map((btn, i) => {
            const on = isPressed(btn.arduinoKey);
            const slotNames = ["Y","X","B","A","LB","RB","LT","RT","View","Menu","L Pad","R Pad"];
            return (
              <div key={btn.id} className={[
                "flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono transition-all duration-75",
                on ? "bg-blue-500/20 border-blue-500/50 text-blue-200" : "bg-gray-800/60 border-gray-700/50 text-gray-500",
              ].join(" ")}>
                <span className="text-gray-600">{slotNames[i] ?? `Btn ${i + 1}`}:</span>
                <span>{btn.name || btn.keyDisplay || "—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThumbStick({ active, dx, dy, label }: { active: boolean; dx: number; dy: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14 rounded-full bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
        <div
          className={[
            "w-6 h-6 rounded-full border transition-all duration-75",
            active
              ? "bg-gray-500 border-gray-400"
              : "bg-gray-700 border-gray-600",
          ].join(" ")}
          style={{ transform: `translate(${dx}px, ${dy}px)` }}
        />
      </div>
      <span className="text-[9px] text-gray-600 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function Pad({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={[
      "flex-1 flex flex-col items-center justify-center rounded-xl border min-h-[90px] transition-all duration-75",
      active
        ? "bg-blue-500/15 border-blue-500/40 shadow-[0_0_16px_rgba(59,130,246,0.2)]"
        : "bg-gray-800/40 border-gray-700/40",
    ].join(" ")}>
      {value && (
        <span className={["text-2xl font-bold tracking-tight", active ? "text-blue-200" : "text-gray-500"].join(" ")}>
          {value}
        </span>
      )}
      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-gray-600 mt-1">{label}</span>
    </div>
  );
}
