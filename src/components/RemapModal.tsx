"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  X, Plug, RefreshCw, Upload, ChevronRight, Keyboard, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2, Radio, Joystick, Wind, Save,
} from "lucide-react";
import { resolveKey } from "@/lib/keymap";
import { compileAndUpload } from "@/lib/avr-upload";
import {
  arduinoKeyDisplay,
  buildRemappedSketch,
  parseRemapPayload,
  type RemapEntry,
  type StandaloneDeviceConfig,
} from "@/lib/remap";

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
  onClose,
  onUploadSketch,
  onSave,
  inline = false,
  pageMode = false,
}: {
  backendUrl: string;
  onClose: () => void;
  onUploadSketch?: (entries: RemapEntry[]) => void;
  onSave?: (entries: RemapEntry[]) => void;
  inline?: boolean;
  pageMode?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "connecting" | "reading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<RemapEntry[]>([]);
  const [deviceConfig, setDeviceConfig] = useState<StandaloneDeviceConfig | null>(null);
  const [savedConfirm, setSavedConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
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
    setUploadError("");
    setUploadSuccess("");
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
      const parsed = parseRemapPayload(jsonLine);
      if (parsed.entries.length === 0) throw new Error("Device has no mapped inputs.");
      setEntries(parsed.entries);
      setDeviceConfig(parsed.deviceConfig);
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

  async function handleStandaloneUpload() {
    if (!deviceConfig || !hasChanges || uploading) return;
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const sketch = buildRemappedSketch(deviceConfig, entries);
      await compileAndUpload(backendUrl, sketch, () => undefined, false);
      setUploadSuccess("Uploaded successfully. Your Arduino now uses the new key outputs.");
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const hasChanges = entries.some((e) => e.newKey !== e.arduinoKey);
  const supportsWebSerial = typeof navigator !== "undefined" && "serial" in navigator;
  const canUploadStandalone = !!deviceConfig;
  const uploadDisabled = !hasChanges || uploading || (!onUploadSketch && !canUploadStandalone);

  // ── Shared inner content ──────────────────────────────────────────────────
  const innerContent = (
    <>
      {pageMode ? (
        <div className="px-5 pt-5 pb-2">
          <div className="rounded-[1.75rem] border border-gray-800/80 bg-white/[0.03] px-4 py-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.24em] mb-2">Quick Remap</p>
            <p className="text-sm text-gray-200 leading-relaxed max-w-2xl">
              Read a connected Arduino, scan every mapped input, click any output, and upload a fresh sketch with the new keys.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500">
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">1. Connect & read</span>
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">2. Change only the outputs</span>
              <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1">3. Upload back to the device</span>
            </div>
          </div>
        </div>
      ) : (
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
      )}

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
            {pageMode ? "Current Outputs" : "Current Mapping — click any key to reassign"}
          </p>
          {pageMode ? (
            <div className="rounded-[1.75rem] border border-gray-800/70 bg-gray-900/70 overflow-hidden">
              <div className="divide-y divide-gray-800/70">
                {entries.map((e) => (
                  <div key={e.id} className={["px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3", e.newKey !== e.arduinoKey ? "bg-violet-950/20" : ""].join(" ")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-200 truncate">{e.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                        <span className="font-mono">{e.pin}</span>
                        <TypeBadge type={e.type} />
                        {e.newKey !== e.arduinoKey && (
                          <span className="text-violet-400 font-semibold">{arduinoKeyDisplay(e.arduinoKey)} {"->"} {e.newDisplay}</span>
                        )}
                      </div>
                    </div>
                    <div className="sm:flex-shrink-0">
                      <KeyCell
                        entry={e}
                        onChange={(k, d) => updateEntry(e.id, k, d)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
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
          )}

          {pageMode && !canUploadStandalone && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-700/40 bg-amber-950/30 px-4 py-3">
              <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs leading-relaxed text-amber-200">
                This device was uploaded with an older remap format. You can still scan its mappings here, but to upload directly from `/remap`
                you’ll need to re-upload it once from the main builder using the latest version of this site.
              </p>
            </div>
          )}

          {(uploadError || uploadSuccess) && (
            <div className={["mt-3 rounded-2xl px-4 py-3 text-xs", uploadError ? "border border-red-700/40 bg-red-950/30 text-red-200" : "border border-emerald-700/40 bg-emerald-950/30 text-emerald-200"].join(" ")}>
              {uploadError || uploadSuccess}
            </div>
          )}

          {/* Re-read button */}
          <button
            onClick={() => { setPhase("idle"); setEntries([]); setDeviceConfig(null); setUploadError(""); setUploadSuccess(""); }}
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
                  onClick={() => onUploadSketch?.(entries)}
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

  if (pageMode) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.96)_0%,_rgba(15,23,42,1)_24%,_rgba(2,6,23,1)_100%)] text-gray-100">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link href="/app" className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900/70 px-4 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-gray-700 hover:text-white">
              <ArrowLeft size={13} />
              Back to Builder
            </Link>
            <Link href="/landing" className="text-[11px] text-gray-500 transition-colors hover:text-gray-300">
              View website
            </Link>
          </div>

          <div className="mb-5 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">arduino.jacobmajors.com/remap</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Quick Remap</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              A simpler view for changing key outputs fast. Read the device, click a mapping, press a new key, then upload it back to the Arduino.
            </p>
          </div>

          <div className="flex-1 rounded-[2rem] border border-gray-800/80 bg-gray-950/70 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl overflow-hidden">
            <div className="border-b border-gray-800/80 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-600/15">
                  <RefreshCw size={17} className="text-violet-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Device Output Remap</h2>
                  <p className="text-[11px] text-gray-500">Simple remapping for finished prototypes and quick iteration.</p>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
              {innerContent}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-800/80 px-5 py-4">
              <button onClick={onClose} className="text-xs text-gray-500 transition-colors hover:text-gray-300">
                Leave remap view
              </button>
              <button
                onClick={() => onUploadSketch ? onUploadSketch(entries) : handleStandaloneUpload()}
                disabled={uploadDisabled}
                className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "Uploading..." : "Upload Remap"}
                {hasChanges && (
                  <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
                    {entries.filter((e) => e.newKey !== e.arduinoKey).length} changed
                  </span>
                )}
              </button>
            </div>
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
              onClick={() => onUploadSketch?.(entries)}
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
