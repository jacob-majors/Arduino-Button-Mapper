import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type UserConfig = {
  buttons: unknown[];
  portInputs: unknown[];
  leds: unknown;
  irSensors: unknown[];
  sipPuffs: unknown[];
  joysticks: unknown[];
};

export async function loadConfig(): Promise<UserConfig | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("user_configs")
    .select("config")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.config ?? null;
}

export async function saveConfig(config: UserConfig): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("user_configs")
    .upsert({ user_id: user.id, config, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}
