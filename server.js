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

// ── SPA fallback ──
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

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
