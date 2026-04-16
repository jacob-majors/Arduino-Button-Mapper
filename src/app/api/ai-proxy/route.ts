import { NextRequest, NextResponse } from "next/server";

type OK = { text: string };
type Err = { error: string; isQuota?: boolean };
type HistoryMsg = { role: "user" | "assistant"; content: string };
type RawResult = OK | Err;

const QUOTA_RE = /quota|rate.?limit|resource.?exhausted|limit.*exceeded|neurons/i;
const MODEL = "@cf/openai/gpt-oss-20b";

async function callCloudflareRaw(
  accountId: string,
  apiToken: string,
  prompt: string,
  systemPrompt: string,
  history: HistoryMsg[],
): Promise<RawResult> {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: prompt },
  ];

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.2,
          max_tokens: 4096,
        }),
      },
    );

    const data = await res.json() as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: {
        response?: string;
      };
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg =
        data?.error?.message ??
        data?.errors?.[0]?.message ??
        `Cloudflare Workers AI error ${res.status}`;
      return { error: msg, isQuota: QUOTA_RE.test(msg) || res.status === 429 };
    }

    const choiceContent = data?.choices?.[0]?.message?.content;
    const text =
      typeof choiceContent === "string"
        ? choiceContent
        : Array.isArray(choiceContent)
          ? choiceContent.map((part) => part.text ?? "").join("")
          : data?.result?.response ?? "";

    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

function toResponse(result: RawResult): NextResponse {
  if ("error" in result) {
    return NextResponse.json(result, { status: result.isQuota ? 429 : 500 });
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { prompt, systemPrompt, history } = await req.json() as {
    prompt?: string;
    systemPrompt?: string;
    history?: HistoryMsg[];
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    return NextResponse.json(
      {
        error:
          "Cloudflare Workers AI is not configured yet. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server.",
      },
      { status: 503 },
    );
  }

  const result = await callCloudflareRaw(
    accountId,
    apiToken,
    prompt.trim(),
    systemPrompt ?? "",
    history ?? [],
  );

  return toResponse(result);
}
