"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Zap, RefreshCw, Plus, Trash2, X, Upload, ChevronDown,
  Loader2, CheckCircle2, XCircle, Terminal, Usb, Keyboard,
  RotateCcw, Pencil, Gamepad2, Settings, Lightbulb, Power, Code,
  Info, ExternalLink, Radio, Wind, Joystick, Minimize2, Maximize2,
} from "lucide-react";
import {
  ButtonConfig, ButtonMode, LedConfig, PortConfig,
  IRSensorConfig, SipPuffConfig, JoystickConfig,
  resolveKey, generateSketch,
} from "@/lib/keymap";
import DinoGame from "@/components/DinoGame";
import SnakeGame from "@/components/SnakeGame";
import DeviceMockup from "@/components/DeviceMockup";
import { arduinoToBrowserKey } from "@/lib/keymap";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const ALL_PINS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const ANALOG_PINS = [0, 1, 2, 3, 4, 5]; // A0–A5

interface Port { path: string; description: string; }
interface LogLine { type: string; data: string; }

function generateId() { return Math.random().toString(36).slice(2, 9); }

// ─── Key Capture Input ────────────────────────────────────────────────────────

function KeyCaptureInput({ value, display, onChange, onClear }: {
  value: string; display: string;
  onChange: (arduinoKey: string, display: string) => void;
  onClear: () => void;
}) {
  const [listening, setListening] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault(); e.stopPropagation();
    const result = resolveKey(e);
    if (result) { onChange(result.arduino, result.display); setListening(false); divRef.current?.blur(); }
  }, [onChange]);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    if (listening) el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [listening, handleKeyDown]);

  return (
    <div
      ref={divRef} tabIndex={0}
      onFocus={() => setListening(true)} onBlur={() => setListening(false)}
      className={[
        "flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all outline-none min-h-[34px]",
        listening ? "animate-pulse-border bg-blue-950/40"
          : value ? "border-gray-600 bg-gray-800 hover:border-gray-500"
          : "border-gray-700 bg-gray-800/50 hover:border-gray-600",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Keyboard size={12} className={listening ? "text-blue-400" : "text-gray-600"} />
        {listening ? (
          <span className="text-blue-400 text-xs animate-pulse">Press any key...</span>
        ) : value ? (
          <span className="text-white text-xs font-mono font-semibold truncate">{display}</span>
        ) : (
          <span className="text-gray-600 text-xs">Click to assign</span>
        )}
      </div>
      {value && !listening && (
        <button type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
          className="p-0.5 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
        ><X size={10} /></button>
      )}
    </div>
  );
}

// ─── Button / Port Card ───────────────────────────────────────────────────────

function ButtonCard({ button, index, usedPins, onUpdate, onRemove, isPort = false }: {
  button: ButtonConfig; index: number; usedPins: number[];
  onUpdate: (id: string, updates: Partial<ButtonConfig>) => void;
  onRemove: (id: string) => void;
  isPort?: boolean;
}) {
  const availablePins = ALL_PINS.filter((p) => p === button.pin || !usedPins.includes(p));
  const isPower = button.mode === "power";

  return (
    <div className={[
      "border rounded-xl p-3 flex flex-col gap-2 transition-colors group",
      isPower ? "bg-amber-950/30 border-amber-700/50 hover:border-amber-600/60"
        : isPort ? "bg-sky-950/30 border-sky-800/50 hover:border-sky-700/60"
        : "bg-gray-800/50 border-gray-700/80 hover:border-gray-600/80",
    ].join(" ")}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${
          isPower ? "bg-amber-500/20 border-amber-500/40"
            : isPort ? "bg-sky-500/20 border-sky-500/40"
            : "bg-blue-500/20 border-blue-500/40"
        }`}>
          {isPower ? <Power size={9} className="text-amber-400" />
            : isPort ? <span className="text-sky-400 text-[9px] font-bold">P{index + 1}</span>
            : <span className="text-blue-400 text-[10px] font-bold">{index + 1}</span>}
        </div>
        <input
          type="text" value={button.name}
          onChange={(e) => onUpdate(button.id, { name: e.target.value })}
          placeholder={isPower ? "Power Button" : isPort ? `Port ${index + 1}` : `Button ${index + 1}`}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-200 placeholder:text-gray-600 outline-none border-b border-transparent focus:border-gray-600 transition-colors min-w-0"
        />
        <button onClick={() => onRemove(button.id)}
          className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
        ><Trash2 size={12} /></button>
      </div>

      {/* Pin + Mode */}
      <div className="flex gap-2 items-center">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0">Pin</label>
        <div className="relative" style={{ width: 68 }}>
          <select value={button.pin}
            onChange={(e) => onUpdate(button.id, { pin: parseInt(e.target.value) })}
            className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer pr-5"
          >
            {availablePins.map((pin) => <option key={pin} value={pin}>D{pin}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        {/* Mode tabs — ports and non-power buttons only */}
        {!isPort && (
          <div className="flex rounded-lg overflow-hidden border border-gray-700 flex-1">
            {(["momentary", "toggle", "power"] as ButtonMode[]).map((m) => (
              <button key={m}
                onClick={() => onUpdate(button.id, { mode: m })}
                className={[
                  "flex-1 py-1.5 text-[10px] font-medium transition-colors capitalize",
                  button.mode === m
                    ? m === "power" ? "bg-amber-600 text-white" : "bg-blue-600 text-white"
                    : "bg-gray-900 text-gray-500 hover:text-gray-300",
                ].join(" ")}
              >
                {m === "momentary" ? "Hold" : m === "toggle" ? "Toggle" : "Power"}
              </button>
            ))}
          </div>
        )}
        {isPort && (
          <div className="flex rounded-lg overflow-hidden border border-gray-700 flex-1">
            {(["momentary", "toggle"] as ButtonMode[]).map((m) => (
              <button key={m}
                onClick={() => onUpdate(button.id, { mode: m })}
                className={[
                  "flex-1 py-1.5 text-[10px] font-medium transition-colors capitalize",
                  button.mode === m ? "bg-sky-700 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300",
                ].join(" ")}
              >
                {m === "momentary" ? "Hold" : "Toggle"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Key */}
      {!isPower && (
        <div className="flex gap-2 items-center">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0">Key</label>
          <div className="flex-1">
            <KeyCaptureInput
              value={button.arduinoKey} display={button.keyDisplay}
              onChange={(arduinoKey, keyDisplay) => onUpdate(button.id, { arduinoKey, keyDisplay })}
              onClear={() => onUpdate(button.id, { arduinoKey: "", keyDisplay: "" })}
            />
          </div>
        </div>
      )}
      {isPower && (
        <p className="text-[10px] text-amber-500/70 pl-8">Toggles all buttons on/off</p>
      )}
    </div>
  );
}

// ─── Sketch Modal ─────────────────────────────────────────────────────────────

function SketchModal({ code, onClose }: { code: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[85vh] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-green-400" />
            <span className="text-sm font-semibold text-gray-200">Arduino Sketch</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre">{code}</pre>
        </div>
      </div>
    </div>
  );
}

// ─── LED Info Modal ───────────────────────────────────────────────────────────

function LedInfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Lightbulb size={15} className="text-yellow-400" />
            <span className="text-sm font-semibold text-gray-200">How to Wire an LED</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Circuit diagram SVG */}
          <div className="bg-white rounded-xl p-4 flex items-center justify-center">
            <svg viewBox="0 0 580 380" width="100%" style={{ maxHeight: 320 }} xmlns="http://www.w3.org/2000/svg">
              {/* Arduino board */}
              <rect x="120" y="60" width="180" height="280" rx="14" fill="none" stroke="#b89a70" strokeWidth="3" />
              {/* Board label */}
              <text x="185" y="110" fontFamily="Georgia, serif" fontSize="18" fill="#b89a70" fontWeight="bold">Arduino</text>
              <text x="190" y="135" fontFamily="Georgia, serif" fontSize="16" fill="#b89a70">Leonardo</text>
              {/* 5V label top */}
              <text x="185" y="90" fontFamily="monospace" fontSize="11" fill="#b89a70">5V</text>
              {/* GND label bottom */}
              <text x="182" y="325" fontFamily="monospace" fontSize="11" fill="#b89a70">GND</text>
              {/* Pin labels + connectors */}
              {[
                { pin: "13", y: 160, isActive: true },
                { pin: "12", y: 180 },
                { pin: "11", y: 200 },
                { pin: "10", y: 220 },
                { pin: "~9", y: 240 },
                { pin: "8",  y: 260 },
                { pin: "7",  y: 280 },
              ].map(({ pin, y, isActive }) => (
                <g key={pin}>
                  <text x={275} y={y + 4} fontFamily="monospace" fontSize="11" fill={isActive ? "#b89a70" : "#c8b090"} textAnchor="end">{pin}</text>
                  <line x1={282} y1={y} x2={302} y2={y} stroke={isActive ? "#b89a70" : "#d0c0a0"} strokeWidth={isActive ? 2 : 1.5} />
                </g>
              ))}
              {/* Analog pins left side */}
              {["A0","A1","A2","A3","A4","A5"].map((p, i) => (
                <g key={p}>
                  <line x1={118} y1={200 + i * 20} x2={98} y2={200 + i * 20} stroke="#d0c0a0" strokeWidth="1.5" />
                  <text x={92} y={204 + i * 20} fontFamily="monospace" fontSize="11" fill="#c8b090" textAnchor="end">{p}</text>
                </g>
              ))}
              {/* Wire from pin 13 going right → down → resistor → LED → GND */}
              {/* Horizontal wire from pin 13 */}
              <line x1={302} y1={160} x2={400} y2={160} stroke="#b89a70" strokeWidth="2.5" />
              {/* Vertical wire down to resistor */}
              <line x1={400} y1={160} x2={400} y2={210} stroke="#b89a70" strokeWidth="2.5" />
              {/* Resistor symbol (zigzag) */}
              <polyline
                points="400,210 400,218 393,222 407,230 393,238 407,246 393,254 407,262 400,266 400,274"
                fill="none" stroke="#b89a70" strokeWidth="2.5" strokeLinejoin="round"
              />
              {/* Wire from resistor to LED */}
              <line x1={400} y1={274} x2={400} y2={295} stroke="#b89a70" strokeWidth="2.5" />
              {/* LED symbol (triangle + line) */}
              <polygon points="386,295 414,295 400,315" fill="#b89a70" stroke="#b89a70" strokeWidth="1.5" />
              <line x1={386} y1={315} x2={414} y2={315} stroke="#b89a70" strokeWidth="2.5" />
              {/* LED light rays */}
              <line x1={416} y1={308} x2={424} y2={300} stroke="#b89a70" strokeWidth="1.5" />
              <line x1={420} y1={315} x2={430} y2={310} stroke="#b89a70" strokeWidth="1.5" />
              {/* Wire from LED down to GND junction */}
              <line x1={400} y1={315} x2={400} y2={340} stroke="#b89a70" strokeWidth="2.5" />
              {/* GND horizontal wire */}
              <line x1={400} y1={340} x2={302} y2={340} stroke="#b89a70" strokeWidth="2.5" />
              {/* GND connector on board */}
              <line x1={302} y1={340} x2={282} y2={340} stroke="#b89a70" strokeWidth="2" />
              <text x={275} y={344} fontFamily="monospace" fontSize="11" fill="#b89a70" textAnchor="end">GND</text>

              {/* Labels */}
              <rect x="430" y="227" width="130" height="24" rx="4" fill="#0d9488" />
              <text x="495" y="243" fontFamily="Arial, sans-serif" fontSize="11" fill="white" fontWeight="700" textAnchor="middle">220 Ω RESISTOR</text>

              <rect x="430" y="302" width="72" height="24" rx="4" fill="#0d9488" />
              <text x="466" y="318" fontFamily="Arial, sans-serif" fontSize="11" fill="white" fontWeight="700" textAnchor="middle">LED</text>
            </svg>
          </div>

          {/* Tips */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 space-y-2">
            <p className="font-semibold text-gray-200">Wiring notes:</p>
            <ul className="space-y-1 text-xs text-gray-400 list-none">
              <li>• Connect the LED <span className="text-yellow-400 font-semibold">long leg (+)</span> to the resistor, short leg (−) to GND</li>
              <li>• Use a <span className="text-yellow-400 font-semibold">220Ω resistor</span> in series to protect the LED (any value 150Ω–1kΩ works)</li>
              <li>• The <span className="text-yellow-400 font-semibold">Active LED</span> pin lights when your controller is enabled</li>
              <li>• The <span className="text-yellow-400 font-semibold">Inactive LED</span> pin lights when the power button turns everything off</li>
              <li>• Pin 13 has a built-in LED on the board — useful for testing without extra hardware</li>
            </ul>
          </div>

          {/* Docs link */}
          <a
            href="https://docs.arduino.cc/built-in-examples/basics/Blink/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-teal-700/50 bg-teal-900/20 hover:bg-teal-900/40 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-600/30 flex items-center justify-center flex-shrink-0">
              <ExternalLink size={14} className="text-teal-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-teal-300 group-hover:text-teal-200 transition-colors">Arduino Blink Documentation</p>
              <p className="text-xs text-teal-600">docs.arduino.cc · Official LED wiring guide</p>
            </div>
            <ExternalLink size={13} className="text-teal-600 ml-auto flex-shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Log Line ─────────────────────────────────────────────────────────────────

function LogLineView({ line }: { line: LogLine }) {
  const colorMap: Record<string, string> = {
    info: "text-gray-400", log: "text-gray-200", success: "text-green-400", error: "text-red-400", done: "text-blue-400",
  };
  const prefixMap: Record<string, string> = { info: "›", log: " ", success: "✓", error: "✗", done: "•" };
  let displayData = line.data;
  if (line.type === "done") {
    try { displayData = JSON.parse(line.data).success ? "Upload finished successfully." : "Upload finished with errors."; }
    catch { /* keep raw */ }
  }
  return (
    <div className={`flex gap-2 font-mono text-xs leading-5 ${colorMap[line.type] || "text-gray-300"}`}>
      <span className="flex-shrink-0 w-3 text-center opacity-60">{prefixMap[line.type] || " "}</span>
      <span className="break-all">{displayData}</span>
    </div>
  );
}

// ─── Pin Selector ─────────────────────────────────────────────────────────────

function PinSelect({ value, onChange, label, excludePins }: {
  value: number; onChange: (v: number) => void; label: string; excludePins: number[];
}) {
  const available = ALL_PINS.filter((p) => p === value || !excludePins.includes(p));
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(parseInt(e.target.value))}
          className="appearance-none bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer pr-6"
        >
          {available.map((pin) => <option key={pin} value={pin}>Pin {pin}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Analog Pin Selector ──────────────────────────────────────────────────────

function AnalogPinSelect({ value, onChange, label, excludePins }: {
  value: number; onChange: (v: number) => void; label: string; excludePins: number[];
}) {
  const available = ANALOG_PINS.filter((p) => p === value || !excludePins.includes(p));
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0">{label}</label>
      <div className="relative" style={{ width: 68 }}>
        <select value={value} onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer pr-5"
        >
          {available.map((p) => <option key={p} value={p}>A{p}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── IR Sensor Card ───────────────────────────────────────────────────────────

function IRSensorCard({ sensor, index, usedPins, onUpdate, onRemove }: {
  sensor: IRSensorConfig; index: number; usedPins: number[];
  onUpdate: (id: string, u: Partial<IRSensorConfig>) => void;
  onRemove: (id: string) => void;
}) {
  const availablePins = ALL_PINS.filter((p) => p === sensor.pin || !usedPins.includes(p));
  return (
    <div className="border rounded-xl p-3 flex flex-col gap-2 transition-colors group bg-emerald-950/30 border-emerald-800/50 hover:border-emerald-700/60">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border bg-emerald-500/20 border-emerald-500/40">
          <span className="text-emerald-400 text-[9px] font-bold">IR</span>
        </div>
        <input type="text" value={sensor.name}
          onChange={(e) => onUpdate(sensor.id, { name: e.target.value })}
          placeholder={`IR Sensor ${index + 1}`}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-200 placeholder:text-gray-600 outline-none border-b border-transparent focus:border-gray-600 transition-colors min-w-0"
        />
        <button onClick={() => onRemove(sensor.id)}
          className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
        ><Trash2 size={12} /></button>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0">Pin</label>
        <div className="relative" style={{ width: 68 }}>
          <select value={sensor.pin} onChange={(e) => onUpdate(sensor.id, { pin: parseInt(e.target.value) })}
            className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer pr-5"
          >
            {availablePins.map((p) => <option key={p} value={p}>D{p}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Mode */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700 flex-1">
          {(["momentary", "toggle"] as const).map((m) => (
            <button key={m} onClick={() => onUpdate(sensor.id, { mode: m })}
              className={["flex-1 py-1.5 text-[10px] font-medium transition-colors capitalize",
                sensor.mode === m ? "bg-emerald-700 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"
              ].join(" ")}>{m === "momentary" ? "Hold" : "Toggle"}</button>
          ))}
        </div>

        {/* Active polarity */}
        <button onClick={() => onUpdate(sensor.id, { activeHigh: !sensor.activeHigh })}
          className={["px-2 py-1.5 rounded-lg border text-[10px] font-medium transition-colors",
            sensor.activeHigh ? "bg-emerald-800 border-emerald-600 text-emerald-300" : "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300"
          ].join(" ")}
          title="Toggle whether HIGH or LOW means 'triggered'"
        >{sensor.activeHigh ? "HIGH=on" : "LOW=on"}</button>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0">Key</label>
        <div className="flex-1">
          <KeyCaptureInput value={sensor.arduinoKey} display={sensor.keyDisplay}
            onChange={(arduinoKey, keyDisplay) => onUpdate(sensor.id, { arduinoKey, keyDisplay })}
            onClear={() => onUpdate(sensor.id, { arduinoKey: "", keyDisplay: "" })}
          />
        </div>
      </div>
      <p className="text-[10px] text-emerald-600/70 pl-8">Most IR modules output LOW when triggered → use LOW=on</p>
    </div>
  );
}

// ─── Sip & Puff Card ──────────────────────────────────────────────────────────

function SipPuffCard({ sensor, index, usedAnalogPins, onUpdate, onRemove }: {
  sensor: SipPuffConfig; index: number; usedAnalogPins: number[];
  onUpdate: (id: string, u: Partial<SipPuffConfig>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="border rounded-xl p-3 flex flex-col gap-2 transition-colors group bg-cyan-950/30 border-cyan-800/50 hover:border-cyan-700/60">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border bg-cyan-500/20 border-cyan-500/40">
          <Wind size={9} className="text-cyan-400" />
        </div>
        <input type="text" value={sensor.name}
          onChange={(e) => onUpdate(sensor.id, { name: e.target.value })}
          placeholder={`Sip & Puff ${index + 1}`}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-200 placeholder:text-gray-600 outline-none border-b border-transparent focus:border-gray-600 transition-colors min-w-0"
        />
        <button onClick={() => onRemove(sensor.id)}
          className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
        ><Trash2 size={12} /></button>
      </div>

      <AnalogPinSelect label="Pin" value={sensor.analogPin}
        onChange={(v) => onUpdate(sensor.id, { analogPin: v })}
        excludePins={usedAnalogPins.filter((p) => p !== sensor.analogPin)}
      />

      {/* Sip key + threshold */}
      <div className="flex flex-col gap-1.5 pl-8">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-cyan-400 font-semibold w-8">Sip</span>
          <div className="flex-1"><KeyCaptureInput value={sensor.sipKey} display={sensor.sipDisplay}
            onChange={(k, d) => onUpdate(sensor.id, { sipKey: k, sipDisplay: d })}
            onClear={() => onUpdate(sensor.id, { sipKey: "", sipDisplay: "" })}
          /></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-cyan-600 w-8">thr</span>
          <input type="range" min={0} max={512} value={sensor.sipThreshold}
            onChange={(e) => onUpdate(sensor.id, { sipThreshold: parseInt(e.target.value) })}
            className="flex-1 accent-cyan-500 h-1"
          />
          <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{sensor.sipThreshold}</span>
        </div>
      </div>

      {/* Puff key + threshold */}
      <div className="flex flex-col gap-1.5 pl-8">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-sky-400 font-semibold w-8">Puff</span>
          <div className="flex-1"><KeyCaptureInput value={sensor.puffKey} display={sensor.puffDisplay}
            onChange={(k, d) => onUpdate(sensor.id, { puffKey: k, puffDisplay: d })}
            onClear={() => onUpdate(sensor.id, { puffKey: "", puffDisplay: "" })}
          /></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-sky-600 w-8">thr</span>
          <input type="range" min={512} max={1023} value={sensor.puffThreshold}
            onChange={(e) => onUpdate(sensor.id, { puffThreshold: parseInt(e.target.value) })}
            className="flex-1 accent-sky-500 h-1"
          />
          <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{sensor.puffThreshold}</span>
        </div>
      </div>
      <p className="text-[10px] text-cyan-600/70 pl-8">Sip = inhale (low pressure) · Puff = exhale (high pressure)</p>
    </div>
  );
}

// ─── Joystick Card ────────────────────────────────────────────────────────────

function JoystickCard({ joy, index, usedPins, usedAnalogPins, onUpdate, onRemove }: {
  joy: JoystickConfig; index: number; usedPins: number[]; usedAnalogPins: number[];
  onUpdate: (id: string, u: Partial<JoystickConfig>) => void;
  onRemove: (id: string) => void;
}) {
  const availableDigital = ALL_PINS.filter((p) => p === joy.buttonPin || !usedPins.includes(p));
  const dirs: { label: string; key: keyof JoystickConfig; display: keyof JoystickConfig }[] = [
    { label: "↑ Up",    key: "upKey",    display: "upDisplay" },
    { label: "↓ Down",  key: "downKey",  display: "downDisplay" },
    { label: "← Left",  key: "leftKey",  display: "leftDisplay" },
    { label: "→ Right", key: "rightKey", display: "rightDisplay" },
  ];

  return (
    <div className="border rounded-xl p-3 flex flex-col gap-2 transition-colors group bg-violet-950/30 border-violet-800/50 hover:border-violet-700/60">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border bg-violet-500/20 border-violet-500/40">
          <Joystick size={9} className="text-violet-400" />
        </div>
        <input type="text" value={joy.name}
          onChange={(e) => onUpdate(joy.id, { name: e.target.value })}
          placeholder={`Joystick ${index + 1}`}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-200 placeholder:text-gray-600 outline-none border-b border-transparent focus:border-gray-600 transition-colors min-w-0"
        />
        <button onClick={() => onRemove(joy.id)}
          className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
        ><Trash2 size={12} /></button>
      </div>

      {/* Analog pins */}
      <div className="flex gap-3 flex-wrap">
        <AnalogPinSelect label="X" value={joy.xPin}
          onChange={(v) => onUpdate(joy.id, { xPin: v })}
          excludePins={usedAnalogPins.filter((p) => p !== joy.xPin)}
        />
        <AnalogPinSelect label="Y" value={joy.yPin}
          onChange={(v) => onUpdate(joy.id, { yPin: v })}
          excludePins={usedAnalogPins.filter((p) => p !== joy.yPin)}
        />
        {/* Invert toggles */}
        <button onClick={() => onUpdate(joy.id, { invertX: !joy.invertX })}
          className={["px-2 py-1.5 rounded-lg border text-[10px] transition-colors",
            joy.invertX ? "bg-violet-800 border-violet-600 text-violet-300" : "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300"
          ].join(" ")}>Inv X</button>
        <button onClick={() => onUpdate(joy.id, { invertY: !joy.invertY })}
          className={["px-2 py-1.5 rounded-lg border text-[10px] transition-colors",
            joy.invertY ? "bg-violet-800 border-violet-600 text-violet-300" : "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300"
          ].join(" ")}>Inv Y</button>
      </div>

      {/* Direction keys */}
      <div className="grid grid-cols-2 gap-1.5 pl-1">
        {dirs.map(({ label, key, display }) => (
          <div key={String(key)} className="flex items-center gap-1.5">
            <span className="text-[10px] text-violet-400 font-mono w-10 flex-shrink-0">{label}</span>
            <div className="flex-1">
              <KeyCaptureInput
                value={joy[key] as string} display={joy[display] as string}
                onChange={(k, d) => onUpdate(joy.id, { [key]: k, [display]: d })}
                onClear={() => onUpdate(joy.id, { [key]: "", [display]: "" })}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Deadzone slider */}
      <div className="flex items-center gap-2 pl-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider w-16 flex-shrink-0">Deadzone</span>
        <input type="range" min={0} max={400} value={joy.deadzone}
          onChange={(e) => onUpdate(joy.id, { deadzone: parseInt(e.target.value) })}
          className="flex-1 accent-violet-500 h-1"
        />
        <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{joy.deadzone}</span>
      </div>

      {/* Click button pin */}
      <div className="flex items-center gap-2 pl-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider w-16 flex-shrink-0">Click pin</span>
        <div className="relative" style={{ width: 68 }}>
          <select value={joy.buttonPin} onChange={(e) => onUpdate(joy.id, { buttonPin: parseInt(e.target.value) })}
            className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none cursor-pointer pr-5"
          >
            <option value={-1}>None</option>
            {availableDigital.map((p) => <option key={p} value={p}>D{p}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        {joy.buttonPin >= 0 && (
          <div className="flex-1">
            <KeyCaptureInput value={joy.buttonKey} display={joy.buttonDisplay}
              onChange={(k, d) => onUpdate(joy.id, { buttonKey: k, buttonDisplay: d })}
              onClear={() => onUpdate(joy.id, { buttonKey: "", buttonDisplay: "" })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<"configure" | "test">("configure");
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [buttons, setButtons] = useState<ButtonConfig[]>([
    { id: generateId(), name: "", pin: 2, keyDisplay: "", arduinoKey: "", mode: "momentary" },
  ]);
  const [portInputs, setPortInputs] = useState<PortConfig[]>([]);
  const [leds, setLeds] = useState<LedConfig>({ enabled: false, onPin: 11, offPin: 12 });
  const [showSketch, setShowSketch] = useState(false);
  const [sketchCode, setSketchCode] = useState("");
  const [uploadLog, setUploadLog] = useState<LogLine[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState<boolean | null>(null);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [loadingSketch, setLoadingSketch] = useState(false);
  const [showLedInfo, setShowLedInfo] = useState(false);
  const [dinoCollapsed,  setDinoCollapsed]  = useState(false);
  const [snakeCollapsed, setSnakeCollapsed] = useState(false);
  const [irSensors, setIrSensors] = useState<IRSensorConfig[]>([]);
  const [sipPuffs, setSipPuffs] = useState<SipPuffConfig[]>([]);
  const [joysticks, setJoysticks] = useState<JoystickConfig[]>([]);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [uploadLog]);
  useEffect(() => { fetchPorts(); }, []);

  const fetchPorts = async () => {
    setLoadingPorts(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ports`);
      const data = await res.json();
      setPorts(data.ports || []);
      if (data.ports?.length > 0 && !selectedPort) setSelectedPort(data.ports[0].path);
    } catch { setPorts([]); }
    finally { setLoadingPorts(false); }
  };

  const usedPins = [
    ...buttons.map((b) => b.pin),
    ...portInputs.map((p) => p.pin),
    ...irSensors.map((s) => s.pin),
    ...joysticks.filter((j) => j.buttonPin >= 0).map((j) => j.buttonPin),
    ...(leds.enabled ? [leds.onPin, leds.offPin] : []),
  ];
  const usedAnalogPins = [
    ...sipPuffs.map((s) => s.analogPin),
    ...joysticks.flatMap((j) => [j.xPin, j.yPin]),
  ];

  const addButton = () => {
    if (buttons.length >= 12) return;
    const next = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
    setButtons((prev) => [...prev, { id: generateId(), name: "", pin: next, keyDisplay: "", arduinoKey: "", mode: "momentary" }]);
  };

  const addPort = () => {
    if (portInputs.length >= 4) return;
    const next = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
    setPortInputs((prev) => [...prev, { id: generateId(), name: "", pin: next, keyDisplay: "", arduinoKey: "", mode: "momentary" }]);
  };

  const updateButton = (id: string, updates: Partial<ButtonConfig>) =>
    setButtons((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  const removeButton = (id: string) => setButtons((prev) => prev.filter((b) => b.id !== id));

  const updatePort = (id: string, updates: Partial<PortConfig>) =>
    setPortInputs((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  const removePort = (id: string) => setPortInputs((prev) => prev.filter((p) => p.id !== id));

  // IR sensors
  const addIR = () => {
    const pin = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
    setIrSensors((prev) => [...prev, { id: generateId(), name: "", pin, keyDisplay: "", arduinoKey: "", mode: "momentary", activeHigh: false }]);
  };
  const updateIR = (id: string, u: Partial<IRSensorConfig>) =>
    setIrSensors((prev) => prev.map((s) => (s.id === id ? { ...s, ...u } : s)));
  const removeIR = (id: string) => setIrSensors((prev) => prev.filter((s) => s.id !== id));

  // Sip & puff
  const addSipPuff = () => {
    const ap = ANALOG_PINS.find((p) => !usedAnalogPins.includes(p)) ?? 0;
    setSipPuffs((prev) => [...prev, { id: generateId(), name: "", analogPin: ap, sipKey: "", sipDisplay: "", puffKey: "", puffDisplay: "", sipThreshold: 300, puffThreshold: 700 }]);
  };
  const updateSipPuff = (id: string, u: Partial<SipPuffConfig>) =>
    setSipPuffs((prev) => prev.map((s) => (s.id === id ? { ...s, ...u } : s)));
  const removeSipPuff = (id: string) => setSipPuffs((prev) => prev.filter((s) => s.id !== id));

  // Joysticks
  const addJoystick = () => {
    const avail = ANALOG_PINS.filter((p) => !usedAnalogPins.includes(p));
    const xPin = avail[0] ?? 0;
    const yPin = avail[1] ?? 1;
    const bPin = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
    setJoysticks((prev) => [...prev, {
      id: generateId(), name: "", xPin, yPin, buttonPin: bPin,
      upKey: "KEY_UP_ARROW", upDisplay: "Arrow Up",
      downKey: "KEY_DOWN_ARROW", downDisplay: "Arrow Down",
      leftKey: "KEY_LEFT_ARROW", leftDisplay: "Arrow Left",
      rightKey: "KEY_RIGHT_ARROW", rightDisplay: "Arrow Right",
      buttonKey: "", buttonDisplay: "", deadzone: 200, invertX: false, invertY: false,
    }]);
  };
  const updateJoystick = (id: string, u: Partial<JoystickConfig>) =>
    setJoysticks((prev) => prev.map((j) => (j.id === id ? { ...j, ...u } : j)));
  const removeJoystick = (id: string) => setJoysticks((prev) => prev.filter((j) => j.id !== id));

  const jumpKeys = useMemo(
    () => [...buttons, ...portInputs].filter((b) => b.arduinoKey).map((b) => b.arduinoKey),
    [buttons, portInputs]
  );

  const joystickMaps = useMemo(
    () => joysticks.map((j) => ({
      up:    arduinoToBrowserKey(j.upKey),
      down:  arduinoToBrowserKey(j.downKey),
      left:  arduinoToBrowserKey(j.leftKey),
      right: arduinoToBrowserKey(j.rightKey),
    })),
    [joysticks]
  );

  const openSketch = async () => {
    setLoadingSketch(true);
    try {
      const sketch = generateSketch(buttons, leds, portInputs, irSensors, sipPuffs, joysticks);
      setSketchCode(sketch);
      setShowSketch(true);
    } finally { setLoadingSketch(false); }
  };

  const startUpload = async () => {
    if (!selectedPort || uploading) return;
    setUploading(true); setUploadDone(null); setUploadLog([]);
    const sketch = generateSketch(buttons, leds, portInputs, irSensors, sipPuffs, joysticks);
    try {
      const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: selectedPort, sketch }),
      });
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6).trim());
                setUploadLog((prev) => [...prev, { type: event.type, data: event.data }]);
                if (event.type === "done") {
                  try { setUploadDone(JSON.parse(event.data).success === true); } catch { setUploadDone(false); }
                }
              } catch { /* skip */ }
            }
          }
        }
      }
    } catch (err) {
      setUploadLog((prev) => [...prev, { type: "error", data: err instanceof Error ? err.message : "Connection failed." }]);
      setUploadDone(false);
    } finally { setUploading(false); }
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-800/80 bg-gray-900/50 backdrop-blur-sm flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Zap size={14} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-100 leading-none">Arduino Button Mapper</h1>
            <p className="text-[10px] text-gray-500 leading-none mt-0.5 hidden sm:block">Configure → Upload → Test</p>
          </div>
          <div className="flex bg-gray-800/60 border border-gray-700 rounded-xl p-0.5 gap-0.5">
            <button onClick={() => setTab("configure")}
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "configure" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><Settings size={12} /> Configure</button>
            <button onClick={() => setTab("test")}
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "test" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><Gamepad2 size={12} /> Test</button>
          </div>
        </div>
      </header>

      {/* ══ CONFIGURE TAB ══════════════════════════════════════════════════ */}
      {tab === "configure" && (
        <div className="flex-1 overflow-hidden">
          <div className="h-full max-w-[1400px] mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Left column: Port + LEDs + Upload */}
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">

              {/* Upload (top) */}
              <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Upload size={13} className="text-green-400" />
                  <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Upload to Arduino</h2>
                </div>

                {/* Port + Upload row */}
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <select value={selectedPort} onChange={(e) => setSelectedPort(e.target.value)} disabled={loadingPorts}
                      className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 pr-8 cursor-pointer"
                    >
                      {loadingPorts ? <option>Scanning...</option>
                        : ports.length === 0 ? <option value="">No ports found</option>
                        : ports.map((p) => (
                          <option key={p.path} value={p.path}>
                            {p.path}{p.description && p.description !== "Unknown" ? ` — ${p.description}` : ""}
                          </option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                  <button onClick={fetchPorts} disabled={loadingPorts}
                    className="px-2.5 py-2 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-all disabled:opacity-50"
                    title="Refresh ports"
                  ><RefreshCw size={14} className={loadingPorts ? "animate-spin" : ""} /></button>
                  <button onClick={openSketch} disabled={loadingSketch}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 hover:text-gray-100 transition-all"
                  >
                    {loadingSketch ? <Loader2 size={13} className="animate-spin" /> : <Code size={13} />}
                    Sketch
                  </button>
                  <button onClick={startUpload} disabled={!selectedPort || uploading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0"
                  >
                    {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Upload size={14} /> Upload</>}
                  </button>
                </div>

                {/* Result */}
                {uploadDone !== null && !uploading && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium mb-2 ${
                    uploadDone ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}>
                    {uploadDone ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    {uploadDone ? "Upload successful!" : "Upload failed — see log"}
                  </div>
                )}

                {/* Log */}
                {uploadLog.length > 0 && (
                  <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="max-h-32 overflow-y-auto p-2.5 space-y-0.5">
                      {uploadLog.map((line, i) => <LogLineView key={i} line={line} />)}
                      <div ref={logEndRef} />
                    </div>
                  </div>
                )}
              </section>

              {/* LED Config */}
              <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={13} className="text-yellow-400" />
                    <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">LED Indicators</h2>
                    <button onClick={() => setShowLedInfo(true)}
                      className="p-0.5 rounded text-gray-600 hover:text-yellow-400 transition-colors"
                      title="LED wiring guide"
                    ><Info size={13} /></button>
                  </div>
                  <div onClick={() => setLeds((l) => ({ ...l, enabled: !l.enabled }))}
                    className={["relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0",
                      leds.enabled ? "bg-blue-600" : "bg-gray-700"].join(" ")}
                  >
                    <div className={["absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      leds.enabled ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
                  </div>
                </div>
                {leds.enabled ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)] flex-shrink-0" />
                      <PinSelect label="Active (green)" value={leds.onPin}
                        onChange={(v) => setLeds((l) => ({ ...l, onPin: v }))}
                        excludePins={usedPins.filter((p) => p !== leds.onPin)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)] flex-shrink-0" />
                      <PinSelect label="Inactive (red)" value={leds.offPin}
                        onChange={(v) => setLeds((l) => ({ ...l, offPin: v }))}
                        excludePins={usedPins.filter((p) => p !== leds.offPin)} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">Enable to add two status LEDs to your build.</p>
                )}
              </section>

              {/* Port Inputs */}
              <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Usb size={13} className="text-sky-400" />
                    <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Back Panel Ports</h2>
                  </div>
                  <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">{portInputs.length}/4</span>
                </div>
                <div className="flex flex-col gap-2 mb-2">
                  {portInputs.map((p, i) => (
                    <ButtonCard key={p.id} button={p} index={i} usedPins={usedPins}
                      onUpdate={updatePort} onRemove={removePort} isPort />
                  ))}
                </div>
                <button onClick={addPort} disabled={portInputs.length >= 4}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-700 hover:border-sky-500/50 hover:bg-sky-500/5 text-gray-500 hover:text-sky-400 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={13} /> Add Port Input
                </button>
              </section>

              {/* ── Sensors ──────────────────────────────────────── */}
              <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Radio size={13} className="text-emerald-400" />
                  <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Sensors</h2>
                  <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                    {irSensors.length + sipPuffs.length + joysticks.length}
                  </span>
                </div>

                {/* IR sensors */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-emerald-400/80 font-semibold uppercase tracking-wider">IR Sensors</span>
                    <button onClick={addIR} disabled={irSensors.length >= 4}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed border-emerald-800/60 hover:border-emerald-600/60 text-emerald-600 hover:text-emerald-400 text-[10px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    ><Plus size={10} /> Add IR</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {irSensors.map((s, i) => (
                      <IRSensorCard key={s.id} sensor={s} index={i} usedPins={usedPins}
                        onUpdate={updateIR} onRemove={removeIR} />
                    ))}
                    {irSensors.length === 0 && (
                      <p className="text-[10px] text-gray-700 pl-1">Proximity / break-beam sensors on digital pins</p>
                    )}
                  </div>
                </div>

                {/* Sip & puff */}
                <div className="border-t border-gray-800 pt-3 mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-cyan-400/80 font-semibold uppercase tracking-wider">Sip &amp; Puff</span>
                    <button onClick={addSipPuff} disabled={sipPuffs.length >= 4}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed border-cyan-800/60 hover:border-cyan-600/60 text-cyan-600 hover:text-cyan-400 text-[10px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    ><Plus size={10} /> Add Sip&amp;Puff</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {sipPuffs.map((s, i) => (
                      <SipPuffCard key={s.id} sensor={s} index={i} usedAnalogPins={usedAnalogPins}
                        onUpdate={updateSipPuff} onRemove={removeSipPuff} />
                    ))}
                    {sipPuffs.length === 0 && (
                      <p className="text-[10px] text-gray-700 pl-1">Analog pressure sensor on A0–A5</p>
                    )}
                  </div>
                </div>

                {/* Joysticks */}
                <div className="border-t border-gray-800 pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-violet-400/80 font-semibold uppercase tracking-wider">Joysticks</span>
                    <button onClick={addJoystick} disabled={joysticks.length >= 2}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed border-violet-800/60 hover:border-violet-600/60 text-violet-600 hover:text-violet-400 text-[10px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    ><Plus size={10} /> Add Joystick</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {joysticks.map((j, i) => (
                      <JoystickCard key={j.id} joy={j} index={i} usedPins={usedPins} usedAnalogPins={usedAnalogPins}
                        onUpdate={updateJoystick} onRemove={removeJoystick} />
                    ))}
                    {joysticks.length === 0 && (
                      <p className="text-[10px] text-gray-700 pl-1">Analog X/Y joystick with optional click button</p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Right column: Buttons */}
            <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Pencil size={13} className="text-purple-400" />
                  <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Configure Buttons</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">{buttons.length}/12</span>
                </div>
              </div>
              <div className="text-[10px] text-gray-600 mb-3 flex gap-3 flex-shrink-0 flex-wrap">
                <span><span className="text-blue-400">Hold</span> = key held while pressed</span>
                <span><span className="text-blue-400">Toggle</span> = alternates on/off</span>
                <span><span className="text-amber-400">Power</span> = enables/disables all</span>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {buttons.map((btn, i) => (
                  <ButtonCard key={btn.id} button={btn} index={i} usedPins={usedPins}
                    onUpdate={updateButton} onRemove={removeButton} />
                ))}
              </div>
              <button onClick={addButton} disabled={buttons.length >= 12}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/5 text-gray-500 hover:text-blue-400 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Plus size={13} /> Add Button
              </button>
            </section>
          </div>
        </div>
      )}

      {/* ══ TEST TAB ═══════════════════════════════════════════════════════ */}
      {tab === "test" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">

            {/* ── Dino Game ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div
                className="flex items-center gap-2 px-5 py-3 cursor-pointer select-none hover:bg-gray-800/40 transition-colors"
                onClick={() => setDinoCollapsed((c) => !c)}
              >
                <Gamepad2 size={14} className="text-purple-400 flex-shrink-0" />
                <h2 className="text-sm font-semibold text-gray-200">Dino Game</h2>
                {dinoCollapsed && <span className="text-xs text-gray-600">↑ jump · ↓ duck</span>}
                <div className="ml-auto flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors">
                  {dinoCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                </div>
              </div>
              {!dinoCollapsed && (
                <div className="px-5 pb-5">
                  <DinoGame jumpKeys={jumpKeys} />
                </div>
              )}
            </div>

            {/* ── Snake Game ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div
                className="flex items-center gap-2 px-5 py-3 cursor-pointer select-none hover:bg-gray-800/40 transition-colors"
                onClick={() => setSnakeCollapsed((c) => !c)}
              >
                <Joystick size={14} className="text-violet-400 flex-shrink-0" />
                <h2 className="text-sm font-semibold text-gray-200">Snake</h2>
                {snakeCollapsed && <span className="text-xs text-gray-600">↑↓←→ · WASD · joystick</span>}
                <div className="ml-auto flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors">
                  {snakeCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                </div>
              </div>
              {!snakeCollapsed && (
                <div className="px-5 pb-5">
                  <SnakeGame joystickMaps={joystickMaps} />
                </div>
              )}
            </div>

            {/* ── Device Tester ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={14} className="text-blue-400" />
                <h2 className="text-sm font-semibold text-gray-200">Device Tester</h2>
                <span className="text-xs text-gray-600">click or press keys to test</span>
              </div>
              <DeviceMockup buttons={buttons} leds={leds} ports={portInputs} />
            </div>

          </div>
        </div>
      )}

      {/* Sketch modal */}
      {showSketch && sketchCode && (
        <SketchModal code={sketchCode} onClose={() => setShowSketch(false)} />
      )}

      {/* LED info modal */}
      {showLedInfo && <LedInfoModal onClose={() => setShowLedInfo(false)} />}
    </div>
  );
}
