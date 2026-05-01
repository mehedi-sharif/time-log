-- Run this once in your Supabase SQL editor to create the three tables
-- the Time Log app needs:  logs, goals, settings.
--
-- Open: Supabase dashboard → SQL Editor → "New query" → paste → Run.

-- ── Logs ────────────────────────────────────────────────────────────────
create table if not exists public.logs (
  id          uuid primary key default gen_random_uuid(),
  activity    text        not null,
  date        date        not null,
  minutes     integer     not null check (minutes >= 0),
  start_time  text,       -- "HH:MM" 24h
  end_time    text,       -- "HH:MM" 24h
  created_at  timestamptz not null default now()
);

create index if not exists logs_date_idx       on public.logs(date desc);
create index if not exists logs_created_at_idx on public.logs(created_at desc);

-- ── Goals ───────────────────────────────────────────────────────────────
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  completed   boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists goals_created_at_idx on public.goals(created_at desc);

-- ── Settings (password gate) ───────────────────────────────────────────
create table if not exists public.settings (
  key   text primary key,
  value text not null
);

-- Set the app password (CHANGE THIS!).
insert into public.settings (key, value)
values ('password', 'change-me')
on conflict (key) do update set value = excluded.value;
