import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_USERS = ["jacob.majors", "ramsey.musallam"];

type AdminSessionPayload = {
  username: string;
  exp: number;
};

function getAdminUsers(): string[] {
  return (process.env.ADMIN_USERNAMES ?? DEFAULT_ADMIN_USERS.join(","))
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured.");
  return secret;
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is not configured.");
  return password;
}

function signSession(payload: AdminSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(encoded).digest("hex");
  return `${encoded}.${signature}`;
}

function verifySession(rawValue?: string): AdminSessionPayload | null {
  if (!rawValue) return null;
  const [encoded, signature] = rawValue.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", getSessionSecret()).update(encoded).digest("hex");
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AdminSessionPayload;
  if (!payload?.username || !payload?.exp || payload.exp <= Date.now()) return null;
  if (!getAdminUsers().includes(payload.username.toLowerCase())) return null;
  return payload;
}

function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdminSession() {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

function setSessionCookie(res: NextResponse, payload: AdminSessionPayload) {
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: signSession(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(payload.exp),
  });
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "session") {
    try {
      const session = await requireAdminSession();
      return NextResponse.json({ active: !!session, username: session?.username ?? null });
    } catch {
      return NextResponse.json({ active: false, username: null });
    }
  }

  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Admin session required." }, { status: 401 });

  try {
    const supabase = createServerSupabase();

    if (action === "users") {
      const [{ data: users, error: usersError }, { data: configs, error: configsError }] = await Promise.all([
        supabase
          .from("app_users")
          .select("id, username, created_at, last_active_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_configs").select("user_id"),
      ]);
      if (usersError) throw usersError;
      if (configsError) throw configsError;

      const saveCounts = Object.create(null) as Record<string, number>;
      for (const row of configs ?? []) {
        const userId = (row as { user_id?: string }).user_id;
        if (!userId) continue;
        saveCounts[userId] = (saveCounts[userId] ?? 0) + 1;
      }

      return NextResponse.json({ users: users ?? [], saveCounts });
    }

    if (action === "user-saves") {
      const userId = req.nextUrl.searchParams.get("userId");
      if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

      const { data, error } = await supabase
        .from("user_configs")
        .select("id, name, config, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ saves: data ?? [] });
    }

    if (action === "issues") {
      const { data, error } = await supabase
        .from("issues")
        .select("id, username, title, description, category, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ issues: data ?? [] });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin request failed." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "session") {
    try {
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!username || !password) {
        return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
      }
      if (!getAdminUsers().includes(username)) {
        return NextResponse.json({ error: "That account is not allowed to open admin tools." }, { status: 403 });
      }
      if (password !== getAdminPassword()) {
        return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
      }

      const payload = { username, exp: Date.now() + ADMIN_SESSION_TTL_MS };
      const res = NextResponse.json({ active: true, username });
      setSessionCookie(res, payload);
      return res;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to create admin session." },
        { status: 500 },
      );
    }
  }

  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Admin session required." }, { status: 401 });

  try {
    const supabase = createServerSupabase();

    if (action === "template-upsert") {
      const { id, label, emoji, description, config } = body as {
        id?: string | null;
        label?: string;
        emoji?: string;
        description?: string;
        config?: unknown;
      };
      if (!label?.trim() || !config) {
        return NextResponse.json({ error: "Template label and config are required." }, { status: 400 });
      }

      if (id) {
        const { error } = await supabase
          .from("templates")
          .update({ label, emoji: emoji ?? "🎯", description: description ?? "", config })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ id });
      }

      const { data, error } = await supabase
        .from("templates")
        .insert({ label, emoji: emoji ?? "🎯", description: description ?? "", config })
        .select("id")
        .single();
      if (error) throw error;
      return NextResponse.json({ id: data?.id ?? null });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin request failed." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Admin session required." }, { status: 401 });

  try {
    const supabase = createServerSupabase();
    const body = await req.json() as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "settings") {
      const settings = body.settings as Record<string, unknown> | undefined;
      if (!settings) return NextResponse.json({ error: "Missing settings payload." }, { status: 400 });

      const { error } = await supabase
        .from("admin_settings")
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "issue-status") {
      const id = String(body.id ?? "");
      const status = String(body.status ?? "");
      if (!id || !status) return NextResponse.json({ error: "Missing issue id or status." }, { status: 400 });

      const { error } = await supabase.from("issues").update({ status }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin request failed." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "session") {
    const res = NextResponse.json({ active: false });
    clearSessionCookie(res);
    return res;
  }

  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Admin session required." }, { status: 401 });

  try {
    const supabase = createServerSupabase();

    if (action === "user") {
      const userId = req.nextUrl.searchParams.get("userId");
      if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });

      const { error: savesError } = await supabase.from("user_configs").delete().eq("user_id", userId);
      if (savesError) throw savesError;
      const { error: userError } = await supabase.from("app_users").delete().eq("id", userId);
      if (userError) throw userError;
      return NextResponse.json({ ok: true });
    }

    if (action === "issue") {
      const issueId = req.nextUrl.searchParams.get("issueId");
      if (!issueId) return NextResponse.json({ error: "Missing issueId." }, { status: 400 });

      const { error } = await supabase.from("issues").delete().eq("id", issueId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "template") {
      const id = req.nextUrl.searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Missing template id." }, { status: 400 });

      const { error } = await supabase.from("templates").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin request failed." },
      { status: 500 },
    );
  }
}
