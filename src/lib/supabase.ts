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

export type SaveSlot = {
  id: string;
  name: string;
  config: UserConfig;
  updated_at: string;
};

export async function loadAllSaves(): Promise<SaveSlot[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_configs")
    .select("id, name, config, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  return (data as SaveSlot[]) ?? [];
}

export async function upsertSave(id: string | null, name: string, config: UserConfig): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "";
  if (id) {
    await supabase
      .from("user_configs")
      .update({ name, config, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    return id;
  }
  const { data } = await supabase
    .from("user_configs")
    .insert({ user_id: user.id, name, config })
    .select("id")
    .single();
  return data?.id ?? "";
}

export async function deleteSave(id: string): Promise<void> {
  await supabase.from("user_configs").delete().eq("id", id);
}
