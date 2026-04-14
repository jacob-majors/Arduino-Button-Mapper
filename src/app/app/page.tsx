"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Zap, RefreshCw, Plus, Trash2, X, Upload, ChevronDown,
  Loader2, CheckCircle2, XCircle, Terminal, Usb, Keyboard,
  RotateCcw, Pencil, Gamepad2, Settings, Lightbulb, Power, Code,
  Info, ExternalLink, Radio, Wind, Joystick, Minimize2, Maximize2, Download, Star, Square,
  AlertCircle, MessageSquare, CheckCheck, Clock, Ban,
} from "lucide-react";
import {
  ButtonConfig, ButtonMode, LedConfig, PortConfig,
  IRSensorConfig, SipPuffConfig, JoystickConfig,
  resolveKey, generateSketch,
} from "@/lib/keymap";
import { compileAndUpload } from "@/lib/avr-upload";
import DinoGame from "@/components/DinoGame";
import SnakeGame from "@/components/SnakeGame";
import PongGame from "@/components/PongGame";
import DeviceMockup from "@/components/DeviceMockup";
import ControllerMockup from "@/components/ControllerMockup";
import RemapModal, { type RemapEntry } from "@/components/RemapModal";
import TutorialOverlay, { TUTORIAL_STEPS } from "@/components/TutorialOverlay";
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
  deleteUser,
  isAdmin,
  ADMIN_USERNAME,
  submitDinoScore,
  getTopDinoScores,
  saveSharedSetup,
  loadSharedSetup,
  loadDbTemplates,
  upsertDbTemplate,
  deleteDbTemplate,
  updateLastActive,
  submitIssue,
  loadAllIssues,
  updateIssueStatus,
  deleteIssue,
} from "@/lib/supabase";
import type { SaveSlot, AppUser, AdminSettings, DinoScore, DbTemplate, Issue } from "@/lib/supabase";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
const ALL_PINS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const ANALOG_PINS = [0, 1, 2, 3, 4, 5]; // A0–A5

// ─── Board Templates ──────────────────────────────────────────────────────────
const BOARD_TEMPLATES = [
  {
    id: "one-switch",
    label: "Project 1",
    emoji: "🎯",
    desc: "Micro Switch → Space, Joystick → WASD, IR Sensor → E, Sip & Puff → F.",
    buttons: [{ id: "t1", name: "Micro Switch", pin: 2, keyDisplay: "Space", arduinoKey: " ", mode: "momentary" as const, ledPin: -1, ledMode: "active" as const }],
    portInputs: [],
    irSensors: [{ id: "ti1", name: "IR Sensor", pin: 6, keyDisplay: "E", arduinoKey: "e", mode: "momentary" as const, activeHigh: false, ledPin: -1, ledMode: "active" as const }],
    sipPuffs: [{ id: "tsp1", name: "Sip & Puff", pin: 7, key: "f", keyDisplay: "F", ledPin: -1, ledMode: "active" as const, inputMode: "hold" as const }],
    joysticks: [{
      id: "tj1", name: "Joystick", xPin: 0, yPin: 1, buttonPin: -1,
      upKey: "w", upDisplay: "W", downKey: "s", downDisplay: "S",
      leftKey: "a", leftDisplay: "A", rightKey: "d", rightDisplay: "D",
      buttonKey: "", buttonDisplay: "", deadzone: 200, invertX: false, invertY: false,
      ledPin: -1, ledMode: "active" as const,
    }],
    leds: { enabled: false, onPin: 11, offPin: 12 },
  },
  {
    id: "4btn-gaming",
    label: "4-Button Pad",
    emoji: "🎮",
    desc: "A / B / X / Y face buttons on pins 2–5.",
    buttons: [
      { id: "t1", name: "A", pin: 2, keyDisplay: "Z", arduinoKey: "z", mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t2", name: "B", pin: 3, keyDisplay: "X", arduinoKey: "x", mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t3", name: "X", pin: 4, keyDisplay: "A", arduinoKey: "a", mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t4", name: "Y", pin: 5, keyDisplay: "S", arduinoKey: "s", mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
    ],
    portInputs: [], irSensors: [], sipPuffs: [], joysticks: [],
    leds: { enabled: false, onPin: 11, offPin: 12 },
  },
  {
    id: "arrow-keys",
    label: "Arrow Keys",
    emoji: "⬆️",
    desc: "4 buttons mapped to arrow keys on pins 2–5.",
    buttons: [
      { id: "t1", name: "Up",    pin: 2, keyDisplay: "↑", arduinoKey: "KEY_UP_ARROW",    mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t2", name: "Down",  pin: 3, keyDisplay: "↓", arduinoKey: "KEY_DOWN_ARROW",  mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t3", name: "Left",  pin: 4, keyDisplay: "←", arduinoKey: "KEY_LEFT_ARROW",  mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t4", name: "Right", pin: 5, keyDisplay: "→", arduinoKey: "KEY_RIGHT_ARROW", mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
    ],
    portInputs: [], irSensors: [], sipPuffs: [], joysticks: [],
    leds: { enabled: false, onPin: 11, offPin: 12 },
  },
  {
    id: "joystick-wasd",
    label: "Joystick WASD",
    emoji: "🕹️",
    desc: "Analog joystick → WASD + Space jump.",
    buttons: [
      { id: "t1", name: "Jump", pin: 2, keyDisplay: "Space", arduinoKey: " ", mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
    ],
    portInputs: [], irSensors: [], sipPuffs: [],
    joysticks: [{
      id: "tj1", name: "Stick", xPin: 0, yPin: 1, buttonPin: -1,
      upKey: "w", upDisplay: "W", downKey: "s", downDisplay: "S",
      leftKey: "a", leftDisplay: "A", rightKey: "d", rightDisplay: "D",
      buttonKey: "", buttonDisplay: "", deadzone: 200, invertX: false, invertY: false,
      ledPin: -1, ledMode: "active" as const,
    }],
    leds: { enabled: false, onPin: 11, offPin: 12 },
  },
  {
    id: "sip-puff",
    label: "Sip & Puff",
    emoji: "💨",
    desc: "Sip = Left Arrow, Puff = Right Arrow. Mouth-operated switch.",
    buttons: [],
    portInputs: [], irSensors: [],
    sipPuffs: [{ id: "tsp1", name: "Sip & Puff", pin: 2, key: "KEY_LEFT_ARROW", keyDisplay: "←", ledPin: -1, ledMode: "active" as const, inputMode: "hold" as const }],
    joysticks: [],
    leds: { enabled: false, onPin: 11, offPin: 12 },
  },
  {
    id: "media",
    label: "Media Keys",
    emoji: "🎵",
    desc: "5 buttons: Play, Vol+, Vol–, Next, Prev.",
    buttons: [
      { id: "t1", name: "Play/Pause", pin: 2, keyDisplay: "Space", arduinoKey: " ",         mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t2", name: "Vol +",      pin: 3, keyDisplay: "↑",     arduinoKey: "KEY_UP_ARROW",    mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t3", name: "Vol –",      pin: 4, keyDisplay: "↓",     arduinoKey: "KEY_DOWN_ARROW",  mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t4", name: "Next",       pin: 5, keyDisplay: "→",     arduinoKey: "KEY_RIGHT_ARROW", mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
      { id: "t5", name: "Prev",       pin: 6, keyDisplay: "←",     arduinoKey: "KEY_LEFT_ARROW",  mode: "momentary" as const, ledPin: -1, ledMode: "active" as const },
    ],
    portInputs: [], irSensors: [], sipPuffs: [], joysticks: [],
    leds: { enabled: false, onPin: 11, offPin: 12 },
  },
];

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

// ─── LED Panel ────────────────────────────────────────────────────────────────

const LED_MODES = [
  { value: "active", label: "While Active", desc: "On when input is pressed/triggered" },
  { value: "always", label: "Always On", desc: "LED stays on constantly" },
];

function LedPanel({ ledPin, ledMode, usedPins, onUpdate }: {
  ledPin: number;
  ledMode: "active" | "always";
  usedPins: number[];
  onUpdate: (pin: number, mode: "active" | "always") => void;
}) {
  const availablePins = ALL_PINS.filter((p) => p === ledPin || !usedPins.includes(p));

  if (ledPin < 0) {
    const nextPin = availablePins[0] ?? -1;
    return (
      <div className="mt-2 pt-2 border-t border-gray-700/50">
        <button
          onClick={(e) => { e.stopPropagation(); if (nextPin >= 0) onUpdate(nextPin, "active"); }}
          disabled={nextPin < 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-600 hover:border-yellow-600/60 hover:bg-yellow-950/20 text-gray-500 hover:text-yellow-400 text-[11px] transition-all disabled:opacity-30 w-full justify-center"
        >
          <Lightbulb size={11} /> Add LED
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-yellow-900/30" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_5px_rgba(251,191,36,0.8)]" />
        <span className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider">LED</span>
        <button
          onClick={() => onUpdate(-1, "active")}
          className="ml-auto p-0.5 text-gray-600 hover:text-red-400 transition-colors"
        ><X size={10} /></button>
      </div>
      <div className="flex gap-2 items-center mb-2">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0">Pin</label>
        <div className="relative" style={{ width: 68 }}>
          <select value={ledPin}
            onChange={(e) => onUpdate(parseInt(e.target.value), ledMode)}
            className="w-full appearance-none bg-yellow-950/20 border border-yellow-700/40 rounded-lg px-2 py-1.5 text-xs text-yellow-300 focus:outline-none cursor-pointer pr-5"
          >
            {availablePins.map((p) => <option key={p} value={p}>D{p}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>
      <div className="flex rounded-lg overflow-hidden border border-gray-700">
        {LED_MODES.map((m) => (
          <button key={m.value}
            onClick={() => onUpdate(ledPin, m.value as "active" | "always")}
            className={[
              "flex-1 py-1.5 text-[10px] font-medium transition-colors",
              ledMode === m.value ? "bg-yellow-700 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300",
            ].join(" ")}
            title={m.desc}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Button / Port Card ───────────────────────────────────────────────────────

function ButtonCard({ button, index, usedPins, onUpdate, onRemove, typeLabel, isSelected, onSelect }: {
  button: ButtonConfig; index: number; usedPins: number[];
  onUpdate: (id: string, updates: Partial<ButtonConfig>) => void;
  onRemove: (id: string) => void;
  typeLabel?: string;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const availablePins = ALL_PINS.filter((p) => p === button.pin || !usedPins.includes(p));
  const isPort = typeLabel === "Port";
  const isPower = button.mode === "power";
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const h = (e: MouseEvent) => { if (!ctxRef.current?.contains(e.target as Node)) setCtxMenu(null); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [ctxMenu]);

  return (
    <div
      className={["border rounded-xl p-3 flex flex-col gap-2 transition-colors group cursor-pointer relative",
        isPower
          ? isSelected ? "bg-amber-900/40 border-amber-600/60" : "bg-amber-900/20 border-amber-700/50 hover:border-amber-600/60"
          : isSelected ? "bg-gray-800 border-blue-600/50" : "bg-gray-800/50 border-gray-700/80 hover:border-gray-600/80"
      ].join(" ")}
      onClick={() => onSelect?.(isSelected ? null : button.id)}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {isPower ? (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-amber-900/60 text-amber-400 border border-amber-700/60 flex items-center gap-1">
            <Power size={8} /> Power
          </span>
        ) : typeLabel && (
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            isPort ? "bg-sky-900/60 text-sky-400 border border-sky-800/60" :
            typeLabel === "Button" ? "bg-indigo-900/60 text-indigo-400 border border-indigo-800/60" :
            "bg-blue-900/60 text-blue-400 border border-blue-800/60"
          }`}>{typeLabel}</span>
        )}
        <input
          type="text" value={button.name}
          onChange={(e) => onUpdate(button.id, { name: e.target.value })}
          placeholder={isPower ? "Power Switch" : isPort ? `Port ${index + 1}` : `Input ${index + 1}`}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-200 placeholder:text-gray-600 outline-none border-b border-transparent focus:border-gray-600 transition-colors min-w-0"
        />
        {(button.ledPin ?? -1) >= 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[9px] font-semibold flex-shrink-0" title={`LED on D${button.ledPin}`}>
            <Lightbulb size={8} /> D{button.ledPin}
          </span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onRemove(button.id); }}
          className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
        ><Trash2 size={12} /></button>
      </div>

      {/* Pin */}
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
      </div>

      {/* Key — hidden for power switches, they don't send keys */}
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

      {/* Hold / Tap mode toggle */}
      {!isPower && button.mode !== "toggle" && (
        <div className="flex gap-2 items-center">
          <label className="text-xs text-gray-500 uppercase tracking-wider w-12 flex-shrink-0">Mode</label>
          <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-700 rounded-lg p-0.5">
            {(["hold", "tap"] as const).map((m) => (
              <button key={m} onClick={(e) => { e.stopPropagation(); onUpdate(button.id, { inputMode: m }); }}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  (button.inputMode ?? "hold") === m
                    ? "bg-blue-700/60 text-blue-100 shadow"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >{m === "hold" ? "Hold" : "Tap"}</button>
            ))}
          </div>
          <span className="text-xs text-gray-600">
            {(button.inputMode ?? "hold") === "tap" ? "one press per click" : "held while pressed"}
          </span>
        </div>
      )}

      {/* Power mode description */}
      {isPower && (
        <p className="text-[10px] text-amber-600/70 pl-8">Toggles all other inputs on / off when pressed</p>
      )}

      {isSelected && (
        <LedPanel
          ledPin={button.ledPin ?? -1}
          ledMode={button.ledMode ?? "active"}
          usedPins={usedPins}
          onUpdate={(pin, mode) => onUpdate(button.id, { ledPin: pin, ledMode: mode })}
        />
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: ctxMenu.y, left: ctxMenu.x, zIndex: 9999 }}
          className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[170px] overflow-hidden"
        >
          <div className="px-3 py-1.5 border-b border-gray-800">
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{button.name || (isPort ? `Port ${index + 1}` : `Input ${index + 1}`)}</p>
          </div>
          {isPower ? (
            <button
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-2 transition-colors"
              onClick={() => { onUpdate(button.id, { mode: "momentary" }); setCtxMenu(null); }}
            >
              <RotateCcw size={11} className="text-gray-500" /> Remove power mode
            </button>
          ) : (
            <button
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-amber-900/30 flex items-center gap-2 transition-colors"
              onClick={() => { onUpdate(button.id, { mode: "power", arduinoKey: "", keyDisplay: "" }); setCtxMenu(null); }}
            >
              <Power size={11} className="text-amber-400" /> Make power switch
            </button>
          )}
          <button
            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 flex items-center gap-2 transition-colors"
            onClick={() => { onRemove(button.id); setCtxMenu(null); }}
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── IDE Modal ────────────────────────────────────────────────────────────────

interface AIMessage { role: "user" | "assistant"; content: string }

function IDEModal({ originalCode, editedCode, onCodeUpdate, onClose, initialShowAI = false }: {
  originalCode: string;
  editedCode: string;
  onCodeUpdate: (code: string) => void;
  onClose: () => void;
  initialShowAI?: boolean;
}) {
  const [showAIChat, setShowAIChat] = useState(initialShowAI);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  // Tracks real user↔AI exchanges to give the model conversation context
  const [apiHistory, setApiHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("gemini_api_key") ?? "";
    return "";
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isModified = editedCode !== originalCode;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when AI panel opens
  useEffect(() => {
    if (showAIChat) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showAIChat]);

  const isClaudeKey = apiKey.startsWith("sk-ant-");
  const provider = isClaudeKey ? "Claude" : apiKey.startsWith("AIza") ? "Gemini" : apiKey ? "Gemini" : null;

  const saveApiKey = (key: string) => {
    const trimmed = key.trim();
    localStorage.setItem("gemini_api_key", trimmed);
    setApiKey(trimmed);
  };

  const copy = () => {
    navigator.clipboard.writeText(editedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sendToAI = async () => {
    if (!userInput.trim() || aiLoading) return;
    const request = userInput.trim();
    setMessages(prev => [...prev, { role: "user", content: request }]);
    setUserInput("");
    setAiLoading(true);

    const systemPrompt =
      "You are an expert Arduino programmer helping modify a HID (keyboard/mouse) input device sketch. " +
      "The sketch uses Keyboard.h and optionally Mouse.h to map physical inputs (buttons, joysticks, IR sensors, sip & puff) to key presses. " +
      "Rules: (1) Never change pin numbers — those are fixed by hardware. " +
      "(2) Return ONLY the complete modified Arduino sketch — raw C++ code, no markdown fences, no backticks, no explanation. " +
      "(3) If the user asks a question rather than requesting a code change, answer in plain text instead of code.";

    const prompt =
      `Current Arduino sketch:\n\`\`\`cpp\n${editedCode}\n\`\`\`\n\nRequest: ${request}`;

    try {
      const res = await fetch("/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          systemPrompt,
          prompt,
          history: apiHistory,
        }),
      });
      const data = await res.json() as { text?: string; error?: string };

      const isQuotaError =
        res.status === 429 ||
        (data as { isQuota?: boolean }).isQuota === true ||
        /quota|rate.?limit|resource.?exhausted|limit.*exceeded/i.test(data.error ?? "");
      if (isQuotaError) {
        setShowApiKeyInput(true);
        setMessages(prev => [...prev, {
          role: "assistant" as const,
          content: apiKey
            ? "Your API key has hit its quota. Try a different key, or wait and retry."
            : "The free AI quota has been reached. Paste your own Claude (sk-ant-…) or Gemini (AIza…) key above — both have free tiers.",
        }]);
        setAiLoading(false);
        return;
      }
      if (!res.ok || data.error) throw new Error(data.error ?? `Error ${res.status}`);

      const raw = (data.text ?? "")
        .replace(/^```(?:cpp|arduino|c\+\+)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

      // Detect whether the response is code or a text answer
      const looksLikeCode =
        /^(\/\/|#include|void setup|void loop|bool |int |const |\/\*)/m.test(raw.slice(0, 300));

      if (looksLikeCode) {
        onCodeUpdate(raw);
        setShowDiff(true);
        setApiHistory(prev => [
          ...prev,
          { role: "user", content: prompt },
          { role: "assistant", content: "Sketch updated successfully." },
        ]);
        setMessages(prev => [...prev, {
          role: "assistant" as const,
          content: "Sketch updated ✓ — check the Diff view to see exactly what changed.",
        }]);
      } else {
        // AI answered a question — show the text response in chat
        setApiHistory(prev => [
          ...prev,
          { role: "user", content: prompt },
          { role: "assistant", content: raw },
        ]);
        setMessages(prev => [...prev, { role: "assistant" as const, content: raw }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant" as const,
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong."}`,
      }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const SUGGESTIONS = [
    "Make the joystick more sensitive",
    "Add debounce to all buttons",
    "Detect and smooth out hand tremors",
    "Add an LED flash on each keypress",
    "Require a long press (500 ms) before firing",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 flex flex-col bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden transition-all ${showAIChat ? "w-full max-w-5xl h-[90vh]" : "w-full max-w-3xl h-[85vh]"}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-green-400" />
            <span className="text-sm font-semibold text-gray-200">Arduino Sketch</span>
            {isModified && (
              <span className="text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700/40 px-1.5 py-0.5 rounded-full">
                modified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isModified && (
              <button
                onClick={() => { onCodeUpdate(originalCode); setShowDiff(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-900/20 hover:bg-amber-900/40 border border-amber-700/30 transition-all"
              >
                <RotateCcw size={11} /> Reset
              </button>
            )}
            {isModified && (
              <button
                onClick={() => setShowDiff(v => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showDiff ? "bg-blue-800/40 text-blue-300 border-blue-700/50" : "text-gray-400 bg-gray-800 border-gray-700 hover:text-blue-300"}`}
              >
                Diff
              </button>
            )}
            <button
              onClick={() => setShowAIChat(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showAIChat ? "bg-violet-700/40 text-violet-200 border-violet-600/50" : "bg-violet-600/20 text-violet-300 border-violet-600/30 hover:bg-violet-600/30"}`}
            >
              <span>✦</span> Edit with AI
            </button>
            <button
              onClick={copy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copied ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
            >
              {copied ? <><CheckCircle2 size={12} /> Copied!</> : <><Download size={12} /> Copy</>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* Code panel */}
          <div className={`flex flex-col min-h-0 ${showAIChat ? "flex-1 border-r border-gray-800" : "flex-1"}`}>
            {showDiff && isModified ? (
              <div className="flex flex-1 min-h-0">
                <div className="flex-1 flex flex-col min-h-0 border-r border-gray-800">
                  <div className="px-3 py-1.5 bg-red-950/30 text-[10px] text-red-400 font-semibold flex-shrink-0 border-b border-gray-800">
                    Before
                  </div>
                  <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-red-300/70 leading-relaxed whitespace-pre">{originalCode}</pre>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="px-3 py-1.5 bg-green-950/30 text-[10px] text-green-400 font-semibold flex-shrink-0 border-b border-gray-800">
                    After
                  </div>
                  <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-green-300/70 leading-relaxed whitespace-pre">{editedCode}</pre>
                </div>
              </div>
            ) : (
              <textarea
                className="flex-1 p-4 text-xs font-mono text-gray-300 bg-transparent leading-relaxed resize-none focus:outline-none min-h-0"
                value={editedCode}
                onChange={(e) => onCodeUpdate(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
              />
            )}
          </div>

          {/* AI Chat panel */}
          {showAIChat && (
            <div className="w-96 flex flex-col min-h-0 bg-gray-800/40 flex-shrink-0">

              {/* API key row */}
              <div className="px-3 py-2.5 border-b border-gray-800 flex-shrink-0">
                {showApiKeyInput || !apiKey ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-gray-400 font-medium">
                      Your API key{" "}
                      <span className="text-gray-600 font-normal">(optional — stored locally)</span>
                      {provider && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isClaudeKey ? "bg-orange-900/40 text-orange-300" : "bg-blue-900/40 text-blue-300"}`}>
                          {provider} detected
                        </span>
                      )}
                    </p>
                    <input
                      type="text"
                      placeholder="sk-ant-… (Claude) or AIza… (Gemini)"
                      value={apiKey}
                      onChange={e => saveApiKey(e.target.value)}
                      onPaste={e => { e.preventDefault(); saveApiKey(e.clipboardData.getData("text")); }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <a href="https://console.anthropic.com/account/keys" target="_blank" rel="noopener noreferrer"
                          className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-0.5"
                        ><ExternalLink size={10} /> Claude</a>
                        <span className="text-gray-700">·</span>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-0.5"
                        ><ExternalLink size={10} /> Gemini</a>
                      </div>
                      {apiKey && (
                        <button onClick={() => setShowApiKeyInput(false)} className="text-xs text-violet-400 hover:text-violet-300 font-medium">
                          Done
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400 font-medium">{provider ?? "API"} key set</span>
                    </div>
                    <button onClick={() => setShowApiKeyInput(true)} className="text-xs text-gray-500 hover:text-gray-300">
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0">
                {messages.length === 0 && (
                  <div className="flex flex-col gap-2 pt-1">
                    <p className="text-xs text-gray-500 font-medium mb-1">Suggestions:</p>
                    {SUGGESTIONS.map(s => (
                      <button key={s}
                        onClick={() => { setUserInput(s); setTimeout(() => inputRef.current?.focus(), 10); }}
                        className="text-left px-3 py-2.5 rounded-xl border border-gray-700/60 bg-gray-800/40 text-xs text-gray-400 hover:text-violet-200 hover:border-violet-600/60 hover:bg-violet-900/20 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[92%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-violet-700/40 text-violet-100 border border-violet-600/30"
                        : "bg-gray-800/80 text-gray-200 border border-gray-700/60"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800/80 border border-gray-700/60 rounded-2xl px-3.5 py-2.5 flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin text-violet-400" />
                      <span className="text-sm text-gray-400">Updating sketch…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-3 border-t border-gray-800 flex-shrink-0">
                <div className="flex gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Describe what to change…"
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendToAI(); } }}
                    disabled={aiLoading}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                  <button
                    onClick={sendToAI}
                    disabled={aiLoading || !userInput.trim()}
                    className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold transition-colors flex-shrink-0"
                  >
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <span className="text-base leading-none">↑</span>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
          <p className="text-[11px] text-gray-600">
            {isModified
              ? "Modified code will be used on next upload."
              : "Edit directly or use AI. Upload flashes from Chrome/Edge."}
          </p>
          <button
            onClick={copy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copied ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
          >
            {copied ? <><CheckCircle2 size={12} /> Copied!</> : <><Download size={12} /> Copy Code</>}
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
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden">
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
        <div className="mt-2 rounded-lg border border-gray-800 bg-gray-800/50 p-3 flex flex-col gap-1.5">
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

function IRSensorCard({ sensor, index, usedPins, onUpdate, onRemove, isSelected, onSelect }: {
  sensor: IRSensorConfig; index: number; usedPins: number[];
  onUpdate: (id: string, u: Partial<IRSensorConfig>) => void;
  onRemove: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const availablePins = ALL_PINS.filter((p) => p === sensor.pin || !usedPins.includes(p));
  return (
    <div
      className={["border rounded-xl p-3 flex flex-col gap-2 transition-colors group cursor-pointer",
        isSelected ? "bg-emerald-900/40 border-blue-600/50" : "bg-emerald-900/20 border-emerald-700/50 hover:border-emerald-600/60"
      ].join(" ")}
      onClick={() => onSelect?.(isSelected ? null : sensor.id)}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border bg-emerald-500/20 border-emerald-500/40">
          <span className="text-emerald-400 text-[9px] font-bold">IR</span>
        </div>
        <input type="text" value={sensor.name}
          onChange={(e) => onUpdate(sensor.id, { name: e.target.value })}
          placeholder={`IR Sensor ${index + 1}`}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-200 placeholder:text-gray-600 outline-none border-b border-transparent focus:border-gray-600 transition-colors min-w-0"
        />
        {(sensor.ledPin ?? -1) >= 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[9px] font-semibold flex-shrink-0" title={`LED on D${sensor.ledPin}`}>
            <Lightbulb size={8} /> D{sensor.ledPin}
          </span>
        )}
        <button onClick={() => onRemove(sensor.id)}
          className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
        ><Trash2 size={12} /></button>
      </div>

      {/* Row 1: PIN + polarity */}
      <div className="flex gap-2 items-center">
        <label className="text-xs text-gray-500 uppercase tracking-wider w-12 flex-shrink-0">Pin</label>
        <div className="relative" style={{ width: 80 }}>
          <select value={sensor.pin} onChange={(e) => onUpdate(sensor.id, { pin: parseInt(e.target.value) })}
            className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer pr-5"
          >
            {availablePins.map((p) => <option key={p} value={p}>D{p}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <button onClick={(e) => { e.stopPropagation(); onUpdate(sensor.id, { activeHigh: !sensor.activeHigh }); }}
          className={["px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
            sensor.activeHigh ? "bg-emerald-800 border-emerald-600 text-emerald-300" : "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300"
          ].join(" ")}
          title="Toggle whether HIGH or LOW means 'triggered'"
        >{sensor.activeHigh ? "HIGH=on" : "LOW=on"}</button>
      </div>

      {/* Row 2: MODE — Hold | Tap | Toggle */}
      <div className="flex gap-2 items-center">
        <label className="text-xs text-gray-500 uppercase tracking-wider w-12 flex-shrink-0">Mode</label>
        <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-700 rounded-lg p-0.5 flex-1">
          {([
            { value: "hold"   as const, label: "Hold"   },
            { value: "tap"    as const, label: "Tap"    },
            { value: "toggle" as const, label: "Toggle" },
          ]).map(({ value, label }) => {
            const active =
              value === "toggle" ? sensor.mode === "toggle" :
              value === "tap"    ? sensor.mode === "momentary" && sensor.inputMode === "tap" :
                                   sensor.mode === "momentary" && sensor.inputMode !== "tap";
            return (
              <button key={value}
                onClick={(e) => { e.stopPropagation(); onUpdate(sensor.id, {
                  mode: value === "toggle" ? "toggle" : "momentary",
                  inputMode: value === "tap" ? "tap" : "hold",
                }); }}
                className={["flex-1 px-3 py-1 rounded text-xs font-semibold transition-colors",
                  active ? "bg-emerald-700/80 text-emerald-100 shadow" : "text-gray-500 hover:text-gray-300"
                ].join(" ")}
              >{label}</button>
            );
          })}
        </div>
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
      {isSelected && (
        <LedPanel
          ledPin={sensor.ledPin ?? -1}
          ledMode={sensor.ledMode ?? "active"}
          usedPins={usedPins}
          onUpdate={(pin, mode) => onUpdate(sensor.id, { ledPin: pin, ledMode: mode })}
        />
      )}
    </div>
  );
}

// ─── Sip & Puff Card ──────────────────────────────────────────────────────────

function SipPuffCard({ sensor, index, usedPins, onUpdate, onRemove, isSelected, onSelect }: {
  sensor: SipPuffConfig; index: number; usedPins: number[];
  onUpdate: (id: string, u: Partial<SipPuffConfig>) => void;
  onRemove: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const availablePins = ALL_PINS.filter((p) => p === sensor.pin || !usedPins.includes(p));
  return (
    <div
      className={["border rounded-xl p-3 flex flex-col gap-2 transition-colors group cursor-pointer",
        isSelected ? "bg-cyan-900/40 border-blue-600/50" : "bg-cyan-900/20 border-cyan-700/50 hover:border-cyan-600/60"
      ].join(" ")}
      onClick={() => onSelect?.(isSelected ? null : sensor.id)}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border bg-cyan-500/20 border-cyan-500/40">
          <Wind size={9} className="text-cyan-400" />
        </div>
        <input type="text" value={sensor.name}
          onChange={(e) => onUpdate(sensor.id, { name: e.target.value })}
          placeholder={`Sip & Puff ${index + 1}`}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-200 placeholder:text-gray-600 outline-none border-b border-transparent focus:border-gray-600 transition-colors min-w-0"
        />
        {(sensor.ledPin ?? -1) >= 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[9px] font-semibold flex-shrink-0" title={`LED on D${sensor.ledPin}`}>
            <Lightbulb size={8} /> D{sensor.ledPin}
          </span>
        )}
        <button onClick={() => onRemove(sensor.id)}
          className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
        ><Trash2 size={12} /></button>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0">Pin</label>
        <div className="relative" style={{ width: 68 }}>
          <select value={sensor.pin}
            onChange={(e) => onUpdate(sensor.id, { pin: parseInt(e.target.value) })}
            className="w-full appearance-none bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer pr-5"
          >
            {availablePins.map((p) => <option key={p} value={p}>D{p}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider w-6 flex-shrink-0">Key</label>
        <div className="flex-1">
          <KeyCaptureInput value={sensor.key} display={sensor.keyDisplay}
            onChange={(k, d) => onUpdate(sensor.id, { key: k, keyDisplay: d })}
            onClear={() => onUpdate(sensor.id, { key: "", keyDisplay: "" })}
          />
        </div>
      </div>

      {/* Hold vs Tap toggle */}
      <div className="flex gap-2 items-center">
        <label className="text-xs text-gray-500 uppercase tracking-wider w-12 flex-shrink-0">Mode</label>
        <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-700 rounded-lg p-0.5">
          {(["hold", "tap"] as const).map((m) => (
            <button key={m} onClick={(e) => { e.stopPropagation(); onUpdate(sensor.id, { inputMode: m }); }}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors capitalize ${
                (sensor.inputMode ?? "hold") === m
                  ? "bg-cyan-700/60 text-cyan-100 shadow"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >{m === "hold" ? "Hold" : "Tap"}</button>
          ))}
        </div>
        <span className="text-xs text-gray-600">
          {(sensor.inputMode ?? "hold") === "tap" ? "one press per activation" : "held while active"}
        </span>
      </div>

      {isSelected && (
        <LedPanel
          ledPin={sensor.ledPin ?? -1}
          ledMode={sensor.ledMode ?? "active"}
          usedPins={usedPins}
          onUpdate={(pin, mode) => onUpdate(sensor.id, { ledPin: pin, ledMode: mode })}
        />
      )}
    </div>
  );
}

// ─── Joystick Card ────────────────────────────────────────────────────────────

function JoystickCard({ joy, index, usedPins, usedAnalogPins, onUpdate, onRemove, isSelected, onSelect }: {
  joy: JoystickConfig; index: number; usedPins: number[]; usedAnalogPins: number[];
  onUpdate: (id: string, u: Partial<JoystickConfig>) => void;
  onRemove: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const availableDigital = ALL_PINS.filter((p) => p === joy.buttonPin || !usedPins.includes(p));
  const dirs: { label: string; key: keyof JoystickConfig; display: keyof JoystickConfig }[] = [
    { label: "↑ Up",    key: "upKey",    display: "upDisplay" },
    { label: "↓ Down",  key: "downKey",  display: "downDisplay" },
    { label: "← Left",  key: "leftKey",  display: "leftDisplay" },
    { label: "→ Right", key: "rightKey", display: "rightDisplay" },
  ];

  return (
    <div
      className={["border rounded-xl p-3 flex flex-col gap-2 transition-colors group cursor-pointer",
        isSelected ? "bg-violet-900/40 border-blue-600/50" : "bg-violet-900/20 border-violet-700/50 hover:border-violet-600/60"
      ].join(" ")}
      onClick={() => onSelect?.(isSelected ? null : joy.id)}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border bg-violet-500/20 border-violet-500/40">
          <Joystick size={9} className="text-violet-400" />
        </div>
        <input type="text" value={joy.name}
          onChange={(e) => onUpdate(joy.id, { name: e.target.value })}
          placeholder={`Joystick ${index + 1}`}
          className="flex-1 bg-transparent text-sm font-semibold text-gray-200 placeholder:text-gray-600 outline-none border-b border-transparent focus:border-gray-600 transition-colors min-w-0"
        />
        {(joy.ledPin ?? -1) >= 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[9px] font-semibold flex-shrink-0" title={`LED on D${joy.ledPin}`}>
            <Lightbulb size={8} /> D{joy.ledPin}
          </span>
        )}
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

      {/* Direction keys — hidden in mouse mode */}
      {!joy.mouseMode && (
        <div className="grid grid-cols-2 gap-1.5">
          {dirs.map(({ label, key, display }) => (
            <div key={String(key)} className="flex items-center gap-1.5">
              <span className="text-[10px] text-violet-400 font-mono w-12 flex-shrink-0">{label}</span>
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
      )}

      {/* Mouse mode toggle */}
      <div className="flex items-center gap-2 pl-1 pt-1 border-t border-violet-900/40">
        <span className="text-xs text-gray-500 uppercase tracking-wider w-24 flex-shrink-0">Mode</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => onUpdate(joy.id, { mouseMode: false })}
            className={["px-3 py-1.5 text-[10px] font-medium transition-colors flex items-center gap-1",
              !joy.mouseMode ? "bg-violet-700 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"
            ].join(" ")}
          ><Keyboard size={9} /> Keys</button>
          <button
            onClick={() => onUpdate(joy.id, { mouseMode: true })}
            className={["px-3 py-1.5 text-[10px] font-medium transition-colors flex items-center gap-1",
              joy.mouseMode ? "bg-violet-700 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"
            ].join(" ")}
          ><Minimize2 size={9} /> Mouse</button>
        </div>
      </div>

      {/* Mouse speed slider — only when mouse mode */}
      {joy.mouseMode && (
        <div className="flex items-center gap-2 pl-1">
          <span className="text-xs text-gray-500 uppercase tracking-wider w-24 flex-shrink-0">Speed</span>
          <input type="range" min={1} max={20} value={joy.mouseSpeed ?? 8}
            onChange={(e) => onUpdate(joy.id, { mouseSpeed: parseInt(e.target.value) })}
            className="flex-1 accent-violet-500 h-1"
          />
          <span className="text-xs text-gray-500 font-mono w-8 text-right">{joy.mouseSpeed ?? 8}</span>
        </div>
      )}

      {/* Sensitivity slider (higher = more sensitive = lower internal deadzone) */}
      <div className="flex items-center gap-2 pl-1">
        <span className="text-xs text-gray-500 uppercase tracking-wider w-24 flex-shrink-0">Sensitivity</span>
        <input type="range" min={0} max={400} value={400 - joy.deadzone}
          onChange={(e) => onUpdate(joy.id, { deadzone: 400 - parseInt(e.target.value) })}
          className="flex-1 accent-violet-500 h-1"
          title="Higher = triggers with less movement"
        />
        <span className="text-xs text-gray-500 font-mono w-8 text-right">{400 - joy.deadzone}</span>
      </div>

      {/* Click button pin */}
      <div className="flex items-center gap-2 pl-1">
        <span className="text-xs text-gray-500 uppercase tracking-wider w-24 flex-shrink-0">Click pin</span>
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
          joy.mouseMode ? (
            /* Mouse mode: pick which mouse button */
            <div className="flex rounded-lg overflow-hidden border border-gray-700 flex-1">
              {(["left", "middle", "right"] as const).map((btn) => (
                <button key={btn}
                  onClick={() => onUpdate(joy.id, { mouseClickBtn: btn })}
                  className={["flex-1 py-1.5 text-[10px] font-medium transition-colors capitalize",
                    (joy.mouseClickBtn ?? "left") === btn ? "bg-violet-700 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"
                  ].join(" ")}
                >{btn}</button>
              ))}
            </div>
          ) : (
            <div className="flex-1">
              <KeyCaptureInput value={joy.buttonKey} display={joy.buttonDisplay}
                onChange={(k, d) => onUpdate(joy.id, { buttonKey: k, buttonDisplay: d })}
                onClear={() => onUpdate(joy.id, { buttonKey: "", buttonDisplay: "" })}
              />
            </div>
          )
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
      {isSelected && (
        <LedPanel
          ledPin={joy.ledPin ?? -1}
          ledMode={joy.ledMode ?? "active"}
          usedPins={usedPins}
          onUpdate={(pin, mode) => onUpdate(joy.id, { ledPin: pin, ledMode: mode })}
        />
      )}
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
  sipPuffs.forEach((s) => addD(s.pin, trunc(s.name || "Sip & Puff"), "#22d3ee"));

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

  const [showResistorInfo, setShowResistorInfo] = useState(false);
  const [componentInfo, setComponentInfo] = useState<{ type: string; label: string } | null>(null);

  // Build flat card list — one card per component connection
  interface CompCard {
    id: string; name: string;
    compType: "button" | "power" | "port" | "led" | "ir" | "sipPuff" | "joystickX" | "joystickY" | "swclick" | "joystick";
    color: string; signalPin: string;
    needsVCC: boolean; needsGND: boolean; hasResistor: boolean;
    joystickData?: { xPin: number; yPin: number; swPin: number };
  }
  const cards: CompCard[] = [];

  buttons.forEach((b) => {
    cards.push({ id: b.id, name: (b.name || "Button").slice(0, 14),
      compType: b.mode === "power" ? "power" : "button",
      color: b.mode === "power" ? "#f59e0b" : "#60a5fa", signalPin: `D${b.pin}`,
      needsVCC: false, needsGND: true, hasResistor: false });
    if (b.ledPin && b.ledPin > 0)
      cards.push({ id: b.id + "-led", name: ((b.name || "Button") + " LED").slice(0, 14),
        compType: "led", color: "#fbbf24", signalPin: `D${b.ledPin}`,
        needsVCC: false, needsGND: true, hasResistor: true });
  });

  portInputs.forEach((p) => {
    cards.push({ id: p.id, name: (p.name || "3.5mm Port").slice(0, 14),
      compType: "port", color: "#38bdf8", signalPin: `D${p.pin}`,
      needsVCC: false, needsGND: true, hasResistor: false });
  });

  if (leds.enabled) {
    if (leds.onPin && leds.onPin > 0)
      cards.push({ id: "led-on", name: "LED (Active)", compType: "led",
        color: "#fbbf24", signalPin: `D${leds.onPin}`,
        needsVCC: false, needsGND: true, hasResistor: true });
    if (leds.offPin && leds.offPin > 0)
      cards.push({ id: "led-off", name: "LED (Inactive)", compType: "led",
        color: "#fbbf24", signalPin: `D${leds.offPin}`,
        needsVCC: false, needsGND: true, hasResistor: true });
  }

  irSensors.forEach((ir) => {
    cards.push({ id: ir.id, name: (ir.name || "IR Sensor").slice(0, 14),
      compType: "ir", color: "#34d399", signalPin: `D${ir.pin}`,
      needsVCC: true, needsGND: true, hasResistor: false });
    if (ir.ledPin && ir.ledPin > 0)
      cards.push({ id: ir.id + "-led", name: ((ir.name || "IR") + " LED").slice(0, 14),
        compType: "led", color: "#fbbf24", signalPin: `D${ir.ledPin}`,
        needsVCC: false, needsGND: true, hasResistor: true });
  });

  sipPuffs.forEach((s) => {
    cards.push({ id: s.id, name: (s.name || "Sip & Puff").slice(0, 14),
      compType: "sipPuff", color: "#22d3ee", signalPin: `D${s.pin}`,
      needsVCC: false, needsGND: true, hasResistor: false });
  });

  joysticks.forEach((j) => {
    // One unified card showing all 5 module pins (GND, +5V, VRX, VRY, SW)
    cards.push({
      id: j.id,
      name: (j.name || "Joystick").slice(0, 14),
      compType: "joystick",
      color: "#a78bfa",
      signalPin: "",
      needsVCC: false, needsGND: false, hasResistor: false,
      joystickData: { xPin: j.xPin, yPin: j.yPin, swPin: j.buttonPin ?? -1 },
    });
    if (j.ledPin && j.ledPin > 0)
      cards.push({ id: j.id + "-led", name: ((j.name || "Joystick") + " LED").slice(0, 14),
        compType: "led", color: "#fbbf24", signalPin: `D${j.ledPin}`,
        needsVCC: false, needsGND: true, hasResistor: true });
  });

  const hasAny = cards.length > 0;
  const COLS = 3;
  const CELL_W = 280;
  const CELL_H = 230;
  const svgRows = Math.max(1, Math.ceil(cards.length / COLS));
  const svgW = COLS * CELL_W + 20;
  const svgH = svgRows * CELL_H + 50;

  // ── Physical-drawing style component icons ──────────────────────────────────

  function ButtonIcon({ cx, cy, color, isPower, onClick }: { cx: number; cy: number; color: string; isPower: boolean; onClick?: () => void }) {
    return (
      <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {/* PCB footprint / base plate */}
        <rect x={cx - 18} y={cy - 4} width="36" height="14" rx="2" fill="#111827" stroke="#374151" strokeWidth="1" />
        {/* 2 pins */}
        <line x1={cx - 8} y1={cy + 10} x2={cx - 8} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx + 8} y1={cy + 10} x2={cx + 8} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
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
        {/* 2 pins */}
        <line x1={cx - 8} y1={cy + 10} x2={cx - 8} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <line x1={cx + 8} y1={cy + 10} x2={cx + 8} y2={cy + 20} stroke={color} strokeWidth="2" strokeLinecap="round" />
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
      <div className="relative z-10 w-full max-w-5xl max-h-[92vh] flex flex-col bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-sm font-semibold text-gray-200">Wiring Diagram</span>
            <span className="text-xs text-gray-600">— click any component for details</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* SVG Body */}
        <div className="flex-1 overflow-auto p-4">
          {!hasAny ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <span className="text-4xl mb-3">🔌</span>
              <p className="text-sm text-gray-500">No components configured yet.</p>
              <p className="text-xs text-gray-600 mt-1">Add buttons, sensors, or a joystick to see the wiring.</p>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "100%", height: "auto", background: "#0a0f1a", borderRadius: 10 }}
            >
              {/* Background grid */}
              <defs>
                <pattern id="wdgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1f2937" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width={svgW} height={svgH} fill="url(#wdgrid)" />

              {cards.map((card, idx) => {
                const col = idx % COLS;
                const row = Math.floor(idx / COLS);
                const CX = col * CELL_W + 10;   // cell left x
                const CY = row * CELL_H + 10;   // cell top y
                const compX = CX + 140;         // component center x
                const compY = CY + 95;          // component center y
                const color = card.color;

                // Signal wire endpoints
                const sigBadgeX = CX + 10;
                const sigBadgeW = 48;
                const sigWireStart = sigBadgeX + sigBadgeW;  // CX + 58
                const sigWireEnd   = compX - 26;              // CX + 114
                const resMidX      = Math.round((sigWireStart + sigWireEnd) / 2); // CX + 86

                // GND / VCC wire x positions
                const gndX = card.needsVCC ? compX - 28 : compX;
                const vccX = compX + 28;
                const powerBadgeY = CY + 193;

                // ── Joystick module card: shows all 5 pins in one unified cell ──
                if (card.compType === "joystick" && card.joystickData) {
                  const jd = card.joystickData;
                  // 5 pin x positions, evenly spaced across the cell
                  const jPins = [
                    { label: "GND", arduinoLabel: "GND",        color: "#6b7280", fill: "#6b728028", stroke: "#6b728070", x: CX + 36  },
                    { label: "+5V", arduinoLabel: "5V",         color: "#f87171", fill: "#f8717128", stroke: "#f8717170", x: CX + 82  },
                    { label: "VRX", arduinoLabel: `A${jd.xPin}`, color: "#a78bfa", fill: "#a78bfa28", stroke: "#a78bfa70", x: CX + 128 },
                    { label: "VRY", arduinoLabel: `A${jd.yPin}`, color: "#c084fc", fill: "#c084fc28", stroke: "#c084fc70", x: CX + 174 },
                    { label: "SW",  arduinoLabel: jd.swPin >= 0 ? `D${jd.swPin}` : "N/C", color: jd.swPin >= 0 ? "#818cf8" : "#374151", fill: jd.swPin >= 0 ? "#818cf828" : "#37415128", stroke: jd.swPin >= 0 ? "#818cf870" : "#37415150", x: CX + 220 },
                  ];
                  const modTop = CY + 28;
                  const modH   = 80;
                  const modBot = modTop + modH;
                  const pinBadgeY = modBot + 28;
                  return (
                    <g key={card.id}>
                      {/* Cell bg */}
                      <rect x={CX} y={CY} width={CELL_W - 12} height={CELL_H - 14} rx="8"
                        fill="#0d1424" stroke="#2d1f5a" strokeWidth="1" opacity="0.95" />
                      {/* Name */}
                      <text x={CX + 134} y={CY + 18} textAnchor="middle" fontFamily="sans-serif"
                        fontSize="9" fill="#a78bfa" fontWeight="700" opacity="0.9">{card.name}</text>

                      {/* Module PCB */}
                      <rect x={CX + 14} y={modTop} width={240} height={modH} rx="5"
                        fill="#1a0a2a" stroke="#a78bfa" strokeWidth="1.5" />

                      {/* Joystick stick + ball (centered on module) */}
                      <circle cx={CX + 128} cy={modTop + modH / 2} r={14} fill="#120520" stroke="#a78bfa" strokeWidth="1" />
                      <line x1={CX + 128} y1={modTop + modH / 2} x2={CX + 121} y2={modTop + 8} stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
                      <circle cx={CX + 121} cy={modTop + 5} r={8} fill="#5b21b6" stroke="#a78bfa" strokeWidth="1.5" />
                      <ellipse cx={CX + 119} cy={modTop + 2} rx="3" ry="2" fill="white" opacity={0.2} />

                      {/* Module pin header (5 stubs below module) */}
                      {jPins.map((p) => (
                        <line key={p.label} x1={p.x} y1={modBot} x2={p.x} y2={modBot + 10}
                          stroke={p.color} strokeWidth="2" strokeLinecap="round" />
                      ))}

                      {/* Module pin labels (inside module, just above bottom edge) */}
                      {jPins.map((p) => (
                        <text key={p.label + "-lbl"} x={p.x} y={modBot - 5} textAnchor="middle"
                          fontFamily="monospace" fontSize="7" fill={p.color} fontWeight="600">{p.label}</text>
                      ))}

                      {/* Wires from pin stubs to Arduino pin badges */}
                      {jPins.map((p) => (
                        <line key={p.label + "-wire"} x1={p.x} y1={modBot + 10} x2={p.x} y2={pinBadgeY}
                          stroke={p.color} strokeWidth="1.5" strokeDasharray="4 2" opacity={0.7} />
                      ))}

                      {/* Arduino pin badges */}
                      {jPins.map((p) => (
                        <g key={p.label + "-badge"}>
                          <rect x={p.x - 20} y={pinBadgeY} width={40} height={20} rx="5"
                            fill={p.fill} stroke={p.stroke} strokeWidth="1.2" />
                          <text x={p.x} y={pinBadgeY + 14} textAnchor="middle"
                            fontFamily="monospace" fontSize="9" fill={p.color} fontWeight="700">{p.arduinoLabel}</text>
                        </g>
                      ))}
                    </g>
                  );
                }

                return (
                  <g key={card.id}>
                    {/* Cell background */}
                    <rect x={CX} y={CY} width={CELL_W - 12} height={CELL_H - 14} rx="8"
                      fill="#0d1424" stroke="#1e3a5f" strokeWidth="1" opacity="0.95" />

                    {/* Component name */}
                    <text x={compX} y={CY + 19} textAnchor="middle" fontFamily="sans-serif"
                      fontSize="9" fill={color} fontWeight="700" opacity="0.9">{card.name}</text>

                    {/* GND wire (drawn before component so icon sits on top) */}
                    {card.needsGND && (
                      <line x1={gndX} y1={compY + 22} x2={gndX} y2={powerBadgeY}
                        stroke="#6b7280" strokeWidth="1.5" strokeDasharray="4 2" opacity={0.65} />
                    )}
                    {/* VCC wire */}
                    {card.needsVCC && (
                      <line x1={vccX} y1={compY + 22} x2={vccX} y2={powerBadgeY}
                        stroke="#f87171" strokeWidth="1.5" strokeDasharray="4 2" opacity={0.65} />
                    )}

                    {/* GND badge */}
                    {card.needsGND && (
                      <>
                        <rect x={gndX - 22} y={powerBadgeY} width={44} height={20} rx="5"
                          fill="#6b728028" stroke="#6b728070" strokeWidth="1.2" />
                        <text x={gndX} y={powerBadgeY + 14} textAnchor="middle"
                          fontFamily="monospace" fontSize="9" fill="#9ca3af" fontWeight="700">GND</text>
                      </>
                    )}
                    {/* VCC badge */}
                    {card.needsVCC && (
                      <>
                        <rect x={vccX - 22} y={powerBadgeY} width={44} height={20} rx="5"
                          fill="#f8717128" stroke="#f8717170" strokeWidth="1.2" />
                        <text x={vccX} y={powerBadgeY + 14} textAnchor="middle"
                          fontFamily="monospace" fontSize="9" fill="#f87171" fontWeight="700">+5V</text>
                      </>
                    )}

                    {/* Signal wire (drawn before badge so badge covers wire start) */}
                    {card.hasResistor ? (
                      <>
                        <line x1={sigWireStart} y1={compY} x2={resMidX - 12} y2={compY}
                          stroke={color} strokeWidth="1.5" strokeDasharray="4 2" opacity={0.8} />
                        <ResistorIcon cx={resMidX} cy={compY} onClick={() => setShowResistorInfo((v) => !v)} />
                        <line x1={resMidX + 12} y1={compY} x2={sigWireEnd} y2={compY}
                          stroke={color} strokeWidth="1.5" strokeDasharray="4 2" opacity={0.8} />
                      </>
                    ) : (
                      <line x1={sigWireStart} y1={compY} x2={sigWireEnd} y2={compY}
                        stroke={color} strokeWidth="1.5" strokeDasharray="4 2" opacity={0.8} />
                    )}

                    {/* Component icon (renders on top of wire endpoints) */}
                    {card.compType === "button"    && <ButtonIcon     cx={compX} cy={compY} color={color} isPower={false} onClick={() => setComponentInfo({ type: card.compType, label: card.name })} />}
                    {card.compType === "power"     && <ButtonIcon     cx={compX} cy={compY} color={color} isPower={true}  onClick={() => setComponentInfo({ type: card.compType, label: card.name })} />}
                    {card.compType === "port"      && <PortIcon       cx={compX} cy={compY} color={color}                 onClick={() => setComponentInfo({ type: card.compType, label: card.name })} />}
                    {card.compType === "led"       && <LedIcon        cx={compX} cy={compY} color={color}                 onClick={() => setComponentInfo({ type: card.compType, label: card.name })} />}
                    {card.compType === "ir"        && <IrIcon         cx={compX} cy={compY} color={color}                 onClick={() => setComponentInfo({ type: card.compType, label: card.name })} />}
                    {card.compType === "sipPuff"   && <SipPuffIcon    cx={compX} cy={compY} color={color}                 onClick={() => setComponentInfo({ type: card.compType, label: card.name })} />}

                    {/* Signal pin badge (drawn last — sits on top of wire left end) */}
                    <rect x={sigBadgeX} y={compY - 11} width={sigBadgeW} height={22} rx="5"
                      fill={color + "28"} stroke={color + "80"} strokeWidth="1.2" />
                    <text x={sigBadgeX + sigBadgeW / 2} y={compY + 5} textAnchor="middle"
                      fontFamily="monospace" fontSize="10" fill={color} fontWeight="700">
                      {card.signalPin}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* ── Resistor Info Popup ── */}
        {showResistorInfo && (
          <div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-80 bg-gray-800 border border-yellow-700/50 rounded-xl shadow-2xl p-4"
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
              desc: "A pressure-activated digital switch. When the user sips or puffs, the output goes LOW, sending the assigned key. Uses INPUT_PULLUP — no external resistor needed.",
              wiring: "OUT → digital pin. Needs +5V (VCC) and GND. The sketch uses digitalRead() — active LOW (triggered when output goes LOW).",
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
              className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4"
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
  const [tab, setTab] = useState<"configure" | "remap" | "test" | "info" | "admin">("configure");
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [buttons, setButtons] = useState<ButtonConfig[]>([
    { id: generateId(), name: "", pin: 2, keyDisplay: "", arduinoKey: "", mode: "momentary", ledPin: -1, ledMode: "active" },
  ]);
  const [portInputs, setPortInputs] = useState<PortConfig[]>([]);
  const [leds, setLeds] = useState<LedConfig>({ enabled: false, onPin: 11, offPin: 12 });
  const [showSketch, setShowSketch] = useState(false);
  const [sketchCode, setSketchCode] = useState("");
  const [customSketch, setCustomSketch] = useState<string | null>(null);
  const [railwayToken, setRailwayToken] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("railway_api_token") ?? "";
    return "";
  });
  const [railwayUsage, setRailwayUsage] = useState<{ estimatedCost?: number; currentPeriodStart?: string; currentPeriodEnd?: string; error?: string } | null>(null);
  const [railwayLoading, setRailwayLoading] = useState(false);
  const [uploadLog, setUploadLog] = useState<LogLine[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState<boolean | null>(null);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [loadingSketch, setLoadingSketch] = useState(false);
  const [showLedInfo, setShowLedInfo] = useState(false);
  const [showWiring, setShowWiring] = useState(false);
  const [showRemap, setShowRemap] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
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
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ show_ports: true, show_leds: true, show_upload: true, show_sensors: true, show_buttons: true, show_games: true, show_wiring: true, show_controller: true, maintenance_mode: false, welcome_message: "", show_tutorial: false, tutorial_version: 0 });
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [dbTemplates, setDbTemplates] = useState<DbTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [deleteConfirmTemplateId, setDeleteConfirmTemplateId] = useState<string | null>(null);
  const [shadowUser, setShadowUser] = useState<AppUser | null>(null);
  const [shadowSaves, setShadowSaves] = useState<SaveSlot[]>([]);
  const [shadowSaveIndex, setShadowSaveIndex] = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hasSaved,  setHasSaved]  = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [currentSaveName, setCurrentSaveName] = useState("My Setup");
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [sharingLink, setSharingLink] = useState(false);
  const [saveContextMenu, setSaveContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [deleteConfirmSaveId, setDeleteConfirmSaveId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedGame, setSelectedGame] = useState<"dino" | "snake" | "pong">("dino");
  const [dinoLeaderboard, setDinoLeaderboard] = useState<DinoScore[]>([]);
  const [deviceView, setDeviceView] = useState<"mockup" | "inputs" | "controller">("inputs");
  const [irSensors, setIrSensors] = useState<IRSensorConfig[]>([]);
  const [sipPuffs, setSipPuffs] = useState<SipPuffConfig[]>([]);
  const [joysticks, setJoysticks] = useState<JoystickConfig[]>([]);
  const [addLedBtnId, setAddLedBtnId] = useState("");
  const [addLedPin, setAddLedPin] = useState(-1);
  const [addInputType, setAddInputType] = useState("micro-switch");
  const [wsLog, setWsLog] = useState<string[]>([]);
  const [wsUploading, setWsUploading] = useState(false);
  const [showPortMenu, setShowPortMenu] = useState(false);
  const [showPortModal, setShowPortModal] = useState(false);
  const [grantedPorts, setGrantedPorts] = useState<{ label: string; index: number }[]>([]);
  const portMenuRef = useRef<HTMLDivElement>(null);
  const [serialLog, setSerialLog] = useState<{ key: string; time: string }[]>([]);
  const serialLogRef = useRef<HTMLDivElement>(null);
  const [showSerialMonitor, setShowSerialMonitor] = useState(false);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [userSaveCounts, setUserSaveCounts] = useState<Record<string, number>>({});
  const [userSearch, setUserSearch] = useState("");
  const [adminSubTab, setAdminSubTab] = useState<"settings" | "users" | "railway" | "issues">("settings");
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [issuesLoaded, setIssuesLoaded] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportCategory, setReportCategory] = useState<Issue["category"]>("bug");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [arduinoDetected, setArduinoDetected] = useState(false);
  const arduinoDetectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"username" | "google">("username");

  const logEndRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [uploadLog]);
  useEffect(() => { if (serialLogRef.current) serialLogRef.current.scrollTop = serialLogRef.current.scrollHeight; }, [serialLog]);
  // Global key listener for the serial/input monitor — always active so Arduino input is captured
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore modifier-only, ignore keys that are part of the app UI (e.g. text inputs)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const label = e.key === " " ? "SPACE" : e.key.length > 1 ? e.key.toUpperCase().replace("ARROW", "").replace("KEY", "") : e.key.toUpperCase();
      const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setSerialLog((p) => [...p.slice(-299), { key: label, time }]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => { fetchPorts(); }, []);
  useEffect(() => { loadDbTemplates().then(setDbTemplates); }, []);
  useEffect(() => {
    if (!showSaveMenu) return;
    const h = (e: MouseEvent) => { if (!saveMenuRef.current?.contains(e.target as Node)) { setShowSaveMenu(false); setDeleteConfirmSaveId(null); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showSaveMenu]);
  useEffect(() => {
    if (!saveContextMenu) return;
    const h = () => setSaveContextMenu(null);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [saveContextMenu]);
  useEffect(() => {
    if (!showPortMenu) return;
    const h = (e: MouseEvent) => { if (!portMenuRef.current?.contains(e.target as Node)) setShowPortMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showPortMenu]);

  useEffect(() => {
    if (!showPortModal) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setShowPortModal(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showPortModal]);

  useEffect(() => {
    if (!showAuthModal) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAuthModal(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showAuthModal]);

  // ── Offline detection ────────────────────────────────────────────────────
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline  = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online",  goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online",  goOnline);
    };
  }, []);

  // ── Serial port auto-detection banner ────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial;
    if (!serial) return;
    const onConnect = () => {
      setArduinoDetected(true);
      if (arduinoDetectTimer.current) clearTimeout(arduinoDetectTimer.current);
      arduinoDetectTimer.current = setTimeout(() => setArduinoDetected(false), 6000);
    };
    serial.addEventListener("connect", onConnect);
    return () => {
      serial.removeEventListener("connect", onConnect);
      if (arduinoDetectTimer.current) clearTimeout(arduinoDetectTimer.current);
    };
  }, []);

  // ── Load shared setup from URL (?share=<id>) ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    if (!shareId) return;
    loadSharedSetup(shareId).then((result) => {
      if (!result) return;
      const { name, config: cfg } = result;
      if (cfg.buttons)    setButtons(cfg.buttons as ButtonConfig[]);
      if (cfg.portInputs) setPortInputs(cfg.portInputs as PortConfig[]);
      if (cfg.leds)       setLeds(cfg.leds as LedConfig);
      if (cfg.irSensors)  setIrSensors(cfg.irSensors as IRSensorConfig[]);
      if (cfg.sipPuffs)   setSipPuffs(cfg.sipPuffs as SipPuffConfig[]);
      if (cfg.joysticks)  setJoysticks(cfg.joysticks as JoystickConfig[]);
      setCurrentSaveName(name);
      // Clean the URL without a full reload
      window.history.replaceState({}, "", "/app");
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth: restore from localStorage on mount, subscribe to admin settings ──
  useEffect(() => {
    // Restore session from localStorage
    try {
      const stored = localStorage.getItem("appUser");
      if (stored) {
        const u = JSON.parse(stored) as AppUser;
        setAppUser(u);
        updateLastActive(u.id).catch(() => {});
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
            if (cfg.sipPuffs)   setSipPuffs(cfg.sipPuffs as SipPuffConfig[]);
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
        show_ports:        s.show_ports        ?? cached?.show_ports        ?? true,
        show_leds:         s.show_leds         ?? cached?.show_leds         ?? true,
        show_upload:       s.show_upload       ?? cached?.show_upload       ?? true,
        show_sensors:      s.show_sensors      ?? cached?.show_sensors      ?? true,
        show_buttons:      s.show_buttons      ?? cached?.show_buttons      ?? true,
        show_games:        s.show_games        ?? cached?.show_games        ?? true,
        show_wiring:       s.show_wiring       ?? cached?.show_wiring       ?? true,
        show_controller:   s.show_controller   ?? cached?.show_controller   ?? true,
        maintenance_mode:  s.maintenance_mode  ?? cached?.maintenance_mode  ?? false,
        welcome_message:   s.welcome_message   ?? cached?.welcome_message   ?? "",
        show_tutorial:     s.show_tutorial     ?? cached?.show_tutorial     ?? false,
        tutorial_version:  s.tutorial_version  ?? cached?.tutorial_version  ?? 0,
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
          const next: AdminSettings = {
            show_ports:       s.show_ports       ?? true,
            show_leds:        s.show_leds        ?? true,
            show_upload:      s.show_upload      ?? true,
            show_sensors:     s.show_sensors     ?? true,
            show_buttons:     s.show_buttons     ?? true,
            show_games:       s.show_games       ?? true,
            show_wiring:      s.show_wiring      ?? true,
            show_controller:  s.show_controller  ?? true,
            maintenance_mode: s.maintenance_mode ?? false,
            welcome_message:  s.welcome_message  ?? "",
            show_tutorial:    s.show_tutorial    ?? false,
            tutorial_version: s.tutorial_version ?? 0,
          };
          setAdminSettings(next);
          localStorage.setItem("adminSettings", JSON.stringify(next));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tutorial only shows when explicitly triggered (? button) or admin enables it
  // (removed auto-show for guests)

  const handleLogin = async () => {
    if (!loginUsername.trim() || loginLoading) return;
    setLoginLoading(true);
    const u = await loginOrCreate(loginUsername);
    if (u) setShowAuthModal(false);
    if (u) {
      updateLastActive(u.id).catch(() => {});
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
        if (cfg.sipPuffs)   setSipPuffs(cfg.sipPuffs as SipPuffConfig[]);
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
    supabase.auth.signOut().catch(() => {});
    if (tab === "admin") setTab("configure");
  };

  const handleSubmitIssue = async () => {
    if (!reportTitle.trim() || !reportDesc.trim()) return;
    setReportSubmitting(true);
    try {
      const res = await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reportTitle.trim(),
          description: reportDesc.trim(),
          category: reportCategory,
          username: appUser?.username ?? undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? `Error ${res.status}`);
      }
    } catch (err) {
      alert(`Failed to submit: ${err instanceof Error ? err.message : "Unknown error"}`);
      setReportSubmitting(false);
      return;
    }
    setReportSubmitting(false);
    setReportDone(true);
    setReportTitle("");
    setReportDesc("");
    setReportCategory("bug");
    setTimeout(() => { setReportDone(false); setShowReportModal(false); }, 2500);
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.href : undefined },
    });
  };

  // ── Handle Google OAuth redirect back ────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || localStorage.getItem("appUser")) return;
      const meta = session.user.user_metadata ?? {};
      const raw = (meta.full_name || meta.name || meta.email || "user").toLowerCase();
      const username = raw.replace(/[^a-z0-9]/g, ".");
      const u = await loginOrCreate(username);
      if (u) {
        updateLastActive(u.id).catch(() => {});
        localStorage.setItem("appUser", JSON.stringify(u));
        setAppUser(u);
        setShowAuthModal(false);
        const allSaves = await loadAllSaves(u.id);
        setSaves(allSaves);
        if (allSaves.length > 0) {
          const s = allSaves[0];
          setCurrentSaveId(s.id); setCurrentSaveName(s.name);
          const cfg = s.config;
          if (cfg.buttons)    setButtons(cfg.buttons as ButtonConfig[]);
          if (cfg.portInputs) setPortInputs(cfg.portInputs as PortConfig[]);
          if (cfg.leds)       setLeds(cfg.leds as LedConfig);
          if (cfg.irSensors)  setIrSensors(cfg.irSensors as IRSensorConfig[]);
          if (cfg.sipPuffs)   setSipPuffs(cfg.sipPuffs as SipPuffConfig[]);
          if (cfg.joysticks)  setJoysticks(cfg.joysticks as JoystickConfig[]);
        }
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save config 1.5 s after any change (only when logged in) ─────────
  useEffect(() => {
    if (!appUser) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(false);
      try {
        const cfg = { buttons, portInputs, leds, irSensors, sipPuffs, joysticks };
        const newId = await upsertSave(appUser.id, currentSaveId, currentSaveName, cfg);
        if (newId !== currentSaveId) {
          setCurrentSaveId(newId);
          setSaves((prev) => {
            const exists = prev.find((s) => s.id === newId);
            if (exists) return prev.map((s) => s.id === newId ? { ...s, name: currentSaveName, config: cfg, updated_at: new Date().toISOString() } : s);
            return [{ id: newId, name: currentSaveName, config: cfg, updated_at: new Date().toISOString() }, ...prev];
          });
        } else {
          setSaves((prev) => prev.map((s) => s.id === newId ? { ...s, name: currentSaveName, config: cfg, updated_at: new Date().toISOString() } : s));
        }
        setHasSaved(true);
      } catch (err) {
        console.error("[save] upsertSave failed:", err);
        setSaveError(true);
      } finally {
        setSaving(false);
      }
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
    ...sipPuffs.map((s) => s.pin),
    ...joysticks.filter((j) => j.buttonPin >= 0).map((j) => j.buttonPin),
    ...(leds.enabled ? [leds.onPin, leds.offPin] : []),
  ];
  const usedAnalogPins = [
    ...joysticks.flatMap((j) => [j.xPin, j.yPin]),
  ];

  const addButton = (subtype: "switch" | "button" = "switch") => {
    if (buttons.length >= 12) return;
    const next = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
    setButtons((prev) => [...prev, { id: generateId(), name: "", pin: next, keyDisplay: "", arduinoKey: "", mode: "momentary", ledPin: -1, ledMode: "active", subtype }]);
  };

  const addPort = () => {
    if (portInputs.length >= 4) return;
    const next = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
    setPortInputs((prev) => [...prev, { id: generateId(), name: "", pin: next, keyDisplay: "", arduinoKey: "", mode: "momentary", ledPin: -1, ledMode: "active" }]);
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
    setIrSensors((prev) => [...prev, { id: generateId(), name: "", pin, keyDisplay: "", arduinoKey: "", mode: "momentary", activeHigh: false, ledPin: -1, ledMode: "active" }]);
  };
  const updateIR = (id: string, u: Partial<IRSensorConfig>) =>
    setIrSensors((prev) => prev.map((s) => (s.id === id ? { ...s, ...u } : s)));
  const removeIR = (id: string) => setIrSensors((prev) => prev.filter((s) => s.id !== id));

  // Sip & puff
  const addSipPuff = () => {
    const dp = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
    setSipPuffs((prev) => [...prev, { id: generateId(), name: "", pin: dp, key: "", keyDisplay: "", ledPin: -1, ledMode: "active", inputMode: "hold" }]);
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
      ledPin: -1, ledMode: "active",
    }]);
  };
  const updateJoystick = (id: string, u: Partial<JoystickConfig>) =>
    setJoysticks((prev) => prev.map((j) => (j.id === id ? { ...j, ...u } : j)));
  const removeJoystick = (id: string) => setJoysticks((prev) => prev.filter((j) => j.id !== id));

  const addInputByType = (type: string) => {
    if (type === "micro-switch") addButton("switch");
    else if (type === "button") addButton("button");
    else if (type === "toggle-switch") {
      const next = ALL_PINS.find((p) => !usedPins.includes(p)) ?? 2;
      setButtons((prev) => [...prev, { id: generateId(), name: "", pin: next, keyDisplay: "", arduinoKey: "", mode: "toggle", ledPin: -1, ledMode: "active" }]);
    }
    else if (type === "sip-puff") addSipPuff();
    else if (type === "ir-sensor") addIR();
    else if (type === "joystick") addJoystick();
    else if (type === "port") addPort();
  };

  const addInput = () => addInputByType(addInputType);

  const handleWebSerialUpload = async (forceNewPort = false) => {
    setWsUploading(true);
    setWsLog([]);
    const log = (msg: string) => setWsLog((p) => [...p, msg]);
    try {
      const sketch = customSketch ?? generateSketch(buttons, leds, portInputs, irSensors, sipPuffs, joysticks);
      await compileAndUpload(BACKEND_URL, sketch, log, forceNewPort);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`✗ ${msg}`);
    } finally {
      setWsUploading(false);
    }
  };

  const fetchRailwayUsage = async () => {
    if (!railwayToken) return;
    setRailwayLoading(true);
    setRailwayUsage(null);
    try {
      const res = await fetch("https://backboard.railway.app/graphql/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${railwayToken}` },
        body: JSON.stringify({ query: `{ me { usage { currentPeriodStart currentPeriodEnd estimatedUsage } } }` }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data?: { me?: { usage?: { currentPeriodStart?: string; currentPeriodEnd?: string; estimatedUsage?: number } } }; errors?: Array<{ message: string }> };
      if (json.errors?.length) throw new Error(json.errors[0].message);
      const u = json.data?.me?.usage;
      if (!u) throw new Error("No usage data returned");
      setRailwayUsage({ estimatedCost: u.estimatedUsage, currentPeriodStart: u.currentPeriodStart, currentPeriodEnd: u.currentPeriodEnd });
    } catch (e) {
      setRailwayUsage({ error: e instanceof Error ? e.message : "Failed to fetch usage" });
    } finally {
      setRailwayLoading(false);
    }
  };

  const handleDinoGameOver = useCallback(async (score: number) => {
    if (!appUser || score === 0) return;
    await submitDinoScore(appUser.username, score);
    const top = await getTopDinoScores(3);
    setDinoLeaderboard(top);
  }, [appUser]);

  // Load leaderboard once on mount
  useEffect(() => {
    getTopDinoScores(3).then(setDinoLeaderboard).catch(() => {});
  }, []);

  const openPortMenu = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serial = (navigator as any).serial;
    if (!serial) { setShowPortModal(true); setGrantedPorts([]); return; }
    try {
      const ports = await serial.getPorts();
      const labels = ports.map((p: { getInfo?: () => { usbVendorId?: number; usbProductId?: number } }, i: number) => {
        const info = p.getInfo?.() ?? {};
        const vid = info.usbVendorId;
        const isArduino = vid === 0x2341 || vid === 0x1B4F || vid === 0x239A;
        return { label: isArduino ? `Arduino (port ${i + 1})` : `USB device (port ${i + 1})`, index: i };
      });
      setGrantedPorts(labels);
    } catch {
      setGrantedPorts([]);
    }
    setShowPortModal(true);
  };

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

  const createNewSave = async () => {
    // Flush current save to DB before switching so it stays in the list
    if (appUser) {
      const cfg = { buttons, portInputs, leds, irSensors, sipPuffs, joysticks };
      const savedId = await upsertSave(appUser.id, currentSaveId, currentSaveName, cfg);
      if (savedId) {
        const now = new Date().toISOString();
        setSaves((prev) => {
          const exists = prev.find((s) => s.id === savedId);
          if (exists) return prev.map((s) => s.id === savedId ? { ...s, name: currentSaveName, config: cfg, updated_at: now } : s);
          return [{ id: savedId, name: currentSaveName, config: cfg, updated_at: now }, ...prev];
        });
        setCurrentSaveId(savedId);
        setHasSaved(true);
      }
    }
    // Now switch to blank new save
    setCurrentSaveId(null);
    setCurrentSaveName("Untitled");
    setButtons([{ id: generateId(), name: "", pin: 2, keyDisplay: "", arduinoKey: "", mode: "momentary", ledPin: -1, ledMode: "active" }]);
    setPortInputs([]); setLeds({ enabled: false, onPin: 11, offPin: 12 });
    setIrSensors([]); setSipPuffs([]); setJoysticks([]);
    setHasSaved(false);
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

  const applyTemplate = (t: typeof BOARD_TEMPLATES[number] | DbTemplate) => {
    const cfg = "config" in t ? t.config : t;
    setButtons((cfg.buttons ?? (t as typeof BOARD_TEMPLATES[number]).buttons ?? []) as ButtonConfig[]);
    setPortInputs((cfg.portInputs ?? []) as PortConfig[]);
    setLeds((cfg.leds ?? { enabled: false, onPin: 11, offPin: 12 }) as LedConfig);
    setIrSensors((cfg.irSensors ?? []) as IRSensorConfig[]);
    setSipPuffs((cfg.sipPuffs ?? []) as SipPuffConfig[]);
    setJoysticks((cfg.joysticks ?? []) as JoystickConfig[]);
    setCurrentSaveName(t.label);
    setShowTemplates(false);
  };

  const saveAsTemplate = async (label: string, config: { buttons: ButtonConfig[]; portInputs: PortConfig[]; leds: LedConfig; irSensors: IRSensorConfig[]; sipPuffs: SipPuffConfig[]; joysticks: JoystickConfig[] }) => {
    const id = await upsertDbTemplate(null, label, "🎯", "", config as unknown as import("@/lib/supabase").UserConfig);
    if (id) setDbTemplates((prev) => [...prev, { id, label, emoji: "🎯", description: "", config: config as unknown as import("@/lib/supabase").UserConfig, sort_order: prev.length }]);
  };

  const copyShareLink = async () => {
    setSharingLink(true);
    try {
      const cfg = { buttons, portInputs, leds, irSensors, sipPuffs, joysticks };
      const id = await saveSharedSetup(currentSaveName, cfg);
      const base = "https://arduino.jacobmajors.com";
      const url = `${base}/share/${id}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch { /* ignore */ } finally {
      setSharingLink(false);
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

  const [openSketchWithAI, setOpenSketchWithAI] = useState(false);

  const openSketch = async (withAI = false) => {
    setLoadingSketch(true);
    try {
      const sketch = generateSketch(buttons, leds, portInputs, irSensors, sipPuffs, joysticks);
      setSketchCode(sketch);
      if (customSketch === null) setCustomSketch(sketch);
      setOpenSketchWithAI(withAI);
      setShowSketch(true);
    } finally { setLoadingSketch(false); }
  };

  const startUpload = async () => {
    if (!selectedPort || uploading) return;
    setUploading(true); setUploadDone(null); setUploadLog([]);
    const sketch = customSketch ?? generateSketch(buttons, leds, portInputs, irSensors, sipPuffs, joysticks);
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
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-700/60 bg-gray-800/50 backdrop-blur-sm flex-shrink-0 relative z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Zap size={14} className="text-white" />
          </div>

          {/* Auth — left side, right after logo */}
          {authReady && (
            appUser ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-800/60 border border-gray-700 rounded-xl">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[9px] font-bold">{appUser.username[0].toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-gray-300 hidden sm:block max-w-[100px] truncate">{appUser.username}</span>
                  <button onClick={handleSignOut} className="text-[10px] text-gray-600 hover:text-red-400 transition-colors ml-1">Sign out</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex-shrink-0"
              >Sign In</button>
            )
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Wiring icon + tutorial ? */}
          <button
            onClick={() => setShowWiring(true)}
            title="Wiring diagram"
            data-tutorial="wiring-btn"
            className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 text-yellow-500 hover:text-yellow-300 hover:border-yellow-700/60 transition-colors flex items-center justify-center flex-shrink-0"
          ><Zap size={13} /></button>
          <button
            onClick={() => setShowTutorial(true)}
            title="Show tutorial"
            className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-600 transition-colors flex items-center justify-center flex-shrink-0 text-xs font-bold"
          >?</button>
          <button
            onClick={() => { setReportDone(false); setShowReportModal(true); }}
            title="Report an issue"
            className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-700/60 transition-colors flex items-center justify-center flex-shrink-0"
          ><AlertCircle size={13} /></button>

          <div className="flex bg-gray-800/60 border border-gray-700 rounded-xl p-0.5 gap-0.5">
            <button onClick={() => setTab("configure")} data-tutorial="configure-tab"
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "configure" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><Settings size={12} /> Configure</button>
            <button onClick={() => setTab("remap")} data-tutorial="remap-tab"
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "remap" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><RefreshCw size={12} /> Remap</button>
            <button onClick={() => setTab("test")} data-tutorial="test-tab"
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "test" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><Gamepad2 size={12} /> Test</button>
            <button onClick={() => setTab("info")}
              className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "info" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
            ><Info size={12} /> Info</button>
            {appUser && isAdmin(appUser.username) && (
              <button onClick={() => {
                setTab("admin");
                loadDbTemplates().then(setDbTemplates);
                loadAllUsers().then(async (users) => {
                  setAllUsers(users);
                  const counts: Record<string, number> = {};
                  await Promise.all(users.map(async (u) => {
                    const s = await loadAllSaves(u.id);
                    counts[u.id] = s.length;
                  }));
                  setUserSaveCounts(counts);
                });
              }}
                className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  tab === "admin" ? "bg-amber-700/60 text-amber-200" : "text-amber-600 hover:text-amber-400"].join(" ")}
              ><Settings size={12} /> Admin</button>
            )}
          </div>
        </div>
      </header>

      {/* Offline banner */}
      {isOffline && (
        <div className="flex-shrink-0 bg-gray-800/50 border-b border-gray-700/60 px-4 py-2 z-40">
          <div className="max-w-[1400px] mx-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" />
            <p className="text-xs text-gray-400 flex-1">
              <span className="font-semibold text-gray-300">You&apos;re offline.</span> Changes won&apos;t save until your connection is restored.
            </p>
          </div>
        </div>
      )}

      {/* Arduino detected toast */}
      {arduinoDetected && (
        <div
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-2xl"
          style={{ background: "rgba(10,20,10,0.97)", border: "1px solid rgba(74,222,128,0.35)", backdropFilter: "blur(12px)" }}
        >
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)] flex-shrink-0 animate-pulse" />
          <span className="text-xs text-green-300 font-medium">Arduino detected</span>
          <span className="text-xs text-gray-500">— click <span className="text-gray-300 font-semibold">Board</span> to select it</span>
          <button onClick={() => setArduinoDetected(false)} className="ml-1 text-gray-600 hover:text-gray-400 transition-colors"><X size={12} /></button>
        </div>
      )}

      {/* Maintenance banner */}
      {adminSettings.maintenance_mode && appUser && !isAdmin(appUser.username) && (
        <div className="flex-shrink-0 bg-red-950/60 border-b border-red-800/50 px-4 py-2 z-40">
          <div className="max-w-[1400px] mx-auto flex items-center gap-2">
            <Settings size={12} className="text-red-400 flex-shrink-0 animate-spin" style={{ animationDuration: "3s" }} />
            <p className="text-xs text-red-300 flex-1">
              <span className="font-semibold">Maintenance in progress.</span>{" "}
              {adminSettings.welcome_message || "The app is temporarily unavailable. Please check back soon."}
            </p>
          </div>
        </div>
      )}

      {/* ══ CONFIGURE TAB ══════════════════════════════════════════════════ */}
      {tab === "configure" && (
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ── setup banner ── */}
          {showSetupBanner && (
            <div className="flex-shrink-0 bg-amber-950/40 border-b border-amber-700/40 px-4 sm:px-6 py-2">
              <div className="max-w-[1400px] mx-auto flex items-center gap-3">
                <Terminal size={13} className="text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300 flex-1 min-w-0">
                  <span className="font-semibold">No Arduino IDE needed.</span>
                  {" "}Click <span className="font-semibold text-amber-200">Compile &amp; Upload</span> above to flash directly from Chrome or Edge via USB — or copy the sketch to use with your own tools.
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
                  You&apos;re using the app as a guest — everything works, but your setup won&apos;t be saved.{" "}
                  <button onClick={() => setShowAuthModal(true)} className="underline font-semibold text-blue-200 hover:text-white transition-colors">Sign In</button> to save your config.
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <div className="h-full max-w-[1400px] mx-auto px-4 sm:px-6 py-4 w-full flex flex-col gap-4 min-w-0">

            {/* Top bar: Get Code */}
            {adminSettings.show_upload && <section className="bg-gray-800/60 border border-gray-700/60 rounded-2xl px-4 py-3 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => handleWebSerialUpload(false)} disabled={wsUploading} data-tutorial="upload-btn"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-green-700 to-teal-700 hover:from-green-600 hover:to-teal-600 disabled:opacity-50 text-white font-semibold text-xs transition-all"
                >
                  {wsUploading ? <><Loader2 size={13} className="animate-spin" /> Uploading…</> : <><Upload size={13} /> Compile &amp; Upload</>}
                </button>
                <button onClick={openPortMenu} disabled={wsUploading}
                  title="Select board / port"
                  data-tutorial="board-btn"
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 hover:text-gray-200 text-xs transition-all"
                >
                  <Usb size={12} /> Board <ChevronDown size={10} />
                </button>
                <button onClick={() => openSketch(false)} title="View sketch code"
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-xs transition-all"
                >
                  <Code size={12} /> Sketch
                </button>
                <button onClick={() => openSketch(true)} title="Edit sketch with AI"
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-violet-700/50 bg-violet-900/20 hover:bg-violet-900/40 text-violet-400 hover:text-violet-200 text-xs font-medium transition-all"
                >
                  ✦ AI
                </button>
                <span className="text-[10px] text-gray-600 ml-auto hidden sm:block">Chrome / Edge only</span>
              </div>
              {(wsUploading || wsLog.length > 0) && (() => {
                const joined = wsLog.join("\n");
                const failed = wsLog.some((l) => l.startsWith("✗") || l.toLowerCase().includes("failed") || l.toLowerCase().includes("error"));
                const compileOk  = joined.includes("Compilation successful");
                const connectOk  = joined.includes("Bootloader:");
                const flashPct   = (() => {
                  const re = /Writing… (\d+)%/g;
                  let last: RegExpExecArray | null = null, cur: RegExpExecArray | null;
                  while ((cur = re.exec(joined)) !== null) last = cur;
                  return last ? parseInt(last[1]) : (connectOk ? 0 : null);
                })();
                const flashOk    = joined.includes("Upload complete");
                const isCompiling  = !compileOk && !failed;
                const isConnecting = compileOk && !connectOk && !failed;
                const isFlashing   = connectOk && !flashOk && !failed;

                const stages = [
                  { key: "compile",  label: "Compile",    done: compileOk,  active: isCompiling  },
                  { key: "connect",  label: "Connect",    done: connectOk,  active: isConnecting },
                  { key: "flash",    label: "Flash",      done: flashOk,    active: isFlashing   },
                ] as const;

                return (
                  <div className="mt-2 space-y-2">
                    {/* Step pills */}
                    <div className="flex items-center gap-1">
                      {stages.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-1 flex-1">
                          <div className={[
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex-1 justify-center",
                            s.done  ? "bg-green-900/40 border border-green-700/50 text-green-300" :
                            s.active && !failed ? "bg-blue-900/40 border border-blue-700/50 text-blue-300" :
                            failed && s.active ? "bg-red-900/40 border border-red-700/50 text-red-300" :
                            "bg-gray-800/40 border border-gray-700/30 text-gray-600",
                          ].join(" ")}>
                            {s.done ? (
                              <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                            ) : s.active && !failed ? (
                              <Loader2 size={9} className="animate-spin" />
                            ) : null}
                            {s.label}
                            {s.key === "flash" && s.active && flashPct !== null && ` ${flashPct}%`}
                          </div>
                          {i < stages.length - 1 && <div className={["w-3 h-px flex-shrink-0", s.done ? "bg-green-700/60" : "bg-gray-700/40"].join(" ")} />}
                        </div>
                      ))}
                    </div>

                    {/* Flash progress bar */}
                    {(isFlashing || flashOk) && flashPct !== null && (
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-teal-500 rounded-full transition-all duration-300"
                          style={{ width: `${flashOk ? 100 : flashPct}%` }} />
                      </div>
                    )}

                    {/* Latest log line */}
                    {wsLog.length > 0 && (
                      <p className={`text-[11px] font-mono truncate ${
                        failed ? "text-red-400" : flashOk ? "text-green-400" : "text-gray-500"
                      }`}>{wsLog[wsLog.length - 1]}</p>
                    )}
                  </div>
                );
              })()}
            </section>}

            {/* ── Board Templates ── */}
            <section className="bg-gray-800/60 border border-gray-700/60 rounded-2xl px-4 py-3 flex-shrink-0">
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="flex items-center gap-2 w-full text-left"
              >
                <Gamepad2 size={13} className="text-violet-400" />
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Templates</span>
                <span className="text-[10px] text-gray-600 ml-1">start from a preset</span>
                <ChevronDown size={12} className={`ml-auto text-gray-600 transition-transform ${showTemplates ? "rotate-180" : ""}`} />
              </button>
              {showTemplates && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {(dbTemplates.length > 0 ? dbTemplates.map((t) => ({ id: t.id, emoji: t.emoji, label: t.label, desc: t.description, _db: t })) : BOARD_TEMPLATES.map((t) => ({ ...t, desc: t.desc, _db: null as DbTemplate | null }))).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => t._db ? applyTemplate(t._db) : applyTemplate(BOARD_TEMPLATES.find((b) => b.id === t.id)!)}
                      className="flex flex-col items-start gap-1 p-3 rounded-xl border border-gray-700 bg-gray-800/60 hover:bg-gray-700/80 hover:border-violet-700/50 transition-all text-left group"
                    >
                      <span className="text-xl leading-none">{t.emoji}</span>
                      <span className="text-xs font-semibold text-gray-200 group-hover:text-violet-200 transition-colors">{t.label}</span>
                      <span className="text-[10px] text-gray-500 leading-tight">{t.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

              {/* LED Config — hidden per user request, state kept for sketch generation */}
              {false && adminSettings.show_leds && <section className="bg-gray-900 border border-gray-800 border-l-2 border-l-yellow-800 rounded-2xl p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb size={13} className="text-yellow-400" />
                  <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">LED Indicators</h2>
                  <button onClick={() => setShowLedInfo(true)}
                    className="p-0.5 rounded text-gray-600 hover:text-yellow-400 transition-colors"
                    title="LED wiring guide"
                  ><Info size={13} /></button>
                </div>

                {/* Status LED */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-semibold text-gray-300">Status LED</span>
                      <p className="text-[11px] text-gray-600">Lights up when Arduino is connected &amp; active</p>
                    </div>
                    <div onClick={() => setLeds((l) => ({ ...l, enabled: !l.enabled }))}
                      className={["relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0",
                        leds.enabled ? "bg-yellow-500" : "bg-gray-700"].join(" ")}
                    >
                      <div className={["absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        leds.enabled ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
                    </div>
                  </div>
                  {leds.enabled && (
                    <div className="flex flex-col gap-2 mt-2 bg-gray-800/50 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)] flex-shrink-0" />
                        <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Active</span>
                        <PinSelect label="" value={leds.onPin}
                          onChange={(v) => setLeds((l) => ({ ...l, onPin: v }))}
                          excludePins={usedPins.filter((p) => p !== leds.onPin)} />
                        <span className="text-[10px] text-green-700 bg-green-950/50 px-1.5 py-0.5 rounded-full">on = active</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)] flex-shrink-0" />
                        <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Inactive</span>
                        <PinSelect label="" value={leds.offPin}
                          onChange={(v) => setLeds((l) => ({ ...l, offPin: v }))}
                          excludePins={usedPins.filter((p) => p !== leds.offPin)} />
                        <span className="text-[10px] text-red-900 bg-red-950/50 px-1.5 py-0.5 rounded-full">on = inactive</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Press LEDs */}
                <div className="border-t border-gray-800 pt-4">
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-gray-300">Press LEDs</span>
                    <p className="text-[11px] text-gray-600">Light up while a button is held or toggled on</p>
                  </div>

                  {/* Existing button LEDs */}
                  {buttons.filter((b) => (b.ledPin ?? -1) >= 0).length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-3">
                      {buttons.filter((b) => (b.ledPin ?? -1) >= 0).map((b) => (
                        <div key={b.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_5px_rgba(251,191,36,0.7)] flex-shrink-0" />
                          <span className="text-xs text-gray-300 flex-1 truncate">{b.name || "Button"}</span>
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded">D{b.ledPin}</span>
                          <span className="text-[10px] text-yellow-800 bg-yellow-950/50 px-1.5 py-0.5 rounded-full">
                            {b.mode === "toggle" ? "on = toggled" : "on = held"}
                          </span>
                          <button onClick={() => updateButton(b.id, { ledPin: -1 })}
                            className="text-gray-700 hover:text-red-400 transition-colors ml-1"
                          ><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add LED to a button */}
                  {buttons.filter((b) => (b.ledPin ?? -1) < 0).length > 0 && (
                    <div className="flex gap-2 items-center">
                      <select value={addLedBtnId} onChange={(e) => setAddLedBtnId(e.target.value)}
                        className="flex-1 appearance-none bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none cursor-pointer"
                      >
                        <option value="">Add LED to button…</option>
                        {buttons.filter((b) => (b.ledPin ?? -1) < 0).map((b) => <option key={b.id} value={b.id}>{b.name || "Button"}</option>)}
                      </select>
                      {addLedBtnId && (
                        <>
                          <div className="relative" style={{ width: 72 }}>
                            <select value={addLedPin} onChange={(e) => setAddLedPin(parseInt(e.target.value))}
                              className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none cursor-pointer pr-5"
                            >
                              <option value={-1}>Pin…</option>
                              {ALL_PINS.filter((p) => !usedPins.includes(p)).map((p) => <option key={p} value={p}>D{p}</option>)}
                            </select>
                            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                          </div>
                          <button
                            disabled={addLedPin < 0}
                            onClick={() => { updateButton(addLedBtnId, { ledPin: addLedPin }); setAddLedBtnId(""); setAddLedPin(-1); }}
                            className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white text-xs font-medium transition-colors flex-shrink-0"
                          >Add</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>}

            {/* Inputs — full width below */}
            {adminSettings.show_buttons && <section className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-4 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Pencil size={13} className="text-purple-400" />
                  <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Inputs</h2>
                </div>
                <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                  {buttons.length + portInputs.length + irSensors.length + sipPuffs.length + joysticks.length}
                </span>
              </div>

              {/* Unified input list — responsive grid */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 min-w-0">
                  {buttons.map((btn, i) => (
                    <ButtonCard key={btn.id} button={btn} index={i} usedPins={usedPins}
                      onUpdate={updateButton} onRemove={removeButton} typeLabel={btn.subtype === "button" ? "Button" : "Switch"}
                      isSelected={selectedInputId === btn.id} onSelect={setSelectedInputId} />
                  ))}
                  {portInputs.map((p, i) => (
                    <ButtonCard key={p.id} button={p} index={i} usedPins={usedPins}
                      onUpdate={updatePort} onRemove={removePort} typeLabel="Port"
                      isSelected={selectedInputId === p.id} onSelect={setSelectedInputId} />
                  ))}
                  {irSensors.map((s, i) => (
                    <div key={s.id} className="sm:col-span-2 lg:col-span-1">
                      <IRSensorCard sensor={s} index={i} usedPins={usedPins}
                        onUpdate={updateIR} onRemove={removeIR}
                        isSelected={selectedInputId === s.id} onSelect={setSelectedInputId} />
                    </div>
                  ))}
                  {sipPuffs.map((s, i) => (
                    <div key={s.id} className="sm:col-span-2 lg:col-span-1">
                      <SipPuffCard sensor={s} index={i} usedPins={usedPins}
                        onUpdate={updateSipPuff} onRemove={removeSipPuff}
                        isSelected={selectedInputId === s.id} onSelect={setSelectedInputId} />
                    </div>
                  ))}
                  {joysticks.map((j, i) => (
                    <div key={j.id} className="sm:col-span-2">
                      <JoystickCard joy={j} index={i} usedPins={usedPins} usedAnalogPins={usedAnalogPins}
                        onUpdate={updateJoystick} onRemove={removeJoystick}
                        isSelected={selectedInputId === j.id} onSelect={setSelectedInputId} />
                    </div>
                  ))}
                  {buttons.length + portInputs.length + irSensors.length + sipPuffs.length + joysticks.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-10 text-gray-700">
                      <Plus size={24} className="mb-2 opacity-30" />
                      <p className="text-xs">No inputs yet — add one below</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Add input — centered icon pill buttons */}
              <div className="mt-3 pt-3 border-t border-gray-800 flex-shrink-0" data-tutorial="add-input">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold text-center mb-2">Add Input</p>
                <div className="flex justify-center">
                <div className="inline-flex flex-wrap justify-center gap-2">
                  {([
                    { type: "micro-switch",  label: "Micro Switch",  icon: <Keyboard size={13} />,  color: "hover:bg-blue-600/20 hover:border-blue-500/50 hover:text-blue-300"    },
                    { type: "button",        label: "Button",        icon: <Square size={13} />,    color: "hover:bg-indigo-600/20 hover:border-indigo-500/50 hover:text-indigo-300" },
                    { type: "joystick",      label: "Joystick",      icon: <Joystick size={13} />,  color: "hover:bg-violet-600/20 hover:border-violet-500/50 hover:text-violet-300" },
                    { type: "ir-sensor",     label: "IR Sensor",     icon: <Radio size={13} />,     color: "hover:bg-green-600/20 hover:border-green-500/50 hover:text-green-300"  },
                    { type: "sip-puff",      label: "Sip & Puff",    icon: <Wind size={13} />,      color: "hover:bg-cyan-600/20 hover:border-cyan-500/50 hover:text-cyan-300"    },
                  ] as const).map(({ type, label, icon, color }) => (
                    <button key={type}
                      onClick={() => addInputByType(type)}
                      className={["flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-700 bg-gray-800/60 text-gray-400 text-xs font-medium transition-all", color].join(" ")}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
                </div>
              </div>
            </section>}
          </div>
          </div>
        </div>
      )}

      {/* ══ REMAP TAB ══════════════════════════════════════════════════════ */}
      {tab === "remap" && (
        <RemapModal
          inline
          backendUrl={BACKEND_URL}
          selectedPort={selectedPort}
          onClose={() => setTab("configure")}
          onSave={(remapEntries: RemapEntry[]) => {
            const applyRemap = (entries: RemapEntry[]) => {
              setButtons((prev) => prev.map((b) => {
                const e = entries.find((e) => (e.type === "button" || e.type === "port") && e.pin === `D${b.pin}` && e.arduinoKey === b.arduinoKey);
                return e && e.newKey !== e.arduinoKey ? { ...b, arduinoKey: e.newKey, keyDisplay: e.newDisplay } : b;
              }));
              setPortInputs((prev) => prev.map((p) => {
                const e = entries.find((e) => (e.type === "button" || e.type === "port") && e.pin === `D${p.pin}` && e.arduinoKey === p.arduinoKey);
                return e && e.newKey !== e.arduinoKey ? { ...p, arduinoKey: e.newKey, keyDisplay: e.newDisplay } : p;
              }));
              setIrSensors((prev) => prev.map((ir) => {
                const e = entries.find((e) => e.type === "ir" && e.pin === `D${ir.pin}` && e.arduinoKey === ir.arduinoKey);
                return e && e.newKey !== e.arduinoKey ? { ...ir, arduinoKey: e.newKey, keyDisplay: e.newDisplay } : ir;
              }));
              setSipPuffs((prev) => prev.map((sp) => {
                const e = entries.find((e) => e.type === "sipPuff" && e.pin === `D${sp.pin}` && e.arduinoKey === sp.key);
                return e && e.newKey !== e.arduinoKey ? { ...sp, key: e.newKey, keyDisplay: e.newDisplay } : sp;
              }));
              setJoysticks((prev) => prev.map((j) => {
                const pin = `A${j.xPin}`;
                const up    = entries.find((e) => e.type === "joystick-up"    && e.pin === pin && e.arduinoKey === j.upKey);
                const down  = entries.find((e) => e.type === "joystick-down"  && e.pin === pin && e.arduinoKey === j.downKey);
                const left  = entries.find((e) => e.type === "joystick-left"  && e.pin === pin && e.arduinoKey === j.leftKey);
                const right = entries.find((e) => e.type === "joystick-right" && e.pin === pin && e.arduinoKey === j.rightKey);
                const btn   = entries.find((e) => e.type === "joystick-btn"   && e.pin === pin && e.arduinoKey === j.buttonKey);
                return {
                  ...j,
                  ...(up    && up.newKey    !== up.arduinoKey    ? { upKey:     up.newKey,    upDisplay:     up.newDisplay }    : {}),
                  ...(down  && down.newKey  !== down.arduinoKey  ? { downKey:   down.newKey,  downDisplay:   down.newDisplay }  : {}),
                  ...(left  && left.newKey  !== left.arduinoKey  ? { leftKey:   left.newKey,  leftDisplay:   left.newDisplay }  : {}),
                  ...(right && right.newKey !== right.arduinoKey ? { rightKey:  right.newKey, rightDisplay:  right.newDisplay } : {}),
                  ...(btn   && btn.newKey   !== btn.arduinoKey   ? { buttonKey: btn.newKey,   buttonDisplay: btn.newDisplay }   : {}),
                };
              }));
            };
            applyRemap(remapEntries);
          }}
          onUploadSketch={(remapEntries: RemapEntry[]) => {
            setTab("configure");
            const updatedButtons = buttons.map((b) => {
              const entry = remapEntries.find((e) => (e.type === "button" || e.type === "port") && e.pin === `D${b.pin}` && e.arduinoKey === b.arduinoKey);
              if (!entry || entry.newKey === entry.arduinoKey) return b;
              return { ...b, arduinoKey: entry.newKey, keyDisplay: entry.newDisplay };
            });
            const updatedPorts = portInputs.map((p) => {
              const entry = remapEntries.find((e) => (e.type === "button" || e.type === "port") && e.pin === `D${p.pin}` && e.arduinoKey === p.arduinoKey);
              if (!entry || entry.newKey === entry.arduinoKey) return p;
              return { ...p, arduinoKey: entry.newKey, keyDisplay: entry.newDisplay };
            });
            const updatedIr = irSensors.map((ir) => {
              const entry = remapEntries.find((e) => e.type === "ir" && e.pin === `D${ir.pin}` && e.arduinoKey === ir.arduinoKey);
              if (!entry || entry.newKey === entry.arduinoKey) return ir;
              return { ...ir, arduinoKey: entry.newKey, keyDisplay: entry.newDisplay };
            });
            const updatedSp = sipPuffs.map((sp) => {
              const entry = remapEntries.find((e) => e.type === "sipPuff" && e.pin === `D${sp.pin}` && e.arduinoKey === sp.key);
              if (!entry || entry.newKey === entry.arduinoKey) return sp;
              return { ...sp, key: entry.newKey, keyDisplay: entry.newDisplay };
            });
            const updatedJoysticks = joysticks.map((j) => {
              const pin = `A${j.xPin}`;
              const up    = remapEntries.find((e) => e.type === "joystick-up"    && e.pin === pin && e.arduinoKey === j.upKey);
              const down  = remapEntries.find((e) => e.type === "joystick-down"  && e.pin === pin && e.arduinoKey === j.downKey);
              const left  = remapEntries.find((e) => e.type === "joystick-left"  && e.pin === pin && e.arduinoKey === j.leftKey);
              const right = remapEntries.find((e) => e.type === "joystick-right" && e.pin === pin && e.arduinoKey === j.rightKey);
              const btn   = remapEntries.find((e) => e.type === "joystick-btn"   && e.pin === pin && e.arduinoKey === j.buttonKey);
              return {
                ...j,
                ...(up    && up.newKey    !== up.arduinoKey    ? { upKey:     up.newKey,    upDisplay:     up.newDisplay }    : {}),
                ...(down  && down.newKey  !== down.arduinoKey  ? { downKey:   down.newKey,  downDisplay:   down.newDisplay }  : {}),
                ...(left  && left.newKey  !== left.arduinoKey  ? { leftKey:   left.newKey,  leftDisplay:   left.newDisplay }  : {}),
                ...(right && right.newKey !== right.arduinoKey ? { rightKey:  right.newKey, rightDisplay:  right.newDisplay } : {}),
                ...(btn   && btn.newKey   !== btn.arduinoKey   ? { buttonKey: btn.newKey,   buttonDisplay: btn.newDisplay }   : {}),
              };
            });
            setButtons(updatedButtons);
            setPortInputs(updatedPorts);
            setIrSensors(updatedIr);
            setSipPuffs(updatedSp);
            setJoysticks(updatedJoysticks);
            setTimeout(() => handleWebSerialUpload(false), 100);
          }}
        />
      )}

      {/* ══ TEST TAB ═══════════════════════════════════════════════════════ */}
      {tab === "test" && (
        <div className="flex-1 overflow-hidden flex gap-0">

          {/* ── Main content ── */}
          <div className="flex-1 overflow-y-auto min-w-0">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">

              {/* Game area + selector */}
              {(adminSettings.show_games ?? true) && <div className="flex gap-4 items-start">
                {/* Game canvas */}
                <div className="flex-1 bg-gray-800/60 border border-gray-700/60 rounded-2xl overflow-hidden min-w-0">
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
                    {selectedGame === "dino" && <DinoGame jumpKeys={jumpKeys} onGameOver={handleDinoGameOver} />}
                    {selectedGame === "snake" && <SnakeGame joystickMaps={joystickMaps} />}
                    {selectedGame === "pong" && <PongGame joystickMaps={joystickMaps[0] ? { up: [joystickMaps[0].up], down: [joystickMaps[0].down] } : undefined} />}
                  </div>
                </div>
                {/* Game selector + leaderboard */}
                <div className="w-40 flex-shrink-0 flex flex-col gap-3">
                  <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-3 flex flex-col gap-1.5">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide px-1 mb-1">Games</p>
                    {([
                      { id: "dino",  label: "Dino",  emoji: "🦕", hint: "↑ jump ↓ duck" },
                      { id: "snake", label: "Snake", emoji: "🐍", hint: "Arrows / WASD" },
                      { id: "pong",  label: "Pong",  emoji: "🏓", hint: "W/S or ↑/↓" },
                    ] as const).map((g) => (
                      <button key={g.id} onClick={() => setSelectedGame(g.id)}
                        className={["w-full text-left px-3 py-2 rounded-xl transition-all",
                          selectedGame === g.id
                            ? "bg-purple-600/20 border border-purple-600/40 text-purple-300"
                            : "border border-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">{g.emoji}</span>
                          <span className="text-xs font-medium">{g.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-0.5 pl-6">{g.hint}</p>
                      </button>
                    ))}
                  </div>
                  {selectedGame === "dino" && (
                    <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-3">
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide px-1 mb-2">Top Scores</p>
                      {dinoLeaderboard.length === 0 ? (
                        <p className="text-[11px] text-gray-600 px-1">No scores yet</p>
                      ) : (
                        <ol className="flex flex-col gap-1.5">
                          {dinoLeaderboard.map((entry, i) => (
                            <li key={entry.username} className="flex items-center gap-1.5 px-1">
                              <span className="text-[10px]">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                              <span className="text-[11px] text-gray-300 truncate flex-1">{entry.username}</span>
                              <span className="text-[11px] font-mono text-purple-300">{entry.score}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              </div>}

              {/* Device Tester — tabbed: Mockup / All Inputs / Controller */}
              <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl overflow-hidden">
                {/* Sub-tab bar */}
                <div className="flex items-center gap-1 px-4 py-2.5 border-b border-gray-800 bg-gray-900/80">
                  <Zap size={13} className="text-blue-400 mr-1" />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider mr-3">Device Tester</span>
                  {(["inputs", "controller", "mockup"] as const).filter((v) => v !== "controller" || (adminSettings.show_controller ?? true)).map((v) => (
                    <button key={v} onClick={() => setDeviceView(v)}
                      className={["px-3 py-1 rounded-lg text-xs font-medium transition-all",
                        deviceView === v
                          ? "bg-blue-600/20 border border-blue-600/40 text-blue-300"
                          : "text-gray-500 hover:text-gray-300 hover:bg-gray-800",
                      ].join(" ")}
                    >
                      {v === "mockup" ? "Mockup" : v === "inputs" ? "All Inputs" : "Controller"}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowSerialMonitor((s) => !s)}
                    title={showSerialMonitor ? "Hide Serial Monitor" : "Show Serial Monitor"}
                    className={["ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                      showSerialMonitor
                        ? "bg-green-600/20 border border-green-600/40 text-green-400"
                        : "text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-transparent",
                    ].join(" ")}
                  >
                    <Terminal size={11} />
                    Serial
                  </button>
                </div>
                <div className="p-5">
                  {deviceView === "mockup" && <DeviceMockup buttons={buttons} leds={leds} ports={portInputs} />}
                  {deviceView === "controller" && <ControllerMockup buttons={buttons} ports={portInputs} joysticks={joysticks} />}
                  {deviceView === "inputs" && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[...buttons, ...portInputs].map((b) => {
                        const browserKey = b.arduinoKey.startsWith("KEY_") ? b.arduinoKey.replace("KEY_","").replace("_ARROW","").replace("_"," ") : b.arduinoKey.toUpperCase();
                        return (
                          <div key={b.id} className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                            <span className="text-xs text-gray-300 truncate flex-1">{b.name || "Unnamed"}</span>
                            <span className="text-[10px] font-mono text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">D{b.pin}</span>
                            {b.arduinoKey && <span className="text-[10px] font-mono text-blue-300 flex-shrink-0">{browserKey}</span>}
                          </div>
                        );
                      })}
                      {joysticks.map((j) => (
                        <div key={j.id} className="flex items-center gap-2 bg-gray-800/60 border border-violet-700/30 rounded-xl px-3 py-2 col-span-2">
                          <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                          <span className="text-xs text-gray-300 truncate flex-1">{j.name || "Joystick"}</span>
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">A{j.xPin}/A{j.yPin}</span>
                          <span className="text-[10px] text-violet-300 font-mono">W A S D</span>
                        </div>
                      ))}
                      {irSensors.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 bg-gray-800/60 border border-green-700/30 rounded-xl px-3 py-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                          <span className="text-xs text-gray-300 truncate flex-1">{s.name || "IR Sensor"}</span>
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">D{s.pin}</span>
                        </div>
                      ))}
                      {sipPuffs.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 bg-gray-800/60 border border-cyan-700/30 rounded-xl px-3 py-2">
                          <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
                          <span className="text-xs text-gray-300 truncate flex-1">{s.name || "Sip & Puff"}</span>
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">D{s.pin}</span>
                        </div>
                      ))}
                      {buttons.length + portInputs.length + irSensors.length + sipPuffs.length + joysticks.length === 0 && (
                        <p className="col-span-full text-xs text-gray-600 text-center py-4">No inputs configured yet</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* ── Serial Monitor sidebar ── */}
          {showSerialMonitor && (
            <div className="w-72 flex-shrink-0 border-l border-gray-800 bg-black flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800 bg-gray-950 flex-shrink-0">
                <Terminal size={12} className="text-green-400" />
                <span className="text-[11px] font-semibold text-green-400 font-mono tracking-wide uppercase">Serial Monitor</span>
                <button onClick={() => setSerialLog([])}
                  className="ml-auto text-[10px] text-gray-700 hover:text-red-400 transition-colors font-mono"
                >[CLR]</button>
                <button onClick={() => setShowSerialMonitor(false)}
                  className="text-gray-700 hover:text-gray-400 transition-colors ml-1"
                  title="Close Serial Monitor"
                >
                  <X size={13} />
                </button>
              </div>
              <div ref={serialLogRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-5">
                {serialLog.length === 0 ? (
                  <p className="text-gray-700">{">"} waiting for input_</p>
                ) : (
                  serialLog.map((entry, i) => (
                    <div key={i} className="flex gap-2 hover:bg-green-950/10">
                      <span className="text-gray-600 flex-shrink-0 select-none">[{entry.time}]</span>
                      <span className="text-green-400">{entry.key}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══ ADMIN TAB ══════════════════════════════════════════════════════ */}
      {tab === "admin" && appUser && isAdmin(appUser.username) && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Admin sub-nav */}
          <div className="flex-shrink-0 border-b border-gray-700/60 bg-gray-800/40 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto flex items-center gap-1 py-2">
              <div className="flex items-center gap-2 mr-4">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Settings size={11} className="text-amber-400" />
                </div>
                <span className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-wider">Admin</span>
              </div>
              {([
                { id: "settings", label: "Settings" },
                { id: "users", label: `Users (${allUsers.length})` },
                { id: "issues", label: `Issues${allIssues.filter(i => i.status === "open").length > 0 ? ` (${allIssues.filter(i => i.status === "open").length})` : ""}` },
                { id: "railway", label: "Railway" },
              ] as const).map((st) => (
                <button key={st.id} onClick={() => {
                  setAdminSubTab(st.id);
                  if (st.id === "issues" && !issuesLoaded) {
                    loadAllIssues().then(d => { setAllIssues(d); setIssuesLoaded(true); });
                  }
                }}
                  className={["px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    adminSubTab === st.id
                      ? st.id === "railway" ? "bg-yellow-900/40 text-yellow-200" : st.id === "issues" ? "bg-red-900/40 text-red-200" : "bg-gray-800 text-gray-100"
                      : st.id === "issues" && allIssues.some(i => i.status === "open") ? "text-red-400 hover:text-red-300" : "text-gray-500 hover:text-gray-300"].join(" ")}
                >{st.label}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">

            {/* ── SETTINGS SUB-TAB ── */}
            {adminSubTab === "settings" && (<>

              {/* Feature Toggles */}
              <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
                  <Power size={13} className="text-blue-400" />
                  <h3 className="text-xs font-semibold text-gray-200">Feature Visibility</h3>
                  <span className="ml-auto text-[10px] text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Live · Instant for all users</span>
                </div>
                <div className="divide-y divide-gray-800/60">
                  {([
                    { key: "show_upload"      as const, label: "Compile & Upload",    desc: "Show the upload button and compile log",              icon: <Upload size={13} className="text-green-400" />,    group: "core" },
                    { key: "show_buttons"     as const, label: "Configure Inputs",    desc: "Show the main input configuration panel",             icon: <Keyboard size={13} className="text-blue-400" />,   group: "core" },
                    { key: "show_sensors"     as const, label: "Sensors & Joysticks", desc: "Show IR, sip & puff, and joystick input types",       icon: <Radio size={13} className="text-emerald-400" />,   group: "core" },
                    { key: "show_wiring"      as const, label: "Wiring Diagram",      desc: "Show the wiring diagram icon in the header",          icon: <Zap size={13} className="text-orange-400" />,      group: "core" },
                    { key: "show_games"       as const, label: "Games Section",       desc: "Show Dino, Snake, and Pong in the Test tab",          icon: <Gamepad2 size={13} className="text-violet-400" />, group: "test" },
                    { key: "show_controller"  as const, label: "Controller View",     desc: "Show the controller mockup in the Test tab",          icon: <Gamepad2 size={13} className="text-pink-400" />,   group: "test" },
                    { key: "show_tutorial"    as const, label: "Interactive Tutorial", desc: "Enable the guided tour (guests always see it)",      icon: <Info size={13} className="text-violet-400" />,     group: "ux" },
                    { key: "maintenance_mode" as const, label: "Maintenance Mode",    desc: "Show a maintenance banner to all non-admin users",    icon: <Settings size={13} className="text-red-400" />,    group: "ux" },
                  ] as { key: keyof AdminSettings; label: string; desc: string; icon: React.ReactNode; group: string }[]).map(({ key, label, desc, icon }) => (
                    <div key={key} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">{icon}</div>
                        <div>
                          <p className="text-sm text-gray-200">{label}</p>
                          <p className="text-[11px] text-gray-600">{desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const next = !(adminSettings[key] as boolean);
                          setAdminSettings((s) => { const n = { ...s, [key]: next }; localStorage.setItem("adminSettings", JSON.stringify(n)); return n; });
                          await updateAdminSettings({ [key]: next } as Partial<AdminSettings>);
                        }}
                        className={["relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ml-6",
                          (adminSettings[key] as boolean) ? "bg-blue-600" : "bg-gray-700"].join(" ")}
                      >
                        <div className={["absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                          (adminSettings[key] as boolean) ? "translate-x-5" : "translate-x-1"].join(" ")} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditional extras for toggles */}
              {adminSettings.maintenance_mode && (
                <div className="bg-gray-900 border border-red-900/40 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-red-400 mb-2">Maintenance Message</p>
                  <p className="text-[11px] text-gray-600 mb-3">Shown in the banner to all non-admin users while maintenance mode is on.</p>
                  <input
                    type="text"
                    value={adminSettings.welcome_message ?? ""}
                    onChange={async (e) => {
                      const msg = e.target.value;
                      setAdminSettings((s) => { const n = { ...s, welcome_message: msg }; localStorage.setItem("adminSettings", JSON.stringify(n)); return n; });
                      await updateAdminSettings({ welcome_message: msg });
                    }}
                    placeholder="The app is temporarily unavailable…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              )}

              {adminSettings.show_tutorial && (
                <div className="bg-gray-900 border border-violet-900/40 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-violet-300 mb-1">Tutorial Version: <span className="font-mono">{adminSettings.tutorial_version ?? 0}</span></p>
                      <p className="text-[11px] text-gray-600">Increment this to reset the tour for all logged-in users — they'll see it again on next load. Guests always see it.</p>
                    </div>
                    <button
                      onClick={async () => {
                        const next = (adminSettings.tutorial_version ?? 0) + 1;
                        setAdminSettings((s) => { const n = { ...s, tutorial_version: next }; localStorage.setItem("adminSettings", JSON.stringify(n)); return n; });
                        await updateAdminSettings({ tutorial_version: next });
                      }}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-700/40 hover:bg-violet-700/70 border border-violet-600/50 text-violet-200 transition-colors"
                    >Reset for Everyone</button>
                  </div>
                </div>
              )}

              {/* Templates */}
              <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
                  <Code size={13} className="text-violet-400" />
                  <h3 className="text-xs font-semibold text-gray-200">Templates</h3>
                  <span className="text-[10px] text-gray-600 ml-1">shown in Configure tab</span>
                  <button
                    onClick={async () => {
                      const id = await upsertDbTemplate(null, "New Template", "🎯", "", { buttons: [], portInputs: [], leds: { enabled: false, onPin: 11, offPin: 12 }, irSensors: [], sipPuffs: [], joysticks: [] } as unknown as import("@/lib/supabase").UserConfig);
                      if (id) {
                        const t: DbTemplate = { id, label: "New Template", emoji: "🎯", description: "", config: { buttons: [], portInputs: [], leds: { enabled: false, onPin: 11, offPin: 12 }, irSensors: [], sipPuffs: [], joysticks: [] } as unknown as import("@/lib/supabase").UserConfig, sort_order: dbTemplates.length };
                        setDbTemplates((prev) => [...prev, t]);
                        setEditingTemplate(id);
                      }
                    }}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/20 border border-violet-600/30 text-[11px] text-violet-300 hover:bg-violet-600/30 transition-colors"
                  ><Plus size={11} /> New</button>
                </div>
                <div className="p-5">
                  {dbTemplates.length === 0 ? (
                    <p className="text-[11px] text-gray-600">No DB templates yet. Create one or promote a user save from the Users tab. Until created, the app uses built-in templates.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {dbTemplates.map((t) => (
                        <div key={t.id} className="border border-gray-700 rounded-xl p-3 bg-gray-800/40">
                          {deleteConfirmTemplateId === t.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-300 flex-1">Delete &ldquo;{t.label}&rdquo;?</span>
                              <button onClick={async () => { await deleteDbTemplate(t.id); setDbTemplates((p) => p.filter((x) => x.id !== t.id)); setDeleteConfirmTemplateId(null); }} className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-[11px] text-white font-medium">Delete</button>
                              <button onClick={() => setDeleteConfirmTemplateId(null)} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-[11px] text-gray-300">Cancel</button>
                            </div>
                          ) : editingTemplate === t.id ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <input value={t.emoji} onChange={(e) => setDbTemplates((p) => p.map((x) => x.id === t.id ? { ...x, emoji: e.target.value } : x))} className="w-12 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-violet-500" maxLength={2} />
                                <input value={t.label} onChange={(e) => setDbTemplates((p) => p.map((x) => x.id === t.id ? { ...x, label: e.target.value } : x))} placeholder="Template name" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500" />
                              </div>
                              <input value={t.description} onChange={(e) => setDbTemplates((p) => p.map((x) => x.id === t.id ? { ...x, description: e.target.value } : x))} placeholder="Short description…" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500" />
                              <div className="flex gap-2 justify-end">
                                <button onClick={async () => { await upsertDbTemplate(t.id, t.label, t.emoji, t.description, t.config); setEditingTemplate(null); }} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-[11px] text-white font-medium transition-colors">Save</button>
                                <button onClick={() => setEditingTemplate(null)} className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-[11px] text-gray-300 transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-lg leading-none">{t.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-200">{t.label}</p>
                                {t.description && <p className="text-[10px] text-gray-500 truncate">{t.description}</p>}
                              </div>
                              <button onClick={() => setEditingTemplate(t.id)} className="p-1.5 rounded-lg text-gray-600 hover:text-violet-400 hover:bg-violet-900/20 transition-colors"><Pencil size={11} /></button>
                              <button onClick={() => setDeleteConfirmTemplateId(t.id)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"><Trash2 size={11} /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* App Config (read-only info) */}
              <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
                  <Terminal size={13} className="text-purple-400" />
                  <h3 className="text-xs font-semibold text-gray-200">System Info</h3>
                </div>
                <div className="p-5 flex flex-col gap-3">
                  <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <p className="text-[11px] font-medium text-gray-400 mb-1">Compile Backend</p>
                    <code className="text-[11px] text-green-400 font-mono break-all">{BACKEND_URL}</code>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <p className="text-[11px] font-medium text-gray-400 mb-1">Board FQBN</p>
                    <code className="text-[11px] text-blue-400 font-mono">arduino:avr:leonardo</code>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <p className="text-[11px] font-medium text-gray-400 mb-1.5">Admin Accounts</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {["jacob.majors", "ramsey.musallam"].map((u) => (
                        <span key={u} className="text-[11px] font-mono text-amber-400 bg-amber-900/20 border border-amber-800/40 px-2 py-0.5 rounded-full">{u}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </>)}

            {/* ── USERS SUB-TAB ── */}
            {adminSubTab === "users" && (<>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Registered Users", value: allUsers.length, color: "text-blue-400" },
                  { label: "Total Saves", value: Object.values(userSaveCounts).reduce((a, b) => a + b, 0), color: "text-violet-400" },
                  { label: "Admin Accounts", value: allUsers.filter((u) => isAdmin(u.username)).length, color: "text-amber-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-4 text-center">
                    <p className={`text-2xl font-black ${s.color} leading-none mb-1`}>{s.value}</p>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* User list */}
              <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
                  <h3 className="text-xs font-semibold text-gray-200">All Users</h3>
                  <div className="flex-1 ml-3">
                    <input
                      type="text"
                      placeholder="Search…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                    />
                  </div>
                </div>

                {allUsers.length === 0 ? (
                  <p className="text-xs text-gray-600 p-5">No users yet.</p>
                ) : (
                  <div className="divide-y divide-gray-800/60">
                    {allUsers.filter((u) => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase())).map((u) => (
                      <div key={u.id}>
                        {/* User row */}
                        <button
                          onClick={async () => {
                            if (expandedUserId === u.id) {
                              setExpandedUserId(null); setShadowUser(null); setShadowSaves([]);
                            } else {
                              setExpandedUserId(u.id); setShadowUser(u);
                              const saves = await loadAllSaves(u.id);
                              setShadowSaves(saves); setShadowSaveIndex(0);
                              setUserSaveCounts((prev) => ({ ...prev, [u.id]: saves.length }));
                            }
                          }}
                          className={["w-full flex items-center gap-3 px-5 py-3 text-left transition-all",
                            expandedUserId === u.id ? "bg-violet-600/10" : "hover:bg-gray-800/50"].join(" ")}
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">{u.username[0].toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-200 font-medium truncate">{u.username}</span>
                              {isAdmin(u.username) && <span className="text-[9px] text-amber-400 bg-amber-900/30 border border-amber-800/40 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">admin</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[11px] text-gray-600">{userSaveCounts[u.id] ?? "…"} saves</span>
                              {u.created_at && <span className="text-[11px] text-gray-700">Joined {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
                              {u.last_active_at && (
                                <span className="text-[11px] text-gray-600">
                                  Active {(() => {
                                    const mins = Math.floor((Date.now() - new Date(u.last_active_at).getTime()) / 60000);
                                    if (mins < 2) return "just now";
                                    if (mins < 60) return `${mins}m ago`;
                                    const hrs = Math.floor(mins / 60);
                                    if (hrs < 24) return `${hrs}h ago`;
                                    return `${Math.floor(hrs / 24)}d ago`;
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Tutorial completion badge */}
                          <span className={["text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0",
                            (u as AppUser & { tutorial_completed?: boolean }).tutorial_completed
                              ? "bg-green-900/30 border-green-700/40 text-green-400"
                              : "bg-gray-800 border-gray-700 text-gray-600"
                          ].join(" ")}>
                            {(u as AppUser & { tutorial_completed?: boolean }).tutorial_completed ? "✓ Tour done" : "Tour pending"}
                          </span>
                          <ChevronDown size={13} className={["text-gray-600 transition-transform flex-shrink-0 ml-1", expandedUserId === u.id ? "rotate-180" : ""].join(" ")} />
                        </button>

                        {/* Expanded detail */}
                        {expandedUserId === u.id && (
                          <div className="px-5 pb-4 pt-3 bg-gray-950/40 border-t border-gray-800/40">
                            {/* Delete */}
                            {!isAdmin(u.username) && (
                              <div className="mb-3">
                                {deleteConfirmUserId === u.id ? (
                                  <div className="flex items-center gap-2 p-2.5 bg-red-950/30 border border-red-800/40 rounded-xl">
                                    <XCircle size={13} className="text-red-400 flex-shrink-0" />
                                    <span className="text-xs text-red-300 flex-1">Delete {u.username} and all their saves?</span>
                                    <button onClick={async () => { await deleteUser(u.id); setAllUsers((p) => p.filter((x) => x.id !== u.id)); setUserSaveCounts((p) => { const n = { ...p }; delete n[u.id]; return n; }); setDeleteConfirmUserId(null); setExpandedUserId(null); }} className="text-[11px] font-semibold text-red-400 bg-red-900/40 hover:bg-red-900/60 border border-red-700/50 px-2.5 py-1 rounded-lg transition-colors">Yes, delete</button>
                                    <button onClick={() => setDeleteConfirmUserId(null)} className="text-[11px] text-gray-500 hover:text-gray-300 px-2 py-1 transition-colors">Cancel</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteConfirmUserId(u.id)} className="flex items-center gap-1.5 text-[11px] text-red-500 hover:text-red-400 transition-colors">
                                    <Trash2 size={11} /> Delete user &amp; all saves
                                  </button>
                                )}
                              </div>
                            )}
                            {/* Saves */}
                            {shadowSaves.length === 0 ? (
                              <p className="text-xs text-gray-700 py-1">No saves yet.</p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2">Saved configs</p>
                                {shadowSaves.length > 1 && (
                                  <select value={shadowSaveIndex} onChange={(e) => setShadowSaveIndex(parseInt(e.target.value))} className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none mb-2">
                                    {shadowSaves.map((s, i) => <option key={s.id} value={i}>{s.name} · {new Date(s.updated_at).toLocaleDateString()}</option>)}
                                  </select>
                                )}
                                {(() => {
                                  const save = shadowSaves[shadowSaveIndex];
                                  if (!save) return null;
                                  const cfg = save.config;
                                  const btns = (cfg.buttons ?? []) as ButtonConfig[];
                                  const irs = (cfg.irSensors ?? []) as IRSensorConfig[];
                                  const sps = (cfg.sipPuffs ?? []) as SipPuffConfig[];
                                  const joys = (cfg.joysticks ?? []) as JoystickConfig[];
                                  return (
                                    <>
                                    <div className="bg-gray-950 rounded-xl p-3 space-y-3">
                                      <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                                        <span className="text-blue-400 font-semibold">{btns.length} buttons</span>
                                        {irs.length > 0 && <span className="text-emerald-400 font-semibold">{irs.length} IR</span>}
                                        {sps.length > 0 && <span className="text-cyan-400 font-semibold">{sps.length} sip&amp;puff</span>}
                                        {joys.length > 0 && <span className="text-violet-400 font-semibold">{joys.length} joystick</span>}
                                        <span className="ml-auto text-gray-700">Updated {new Date(save.updated_at).toLocaleDateString()}</span>
                                      </div>
                                      {btns.map((b) => (
                                        <div key={b.id} className="flex items-center gap-2 text-xs">
                                          <span className="font-mono text-blue-400 w-8 flex-shrink-0">D{b.pin}</span>
                                          <span className="text-gray-400 truncate flex-1">{b.name || "(unnamed)"}</span>
                                          <span className="text-gray-600 font-mono text-[11px]">{b.keyDisplay || b.arduinoKey || "—"}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${b.mode === "power" ? "bg-amber-900/40 text-amber-400" : "bg-gray-800 text-gray-500"}`}>{b.mode}</span>
                                        </div>
                                      ))}
                                      {irs.map((ir) => <div key={ir.id} className="flex items-center gap-2 text-xs"><span className="font-mono text-emerald-400 w-8 flex-shrink-0">D{ir.pin}</span><span className="text-gray-400 truncate flex-1">{ir.name || "IR Sensor"}</span><span className="text-gray-600 font-mono text-[11px]">{ir.keyDisplay || "—"}</span></div>)}
                                      {sps.map((sp) => <div key={sp.id} className="flex items-center gap-2 text-xs"><span className="font-mono text-cyan-400 w-8 flex-shrink-0">D{sp.pin}</span><span className="text-gray-400 truncate flex-1">Sip &amp; Puff</span><span className="text-gray-600 font-mono text-[11px]">{sp.keyDisplay || "—"}</span></div>)}
                                      {joys.map((j) => <div key={j.id} className="flex items-center gap-2 text-xs"><span className="font-mono text-violet-400 w-8 flex-shrink-0">A{j.xPin}</span><span className="text-gray-400 truncate flex-1">Joystick</span><span className="text-gray-600 text-[11px]">↑{j.upKey} ↓{j.downKey} ←{j.leftKey} →{j.rightKey}</span></div>)}
                                    </div>
                                    <div className="pt-2 border-t border-gray-800/60">
                                      <button
                                        onClick={async () => {
                                          const sv = shadowSaves[shadowSaveIndex];
                                          if (!sv) return;
                                          const label = prompt("Template name:", sv.name);
                                          if (!label) return;
                                          await saveAsTemplate(label, sv.config as { buttons: ButtonConfig[]; portInputs: PortConfig[]; leds: LedConfig; irSensors: IRSensorConfig[]; sipPuffs: SipPuffConfig[]; joysticks: JoystickConfig[] });
                                        }}
                                        className="flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                                      ><Star size={11} /> Make template</button>
                                    </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </>)}

            {/* ── ISSUES SUB-TAB ── */}
            {adminSubTab === "issues" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">Submitted Issues</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{allIssues.filter(i => i.status === "open").length} open · {allIssues.length} total</p>
                  </div>
                  <button
                    onClick={() => loadAllIssues().then(d => setAllIssues(d))}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                  ><RefreshCw size={11} /> Refresh</button>
                </div>

                {allIssues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border border-gray-800 rounded-xl bg-gray-900/30">
                    <CheckCheck size={28} className="text-green-500/40 mb-2" />
                    <p className="text-sm text-gray-500">No issues submitted yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {allIssues.map((issue) => {
                      const statusStyles: Record<Issue["status"], string> = {
                        open:        "bg-red-900/40 border-red-700/50 text-red-300",
                        in_progress: "bg-yellow-900/40 border-yellow-700/50 text-yellow-300",
                        resolved:    "bg-green-900/40 border-green-700/50 text-green-300",
                        wontfix:     "bg-gray-800/60 border-gray-700/50 text-gray-500",
                      };
                      const categoryColors: Record<Issue["category"], string> = {
                        bug:     "text-red-400",
                        feature: "text-blue-400",
                        question:"text-purple-400",
                        other:   "text-gray-400",
                      };
                      const categoryIcons: Record<Issue["category"], React.ReactNode> = {
                        bug:     <AlertCircle size={10} />,
                        feature: <Star size={10} />,
                        question:<Info size={10} />,
                        other:   <MessageSquare size={10} />,
                      };
                      return (
                        <div key={issue.id} className="border border-gray-700/60 rounded-xl bg-gray-800/50 p-3.5 flex flex-col gap-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={["flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider", categoryColors[issue.category]].join(" ")}>
                                  {categoryIcons[issue.category]} {issue.category}
                                </span>
                                <span className={["px-2 py-0.5 rounded-full border text-[10px] font-semibold", statusStyles[issue.status]].join(" ")}>
                                  {issue.status.replace("_", " ")}
                                </span>
                                <span className="text-[10px] text-gray-600">
                                  {new Date(issue.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-200 leading-snug">{issue.title}</p>
                              {issue.username && (
                                <p className="text-[11px] text-gray-500">from <span className="text-gray-400 font-medium">{issue.username}</span></p>
                              )}
                            </div>
                            <button
                              onClick={async () => { await deleteIssue(issue.id); setAllIssues(p => p.filter(i => i.id !== issue.id)); }}
                              className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                            ><Trash2 size={12} /></button>
                          </div>

                          <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap border-t border-gray-800 pt-2">{issue.description}</p>

                          {/* Status buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider mr-1">Status:</span>
                            {(["open", "in_progress", "resolved", "wontfix"] as Issue["status"][]).map((s) => (
                              <button key={s}
                                onClick={async () => {
                                  await updateIssueStatus(issue.id, s);
                                  setAllIssues(p => p.map(i => i.id === issue.id ? { ...i, status: s } : i));
                                }}
                                className={["px-2 py-0.5 rounded-lg border text-[10px] font-medium transition-colors",
                                  issue.status === s
                                    ? statusStyles[s]
                                    : "bg-gray-800/40 border-gray-700/40 text-gray-600 hover:text-gray-300"
                                ].join(" ")}
                              >
                                {s === "open" && <><AlertCircle size={9} className="inline mr-0.5" />Open</>}
                                {s === "in_progress" && <><Clock size={9} className="inline mr-0.5" />In Progress</>}
                                {s === "resolved" && <><CheckCheck size={9} className="inline mr-0.5" />Resolved</>}
                                {s === "wontfix" && <><Ban size={9} className="inline mr-0.5" />Won&apos;t Fix</>}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── RAILWAY SUB-TAB ── */}
            {adminSubTab === "railway" && (<>

              {/* Token + Check */}
              <div className="bg-gray-900 border border-yellow-900/30 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
                  <Zap size={13} className="text-yellow-400" />
                  <h3 className="text-xs font-semibold text-gray-200">Railway Usage</h3>
                  <span className="text-[10px] text-gray-600 ml-1">compile backend · free tier</span>
                  <button
                    onClick={fetchRailwayUsage}
                    disabled={railwayLoading || !railwayToken}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-600/20 border border-yellow-600/30 text-yellow-300 text-xs font-semibold hover:bg-yellow-600/30 disabled:opacity-40 transition-colors"
                  >
                    {railwayLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    {railwayLoading ? "Checking…" : "Refresh"}
                  </button>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  {/* Token input */}
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1.5">Railway API Token</label>
                    <input
                      type="password"
                      value={railwayToken}
                      onChange={e => { setRailwayToken(e.target.value); localStorage.setItem("railway_api_token", e.target.value); }}
                      placeholder="Paste token from Railway Dashboard → Account → Tokens"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500 font-mono"
                    />
                    <p className="text-[10px] text-gray-600 mt-1.5">Stored in your browser only — never sent to our server.</p>
                  </div>

                  {/* Usage display */}
                  {!railwayUsage && !railwayLoading && (
                    <div className="flex flex-col items-center py-6 gap-2 text-center">
                      <Zap size={24} className="text-gray-700" />
                      <p className="text-xs text-gray-500">Enter your token and click Refresh to see usage.</p>
                    </div>
                  )}

                  {railwayUsage?.error && (
                    <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl flex items-start gap-2">
                      <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-red-400 font-semibold">API error</p>
                        <p className="text-[11px] text-red-500/80 mt-0.5">{railwayUsage.error}</p>
                      </div>
                    </div>
                  )}

                  {railwayUsage && !railwayUsage.error && (
                    <div className="flex flex-col gap-3">
                      {/* Cost + progress bar */}
                      {typeof railwayUsage.estimatedCost === "number" && (
                        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
                          <div className="flex items-end justify-between mb-2">
                            <div>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Estimated cost this period</p>
                              <p className="text-2xl font-black text-yellow-300 tabular-nums">${railwayUsage.estimatedCost.toFixed(3)}</p>
                            </div>
                            <p className="text-xs text-gray-600 mb-1">of $5.00 free</p>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (railwayUsage.estimatedCost / 5) * 100)}%`,
                                background: railwayUsage.estimatedCost > 4 ? "#ef4444" : railwayUsage.estimatedCost > 3 ? "#f59e0b" : "#22c55e",
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-600 mt-1.5">
                            {((1 - railwayUsage.estimatedCost / 5) * 100).toFixed(0)}% remaining on free tier
                          </p>
                        </div>
                      )}

                      {/* Period info */}
                      {railwayUsage.currentPeriodStart && railwayUsage.currentPeriodEnd && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/40">
                            <p className="text-[10px] text-gray-600 mb-1">Period start</p>
                            <p className="text-xs font-mono text-gray-300">{new Date(railwayUsage.currentPeriodStart).toLocaleDateString()}</p>
                          </div>
                          <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/40">
                            <p className="text-[10px] text-gray-600 mb-1">Days remaining</p>
                            <p className="text-sm font-bold text-green-400">
                              {Math.max(0, Math.ceil((new Date(railwayUsage.currentPeriodEnd).getTime() - Date.now()) / 86400000))} days
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </>)}

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
            <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Usb size={14} className="text-green-400" />
                <h3 className="text-sm font-semibold text-gray-200">How to Use This App</h3>
              </div>

              {/* Nothing to install */}
              <div className="mb-4 px-3 py-2.5 bg-green-950/30 border border-green-800/40 rounded-xl">
                <p className="text-xs text-green-300 font-medium mb-0.5">Nothing to install — works entirely in your browser</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Configure inputs, assign keys, generate sketches, and flash your Arduino — all from Chrome or Edge with no software to download.
                </p>
              </div>

              <ol className="space-y-4">
                {([
                  {
                    n: 1, title: "Configure your inputs",
                    body: "Add micro switches, toggle switches, joysticks, IR sensors, or sip & puff sensors. Assign a pin and key binding to each. All configuration happens live in the browser.",
                  },
                  {
                    n: 2, title: "Plug in your Arduino Leonardo",
                    body: "Use a USB data cable — not a charge-only cable. Chrome will prompt you to select the serial port when you click Compile & Upload.",
                  },
                  {
                    n: 3, title: "Click Compile & Upload",
                    body: "The sketch is sent to a cloud compile server (Railway + arduino-cli), which returns a compiled .hex file. The browser then flashes it directly to your board over Web Serial — no Arduino IDE or local tools needed.",
                    note: "Requires Chrome or Edge. Firefox and Safari do not support Web Serial.",
                  },
                  {
                    n: 4, title: "Test your controller",
                    body: "Switch to the Test tab to confirm key presses are working correctly. Play Dino, Snake, or Pong with your newly mapped inputs.",
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
                        <code className="inline-block mt-1.5 px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg text-[11px] text-green-400 font-mono">{code}</code>
                      )}
                      {note && <p className="text-[11px] text-gray-600 mt-1 italic">{note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* ── How code generation works ── */}
            <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-5">
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
                    { label: "Sip & puff", color: "text-cyan-400", desc: "A digital input on any Arduino pin using INPUT_PULLUP. Pressing triggers the assigned key, releasing it sends key up. Simple on/off activation — no analog thresholds needed." },
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
            <div className="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Terminal size={14} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-gray-200">How This Was Built</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Next.js 14", tag: "Frontend", color: "text-blue-400", desc: "App Router, React, TypeScript" },
                  { name: "Tailwind CSS", tag: "Styling", color: "text-cyan-400", desc: "Utility-first, dark theme" },
                  { name: "Supabase", tag: "Auth + DB", color: "text-emerald-400", desc: "Google login + save slots" },
                  { name: "Express.js", tag: "Backend", color: "text-green-400", desc: "Cloud compile server on Railway" },
                  { name: "arduino-cli", tag: "Compiler", color: "text-yellow-400", desc: "Compile sketches to .hex in cloud" },
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

      {/* IDE modal */}
      {showSketch && sketchCode && (
        <IDEModal
          originalCode={sketchCode}
          editedCode={customSketch ?? sketchCode}
          onCodeUpdate={(code) => setCustomSketch(code === sketchCode ? null : code)}
          onClose={() => setShowSketch(false)}
          initialShowAI={openSketchWithAI}
        />
      )}

      {/* LED info modal */}
      {showLedInfo && <LedInfoModal onClose={() => setShowLedInfo(false)} />}

      {/* Port selection modal */}
      {showPortModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPortModal(false)} />
          <div className="relative w-full max-w-sm bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-800">
              <Usb size={15} className="text-blue-400" />
              <h2 className="text-sm font-bold text-gray-100">Select Board</h2>
              <button onClick={() => setShowPortModal(false)} className="ml-auto text-gray-600 hover:text-gray-300 transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Port list */}
            <div className="max-h-64 overflow-y-auto">
              {grantedPorts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 px-5 text-center">
                  <Usb size={24} className="text-gray-700" />
                  <p className="text-xs text-gray-500">No boards previously connected.</p>
                  <p className="text-[11px] text-gray-600">Click below to grant access to a port.</p>
                </div>
              ) : (
                <div className="py-1.5">
                  {grantedPorts.map((p) => (
                    <button
                      key={p.index}
                      onClick={() => { setShowPortModal(false); handleWebSerialUpload(false); }}
                      className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-200 hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 shadow-[0_0_6px_rgba(74,222,128,0.7)]" />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-800 flex items-center gap-3">
              <button
                onClick={() => { setShowPortModal(false); handleWebSerialUpload(true); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
              >
                <Plus size={14} /> Connect new board…
              </button>
              <button
                onClick={() => setShowPortModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAuthModal(false)} />
          <div className="relative w-full max-w-sm bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div>
                <h2 className="text-sm font-bold text-gray-100">Sign In</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Save your config and access it anywhere</p>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="text-gray-600 hover:text-gray-300 transition-colors"><X size={15} /></button>
            </div>

            {/* Tab selector */}
            <div className="flex gap-1 px-5 pt-4">
              <button onClick={() => setAuthTab("username")}
                className={["flex-1 py-1.5 rounded-lg text-xs font-medium transition-all", authTab === "username" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
              >Username</button>
              <button onClick={() => setAuthTab("google")}
                className={["flex-1 py-1.5 rounded-lg text-xs font-medium transition-all", authTab === "google" ? "bg-gray-700 text-gray-100" : "text-gray-500 hover:text-gray-300"].join(" ")}
              >Google</button>
            </div>

            <div className="px-5 py-4">
              {authTab === "username" ? (
                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Username</label>
                    <input
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value.replace(/\s+/g, "."))}
                      placeholder="troy.pappas"
                      autoFocus
                      className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none text-sm text-gray-200 placeholder-gray-600 transition-colors"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">New usernames are created automatically.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={loginLoading || !loginUsername.trim()}
                    className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >{loginLoading ? "Signing in…" : "Sign In / Join"}</button>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-gray-400 text-center">Sign in with your Google account. Your name will be used as your username.</p>
                  <button
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-900 text-sm font-semibold transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                    Continue with Google
                  </button>
                  <p className="text-[10px] text-gray-600 text-center">Google OAuth must be enabled in your Supabase project.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wiring diagram modal */}
      {showWiring && (
        <WiringDiagramModal
          buttons={buttons} portInputs={portInputs} leds={leds}
          irSensors={irSensors} sipPuffs={sipPuffs} joysticks={joysticks}
          onClose={() => setShowWiring(false)}
        />
      )}

      {/* ── Report Issue Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowReportModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-red-400" />
                <span className="text-sm font-semibold text-gray-200">Report an Issue</span>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"><X size={14} /></button>
            </div>

            {reportDone ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                <CheckCircle2 size={36} className="text-green-400" />
                <p className="text-sm font-semibold text-gray-200">Thanks! Issue submitted.</p>
                <p className="text-xs text-gray-500">We&apos;ll look into it shortly.</p>
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">
                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</label>
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { v: "bug",      label: "Bug",     icon: <AlertCircle size={11} /> },
                      { v: "feature",  label: "Feature", icon: <Star size={11} /> },
                      { v: "question", label: "Question",icon: <Info size={11} /> },
                      { v: "other",    label: "Other",   icon: <MessageSquare size={11} /> },
                    ] as { v: Issue["category"]; label: string; icon: React.ReactNode }[]).map(({ v, label, icon }) => (
                      <button key={v} onClick={() => setReportCategory(v)}
                        className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                          reportCategory === v
                            ? "bg-blue-700/40 border-blue-600/60 text-blue-200"
                            : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
                        ].join(" ")}
                      >{icon}{label}</button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</label>
                  <input
                    type="text"
                    placeholder="Short summary of the issue…"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</label>
                  <textarea
                    placeholder="What happened? What did you expect? Steps to reproduce…"
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    rows={4}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {appUser && (
                  <p className="text-xs text-gray-600">Submitting as <span className="text-gray-400 font-medium">{appUser.username}</span></p>
                )}

                <button
                  onClick={handleSubmitIssue}
                  disabled={!reportTitle.trim() || !reportDesc.trim() || reportSubmitting}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {reportSubmitting ? <Loader2 size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                  {reportSubmitting ? "Submitting…" : "Submit Issue"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive tutorial */}
      {showTutorial && (
        <TutorialOverlay
          steps={TUTORIAL_STEPS.filter((s) => !(s.id === "save" && !appUser))}
          onComplete={() => {
            setShowTutorial(false);
            const key = `tutorial_v${adminSettings.tutorial_version ?? 0}_done`;
            localStorage.setItem(key, "1");
          }}
          onTabChange={(t) => setTab(t as "configure" | "remap" | "test" | "info" | "admin")}
        />
      )}


      {/* ── Floating Save Panel ─────────────────────────────────────────────── */}
      {appUser && (
        <div className="fixed bottom-4 right-4 z-[300]" ref={saveMenuRef}>
          {/* Trigger button */}
          <button
            onClick={() => setShowSaveMenu((v) => !v)}
            data-tutorial="save-panel"
            className={["flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-medium shadow-2xl transition-all",
              showSaveMenu
                ? "bg-gray-800 border-gray-600 text-gray-100"
                : "bg-gray-900 border-gray-700 hover:border-gray-500 text-gray-300 hover:text-gray-100"
            ].join(" ")}
          >
            <span className={["w-2 h-2 rounded-full flex-shrink-0 transition-all",
              saving ? "bg-amber-400 animate-pulse" :
              saveError ? "bg-red-400" :
              hasSaved ? "bg-green-500" : "bg-gray-600"
            ].join(" ")} />
            <span className="max-w-[140px] truncate">{currentSaveName || "Untitled"}</span>
            <ChevronDown size={11} className={["text-gray-500 transition-transform", showSaveMenu ? "rotate-180" : ""].join(" ")} />
          </button>

          {/* Panel — opens upward */}
          {showSaveMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-72 bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl overflow-hidden">

              {/* Current save */}
              <div className="px-3 pt-3 pb-2.5">
                <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Current Save</p>
                <input
                  value={currentSaveName}
                  onChange={(e) => setCurrentSaveName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Name this setup…"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className={["flex items-center gap-1 text-[10px] flex-1",
                    saving ? "text-amber-400" : saveError ? "text-red-400" : hasSaved ? "text-green-500" : "text-gray-600"
                  ].join(" ")}>
                    {saving ? <><Loader2 size={9} className="animate-spin" /> Saving…</> :
                     saveError ? <><XCircle size={9} /> Save failed</> :
                     hasSaved ? <><CheckCircle2 size={9} /> Saved</> :
                     "Not saved yet"}
                  </span>
                  <button
                    onClick={() => copyShareLink()}
                    disabled={sharingLink || !hasSaved}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-600/30 text-[10px] text-blue-300 hover:bg-blue-600/30 transition-colors disabled:opacity-40"
                  >
                    {copiedLink ? <><CheckCircle2 size={9} /> Copied!</> : sharingLink ? "…" : <><ExternalLink size={9} /> Share</>}
                  </button>
                </div>
              </div>

              {/* Saves list */}
              {saves.length > 0 && (
                <>
                  <div className="border-t border-gray-800 mx-3" />
                  <div className="px-1.5 py-1.5 max-h-52 overflow-y-auto">
                    <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest px-2 py-1">Your Saves</p>
                    {saves.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg overflow-hidden"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setDeleteConfirmSaveId(null);
                          setSaveContextMenu({ x: e.clientX, y: e.clientY, id: s.id });
                        }}
                      >
                        {deleteConfirmSaveId === s.id ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-2 bg-red-950/30 border border-red-800/30 rounded-lg">
                            <span className="flex-1 text-[10px] text-red-300">Delete "{s.name || "Untitled"}"?</span>
                            <button
                              onClick={() => { handleDeleteSave(s.id); setDeleteConfirmSaveId(null); }}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-[10px] text-white font-medium transition-colors"
                            >Delete</button>
                            <button
                              onClick={() => setDeleteConfirmSaveId(null)}
                              className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-[10px] text-gray-300 transition-colors"
                            >Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center group">
                            <button
                              onClick={() => switchSave(s)}
                              className={["flex-1 text-left px-2.5 py-2 text-xs transition-colors truncate rounded-lg",
                                s.id === currentSaveId
                                  ? "bg-blue-600/20 text-blue-300 font-medium"
                                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                              ].join(" ")}
                            >
                              {s.id === currentSaveId && <span className="mr-1 text-blue-400">·</span>}
                              {s.name || "Untitled"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmSaveId(s.id)}
                              className="px-2 py-2 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                            ><Trash2 size={10} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="border-t border-gray-800 px-1.5 py-1.5 flex gap-1">
                <button
                  onClick={createNewSave}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
                ><Plus size={11} /> New save</button>
                <label className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors cursor-pointer">
                  <Upload size={11} /> Import
                  <input type="file" accept=".json" className="hidden" onChange={(e) => { importSetup(e); setShowSaveMenu(false); }} />
                </label>
                <button
                  onClick={() => { downloadSetup(); setShowSaveMenu(false); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
                ><Download size={11} /> Export</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right-click context menu for saves */}
      {saveContextMenu && (
        <div
          style={{ position: "fixed", top: saveContextMenu.y, left: saveContextMenu.x, zIndex: 99999 }}
          className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[160px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setDeleteConfirmSaveId(saveContextMenu.id);
              setShowSaveMenu(true);
              setSaveContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={11} /> Delete save…
          </button>
          <button
            onClick={() => { const s = saves.find((sv) => sv.id === saveContextMenu.id); if (s) switchSave(s); setSaveContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <RotateCcw size={11} /> Load this save
          </button>
        </div>
      )}
    </div>
  );
}
