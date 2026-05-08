-- spotify_tokens: stores per-user Spotify OAuth credentials
-- One row per user; upserted on every OAuth login.

create table if not exists public.spotify_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint spotify_tokens_user_id_unique unique (user_id)
);

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spotify_tokens_updated_at on public.spotify_tokens;
create trigger spotify_tokens_updated_at
  before update on public.spotify_tokens
  for each row execute procedure public.set_updated_at();

-- Row-level security: users can only read/write their own tokens
alter table public.spotify_tokens enable row level security;

create policy "Users can view their own spotify token"
  on public.spotify_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert their own spotify token"
  on public.spotify_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own spotify token"
  on public.spotify_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own spotify token"
  on public.spotify_tokens for delete
  using (auth.uid() = user_id);

-- Index for fast lookups by user_id
create index if not exists spotify_tokens_user_id_idx on public.spotify_tokens(user_id);
