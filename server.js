require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3333;

// ── Supabase Admin Client (server-side, service key) ──
let supabaseAdmin = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  console.log('  ✅ Supabase admin connected');
} else {
  console.log('  ⚠️  Supabase not configured — auth features disabled');
}

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ── In-memory cache ──
const priceCache = new Map();
const CACHE_TTL = 25000;

function getCached(key) {
  const entry = priceCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key, data) {
  priceCache.set(key, { data, ts: Date.now() });
}

// ── Auth Middleware ──
async function requireAuth(req, res, next) {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Auth not configured' });
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Auth failed' });
  }
}

// ══════════════════════════════════════════════════
// API Routes — Public
// ══════════════════════════════════════════════════

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    hasAuth: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    version: '11.0.0'
  });
});

// ── Finnhub Quote ──
app.get('/api/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const cached = getCached(`quote:${symbol}`);
  if (cached) return res.json(cached);
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Finnhub not configured' });
  try {
    const resp = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
    if (!resp.ok) throw new Error(`Finnhub ${resp.status}`);
    const data = await resp.json();
    setCache(`quote:${symbol}`, data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Finnhub Candles ──
app.get('/api/candles/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const resolution = req.query.resolution || 'D';
  const to = Math.floor(Date.now() / 1000);
  const from = to - (90 * 86400);
  const cacheKey = `candles:${symbol}:${resolution}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Finnhub not configured' });
  try {
    const resp = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`);
    if (!resp.ok) throw new Error(`Finnhub ${resp.status}`);
    const data = await resp.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Finnhub News ──
app.get('/api/news/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const cached = getCached(`news:${symbol}`);
  if (cached) return res.json(cached);
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Finnhub not configured' });
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const resp = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${weekAgo}&to=${today}&token=${apiKey}`);
    if (!resp.ok) throw new Error(`Finnhub ${resp.status}`);
    const data = await resp.json();
    const trimmed = data.slice(0, 10);
    setCache(`news:${symbol}`, trimmed);
    res.json(trimmed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CoinGecko Price ──
app.get('/api/crypto/:id', async (req, res) => {
  const { id } = req.params;
  const cached = getCached(`crypto:${id}`);
  if (cached) return res.json(cached);
  try {
    const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`);
    if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
    const data = await resp.json();
    setCache(`crypto:${id}`, data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CoinGecko Chart (TradingView format) ──
app.get('/api/chart/:id', async (req, res) => {
  const { id } = req.params;
  const days = req.query.days || '90';
  const cacheKey = `chart:${id}:${days}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);
  try {
    const resp = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`);
    if (!resp.ok) throw new Error(`CoinGecko chart ${resp.status}`);
    const raw = await resp.json();
    const prices = raw.prices || [];
    const ohlc = [];
    for (let i = 0; i < prices.length; i++) {
      const [ts, close] = prices[i];
      const prev = i > 0 ? prices[i - 1][1] : close;
      ohlc.push({
        time: Math.floor(ts / 1000),
        open: prev,
        high: Math.max(prev, close) * (1 + Math.random() * 0.008),
        low: Math.min(prev, close) * (1 - Math.random() * 0.008),
        close
      });
    }
    const result = { ohlc, volume: (raw.total_volumes || []).map(([ts, v]) => ({ time: Math.floor(ts / 1000), value: v })) };
    setCache(cacheKey, result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Fear & Greed Index (free, no key) ──
app.get('/api/fear-greed', async (req, res) => {
  const cached = getCached('fear-greed');
  if (cached) return res.json(cached);
  try {
    const resp = await fetch('https://api.alternative.me/fng/?limit=30&format=json');
    if (!resp.ok) throw new Error(`F&G ${resp.status}`);
    const data = await resp.json();
    setCache('fear-greed', data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SEC EDGAR ──
app.get('/api/edgar/:cik', async (req, res) => {
  const paddedCik = req.params.cik.padStart(10, '0');
  const cached = getCached(`edgar:${paddedCik}`);
  if (cached) return res.json(cached);
  try {
    const resp = await fetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`, {
      headers: { 'User-Agent': 'Mobidic/11.0 (contact@mobidic.io)' }
    });
    if (!resp.ok) throw new Error(`SEC ${resp.status}`);
    const data = await resp.json();
    setCache(`edgar:${paddedCik}`, data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Live Whale Transactions (Blockchair + CoinGecko — free) ──
let whaleTransactions = [];
let lastWhaleCheck = 0;

async function fetchWhaleTransactions() {
  try {
    const btcResp = await fetch('https://api.blockchair.com/bitcoin/transactions?s=output_total(desc)&limit=10');
    if (btcResp.ok) {
      const btcData = await btcResp.json();
      const btcTxs = (btcData.data || [])
        .filter(tx => tx.output_total > 10_000_000_000) // > 100 BTC
        .map(tx => ({
          id: tx.hash?.slice(0, 12),
          chain: 'BTC', asset: 'BTC', hash: tx.hash,
          amtBTC: (tx.output_total / 1e8).toFixed(4),
          block: tx.block_id, time: tx.time,
          type: 'transfer', source: 'blockchair'
        }));
      whaleTransactions = [...btcTxs, ...whaleTransactions.filter(t => t.source !== 'blockchair')].slice(0, 50);
    }
  } catch (e) { console.warn('[Whale] Blockchair:', e.message); }

  try {
    const resp = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=20&page=1&sparkline=false&price_change_percentage=1h');
    if (resp.ok) {
      const data = await resp.json();
      const alerts = data
        .filter(c => c.total_volume > 500_000_000)
        .map(c => ({
          id: `vol-${c.id}`, chain: c.symbol?.toUpperCase(), asset: c.symbol?.toUpperCase(),
          name: c.name, price: c.current_price,
          change1h: c.price_change_percentage_1h_in_currency,
          change24h: c.price_change_percentage_24h,
          volume: c.total_volume, mktcap: c.market_cap,
          image: c.image,
          type: 'volume', source: 'coingecko',
          time: new Date().toISOString()
        }));
      whaleTransactions = [...whaleTransactions.filter(t => t.source === 'blockchair'), ...alerts].slice(0, 50);
    }
  } catch (e) { console.warn('[Whale] CoinGecko:', e.message); }

  lastWhaleCheck = Date.now();
}

app.get('/api/whales', async (req, res) => {
  if (Date.now() - lastWhaleCheck > 60000) await fetchWhaleTransactions();
  res.json({ transactions: whaleTransactions, lastUpdate: lastWhaleCheck });
});

// ── CoinGecko Trending ──
app.get('/api/trending', async (req, res) => {
  const cached = getCached('trending');
  if (cached) return res.json(cached);
  try {
    const resp = await fetch('https://api.coingecko.com/api/v3/search/trending');
    if (!resp.ok) throw new Error(`Trending ${resp.status}`);
    const data = await resp.json();
    setCache('trending', data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════
// Authenticated Endpoints
// ══════════════════════════════════════════════════

app.get('/api/user/watchlist', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('watchlists').select('symbol').eq('user_id', req.user.id).order('added_at');
    if (error) throw error;
    res.json(data.map(r => r.symbol));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/watchlist', requireAuth, async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  try {
    const { error } = await supabaseAdmin.from('watchlists').upsert({ user_id: req.user.id, symbol: symbol.toUpperCase() }, { onConflict: 'user_id,symbol' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/user/watchlist/:symbol', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('watchlists').delete().eq('user_id', req.user.id).eq('symbol', req.params.symbol.toUpperCase());
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/user/preferences', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('preferences').select('*').eq('user_id', req.user.id).single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || { theme: 'dark', threshold: 1000000, notifications: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/user/preferences', requireAuth, async (req, res) => {
  const { theme, threshold, notifications, auto_refresh, live_ticker } = req.body;
  try {
    const { error } = await supabaseAdmin.from('preferences').upsert({
      user_id: req.user.id,
      ...(theme != null && { theme }), ...(threshold != null && { threshold }),
      ...(notifications != null && { notifications }), ...(auto_refresh != null && { auto_refresh }),
      ...(live_ticker != null && { live_ticker }), updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════
// Community Data — In-Memory Store (works without Supabase)
// ══════════════════════════════════════════════════
let nextId = 1;
const uid = () => 'id_' + (nextId++);
const now = () => new Date().toISOString();

const store = {
  posts: [],
  projects: [],
  strategies: [],
  comments: [],
  reactions: [],  // { user_id, parent_type, parent_id, type }
  follows: [],    // { follower_id, following_id }
  upvotes: [],    // { user_id, project_id }
  profiles: new Map(),
};

// Seed demo data so the app is never empty
function seedData() {
  const demoUser = 'demo_user';
  store.profiles.set(demoUser, { id: demoUser, display_name: 'Mobidic Explorer', bio: 'Web3 enthusiast & whale tracker', role: 'investor', badges: ['whale','investor','early_adopter'], reputation: 142, social_links: { twitter: 'https://x.com', discord: '#', github: '#' }, wallet_addresses: [], followers_count: 24, following_count: 8 });

  const users = ['whale_hunter','nft_sniper','defi_degen','solana_chad','1min_king','arb_bot'];
  users.forEach(u => store.profiles.set(u, { id: u, display_name: u.replace('_',' '), bio: `Active ${u.includes('nft')?'NFT':'crypto'} community member`, role: u.includes('dev')?'developer':'investor', badges: ['early_adopter'], reputation: Math.floor(Math.random()*200)+20, social_links: {}, wallet_addresses: [], followers_count: Math.floor(Math.random()*100), following_count: Math.floor(Math.random()*50) }));

  // Seed posts
  [
    { user_id:'whale_hunter', content:'Just spotted a massive BTC accumulation pattern on the weekly. Institutions are loading up while retail sleeps. 🐋💎', tags:['BTC','WhaleAlert'] },
    { user_id:'nft_sniper', content:'New generative art drop on Art Blocks this Friday. Ocean-depth visuals — perfect for the Mobidic community! 🎨🌊', tags:['NFT','ArtBlocks'] },
    { user_id:'defi_degen', content:'Yield farming update: Moved 80% of ETH from Lido to EigenLayer restaking. Risk-adjusted returns are significantly better. 👇', tags:['DeFi','Yield','ETH'] },
    { user_id:'solana_chad', content:'SOL broke $185 resistance with massive volume. My swing from $172 is printing. Taking 50% profit, trailing stop at $180. 📈', tags:['SOL','Trading'] },
    { user_id:'1min_king', content:'Today\'s scalping: 5/5 wins, +4.2%. Key was waiting for US open volatility on AVAX. ⚡', tags:['Scalping','AVAX'] },
  ].forEach(p => { store.posts.push({ id: uid(), ...p, reactions: {fire:Math.floor(Math.random()*200),whale:Math.floor(Math.random()*80),diamond:Math.floor(Math.random()*150),rocket:Math.floor(Math.random()*100)}, comments_count: Math.floor(Math.random()*50), created_at: now() }); });

  // Seed projects
  [
    { user_id:'nft_sniper', name:'Bored Apes Yacht Club', category:'nft_art', description:'10,000 unique collectibles on Ethereum. Community-driven art with utility.', chain:'Ethereum', website:'https://boredapeyachtclub.com', github:'', upvotes:842, featured:true },
    { user_id:'defi_degen', name:'Uniswap V4', category:'defi', description:'Leading DEX protocol. V4 introduces hooks for customizable pool logic.', chain:'Ethereum', website:'https://uniswap.org', github:'https://github.com/Uniswap', upvotes:1247, featured:true },
    { user_id:'arb_bot', name:'Hardhat Framework', category:'dev_tool', description:'Ethereum dev environment for pros. Compile, deploy, test smart contracts.', chain:'Multi-chain', website:'https://hardhat.org', github:'https://github.com/NomicFoundation/hardhat', upvotes:934, featured:false },
    { user_id:'whale_hunter', name:'MakerDAO', category:'dao', description:'Decentralized governance managing DAI stablecoin and Maker Protocol.', chain:'Ethereum', website:'https://makerdao.com', github:'https://github.com/makerdao', upvotes:712, featured:false },
    { user_id:'solana_chad', name:'Jupiter Exchange', category:'defi', description:'Leading Solana DEX aggregator. Best swap rates, limit orders, DCA.', chain:'Solana', website:'https://jup.ag', github:'https://github.com/jup-ag', upvotes:673, featured:false },
    { user_id:'nft_sniper', name:'Art Blocks', category:'nft_art', description:'Generative art platform. Unique algorithmic artwork minted on-chain.', chain:'Ethereum', website:'https://artblocks.io', github:'', upvotes:461, featured:false },
    { user_id:'arb_bot', name:'Foundry', category:'dev_tool', description:'Blazing fast Ethereum toolkit written in Rust. Used by top protocols.', chain:'Multi-chain', website:'https://getfoundry.sh', github:'https://github.com/foundry-rs', upvotes:889, featured:false },
  ].forEach(p => { store.projects.push({ id: uid(), ...p, image_url:'', created_at: now() }); });

  // Seed strategies
  [
    { user_id:'whale_hunter', name:'BTC Accumulation DCA', category:'dca', thesis:'Dollar-cost averaging into BTC weekly. Bitcoin is digital gold — adoption is early.', assets:['BTC'], timeframe:'Weekly', risk_level:'low', pnl_30d:12.4, pnl_90d:28.7, followers_count:342 },
    { user_id:'solana_chad', name:'SOL Momentum Swing', category:'swing', thesis:'Ride SOL/USDT momentum on 4H chart. Enter breakouts above key resistance, 2R min targets.', assets:['SOL','JUP'], timeframe:'4H-Daily', risk_level:'medium', pnl_30d:18.6, pnl_90d:42.1, followers_count:217 },
    { user_id:'defi_degen', name:'ETH Yield Maximizer', category:'yield_farming', thesis:'Rotate capital between Aave, Lido, EigenLayer to maximize risk-adjusted yield.', assets:['ETH','stETH'], timeframe:'Weekly', risk_level:'medium', pnl_30d:4.8, pnl_90d:14.2, followers_count:189 },
    { user_id:'1min_king', name:'Altcoin Scalper', category:'scalp', thesis:'Quick 1-3% scalps on high-volume alts during US hours. Strict stops, max 3 trades/day.', assets:['SOL','AVAX','LINK'], timeframe:'1m-5m', risk_level:'high', pnl_30d:22.1, pnl_90d:51.8, followers_count:423 },
    { user_id:'arb_bot', name:'Cross-DEX Arbitrage', category:'arbitrage', thesis:'Automated arb between Uniswap, Sushi, Curve. Captures pricing inefficiencies.', assets:['Multi'], timeframe:'Continuous', risk_level:'low', pnl_30d:3.2, pnl_90d:9.8, followers_count:98 },
  ].forEach(s => { store.strategies.push({ id: uid(), ...s, is_public:true, created_at: now() }); });
}
seedData();

// Helper: get or create a guest session ID from cookie/header
function getSessionUser(req) {
  return req.headers['x-user-id'] || req.query.uid || 'demo_user';
}

// ══════════════════════════════════════════════════
// Community API — Posts
// ══════════════════════════════════════════════════
app.get('/api/posts', (req, res) => {
  const posts = store.posts.map(p => ({
    ...p,
    author: store.profiles.get(p.user_id) || { display_name: p.user_id, badges: [] }
  }));
  posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(posts);
});

app.post('/api/posts', (req, res) => {
  const { content, tags, media_urls } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const user_id = getSessionUser(req);
  const post = { id: uid(), user_id, content: content.trim(), tags: tags || [], media_urls: media_urls || [], reactions: { fire:0, whale:0, diamond:0, rocket:0 }, comments_count: 0, created_at: now() };
  store.posts.unshift(post);
  broadcast({ type: 'new_post', data: { ...post, author: store.profiles.get(user_id) } });
  res.status(201).json(post);
});

app.delete('/api/posts/:id', (req, res) => {
  const idx = store.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  store.posts.splice(idx, 1);
  res.json({ ok: true });
});

app.post('/api/posts/:id/react', (req, res) => {
  const { type } = req.body; // fire, whale, diamond, rocket
  if (!['fire','whale','diamond','rocket'].includes(type)) return res.status(400).json({ error: 'Invalid reaction' });
  const post = store.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  post.reactions[type] = (post.reactions[type] || 0) + 1;
  res.json({ reactions: post.reactions });
});

// ══════════════════════════════════════════════════
// Community API — Projects
// ══════════════════════════════════════════════════
app.get('/api/projects', (req, res) => {
  let list = [...store.projects];
  if (req.query.category && req.query.category !== 'all') list = list.filter(p => p.category === req.query.category);
  const sort = req.query.sort || 'upvotes';
  if (sort === 'upvotes') list.sort((a, b) => b.upvotes - a.upvotes);
  else if (sort === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  list = list.map(p => ({ ...p, author: store.profiles.get(p.user_id) || { display_name: p.user_id } }));
  res.json(list);
});

app.post('/api/projects', (req, res) => {
  const { name, category, description, website, github, chain, image_url } = req.body;
  if (!name || !category || !description) return res.status(400).json({ error: 'Name, category, and description required' });
  const user_id = getSessionUser(req);
  const project = { id: uid(), user_id, name, category, description, website: website || '', github: github || '', chain: chain || '', image_url: image_url || '', upvotes: 0, featured: false, created_at: now() };
  store.projects.unshift(project);
  res.status(201).json(project);
});

app.post('/api/projects/:id/upvote', (req, res) => {
  const user_id = getSessionUser(req);
  const project = store.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const existing = store.upvotes.find(u => u.user_id === user_id && u.project_id === req.params.id);
  if (existing) { store.upvotes = store.upvotes.filter(u => u !== existing); project.upvotes = Math.max(0, project.upvotes - 1); }
  else { store.upvotes.push({ user_id, project_id: req.params.id }); project.upvotes++; }
  res.json({ upvotes: project.upvotes, voted: !existing });
});

// ══════════════════════════════════════════════════
// Community API — Strategies
// ══════════════════════════════════════════════════
app.get('/api/strategies', (req, res) => {
  let list = [...store.strategies].filter(s => s.is_public);
  if (req.query.category && req.query.category !== 'all') list = list.filter(s => s.category === req.query.category);
  const sort = req.query.sort || 'pnl';
  if (sort === 'pnl') list.sort((a, b) => b.pnl_90d - a.pnl_90d);
  else if (sort === 'followers') list.sort((a, b) => b.followers_count - a.followers_count);
  else if (sort === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  list = list.map(s => ({ ...s, author: store.profiles.get(s.user_id) || { display_name: s.user_id } }));
  res.json(list);
});

app.post('/api/strategies', (req, res) => {
  const { name, category, thesis, assets, timeframe, risk_level } = req.body;
  if (!name || !category || !thesis) return res.status(400).json({ error: 'Name, category, thesis required' });
  const user_id = getSessionUser(req);
  const strategy = { id: uid(), user_id, name, category, thesis, assets: assets || [], timeframe: timeframe || '', risk_level: risk_level || 'medium', pnl_30d: 0, pnl_90d: 0, followers_count: 0, is_public: true, created_at: now() };
  store.strategies.unshift(strategy);
  res.status(201).json(strategy);
});

app.post('/api/strategies/:id/follow', (req, res) => {
  const user_id = getSessionUser(req);
  const strategy = store.strategies.find(s => s.id === req.params.id);
  if (!strategy) return res.status(404).json({ error: 'Not found' });
  const existing = store.follows.find(f => f.follower_id === user_id && f.following_id === req.params.id);
  if (existing) { store.follows = store.follows.filter(f => f !== existing); strategy.followers_count = Math.max(0, strategy.followers_count - 1); }
  else { store.follows.push({ follower_id: user_id, following_id: req.params.id, created_at: now() }); strategy.followers_count++; }
  res.json({ followers_count: strategy.followers_count, following: !existing });
});

// ══════════════════════════════════════════════════
// Community API — Profile
// ══════════════════════════════════════════════════
app.get('/api/profile/:id', (req, res) => {
  const profile = store.profiles.get(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const myPosts = store.posts.filter(p => p.user_id === req.params.id).length;
  const myProjects = store.projects.filter(p => p.user_id === req.params.id).length;
  const myStrategies = store.strategies.filter(s => s.user_id === req.params.id).length;
  res.json({ ...profile, posts_count: myPosts, projects_count: myProjects, strategies_count: myStrategies });
});

app.put('/api/profile', (req, res) => {
  const user_id = getSessionUser(req);
  const { display_name, bio, role, social_links, wallet_addresses } = req.body;
  const existing = store.profiles.get(user_id) || { id: user_id, badges: ['early_adopter'], reputation: 0, followers_count: 0, following_count: 0 };
  const updated = { ...existing, ...(display_name && { display_name }), ...(bio !== undefined && { bio }), ...(role && { role }), ...(social_links && { social_links }), ...(wallet_addresses && { wallet_addresses }) };
  store.profiles.set(user_id, updated);
  res.json(updated);
});

// ══════════════════════════════════════════════════
// Community API — Comments
// ══════════════════════════════════════════════════
app.get('/api/comments/:parentType/:parentId', (req, res) => {
  const { parentType, parentId } = req.params;
  const comments = store.comments.filter(c => c.parent_type === parentType && c.parent_id === parentId)
    .map(c => ({ ...c, author: store.profiles.get(c.user_id) || { display_name: c.user_id } }));
  comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(comments);
});

app.post('/api/comments', (req, res) => {
  const { parent_type, parent_id, content } = req.body;
  if (!parent_type || !parent_id || !content?.trim()) return res.status(400).json({ error: 'parent_type, parent_id, content required' });
  const user_id = getSessionUser(req);
  const comment = { id: uid(), user_id, parent_type, parent_id, content: content.trim(), created_at: now() };
  store.comments.push(comment);
  // Update parent comment count
  if (parent_type === 'post') { const p = store.posts.find(x => x.id === parent_id); if (p) p.comments_count++; }
  res.status(201).json({ ...comment, author: store.profiles.get(user_id) });
});

// ── SPA fallback ──
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ══════════════════════════════════════════════════
// WebSocket + Real-Time Engine
// ══════════════════════════════════════════════════

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
let wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', clients: wsClients.size, version: '11.0.0' }));
  if (whaleTransactions.length > 0) {
    ws.send(JSON.stringify({ type: 'whales', data: whaleTransactions.slice(0, 20), ts: lastWhaleCheck }));
  }
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

// ── Price Loop (30s, requires Finnhub key) ──
const TRACKED = ['AAPL','MSFT','GOOGL','AMZN','META','TSLA','NVDA','JPM','V','XOM','BA','SPY','QQQ','DIA','EWG','EWU'];

async function priceTick() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || wsClients.size === 0) return;
  const updates = [];
  for (let i = 0; i < TRACKED.length; i += 4) {
    const batch = TRACKED.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map(async sym => {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`);
        if (!r.ok) return null;
        const q = await r.json();
        if (q.c) { setCache(`quote:${sym}`, q); return { sym, price: q.c, change: q.dp, high: q.h, low: q.l }; }
        return null;
      } catch { return null; }
    }));
    results.forEach(r => { if (r.status === 'fulfilled' && r.value) updates.push(r.value); });
    if (i + 4 < TRACKED.length) await new Promise(r => setTimeout(r, 500));
  }
  if (updates.length) broadcast({ type: 'prices', data: updates, ts: Date.now() });
}

// ── Whale Loop (60s, free APIs) ──
async function whaleTick() {
  await fetchWhaleTransactions();
  if (wsClients.size > 0 && whaleTransactions.length > 0) {
    broadcast({ type: 'whales', data: whaleTransactions.slice(0, 20), ts: lastWhaleCheck });
  }
}

// ── Boot ──
server.listen(PORT, () => {
  console.log(`\n  🐋 Mobidic v11.0 — Web3 Community Platform`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  📊 API: Finnhub • CoinGecko • Blockchair • Fear&Greed • SEC EDGAR`);
  console.log(`  🔐 Auth: ${supabaseAdmin ? 'Supabase ✓' : 'Disabled'}`);
  console.log(`  ⚡ WebSocket: ws://localhost:${PORT}\n`);

  whaleTick();
  setInterval(whaleTick, 60000);
  console.log('  🐋 Mobidic feed: ACTIVE (60s)');

  if (process.env.FINNHUB_API_KEY) {
    priceTick();
    setInterval(priceTick, 30000);
    console.log('  📡 Price feed: ACTIVE (30s)\n');
  } else {
    console.log('  ⚠️  Set FINNHUB_API_KEY for live prices\n');
  }
});
