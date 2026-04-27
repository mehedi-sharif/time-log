import type { APIRoute } from "astro";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";

export const prerender = false;

export const GET: APIRoute = async () => {
  if (!isSupabaseConfigured()) {
    return json({ database: false, goals: [] });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return json({ database: false, goals: [] });
  }

  return json({
    database: true,
    goals: (data || []).map((g) => ({
      id: g.id,
      title: g.title,
      completed: g.completed,
      created_at: g.created_at,
    })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ error: "Supabase is not configured." }, 503);
  }

  const body = await request.json();
  const title = body.title?.trim();

  if (!title) {
    return json({ error: "Title is required." }, 400);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({ title, completed: false })
    .select()
    .single();

  if (error || !data) {
    return json({ error: "Failed to save goal." }, 500);
  }

  return json({ goal: { id: data.id, title: data.title, completed: data.completed, created_at: data.created_at } }, 201);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
