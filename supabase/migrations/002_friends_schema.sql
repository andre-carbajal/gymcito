-- ============================================================
-- Gymcito – Friends Schema
-- ============================================================

-- ── Friendships table ─────────────────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),

  -- Prevent self-friendship
  constraint no_self_friendship check (user_id != friend_id),

  -- Prevent duplicate requests (A→B unique)
  constraint unique_friendship unique (user_id, friend_id)
);

-- Index for fast lookups
create index if not exists idx_friendships_user_id on public.friendships (user_id);
create index if not exists idx_friendships_friend_id on public.friendships (friend_id);
create index if not exists idx_friendships_status on public.friendships (status);

-- ── Row Level Security ────────────────────────────────────────

alter table public.friendships enable row level security;

-- Users can see friendships they are part of
create policy "Users can view their own friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Users can send friend requests (as user_id)
create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = user_id);

-- Only the receiver (friend_id) can accept/reject
create policy "Receiver can respond to friend requests"
  on public.friendships for update
  using (auth.uid() = friend_id);

-- Either party can delete the friendship
create policy "Either party can remove friendship"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- ── Auto-accept mutual friend requests ────────────────────────
-- If A sends request to B while B already has a pending request to A,
-- both requests become 'accepted'.

create or replace function public.handle_mutual_friend_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reverse_id uuid;
begin
  -- Only act on new pending requests
  if new.status != 'pending' then
    return new;
  end if;

  -- Check if a reverse pending request exists (B → A)
  select id into reverse_id
  from public.friendships
  where user_id = new.friend_id
    and friend_id = new.user_id
    and status = 'pending';

  if reverse_id is not null then
    -- Accept the reverse request
    update public.friendships
    set status = 'accepted'
    where id = reverse_id;

    -- Also accept this request
    new.status := 'accepted';
  end if;

  return new;
end;
$$;

drop trigger if exists on_friendship_insert on public.friendships;

create trigger on_friendship_insert
  before insert on public.friendships
  for each row
  execute function public.handle_mutual_friend_request();

-- ── Search users by username ──────────────────────────────────

create or replace function public.search_users(search_text text)
returns table (
  id uuid,
  username text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select p.id, p.username
  from public.profiles p
  where p.username ilike '%' || search_text || '%'
    and p.id != auth.uid()
  order by p.username
  limit 20;
end;
$$;

-- ── Get friend score comparison ───────────────────────────────

create or replace function public.get_friend_scores(friend_uuid uuid)
returns table (
  game text,
  my_best_score integer,
  friend_best_score integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    g.game,
    coalesce((
      select max(s.score)
      from public.scores s
      where s.user_id = auth.uid() and s.game = g.game
    ), 0) as my_best_score,
    coalesce((
      select max(s.score)
      from public.scores s
      where s.user_id = friend_uuid and s.game = g.game
    ), 0) as friend_best_score
  from (
    values ('flappy'), ('dino'), ('ironboard')
  ) as g(game);
end;
$$;

-- ── Enable Realtime for friendships table ─────────────────────
alter publication supabase_realtime add table public.friendships;
