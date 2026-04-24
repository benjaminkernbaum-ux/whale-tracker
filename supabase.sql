-- ══════════════════════════════════════════════════
-- WhaleVault v9.0 — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ══════════════════════════════════════════════════

-- ── Profiles ──
-- Stores user display info and tier
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  tier text default 'free' check (tier in ('free', 'plus', 'pro')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Watchlists ──
create table if not exists public.watchlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  symbol text not null,
  added_at timestamptz default now(),
  unique(user_id, symbol)
);

-- ── Custom Alerts ──
create table if not exists public.custom_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  symbol text not null,
  direction text not null check (direction in ('above', 'below')),
  target_price numeric,
  amount numeric,
  channel text default 'push' check (channel in ('push', 'email', 'sms')),
  active boolean default true,
  created_at timestamptz default now()
);

-- ── Preferences ──
create table if not exists public.preferences (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  theme text default 'dark' check (theme in ('dark', 'light')),
  threshold numeric default 1000000,
  notifications boolean default true,
  auto_refresh boolean default true,
  live_ticker boolean default true,
  updated_at timestamptz default now()
);

-- ══════════════════════════════════════════════════
-- Row-Level Security (RLS) Policies
-- Each user can only read/write their own data
-- ══════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.custom_alerts enable row level security;
alter table public.preferences enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Watchlists: full CRUD on own data
create policy "Users can view own watchlist" on public.watchlists
  for select using (auth.uid() = user_id);
create policy "Users can insert own watchlist" on public.watchlists
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own watchlist" on public.watchlists
  for delete using (auth.uid() = user_id);

-- Custom Alerts: full CRUD on own data
create policy "Users can view own alerts" on public.custom_alerts
  for select using (auth.uid() = user_id);
create policy "Users can insert own alerts" on public.custom_alerts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own alerts" on public.custom_alerts
  for update using (auth.uid() = user_id);
create policy "Users can delete own alerts" on public.custom_alerts
  for delete using (auth.uid() = user_id);

-- Preferences: users can manage own preferences
create policy "Users can view own preferences" on public.preferences
  for select using (auth.uid() = user_id);
create policy "Users can insert own preferences" on public.preferences
  for insert with check (auth.uid() = user_id);
create policy "Users can update own preferences" on public.preferences
  for update using (auth.uid() = user_id);
