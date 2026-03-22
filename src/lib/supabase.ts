import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const ADMIN_USERNAME = "jacob.majors";
const ADMIN_USERNAMES = ["jacob.majors", "ramsey.musallam"];
export const isAdmin = (username: string) => ADMIN_USERNAMES.includes(username);

export type AppUser = { id: string; username: string; created_at?: string };

export type UserConfig = {
  buttons: unknown[];
  portInputs: unknown[];
  leds: unknown;
  irSensors: unknown[];
  sipPuffs?: unknown[];
  joysticks: unknown[];
};

export type SaveSlot = {
  id: string;
  name: string;
  config: UserConfig;
  updated_at: string;
};

export type AdminSettings = {
  show_ports: boolean;
  show_leds: boolean;
  show_upload: boolean;
  show_sensors: boolean;
  show_buttons: boolean;
  show_games: boolean;
  show_wiring: boolean;
  show_controller: boolean;
  maintenance_mode: boolean;
  welcome_message: string;
};

// ── Auth (username-only, no password) ───────────────────────────────────────
// Required Supabase SQL (run once in Supabase SQL editor):
//
// CREATE TABLE public.app_users (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   username text UNIQUE NOT NULL,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "public read"   ON public.app_users FOR SELECT USING (true);
// CREATE POLICY "public insert" ON public.app_users FOR INSERT WITH CHECK (true);
//
// CREATE TABLE public.admin_settings (
//   id int DEFAULT 1 PRIMARY KEY CHECK (id = 1),
//   show_ports boolean DEFAULT true,
//   show_leds  boolean DEFAULT true,
//   updated_at timestamptz DEFAULT now()
// );
// INSERT INTO public.admin_settings VALUES (1, true, true, now()) ON CONFLICT DO NOTHING;
// ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "public read"   ON public.admin_settings FOR SELECT USING (true);
// CREATE POLICY "public update" ON public.admin_settings FOR UPDATE USING (true);
//
// ALTER TABLE public.user_configs DISABLE ROW LEVEL SECURITY;

export async function loginOrCreate(username: string): Promise<AppUser | null> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from("app_users")
    .select("id, username")
    .eq("username", trimmed)
    .maybeSingle();
  if (existing) return existing as AppUser;
  const { data: created } = await supabase
    .from("app_users")
    .insert({ username: trimmed })
    .select("id, username")
    .single();
  return (created as AppUser) ?? null;
}

// ── Saves ───────────────────────────────────────────────────────────────────

export async function loadAllSaves(userId: string): Promise<SaveSlot[]> {
  const { data } = await supabase
    .from("user_configs")
    .select("id, name, config, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return (data as SaveSlot[]) ?? [];
}

export async function upsertSave(
  userId: string,
  id: string | null,
  name: string,
  config: UserConfig
): Promise<string> {
  if (id) {
    await supabase
      .from("user_configs")
      .update({ name, config, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    return id;
  }
  const { data } = await supabase
    .from("user_configs")
    .insert({ user_id: userId, name, config })
    .select("id")
    .single();
  return data?.id ?? "";
}

export async function deleteSave(id: string): Promise<void> {
  await supabase.from("user_configs").delete().eq("id", id);
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function getAdminSettings(): Promise<AdminSettings> {
  const { data } = await supabase
    .from("admin_settings")
    .select("show_ports, show_leds, show_upload, show_sensors, show_buttons, show_games, show_wiring, show_controller, maintenance_mode, welcome_message")
    .eq("id", 1)
    .single();
  return (data as AdminSettings) ?? { show_ports: true, show_leds: true, show_upload: true, show_sensors: true, show_buttons: true, show_games: true, show_wiring: true, show_controller: true, maintenance_mode: false, welcome_message: "" };
}

export async function updateAdminSettings(settings: Partial<AdminSettings>): Promise<void> {
  await supabase
    .from("admin_settings")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", 1);
}

export async function loadAllUsers(): Promise<AppUser[]> {
  const { data } = await supabase
    .from("app_users")
    .select("id, username, created_at")
    .order("created_at", { ascending: false });
  return (data as AppUser[]) ?? [];
}

export async function deleteUser(userId: string): Promise<void> {
  await supabase.from("user_configs").delete().eq("user_id", userId);
  await supabase.from("app_users").delete().eq("id", userId);
}

// ── Setup Sharing ────────────────────────────────────────────────────────────
// Required SQL (run once in Supabase SQL editor):
//
// CREATE TABLE public.shared_setups (
//   id text PRIMARY KEY,
//   config jsonb NOT NULL,
//   name text NOT NULL DEFAULT 'Shared Setup',
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE public.shared_setups ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "public read"   ON public.shared_setups FOR SELECT USING (true);
// CREATE POLICY "public insert" ON public.shared_setups FOR INSERT WITH CHECK (true);

function randomShareId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 18 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function saveSharedSetup(name: string, config: UserConfig): Promise<string> {
  const id = randomShareId();
  await supabase.from("shared_setups").insert({ id, name, config });
  return id;
}

export async function loadSharedSetup(id: string): Promise<{ name: string; config: UserConfig } | null> {
  const { data } = await supabase
    .from("shared_setups")
    .select("name, config")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { name: data.name as string, config: data.config as UserConfig };
}

// ── Dino Leaderboard ────────────────────────────────────────────────────────
// Required SQL (run once in Supabase SQL editor):
//
// CREATE TABLE public.dino_scores (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   username text NOT NULL,
//   score int NOT NULL,
//   updated_at timestamptz DEFAULT now()
// );
// CREATE UNIQUE INDEX dino_scores_username_idx ON public.dino_scores (username);
// ALTER TABLE public.dino_scores ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "public read"   ON public.dino_scores FOR SELECT USING (true);
// CREATE POLICY "public insert" ON public.dino_scores FOR INSERT WITH CHECK (true);
// CREATE POLICY "public update" ON public.dino_scores FOR UPDATE USING (true);

export type DinoScore = { username: string; score: number };

export async function submitDinoScore(username: string, score: number): Promise<void> {
  // Upsert: only update if new score is higher
  const { data: existing } = await supabase
    .from("dino_scores")
    .select("score")
    .eq("username", username)
    .maybeSingle();
  if (existing && existing.score >= score) return;
  await supabase.from("dino_scores").upsert(
    { username, score, updated_at: new Date().toISOString() },
    { onConflict: "username" }
  );
}

export async function getTopDinoScores(limit = 3): Promise<DinoScore[]> {
  const { data } = await supabase
    .from("dino_scores")
    .select("username, score")
    .order("score", { ascending: false })
    .limit(limit);
  return (data as DinoScore[]) ?? [];
}
