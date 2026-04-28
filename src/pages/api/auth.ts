import type { APIRoute } from "astro";
import { getSupabaseClient } from "../../lib/supabase";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { password } = (await request.json()) as { password?: string };

  if (!password) {
    return json({ ok: false }, 400);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "password")
    .single();

  if (error || !data) {
    return json({ ok: false }, 500);
  }

  return json({ ok: password === data.value });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
