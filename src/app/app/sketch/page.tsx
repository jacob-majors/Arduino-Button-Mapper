"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileCode,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import {
  classifySketchLines,
  loadSketchWorkspace,
  saveSketchWorkspace,
  type SketchWorkspace,
} from "@/lib/sketch-workspace";

type AIMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Add debounce to all buttons",
  "Flash an LED when a key is pressed",
  "Make the joystick smoother",
  "Require a long press before firing",
  "Explain what this sketch does",
];

function highlightLine(raw: string): React.ReactNode {
  if (!raw.trim()) return <span>{raw || " "}</span>;
  if (/^\s*\/\//.test(raw)) return <span className="text-gray-500 italic">{raw}</span>;
  if (/^\s*#/.test(raw)) return <span className="text-violet-400">{raw}</span>;

  const patterns: { re: RegExp; cls: string }[] = [
    { re: /"[^"]*"/g, cls: "text-amber-300" },
    { re: /\b(void|int|bool|const|if|else|for|while|return|true|false|HIGH|LOW|INPUT_PULLUP|OUTPUT|long|unsigned|char|byte)\b/g, cls: "text-sky-300" },
    { re: /\b([A-Za-z_]\w*)\s*(?=\()/g, cls: "text-emerald-300" },
    { re: /\b\d+\b/g, cls: "text-orange-300" },
  ];

  const tokens: React.ReactNode[] = [];
  const combined = new RegExp(patterns.map((p) => `(${p.re.source})`).join("|"), "g");
  let pos = 0;
  let m: RegExpExecArray | null;
  combined.lastIndex = 0;
  while ((m = combined.exec(raw)) !== null) {
    if (m.index > pos) tokens.push(<span key={pos} className="text-gray-200">{raw.slice(pos, m.index)}</span>);
    const gi = patterns.findIndex((_, i) => m![i + 1] !== undefined);
    tokens.push(<span key={m.index} className={patterns[gi]?.cls ?? "text-gray-200"}>{m[0]}</span>);
    pos = m.index + m[0].length;
  }
  if (pos < raw.length) tokens.push(<span key={pos} className="text-gray-200">{raw.slice(pos)}</span>);
  return <>{tokens}</>;
}

const SOURCE_BG: Record<string, string> = {
  button:    "border-l-2 border-emerald-500/50 bg-emerald-500/5",
  ai:        "border-l-2 border-cyan-500/50 bg-cyan-500/5",
  user:      "border-l-2 border-amber-500/50 bg-amber-500/5",
  generated: "",
};

export default function SketchPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<SketchWorkspace | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWorkspace(loadSketchWorkspace());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !workspace) return;
    saveSketchWorkspace(workspace);
  }, [workspace, hydrated]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiLoading]);

  const classification = useMemo(() => (
    workspace ? classifySketchLines(workspace) : []
  ), [workspace]);

  const updateCode = (next: string) =>
    setWorkspace((w) => w ? { ...w, editedCode: next, updatedAt: Date.now() } : w);

  const resetToGenerated = () => {
    setWorkspace((w) => w ? { ...w, editedCode: w.originalCode, aiCode: null, updatedAt: Date.now() } : w);
    setMessages([]);
    setApiHistory([]);
  };

  const copyCode = async () => {
    if (!workspace) return;
    await navigator.clipboard.writeText(workspace.editedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sendToAI = async () => {
    if (!workspace || !userInput.trim() || aiLoading) return;
    const request = userInput.trim();
    setMessages((p) => [...p, { role: "user", content: request }]);
    setUserInput("");
    setAiLoading(true);

    const systemPrompt =
      "You are an expert Arduino programmer helping modify a HID input sketch. " +
      "Never change pin numbers. Return only the full updated sketch when the user requests code changes. " +
      "If the user is asking a question, answer plainly instead of returning code.";
    const prompt = `Current Arduino sketch:\n\`\`\`cpp\n${workspace.editedCode}\n\`\`\`\n\nRequest: ${request}`;

    try {
      const res = await fetch("/api/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, prompt, history: apiHistory }),
      });
      const data = await res.json() as { text?: string; error?: string; isQuota?: boolean };
      const isQuota = res.status === 429 || data.isQuota === true ||
        /quota|rate.?limit|resource.?exhausted|limit.*exceeded/i.test(data.error ?? "");

      if (isQuota) {
        setMessages((p) => [...p, { role: "assistant", content: "AI quota reached. Try again in a moment." }]);
        return;
      }
      if (!res.ok || data.error) throw new Error(data.error ?? `Error ${res.status}`);

      const raw = (data.text ?? "")
        .replace(/^```(?:cpp|arduino|c\+\+)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

      const looksLikeCode = /^(\/\/|#include|void setup|void loop|bool |int |const |\/\*)/m.test(raw.slice(0, 300));
      if (looksLikeCode) {
        setWorkspace((w) => w ? { ...w, editedCode: raw, aiCode: raw, updatedAt: Date.now() } : w);
        setMessages((p) => [...p, { role: "assistant", content: "Sketch updated — cyan lines show what AI changed." }]);
        setApiHistory((p) => [...p, { role: "user", content: prompt }, { role: "assistant", content: "Sketch updated." }]);
      } else {
        setMessages((p) => [...p, { role: "assistant", content: raw }]);
        setApiHistory((p) => [...p, { role: "user", content: prompt }, { role: "assistant", content: raw }]);
      }
    } catch (err) {
      setMessages((p) => [...p, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Something went wrong."}` }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={18} className="animate-spin text-gray-500" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-200 flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <FileCode size={40} className="mx-auto text-gray-600" />
          <h1 className="text-xl font-semibold">No sketch loaded</h1>
          <p className="text-sm text-gray-500">Configure your inputs first, then come back here to view and edit the sketch.</p>
          <button onClick={() => router.push("/app")} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-500 transition-colors">
            <ArrowLeft size={14} />
            Back to Builder
          </button>
        </div>
      </div>
    );
  }

  const isModified = workspace.editedCode !== workspace.originalCode;

  return (
    <div className="flex h-screen flex-col bg-[#060816] text-gray-100 overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/90 px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push("/app")} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-cyan-200 transition-colors flex-shrink-0">
            <ArrowLeft size={13} />
            Back
          </button>
          <div className="h-4 w-px bg-gray-800 flex-shrink-0" />
          <FileCode size={14} className="text-cyan-400 flex-shrink-0" />
          <span className="text-sm font-semibold truncate">Arduino Sketch</span>
          {isModified && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 flex-shrink-0">modified</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-600 mr-1">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm border-l-2 border-emerald-500 bg-emerald-500/10" />Generated</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm border-l-2 border-cyan-500 bg-cyan-500/10" />AI</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm border-l-2 border-amber-500 bg-amber-500/10" />Edited</span>
          </div>
          <button onClick={resetToGenerated} className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors">
            <RotateCcw size={11} />Reset
          </button>
          <button onClick={copyCode} className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 transition-colors">
            {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Code panel */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 border-r border-gray-800">
          {/* Color-coded view */}
          <div className="flex-1 overflow-auto font-mono text-[12.5px] leading-[1.65] bg-[#07091a]">
            {classification.map((line, i) => (
              <div key={i} className={`flex ${SOURCE_BG[line.source] ?? ""}`}>
                <span className="w-12 flex-shrink-0 select-none text-right pr-3 text-[10px] text-gray-700 leading-[1.65]">
                  {line.index + 1}
                </span>
                <span className="flex-1 whitespace-pre px-2 overflow-x-hidden">
                  {highlightLine(line.line)}
                </span>
              </div>
            ))}
          </div>

          {/* Edit bar */}
          <div className="border-t border-gray-800 flex-shrink-0 bg-gray-950">
            <div className="px-4 py-1.5 flex items-center gap-2 border-b border-gray-800/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Edit — changes reflected above in real time</span>
            </div>
            <textarea
              value={workspace.editedCode}
              onChange={(e) => updateCode(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              className="h-36 w-full resize-none bg-transparent px-4 py-3 font-mono text-[12px] leading-6 text-gray-300 outline-none"
              placeholder="Edit sketch here…"
            />
          </div>
        </div>

        {/* AI panel */}
        <aside className="flex w-72 flex-shrink-0 flex-col bg-gray-950/70 xl:w-88">
          <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3 flex-shrink-0">
            <Sparkles size={13} className="text-cyan-400" />
            <span className="text-sm font-semibold">AI Assistant</span>
          </div>

          <div className="flex-1 overflow-auto px-3 py-3 space-y-2 min-h-0">
            {messages.length === 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 px-1 pb-1">Try asking…</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setUserInput(s); setTimeout(() => inputRef.current?.focus(), 20); }}
                    className="block w-full rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-2 text-left text-xs text-gray-400 hover:border-cyan-500/30 hover:text-cyan-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-50 ml-3"
                    : "bg-gray-900/80 border border-gray-800 text-gray-200"
                }`}>
                  {msg.content}
                </div>
              ))
            )}
            {aiLoading && (
              <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/80 px-3 py-2.5 text-xs text-gray-400">
                <Loader2 size={11} className="animate-spin text-cyan-400" />
                Thinking…
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="border-t border-gray-800 p-3 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendToAI(); } }}
                placeholder="Ask AI to modify the sketch…"
                className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-100 outline-none focus:border-cyan-500 transition-colors min-w-0"
              />
              <button
                onClick={sendToAI}
                disabled={aiLoading || !userInput.trim()}
                className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
