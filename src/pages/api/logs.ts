import type { APIRoute } from "astro";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";

export const prerender = false;

type TimeLogBody = {
  activity?: string;
  date?: string;
  minutes?: number;
  notes?: string;
};

export const GET: APIRoute = async () => {
  if (!isSupabaseConfigured()) {
    return json({ database: false, entries: [] });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return json({ database: false, entries: [] });
  }

  return json({
    database: true,
    entries: (data || []).map((entry) => ({
      id: entry.id,
      activity: entry.activity,
      date: entry.date,
      minutes: entry.minutes,
      notes: entry.notes || "",
      createdAt: entry.created_at,
    })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ error: "Supabase is not configured." }, 503);
  }

  const body = (await request.json()) as TimeLogBody;
  const activity = body.activity?.trim();
  const minutes = Number(body.minutes);
  const date = body.date?.trim();
  const notes = body.notes?.trim() || "";

  if (!activity || !date || !Number.isFinite(minutes) || minutes < 1) {
    return json({ error: "Activity, date, and minutes are required." }, 400);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("logs")
    .insert({ activity, date, minutes, notes })
    .select()
    .single();

  if (error || !data) {
    return json({ error: "Failed to save log." }, 500);
  }

  return json(
    {
      entry: {
        id: data.id,
        activity: data.activity,
        date: data.date,
        minutes: data.minutes,
        notes: data.notes || "",
        createdAt: data.created_at,
      },
    },
    201,
  );
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
