require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3333;

// ─── Supabase Admin ───
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

// ─── In-memory cache ───
const cache = {};
function cached(key, ttlMs, fetcher) {
  return async (req, res) => {
    const cacheKey = key + (req.params.symbol || req.params.cik || '');
    if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < ttlMs) {
      return res.json(cache[cacheKey].data);
    }
    try {
      const data = await fetcher(req);
      cache[cacheKey] = { data, ts: Date.now() };
      res.json(data);
    } catch (err) {
      console.error(`[API] ${cacheKey} error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  };
}

// ─── API: Finnhub Quote ───
app.get('/api/quote/:symbol', cached('quote:', 15000, async (req) => {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY not set');
  const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${req.params.symbol}&token=${key}`);
  if (!r.ok) throw new Error(`Finnhub ${r.status}`);
  return r.json();
}));

// ─── API: Finnhub Candles (OHLCV) ───
app.get('/api/candles/:symbol', cached('candles:', 60000, async (req) => {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY not set');
  const resolution = req.query.resolution || 'D';
  const to = Math.floor(Date.now() / 1000);
  const from = to - (req.query.days || 90) * 86400;
  const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${req.params.symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${key}`);
  if (!r.ok) throw new Error(`Finnhub candles ${r.status}`);
  return r.json();
}));

// ─── API: Finnhub Company News ───
app.get('/api/news/:symbol', cached('news:', 300000, async (req) => {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY not set');
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${req.params.symbol}&from=${from}&to=${to}&token=${key}`);
  if (!r.ok) throw new Error(`Finnhub news ${r.status}`);
  const data = await r.json();
  return data.slice(0, 10);
}));

// ─── API: SEC EDGAR Filings ───
app.get('/api/filings/:cik', cached('filings:', 600000, async (req) => {
  const cik = req.params.cik.padStart(10, '0');
  const r = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { 'User-Agent': 'WhaleVault/1.0 (contact@whalevault.io)' }
  });
  if (!r.ok) throw new Error(`SEC EDGAR ${r.status}`);
  const data = await r.json();
  const recent = data.filings?.recent || {};
  const filings = [];
  for (let i = 0; i < Math.min(10, (recent.form || []).length); i++) {
    filings.push({
      form: recent.form[i],
      date: recent.filingDate[i],
      desc: recent.primaryDocDescription?.[i] || '',
      url: `https://www.sec.gov/Archives/edgar/data/${req.params.cik}/${(recent.accessionNumber[i] || '').replace(/-/g, '')}/${recent.primaryDocument?.[i] || ''}`
    });
  }
  return { name: data.name, cik: req.params.cik, filings };
}));

// ─── API: CoinGecko (free, no key) ───
app.get('/api/crypto/:id', cached('crypto:', 30000, async (req) => {
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${req.params.id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`);
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  return r.json();
}));

// ─── API: Health / Config (public Supabase keys for frontend) ───
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    version: '9.0',
    hasAuth: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    hasMarketData: !!process.env.FINNHUB_API_KEY,
  });
});

// ─── API: User Preferences (auth required) ───
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !supabase) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

app.get('/api/user/preferences', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', req.user.id)
    .single();
  res.json(data || { theme: 'dark', threshold: 1000000, watchlist: [] });
});

app.put('/api/user/preferences', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('preferences')
    .upsert({ user_id: req.user.id, ...req.body, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.get('/api/user/watchlist', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('watchlists')
    .select('symbol')
    .eq('user_id', req.user.id);
  res.json((data || []).map(r => r.symbol));
});

app.post('/api/user/watchlist', requireAuth, async (req, res) => {
  const { symbol, action } = req.body;
  if (action === 'add') {
    await supabase.from('watchlists').upsert({ user_id: req.user.id, symbol });
  } else {
    await supabase.from('watchlists').delete().eq('user_id', req.user.id).eq('symbol', symbol);
  }
  res.json({ ok: true });
});

// ─── Static files ───
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ─── Start HTTP + WebSocket ───
const server = app.listen(PORT, () => {
  console.log(`\n  🐋 WhaleVault v9.0 — Smart Money Intelligence`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  🔐 Auth: ${supabase ? 'Supabase connected' : 'Not configured (guest mode)'}`);
  console.log(`  📊 Market data: ${process.env.FINNHUB_API_KEY ? 'Finnhub connected' : 'Simulation mode'}`);
  console.log(`  ⚡ WebSocket: ws://localhost:${PORT}\n`);
});

// ─── WebSocket: Real-time price stream ───
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.send(JSON.stringify({ type: 'connected', clients: clients.size }));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

// Price refresh loop (every 30s if Finnhub key exists)
const TRACKED = ['AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','JPM','GS','V','XOM','BA','SPY','QQQ','DIA'];
async function priceTick() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key || clients.size === 0) return;
  const updates = [];
  for (const sym of TRACKED) {
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`);
      if (r.ok) {
        const d = await r.json();
        if (d.c) updates.push({ sym, price: d.c, change: d.dp, high: d.h, low: d.l });
      }
      await new Promise(r => setTimeout(r, 100)); // rate limit
    } catch {}
  }
  if (updates.length) broadcast({ type: 'prices', data: updates, ts: Date.now() });
}

setInterval(priceTick, 30000);
setTimeout(priceTick, 3000); // first tick after 3s
