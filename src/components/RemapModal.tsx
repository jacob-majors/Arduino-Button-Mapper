"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  X, Plug, RefreshCw, Upload, ChevronRight, Keyboard,
  CheckCircle2, AlertCircle, Loader2, Radio, Joystick, Wind, Save,
} from "lucide-react";
import { resolveKey, arduinoToBrowserKey } from "@/lib/keymap";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemapEntry {
  id: string;
  name: string;
  type: "button" | "port" | "ir" | "sipPuff" | "joystick-up" | "joystick-down" | "joystick-left" | "joystick-right" | "joystick-btn";
  pin: string;        // "D2" or "A0"
  arduinoKey: string; // current key in sketch
  newKey: string;     // edited key (same as arduinoKey until changed)
  newDisplay: string;
}

interface RemapConfig {
  v: number;
  id?: string;
  b: { p: number; k: string; kd?: string; n: string; m: number }[];
  ir: { p: number; k: string; kd?: string; n: string }[];
  sp: { p: number; k: string; kd?: string; n: string }[];
  j: { x: number; y: number; bp: number; u: string; ud?: string; d: string; dd?: string; l: string; ld?: string; r: string; rd?: string; bk: string; bkd?: string; n: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arduinoKeyDisplay(k: string): string {
  if (!k || k === "0") return "—";
  if (k.startsWith("KEY_")) {
    const map: Record<string, string> = {
      KEY_UP_ARROW: "↑", KEY_DOWN_ARROW: "↓", KEY_LEFT_ARROW: "←", KEY_RIGHT_ARROW: "→",
      KEY_RETURN: "Enter", KEY_BACKSPACE: "Backspace", KEY_TAB: "Tab", KEY_ESC: "Escape",
      KEY_DELETE: "Delete", KEY_INSERT: "Insert", KEY_HOME: "Home", KEY_END: "End",
      KEY_PAGE_UP: "PgUp", KEY_PAGE_DOWN: "PgDn", KEY_CAPS_LOCK: "Caps",
      KEY_F1:"F1",KEY_F2:"F2",KEY_F3:"F3",KEY_F4:"F4",KEY_F5:"F5",KEY_F6:"F6",
      KEY_F7:"F7",KEY_F8:"F8",KEY_F9:"F9",KEY_F10:"F10",KEY_F11:"F11",KEY_F12:"F12",
    };
    return map[k] ?? k;
  }
  return k === " " ? "Space" : k.toUpperCase();
}

function parseRemapConfig(json: string): RemapEntry[] {
  const cfg: RemapConfig = JSON.parse(json);
  const entries: RemapEntry[] = [];

  cfg.b?.forEach((b, i) => {
    entries.push({
      id: `b-${i}`,
      name: b.n || `Button D${b.p}`,
      type: b.m === 1 || b.m === 0 ? "button" : "port",
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
      { type: "joystick-up",    label: "↑ Up",    key: j.u, kd: j.ud },
      { type: "joystick-down",  label: "↓ Down",  key: j.d, kd: j.dd },
      { type: "joystick-left",  label: "← Left",  key: j.l, kd: j.ld },
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

  return entries;
}

// ─── Key Capture Cell ─────────────────────────────────────────────────────────

function KeyCell({ entry, onChange }: { entry: RemapEntry; onChange: (newKey: string, newDisplay: string) => void }) {
  const [capturing, setCapturing] = useState(false);
  const changed = entry.newKey !== entry.arduinoKey;

  const handleCapture = useCallback(() => {
    setCapturing(true);
  }, []);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        setCapturing(false);
        return;
      }
      const resolved = resolveKey(e);
      if (resolved) {
        onChange(resolved.arduino, resolved.display);
        setCapturing(false);
      }
    };
    // Use capture phase so this runs before the modal's Escape-to-close handler
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing, onChange]);

  return (
    <button
      onClick={handleCapture}
      className={[
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border",
        capturing
          ? "bg-blue-900/50 border-blue-500 text-blue-200 animate-pulse"
          : changed
          ? "bg-violet-900/40 border-violet-600/60 text-violet-200 hover:border-violet-500"
          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500",
      ].join(" ")}
    >
      <Keyboard size={10} className="opacity-60" />
      {capturing ? "Press a key…" : entry.newDisplay}
    </button>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: RemapEntry["type"] }) {
  if (type === "ir")       return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 flex items-center gap-1"><Radio size={8} />IR</span>;
  if (type === "sipPuff")  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-400 flex items-center gap-1"><Wind size={8} />Sip&amp;Puff</span>;
  if (type.startsWith("joystick")) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/40 text-violet-400 flex items-center gap-1"><Joystick size={8} />Joystick</span>;
  if (type === "port")     return <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/40 text-sky-400">Port</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400">Button</span>;
}

// ─── Tutorial Steps ───────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "1",
    icon: "🔌",
    title: "Plug in your Arduino",
    body: "Connect your Arduino Leonardo or Micro to this computer using a USB cable. Wait a moment for the OS to recognize it.",
  },
  {
    n: "2",
    icon: "🔍",
    title: "Connect & Read",
    body: "Click \"Connect & Read\" below. Your browser will ask you to pick a serial port — select the Arduino. It takes about 2 seconds to read.",
  },
  {
    n: "3",
    icon: "✏️",
    title: "Edit key mappings",
    body: "Once connected, you'll see every input listed. Click any key label and press a new key on your keyboard to reassign it.",
  },
  {
    n: "4",
    icon: "⬆️",
    title: "Upload changes",
    body: "When you're happy with the new mappings, click \"Upload Changes\". The app will compile and send the new program to your Arduino. Done!",
  },
];

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function RemapModal({
  backendUrl,
  selectedPort,
  onClose,
  onUploadSketch,
  onSave,
  inline = false,
}: {
  backendUrl: string;
  selectedPort: string;
  onClose: () => void;
  onUploadSketch: (entries: RemapEntry[]) => void;
  onSave?: (entries: RemapEntry[]) => void;
  inline?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "connecting" | "reading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<RemapEntry[]>([]);
  const [savedConfirm, setSavedConfirm] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portRef = useRef<any>(null);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function connectAndRead() {
    setPhase("connecting");
    setError("");
    try {
      // Request serial port from browser
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const port = await (navigator as any).serial.requestPort();
      portRef.current = port;
      await port.open({ baudRate: 9600 });
      setPhase("reading");

      // Opening the serial port resets the Arduino (DTR). Wait for it to boot.
      await new Promise((r) => setTimeout(r, 2000));

      // Send REMAP command
      const writer = port.writable!.getWriter();
      await writer.write(new TextEncoder().encode("REMAP\n"));
      writer.releaseLock();

      // Read until CONFIG_END or timeout
      const reader = port.readable!.getReader();
      let raw = "";
      const deadline = Date.now() + 4000;
      try {
        while (Date.now() < deadline) {
          const { value, done } = await Promise.race([
            reader.read(),
            new Promise<{ value: undefined; done: true }>((res) =>
              setTimeout(() => res({ value: undefined, done: true }), 300)
            ),
          ]);
          if (done) break;
          if (value) raw += new TextDecoder().decode(value);
          if (raw.includes("CONFIG_END")) break;
        }
      } finally {
        reader.cancel().catch(() => {});
        reader.releaseLock();
      }

      await port.close();
      portRef.current = null;

      // Parse out the JSON between CONFIG_START and CONFIG_END
      const start = raw.indexOf("CONFIG_START");
      const end = raw.indexOf("CONFIG_END");
      if (start === -1 || end === -1) {
        throw new Error("No config data received. Make sure the device was uploaded using this app.");
      }
      const jsonLine = raw.slice(start + "CONFIG_START".length, end).trim();
      const parsed = parseRemapConfig(jsonLine);
      if (parsed.length === 0) throw new Error("Device has no mapped inputs.");
      setEntries(parsed);
      setPhase("ready");
    } catch (e: unknown) {
      await portRef.current?.close().catch(() => {});
      portRef.current = null;
      if (e instanceof Error && e.name === "NotAllowedError") {
        setPhase("idle"); // user cancelled the picker — silent
      } else {
        setError(e instanceof Error ? e.message : "Connection failed.");
        setPhase("error");
      }
    }
  }

  function updateEntry(id: string, newKey: string, newDisplay: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, newKey, newDisplay } : e))
    );
  }

  const hasChanges = entries.some((e) => e.newKey !== e.arduinoKey);
  const supportsWebSerial = typeof navigator !== "undefined" && "serial" in navigator;

  // ── Shared inner content ──────────────────────────────────────────────────
  const innerContent = (
    <>
      {/* ── Tutorial ── */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">How it works</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3 flex flex-col gap-1.5">
              <span className="text-lg">{s.icon}</span>
              <p className="text-xs font-semibold text-gray-200 leading-snug">{s.title}</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Browser compat warning ── */}
      {!supportsWebSerial && (
        <div className="mx-5 mb-3 flex items-start gap-2 p-3 bg-amber-950/40 border border-amber-700/40 rounded-xl">
          <AlertCircle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            Web Serial is only supported in <strong>Chrome</strong> or <strong>Edge</strong>. Please open this page in one of those browsers to use the Remap feature.
          </p>
        </div>
      )}

      {/* ── Connect button ── */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700/60 rounded-xl">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Plug size={16} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200">
              {phase === "ready" ? "Device read successfully" : "Connect & Read Device"}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {phase === "ready"
                ? `${entries.length} input${entries.length !== 1 ? "s" : ""} found — edit keys below`
                : "Plug in your Arduino, then click to read its current mapping via serial"}
            </p>
          </div>
          {phase === "ready" ? (
            <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <button
              onClick={connectAndRead}
              disabled={!supportsWebSerial || phase === "connecting" || phase === "reading"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {(phase === "connecting" || phase === "reading") ? (
                <><Loader2 size={11} className="animate-spin" />{phase === "connecting" ? "Connecting…" : "Reading…"}</>
              ) : (
                <><Plug size={11} />Connect &amp; Read</>
              )}
            </button>
          )}
        </div>

        {/* Error */}
        {phase === "error" && (
          <div className="mt-2 flex items-start gap-2 p-3 bg-red-950/40 border border-red-700/40 rounded-xl">
            <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-red-300 font-medium">Connection failed</p>
              <p className="text-[11px] text-red-400/80 mt-0.5">{error}</p>
              <button onClick={connectAndRead} className="mt-1.5 text-[11px] text-red-400 hover:text-red-300 underline">Try again</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mapping table ── */}
      {phase === "ready" && entries.length > 0 && (
        <div className="px-5 pb-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Current Mapping — click any key to reassign
          </p>
          <div className="rounded-xl border border-gray-700/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-800/80 border-b border-gray-700/60">
                  <th className="px-3 py-2 text-left text-[10px] text-gray-500 font-semibold uppercase tracking-wider w-1/3">Input</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-500 font-semibold uppercase tracking-wider w-16">Pin</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-500 font-semibold uppercase tracking-wider w-20">Type</th>
                  <th className="px-3 py-2 text-left text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Key</th>
                  <th className="px-3 py-2 text-center text-[10px] text-gray-500 font-semibold uppercase tracking-wider w-16">Changed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {entries.map((e) => (
                  <tr key={e.id} className={e.newKey !== e.arduinoKey ? "bg-violet-950/20" : "hover:bg-gray-800/30 transition-colors"}>
                    <td className="px-3 py-2 text-gray-300 font-medium truncate max-w-0 w-1/3">
                      <span className="truncate block">{e.name}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500">{e.pin}</td>
                    <td className="px-3 py-2"><TypeBadge type={e.type} /></td>
                    <td className="px-3 py-2">
                      <KeyCell
                        entry={e}
                        onChange={(k, d) => updateEntry(e.id, k, d)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {e.newKey !== e.arduinoKey ? (
                        <span className="text-[10px] text-violet-400 font-semibold">
                          {arduinoKeyDisplay(e.arduinoKey)} → {e.newDisplay}
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Re-read button */}
          <button
            onClick={() => { setPhase("idle"); setEntries([]); }}
            className="mt-2 text-[11px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
          >
            <RefreshCw size={9} /> Read device again
          </button>
        </div>
      )}
    </>
  );

  // ── Inline (tab) mode ─────────────────────────────────────────────────────
  if (inline) {
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="h-full max-w-[900px] mx-auto px-4 sm:px-6 py-4 w-full flex flex-col overflow-y-auto">
          <div className="flex items-center gap-2.5 mb-4 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center">
              <RefreshCw size={13} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Remap Device</h2>
              <p className="text-[11px] text-gray-500">Read and reassign key mappings from a connected Arduino</p>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col flex-1">
            <div className="flex-1 overflow-y-auto">
              {innerContent}
            </div>
            {phase === "ready" && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 flex-shrink-0">
                {onSave ? (
                  <button
                    onClick={() => { onSave(entries); setSavedConfirm(true); setTimeout(() => setSavedConfirm(false), 2500); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
                  >
                    {savedConfirm ? <><CheckCircle2 size={12} className="text-emerald-400" /> Saved!</> : <><Save size={12} /> Save Setup</>}
                  </button>
                ) : <span />}
                <button
                  onClick={() => onUploadSketch(entries)}
                  disabled={!hasChanges}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload size={13} />
                  Upload Changes
                  {hasChanges && (
                    <span className="ml-1 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">
                      {entries.filter((e) => e.newKey !== e.arduinoKey).length} changed
                    </span>
                  )}
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Modal mode ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center">
              <RefreshCw size={13} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Remap Device</h2>
              <p className="text-[11px] text-gray-500">Read and reassign key mappings from a connected Arduino</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {innerContent}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Close
          </button>
          {phase === "ready" && (
            <button
              onClick={() => onUploadSketch(entries)}
              disabled={!hasChanges}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload size={13} />
              Upload Changes
              {hasChanges && (
                <span className="ml-1 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">
                  {entries.filter((e) => e.newKey !== e.arduinoKey).length} changed
                </span>
              )}
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
