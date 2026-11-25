import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { State } from "./model";

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return (client ??= createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } }));
}

const LS = "overbuilt";
export function loadLocal(): State | null {
  try { const s = localStorage.getItem(LS); return s ? (JSON.parse(s) as State) : null; } catch { return null; }
}
export function saveLocal(s: State) {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* private mode */ }
}

/** Learning state lives in Supabase when signed in (RLS: owner email only), else in this browser. */
export async function loadRemote(): Promise<State | null> {
  const c = sb(); if (!c) return null;
  const { data: u } = await c.auth.getUser(); if (!u.user) return null;
  const { data } = await c.from("learning_state").select("state").eq("user_id", u.user.id).maybeSingle();
  return (data?.state as State) ?? null;
}
let t: ReturnType<typeof setTimeout> | undefined;
export function saveRemote(s: State, onDone?: (ok: boolean) => void) {
  clearTimeout(t);
  t = setTimeout(async () => {
    const c = sb(); if (!c) return;
    const { data: u } = await c.auth.getUser(); if (!u.user) return;
    const { error } = await c.from("learning_state").upsert({ user_id: u.user.id, state: s, updated_at: new Date().toISOString() });
    onDone?.(!error);
  }, 800);
}
