-- WhaleVault v9.0 Database Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor → New Query)

-- ─── Profiles (auto-populated on sign-up via trigger) ───
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  tier text default 'free' check (tier in ('free', 'pro', 'institutional')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Watchlists ───
create table if not exists public.watchlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol text not null,
  added_at timestamptz default now(),
  unique(user_id, symbol)
);

alter table public.watchlists enable row level security;
create policy "Users can manage own watchlist" on public.watchlists for all using (auth.uid() = user_id);

-- ─── Custom Alerts ───
create table if not exists public.custom_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol text not null,
  direction text default 'any' check (direction in ('any', 'buy', 'sell')),
  min_amount numeric default 1000000,
  channel text default 'push' check (channel in ('push', 'email', 'telegram')),
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.custom_alerts enable row level security;
create policy "Users can manage own alerts" on public.custom_alerts for all using (auth.uid() = user_id);

-- ─── Preferences ───
create table if not exists public.preferences (
  user_id uuid references auth.users on delete cascade primary key,
  theme text default 'dark',
  threshold numeric default 1000000,
  auto_refresh boolean default true,
  sound_alerts boolean default false,
  push_enabled boolean default false,
  updated_at timestamptz default now()
);

alter table public.preferences enable row level security;
create policy "Users can manage own prefs" on public.preferences for all using (auth.uid() = user_id);

-- ─── Paper Trades ───
create table if not exists public.paper_trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  symbol text not null,
  direction text not null check (direction in ('long', 'short')),
  amount numeric not null,
  entry_price numeric not null,
  current_price numeric,
  pnl numeric default 0,
  status text default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz default now(),
  closed_at timestamptz
);

alter table public.paper_trades enable row level security;
create policy "Users can manage own trades" on public.paper_trades for all using (auth.uid() = user_id);
