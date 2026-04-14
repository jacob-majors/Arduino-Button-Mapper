import { NextRequest, NextResponse } from "next/server";

const GITHUB_REPO  = "jacob-majors/Arduino-Button-Mapper";
const GITHUB_TOKEN = process.env.GITHUB_ISSUES_TOKEN; // PAT with Issues: write scope

const CATEGORY_LABELS: Record<string, string> = {
  bug:      "bug",
  feature:  "enhancement",
  question: "question",
  other:    "documentation",
};

export async function POST(req: NextRequest) {
  const { title, description, category, username } = await req.json() as {
    title: string;
    description: string;
    category: string;
    username?: string;
  };

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "Title and description are required." }, { status: 400 });
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: "GitHub token not configured on server." }, { status: 500 });
  }

  const label = CATEGORY_LABELS[category] ?? "documentation";
  const body = [
    username ? `**Submitted by:** ${username}` : "**Submitted by:** anonymous",
    "",
    description.trim(),
  ].join("\n");

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: title.trim(), body, labels: [label] }),
  });

  if (!res.ok) {
    const err = await res.json() as { message?: string };
    return NextResponse.json(
      { error: err.message ?? `GitHub API error ${res.status}` },
      { status: res.status },
    );
  }

  const issue = await res.json() as { number: number; html_url: string };
  return NextResponse.json({ number: issue.number, url: issue.html_url });
}
