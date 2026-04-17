"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Code2,
  Copy,
  Loader2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import {
  classifySketchLines,
  extractMarkedSection,
  loadSketchWorkspace,
  saveSketchWorkspace,
  type SketchWorkspace,
} from "@/lib/sketch-workspace";

type AIMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Add debounce to all buttons",
  "Make the joystick smoother",
  "Flash an LED when a key is pressed",
  "Require a long press before firing",
  "Explain what this sketch is doing",
];

const SOURCE_STYLES = {
  button: {
    label: "Button code",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    line: "bg-emerald-500/10 text-emerald-100",
  },
  ai: {
    label: "AI added",
    chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    line: "bg-cyan-500/10 text-cyan-100",
  },
  user: {
    label: "You added",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    line: "bg-amber-500/10 text-amber-100",
  },
  generated: {
    label: "Generated",
    chip: "border-gray-700 bg-gray-800/80 text-gray-400",
    line: "text-gray-400",
  },
} as const;

function snippetForSource(workspace: SketchWorkspace, source: "ai" | "user") {
  const lines = classifySketchLines(workspace)
    .filter((line) => line.source === source && line.line.trim())
    .map((line) => line.line);
  return lines.length > 0 ? lines.join("\n") : `// No ${source === "ai" ? "AI" : "manual"} additions yet`;
}

export default function SketchPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<SketchWorkspace | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const existingWorkspace = loadSketchWorkspace();
    setWorkspace(existingWorkspace);
    setShowAIChat(new URLSearchParams(window.location.search).get("ai") === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!showAIChat) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [showAIChat]);

  useEffect(() => {
    if (!hydrated || !workspace) return;
    saveSketchWorkspace(workspace);
    setJustSaved(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setJustSaved(false), 1400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [workspace, hydrated]);

  const classification = useMemo(() => (
    workspace ? classifySketchLines(workspace) : []
  ), [workspace]);

  const buttonCode = useMemo(() => (
    workspace ? extractMarkedSection(workspace.originalCode, "BUTTONS") || "// No button block found in this sketch yet" : ""
  ), [workspace]);

  const aiCode = useMemo(() => (
    workspace ? snippetForSource(workspace, "ai") : ""
  ), [workspace]);

  const userCode = useMemo(() => (
    workspace ? snippetForSource(workspace, "user") : ""
  ), [workspace]);

  const isModified = workspace ? workspace.editedCode !== workspace.originalCode : false;

  const updateEditedCode = (nextCode: string) => {
    setWorkspace((current) => current ? { ...current, editedCode: nextCode, updatedAt: Date.now() } : current);
  };

  const resetToGenerated = () => {
    setWorkspace((current) => current ? {
      ...current,
      editedCode: current.originalCode,
      aiCode: null,
      updatedAt: Date.now(),
    } : current);
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
    setMessages((prev) => [...prev, { role: "user", content: request }]);
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
        body: JSON.stringify({
          systemPrompt,
          prompt,
          history: apiHistory,
        }),
      });
      const data = await res.json() as { text?: string; error?: string; isQuota?: boolean };
      const isQuotaError =
        res.status === 429 ||
        data.isQuota === true ||
        /quota|rate.?limit|resource.?exhausted|limit.*exceeded/i.test(data.error ?? "");

      if (isQuotaError) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "The built-in AI quota is reached right now. Try again in a little bit.",
        }]);
        return;
      }

      if (!res.ok || data.error) throw new Error(data.error ?? `Error ${res.status}`);

      const raw = (data.text ?? "")
        .replace(/^```(?:cpp|arduino|c\+\+)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

      const looksLikeCode =
        /^(\/\/|#include|void setup|void loop|bool |int |const |\/\*)/m.test(raw.slice(0, 300));

      if (looksLikeCode) {
        setWorkspace((current) => current ? {
          ...current,
          editedCode: raw,
          aiCode: raw,
          updatedAt: Date.now(),
        } : current);
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Sketch updated. The cyan code blocks show what AI added or changed.",
        }]);
        setApiHistory((prev) => [
          ...prev,
          { role: "user", content: prompt },
          { role: "assistant", content: "Sketch updated successfully." },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: raw }]);
        setApiHistory((prev) => [
          ...prev,
          { role: "user", content: prompt },
          { role: "assistant", content: raw },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Something went wrong."}`,
      }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-200 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          Loading sketch workspace...
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-200 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-gray-800 bg-gray-900/80 p-8">
          <div className="flex items-center gap-2 text-cyan-300">
            <Code2 size={18} />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Sketch Workspace</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-white">No sketch is loaded yet.</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            Open the builder first, then press Sketch or AI. That loads your generated Arduino code into this full-page editor.
          </p>
          <button
            onClick={() => router.push("/app")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-500"
          >
            <ArrowLeft size={15} />
            Back to Builder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060816] text-gray-100">
      <div className="border-b border-gray-800 bg-gray-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <button
              onClick={() => router.push("/app")}
              className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 transition-colors hover:text-cyan-200"
            >
              <ArrowLeft size={14} />
              Back to Builder
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-white sm:text-2xl">Arduino Sketch Workspace</h1>
              {isModified && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  modified
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              Green shows generated button code. Cyan shows AI edits. Amber shows what you changed by hand.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900/80 px-3 py-1.5 text-[11px] text-gray-400">
              <Save size={12} className={justSaved ? "text-emerald-300" : "text-gray-500"} />
              {justSaved ? "Saved to builder" : "Autosaves to builder"}
            </div>
            <button
              onClick={() => setShowAIChat((value) => !value)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                showAIChat
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                  : "border-gray-700 bg-gray-900 text-gray-300 hover:border-cyan-500/30 hover:text-cyan-100"
              }`}
            >
              <MessageSquare size={13} />
              AI
            </button>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
            >
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={resetToGenerated}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/15"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1700px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <section className="min-h-[70vh] overflow-hidden rounded-[28px] border border-gray-800 bg-gray-950/80 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Code2 size={15} className="text-cyan-300" />
              <span className="text-sm font-semibold text-gray-200">Full Sketch</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {(["button", "ai", "user"] as const).map((source) => (
                <span
                  key={source}
                  className={`rounded-full border px-2 py-1 font-semibold ${SOURCE_STYLES[source].chip}`}
                >
                  {SOURCE_STYLES[source].label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid min-h-[70vh] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <textarea
              value={workspace.editedCode}
              onChange={(event) => updateEditedCode(event.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              className="min-h-[36rem] w-full resize-none border-b border-gray-800 bg-transparent px-4 py-4 font-mono text-[12px] leading-6 text-gray-200 outline-none xl:min-h-full xl:border-b-0 xl:border-r"
            />

            <div className="min-h-[36rem] overflow-auto bg-[#09101f] px-4 py-4 font-mono text-[12px] leading-6 xl:min-h-full">
              {classification.map((line) => (
                <div
                  key={`${line.index}-${line.line}`}
                  className={`grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-md px-2 ${
                    line.source === "generated" ? SOURCE_STYLES.generated.line : SOURCE_STYLES[line.source].line
                  }`}
                >
                  <span className="select-none text-right text-[10px] text-gray-600">{line.index + 1}</span>
                  <span className="whitespace-pre-wrap break-words">{line.line || " "}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="flex min-h-[70vh] flex-col gap-4">
          <section className="rounded-[28px] border border-gray-800 bg-gray-950/80 p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-cyan-300" />
              <h2 className="text-sm font-semibold text-gray-100">Code Sources</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              This breaks the sketch into the hardware mapping block, AI-generated changes, and your manual edits.
            </p>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
                <div className="flex items-center gap-2 border-b border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200">
                  <Code2 size={12} />
                  Code for your buttons
                </div>
                <pre className="max-h-52 overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-[11px] leading-5 text-emerald-100">{buttonCode}</pre>
              </div>

              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10">
                <div className="flex items-center gap-2 border-b border-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-200">
                  <Bot size={12} />
                  Code AI added
                </div>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-[11px] leading-5 text-cyan-100">{aiCode}</pre>
              </div>

              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10">
                <div className="flex items-center gap-2 border-b border-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-200">
                  <Pencil size={12} />
                  Code you added
                </div>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap px-3 py-3 font-mono text-[11px] leading-5 text-amber-100">{userCode}</pre>
              </div>
            </div>
          </section>

          <section className="flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-[28px] border border-gray-800 bg-gray-950/80">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-100">AI Sketch Help</h2>
                <p className="mt-1 text-[11px] text-gray-500">Ask for edits or explanations without leaving the page.</p>
              </div>
              <button
                onClick={() => setShowAIChat((value) => !value)}
                className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-gray-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-100"
              >
                {showAIChat ? "Hide" : "Show"}
              </button>
            </div>

            {showAIChat ? (
              <>
                <div className="flex-1 overflow-auto px-4 py-4">
                  {messages.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500">Try one of these:</p>
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => { setUserInput(suggestion); setTimeout(() => inputRef.current?.focus(), 20); }}
                          className="block w-full rounded-2xl border border-gray-800 bg-gray-900/70 px-3 py-3 text-left text-xs text-gray-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-100"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`rounded-2xl border px-3 py-2.5 text-sm leading-relaxed ${
                            message.role === "user"
                              ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-50"
                              : "border-gray-800 bg-gray-900/80 text-gray-200"
                          }`}
                        >
                          {message.content}
                        </div>
                      ))}
                      {aiLoading && (
                        <div className="flex items-center gap-2 rounded-2xl border border-gray-800 bg-gray-900/80 px-3 py-2.5 text-sm text-gray-400">
                          <Loader2 size={13} className="animate-spin text-cyan-300" />
                          Updating sketch...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-800 px-4 py-4">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      value={userInput}
                      onChange={(event) => setUserInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendToAI();
                        }
                      }}
                      placeholder="Describe what to change..."
                      className="flex-1 rounded-2xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
                    />
                    <button
                      onClick={sendToAI}
                      disabled={aiLoading || !userInput.trim()}
                      className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 size={14} className="animate-spin" /> : "Send"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
                Open the AI panel when you want the assistant to edit or explain the sketch.
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
