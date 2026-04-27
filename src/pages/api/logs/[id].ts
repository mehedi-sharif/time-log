import type { APIRoute } from "astro";
import { getSupabaseClient, isSupabaseConfigured } from "../../../lib/supabase";

export const prerender = false;

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
    return json({ error: "Failed to delete log." }, 500);
  }

  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
