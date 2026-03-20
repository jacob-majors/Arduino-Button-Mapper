"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Zap, RefreshCw, Plus, Trash2, X, Upload, ChevronDown,
  Loader2, CheckCircle2, XCircle, Terminal, Usb, Keyboard,
  RotateCcw, Pencil, Gamepad2, Settings, Lightbulb, Power, Code,
  Info, ExternalLink, Radio, Wind, Joystick, Minimize2, Maximize2, Download,
} from "lucide-react";
import {
  ButtonConfig, ButtonMode, LedConfig, PortConfig,
  IRSensorConfig, SipPuffConfig, JoystickConfig,
  resolveKey, generateSketch,
} from "@/lib/keymap";
import DinoGame from "@/components/DinoGame";
import SnakeGame from "@/components/SnakeGame";
import PongGame from "@/components/PongGame";
import DeviceMockup from "@/components/DeviceMockup";
import { arduinoToBrowserKey } from "@/lib/keymap";
import {
  supabase,
  loginOrCreate,
  loadAllSaves,
  upsertSave,
  deleteSave,
  getAdminSettings,
  updateAdminSettings,
  loadAllUsers,
  isAdmin,
  ADMIN_USERNAME,
} from "@/lib/supabase";
import type { SaveSlot, AppUser, AdminSettings } from "@/lib/supabase";

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

      {/* LED pin */}
      <div className="flex gap-2 items-center">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0 flex items-center gap-1">
          <Lightbulb size={9} className={(button.ledPin ?? -1) >= 0 ? "text-yellow-400" : "text-gray-600"} />
        </label>
        <div className="relative" style={{ width: 68 }}>
          <select
            value={button.ledPin ?? -1}
            onChange={(e) => onUpdate(button.id, { ledPin: parseInt(e.target.value) })}
            className={[
              "w-full appearance-none border rounded-lg px-2 py-1.5 text-xs focus:outline-none transition-colors cursor-pointer pr-5",
              (button.ledPin ?? -1) >= 0
                ? "bg-yellow-950/30 border-yellow-700/50 text-yellow-300"
                : "bg-gray-900 border-gray-700 text-gray-500",
            ].join(" ")}
          >
            <option value={-1}>No LED</option>
            {ALL_PINS.filter((p) => p === button.ledPin || !usedPins.includes(p)).map((p) => (
              <option key={p} value={p}>D{p}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        {(button.ledPin ?? -1) >= 0 && (
          <span className="text-[10px] text-yellow-600/70">
            {isPower ? "on = system active" : button.mode === "toggle" ? "on = toggled on" : "on = held"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Sketch Modal ─────────────────────────────────────────────────────────────

function SketchModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
            <span className="text-xs text-gray-500">— paste this into Arduino IDE</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copied ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
            >
              {copied ? <><CheckCircle2 size={12} /> Copied!</> : <><Download size={12} /> Copy Code</>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre">{code}</pre>
        </div>
        <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-500">1. Copy Code → 2. Open Arduino IDE → 3. Paste → 4. Upload</p>
          <button onClick={copy}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${copied ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
          >
            {copied ? <><CheckCircle2 size={13} /> Copied!</> : <><Download size={13} /> Copy Code</>}
          </button>
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

// ─── Wiring Panel ─────────────────────────────────────────────────────────────

type WireRow = { label: string; to: string; color: string };

function WiringPanel({ wires, docsUrl, docsLabel }: {
  wires: WireRow[];
  docsUrl: string;
  docsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
      >
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        Wiring diagram
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-gray-800 bg-gray-950/60 p-3 flex flex-col gap-1.5">
          {/* Wire table */}
          <div className="flex items-center gap-2 pb-1 border-b border-gray-800">
            <span className="text-[10px] text-gray-600 font-semibold w-16 flex-shrink-0">Sensor</span>
            <span className="text-[10px] text-gray-600 font-semibold flex-1">Arduino Leonardo</span>
          </div>
          {wires.map((w) => (
            <div key={w.label} className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold w-16 flex-shrink-0" style={{ color: w.color }}>{w.label}</span>
              <div className="flex-1 flex items-center gap-1.5">
                <div className="flex-1 border-t border-dashed" style={{ borderColor: w.color + "55" }} />
                <span className="text-[10px] font-mono text-gray-300">{w.to}</span>
              </div>
            </div>
          ))}
          {/* Docs link */}
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 mt-1 text-[10px] text-blue-500 hover:text-blue-400 transition-colors"
          >
            <ExternalLink size={9} />
            {docsLabel}
          </a>
        </div>
      )}
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
      <WiringPanel
        wires={[
          { label: "VCC", to: "5V", color: "#f87171" },
          { label: "GND", to: "GND", color: "#9ca3af" },
          { label: "OUT", to: `D${sensor.pin}`, color: "#34d399" },
        ]}
        docsUrl="https://www.arduino.cc/reference/en/language/functions/digital-io/digitalread/"
        docsLabel="Arduino digitalRead() docs"
      />
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
      <WiringPanel
        wires={[
          { label: "VCC", to: "5V", color: "#f87171" },
          { label: "GND", to: "GND", color: "#9ca3af" },
          { label: "OUT/Vout", to: `A${sensor.analogPin}`, color: "#22d3ee" },
        ]}
        docsUrl="https://www.arduino.cc/reference/en/language/functions/analog-io/analogread/"
        docsLabel="Arduino analogRead() docs"
      />
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
      <WiringPanel
        wires={[
          { label: "VCC (+5V)", to: "5V", color: "#f87171" },
          { label: "GND", to: "GND", color: "#9ca3af" },
          { label: "VRx", to: `A${joy.xPin}`, color: "#a78bfa" },
          { label: "VRy", to: `A${joy.yPin}`, color: "#c4b5fd" },
          ...(joy.buttonPin >= 0 ? [{ label: "SW (click)", to: `D${joy.buttonPin}`, color: "#818cf8" }] : []),
        ]}
        docsUrl="https://www.arduino.cc/reference/en/language/functions/analog-io/analogread/"
        docsLabel="Arduino analogRead() docs"
      />
    </div>
  );
}

// ─── Live Wiring Diagram ──────────────────────────────────────────────────────

function LiveWiringDiagram({ buttons, portInputs, leds, irSensors, sipPuffs, joysticks }: {
  buttons: ButtonConfig[]; portInputs: PortConfig[]; leds: LedConfig;
  irSensors: IRSensorConfig[]; sipPuffs: SipPuffConfig[]; joysticks: JoystickConfig[];
}) {
  const BX = 255, BY = 25, BW = 110, BH = 308;
  const dpY = (pin: number) => BY + 46 + (13 - pin) * 18;
  const dpX = BX + BW;
  const apY = (pin: number) => BY + 120 + pin * 22;
  const apX = BX;

  type Conn = { pin: number; label: string; color: string };
  const right: Conn[] = [];
  const left: Conn[]  = [];
  const seenD = new Set<number>();
  const seenA = new Set<number>();

  const addD = (pin: number, label: string, color: string) => {
    if (pin >= 0 && pin <= 13 && !seenD.has(pin)) { seenD.add(pin); right.push({ pin, label, color }); }
  };
  const addA = (pin: number, label: string, color: string) => {
    if (pin >= 0 && pin <= 5 && !seenA.has(pin)) { seenA.add(pin); left.push({ pin, label, color }); }
  };

  const trunc = (s: string, n = 17) => s.length > n ? s.slice(0, n - 1) + "…" : s;

  buttons.forEach((b) => {
    addD(b.pin, trunc(b.name || `Button`), b.mode === "power" ? "#f59e0b" : "#60a5fa");
    if ((b.ledPin ?? -1) >= 0) addD(b.ledPin, trunc((b.name || "Button") + " LED"), "#fbbf24");
  });
  portInputs.forEach((p) => {
    addD(p.pin, trunc(p.name || `Port Input`), "#38bdf8");
    if ((p.ledPin ?? -1) >= 0) addD(p.ledPin, trunc((p.name || "Port") + " LED"), "#fbbf24");
  });
  if (leds.enabled) {
    addD(leds.onPin,  "LED — active",   "#fbbf24");
    addD(leds.offPin, "LED — inactive", "#78716c");
  }
  irSensors.forEach((s) => addD(s.pin, trunc(s.name || `IR Sensor`), "#34d399"));
  joysticks.forEach((j) => {
    addA(j.xPin, trunc((j.name || "Joystick") + " VRx"), "#a78bfa");
    addA(j.yPin, trunc((j.name || "Joystick") + " VRy"), "#c084fc");
    if (j.buttonPin >= 0) addD(j.buttonPin, trunc((j.name || "Joystick") + " SW"), "#818cf8");
  });
  sipPuffs.forEach((s) => addA(s.analogPin, trunc(s.name || "Sip & Puff"), "#22d3ee"));

  const hasAny = right.length > 0 || left.length > 0 || leds.enabled;

  return (
    <svg viewBox="0 0 620 372" width="100%" xmlns="http://www.w3.org/2000/svg" style={{ maxHeight: 372 }}>
      {/* Board body */}
      <rect x={BX} y={BY} width={BW} height={BH} rx="7" fill="#0b1a10" stroke="#166534" strokeWidth="2" />
      <rect x={BX + 2} y={BY + 2} width={BW - 4} height={BH - 4} rx="6" fill="#0d2015" />

      {/* Board labels */}
      <text x={BX + BW / 2} y={BY + 16} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#4ade80" fontWeight="bold">Arduino</text>
      <text x={BX + BW / 2} y={BY + 28} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#16a34a">Leonardo</text>

      {/* Reset button */}
      <circle cx={BX + 20} cy={BY + 22} r={7} fill="none" stroke="#374151" strokeWidth="1.5" />
      <text x={BX + 20} y={BY + 26} textAnchor="middle" fontFamily="monospace" fontSize="6" fill="#4b5563">RST</text>

      {/* USB connector */}
      <rect x={BX + 30} y={BY + BH} width={50} height={20} rx="3" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />
      <text x={BX + 55} y={BY + BH + 13} textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#4b5563">USB</text>

      {/* ── Digital pin header bracket (right) */}
      <rect x={dpX} y={dpY(13) - 6} width={8} height={13 * 18 + 14} rx="2" fill="#1f2937" stroke="#374151" strokeWidth="1" />

      {Array.from({ length: 14 }, (_, i) => {
        const pin = 13 - i;
        const y = dpY(pin);
        const conn = right.find((c) => c.pin === pin);
        const used = !!conn;
        return (
          <g key={`d${pin}`}>
            <line x1={dpX + 8} y1={y} x2={dpX + 14} y2={y} stroke={used ? conn!.color : "#374151"} strokeWidth={used ? 1.5 : 1} />
            <circle cx={dpX + 14} cy={y} r={used ? 3.5 : 2} fill={used ? conn!.color : "#1f2937"} stroke={used ? conn!.color : "#4b5563"} strokeWidth="1" />
            <text x={dpX - 3} y={y + 3.5} textAnchor="end" fontFamily="monospace" fontSize="7" fill={used ? "#6b7280" : "#374151"}>D{pin}</text>
            {used && conn && (
              <>
                <line x1={dpX + 14} y1={y} x2={dpX + 40} y2={y} stroke={conn.color} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.85" />
                <text x={dpX + 44} y={y + 3.5} fontFamily="sans-serif" fontSize="9.5" fill={conn.color} fontWeight="500">{conn.label}</text>
              </>
            )}
          </g>
        );
      })}

      {/* ── Left header bracket */}
      <rect x={apX - 8} y={BY + 40} width={8} height={BH - 52} rx="2" fill="#1f2937" stroke="#374151" strokeWidth="1" />

      {/* 5V power */}
      <line x1={apX - 8} y1={BY + 52} x2={apX - 14} y2={BY + 52} stroke="#f87171" strokeWidth="1.5" />
      <circle cx={apX - 14} cy={BY + 52} r={3} fill="#f87171" />
      <text x={apX - 4} y={BY + 55.5} textAnchor="end" fontFamily="monospace" fontSize="7" fill="#6b7280">5V</text>
      <line x1={apX - 14} y1={BY + 52} x2={apX - 40} y2={BY + 52} stroke="#f87171" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" />
      <text x={apX - 44} y={BY + 55.5} textAnchor="end" fontFamily="sans-serif" fontSize="9.5" fill="#f87171">Power (VCC)</text>

      {/* GND power */}
      <line x1={apX - 8} y1={BY + 70} x2={apX - 14} y2={BY + 70} stroke="#9ca3af" strokeWidth="1.5" />
      <circle cx={apX - 14} cy={BY + 70} r={3} fill="#9ca3af" />
      <text x={apX - 4} y={BY + 73.5} textAnchor="end" fontFamily="monospace" fontSize="7" fill="#6b7280">GND</text>
      <line x1={apX - 14} y1={BY + 70} x2={apX - 40} y2={BY + 70} stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" />
      <text x={apX - 44} y={BY + 73.5} textAnchor="end" fontFamily="sans-serif" fontSize="9.5" fill="#9ca3af">Ground</text>

      {/* ── Analog pins (left) */}
      {Array.from({ length: 6 }, (_, pin) => {
        const y = apY(pin);
        const conn = left.find((c) => c.pin === pin);
        const used = !!conn;
        return (
          <g key={`a${pin}`}>
            <line x1={apX - 8} y1={y} x2={apX - 14} y2={y} stroke={used ? conn!.color : "#374151"} strokeWidth={used ? 1.5 : 1} />
            <circle cx={apX - 14} cy={y} r={used ? 3.5 : 2} fill={used ? conn!.color : "#1f2937"} stroke={used ? conn!.color : "#4b5563"} strokeWidth="1" />
            <text x={apX - 4} y={y + 3.5} textAnchor="end" fontFamily="monospace" fontSize="7" fill={used ? "#6b7280" : "#374151"}>A{pin}</text>
            {used && conn && (
              <>
                <line x1={apX - 14} y1={y} x2={apX - 40} y2={y} stroke={conn.color} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.85" />
                <text x={apX - 44} y={y + 3.5} textAnchor="end" fontFamily="sans-serif" fontSize="9.5" fill={conn.color} fontWeight="500">{conn.label}</text>
              </>
            )}
          </g>
        );
      })}

      {/* Empty state */}
      {!hasAny && (
        <text x={BX + BW / 2} y={BY + BH / 2 + 10} textAnchor="middle" fontFamily="sans-serif" fontSize="10" fill="#374151">
          Configure inputs to see wiring
        </text>
      )}
    </svg>
  );
}

// ─── Wiring Diagram Modal ─────────────────────────────────────────────────────

function WiringDiagramModal({ buttons, portInputs, leds, irSensors, sipPuffs, joysticks, onClose }: {
  buttons: ButtonConfig[];
  portInputs: PortConfig[];
  leds: LedConfig;
  irSensors: IRSensorConfig[];
  sipPuffs: SipPuffConfig[];
  joysticks: JoystickConfig[];
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const [showVCC, setShowVCC] = useState(false);
  const [showGND, setShowGND] = useState(false);
  const [showResistorInfo, setShowResistorInfo] = useState(false);
  const [componentInfo, setComponentInfo] = useState<{ type: string; label: string } | null>(null);

  const connNeedsVCC = (type: string) => ["ir", "sipPuff", "joystickX"].includes(type);
  const connNeedsGND = (type: string) => type !== "joystickY";

  const BX = 345, BY = 65, BW = 170, BH = 560;

  const digitalPinY = (pin: number) => BY + 81 + (13 - pin) * 34;
  const analogPinY = (pin: number) => BY + 291 + pin * 34;

  // Collect all right-side (digital) connections
  type RightConn = { pinY: number; color: string; label: string; type: "button" | "power" | "port" | "led" | "ir" | "swclick" };
  const rightConns: RightConn[] = [];

  buttons.forEach((b) => {
    if (!ALL_PINS.includes(b.pin)) return;
    rightConns.push({
      pinY: digitalPinY(b.pin),
      color: b.mode === "power" ? "#f59e0b" : "#60a5fa",
      label: b.name.slice(0, 15),
      type: b.mode === "power" ? "power" : "button",
    });
    if (b.ledPin && ALL_PINS.includes(b.ledPin)) {
      rightConns.push({
        pinY: digitalPinY(b.ledPin),
        color: "#fbbf24",
        label: (b.name + " LED").slice(0, 15),
        type: "led",
      });
    }
  });

  portInputs.forEach((p) => {
    if (!ALL_PINS.includes(p.pin)) return;
    rightConns.push({
      pinY: digitalPinY(p.pin),
      color: "#38bdf8",
      label: p.name.slice(0, 15),
      type: "port",
    });
  });

  if (leds.enabled) {
    if (leds.onPin && ALL_PINS.includes(leds.onPin)) {
      rightConns.push({ pinY: digitalPinY(leds.onPin), color: "#fbbf24", label: "LED (on)", type: "led" });
    }
    if (leds.offPin && ALL_PINS.includes(leds.offPin)) {
      rightConns.push({ pinY: digitalPinY(leds.offPin), color: "#fbbf24", label: "LED (off)", type: "led" });
    }
  }

  irSensors.forEach((ir) => {
    if (!ALL_PINS.includes(ir.pin)) return;
    rightConns.push({ pinY: digitalPinY(ir.pin), color: "#34d399", label: ir.name.slice(0, 15), type: "ir" });
  });

  joysticks.forEach((j) => {
    if (j.buttonPin && ALL_PINS.includes(j.buttonPin)) {
      rightConns.push({ pinY: digitalPinY(j.buttonPin), color: "#818cf8", label: (j.name + " SW").slice(0, 15), type: "swclick" });
    }
  });

  // Collect all left-side (analog) connections
  type LeftConn = { pinY: number; color: string; label: string; type: "sipPuff" | "joystickX" | "joystickY" };
  const leftConns: LeftConn[] = [];

  sipPuffs.forEach((s) => {
    if (ANALOG_PINS.includes(s.analogPin)) {
      leftConns.push({ pinY: analogPinY(s.analogPin), color: "#22d3ee", label: s.name.slice(0, 15), type: "sipPuff" });
    }
  });

  joysticks.forEach((j) => {
    if (ANALOG_PINS.includes(j.xPin)) {
      leftConns.push({ pinY: analogPinY(j.xPin), color: "#a78bfa", label: (j.name + " X").slice(0, 15), type: "joystickX" });
    }
    if (ANALOG_PINS.includes(j.yPin)) {
      leftConns.push({ pinY: analogPinY(j.yPin), color: "#c084fc", label: (j.name + " Y").slice(0, 15), type: "joystickY" });
    }
  });

  const hasAny = rightConns.length > 0 || leftConns.length > 0;

  // Left power pin labels/colors
  const leftPowerPins = [
    { label: "NC",    color: "#374151" },
    { label: "IOREF", color: "#374151" },
    { label: "RESET", color: "#ef4444" },
    { label: "+3V3",  color: "#f87171" },
    { label: "+5V",   color: "#f87171" },
    { label: "GND",   color: "#6b7280" },
    { label: "GND",   color: "#6b7280" },
    { label: "VIN",   color: "#f59e0b" },
  ];

  const usedDigitalPins = new Set(rightConns.map((c) => {
    // find which pin number yields this pinY
    for (const p of ALL_PINS) { if (digitalPinY(p) === c.pinY) return p; }
    return -1;
  }));
  const usedAnalogPins = new Set(leftConns.map((c) => {
    for (const p of ANALOG_PINS) { if (analogPinY(p) === c.pinY) return p; }
    return -1;
  }));

  // ── Physical-drawing style component icons ──────────────────────────────────

  function ButtonIcon({ cx, cy, color, isPower, onClick }: { cx: number; cy: number; color: string; isPower: boolean; onClick?: () => void }) {
    return (
      <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {/* PCB footprint / base plate */}
        <rect x={cx - 18} y={cy - 4} width="36" height="14" rx="2" fill="#111827" stroke="#374151" strokeWidth="1" />
        {/* 4 legs */}
        <line x1={cx - 12} y1={cy + 10} x2={cx - 12} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx - 5}  y1={cy + 10} x2={cx - 5}  y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx + 5}  y1={cy + 10} x2={cx + 5}  y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx + 12} y1={cy + 10} x2={cx + 12} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Button body (raised cylinder) */}
        <ellipse cx={cx} cy={cy - 4} rx="13" ry="5" fill="#1e3a5f" stroke={color} strokeWidth="1.5" />
        <ellipse cx={cx} cy={cy - 10} rx="13" ry="5" fill={isPower ? color : "#2563eb"} opacity={0.9} />
        <rect x={cx - 13} y={cy - 14} width="26" height="10" fill={isPower ? color : "#2563eb"} opacity={0.9} />
        {/* Cap sheen */}
        <ellipse cx={cx - 4} cy={cy - 13} rx="4" ry="2" fill="white" opacity={0.15} />
        {isPower && (
          <>
            {/* Power symbol on cap */}
            <circle cx={cx} cy={cy - 10} r="5" fill="none" stroke="white" strokeWidth="1.2" strokeDasharray="8 4" opacity={0.8} />
            <line x1={cx} y1={cy - 16} x2={cx} y2={cy - 12} stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
        {/* Label: "BTN" */}
        <text x={cx} y={cy + 32} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={color} fontWeight="600">{isPower ? "PWR" : "BTN"}</text>
      </g>
    );
  }

  function PortIcon({ cx, cy, color, onClick }: { cx: number; cy: number; color: string; onClick?: () => void }) {
    return (
      <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {/* Jack body - cylinder */}
        <rect x={cx - 20} y={cy - 8} width="40" height="16" rx="8" fill="#0a1520" stroke={color} strokeWidth="1.5" />
        {/* Tip opening */}
        <circle cx={cx + 20} cy={cy} r="5" fill="#020810" stroke={color} strokeWidth="1.5" />
        <circle cx={cx + 20} cy={cy} r="2.5" fill={color} opacity={0.6} />
        {/* Ring bands on barrel */}
        <line x1={cx + 6} y1={cy - 8} x2={cx + 6} y2={cy + 8} stroke={color} strokeWidth="1" opacity={0.5} />
        <line x1={cx + 2} y1={cy - 8} x2={cx + 2} y2={cy + 8} stroke={color} strokeWidth="1" opacity={0.3} />
        {/* Label */}
        <text x={cx - 6} y={cy + 22} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={color} fontWeight="600">3.5mm</text>
      </g>
    );
  }

  function LedIcon({ cx, cy, color, onClick }: { cx: number; cy: number; color: string; onClick?: () => void }) {
    return (
      <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {/* Anode lead (longer, left) */}
        <line x1={cx - 6} y1={cy + 10} x2={cx - 6} y2={cy + 22} stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Cathode lead (shorter, right) */}
        <line x1={cx + 6} y1={cy + 10} x2={cx + 6} y2={cy + 18} stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Flat plastic collar at base */}
        <rect x={cx - 10} y={cy + 4} width="20" height="6" rx="1" fill="#1a1a2e" stroke={color} strokeWidth="1.2" />
        {/* LED body cylinder */}
        <rect x={cx - 10} y={cy - 8} width="20" height="12" fill={color} opacity={0.75} />
        {/* Dome on top */}
        <ellipse cx={cx} cy={cy - 8} rx="10" ry="7" fill={color} opacity={0.85} />
        {/* Dome sheen / highlight */}
        <ellipse cx={cx - 3} cy={cy - 11} rx="4" ry="3" fill="white" opacity={0.25} />
        {/* Glow halo */}
        <ellipse cx={cx} cy={cy - 8} rx="14" ry="10" fill={color} opacity={0.08} />
        {/* Label */}
        <text x={cx} y={cy + 34} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={color} fontWeight="600">LED</text>
      </g>
    );
  }

  function IrIcon({ cx, cy, color, onClick }: { cx: number; cy: number; color: string; onClick?: () => void }) {
    return (
      <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {/* PCB board */}
        <rect x={cx - 24} y={cy - 9} width="48" height="18" rx="3" fill="#0a100a" stroke={color} strokeWidth="1.5" />
        {/* Receiver dome (dark) */}
        <ellipse cx={cx - 8} cy={cy} rx="7" ry="7" fill="#060c06" stroke={color} strokeWidth="1" />
        <ellipse cx={cx - 8} cy={cy} rx="4" ry="4" fill={color} opacity={0.2} />
        {/* Emitter dome */}
        <ellipse cx={cx + 8} cy={cy} rx="5" ry="5" fill="#080e08" stroke={color} strokeWidth="1" opacity={0.8} />
        {/* IR emission waves */}
        <path d={`M${cx + 15},${cy - 4} Q${cx + 22},${cy} ${cx + 15},${cy + 4}`} fill="none" stroke={color} strokeWidth="1.2" opacity={0.7} />
        <path d={`M${cx + 18},${cy - 7} Q${cx + 27},${cy} ${cx + 18},${cy + 7}`} fill="none" stroke={color} strokeWidth="1" opacity={0.45} />
        {/* 3 leads */}
        <line x1={cx - 14} y1={cy + 9} x2={cx - 14} y2={cy + 19} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx}     y1={cy + 9} x2={cx}     y2={cy + 19} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx + 14} y1={cy + 9} x2={cx + 14} y2={cy + 19} stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Label */}
        <text x={cx - 6} y={cy + 31} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={color} fontWeight="600">IR</text>
      </g>
    );
  }

  function SipPuffIcon({ cx, cy, color, onClick }: { cx: number; cy: number; color: string; onClick?: () => void }) {
    return (
      <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {/* Sensor body */}
        <rect x={cx - 22} y={cy - 10} width="44" height="20" rx="4" fill="#060f15" stroke={color} strokeWidth="1.5" />
        {/* Tube port on top */}
        <rect x={cx - 4} y={cy - 22} width="8" height="12" rx="4" fill="#040c12" stroke={color} strokeWidth="1.5" />
        {/* Tube opening circle */}
        <circle cx={cx} cy={cy - 22} r="3" fill="#020809" stroke={color} strokeWidth="1" />
        {/* Sensor chip detail */}
        <rect x={cx - 10} y={cy - 5} width="20" height="10" rx="2" fill="#0a1a24" stroke={color} strokeWidth="0.8" opacity={0.7} />
        {/* Leads */}
        <line x1={cx - 14} y1={cy + 10} x2={cx - 14} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx + 14} y1={cy + 10} x2={cx + 14} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Label */}
        <text x={cx} y={cy + 32} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={color} fontWeight="600">S&P</text>
      </g>
    );
  }

  function JoystickAxisIcon({ cx, cy, color, onClick }: { cx: number; cy: number; color: string; onClick?: () => void }) {
    return (
      <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {/* Module PCB */}
        <rect x={cx - 22} y={cy - 10} width="44" height="20" rx="3" fill="#1a0a2a" stroke={color} strokeWidth="1.5" />
        {/* Gimbal circle */}
        <circle cx={cx} cy={cy} r="8" fill="#120520" stroke={color} strokeWidth="1" />
        {/* Stick (angled) */}
        <line x1={cx} y1={cy} x2={cx - 5} y2={cy - 24} stroke={color} strokeWidth="3" strokeLinecap="round" />
        {/* Ball top */}
        <circle cx={cx - 5} cy={cy - 27} r="6" fill="#5b21b6" stroke={color} strokeWidth="1.5" />
        <ellipse cx={cx - 7} cy={cy - 30} rx="2.5" ry="1.5" fill="white" opacity={0.2} />
        {/* 5 pins at bottom */}
        {[-14, -7, 0, 7, 14].map((dx) => (
          <line key={dx} x1={cx + dx} y1={cy + 10} x2={cx + dx} y2={cy + 18} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        ))}
        {/* Label */}
        <text x={cx} y={cy + 30} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={color} fontWeight="600">JOY</text>
      </g>
    );
  }

  function SwClickIcon({ cx, cy, color, onClick }: { cx: number; cy: number; color: string; onClick?: () => void }) {
    return (
      <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        <rect x={cx - 18} y={cy - 4} width="36" height="14" rx="2" fill="#111827" stroke="#374151" strokeWidth="1" />
        <line x1={cx - 12} y1={cy + 10} x2={cx - 12} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx - 5}  y1={cy + 10} x2={cx - 5}  y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx + 5}  y1={cy + 10} x2={cx + 5}  y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx + 12} y1={cy + 10} x2={cx + 12} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <ellipse cx={cx} cy={cy - 4} rx="13" ry="5" fill="#1e3a5f" stroke={color} strokeWidth="1.5" />
        <ellipse cx={cx} cy={cy - 10} rx="13" ry="5" fill={color} opacity={0.9} />
        <rect x={cx - 13} y={cy - 14} width="26" height="10" fill={color} opacity={0.9} />
        <ellipse cx={cx - 4} cy={cy - 13} rx="4" ry="2" fill="white" opacity={0.15} />
        <text x={cx} y={cy + 32} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill={color} fontWeight="600">SW</text>
      </g>
    );
  }

  function ResistorIcon({ cx, cy, onClick }: { cx: number; cy: number; onClick: () => void }) {
    // Physical resistor: tan body, colored bands (Red-Red-Brown-Gold = 220Ω ±5%)
    return (
      <g onClick={onClick} style={{ cursor: "pointer" }}>
        {/* Highlight ring on hover target */}
        <rect x={cx - 12} y={cy - 8} width="24" height="16" rx="4" fill="transparent" stroke="#fbbf24" strokeWidth="0.8" opacity={0.35} />
        {/* Body */}
        <rect x={cx - 10} y={cy - 6} width="20" height="12" rx="3" fill="#d4b896" stroke="#a07850" strokeWidth="1" />
        {/* Color bands: Red Red Brown Gold */}
        <rect x={cx - 7}   y={cy - 6} width="3.5" height="12" fill="#cc2200" opacity={0.9} />
        <rect x={cx - 2}   y={cy - 6} width="3.5" height="12" fill="#cc2200" opacity={0.9} />
        <rect x={cx + 3}   y={cy - 6} width="3.5" height="12" fill="#5c2d00" opacity={0.9} />
        <rect x={cx + 7.5} y={cy - 6} width="2.5" height="12" fill="#ffd700" opacity={0.8} />
        {/* Ω label below */}
        <text x={cx} y={cy + 18} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#fbbf24" fontWeight="600">220Ω</text>
      </g>
    );
  }

  const RCX = 660; // right component center x
  const LCX = 185; // left component center x

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl max-h-[92vh] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-sm font-semibold text-gray-200">Wiring Diagram</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVCC((v) => !v)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors border ${
                showVCC
                  ? "bg-red-900/60 text-red-300 border-red-700"
                  : "bg-gray-800 text-gray-500 border-gray-700 hover:text-red-400"
              }`}
            >
              +5V
            </button>
            <button
              onClick={() => setShowGND((v) => !v)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors border ${
                showGND
                  ? "bg-gray-700 text-gray-200 border-gray-500"
                  : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
              }`}
            >
              GND
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* SVG Body */}
        <div className="flex-1 overflow-auto p-4">
          <svg
            viewBox="0 0 920 660"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: "100%", height: "auto", background: "#0a0f1a", borderRadius: 10 }}
          >
            {/* ── Background grid ── */}
            <defs>
              <pattern id="wdgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1f2937" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="920" height="660" fill="url(#wdgrid)" />

            {/* ── Arduino Leonardo Board ── */}
            {/* Outer PCB */}
            <rect x={BX} y={BY} width={BW} height={BH} rx="8" fill="#00696f" stroke="#004f52" strokeWidth="2" />
            {/* Inner PCB */}
            <rect x={BX + 6} y={BY + 6} width={BW - 12} height={BH - 12} rx="6" fill="#00797d" />

            {/* USB Micro connector at top */}
            <rect x={BX + 55} y={BY - 25} width="60" height="30" rx="4" fill="#1f2937" stroke="#374151" strokeWidth="1.5" />
            <rect x={BX + 62} y={BY - 20} width="46" height="20" rx="2" fill="#111827" />
            <text x={BX + 85} y={BY - 7} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#4b5563">USB</text>

            {/* ATmega32U4 chip */}
            <rect x={BX + 40} y={BY + 200} width="90" height="70" rx="4" fill="#111" stroke="#333" strokeWidth="1.5" />
            <text x={BX + 85} y={BY + 230} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#4b5563">ATmega</text>
            <text x={BX + 85} y={BY + 242} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#4b5563">32U4</text>
            {/* Pin stubs left side of chip */}
            {[0, 1, 2, 3].map((i) => (
              <line key={`cl${i}`} x1={BX + 40} y1={BY + 215 + i * 14} x2={BX + 34} y2={BY + 215 + i * 14} stroke="#333" strokeWidth="1.5" />
            ))}
            {/* Pin stubs right side of chip */}
            {[0, 1, 2, 3].map((i) => (
              <line key={`cr${i}`} x1={BX + 130} y1={BY + 215 + i * 14} x2={BX + 136} y2={BY + 215 + i * 14} stroke="#333" strokeWidth="1.5" />
            ))}

            {/* Reset button */}
            <circle cx={BX + 22} cy={BY + 60} r="8" fill="#cc2222" stroke="#991111" strokeWidth="1" />
            <circle cx={BX + 22} cy={BY + 60} r="4" fill="#ff4444" opacity={0.6} />

            {/* Power LED */}
            <circle cx={BX + 45} cy={BY + 60} r="4" fill="#00ff88" opacity={0.8} />

            {/* Crystal */}
            <rect x={BX + 62} y={BY + 60} width="18" height="8" rx="2" fill="#c8a800" stroke="#a07800" strokeWidth="1" />

            {/* Mounting holes */}
            {[
              [BX + 12, BY + 12], [BX + BW - 12, BY + 12],
              [BX + 12, BY + BH - 12], [BX + BW - 12, BY + BH - 12],
            ].map(([hx, hy], i) => (
              <g key={`mh${i}`}>
                <circle cx={hx} cy={hy} r="6" fill="#005f62" stroke="#004f52" strokeWidth="1.5" />
                <circle cx={hx} cy={hy} r="3" fill="#003f42" />
              </g>
            ))}

            {/* Board title */}
            <text x={BX + BW / 2} y={BY + 130} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#004f52" fontWeight="bold" letterSpacing="2">ARDUINO</text>
            <text x={BX + BW / 2} y={BY + 145} textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#004f52" letterSpacing="1">LEONARDO</text>

            {/* ── Right Pin Header Bracket ── */}
            <rect x={515} y={BY + 52} width="10" height="470" fill="#1f2937" stroke="#374151" strokeWidth="1" />

            {/* Right digital pins */}
            {ALL_PINS.concat([0, 1]).map((pin) => {
              const py = digitalPinY(pin);
              const conn = rightConns.find((c) => c.pinY === py);
              const color = conn ? conn.color : "#374151";
              return (
                <g key={`dp${pin}`}>
                  <circle cx={520} cy={py} r="3" fill={color} />
                  <text x={528} y={py + 4} fontFamily="monospace" fontSize="8" fill="#4b5563">D{pin}</text>
                </g>
              );
            })}

            {/* ── Left Power Header Bracket ── */}
            <rect x={335} y={BY + 52} width="10" height="216" fill="#1f2937" stroke="#374151" strokeWidth="1" />

            {/* Left power pins */}
            {leftPowerPins.map((pp, i) => {
              const py = BY + 55 + i * 26;
              return (
                <g key={`lpp${i}`}>
                  <circle cx={340} cy={py} r="3" fill={pp.color} />
                  <text x={332} y={py + 4} fontFamily="monospace" fontSize="8" fill="#4b5563" textAnchor="end">{pp.label}</text>
                </g>
              );
            })}

            {/* Left Analog Header Bracket */}
            <rect x={335} y={BY + 278} width="10" height="200" fill="#1f2937" stroke="#374151" strokeWidth="1" />

            {/* Analog pins */}
            {ANALOG_PINS.map((pin) => {
              const py = analogPinY(pin);
              const conn = leftConns.find((c) => c.pinY === py);
              const color = conn ? conn.color : "#374151";
              return (
                <g key={`ap${pin}`}>
                  <circle cx={340} cy={py} r="3" fill={color} />
                  <text x={332} y={py + 4} fontFamily="monospace" fontSize="8" fill="#4b5563" textAnchor="end">A{pin}</text>
                </g>
              );
            })}

            {/* ── Power Bus Bars ── */}
            {showVCC && rightConns.some((c) => connNeedsVCC(c.type)) && (
              <g>
                <line x1={845} y1={BY + 60} x2={845} y2={BY + 460} stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" />
                <text x={845} y={BY + 52} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#f87171">+5V</text>
              </g>
            )}
            {showGND && rightConns.some((c) => connNeedsGND(c.type)) && (
              <g>
                <line x1={860} y1={BY + 60} x2={860} y2={BY + 460} stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" />
                <text x={860} y={BY + 52} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#6b7280">GND</text>
              </g>
            )}
            {showVCC && leftConns.some((c) => connNeedsVCC(c.type)) && (
              <g>
                <line x1={50} y1={BY + 270} x2={50} y2={BY + 460} stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" />
                <text x={50} y={BY + 262} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#f87171">+5V</text>
              </g>
            )}
            {showGND && leftConns.some((c) => connNeedsGND(c.type)) && (
              <g>
                <line x1={35} y1={BY + 270} x2={35} y2={BY + 460} stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" />
                <text x={35} y={BY + 262} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#6b7280">GND</text>
              </g>
            )}

            {/* ── Wires + Components RIGHT side ── */}
            {rightConns.map((conn, idx) => {
              const cy = conn.pinY;
              const color = conn.color;
              return (
                <g key={`rc${idx}`}>
                  {/* Dashed signal wire (split around resistor for LEDs) */}
                  {conn.type === "led" ? (
                    <>
                      <line x1={520} y1={cy} x2={562} y2={cy} stroke={color} strokeWidth="1.5" strokeDasharray="5 3" opacity={0.8} />
                      <line x1={588} y1={cy} x2={630} y2={cy} stroke={color} strokeWidth="1.5" strokeDasharray="5 3" opacity={0.8} />
                      <ResistorIcon cx={575} cy={cy} onClick={() => setShowResistorInfo((v) => !v)} />
                    </>
                  ) : (
                    <line x1={520} y1={cy} x2={630} y2={cy} stroke={color} strokeWidth="1.5" strokeDasharray="5 3" opacity={0.8} />
                  )}
                  {/* VCC stub */}
                  {showVCC && connNeedsVCC(conn.type) && (
                    <line x1={RCX + 28} y1={cy - 8} x2={845} y2={cy - 8} stroke="#f87171" strokeWidth="1" strokeDasharray="4 3" opacity={0.6} />
                  )}
                  {/* GND stub */}
                  {showGND && connNeedsGND(conn.type) && (
                    <line x1={RCX + 28} y1={cy + 8} x2={860} y2={cy + 8} stroke="#6b7280" strokeWidth="1" strokeDasharray="4 3" opacity={0.6} />
                  )}
                  {/* Component icon */}
                  {conn.type === "button" && <ButtonIcon cx={RCX} cy={cy} color={color} isPower={false} onClick={() => setComponentInfo({ type: conn.type, label: conn.label })} />}
                  {conn.type === "power" && <ButtonIcon cx={RCX} cy={cy} color={color} isPower={true} onClick={() => setComponentInfo({ type: conn.type, label: conn.label })} />}
                  {conn.type === "port" && <PortIcon cx={RCX} cy={cy} color={color} onClick={() => setComponentInfo({ type: conn.type, label: conn.label })} />}
                  {conn.type === "led" && <LedIcon cx={RCX} cy={cy} color={color} onClick={() => setComponentInfo({ type: conn.type, label: conn.label })} />}
                  {conn.type === "ir" && <IrIcon cx={RCX} cy={cy} color={color} onClick={() => setComponentInfo({ type: conn.type, label: conn.label })} />}
                  {conn.type === "swclick" && <SwClickIcon cx={RCX} cy={cy} color={color} onClick={() => setComponentInfo({ type: conn.type, label: conn.label })} />}
                  {/* Label */}
                  <text x={RCX + 28} y={cy + 4} fontFamily="sans-serif" fontSize="9" fill={color} textAnchor="start">
                    {conn.label}
                  </text>
                </g>
              );
            })}

            {/* ── Wires + Components LEFT side ── */}
            {leftConns.map((conn, idx) => {
              const cy = conn.pinY;
              const color = conn.color;
              return (
                <g key={`lc${idx}`}>
                  {/* Dashed signal wire */}
                  <line x1={337} y1={cy} x2={215} y2={cy} stroke={color} strokeWidth="1.5" strokeDasharray="5 3" opacity={0.8} />
                  {/* VCC stub */}
                  {showVCC && connNeedsVCC(conn.type) && (
                    <line x1={LCX - 28} y1={cy - 8} x2={50} y2={cy - 8} stroke="#f87171" strokeWidth="1" strokeDasharray="4 3" opacity={0.6} />
                  )}
                  {/* GND stub */}
                  {showGND && connNeedsGND(conn.type) && (
                    <line x1={LCX - 28} y1={cy + 8} x2={35} y2={cy + 8} stroke="#6b7280" strokeWidth="1" strokeDasharray="4 3" opacity={0.6} />
                  )}
                  {/* Component icon */}
                  {conn.type === "sipPuff" && <SipPuffIcon cx={LCX} cy={cy} color={color} onClick={() => setComponentInfo({ type: conn.type, label: conn.label })} />}
                  {(conn.type === "joystickX" || conn.type === "joystickY") && (
                    <JoystickAxisIcon cx={LCX} cy={cy} color={color} onClick={() => setComponentInfo({ type: conn.type, label: conn.label })} />
                  )}
                  {/* Label */}
                  <text x={LCX - 28} y={cy + 4} fontFamily="sans-serif" fontSize="9" fill={color} textAnchor="end">
                    {conn.label}
                  </text>
                </g>
              );
            })}

            {/* ── Empty state ── */}
            {!hasAny && (
              <text x={430} y={295} textAnchor="middle" fontFamily="sans-serif" fontSize="13" fill="#374151">
                No components configured — add inputs to see wiring
              </text>
            )}

            {/* ── Notes strip ── */}
            <rect x={10} y={630} width={900} height={22} rx="4" fill="#111827" />
            <text x={20} y={645} fontFamily="sans-serif" fontSize="8.5" fill="#6b7280">
              Toggle +5V and GND in the header to show power connections. Sensors need +5V &amp; GND; buttons/LEDs need GND only.
            </text>
          </svg>
        </div>

        {/* ── Resistor Info Popup ── */}
        {showResistorInfo && (
          <div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-80 bg-gray-950 border border-yellow-700/50 rounded-xl shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-yellow-400">LED Series Resistor</span>
              <button
                onClick={() => setShowResistorInfo(false)}
                className="text-gray-500 hover:text-gray-200 p-0.5"
              >
                <X size={13} />
              </button>
            </div>

            {/* Resistor drawing */}
            <div className="flex justify-center mb-3">
              <svg width="230" height="64" viewBox="0 0 230 64">
                {/* Lead wires */}
                <line x1={8} y1={32} x2={52} y2={32} stroke="#fbbf24" strokeWidth="2.5" />
                <line x1={178} y1={32} x2={222} y2={32} stroke="#fbbf24" strokeWidth="2.5" />
                {/* Body */}
                <rect x={52} y={18} width="126" height="28" rx="5" fill="#d4b896" stroke="#a07850" strokeWidth="1.5" />
                {/* Bands: Red Red Brown Gold */}
                <rect x={68}  y={18} width="14" height="28" fill="#cc2200" opacity={0.9} rx="1" />
                <rect x={92}  y={18} width="14" height="28" fill="#cc2200" opacity={0.9} rx="1" />
                <rect x={116} y={18} width="14" height="28" fill="#5c2d00" opacity={0.9} rx="1" />
                <rect x={152} y={18} width="11" height="28" fill="#ffd700" opacity={0.85} rx="1" />
                {/* Band labels */}
                <text x={75}  y={60} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#ef4444">RED</text>
                <text x={99}  y={60} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#ef4444">RED</text>
                <text x={123} y={60} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#a07850">BRN</text>
                <text x={157} y={60} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#ffd700">GLD</text>
                {/* Lead labels */}
                <text x={5}  y={28} fontFamily="monospace" fontSize="8" fill="#9ca3af">+</text>
                <text x={218} y={28} fontFamily="monospace" fontSize="8" fill="#9ca3af">−</text>
              </svg>
            </div>

            {/* Value */}
            <div className="text-center mb-3">
              <span className="text-3xl font-bold text-yellow-400 tabular-nums">220Ω</span>
              <span className="text-xs text-gray-500 ml-2">±5% gold tolerance</span>
            </div>

            {/* Formula */}
            <div className="text-xs text-gray-400 bg-gray-900 rounded-lg p-2.5 space-y-1">
              <div className="font-mono">R = (V<sub>supply</sub> − V<sub>f</sub>) ÷ I<sub>LED</sub></div>
              <div className="font-mono">= (5V − 2V) ÷ 20mA = 150Ω min</div>
              <div className="pt-1 border-t border-gray-800 mt-1 space-y-0.5">
                <div className="text-yellow-400/80">220Ω → red / green / yellow LEDs</div>
                <div className="text-blue-400/80">100Ω → blue / white LEDs (V<sub>f</sub> ≈ 3.2V)</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Component Info Popup ── */}
        {componentInfo && (() => {
          const infoMap: Record<string, { title: string; desc: string; wiring: string }> = {
            button: {
              title: "Pushbutton",
              desc: "A momentary switch that sends a keypress while held down. Each press triggers the configured key on your computer.",
              wiring: "Wire one leg to the Arduino digital pin, other leg to GND. Uses INPUT_PULLUP — no resistor needed.",
            },
            power: {
              title: "Power Button",
              desc: "Toggles the entire controller on or off. While off, all inputs stop sending keys and Keyboard.releaseAll() is called immediately.",
              wiring: "Wired the same as a regular button: one leg to digital pin, other to GND. Uses INPUT_PULLUP.",
            },
            port: {
              title: "3.5mm Port",
              desc: "An external input jack for switches, sip & puff adapters, or other adapted devices using a standard 3.5mm audio cable.",
              wiring: "Tip → digital pin, Sleeve → GND. Uses INPUT_PULLUP — activates when tip is shorted to sleeve.",
            },
            led: {
              title: "LED",
              desc: "Lights up to show button state (pressed / toggled / power on). Always use a series resistor to limit current.",
              wiring: "Pin → 220Ω resistor → LED anode (+, longer leg). LED cathode (−, shorter leg) → GND.",
            },
            ir: {
              title: "IR Proximity Sensor",
              desc: "Detects objects in front of it using infrared light. Outputs LOW when an object is detected, HIGH otherwise.",
              wiring: "OUT → digital pin. Also needs +5V (VCC) and GND. No resistor needed on the signal wire.",
            },
            swclick: {
              title: "Joystick Click (SW)",
              desc: "The push-down button built into the joystick stick. Pressing the stick down activates it like a normal button.",
              wiring: "SW → digital pin with INPUT_PULLUP. GND on the joystick module goes to Arduino GND.",
            },
            sipPuff: {
              title: "Sip & Puff Sensor",
              desc: "A pressure transducer that detects breath. Sipping (inhale) and puffing (exhale) generate different analog voltage levels.",
              wiring: "OUT → analog pin (A0–A5). Needs +5V (VCC) and GND. The sketch reads the voltage to detect sip vs puff.",
            },
            joystickX: {
              title: "Joystick X-Axis (VRx)",
              desc: "A potentiometer tracking left/right movement of the stick. Outputs 0–5V based on position, read by an analog pin.",
              wiring: "VRx → analog pin. The full module also needs +5V (VCC) and GND connected.",
            },
            joystickY: {
              title: "Joystick Y-Axis (VRy)",
              desc: "A potentiometer tracking up/down movement of the stick. Shares the same physical module as the X-axis.",
              wiring: "VRy → analog pin. VCC and GND are shared with the X-axis — only one set of power wires needed.",
            },
          };
          const info = infoMap[componentInfo.type] ?? { title: componentInfo.label, desc: "Component info not available.", wiring: "" };
          return (
            <div
              className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-80 bg-gray-950 border border-gray-700 rounded-xl shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold text-gray-100">{info.title}</span>
                  {componentInfo.label && (
                    <span className="ml-2 text-xs text-gray-500 font-mono">{componentInfo.label}</span>
                  )}
                </div>
                <button
                  onClick={() => setComponentInfo(null)}
                  className="text-gray-500 hover:text-gray-200 p-0.5"
                >
                  <X size={13} />
                </button>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">{info.desc}</p>
              {info.wiring && (
                <div className="bg-gray-900 rounded-lg p-2.5">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Wiring</span>
                  <p className="text-xs text-gray-300 leading-relaxed">{info.wiring}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<"configure" | "test" | "info" | "admin">("configure");
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [buttons, setButtons] = useState<ButtonConfig[]>([
    { id: generateId(), name: "", pin: 2, keyDisplay: "", arduinoKey: "", mode: "momentary", ledPin: -1 },
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
  const [showWiring, setShowWiring] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("arduino_cli_dismissed") !== "1";
  });
  const [cliCheckState, setCliCheckState] = useState<"idle" | "checking" | "ok" | "missing">("idle");
  const [cliVersion, setCliVersion] = useState<string | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ show_ports: true, show_leds: true, show_upload: true, show_sensors: true, show_buttons: true });
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [shadowUser, setShadowUser] = useState<AppUser | null>(null);
  const [shadowSaves, setShadowSaves] = useState<SaveSlot[]>([]);
  const [shadowSaveIndex, setShadowSaveIndex] = useState(0);
  const [saving,    setSaving]    = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [currentSaveName, setCurrentSaveName] = useState("My Setup");
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [selectedGame, setSelectedGame] = useState<"dino" | "snake" | "pong">("dino");
  const [irSensors, setIrSensors] = useState<IRSensorConfig[]>([]);
  const [sipPuffs, setSipPuffs] = useState<SipPuffConfig[]>([]);
  const [joysticks, setJoysticks] = useState<JoystickConfig[]>([]);

  const logEndRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [uploadLog]);
  useEffect(() => { fetchPorts(); }, []);
  useEffect(() => {
    if (!showSaveMenu) return;
    const h = (e: MouseEvent) => { if (!saveMenuRef.current?.contains(e.target as Node)) setShowSaveMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showSaveMenu]);

  // ── Auth: restore from localStorage on mount, subscribe to admin settings ──
  useEffect(() => {
    // Restore session from localStorage
    try {
      const stored = localStorage.getItem("appUser");
      if (stored) {
        const u = JSON.parse(stored) as AppUser;
        setAppUser(u);
        loadAllSaves(u.id).then((allSaves) => {
          setSaves(allSaves);
          if (allSaves.length > 0) {
            const s = allSaves[0];
            setCurrentSaveId(s.id);
            setCurrentSaveName(s.name);
            const cfg = s.config;
            if (cfg.buttons)    setButtons(cfg.buttons as ButtonConfig[]);
            if (cfg.portInputs) setPortInputs(cfg.portInputs as PortConfig[]);
            if (cfg.leds)       setLeds(cfg.leds as LedConfig);
            if (cfg.irSensors)  setIrSensors(cfg.irSensors as IRSensorConfig[]);
            if (cfg.joysticks)  setJoysticks(cfg.joysticks as JoystickConfig[]);
          }
        });
      }
    } catch { /* ignore */ }
    setAuthReady(true);

    // Load admin settings — localStorage first (instant), then merge with Supabase
    // We merge so that missing Supabase columns (not yet added via SQL) don't wipe localStorage values
    let cached: AdminSettings | null = null;
    try {
      const raw = localStorage.getItem("adminSettings");
      if (raw) { cached = JSON.parse(raw) as AdminSettings; setAdminSettings(cached); }
    } catch { /* ignore */ }
    getAdminSettings().then((s) => {
      const merged: AdminSettings = {
        show_ports:   s.show_ports   ?? cached?.show_ports   ?? true,
        show_leds:    s.show_leds    ?? cached?.show_leds    ?? true,
        show_upload:  s.show_upload  ?? cached?.show_upload  ?? true,
        show_sensors: s.show_sensors ?? cached?.show_sensors ?? true,
        show_buttons: s.show_buttons ?? cached?.show_buttons ?? true,
      };
      setAdminSettings(merged);
      localStorage.setItem("adminSettings", JSON.stringify(merged));
    });

    // Realtime subscription: update settings instantly for all users
    const channel = supabase
      .channel("admin_settings_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_settings" },
        (payload) => {
          const s = payload.new as AdminSettings;
          const next = {
            show_ports: s.show_ports,
            show_leds: s.show_leds,
            show_upload: s.show_upload ?? true,
            show_sensors: s.show_sensors ?? true,
            show_buttons: s.show_buttons ?? true,
          };
          setAdminSettings(next);
          localStorage.setItem("adminSettings", JSON.stringify(next));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (!loginUsername.trim() || loginLoading) return;
    setLoginLoading(true);
    const u = await loginOrCreate(loginUsername);
    if (u) {
      localStorage.setItem("appUser", JSON.stringify(u));
      setAppUser(u);
      const allSaves = await loadAllSaves(u.id);
      setSaves(allSaves);
      if (allSaves.length > 0) {
        const s = allSaves[0];
        setCurrentSaveId(s.id);
        setCurrentSaveName(s.name);
        const cfg = s.config;
        if (cfg.buttons)    setButtons(cfg.buttons as ButtonConfig[]);
        if (cfg.portInputs) setPortInputs(cfg.portInputs as PortConfig[]);
        if (cfg.leds)       setLeds(cfg.leds as LedConfig);
        if (cfg.irSensors)  setIrSensors(cfg.irSensors as IRSensorConfig[]);
        if (cfg.joysticks)  setJoysticks(cfg.joysticks as JoystickConfig[]);
      }
      if (isAdmin(u.username)) {
        loadAllUsers().then(setAllUsers);
      }
    }
    setLoginLoading(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem("appUser");
    setAppUser(null);
    setSaves([]);
    setCurrentSaveId(null);
    setCurrentSaveName("My Setup");
    setShadowUser(null);
    setShadowSaves([]);
    if (tab === "admin") setTab("configure");
  };

  // ── Auto-save config 1.5 s after any change (only when logged in) ─────────
  useEffect(() => {
    if (!appUser) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const cfg = { buttons, portInputs, leds, irSensors, sipPuffs, joysticks };
      const newId = await upsertSave(appUser.id, currentSaveId, currentSaveName, cfg);
      if (newId && newId !== currentSaveId) {
        setCurrentSaveId(newId);
        setSaves((prev) => {
          const exists = prev.find((s) => s.id === newId);
          if (exists) return prev.map((s) => s.id === newId ? { ...s, name: currentSaveName, config: cfg, updated_at: new Date().toISOString() } : s);
          return [{ id: newId, name: currentSaveName, config: cfg, updated_at: new Date().toISOString() }, ...prev];
        });
      } else if (newId) {
        setSaves((prev) => prev.map((s) => s.id === newId ? { ...s, name: currentSaveName, config: cfg, updated_at: new Date().toISOString() } : s));
      }
      setSaving(false);
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [appUser, buttons, portInputs, leds, irSensors, sipPuffs, joysticks, currentSaveId, currentSaveName]);

  const fetchPorts = async () => {
    setLoadingPorts(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ports`);
      const data = await res.json();
      const portList = data.ports || [];
      setPorts(portList);
      if (portList.length > 0 && !selectedPort) {
        // Prefer Arduino-labeled or usbmodem ports over generic ones
        const best = portList.find((p: Port) => p.description?.toLowerCase().includes('arduino') || p.path?.includes('usbmodem')) ?? portList[0];
        setSelectedPort(best.path);
      }
    } catch { setPorts([]); }
    finally { setLoadingPorts(false); }
  };

  const usedPins = [
    ...buttons.map((b) => b.pin),
    ...buttons.filter((b) => b.ledPin >= 0).map((b) => b.ledPin),
    ...portInputs.map((p) => p.pin),
    ...portInputs.filter((p) => p.ledPin >= 0).map((p) => p.ledPin),
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
    setButtons((prev) => [...prev, { id: generateId(), name: "", pin: next, keyDisplay: "", arduinoKey: "", mode: "momentary", ledPin: -1 }]);
  };

  const addPort = () => {
    if (portInputs.length >= 4) return;
    const next = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
    setPortInputs((prev) => [...prev, { id: generateId(), name: "", pin: next, keyDisplay: "", arduinoKey: "", mode: "momentary", ledPin: -1 }]);
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

  const switchSave = (s: SaveSlot) => {
    setCurrentSaveId(s.id);
    setCurrentSaveName(s.name);
    const cfg = s.config;
    if (cfg.buttons)    setButtons(cfg.buttons as ButtonConfig[]);
    if (cfg.portInputs) setPortInputs(cfg.portInputs as PortConfig[]);
    if (cfg.leds)       setLeds(cfg.leds as LedConfig);
    if (cfg.irSensors)  setIrSensors(cfg.irSensors as IRSensorConfig[]);
    if (cfg.sipPuffs)   setSipPuffs(cfg.sipPuffs as SipPuffConfig[]);
    if (cfg.joysticks)  setJoysticks(cfg.joysticks as JoystickConfig[]);
    setShowSaveMenu(false);
  };

  const createNewSave = () => {
    setCurrentSaveId(null);
    setCurrentSaveName("New Setup");
    setButtons([{ id: generateId(), name: "", pin: 2, keyDisplay: "", arduinoKey: "", mode: "momentary", ledPin: -1 }]);
    setPortInputs([]); setLeds({ enabled: false, onPin: 11, offPin: 12 });
    setIrSensors([]); setSipPuffs([]); setJoysticks([]);
    setShowSaveMenu(false);
  };

  const handleDeleteSave = async (id: string) => {
    await deleteSave(id);
    const remaining = saves.filter((s) => s.id !== id);
    setSaves(remaining);
    if (currentSaveId === id) {
      if (remaining.length > 0) switchSave(remaining[0]);
      else createNewSave();
    }
  };

  const downloadSetup = () => {
    const cfg = { buttons, portInputs, leds, irSensors, sipPuffs, joysticks };
    const blob = new Blob([JSON.stringify({ name: currentSaveName, config: cfg }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentSaveName.replace(/[^a-z0-9]/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSetup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const cfg = parsed.config ?? parsed;
        if (cfg.buttons)    setButtons(cfg.buttons as ButtonConfig[]);
        if (cfg.portInputs) setPortInputs(cfg.portInputs as PortConfig[]);
        if (cfg.leds)       setLeds(cfg.leds as LedConfig);
        if (cfg.irSensors)  setIrSensors(cfg.irSensors as IRSensorConfig[]);
        if (cfg.sipPuffs)   setSipPuffs(cfg.sipPuffs as SipPuffConfig[]);
        if (cfg.joysticks)  setJoysticks(cfg.joysticks as JoystickConfig[]);
        if (parsed.name)    setCurrentSaveName(parsed.name);
      } catch { /* ignore bad files */ }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

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
          {/* Auth + Save Switcher */}
          {authReady && (
            appUser ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Save switcher */}
                <div className="relative" ref={saveMenuRef}>
                  <button
                    onClick={() => setShowSaveMenu((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-800/60 border border-gray-700 hover:border-gray-500 text-xs text-gray-300 hover:text-gray-100 transition-all max-w-[140px]"
                  >
                    <span className="truncate">{currentSaveName}</span>
                    <ChevronDown size={10} className="flex-shrink-0 text-gray-500" />
                  </button>
                  {showSaveMenu && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[200] overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-800">
                        <input
                          value={currentSaveName}
                          onChange={(e) => setCurrentSaveName(e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                          placeholder="Save name"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {saves.map((s) => (
                          <div key={s.id} className="flex items-center group">
                            <button
                              onClick={() => switchSave(s)}
                              className={["flex-1 text-left px-3 py-2 text-xs transition-colors truncate",
                                s.id === currentSaveId ? "bg-blue-600/20 text-blue-300" : "text-gray-300 hover:bg-gray-800"
                              ].join(" ")}
                            >{s.name}</button>
                            <button
                              onClick={() => handleDeleteSave(s.id)}
                              className="px-2 py-2 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                            ><Trash2 size={11} /></button>
                          </div>
                        ))}
                        {saves.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-600 italic">No saves yet</p>
                        )}
                      </div>
                      <div className="border-t border-gray-800">
                        <button
                          onClick={createNewSave}
                          className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
                        ><Plus size={11} /> New save</button>
                      </div>
                    </div>
                  )}
                </div>
                {saving && <span className="text-[10px] text-gray-600 hidden sm:block">saving…</span>}
                {!saving && <span className="text-[10px] text-green-600 hidden sm:block">saved</span>}
                {/* Download / Import */}
                <button onClick={downloadSetup} title="Download setup as file"
                  className="p-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-400 hover:text-gray-100 transition-all"
                ><Download size={13} /></button>
                <label title="Import setup from file" className="p-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-400 hover:text-gray-100 transition-all cursor-pointer">
                  <Upload size={13} />
                  <input type="file" accept=".json" className="hidden" onChange={importSetup} />
                </label>
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-800/60 border border-gray-700 rounded-xl">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[9px] font-bold">
                      {appUser.username[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-gray-300 hidden sm:block max-w-[100px] truncate">
                    {appUser.username}
                  </span>
                  <button onClick={handleSignOut} className="text-[10px] text-gray-600 hover:text-red-400 transition-colors ml-1">Sign out</button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                <input
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter username"
                  className="px-2.5 py-1.5 rounded-xl bg-gray-800/60 border border-gray-700 focus:border-blue-500 focus:outline-none text-xs text-gray-200 placeholder-gray-600 w-32 sm:w-36 transition-colors"
                />
                <button
                  type="submit"
                  disabled={loginLoading || !loginUsername.trim()}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors flex-shrink-0"
                >
                  {loginLoading ? "…" : "Login / Join"}
                </button>
              </form>
            )
          )}

          <div className="flex bg-gray-800/60 border border-gray-700 rounded-xl p-0.5 gap-0.5">
            <button onClick={() => setTab("configure")}
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "configure" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><Settings size={12} /> Configure</button>
            <button onClick={() => setTab("test")}
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "test" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><Gamepad2 size={12} /> Test</button>
            <button onClick={() => setTab("info")}
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "info" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><Info size={12} /> Info</button>
            {appUser && isAdmin(appUser.username) && (
              <button onClick={() => { setTab("admin"); loadAllUsers().then(setAllUsers); }}
                className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  tab === "admin" ? "bg-amber-700/60 text-amber-200" : "text-amber-600 hover:text-amber-400"].join(" ")}
              ><Settings size={12} /> Admin</button>
            )}
          </div>
        </div>
      </header>

      {/* ══ CONFIGURE TAB ══════════════════════════════════════════════════ */}
      {tab === "configure" && (
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ── setup banner ── */}
          {showSetupBanner && (
            <div className="flex-shrink-0 bg-amber-950/40 border-b border-amber-700/40 px-4 sm:px-6 py-2">
              <div className="max-w-[1400px] mx-auto flex items-center gap-3">
                <Terminal size={13} className="text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300 flex-1 min-w-0">
                  <span className="font-semibold">Need Arduino IDE?</span>
                  {" "}Download it free at{" "}
                  <a href="https://www.arduino.cc/en/software" target="_blank" rel="noreferrer" className="underline text-amber-200 hover:text-white">arduino.cc/en/software</a>
                  {" "}— use it to paste and upload the code this app generates.
                </p>
                <button
                  onClick={() => { setShowSetupBanner(false); localStorage.setItem("arduino_cli_dismissed", "1"); }}
                  className="p-0.5 text-amber-700 hover:text-amber-400 transition-colors flex-shrink-0"
                ><X size={13} /></button>
              </div>
            </div>
          )}

          {/* ── account banner ── */}
          {!appUser && authReady && (
            <div className="flex-shrink-0 bg-blue-950/40 border-b border-blue-700/40 px-4 sm:px-6 py-2.5">
              <div className="max-w-[1400px] mx-auto flex items-center gap-3">
                <span className="text-blue-400 flex-shrink-0 text-sm">👤</span>
                <p className="text-xs text-blue-300 flex-1 min-w-0">
                  <span className="font-semibold">Save your setup</span> — type a username in the top-right corner and click <span className="font-semibold">Login / Join</span> to create a free account. Your config auto-saves as you build.
                </p>
                <div className="flex-shrink-0 text-[11px] text-blue-500 hidden sm:block">↑ top right</div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
          <div className="h-full max-w-[1400px] mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Left column: Port + LEDs + Upload */}
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">

              {/* Get Code */}
              {adminSettings.show_upload && <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Code size={13} className="text-green-400" />
                  <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Get Code</h2>
                </div>
                <p className="text-xs text-gray-500 mb-3">Generate your Arduino sketch, then paste it into Arduino IDE to upload.</p>
                <div className="flex gap-2">
                  <button onClick={openSketch}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/30"
                  >
                    <Code size={14} /> View &amp; Copy Sketch
                  </button>
                  <button onClick={() => setShowWiring(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-yellow-700/50 bg-yellow-950/30 hover:bg-yellow-900/30 text-xs text-yellow-300 hover:text-yellow-100 transition-all"
                  >
                    <Zap size={13} /> Wiring Diagram
                  </button>
                </div>
              </section>}

              {/* LED Config */}
              {adminSettings.show_leds && <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={13} className="text-yellow-400" />
                  <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">LED Indicators</h2>
                  <button onClick={() => setShowLedInfo(true)}
                    className="p-0.5 rounded text-gray-600 hover:text-yellow-400 transition-colors"
                    title="LED wiring guide"
                  ><Info size={13} /></button>
                </div>

                {/* Power Button Status LEDs */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Power Button</span>
                    <div onClick={() => setLeds((l) => ({ ...l, enabled: !l.enabled }))}
                      className={["relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0",
                        leds.enabled ? "bg-blue-600" : "bg-gray-700"].join(" ")}
                    >
                      <div className={["absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        leds.enabled ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
                    </div>
                  </div>
                  {leds.enabled ? (
                    <div className="flex flex-col gap-2 pl-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)] flex-shrink-0" />
                        <PinSelect label="Power On" value={leds.onPin}
                          onChange={(v) => setLeds((l) => ({ ...l, onPin: v }))}
                          excludePins={usedPins.filter((p) => p !== leds.onPin)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)] flex-shrink-0" />
                        <PinSelect label="Power Off" value={leds.offPin}
                          onChange={(v) => setLeds((l) => ({ ...l, offPin: v }))}
                          excludePins={usedPins.filter((p) => p !== leds.offPin)} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 pl-1">Toggle on to add status LEDs linked to the power button.</p>
                  )}
                </div>

                {/* Per-button LEDs */}
                <div className="border-t border-gray-800 pt-3">
                  <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide block mb-2">Button LEDs</span>
                  {buttons.filter((b) => (b.ledPin ?? -1) >= 0).length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {buttons.filter((b) => (b.ledPin ?? -1) >= 0).map((b) => (
                        <div key={b.id} className="flex items-center gap-2 pl-1">
                          <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_5px_rgba(251,191,36,0.7)] flex-shrink-0" />
                          <span className="text-xs text-gray-300 flex-1 truncate">{b.name || "Button"}</span>
                          <span className="text-[10px] text-gray-500 font-mono bg-gray-800 px-1.5 py-0.5 rounded">D{b.ledPin}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 pl-1">Use the 💡 icon on a button card to assign an LED pin.</p>
                  )}
                </div>
              </section>}

              {/* Port Inputs */}
              {adminSettings.show_ports && <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-shrink-0">
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
              </section>}

              {/* ── Sensors ──────────────────────────────────────── */}
              {adminSettings.show_sensors && <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Radio size={13} className="text-emerald-400" />
                  <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Sensors</h2>
                  <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                    {irSensors.length + joysticks.length}
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
              </section>}
            </div>

            {/* Right column: Buttons */}
            {adminSettings.show_buttons && <section className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col overflow-hidden">
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
            </section>}
          </div>
          </div>
        </div>
      )}

      {/* ══ TEST TAB ═══════════════════════════════════════════════════════ */}
      {tab === "test" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">

            {/* ── Game area + selector ── */}
            <div className="flex gap-4 items-start">

              {/* Game canvas */}
              <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden min-w-0">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800">
                  <Gamepad2 size={14} className="text-purple-400" />
                  <h2 className="text-sm font-semibold text-gray-200">
                    {selectedGame === "dino" && "Dino Game"}
                    {selectedGame === "snake" && "Snake"}
                    {selectedGame === "pong" && "Pong"}
                  </h2>
                  <span className="text-xs text-gray-600 ml-1">
                    {selectedGame === "dino" && "↑ jump · ↓ duck"}
                    {selectedGame === "snake" && "↑↓←→ · WASD · joystick"}
                    {selectedGame === "pong" && "W/S or ↑/↓ to move"}
                  </span>
                </div>
                <div className="p-4">
                  {selectedGame === "dino" && <DinoGame jumpKeys={jumpKeys} />}
                  {selectedGame === "snake" && <SnakeGame joystickMaps={joystickMaps} />}
                  {selectedGame === "pong" && <PongGame joystickMaps={joystickMaps[0] ? { up: [joystickMaps[0].up], down: [joystickMaps[0].down] } : undefined} />}
                </div>
              </div>

              {/* Game selector */}
              <div className="w-44 flex-shrink-0 bg-gray-900 border border-gray-800 rounded-2xl p-3 flex flex-col gap-2">
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide px-1 mb-1">Games</p>
                {(
                  [
                    { id: "dino",  label: "Dino Game", emoji: "🦕", hint: "↑ jump  ↓ duck" },
                    { id: "snake", label: "Snake",     emoji: "🐍", hint: "Arrow keys / WASD" },
                    { id: "pong",  label: "Pong",      emoji: "🏓", hint: "W/S or ↑/↓" },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGame(g.id)}
                    className={[
                      "w-full text-left px-3 py-2.5 rounded-xl transition-all",
                      selectedGame === g.id
                        ? "bg-purple-600/20 border border-purple-600/40 text-purple-300"
                        : "border border-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{g.emoji}</span>
                      <span className="text-xs font-medium">{g.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1 pl-6">{g.hint}</p>
                  </button>
                ))}
              </div>
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

      {/* ══ ADMIN TAB ══════════════════════════════════════════════════════ */}
      {tab === "admin" && appUser && isAdmin(appUser.username) && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">

            <div className="flex items-center gap-2">
              <Settings size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-gray-200">Admin Panel</h2>
              <span className="text-xs text-gray-600">jacob.majors</span>
            </div>

            {/* Global section toggles */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Global Section Visibility</h3>
              <p className="text-xs text-gray-600 mb-4">These toggles affect ALL users in real-time.</p>
              <div className="flex flex-col gap-3">
                {/* show_leds toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-200">LED Indicators section</span>
                    <p className="text-xs text-gray-600">Show/hide the LED section for all users</p>
                  </div>
                  <div
                    onClick={async () => {
                      const next = !adminSettings.show_leds;
                      setAdminSettings((s) => { const n = { ...s, show_leds: next }; localStorage.setItem("adminSettings", JSON.stringify(n)); return n; });
                      await updateAdminSettings({ show_leds: next });
                    }}
                    className={["relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0",
                      adminSettings.show_leds ? "bg-blue-600" : "bg-gray-700"].join(" ")}
                  >
                    <div className={["absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      adminSettings.show_leds ? "translate-x-5" : "translate-x-1"].join(" ")} />
                  </div>
                </div>
                {/* show_ports toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-200">Back Panel Ports section</span>
                    <p className="text-xs text-gray-600">Show/hide the 3.5mm ports section for all users</p>
                  </div>
                  <div
                    onClick={async () => {
                      const next = !adminSettings.show_ports;
                      setAdminSettings((s) => { const n = { ...s, show_ports: next }; localStorage.setItem("adminSettings", JSON.stringify(n)); return n; });
                      await updateAdminSettings({ show_ports: next });
                    }}
                    className={["relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0",
                      adminSettings.show_ports ? "bg-blue-600" : "bg-gray-700"].join(" ")}
                  >
                    <div className={["absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      adminSettings.show_ports ? "translate-x-5" : "translate-x-1"].join(" ")} />
                  </div>
                </div>
                {/* show_upload toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-200">Upload to Arduino section</span>
                    <p className="text-xs text-gray-600">Show/hide the port select and upload controls</p>
                  </div>
                  <div
                    onClick={async () => {
                      const next = !adminSettings.show_upload;
                      setAdminSettings((s) => { const n = { ...s, show_upload: next }; localStorage.setItem("adminSettings", JSON.stringify(n)); return n; });
                      await updateAdminSettings({ show_upload: next });
                    }}
                    className={["relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0",
                      adminSettings.show_upload ? "bg-blue-600" : "bg-gray-700"].join(" ")}
                  >
                    <div className={["absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      adminSettings.show_upload ? "translate-x-5" : "translate-x-1"].join(" ")} />
                  </div>
                </div>
                {/* show_sensors toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-200">Sensors section</span>
                    <p className="text-xs text-gray-600">Show/hide IR sensors and joystick configuration</p>
                  </div>
                  <div
                    onClick={async () => {
                      const next = !adminSettings.show_sensors;
                      setAdminSettings((s) => { const n = { ...s, show_sensors: next }; localStorage.setItem("adminSettings", JSON.stringify(n)); return n; });
                      await updateAdminSettings({ show_sensors: next });
                    }}
                    className={["relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0",
                      adminSettings.show_sensors ? "bg-blue-600" : "bg-gray-700"].join(" ")}
                  >
                    <div className={["absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      adminSettings.show_sensors ? "translate-x-5" : "translate-x-1"].join(" ")} />
                  </div>
                </div>
                {/* show_buttons toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-200">Configure Buttons section</span>
                    <p className="text-xs text-gray-600">Show/hide the main button configuration panel</p>
                  </div>
                  <div
                    onClick={async () => {
                      const next = !adminSettings.show_buttons;
                      setAdminSettings((s) => { const n = { ...s, show_buttons: next }; localStorage.setItem("adminSettings", JSON.stringify(n)); return n; });
                      await updateAdminSettings({ show_buttons: next });
                    }}
                    className={["relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0",
                      adminSettings.show_buttons ? "bg-blue-600" : "bg-gray-700"].join(" ")}
                  >
                    <div className={["absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      adminSettings.show_buttons ? "translate-x-5" : "translate-x-1"].join(" ")} />
                  </div>
                </div>
              </div>
            </div>

            {/* User list + shadow view */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Users ({allUsers.length})
              </h3>
              {allUsers.length === 0 ? (
                <p className="text-xs text-gray-600">No users yet.</p>
              ) : (
                <div className="flex flex-col gap-1 mb-4">
                  {allUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={async () => {
                        if (shadowUser?.id === u.id) { setShadowUser(null); setShadowSaves([]); return; }
                        setShadowUser(u);
                        const saves = await loadAllSaves(u.id);
                        setShadowSaves(saves);
                        setShadowSaveIndex(0);
                      }}
                      className={[
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all",
                        shadowUser?.id === u.id
                          ? "bg-amber-600/20 border border-amber-600/40 text-amber-300"
                          : "hover:bg-gray-800 text-gray-300",
                      ].join(" ")}
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[9px] font-bold">{u.username[0].toUpperCase()}</span>
                      </div>
                      <span className="text-xs font-medium">{u.username}</span>
                      {u.username === ADMIN_USERNAME && (
                        <span className="text-[10px] text-amber-500 font-semibold ml-auto">ADMIN</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Shadow view */}
              {shadowUser && shadowSaves.length > 0 && (
                <div className="border-t border-gray-800 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-amber-400">Viewing: {shadowUser.username}</span>
                    {shadowSaves.length > 1 && (
                      <select
                        value={shadowSaveIndex}
                        onChange={(e) => setShadowSaveIndex(parseInt(e.target.value))}
                        className="ml-auto appearance-none bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
                      >
                        {shadowSaves.map((s, i) => (
                          <option key={s.id} value={i}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {(() => {
                    const save = shadowSaves[shadowSaveIndex];
                    if (!save) return null;
                    const cfg = save.config;
                    const btns = (cfg.buttons ?? []) as ButtonConfig[];
                    const ports = (cfg.portInputs ?? []) as PortConfig[];
                    return (
                      <div className="space-y-3">
                        <div className="bg-gray-950 rounded-xl p-3">
                          <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-2">Buttons ({btns.length})</p>
                          {btns.length === 0 ? <p className="text-xs text-gray-700">None</p> : (
                            <div className="flex flex-col gap-1">
                              {btns.map((b) => (
                                <div key={b.id} className="flex items-center gap-2 text-xs">
                                  <span className="font-mono text-blue-400 w-8">D{b.pin}</span>
                                  <span className="text-gray-300">{b.name || "(unnamed)"}</span>
                                  <span className="text-gray-600 ml-auto">[{b.keyDisplay || b.arduinoKey || "—"}]</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${b.mode === "power" ? "bg-amber-900/40 text-amber-400" : "bg-gray-800 text-gray-500"}`}>{b.mode}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {ports.length > 0 && (
                          <div className="bg-gray-950 rounded-xl p-3">
                            <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-2">Port Inputs ({ports.length})</p>
                            <div className="flex flex-col gap-1">
                              {ports.map((p) => (
                                <div key={p.id} className="flex items-center gap-2 text-xs">
                                  <span className="font-mono text-sky-400 w-8">D{p.pin}</span>
                                  <span className="text-gray-300">{p.name || "(unnamed)"}</span>
                                  <span className="text-gray-600 ml-auto">[{p.keyDisplay || p.arduinoKey || "—"}]</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              {shadowUser && shadowSaves.length === 0 && (
                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs text-gray-600">No saves for {shadowUser.username} yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ INFO TAB ═══════════════════════════════════════════════════════ */}
      {tab === "info" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

            {/* ── Made by Jacob ── */}
            <div className="relative bg-gradient-to-br from-blue-950/60 to-purple-950/60 border border-blue-700/30 rounded-2xl p-6 overflow-hidden">
              <div className="absolute inset-0 rounded-2xl" style={{
                background: "radial-gradient(ellipse at 70% 20%, rgba(59,130,246,0.12) 0%, transparent 60%)",
                pointerEvents: "none",
              }} />
              <div className="relative flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-900/40 flex-shrink-0">
                  <span className="text-white text-2xl font-black">J</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-100">Made by Jacob Majors</h2>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    Arduino Button Mapper was built to make adaptive controller programming
                    accessible — no Arduino IDE required. Configure buttons, sensors, and
                    input devices visually, then upload directly to your Arduino Leonardo
                    with one click.
                  </p>
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-blue-950/50 border border-blue-800/40 rounded-xl w-fit">
                    <Zap size={11} className="text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-blue-300 font-medium">
                      Developed for Ramsey Mussalum&apos;s <span className="text-white">Design for Social Good</span> class
                    </span>
                  </div>
                  <a
                    href="https://github.com/jacob-majors/Arduino-Button-Mapper"
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink size={11} />
                    github.com/jacob-majors/Arduino-Button-Mapper
                  </a>
                </div>
              </div>
            </div>

            {/* ── How to connect ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Usb size={14} className="text-green-400" />
                <h3 className="text-sm font-semibold text-gray-200">How to Use This App</h3>
              </div>

              {/* Just use the website */}
              <div className="mb-4 px-3 py-2.5 bg-green-950/30 border border-green-800/40 rounded-xl">
                <p className="text-xs text-green-300 font-medium mb-0.5">Just open the website — no setup needed</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Configure your inputs, assign keys, preview the sketch, and save your setup. All of this works in the browser with no installation required.
                </p>
              </div>

              {/* Uploading to Arduino needs the backend */}
              <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                To actually <span className="text-gray-400">flash the sketch onto your Arduino</span>, you need the local backend running on your computer. Browsers can&apos;t access USB directly, so a small local server handles the compile and upload.
              </p>

              <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold mb-3">One-time setup for uploading</p>
              <ol className="space-y-4">
                {([
                  {
                    n: 1, title: "Install arduino-cli",
                    body: "Download from arduino.cc/en/software and add it to your PATH. Then install the Leonardo core:",
                    code: "arduino-cli core install arduino:avr",
                  },
                  {
                    n: 2, title: "Run the local backend",
                    body: "Open a terminal in the project folder and start the server:",
                    code: "cd backend && node server.js",
                    note: "Keep this running whenever you want to upload. It listens on port 3001.",
                  },
                  {
                    n: 3, title: "Plug in your Arduino Leonardo",
                    body: "Use a USB data cable — not a charge-only cable. The port appears in the dropdown at the top of the Configure tab. Hit refresh if it doesn't show up.",
                  },
                  {
                    n: 4, title: "Click Upload",
                    body: "The app generates the Arduino sketch, compiles it with arduino-cli, and flashes it to the board over USB. Watch the log for errors. Once done, press your inputs to confirm the right keys are sent.",
                  },
                ] as { n: number; title: string; body: string; code?: string; note?: string }[]).map(({ n, title, body, code, note }) => (
                  <li key={n} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-400 text-[10px] font-bold">{n}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{body}</p>
                      {code && (
                        <code className="inline-block mt-1.5 px-2.5 py-1 bg-gray-950 border border-gray-700 rounded-lg text-[11px] text-green-400 font-mono">{code}</code>
                      )}
                      {note && <p className="text-[11px] text-gray-600 mt-1 italic">{note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* ── How code generation works ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Code size={14} className="text-yellow-400" />
                <h3 className="text-sm font-semibold text-gray-200">How the Code is Generated</h3>
              </div>
              <div className="space-y-4 text-sm text-gray-400 leading-relaxed">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Everything you configure is translated into a single Arduino{" "}
                  <span className="text-yellow-300 font-mono">.ino</span> sketch by{" "}
                  <span className="text-gray-300 font-mono">generateSketch()</span> in{" "}
                  <span className="text-yellow-300 font-mono">src/lib/keymap.ts</span>.
                  No code is stored on a server — it is generated in your browser on demand.
                  Click <span className="text-gray-200 font-medium">Sketch</span> in the Configure tab to preview the full output before uploading.
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: "Buttons & ports", color: "text-blue-400", desc: "Each input maps to a digital pin, a key, and a mode. Momentary holds the key while pressed; Toggle alternates on/off each press. Uses INPUT_PULLUP wiring with 20 ms debounce." },
                    { label: "Power button", color: "text-amber-400", desc: "One button can be set as a power toggle. It flips a systemActive flag — when off, all other inputs stop sending keys and Keyboard.releaseAll() is called immediately." },
                    { label: "LED indicators", color: "text-yellow-400", desc: "Two digital output pins — one goes HIGH when the system is active, the other when off. Wire each through a 220Ω resistor to an LED." },
                    { label: "IR sensors", color: "text-emerald-400", desc: "Digital inputs with configurable active polarity (HIGH=on or LOW=on). Most IR proximity modules pull output LOW when triggered, so LOW=on is the default." },
                    { label: "Sip & puff", color: "text-cyan-400", desc: "An analog pressure sensor on A0–A5. analogRead() returns 0–1023. Values below the sip threshold press one key; values above the puff threshold press another; in between releases both." },
                    { label: "Joystick", color: "text-violet-400", desc: "Two analog axes read via analogRead(). Center is 512 — if deviation from center exceeds the deadzone, the matching direction key is pressed. Optional click button uses a digital pin with INPUT_PULLUP." },
                  ].map(({ label, color, desc }) => (
                    <div key={label} className="flex gap-2.5">
                      <span className={`${color} font-semibold w-28 flex-shrink-0 text-xs mt-0.5`}>{label}</span>
                      <span className="text-gray-500 text-xs leading-relaxed">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Tech stack ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Terminal size={14} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-gray-200">How This Was Built</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Next.js 14", tag: "Frontend", color: "text-blue-400", desc: "App Router, React, TypeScript" },
                  { name: "Tailwind CSS", tag: "Styling", color: "text-cyan-400", desc: "Utility-first, dark theme" },
                  { name: "Supabase", tag: "Auth + DB", color: "text-emerald-400", desc: "Google login + save slots" },
                  { name: "Express.js", tag: "Backend", color: "text-green-400", desc: "Local server on port 3001" },
                  { name: "arduino-cli", tag: "Compiler", color: "text-yellow-400", desc: "Compile + upload over USB" },
                  { name: "Canvas API", tag: "Games", color: "text-purple-400", desc: "Dino + Snake, no sprites" },
                  { name: "SSE stream", tag: "Upload log", color: "text-orange-400", desc: "Real-time compile output" },
                  { name: "Claude AI", tag: "Coded with", color: "text-indigo-400", desc: "AI-assisted development" },
                ].map(({ name, tag, color, desc }) => (
                  <div key={name} className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${color}`}>{name}</span>
                      <span className="text-[9px] text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded-full border border-gray-700">{tag}</span>
                    </div>
                    <p className="text-[11px] text-gray-500">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Footer credit ── */}
            <p className="text-center text-xs text-gray-700 pb-2">
              Arduino Button Mapper · Jacob Majors · Design for Social Good · Open source on GitHub
            </p>

          </div>
        </div>
      )}

      {/* Sketch modal */}
      {showSketch && sketchCode && (
        <SketchModal code={sketchCode} onClose={() => setShowSketch(false)} />
      )}

      {/* LED info modal */}
      {showLedInfo && <LedInfoModal onClose={() => setShowLedInfo(false)} />}

      {/* Wiring diagram modal */}
      {showWiring && (
        <WiringDiagramModal
          buttons={buttons} portInputs={portInputs} leds={leds}
          irSensors={irSensors} sipPuffs={sipPuffs} joysticks={joysticks}
          onClose={() => setShowWiring(false)}
        />
      )}
    </div>
  );
}
