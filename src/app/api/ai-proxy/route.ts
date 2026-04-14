import { NextRequest, NextResponse } from "next/server";

type OK  = { text: string };
type Err = { error: string; isQuota?: boolean };
type HistoryMsg = { role: "user" | "assistant"; content: string };
type RawResult  = OK | Err;

const QUOTA_RE = /quota|rate.?limit|resource.?exhausted|limit.*exceeded/i;

async function callClaudeRaw(
  key: string,
  prompt: string,
  systemPrompt: string,
  history: HistoryMsg[],
): Promise<RawResult> {
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: prompt },
  ];
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 8192,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await res.json() as {
      error?: { message?: string };
      content?: Array<{ text?: string }>;
    };
    if (!res.ok) {
      const msg = data?.error?.message ?? `Claude error ${res.status}`;
      return { error: msg, isQuota: QUOTA_RE.test(msg) || res.status === 429 };
    }
    return { text: data.content?.[0]?.text ?? "" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

async function callGeminiRaw(
  key: string,
  prompt: string,
  systemPrompt: string,
  history: HistoryMsg[],
): Promise<RawResult> {
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: prompt }] },
  ];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
      },
    );
    const data = await res.json() as {
      error?: { message?: string; status?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (!res.ok) {
      const msg = data?.error?.message ?? `Gemini error ${res.status}`;
      return { error: msg, isQuota: QUOTA_RE.test(msg) || res.status === 429 };
    }
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

function toResponse(result: RawResult): NextResponse {
  if ("error" in result)
    return NextResponse.json(result, { status: result.isQuota ? 429 : 500 });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { apiKey, prompt, systemPrompt, history } = await req.json() as {
    apiKey?: string;
    prompt: string;
    systemPrompt: string;
    history?: HistoryMsg[];
  };

  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

  const key  = (apiKey ?? "").trim();
  const hist = history ?? [];
  const sys  = systemPrompt ?? "";

  // ── User-provided key (takes priority) ──────────────────────────────────────
  if (key.startsWith("sk-ant-")) return toResponse(await callClaudeRaw(key, prompt, sys, hist));
  if (key.startsWith("AIza"))    return toResponse(await callGeminiRaw(key, prompt, sys, hist));

  // ── Server-side fallback (Gemini first, auto-retry with Claude on quota) ────
  const serverGemini = process.env.GEMINI_API_KEY;
  const serverClaude = process.env.ANTHROPIC_API_KEY;

  if (serverGemini) {
    const geminiResult = await callGeminiRaw(serverGemini, prompt, sys, hist);
    // If Gemini succeeded, or failed for a non-quota reason, return as-is
    if (!("error" in geminiResult)) return toResponse(geminiResult);
    if (!geminiResult.isQuota)      return toResponse(geminiResult);
    // Quota hit — fall through to Claude
  }

  if (serverClaude) return toResponse(await callClaudeRaw(serverClaude, prompt, sys, hist));

  return NextResponse.json(
    {
      error: "Free AI quota has been reached. Paste your own Claude (sk-ant-…) or Gemini (AIza…) API key to continue.",
      isQuota: true,
    },
    { status: 429 },
  );
}
