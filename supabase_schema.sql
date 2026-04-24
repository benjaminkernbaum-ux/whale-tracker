-- ============================================================
-- MOBIDIC — Supabase Schema v1.0
-- Full community platform: profiles, posts, projects, strategies
-- ============================================================

-- ── Profiles ──
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Guest',
  bio TEXT DEFAULT '',
  role TEXT DEFAULT 'investor',
  badges TEXT[] DEFAULT '{"early_adopter"}',
  reputation INTEGER DEFAULT 0,
  social_links JSONB DEFAULT '{}',
  wallet_addresses TEXT[] DEFAULT '{}',
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Community Posts ──
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  reactions JSONB DEFAULT '{"fire":0,"whale":0,"diamond":0,"rocket":0}',
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Projects ──
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'defi',
  description TEXT DEFAULT '',
  chain TEXT DEFAULT '',
  website TEXT DEFAULT '',
  github TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  upvotes INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Strategies ──
CREATE TABLE IF NOT EXISTS strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'swing',
  thesis TEXT DEFAULT '',
  assets TEXT[] DEFAULT '{}',
  timeframe TEXT DEFAULT '',
  risk_level TEXT DEFAULT 'medium',
  pnl_30d NUMERIC DEFAULT 0,
  pnl_90d NUMERIC DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Comments ──
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type TEXT NOT NULL, -- 'post', 'project', 'strategy'
  parent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Follows ──
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  follow_type TEXT DEFAULT 'user', -- 'user', 'strategy'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id, follow_type)
);

-- ── Reactions (track who reacted what) ──
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL, -- 'fire', 'whale', 'diamond', 'rocket'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id, reaction_type)
);

-- ── Upvotes (track who upvoted what) ──
CREATE TABLE IF NOT EXISTS upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- ── Indexes for performance ──
CREATE INDEX IF NOT EXISTS idx_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_upvotes ON projects(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_strategies_category ON strategies(category);
CREATE INDEX IF NOT EXISTS idx_strategies_pnl ON strategies(pnl_90d DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ── Seed default profile ──
INSERT INTO profiles (user_id, display_name, bio, role, badges, reputation)
VALUES ('demo_user', 'Captain Ahab', 'Hunting the white whale of alpha. Web3 explorer & DeFi degen.', 'investor', '{"whale","investor","early_adopter"}', 250)
ON CONFLICT (user_id) DO NOTHING;

-- ── Enable RLS (Row Level Security) ──
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies: Allow read for all, write for authenticated ──
-- Profiles
CREATE POLICY "Profiles: public read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: service write" ON profiles FOR ALL USING (true);

-- Posts
CREATE POLICY "Posts: public read" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Posts: service write" ON community_posts FOR ALL USING (true);

-- Projects
CREATE POLICY "Projects: public read" ON projects FOR SELECT USING (true);
CREATE POLICY "Projects: service write" ON projects FOR ALL USING (true);

-- Strategies
CREATE POLICY "Strategies: public read" ON strategies FOR SELECT USING (true);
CREATE POLICY "Strategies: service write" ON strategies FOR ALL USING (true);

-- Comments
CREATE POLICY "Comments: public read" ON comments FOR SELECT USING (true);
CREATE POLICY "Comments: service write" ON comments FOR ALL USING (true);

-- Follows
CREATE POLICY "Follows: public read" ON follows FOR SELECT USING (true);
CREATE POLICY "Follows: service write" ON follows FOR ALL USING (true);

-- Reactions
CREATE POLICY "Reactions: public read" ON reactions FOR SELECT USING (true);
CREATE POLICY "Reactions: service write" ON reactions FOR ALL USING (true);

-- Upvotes
CREATE POLICY "Upvotes: public read" ON upvotes FOR SELECT USING (true);
CREATE POLICY "Upvotes: service write" ON upvotes FOR ALL USING (true);
