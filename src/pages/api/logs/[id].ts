import type { APIRoute } from "astro";
import { getSupabaseClient, isSupabaseConfigured } from "../../../lib/supabase";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  if (!isSupabaseConfigured()) {
    return json({ error: "Supabase is not configured." }, 503);
  }

  const id = params.id;
  if (!id) return json({ error: "Invalid log id." }, 400);

  const body = (await request.json()) as { activity?: string; start_time?: string; end_time?: string; minutes?: number };
  const { activity, start_time, end_time, minutes } = body;

  if (!activity || !start_time || !end_time || !minutes) {
    return json({ error: "Missing required fields." }, 400);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("logs")
    .update({ activity, start_time, end_time, minutes })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return json({ error: "Failed to update log." }, 500);

  return json({ entry: { id: data.id, activity: data.activity, date: data.date, minutes: data.minutes, start_time: data.start_time, end_time: data.end_time } });
};

export const DELETE: APIRoute = async ({ params }) => {
  if (!isSupabaseConfigured()) {
    return json({ error: "Supabase is not configured." }, 503);
  }

  const id = params.id;
  if (!id) {
    return json({ error: "Invalid log id." }, 400);
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("logs").delete().eq("id", id);

  if (error) {
    console.error("Supabase logs.delete error:", error);
    return json({ error: "Failed to delete log.", detail: error.message, code: error.code }, 500);
  }

  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
