import { createClient } from "@supabase/supabase-js";

export function isSupabaseConfigured() {
  return Boolean(import.meta.env.SUPABASE_URL && import.meta.env.SUPABASE_SERVICE_KEY);
}

export function getSupabaseClient() {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured.");
  }
  return createClient(url, key);
}
