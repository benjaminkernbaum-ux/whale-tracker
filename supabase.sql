-- ══════════════════════════════════════════════════
-- Mobidic v11.0 — Supabase Schema
-- Web3 Community Platform for Artists, Investors & Developers
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ══════════════════════════════════════════════════

-- ── Profiles ──
-- Stores user display info, tier, and community identity
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  bio text,
  wallet_addresses text[] default '{}',
  social_links jsonb default '{}',
  badges text[] default '{}',
  reputation integer default 0,
  role text default 'member' check (role in ('member', 'artist', 'investor', 'developer', 'analyst')),
  tier text default 'free' check (tier in ('free', 'plus', 'pro')),
  followers_count integer default 0,
  following_count integer default 0,
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
-- Community Tables — Mobidic v11.0
-- ══════════════════════════════════════════════════

-- ── Community Posts (Feed) ──
create table if not exists public.community_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  media_urls text[] default '{}',
  tags text[] default '{}',
  reactions jsonb default '{"fire":0,"whale":0,"diamond":0,"rocket":0}',
  comments_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Projects (NFT, DeFi, Dev Tools) ──
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  category text not null check (category in ('nft_art', 'defi', 'dev_tool', 'dao', 'gamefi', 'infrastructure')),
  description text,
  website text,
  github text,
  twitter text,
  discord text,
  image_url text,
  chain text,
  upvotes integer default 0,
  featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Trading Strategies ──
create table if not exists public.strategies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  category text not null check (category in ('swing', 'scalp', 'dca', 'arbitrage', 'yield_farming', 'nft_flipping')),
  thesis text,
  assets text[] default '{}',
  timeframe text,
  entry_rules text,
  exit_rules text,
  risk_level text default 'medium' check (risk_level in ('low', 'medium', 'high')),
  pnl_30d numeric default 0,
  pnl_90d numeric default 0,
  followers_count integer default 0,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Comments ──
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  parent_type text not null check (parent_type in ('post', 'project', 'strategy')),
  parent_id uuid not null,
  content text not null,
  created_at timestamptz default now()
);

-- ── Follows ──
create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- ── User Badges ──
create table if not exists public.user_badges (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  badge_type text not null check (badge_type in ('artist', 'investor', 'developer', 'analyst', 'whale', 'early_adopter', 'top_strategist', 'community_leader')),
  earned_at timestamptz default now(),
  unique(user_id, badge_type)
);

-- ══════════════════════════════════════════════════
-- Row-Level Security (RLS) Policies
-- Each user can only read/write their own data
-- Community content is publicly readable
-- ══════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.custom_alerts enable row level security;
alter table public.preferences enable row level security;
alter table public.community_posts enable row level security;
alter table public.projects enable row level security;
alter table public.strategies enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.user_badges enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Public profiles are viewable" on public.profiles
  for select using (true);

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

-- Community Posts: public read, own write
create policy "Anyone can view posts" on public.community_posts
  for select using (true);
create policy "Users can create posts" on public.community_posts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own posts" on public.community_posts
  for update using (auth.uid() = user_id);
create policy "Users can delete own posts" on public.community_posts
  for delete using (auth.uid() = user_id);

-- Projects: public read, own write
create policy "Anyone can view projects" on public.projects
  for select using (true);
create policy "Users can create projects" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);

-- Strategies: public read (if is_public), own write
create policy "Anyone can view public strategies" on public.strategies
  for select using (is_public = true or auth.uid() = user_id);
create policy "Users can create strategies" on public.strategies
  for insert with check (auth.uid() = user_id);
create policy "Users can update own strategies" on public.strategies
  for update using (auth.uid() = user_id);

-- Comments: public read, own write
create policy "Anyone can view comments" on public.comments
  for select using (true);
create policy "Users can create comments" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments
  for delete using (auth.uid() = user_id);

-- Follows: public read, own write
create policy "Anyone can view follows" on public.follows
  for select using (true);
create policy "Users can follow" on public.follows
  for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on public.follows
  for delete using (auth.uid() = follower_id);

-- Badges: public read
create policy "Anyone can view badges" on public.user_badges
  for select using (true);
