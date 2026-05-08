-- spotify_cache: generic key-value cache for Spotify API responses
-- Prevents hammering the Spotify API on every page load.
-- cache_key examples: 'top_tracks_short_term', 'top_artists_medium_term', 'recently_played'

create table if not exists public.spotify_cache (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  cache_key  text not null,
  data       jsonb not null,
  cached_at  timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint spotify_cache_user_key_unique unique (user_id, cache_key)
);

-- Row-level security: users can only access their own cache entries
alter table public.spotify_cache enable row level security;

create policy "Users can view their own spotify cache"
  on public.spotify_cache for select
  using (auth.uid() = user_id);

create policy "Users can insert their own spotify cache"
  on public.spotify_cache for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own spotify cache"
  on public.spotify_cache for update
  using (auth.uid() = user_id);

create policy "Users can delete their own spotify cache"
  on public.spotify_cache for delete
  using (auth.uid() = user_id);

-- Indexes for fast lookups
create index if not exists spotify_cache_user_id_idx on public.spotify_cache(user_id);
create index if not exists spotify_cache_user_key_idx on public.spotify_cache(user_id, cache_key);
create index if not exists spotify_cache_expires_at_idx on public.spotify_cache(expires_at);
