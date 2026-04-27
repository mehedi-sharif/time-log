import type { APIRoute } from "astro";
import { getSupabaseClient, isSupabaseConfigured } from "../../../lib/supabase";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  if (!isSupabaseConfigured()) {
    return json({ error: "Supabase is not configured." }, 503);
  }

  const body = await request.json();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("goals")
    .update({ completed: body.completed })
    .eq("id", params.id);

  if (error) return json({ error: "Failed to update goal." }, 500);
  return json({ success: true });
};

export const DELETE: APIRoute = async ({ params }) => {
  if (!isSupabaseConfigured()) {
    return json({ error: "Supabase is not configured." }, 503);
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("goals").delete().eq("id", params.id);

  if (error) return json({ error: "Failed to delete goal." }, 500);
  return json({ success: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
