import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { apiKey, prompt, systemPrompt } = await req.json() as {
    apiKey: string;
    prompt: string;
    systemPrompt: string;
  };

  if (!apiKey || !prompt) {
    return NextResponse.json({ error: "Missing apiKey or prompt" }, { status: 400 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: (data as { error?: { message?: string } })?.error?.message ?? `API error ${res.status}` }, { status: res.status });
  }

  return NextResponse.json(data);
}
