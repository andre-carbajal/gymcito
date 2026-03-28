-- ============================================================
-- Gymcito – Initial Schema
-- ============================================================

-- ── Profiles table ────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default '',
  created_at timestamptz not null default now()
);

-- ── Scores table ──────────────────────────────────────────────
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('flappy', 'dino', 'ironboard')),
  score integer not null default 0,
  input_mode text not null check (input_mode in ('camera', 'touch', 'mouse')),
  created_at timestamptz not null default now()
);

-- Index for fast leaderboard queries
create index if not exists idx_scores_game_score
  on public.scores (game, score desc);

-- ── Row Level Security ────────────────────────────────────────

-- Profiles
alter table public.profiles enable row level security;

-- Anyone can read profiles (needed for leaderboard display)
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Users can update only their own profile
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Scores
alter table public.scores enable row level security;

-- Anyone can read scores (leaderboard)
create policy "Scores are viewable by everyone"
  on public.scores for select
  using (true);

-- Authenticated users can insert their own scores
create policy "Authenticated users can insert their own scores"
  on public.scores for insert
  with check (auth.uid() = user_id);

-- ── Auto-create profile on signup ─────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

-- Drop existing trigger if it exists, then create
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ── Enable Realtime for scores table ──────────────────────────
alter publication supabase_realtime add table public.scores;
