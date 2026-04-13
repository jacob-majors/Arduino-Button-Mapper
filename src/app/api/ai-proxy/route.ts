import { NextRequest, NextResponse } from "next/server";

type OK  = { text: string };
type Err = { error: string };

async function callClaude(key: string, prompt: string, systemPrompt: string): Promise<NextResponse<OK | Err>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json() as { error?: { message?: string }; content?: Array<{ text?: string }> };
  if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? `Claude error ${res.status}` }, { status: res.status });
  return NextResponse.json({ text: data.content?.[0]?.text ?? "" });
}

async function callGemini(key: string, prompt: string, systemPrompt: string): Promise<NextResponse<OK | Err>> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    }
  );
  const data = await res.json() as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? `Gemini error ${res.status}` }, { status: res.status });
  return NextResponse.json({ text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "" });
}

export async function POST(req: NextRequest) {
  const { apiKey, prompt, systemPrompt } = await req.json() as {
    apiKey?: string; prompt: string; systemPrompt: string;
  };

  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

  const key = (apiKey ?? "").trim();

  // Route by user-provided key prefix
  if (key.startsWith("sk-ant-")) return callClaude(key, prompt, systemPrompt ?? "");
  if (key.startsWith("AIza"))    return callGemini(key, prompt, systemPrompt ?? "");

  // No user key — fall back to server-side keys (free tier for users)
  const serverGemini = process.env.GEMINI_API_KEY;
  const serverClaude = process.env.ANTHROPIC_API_KEY;
  if (serverGemini) return callGemini(serverGemini, prompt, systemPrompt ?? "");
  if (serverClaude) return callClaude(serverClaude, prompt, systemPrompt ?? "");

  return NextResponse.json(
    { error: "No API key provided. Paste a Gemini or Claude key in the chat panel to use AI." },
    { status: 400 }
  );
}
