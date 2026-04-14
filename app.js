// ============================================================
// WHALEVAULT v5.0 — Institutional Intelligence Terminal
// Focus: Gold, Oil, Silver, Indices, Equities & Selected Crypto
// APIs: CoinGecko (crypto, free) + Finnhub (stocks/commodities)
// Language: English
// ============================================================

// ===================== LIVE DATA MANAGER =====================
const LiveData = {
    finnhubMap: {
        'XAU/USD': 'OANDA:XAU_USD', 'XAG/USD': 'OANDA:XAG_USD',
        'WTI': 'OANDA:WTICO_USD', 'BRENT': 'OANDA:BCO_USD',
        'NG': 'OANDA:NATGAS_USD', 'COPPER': 'OANDA:COPPER_USD',
        'US500': 'SPY', 'US30': 'DIA', 'US100': 'QQQ',
        'HK50': 'EWH', 'DAX': 'EWG', 'FTSE': 'EWU', 'NIKKEI': 'EWJ',
        'AAPL':'AAPL','MSFT':'MSFT','NVDA':'NVDA','TSLA':'TSLA',
        'AMZN':'AMZN','META':'META','GOOGL':'GOOGL','JPM':'JPM','GS':'GS',
    },
    indexMultiplier: {
        'US500': 10.1, 'US30': 97.5, 'US100': 49.0,
        'HK50': 720, 'DAX': 625, 'FTSE': 274, 'NIKKEI': 530,
    },
    cryptoIds: {
        'BTC/USD': 'bitcoin', 'ETH/USD': 'ethereum', 'XRP/USD': 'ripple',
        'BNB/USD': 'binancecoin', 'TRX/USD': 'tron', 'SOL/USD': 'solana',
    },
    cache: {},
    CACHE_TTL: 30000,
    isLive: { crypto: false, stocks: false },

    getApiKeys() {
        try { return JSON.parse(localStorage.getItem('whalevault_api_keys') || '{}'); }
        catch { return {}; }
    },

    isCached(key) {
        return this.cache[key] && (Date.now() - this.cache[key].ts < this.CACHE_TTL);
    },

    async fetchCryptoPrices() {
        const cacheKey = 'crypto_prices';
        if (this.isCached(cacheKey)) return this.cache[cacheKey].data;
        const ids = Object.values(this.cryptoIds).join(',');
        try {
            const keys = this.getApiKeys();
            let url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
            const headers = {};
            if (keys.coingecko) {
                url = `https://pro-api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
                headers['x-cg-pro-api-key'] = keys.coingecko;
            }
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
            const data = await res.json();
            this.cache[cacheKey] = { data, ts: Date.now() };
            this.isLive.crypto = true;
            return data;
        } catch(e) {
            console.warn('CoinGecko error:', e.message);
            this.isLive.crypto = false;
            return null;
        }
    },

    async fetchFinnhubQuote(symbol) {
        const keys = this.getApiKeys();
        if (!keys.finnhub) return null;
        const finnSymbol = this.finnhubMap[symbol];
        if (!finnSymbol) return null;
        const cacheKey = 'fh_' + finnSymbol;
        if (this.isCached(cacheKey)) return this.cache[cacheKey].data;
        try {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnSymbol)}&token=${keys.finnhub}`);
            if (!res.ok) throw new Error(`Finnhub ${res.status}`);
            const data = await res.json();
            if (!data.c || data.c === 0) return null;
            this.cache[cacheKey] = { data, ts: Date.now() };
            this.isLive.stocks = true;
            return data;
        } catch(e) {
            console.warn(`Finnhub error for ${symbol}:`, e.message);
            return null;
        }
    },

    async fetchFearGreed() {
        const cacheKey = 'fear_greed';
        if (this.isCached(cacheKey)) return this.cache[cacheKey].data;
        try {
            const res = await fetch('https://api.alternative.me/fng/?limit=1');
            if (!res.ok) throw new Error('FnG error');
            const data = await res.json();
            const value = parseInt(data.data[0].value);
            this.cache[cacheKey] = { data: value, ts: Date.now() };
            return value;
        } catch(e) {
            console.warn('Fear&Greed error:', e.message);
            return null;
        }
    },

    async syncAll() {
        let updatedCount = 0;

        // 1. Crypto via CoinGecko
        const cryptoData = await this.fetchCryptoPrices();
        if (cryptoData) {
            for (const [symbol, geckoId] of Object.entries(this.cryptoIds)) {
                const d = cryptoData[geckoId];
                if (!d) continue;
                const token = state.tokens.find(t => t.symbol === symbol);
                if (!token) continue;
                token.price = d.usd;
                token.change24h = d.usd_24h_change || token.change24h;
                token.mcap = d.usd_market_cap || token.mcap;
                token._vol24h = d.usd_24h_vol || 0;
                token._live = true;
                updatedCount++;
            }
        }

        // 2. Stocks/Commodities via Finnhub
        const keys = this.getApiKeys();
        if (keys.finnhub) {
            const nonCrypto = state.tokens.filter(t => t.market !== 'crypto');
            for (let i = 0; i < nonCrypto.length; i++) {
                const token = nonCrypto[i];
                const quote = await this.fetchFinnhubQuote(token.symbol);
                if (quote && quote.c > 0) {
                    let price = quote.c;
                    if (this.indexMultiplier[token.symbol]) {
                        price = price * this.indexMultiplier[token.symbol];
                    }
                    token.price = price;
                    if (quote.dp !== undefined && quote.dp !== null) {
                        token.change24h = quote.dp;
                    } else if (quote.pc > 0) {
                        token.change24h = ((quote.c - quote.pc) / quote.pc) * 100;
                    }
                    token._live = true;
                    updatedCount++;
                }
                if (i < nonCrypto.length - 1) await new Promise(r => setTimeout(r, 80));
            }
        }

        // 3. Fear & Greed
        const fng = await this.fetchFearGreed();
        if (fng !== null) state.fearGreedIndex = fng;

        // Update mode badge
        const anyLive = this.isLive.crypto || this.isLive.stocks;
        const badge = document.getElementById('mode-badge');
        const label = badge.querySelector('.mode-label');
        if (this.isLive.crypto && this.isLive.stocks) {
            label.textContent = '🟢 LIVE';
            badge.style.background = 'rgba(16,185,129,0.1)';
            badge.style.borderColor = 'rgba(16,185,129,0.2)';
            badge.style.color = '#10b981';
        } else if (anyLive) {
            label.textContent = '🟡 PARTIAL';
            badge.style.background = 'rgba(245,158,11,0.1)';
            badge.style.borderColor = 'rgba(245,158,11,0.2)';
        } else {
            label.textContent = 'DEMO';
            badge.style.background = '';
            badge.style.borderColor = '';
            badge.style.color = '';
        }

        return updatedCount;
    }
};

// ===================== ASSET DATA =====================
const TOKENS = [
    // COMMODITIES
    { symbol: 'XAU/USD', name: 'Gold', price: 3085.40, mcap: 0, change24h: 1.12, change7d: 3.45, assetClass: 'Commodity', market: 'commodities', icon: '🥇' },
    { symbol: 'XAG/USD', name: 'Silver', price: 34.28, mcap: 0, change24h: -0.67, change7d: 2.10, assetClass: 'Commodity', market: 'commodities', icon: '🥈' },
    { symbol: 'WTI', name: 'Crude Oil', price: 69.45, mcap: 0, change24h: -1.34, change7d: -3.20, assetClass: 'Commodity', market: 'commodities', icon: '🛢️' },
    { symbol: 'BRENT', name: 'Brent Crude', price: 73.12, mcap: 0, change24h: -0.98, change7d: -2.80, assetClass: 'Commodity', market: 'commodities', icon: '🛢️' },
    { symbol: 'NG', name: 'Natural Gas', price: 4.12, mcap: 0, change24h: 2.45, change7d: 5.60, assetClass: 'Commodity', market: 'commodities', icon: '🔥' },
    { symbol: 'COPPER', name: 'Copper', price: 5.02, mcap: 0, change24h: 0.78, change7d: 4.30, assetClass: 'Commodity', market: 'commodities', icon: '🔶' },
    // INDICES
    { symbol: 'US500', name: 'S&P 500', price: 5580.25, mcap: 0, change24h: 0.45, change7d: 1.23, assetClass: 'Index', market: 'indices', icon: '🇺🇸' },
    { symbol: 'US30', name: 'Dow Jones', price: 41890.50, mcap: 0, change24h: 0.62, change7d: 0.89, assetClass: 'Index', market: 'indices', icon: '🇺🇸' },
    { symbol: 'US100', name: 'Nasdaq 100', price: 19420.80, mcap: 0, change24h: -0.34, change7d: 2.15, assetClass: 'Index', market: 'indices', icon: '🇺🇸' },
    { symbol: 'HK50', name: 'Hang Seng', price: 23150.40, mcap: 0, change24h: 1.89, change7d: 4.56, assetClass: 'Index', market: 'indices', icon: '🇭🇰' },
    { symbol: 'DAX', name: 'DAX 40', price: 22580.30, mcap: 0, change24h: -0.23, change7d: 1.45, assetClass: 'Index', market: 'indices', icon: '🇩🇪' },
    { symbol: 'FTSE', name: 'FTSE 100', price: 8650.70, mcap: 0, change24h: 0.15, change7d: 0.67, assetClass: 'Index', market: 'indices', icon: '🇬🇧' },
    { symbol: 'NIKKEI', name: 'Nikkei 225', price: 37240.10, mcap: 0, change24h: -1.12, change7d: -2.30, assetClass: 'Index', market: 'indices', icon: '🇯🇵' },
    // EQUITIES
    { symbol: 'AAPL', name: 'Apple', price: 217.90, mcap: 3340000000000, change24h: 0.67, change7d: 2.34, assetClass: 'Equity', market: 'equities', icon: '🍎' },
    { symbol: 'MSFT', name: 'Microsoft', price: 420.50, mcap: 3120000000000, change24h: 1.23, change7d: 3.45, assetClass: 'Equity', market: 'equities', icon: '💻' },
    { symbol: 'NVDA', name: 'NVIDIA', price: 112.80, mcap: 2750000000000, change24h: -2.15, change7d: -5.30, assetClass: 'Equity', market: 'equities', icon: '🎮' },
    { symbol: 'TSLA', name: 'Tesla', price: 268.40, mcap: 855000000000, change24h: 3.45, change7d: 8.90, assetClass: 'Equity', market: 'equities', icon: '🚗' },
    { symbol: 'AMZN', name: 'Amazon', price: 198.30, mcap: 2050000000000, change24h: 0.89, change7d: 1.56, assetClass: 'Equity', market: 'equities', icon: '📦' },
    { symbol: 'META', name: 'Meta', price: 585.20, mcap: 1480000000000, change24h: -0.56, change7d: 2.10, assetClass: 'Equity', market: 'equities', icon: '👤' },
    { symbol: 'GOOGL', name: 'Alphabet', price: 163.70, mcap: 2010000000000, change24h: 0.34, change7d: 1.89, assetClass: 'Equity', market: 'equities', icon: '🔍' },
    { symbol: 'JPM', name: 'JP Morgan', price: 245.80, mcap: 710000000000, change24h: 0.78, change7d: 3.20, assetClass: 'Equity', market: 'equities', icon: '🏦' },
    { symbol: 'GS', name: 'Goldman Sachs', price: 540.30, mcap: 178000000000, change24h: -0.45, change7d: 1.23, assetClass: 'Equity', market: 'equities', icon: '🏦' },
    // CRYPTO (6 selected)
    { symbol: 'BTC/USD', name: 'Bitcoin', price: 87432, mcap: 1720000000000, change24h: 2.34, change7d: 5.12, assetClass: 'Crypto', market: 'crypto', icon: '₿' },
    { symbol: 'ETH/USD', name: 'Ethereum', price: 3245, mcap: 390000000000, change24h: -1.23, change7d: 3.45, assetClass: 'Crypto', market: 'crypto', icon: 'Ξ' },
    { symbol: 'XRP/USD', name: 'Ripple', price: 2.34, mcap: 134000000000, change24h: -0.45, change7d: 1.23, assetClass: 'Crypto', market: 'crypto', icon: '💎' },
    { symbol: 'BNB/USD', name: 'Binance Coin', price: 612, mcap: 91000000000, change24h: 0.89, change7d: -2.10, assetClass: 'Crypto', market: 'crypto', icon: '🟡' },
    { symbol: 'TRX/USD', name: 'TRON', price: 0.238, mcap: 21500000000, change24h: 1.56, change7d: 4.30, assetClass: 'Crypto', market: 'crypto', icon: '⚡' },
    { symbol: 'SOL/USD', name: 'Solana', price: 178.5, mcap: 82000000000, change24h: 4.56, change7d: 12.30, assetClass: 'Crypto', market: 'crypto', icon: '☀️' },
];

// ===================== ENTITY & LABEL DATA =====================
const ENTITY_PROFILES = {
    'BlackRock': { ceo: 'Larry Fink', aum: 10500000000000, strategy: 'Multi-Asset', cik: '1364742', type: 'institutional', icon: '🏛️', reputation: 95, founded: 1988, hq: 'New York, NY', sector: 'Asset Management', track: { win: 72, avg90d: 8.4, trades: 2340 } },
    'Bridgewater Associates': { ceo: 'Ray Dalio', aum: 124000000000, strategy: 'Global Macro', cik: '1350694', type: 'institutional', icon: '🏛️', reputation: 92, founded: 1975, hq: 'Westport, CT', sector: 'Hedge Fund', track: { win: 68, avg90d: 12.1, trades: 890 } },
    'Vanguard': { ceo: 'Tim Buckley', aum: 8600000000000, strategy: 'Index/Passive', cik: '102909', type: 'institutional', icon: '🏛️', reputation: 88, founded: 1975, hq: 'Malvern, PA', sector: 'Asset Management', track: { win: 64, avg90d: 4.2, trades: 1200 } },
    'Citadel': { ceo: 'Ken Griffin', aum: 62000000000, strategy: 'Quant/Market Making', cik: '1423053', type: 'institutional', icon: '🏛️', reputation: 94, founded: 1990, hq: 'Miami, FL', sector: 'Hedge Fund', track: { win: 78, avg90d: 15.3, trades: 12450 } },
    'Renaissance Technologies': { ceo: 'Peter Brown', aum: 106000000000, strategy: 'Quantitative', cik: '1037389', type: 'institutional', icon: '🏛️', reputation: 98, founded: 1982, hq: 'East Setauket, NY', sector: 'Hedge Fund', track: { win: 82, avg90d: 18.7, trades: 8900 } },
    'Goldman Sachs Trading': { ceo: 'David Solomon', aum: 2800000000000, strategy: 'Multi-Strategy', cik: '886982', type: 'institutional', icon: '🏦', reputation: 90, founded: 1869, hq: 'New York, NY', sector: 'Investment Bank', track: { win: 70, avg90d: 9.2, trades: 15800 } },
    'JP Morgan Asset Mgmt': { ceo: 'Jamie Dimon (CEO)', aum: 3000000000000, strategy: 'Multi-Asset', cik: '19617', type: 'institutional', icon: '🏦', reputation: 91, founded: 2000, hq: 'New York, NY', sector: 'Investment Bank', track: { win: 71, avg90d: 7.8, trades: 9200 } },
    'Norway Sovereign Fund': { ceo: 'Nicolai Tangen', aum: 1700000000000, strategy: 'Sovereign Wealth', cik: '1552797', type: 'institutional', icon: '🇳🇴', reputation: 93, founded: 1990, hq: 'Oslo, Norway', sector: 'Sovereign Fund', track: { win: 65, avg90d: 5.1, trades: 420 } },
    'Abu Dhabi Investment Authority': { ceo: 'Hamed bin Zayed', aum: 993000000000, strategy: 'Sovereign Diversified', cik: null, type: 'institutional', icon: '🇦🇪', reputation: 89, founded: 1976, hq: 'Abu Dhabi, UAE', sector: 'Sovereign Fund', track: { win: 66, avg90d: 6.3, trades: 310 } },
    'Berkshire Hathaway': { ceo: 'Warren Buffett', aum: 370000000000, strategy: 'Value Investing', cik: '1067983', type: 'institutional', icon: '🏛️', reputation: 97, founded: 1965, hq: 'Omaha, NE', sector: 'Conglomerate', track: { win: 71, avg90d: 5.8, trades: 156 } },
    'PIMCO': { ceo: 'Emmanuel Roman', aum: 1740000000000, strategy: 'Fixed Income/Macro', cik: '811830', type: 'institutional', icon: '🏛️', reputation: 87, founded: 1971, hq: 'Newport Beach, CA', sector: 'Asset Management', track: { win: 63, avg90d: 3.9, trades: 760 } },
    'Two Sigma': { ceo: 'John Overdeck', aum: 60000000000, strategy: 'Systematic/AI', cik: '1479506', type: 'institutional', icon: '🏛️', reputation: 91, founded: 2001, hq: 'New York, NY', sector: 'Hedge Fund', track: { win: 71, avg90d: 9.8, trades: 5600 } },
    'D.E. Shaw': { ceo: 'David Shaw', aum: 55000000000, strategy: 'Multi-Strategy', cik: '1009207', type: 'institutional', icon: '🏛️', reputation: 90, founded: 1988, hq: 'New York, NY', sector: 'Hedge Fund', track: { win: 74, avg90d: 11.2, trades: 4200 } },
    'Millennium Management': { ceo: 'Israel Englander', aum: 59000000000, strategy: 'Multi-Manager', cik: '1273087', type: 'institutional', icon: '🏛️', reputation: 88, founded: 1989, hq: 'New York, NY', sector: 'Hedge Fund', track: { win: 69, avg90d: 7.6, trades: 6700 } },
    'Point72': { ceo: 'Steve Cohen', aum: 27000000000, strategy: 'Discretionary/Quant', cik: '1603466', type: 'institutional', icon: '🏛️', reputation: 86, founded: 2014, hq: 'Stamford, CT', sector: 'Hedge Fund', track: { win: 66, avg90d: 6.4, trades: 3100 } },
    'Tiger Global': { ceo: 'Chase Coleman', aum: 20000000000, strategy: 'Growth/Tech', cik: '1167483', type: 'institutional', icon: '🏛️', reputation: 82, founded: 2001, hq: 'New York, NY', sector: 'Hedge Fund', track: { win: 59, avg90d: -3.2, trades: 1890 } },
    'Soros Fund Management': { ceo: 'George Soros', aum: 28000000000, strategy: 'Global Macro', cik: '1029160', type: 'institutional', icon: '🏛️', reputation: 96, founded: 1970, hq: 'New York, NY', sector: 'Family Office', track: { win: 73, avg90d: 14.5, trades: 540 } },
    'Paulson & Co': { ceo: 'John Paulson', aum: 3000000000, strategy: 'Event-Driven/Gold', cik: '1035674', type: 'institutional', icon: '🏛️', reputation: 79, founded: 1994, hq: 'New York, NY', sector: 'Hedge Fund', track: { win: 55, avg90d: 2.1, trades: 180 } },
    'AQR Capital': { ceo: 'Cliff Asness', aum: 98000000000, strategy: 'Systematic/Factor', cik: '1167557', type: 'institutional', icon: '🏛️', reputation: 85, founded: 1998, hq: 'Greenwich, CT', sector: 'Hedge Fund', track: { win: 67, avg90d: 8.0, trades: 2400 } },
    'Balyasny Asset Mgmt': { ceo: 'Dmitry Balyasny', aum: 21000000000, strategy: 'Multi-Strategy', cik: '1336528', type: 'institutional', icon: '🏛️', reputation: 83, founded: 2001, hq: 'Chicago, IL', sector: 'Hedge Fund', track: { win: 70, avg90d: 10.5, trades: 3800 } },
    'Pershing Square Capital': { ceo: 'Bill Ackman', aum: 18000000000, strategy: 'Activist/Concentrated', cik: '1336528', type: 'institutional', icon: '🏛️', reputation: 84, founded: 2004, hq: 'New York, NY', sector: 'Hedge Fund', track: { win: 62, avg90d: 7.3, trades: 95 } },
    // Crypto whales
    'Binance Cold Wallet': { ceo: 'CZ (Changpeng Zhao)', aum: 82000000000, strategy: 'Exchange Reserve', cik: null, type: 'crypto', icon: '🟡', reputation: 78, founded: 2017, hq: 'Global', sector: 'Exchange', track: { win: 0, avg90d: 0, trades: 45600 } },
    'Jump Trading Crypto': { ceo: 'Kanav Kariya', aum: 8000000000, strategy: 'HFT/Market Making', cik: null, type: 'crypto', icon: '🐋', reputation: 85, founded: 1999, hq: 'Chicago, IL', sector: 'Prop Trading', track: { win: 76, avg90d: 22.4, trades: 98000 } },
    'Wintermute': { ceo: 'Evgeny Gaevoy', aum: 4500000000, strategy: 'Liquidity Provider', cik: null, type: 'crypto', icon: '🐋', reputation: 80, founded: 2017, hq: 'London, UK', sector: 'Market Maker', track: { win: 73, avg90d: 19.1, trades: 120000 } },
    'Vitalik Buterin': { ceo: 'Vitalik Buterin', aum: 2100000000, strategy: 'DeFi/Governance', cik: null, type: 'crypto', icon: '⟠', reputation: 95, founded: 2013, hq: 'Global', sector: 'Founder', track: { win: 68, avg90d: 34.5, trades: 2800 } },
    'Galaxy Digital': { ceo: 'Mike Novogratz', aum: 5400000000, strategy: 'Crypto VC/Trading', cik: null, type: 'crypto', icon: '🌌', reputation: 76, founded: 2018, hq: 'New York, NY', sector: 'Crypto Fund', track: { win: 64, avg90d: 15.8, trades: 4200 } },
    'Crypto Whale #1': { ceo: 'Unknown', aum: 920000000, strategy: 'Accumulation', cik: null, type: 'crypto', icon: '🐋', reputation: 60, founded: null, hq: 'Unknown', sector: 'Whale', track: { win: 61, avg90d: 8.9, trades: 320 } },
};

const WHALE_NAMES = Object.keys(ENTITY_PROFILES);

const TX_TYPES = ['buy', 'sell', 'position', 'hedge'];

const SUBREDDITS = ['wallstreetbets', 'stocks', 'CryptoCurrency', 'commodities', 'Gold'];

const TOPICS = [
    'gold safe haven', 'oil OPEC', 'Fed rate cut', 'inflation', 'recession', 'trade war',
    'China stimulus', 'strong dollar', 'treasuries', 'tech stocks', 'S&P 500 ATH',
    'silver industrial', 'gold ETF', 'position sizing', 'geopolitical hedge',
    'HK50 rally', 'earnings season', 'jobs data', 'CPI surprise', 'yield curve',
    'smart money', 'COT report', 'institutional flow', 'short squeeze', 'sector rotation',
];

// ===================== LEADERBOARD ENTITIES =====================
const LEADERBOARD_ENTITIES = [
    { name: 'BlackRock', icon: '🏛️', type: 'institutional', strategy: 'Multi-Asset', aum: 10500000000000, winRate: 72, pnl90d: 8.4, totalVol: 890000000000, txCount: 2340 },
    { name: 'Bridgewater Associates', icon: '🏛️', type: 'institutional', strategy: 'Macro Hedge', aum: 124000000000, winRate: 68, pnl90d: 12.1, totalVol: 67000000000, txCount: 890 },
    { name: 'Citadel', icon: '🏛️', type: 'institutional', strategy: 'Quant/Market Making', aum: 62000000000, winRate: 78, pnl90d: 15.3, totalVol: 420000000000, txCount: 12450 },
    { name: 'Renaissance Tech', icon: '🏛️', type: 'institutional', strategy: 'Quantitative', aum: 106000000000, winRate: 82, pnl90d: 18.7, totalVol: 310000000000, txCount: 8900 },
    { name: 'Two Sigma', icon: '🏛️', type: 'institutional', strategy: 'Systematic', aum: 60000000000, winRate: 71, pnl90d: 9.8, totalVol: 180000000000, txCount: 5600 },
    { name: 'D.E. Shaw', icon: '🏛️', type: 'institutional', strategy: 'Multi-Strategy', aum: 55000000000, winRate: 74, pnl90d: 11.2, totalVol: 150000000000, txCount: 4200 },
    { name: 'Millennium Mgmt', icon: '🏛️', type: 'institutional', strategy: 'Multi-Manager', aum: 59000000000, winRate: 69, pnl90d: 7.6, totalVol: 210000000000, txCount: 6700 },
    { name: 'Point72', icon: '🏛️', type: 'institutional', strategy: 'Discretionary', aum: 27000000000, winRate: 66, pnl90d: 6.4, totalVol: 89000000000, txCount: 3100 },
    { name: 'Vanguard', icon: '🏛️', type: 'institutional', strategy: 'Index/Passive', aum: 8600000000000, winRate: 64, pnl90d: 4.2, totalVol: 560000000000, txCount: 1200 },
    { name: 'Berkshire Hathaway', icon: '🏛️', type: 'institutional', strategy: 'Value Investing', aum: 370000000000, winRate: 71, pnl90d: 5.8, totalVol: 45000000000, txCount: 156 },
    { name: 'Binance Cold Wallet', icon: '🐋', type: 'crypto', strategy: 'Exchange Reserve', aum: 82000000000, winRate: 0, pnl90d: 0, totalVol: 950000000000, txCount: 45600 },
    { name: 'Jump Trading Crypto', icon: '🐋', type: 'crypto', strategy: 'Market Making', aum: 8000000000, winRate: 76, pnl90d: 22.4, totalVol: 320000000000, txCount: 98000 },
    { name: 'Wintermute', icon: '🐋', type: 'crypto', strategy: 'Liquidity Provider', aum: 4500000000, winRate: 73, pnl90d: 19.1, totalVol: 280000000000, txCount: 120000 },
    { name: 'Alameda Remnant', icon: '🐋', type: 'crypto', strategy: 'Liquidation', aum: 1200000000, winRate: 0, pnl90d: -85.2, totalVol: 12000000000, txCount: 340 },
    { name: 'Whale 0xd8dA…6045', icon: '🐋', type: 'crypto', strategy: 'DeFi/Governance', aum: 2100000000, winRate: 68, pnl90d: 34.5, totalVol: 5600000000, txCount: 2800 },
];

// ===================== DATA SOURCES =====================
const DATA_SOURCES = [
    { name: 'Whale Alert', icon: '🐋', type: 'Crypto Whale Tracking', desc: 'Real-time monitoring of large blockchain transactions. Detects major BTC, ETH and altcoin movements between wallets and exchanges.', tags: ['crypto', 'blockchain', 'transactions', 'real-time'], url: 'https://whale-alert.io', status: 'active' },
    { name: 'WhaleWisdom', icon: '🏦', type: 'Institutional Positions (13F)', desc: 'Tracks SEC 13F filings from hedge funds and institutional managers. See what Buffett, Dalio and Soros are buying and selling.', tags: ['equities', 'hedge funds', '13F', 'SEC', 'institutional'], url: 'https://whalewisdom.com', status: 'active' },
    { name: 'CFTC COT Report', icon: '📊', type: 'Futures Positioning', desc: 'Commitment of Traders — positioning of commercials, large speculators and small traders in gold, oil, silver and index futures.', tags: ['commodities', 'futures', 'gold', 'oil', 'COT'], url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders', status: 'active' },
    { name: 'Finviz', icon: '📈', type: 'Screener & Market Map', desc: 'Advanced stock screener with market heatmap, insider trading data, and fundamental analysis for US equities.', tags: ['equities', 'screener', 'insider', 'heatmap'], url: 'https://finviz.com', status: 'active' },
    { name: 'TradingView', icon: '📉', type: 'Charts & Technical Analysis', desc: 'Leading charting platform with real-time data for commodities, indices, equities and crypto. Community-driven trade ideas.', tags: ['charts', 'technical analysis', 'multi-asset', 'community'], url: 'https://tradingview.com', status: 'active' },
    { name: 'Koyfin', icon: '💹', type: 'Financial Terminal', desc: 'Bloomberg-style terminal for free. Macro data, valuation metrics, advanced screening and customizable dashboards.', tags: ['macro', 'fundamental', 'terminal', 'valuation'], url: 'https://koyfin.com', status: 'active' },
    { name: 'Unusual Whales', icon: '🦑', type: 'Options Flow & Dark Pool', desc: 'Detects unusual options activity and dark pool flow in equities. Identifies large smart money bets on stocks.', tags: ['options', 'dark pool', 'smart money', 'equities'], url: 'https://unusualwhales.com', status: 'active' },
    { name: 'Hyperliquid', icon: '⚡', type: 'Perpetuals & Open Interest', desc: 'Public API with perp positions, open interest and whale trades in crypto. No API key required.', tags: ['crypto', 'perps', 'open interest', 'DeFi'], url: 'https://hyperliquid.xyz', status: 'active' },
    { name: 'Reddit Sentiment', icon: '💬', type: 'Social Intelligence', desc: 'Sentiment analysis from r/wallstreetbets, r/stocks, r/commodities and r/Gold. Detects emerging trends and narratives.', tags: ['sentiment', 'social', 'Reddit', 'analysis'], url: 'https://reddit.com', status: 'active' },
    { name: 'World Gold Council', icon: '🥇', type: 'Institutional Gold Data', desc: 'Global gold supply and demand data, central bank purchases, gold ETF flows and country reserves.', tags: ['gold', 'central bank', 'ETF', 'reserves'], url: 'https://www.gold.org', status: 'active' },
    { name: 'OPEC Monthly Report', icon: '🛢️', type: 'Oil Reports', desc: 'Monthly OPEC reports with supply/demand projections, production by country and impact on oil prices.', tags: ['oil', 'OPEC', 'production', 'report'], url: 'https://www.opec.org', status: 'active' },
    { name: 'Fear & Greed Index', icon: '😱', type: 'Market Sentiment', desc: 'CNN Fear and Greed Index for equities and Alternative.me for crypto. Market sentiment thermometer.', tags: ['sentiment', 'fear', 'greed', 'market'], url: 'https://edition.cnn.com/markets/fear-and-greed', status: 'active' },
];

// ===================== SOURCE LINK HELPERS =====================
const CRYPTO_EXPLORERS = {
    'BTC/USD': [
        { name: 'Blockchain.com', url: 'https://www.blockchain.com/explorer/mempool/btc', icon: '⛓️' },
        { name: 'Blockchair', url: 'https://blockchair.com/bitcoin', icon: '🔍' },
        { name: 'Whale Alert', url: 'https://whale-alert.io/alerts/bitcoin', icon: '🐋' },
    ],
    'ETH/USD': [
        { name: 'Etherscan', url: 'https://etherscan.io', icon: '🔍' },
        { name: 'Whale Alert', url: 'https://whale-alert.io/alerts/ethereum', icon: '🐋' },
        { name: 'Blockchain.com', url: 'https://www.blockchain.com/explorer/assets/eth', icon: '⛓️' },
    ],
    'XRP/USD': [
        { name: 'XRPScan', url: 'https://xrpscan.com', icon: '🔍' },
        { name: 'Bithomp', url: 'https://bithomp.com/explorer', icon: '⛓️' },
        { name: 'Whale Alert', url: 'https://whale-alert.io/alerts/ripple', icon: '🐋' },
    ],
    'BNB/USD': [
        { name: 'BscScan', url: 'https://bscscan.com', icon: '🔍' },
        { name: 'Whale Alert', url: 'https://whale-alert.io/alerts/binancechain', icon: '🐋' },
        { name: 'Binance Explorer', url: 'https://explorer.bnbchain.org', icon: '⛓️' },
    ],
    'TRX/USD': [
        { name: 'Tronscan', url: 'https://tronscan.org', icon: '🔍' },
        { name: 'Whale Alert', url: 'https://whale-alert.io/alerts/tron', icon: '🐋' },
    ],
    'SOL/USD': [
        { name: 'Solscan', url: 'https://solscan.io', icon: '🔍' },
        { name: 'Solana Explorer', url: 'https://explorer.solana.com', icon: '⛓️' },
        { name: 'Whale Alert', url: 'https://whale-alert.io/alerts/solana', icon: '🐋' },
    ],
};

function getSourceInfo(market, token) {
    if (market === 'crypto') {
        const pool = CRYPTO_EXPLORERS[token] || CRYPTO_EXPLORERS['ETH/USD'];
        return pool[randInt(0, pool.length)];
    }
    const cleanSymbol = token.replace('/USD', '').replace('/', '');
    const sources = {
        equities: [
            { name: 'SEC EDGAR', url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(cleanSymbol)}&type=13F`, icon: '📋' },
            { name: 'WhaleWisdom', url: `https://whalewisdom.com/stock/${cleanSymbol.toLowerCase()}`, icon: '🏦' },
            { name: 'Finviz', url: `https://finviz.com/quote.ashx?t=${cleanSymbol}`, icon: '📈' },
        ],
        commodities: [
            { name: 'CFTC COT', url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm', icon: '📊' },
            { name: 'World Gold Council', url: 'https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows', icon: '🥇' },
            { name: 'TradingView', url: `https://www.tradingview.com/symbols/${cleanSymbol}/`, icon: '📉' },
        ],
        indices: [
            { name: 'Finviz', url: 'https://finviz.com/futures.ashx', icon: '📈' },
            { name: 'TradingView', url: `https://www.tradingview.com/symbols/${cleanSymbol}/`, icon: '📉' },
            { name: 'Investing.com', url: 'https://www.investing.com/indices/', icon: '🌐' },
        ],
    };
    const pool = sources[market] || sources.commodities;
    return pool[randInt(0, pool.length)];
}

// ===================== UTILITIES =====================
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max)); }
function randEl(arr) { return arr[randInt(0, arr.length)]; }
function randAddr() { return '0x' + Array.from({length: 40}, () => '0123456789abcdef'[randInt(0,16)]).join(''); }
function shortAddr(a) { return a.startsWith('0x') ? a.slice(0,6) + '...' + a.slice(-4) : a; }

function formatUSD(n) {
    if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n/1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(2);
}

function timeAgo(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    return Math.floor(s / 3600) + 'h ago';
}

function generateSparkline(points = 24, base = 100, volatility = 5) {
    const data = [];
    let val = base;
    for (let i = 0; i < points; i++) { val += rand(-volatility, volatility); data.push(Math.max(0, val)); }
    return data;
}

// ===================== SMART MONEY SCORE CALCULATOR =====================
function calcSmartMoneyScore(entity, amount, type, market) {
    const profile = ENTITY_PROFILES[entity];
    if (!profile) return { score: randInt(30, 65), components: {} };
    let score = 0;
    const components = {};

    // Reputation weight (0-25)
    components.reputation = Math.round(profile.reputation * 0.25);
    score += components.reputation;

    // Track record weight (0-25)
    components.trackRecord = Math.round((profile.track.win / 100) * 25);
    score += components.trackRecord;

    // Position size relative to AUM (0-20) — larger relative = more conviction
    const pctOfAum = (amount / profile.aum) * 100;
    components.conviction = Math.min(20, Math.round(pctOfAum * 200));
    score += components.conviction;

    // Market timing / type signal (0-15)
    if (type === 'buy' && profile.track.avg90d > 0) components.timing = 15;
    else if (type === 'hedge') components.timing = 12;
    else if (type === 'position') components.timing = 10;
    else components.timing = 7;
    score += components.timing;

    // Diversification bonus (0-15)
    components.diversification = market === 'crypto' ? 8 : market === 'equities' ? 12 : market === 'commodities' ? 14 : 10;
    score += components.diversification;

    return { score: Math.min(99, score), components };
}

// ===================== FILING INFO GENERATOR =====================
function generateFilingInfo(market, entity) {
    const profile = ENTITY_PROFILES[entity];
    const now = new Date();
    const filingDate = new Date(now - randInt(1, 45) * 86400000);
    const dateStr = filingDate.toISOString().split('T')[0];
    
    if (market === 'crypto') {
        return {
            type: randEl(['On-Chain TX', 'Wallet Transfer', 'DEX Swap', 'Bridge TX', 'Staking Move']),
            date: dateStr,
            cik: null,
            shares: null,
            blockNumber: randInt(19000000, 20500000),
            confirmations: randInt(12, 500),
            gasUsed: randInt(21000, 350000),
        };
    }

    const filingTypes = {
        equities: ['13F-HR', '13F-HR/A', 'SC 13G', 'SC 13D', 'Form 4'],
        commodities: ['CFTC COT', 'COT Supplemental', 'Disaggregated COT'],
        indices: ['13F-HR', 'CFTC COT', 'ADV-H'],
    };
    const type = randEl(filingTypes[market] || filingTypes.equities);
    
    return {
        type,
        date: dateStr,
        cik: profile?.cik || String(randInt(1000000, 2000000)),
        shares: randInt(50000, 12000000),
        prevShares: randInt(30000, 10000000),
        changePercent: rand(-40, 80).toFixed(1),
    };
}

// ===================== INSIGHT GENERATOR =====================
function generateInsight(type, market, tokenName, amount, entity) {
    const profile = ENTITY_PROFILES[entity];
    const ceoFirst = profile?.ceo?.split(' ')[0] || 'Management';

    const insights = {
        buy: {
            commodities: [
                `${entity} adds to ${tokenName} position — new accumulation phase. ${ceoFirst}'s macro thesis favors hard assets as inflation hedge amid rising geopolitical risk.`,
                `13F filing reveals ${entity} increased ${tokenName} exposure by ${rand(15,60).toFixed(0)}%. Signals strong conviction in commodity supercycle thesis.`,
                `${entity} initiating new long ${tokenName} position. Portfolio rebalance suggests rotation from duration risk into real assets.`,
                `Major accumulation by ${entity} in ${tokenName}. Fund positioning aligns with recent central bank purchasing patterns and de-dollarization trend.`,
            ],
            indices: [
                `${entity} increasing exposure to ${tokenName}. ${ceoFirst} sees value after recent pullback — risk/reward now favorable per internal models.`,
                `Systematic buying by ${entity} in ${tokenName}. Factor models triggering momentum and mean-reversion signals simultaneously.`,
                `${entity} adds ${tokenName} exposure ahead of earnings season. Macro overlay suggests broadening market participation.`,
            ],
            equities: [
                `${entity} initiates new position in ${tokenName} — ${formatUSD(amount)} stake. ${ceoFirst} sees undervaluation relative to peer group.`,
                `13F reveals ${entity} accumulated ${tokenName} shares. Position sizing suggests high-conviction bet on sector rotation.`,
                `${entity} increases ${tokenName} stake by ${rand(10,45).toFixed(0)}%. Dark pool activity confirms sustained institutional accumulation over 5 sessions.`,
            ],
            crypto: [
                `${entity} moves ${formatUSD(amount)} in ${tokenName} to cold storage — long-term accumulation signal. On-chain metrics show declining exchange reserves.`,
                `Large ${tokenName} purchase by ${entity}. Wallet analysis shows DCA pattern over past 14 days — total exposure now exceeds ${formatUSD(amount * rand(3,8))}.`,
                `${entity} onboards ${formatUSD(amount)} ${tokenName}. Coincides with whale accumulation zone identified by on-chain intelligence.`,
            ],
        },
        sell: {
            commodities: [
                `${entity} reduces ${tokenName} exposure — partial profit-taking after ${rand(8,25).toFixed(0)}% rally. Position decreased but still maintains core long.`,
                `${entity} trimming ${tokenName} allocation. ${ceoFirst} rotating proceeds into shorter-duration instruments ahead of Fed decision.`,
            ],
            indices: [
                `${entity} reduces ${tokenName} allocation by ${rand(10,35).toFixed(0)}%. Portfolio de-risking as volatility indices signal elevated uncertainty.`,
                `Systematic selling by ${entity} in ${tokenName}. Risk models flagging overextension — partial reduction, not a full exit.`,
            ],
            equities: [
                `${entity} exiting ${tokenName} position — ${formatUSD(amount)} divestment. Filing suggests sector rotation from growth to value/defensives.`,
                `${entity} reduces ${tokenName} stake. Post-earnings repositioning — ${ceoFirst}'s team sees limited upside at current multiples.`,
            ],
            crypto: [
                `${entity} transfers ${formatUSD(amount)} ${tokenName} to exchange — potential distribution. On-chain flow suggests partial profit realization.`,
                `Large ${tokenName} outflow from ${entity} wallet. Exchange deposits spiking — bearish short-term signal for price action.`,
            ],
        },
        position: {
            commodities: [`${entity} restructures ${tokenName} portfolio — adjusting futures curve exposure. ${ceoFirst} repositioning for contango/backwardation shifts.`],
            indices: [`${entity} rebalancing ${tokenName} portfolio weighting. Systematic allocation triggers after sector correlation breakdown.`],
            equities: [`${entity} adjusts ${tokenName} position size — internal risk committee signaling portfolio concentration limits reached.`],
            crypto: [`${entity} rebalances ${tokenName} across multiple wallets. On-chain patterns suggest portfolio optimization, not directional trade.`],
        },
        hedge: {
            commodities: [`${entity} implements ${tokenName} hedge via options overlay — ${ceoFirst}'s team protecting downside while maintaining upside exposure.`],
            indices: [`${entity} hedging ${tokenName} exposure with put spreads. VIX positioning suggests expecting 2-4 weeks of elevated volatility.`],
            equities: [`${entity} hedging ${tokenName} concentration risk with collar strategy — protective put + covered call structure.`],
            crypto: [`${entity} hedging ${tokenName} position through perpetual shorts — funding rate arbitrage generating additional yield.`],
        },
    };

    const pool = insights[type]?.[market] || [`${entity} ${type}s ${formatUSD(amount)} in ${tokenName}. Institutional flow detected.`];
    return randEl(pool);
}

// ===================== ALERT GENERATOR =====================
function generateWhaleAlert() {
    const token = randEl(TOKENS);
    const amount = rand(500000, 80000000);
    const type = randEl(TX_TYPES);
    const impact = amount > 20000000 ? 'high' : amount > 5000000 ? 'medium' : 'low';
    const isInstitutional = token.market !== 'crypto';
    const whaleName = randEl(WHALE_NAMES);
    const profile = ENTITY_PROFILES[whaleName];
    const source = getSourceInfo(token.market, token.symbol);
    const filing = generateFilingInfo(token.market, whaleName);
    const sms = calcSmartMoneyScore(whaleName, amount, type, token.market);
    const insight = generateInsight(type, token.market, token.name, amount, whaleName);

    const actionLabel = {
        buy: 'Accumulation — new position or increase',
        sell: 'Reduction — partial or full exit',
        position: 'Rebalancing — portfolio adjustment',
        hedge: 'Hedge — risk protection against exposure',
    };

    return {
        id: Date.now() + randInt(0, 9999),
        token: token.symbol, tokenName: token.name,
        market: token.market, amount, type, impact,
        from: isInstitutional ? whaleName : randAddr(),
        to: isInstitutional ? actionLabel[type] : randAddr(),
        time: Date.now() - randInt(0, 3600000),
        whaleName,
        profile,
        filing,
        smartMoneyScore: sms.score,
        smsComponents: sms.components,
        insight,
        actionLabel: actionLabel[type],
        sourceUrl: source.url, sourceName: source.name, sourceIcon: source.icon,
        convergenceSignals: generateConvergenceSignals(token, type),
    };
}

function generateConvergenceSignals(token, type) {
    const signals = [];
    if (Math.random() > 0.4) signals.push({ icon: '📊', label: 'COT Report', detail: type === 'buy' ? 'Commercials net long increasing' : 'Large specs reducing longs', sentiment: type === 'buy' ? 'bullish' : 'bearish' });
    if (Math.random() > 0.5) signals.push({ icon: '📈', label: 'Options Flow', detail: `Unusual ${type === 'buy' ? 'call' : 'put'} activity detected`, sentiment: type === 'buy' ? 'bullish' : 'bearish' });
    if (Math.random() > 0.6) signals.push({ icon: '🔗', label: 'On-Chain', detail: type === 'buy' ? 'Exchange outflows accelerating' : 'Exchange inflows rising', sentiment: type === 'buy' ? 'bullish' : 'bearish' });
    if (Math.random() > 0.55) signals.push({ icon: '💬', label: 'Social Sentiment', detail: `Reddit/Twitter sentiment trending ${type === 'buy' ? 'positive' : 'negative'}`, sentiment: type === 'buy' ? 'bullish' : 'neutral' });
    if (Math.random() > 0.65) signals.push({ icon: '🏦', label: 'Dark Pool', detail: `${type === 'buy' ? 'Accumulation' : 'Distribution'} patterns on dark pools`, sentiment: type === 'buy' ? 'bullish' : 'bearish' });
    return signals;
}

// ===================== REDDIT POST GENERATOR =====================
function generateRedditPost() {
    const titles = [
        'Gold at $3000+, central banks buying like crazy — brace yourselves',
        'Smart money rotating out of tech into commodities — COT confirms',
        'Oil could crash: OPEC threatening to increase production',
        'HK50 broke resistance — China injecting massive stimulus',
        'S&P 500 at all-time high but breadth is horrible',
        'Silver is the most asymmetric trade of 2026 — here\'s the data',
        'BlackRock buying physical gold at record volumes',
        'Dark pool flow showing massive accumulation in NVDA',
        'COT Report shows commercials accumulating shorts on oil',
        'Fed might cut rates in June — impact on precious metals',
        'Warren Buffett increased cash position — topping signal?',
        'Gold ETF with largest inflow in 3 years — detailed data',
        'BTC and Gold correlated: both are hedges against fiat',
        'Analysis: why the dollar will weaken and gold will hit $3500',
        'Middle East sovereign funds diversifying into tech equities',
    ];
    return {
        title: randEl(titles), subreddit: randEl(SUBREDDITS), upvotes: randInt(50, 5000),
        comments: randInt(20, 800), sentiment: randEl(['positive', 'negative', 'neutral']),
        sentimentScore: rand(-1, 1), time: Date.now() - randInt(0, 86400000),
        author: 'u/' + randEl(['GoldBull2026', 'SmartMoneyTracker', 'OilAnalyst', 'WallStreetInsider', 'CommoditiesKing', 'IndexTraderPro', 'MacroResearcher']),
    };
}

// ===================== STATE =====================
const state = {
    currentSection: 'whale-alerts',
    alerts: [],
    alertsPaused: false,
    trackedWallets: [],
    tokens: JSON.parse(JSON.stringify(TOKENS)),
    posts: [],
    fearGreedIndex: randInt(25, 85),
    sidebarCollapsed: false,
};

// ===================== INITIALIZATION =====================
document.addEventListener('DOMContentLoaded', () => {
    // Pre-generate data
    for (let i = 0; i < 25; i++) state.alerts.push(generateWhaleAlert());
    state.alerts.sort((a, b) => b.time - a.time);
    for (let i = 0; i < 15; i++) state.posts.push(generateRedditPost());

    setTimeout(() => {
        const splash = document.getElementById('splash-loader');
        const app = document.getElementById('app');
        splash.classList.add('fade-out');
        app.classList.remove('hidden');
        setTimeout(() => { app.classList.add('visible'); splash.remove(); }, 700);
        initApp();
    }, 2400);
});

async function initApp() {
    setupNavigation();
    setupSearch();
    setupSidebar();
    setupSettings();
    renderDataSources();

    // First live sync
    showToast('🔄', 'Connecting to data sources...', 'whale');
    const updated = await LiveData.syncAll();
    if (updated > 0) {
        showToast('✅', `${updated} assets updated with live prices!`, 'bull');
    } else {
        showToast('ℹ️', 'Demo mode active. Configure API keys in Settings.', 'alert');
    }

    updateTickers();
    renderWhaleAlerts();
    renderLeaderboard();
    renderMarketOverview();
    renderVolumeScanner();
    renderCohortAnalysis();
    renderCommunityIntel();
    updateAlertStats();
    startLiveUpdates();
    document.getElementById('last-update').textContent = 'Last update: now';
}

// ===================== NAVIGATION =====================
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) navigateTo(section);
        });
    });
    const hash = location.hash.slice(1);
    if (hash) navigateTo(hash);
}

function navigateTo(section) {
    state.currentSection = section;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const navItem = document.querySelector(`[data-section="${section}"]`);
    const sectionEl = document.getElementById('section-' + section);
    if (navItem) navItem.classList.add('active');
    if (sectionEl) sectionEl.classList.add('active');
    location.hash = section;
    document.getElementById('sidebar').classList.remove('mobile-open');
}

// ===================== SIDEBAR =====================
function setupSidebar() {
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768) { sidebar.classList.toggle('mobile-open'); }
        else { sidebar.classList.toggle('collapsed'); }
    });
}

// ===================== SEARCH =====================
function setupSearch() {
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('search-input');
    document.getElementById('search-trigger').addEventListener('click', () => openSearch());
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
        if (e.key === 'Escape') modal.classList.add('hidden');
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
    input.addEventListener('input', () => renderSearchResults(input.value));
    function openSearch() { modal.classList.remove('hidden'); input.focus(); input.value = ''; renderSearchResults(''); }
}

function renderSearchResults(query) {
    const container = document.getElementById('search-results');
    if (!query) {
        container.innerHTML = `<div style="padding:18px;color:var(--text-faint);font-size:0.82rem;">Type to search assets, sections or topics...</div>`;
        return;
    }
    const q = query.toLowerCase();
    const matches = state.tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)).slice(0, 8);
    let html = '';
    matches.forEach(t => {
        const cc = t.change24h >= 0 ? 'positive-text' : 'negative-text';
        const liveTag = t._live ? ' 🟢' : '';
        html += `<div class="search-result-item" onclick="navigateTo('market-overview');document.getElementById('search-modal').classList.add('hidden')">
            <span class="result-icon">${t.icon || '💰'}</span>
            <div class="result-info"><div class="result-name">${t.symbol}${liveTag}</div><div class="result-meta">${t.name} • ${formatUSD(t.price)} • ${t.assetClass}</div></div>
            <span class="${cc}" style="font-family:var(--font-mono);font-size:0.78rem">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%</span>
        </div>`;
    });
    container.innerHTML = html || `<div style="padding:18px;color:var(--text-faint);font-size:0.82rem;">No results for "${query}"</div>`;
}

// ===================== TICKERS =====================
function updateTickers() {
    const gold = state.tokens.find(t => t.symbol === 'XAU/USD');
    const oil = state.tokens.find(t => t.symbol === 'WTI');
    const btc = state.tokens.find(t => t.symbol === 'BTC/USD');
    const sp = state.tokens.find(t => t.symbol === 'US500');
    setTicker('gold', gold); setTicker('oil', oil); setTicker('btc', btc); setTicker('us500', sp);

    const fng = state.fearGreedIndex;
    document.getElementById('fng-value').textContent = fng;
    const fngLabel = document.getElementById('fng-label');
    const label = fng <= 25 ? 'Extreme Fear' : fng <= 45 ? 'Fear' : fng <= 55 ? 'Neutral' : fng <= 75 ? 'Greed' : 'Extreme Greed';
    fngLabel.textContent = label;
    fngLabel.className = 'ticker-change ' + (fng >= 50 ? 'positive' : 'negative');
}

function setTicker(id, token) {
    document.getElementById('price-' + id).textContent = formatUSD(token.price);
    const changeEl = document.getElementById('change-' + id);
    changeEl.textContent = (token.change24h >= 0 ? '+' : '') + token.change24h.toFixed(2) + '%';
    changeEl.className = 'ticker-change ' + (token.change24h >= 0 ? 'positive' : 'negative');
}

// ===================== WHALE ALERTS =====================
function getScoreColor(score) {
    if (score >= 80) return 'var(--accent-bull)';
    if (score >= 60) return 'var(--accent-info)';
    if (score >= 40) return 'var(--accent-warn)';
    return 'var(--accent-bear)';
}

function getScoreLabel(score) {
    if (score >= 80) return 'Very High';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Moderate';
    return 'Low';
}

function renderAlertHTML(a) {
    const mktLabel = { commodities: '🥇 COMMODITY', indices: '📊 INDEX', equities: '📈 EQUITY', crypto: '₿ CRYPTO' }[a.market] || a.market;
    const isInst = a.market !== 'crypto';
    const profile = a.profile || {};
    const filing = a.filing || {};
    const sms = a.smartMoneyScore || randInt(30, 80);
    const smsColor = getScoreColor(sms);
    const smsLabel = getScoreLabel(sms);

    const sourceLink = a.sourceUrl
        ? `<a href="${a.sourceUrl}" target="_blank" rel="noopener" class="alert-source-link" title="Verify on ${a.sourceName}">${a.sourceIcon || '🔗'} ${a.sourceName}</a>`
        : '';
    
    // Filing badge
    const filingBadge = filing.type ? `<span class="filing-badge">${filing.type}</span>` : '';
    
    // CIK link
    const cikLink = filing.cik
        ? `<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filing.cik}&type=13F&dateb=&owner=include&count=10" target="_blank" rel="noopener" class="cik-link" title="SEC EDGAR Filings">🔗 CIK: ${filing.cik}</a>`
        : '';

    // Shares/contracts info
    const sharesInfo = filing.shares
        ? `${filing.shares.toLocaleString()} shares/contracts`
        : filing.blockNumber
        ? `Block #${filing.blockNumber.toLocaleString()} • ${filing.confirmations} confirmations`
        : '';

    // Filing line
    const filingLine = filing.type
        ? `<div class="alert-filing-line">📋 ${filing.type} • Filing: ${filing.date} ${cikLink} ${sharesInfo}</div>`
        : '';

    // Convergence signals
    const signalsHTML = (a.convergenceSignals || []).map(s => {
        const sentClass = s.sentiment === 'bullish' ? 'signal-bullish' : s.sentiment === 'bearish' ? 'signal-bearish' : 'signal-neutral';
        return `<span class="convergence-chip ${sentClass}" title="${s.detail}">${s.icon} ${s.label}</span>`;
    }).join('');

    const actionDesc = a.actionLabel || (isInst ? a.type.toUpperCase() + ' → ' + a.to : shortAddr(a.from) + ' → ' + shortAddr(a.to));
    const typeIcon = { buy: '🟢', sell: '🔴', position: '🔵', hedge: '🟠' }[a.type] || '⚪';

    return `<div class="alert-item" data-chain="${a.market}" data-impact="${a.impact}" data-id="${a.id}" onclick="toggleAlertExpand(this)">
        <div class="alert-main-row">
            <div class="alert-impact">${a.impact === 'high' ? '🔴' : a.impact === 'medium' ? '🟡' : '🟢'}</div>
            <div class="alert-info">
                <div class="alert-title">
                    <span class="amount">${formatUSD(a.amount)}</span> <span class="alert-token">${a.token}</span>
                    <span class="alert-chain-tag ${a.market}">${mktLabel}</span>
                    ${filingBadge}
                    ${sourceLink}
                </div>
                <div class="alert-entity-line">
                    <span class="entity-icon">${profile.icon || '🐋'}</span>
                    <span class="entity-name">${a.whaleName}</span>
                    <span class="entity-aum">AUM: ${formatUSD(profile.aum || 0)}</span>
                </div>
                <div class="alert-detail">
                    <span class="entity-ceo">👤 ${profile.ceo || 'Unknown'}</span>
                    <span class="alert-action">${a.type.toUpperCase()} → ${isInst ? (a.to || 'Rebalancing') : shortAddr(a.to || '')}</span>
                </div>
                ${filingLine}
            </div>
            <div class="alert-right">
                <div class="alert-time">${timeAgo(Date.now() - a.time)}</div>
                <span class="alert-type-tag ${a.type}">${a.type}</span>
                <div class="sms-mini" title="Smart Money Score: ${sms}/100 — ${smsLabel}">
                    <span class="sms-value" style="color:${smsColor}">⚡ ${sms}</span>
                    <div class="sms-bar-mini"><div class="sms-bar-fill-mini" style="width:${sms}%;background:${smsColor}"></div></div>
                </div>
                <span class="expand-arrow">▼</span>
            </div>
        </div>
        <div class="alert-expandable">
            <div class="alert-expand-content">
                <div class="insight-panel">
                    <div class="insight-header">💡 Smart Money Insight</div>
                    <p class="insight-text">${a.insight || ''}</p>
                </div>
                <div class="alert-expand-grid">
                    <div class="expand-section">
                        <div class="expand-section-title">Entity Profile</div>
                        <div class="profile-details">
                            <div class="profile-row"><span class="pf-label">CEO/Manager</span><span class="pf-value">${profile.ceo || 'N/A'}</span></div>
                            <div class="profile-row"><span class="pf-label">AUM</span><span class="pf-value">${formatUSD(profile.aum || 0)}</span></div>
                            <div class="profile-row"><span class="pf-label">Strategy</span><span class="pf-value">${profile.strategy || 'N/A'}</span></div>
                            <div class="profile-row"><span class="pf-label">Headquarters</span><span class="pf-value">${profile.hq || 'N/A'}</span></div>
                            <div class="profile-row"><span class="pf-label">Sector</span><span class="pf-value">${profile.sector || 'N/A'}</span></div>
                            <div class="profile-row"><span class="pf-label">Founded</span><span class="pf-value">${profile.founded || 'N/A'}</span></div>
                        </div>
                    </div>
                    <div class="expand-section">
                        <div class="expand-section-title">Track Record (90d)</div>
                        <div class="profile-details">
                            <div class="profile-row"><span class="pf-label">Win Rate</span><span class="pf-value ${(profile.track?.win || 0) >= 60 ? 'positive-text' : 'negative-text'}">${profile.track?.win || 0}%</span></div>
                            <div class="profile-row"><span class="pf-label">P&L (90d)</span><span class="pf-value ${(profile.track?.avg90d || 0) >= 0 ? 'positive-text' : 'negative-text'}">${(profile.track?.avg90d || 0) >= 0 ? '+' : ''}${profile.track?.avg90d || 0}%</span></div>
                            <div class="profile-row"><span class="pf-label">Total Trades</span><span class="pf-value">${(profile.track?.trades || 0).toLocaleString()}</span></div>
                            <div class="profile-row"><span class="pf-label">Reputation</span><span class="pf-value">${profile.reputation || 0}/100</span></div>
                        </div>
                    </div>
                    <div class="expand-section">
                        <div class="expand-section-title">Smart Money Score Breakdown</div>
                        <div class="sms-breakdown">
                            <div class="sms-component"><span>Reputation</span><div class="sms-comp-bar"><div style="width:${(a.smsComponents?.reputation || 0) * 4}%;background:var(--accent-primary)"></div></div><span>${a.smsComponents?.reputation || 0}/25</span></div>
                            <div class="sms-component"><span>Track Record</span><div class="sms-comp-bar"><div style="width:${(a.smsComponents?.trackRecord || 0) * 4}%;background:var(--accent-bull)"></div></div><span>${a.smsComponents?.trackRecord || 0}/25</span></div>
                            <div class="sms-component"><span>Conviction</span><div class="sms-comp-bar"><div style="width:${(a.smsComponents?.conviction || 0) * 5}%;background:var(--accent-warn)"></div></div><span>${a.smsComponents?.conviction || 0}/20</span></div>
                            <div class="sms-component"><span>Timing</span><div class="sms-comp-bar"><div style="width:${((a.smsComponents?.timing || 0) / 15) * 100}%;background:var(--accent-info)"></div></div><span>${a.smsComponents?.timing || 0}/15</span></div>
                            <div class="sms-component"><span>Diversification</span><div class="sms-comp-bar"><div style="width:${((a.smsComponents?.diversification || 0) / 15) * 100}%;background:var(--accent-cyan)"></div></div><span>${a.smsComponents?.diversification || 0}/15</span></div>
                        </div>
                        <div class="sms-total">Total Score: <strong style="color:${smsColor};font-size:1.2rem">${sms}</strong>/100 <span class="sms-label-tag" style="background:${smsColor}22;color:${smsColor}">${smsLabel}</span></div>
                    </div>
                </div>
                ${signalsHTML ? `<div class="convergence-row"><span class="convergence-title">🔄 Convergence Signals:</span>${signalsHTML}</div>` : ''}
                <div class="alert-action-row">
                    ${typeIcon} <span class="action-description">${actionDesc}</span>
                </div>
            </div>
        </div>
    </div>`;
}

function toggleAlertExpand(el) {
    el.classList.toggle('expanded');
}

function renderWhaleAlerts() {
    const feed = document.getElementById('alert-feed');
    feed.innerHTML = state.alerts.map(a => renderAlertHTML(a)).join('');
    document.getElementById('alert-count').textContent = state.alerts.length;
    document.getElementById('alert-chain-filter').onchange = document.getElementById('alert-impact-filter').onchange = filterAlerts;
    document.getElementById('alert-pause').onclick = () => {
        state.alertsPaused = !state.alertsPaused;
        document.getElementById('alert-pause').classList.toggle('active', state.alertsPaused);
    };
}

function filterAlerts() {
    const chain = document.getElementById('alert-chain-filter').value;
    const impact = document.getElementById('alert-impact-filter').value;
    document.querySelectorAll('.alert-item').forEach(item => {
        const mc = chain === 'all' || item.dataset.chain === chain;
        const mi = impact === 'all' || item.dataset.impact === impact;
        item.style.display = mc && mi ? '' : 'none';
    });
}

function updateAlertStats() {
    const last24h = state.alerts.filter(a => Date.now() - a.time < 86400000);
    document.getElementById('stat-total-txns').textContent = last24h.length;
    document.getElementById('stat-volume-moved').textContent = formatUSD(last24h.reduce((s, a) => s + a.amount, 0));
    document.getElementById('stat-largest-txn').textContent = formatUSD(Math.max(...last24h.map(a => a.amount), 0));
    document.getElementById('stat-active-whales').textContent = new Set(last24h.map(a => a.whaleName)).size;
}

// ===================== LEADERBOARD =====================
function renderLeaderboard() {
    const sortBy = document.getElementById('leaderboard-sort')?.value || 'pnl';
    const filterType = document.getElementById('leaderboard-filter')?.value || 'all';

    let entities = [...LEADERBOARD_ENTITIES];

    // Filter
    if (filterType !== 'all') {
        entities = entities.filter(e => e.type === filterType);
    }

    // Sort
    const sortMap = {
        pnl: (a, b) => b.pnl90d - a.pnl90d,
        winrate: (a, b) => b.winRate - a.winRate,
        volume: (a, b) => b.totalVol - a.totalVol,
        reputation: (a, b) => b.aum - a.aum,
    };
    entities.sort(sortMap[sortBy] || sortMap.pnl);

    const body = document.getElementById('leaderboard-body');
    if (!body) return;

    body.innerHTML = entities.map((e, i) => {
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const top3Class = rank <= 3 ? 'lb-top3' : '';
        const pnlClass = e.pnl90d >= 0 ? 'positive-text' : 'negative-text';
        const pnlSign = e.pnl90d >= 0 ? '+' : '';

        return `<div class="lb-row ${top3Class}">
            <div class="lb-rank"><span class="rank-medal">${medal}</span></div>
            <div class="lb-entity">
                <span class="lb-icon">${e.icon}</span>
                <div class="lb-entity-info">
                    <div class="lb-name">${e.name}</div>
                    <div class="lb-strategy">${e.strategy}</div>
                </div>
            </div>
            <div class="lb-stat">${formatUSD(e.aum)}</div>
            <div class="lb-stat">${e.winRate > 0 ? e.winRate + '%' : '—'}</div>
            <div class="lb-stat ${pnlClass}">${e.pnl90d !== 0 ? pnlSign + e.pnl90d.toFixed(1) + '%' : '—'}</div>
            <div class="lb-stat">${formatUSD(e.totalVol)}</div>
            <div class="lb-stat">${e.txCount.toLocaleString()}</div>
        </div>`;
    }).join('');
}

// ===================== MARKET OVERVIEW =====================
function renderMarketOverview() {
    renderHeatmap(); renderMarketTable(); setupMarketToggle();
    const gold = state.tokens.find(t => t.symbol === 'XAU/USD');
    const oil = state.tokens.find(t => t.symbol === 'WTI');
    const sp = state.tokens.find(t => t.symbol === 'US500');
    const btc = state.tokens.find(t => t.symbol === 'BTC/USD');
    document.getElementById('stat-gold-price').textContent = formatUSD(gold.price);
    document.getElementById('stat-oil-price').textContent = formatUSD(oil.price);
    document.getElementById('stat-sp500-price').textContent = formatUSD(sp.price);
    document.getElementById('stat-btc-price').textContent = formatUSD(btc.price);
}

function getHeatmapColor(change) {
    if (change > 8) return 'rgba(16, 185, 129, 0.65)';
    if (change > 5) return 'rgba(16, 185, 129, 0.45)';
    if (change > 2) return 'rgba(16, 185, 129, 0.25)';
    if (change > 0) return 'rgba(16, 185, 129, 0.12)';
    if (change > -2) return 'rgba(239, 68, 68, 0.12)';
    if (change > -5) return 'rgba(239, 68, 68, 0.25)';
    if (change > -8) return 'rgba(239, 68, 68, 0.45)';
    return 'rgba(239, 68, 68, 0.65)';
}

function renderHeatmap() {
    document.getElementById('market-heatmap').innerHTML = state.tokens.map(t => {
        const bg = getHeatmapColor(t.change24h);
        const tc = Math.abs(t.change24h) > 5 ? 'white' : 'var(--text-primary)';
        const liveIndicator = t._live ? '🟢 ' : '';
        return `<div class="heatmap-cell" style="background:${bg};color:${tc}" title="${t.name} (${t.assetClass}): ${formatUSD(t.price)}${t._live ? ' [LIVE]' : ' [DEMO]'}">
            <span class="cell-symbol">${liveIndicator}${t.icon || ''} ${t.symbol}</span>
            <span class="cell-change">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%</span>
            <span class="cell-price">${formatUSD(t.price)}</span>
        </div>`;
    }).join('');
}

function renderMarketTable() {
    document.getElementById('market-table-body').innerHTML = state.tokens.map((t, i) => {
        const c24 = t.change24h >= 0 ? 'positive-text' : 'negative-text';
        const c7d = t.change7d >= 0 ? 'positive-text' : 'negative-text';
        const liveTag = t._live ? ' 🟢' : '';
        return `<tr>
            <td>${i + 1}</td>
            <td><div class="asset-cell"><span class="asset-symbol">${t.icon || ''} ${t.symbol}${liveTag}</span><span class="asset-name">${t.name}</span></div></td>
            <td>${formatUSD(t.price)}</td>
            <td class="${c24}">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%</td>
            <td class="${c7d}">${t.change7d >= 0 ? '+' : ''}${t.change7d.toFixed(2)}%</td>
            <td>${t.assetClass}</td>
            <td>${formatUSD(t._vol24h || (t.mcap > 0 ? t.mcap * rand(0.02, 0.08) : rand(1e8, 5e9)))}</td>
            <td><canvas class="sparkline-canvas" data-idx="${i}"></canvas></td>
        </tr>`;
    }).join('');

    document.querySelectorAll('.sparkline-canvas').forEach(canvas => {
        const idx = parseInt(canvas.dataset.idx);
        const data = generateSparkline(24, 100, 8);
        const ctx = canvas.getContext('2d');
        canvas.width = 80; canvas.height = 30;
        const max = Math.max(...data), min = Math.min(...data);
        ctx.strokeStyle = state.tokens[idx].change24h >= 0 ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        data.forEach((v, j) => {
            const x = (j / (data.length - 1)) * 80;
            const y = 28 - ((v - min) / (max - min || 1)) * 26;
            j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    });
}

function setupMarketToggle() {
    document.querySelectorAll('#market-view-toggle .view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#market-view-toggle .view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.view;
            document.getElementById('market-heatmap').classList.toggle('hidden', view !== 'heatmap');
            document.getElementById('market-table-container').classList.toggle('hidden', view !== 'table');
        });
    });
}

// ===================== VOLUME SCANNER =====================
function renderVolumeScanner() {
    const grid = document.getElementById('volume-scanner-grid');
    const volumeData = state.tokens.map(t => {
        const spike = rand(0.5, 8);
        const vol24h = t._vol24h || (t.mcap > 0 ? t.mcap * rand(0.02, 0.1) : rand(1e8, 5e9));
        return { ...t, spike, vol24h, avg7d: vol24h / spike };
    }).sort((a, b) => b.spike - a.spike);

    grid.innerHTML = volumeData.map(v => {
        const sc = v.spike >= 3 ? 'high' : v.spike >= 2 ? 'medium' : 'low';
        return `<div class="volume-card spike-${sc}" onclick="selectVolumeAsset('${v.symbol}')">
            <div class="volume-card-header">
                <span class="volume-asset">${v.icon || ''} ${v.symbol}</span>
                <span class="volume-spike-badge ${sc}">${v.spike.toFixed(1)}x</span>
            </div>
            <div class="volume-card-body">
                <div class="volume-stat"><span class="volume-stat-label">Vol 24h</span><span class="volume-stat-value">${formatUSD(v.vol24h)}</span></div>
                <div class="volume-stat"><span class="volume-stat-label">7d Avg</span><span class="volume-stat-value">${formatUSD(v.avg7d)}</span></div>
                <div class="volume-stat"><span class="volume-stat-label">Price</span><span class="volume-stat-value">${formatUSD(v.price)}</span></div>
                <div class="volume-stat"><span class="volume-stat-label">24h Chg</span><span class="volume-stat-value ${v.change24h >= 0 ? 'positive-text' : 'negative-text'}">${v.change24h >= 0 ? '+' : ''}${v.change24h.toFixed(2)}%</span></div>
            </div>
        </div>`;
    }).join('');
}

function selectVolumeAsset(symbol) {
    const container = document.getElementById('volume-chart-container');
    document.querySelectorAll('.volume-card').forEach(c => c.classList.remove('selected'));
    const clicked = [...document.querySelectorAll('.volume-card')].find(c => c.querySelector('.volume-asset').textContent.includes(symbol));
    if (clicked) clicked.classList.add('selected');
    container.innerHTML = '';
    const chartDiv = document.createElement('div');
    chartDiv.style.cssText = 'width:100%;height:300px';
    container.appendChild(chartDiv);
    try {
        const chart = LightweightCharts.createChart(chartDiv, {
            width: chartDiv.clientWidth, height: 300,
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: 'rgba(148,163,184,0.05)' }, horzLines: { color: 'rgba(148,163,184,0.05)' } },
            timeScale: { borderColor: 'rgba(148,163,184,0.1)' }, rightPriceScale: { borderColor: 'rgba(148,163,184,0.1)' },
        });
        const vs = chart.addHistogramSeries({ color: '#6366f1', priceFormat: { type: 'volume' } });
        const now = Math.floor(Date.now() / 1000);
        const data = [];
        for (let i = 30; i >= 0; i--) { data.push({ time: now - i * 86400, value: rand(1e6, 1e8), color: i < 3 ? '#ef4444' : '#6366f1' }); }
        vs.setData(data);
        chart.timeScale().fitContent();
        new ResizeObserver(() => chart.applyOptions({ width: chartDiv.clientWidth })).observe(chartDiv);
    } catch(e) {
        container.innerHTML = `<div class="empty-state small"><p>Loading chart...</p></div>`;
    }
}

// ===================== WALLET TRACKER =====================
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            const btn = document.getElementById('wallet-search-btn');
            const inp = document.getElementById('wallet-search-input');
            if (btn) btn.addEventListener('click', () => trackWallet(inp.value));
            if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') trackWallet(inp.value); });
            document.querySelectorAll('.sample-wallet-btn').forEach(b => b.addEventListener('click', () => trackWallet(b.dataset.address)));
        }, 3000);
    });
})();

function trackWallet(address) {
    if (!address || address.length < 5) return;
    const es = document.getElementById('wallet-empty-state');
    if (es) es.style.display = 'none';
    const isCrypto = address.startsWith('0x');
    const wallet = {
        address,
        name: isCrypto ? randEl(['Crypto Whale Alpha', 'Deep Wallet', 'Crypto Giant']) : address.replace(/-/g, ' '),
        icon: isCrypto ? '🐋' : '🏦',
        totalValue: rand(5000000, 500000000),
        pnl: rand(-15, 45),
        holdings: isCrypto
            ? state.tokens.filter(t => t.market === 'crypto').map(t => ({ symbol: t.symbol, value: rand(100000, 20000000), pct: rand(5, 40) }))
            : [
                ...state.tokens.filter(t => t.market === 'equities').slice(0, randInt(3,6)).map(t => ({ symbol: t.symbol, value: rand(5e6, 1e8), pct: rand(5, 25) })),
                { symbol: 'XAU/USD', value: rand(1e7, 5e7), pct: rand(10, 30) },
                { symbol: 'WTI', value: rand(5e6, 2e7), pct: rand(5, 15) },
                { symbol: 'Treasuries', value: rand(2e7, 1e8), pct: rand(15, 40) },
            ]
    };
    const container = document.getElementById('tracked-wallets');
    const card = document.createElement('div');
    card.className = 'wallet-card';
    const pc = wallet.pnl >= 0 ? 'positive-text' : 'negative-text';
    card.innerHTML = `
        <div class="wallet-card-header">
            <div class="wallet-identity">
                <div class="wallet-avatar">${wallet.icon}</div>
                <div><div class="wallet-name">${wallet.name}</div><div class="wallet-address">${shortAddr(wallet.address)}</div></div>
            </div>
            <div class="wallet-balance">
                <div class="wallet-total">${formatUSD(wallet.totalValue)}</div>
                <div class="wallet-pnl ${pc}">${wallet.pnl >= 0 ? '+' : ''}${wallet.pnl.toFixed(2)}% PnL</div>
            </div>
        </div>
        <div class="wallet-holdings">
            ${wallet.holdings.map(h => `<div class="holding-item"><div class="holding-symbol">${h.symbol}</div><div class="holding-value">${formatUSD(h.value)}</div><div class="holding-pct">${h.pct.toFixed(1)}%</div></div>`).join('')}
        </div>`;
    container.insertBefore(card, container.firstChild);
    document.getElementById('wallet-search-input').value = '';
    showToast('🔍', `Tracking ${wallet.name}`, 'whale');
}

// ===================== COHORT ANALYSIS =====================
function renderCohortAnalysis() {
    const tiers = [
        { id: 'megalodon', count: randInt(50, 200), longPct: rand(55, 80) },
        { id: 'whale', count: randInt(500, 2000), longPct: rand(45, 70) },
        { id: 'dolphin', count: randInt(5000, 20000), longPct: rand(40, 65) },
        { id: 'fish', count: randInt(50000, 200000), longPct: rand(35, 60) },
        { id: 'shrimp', count: randInt(500000, 2000000), longPct: rand(30, 55) },
    ];
    tiers.forEach(t => {
        document.getElementById(t.id + '-count').textContent = t.count.toLocaleString();
        document.getElementById(t.id + '-position').textContent = t.longPct > 50 ? '📈 NET LONG' : '📉 NET SHORT';
        document.getElementById(t.id + '-long').style.width = t.longPct + '%';
        document.getElementById(t.id + '-short').style.width = (100 - t.longPct) + '%';
        document.getElementById(t.id + '-long-pct').textContent = t.longPct.toFixed(0) + '% Long';
        document.getElementById(t.id + '-short-pct').textContent = (100 - t.longPct).toFixed(0) + '% Short';
    });

    try {
        const ctx = document.getElementById('cohort-timeline-chart');
        if (ctx && window.Chart) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 30}, (_, i) => `Day ${i+1}`),
                    datasets: [
                        { label: 'Institutional', data: generateSparkline(30, 70, 5), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true, tension: 0.4 },
                        { label: 'Whale', data: generateSparkline(30, 60, 4), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', fill: true, tension: 0.4 },
                        { label: 'Dolphin', data: generateSparkline(30, 55, 6), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.4 },
                        { label: 'Fish', data: generateSparkline(30, 50, 7), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.4 },
                        { label: 'Retail', data: generateSparkline(30, 45, 8), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', fill: true, tension: 0.4 },
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } } },
                    scales: {
                        x: { ticks: { color: '#475569', maxTicksLimit: 10 }, grid: { color: 'rgba(148,163,184,0.05)' } },
                        y: { ticks: { color: '#475569', callback: v => v + '% Long' }, grid: { color: 'rgba(148,163,184,0.05)' }, min: 20, max: 90 }
                    }
                }
            });
        }
    } catch(e) {}
}

// ===================== COMMUNITY INTEL =====================
function renderCommunityIntel() {
    const sentiments = state.posts.map(p => p.sentimentScore);
    const avg = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    document.getElementById('stat-sentiment').textContent = avg > 0.15 ? '🟢 Bullish' : avg < -0.15 ? '🔴 Bearish' : '🟡 Neutral';
    document.getElementById('stat-posts-count').textContent = state.posts.length.toLocaleString();
    document.getElementById('stat-trending').textContent = randEl(TOPICS);
    document.getElementById('stat-fear').textContent = state.fearGreedIndex + '/100';

    document.getElementById('sentiment-heatmap').innerHTML = state.tokens.map(t => {
        const score = rand(-1, 1);
        const bg = score > 0.3 ? 'rgba(16,185,129,0.2)' : score < -0.3 ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.08)';
        const label = score > 0.3 ? 'Bullish' : score < -0.3 ? 'Bearish' : 'Neutral';
        return `<div class="sentiment-cell" style="background:${bg}">
            <span class="sent-symbol">${t.icon || ''} ${t.symbol}</span>
            <span class="sent-score">${(score * 100).toFixed(0)}</span>
            <span class="sent-label">${label}</span>
        </div>`;
    }).join('');

    document.getElementById('word-cloud').innerHTML = TOPICS.map(topic => {
        const size = rand(0.7, 1.6);
        const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#818cf8', '#34d399', '#60a5fa', '#06b6d4', '#8b5cf6'];
        return `<span class="cloud-word" style="font-size:${size}rem;color:${randEl(colors)}">${topic}</span>`;
    }).join('');

    document.getElementById('community-posts').innerHTML = state.posts.map(p => `
        <div class="post-item">
            <div class="post-sentiment-indicator ${p.sentiment}"></div>
            <div class="post-info">
                <div class="post-title-text">${p.title}</div>
                <div class="post-meta">
                    <span class="post-subreddit">r/${p.subreddit}</span>
                    <span>${p.author}</span>
                    <span>${timeAgo(Date.now() - p.time)}</span>
                    <span>💬 ${p.comments}</span>
                </div>
            </div>
            <div class="post-score"><span class="score-value">⬆ ${p.upvotes}</span><span class="${p.sentiment === 'positive' ? 'positive-text' : p.sentiment === 'negative' ? 'negative-text' : ''}">${(p.sentimentScore * 100).toFixed(0)}%</span></div>
        </div>
    `).join('');
}

// ===================== DATA SOURCES =====================
function renderDataSources() {
    document.getElementById('sources-grid').innerHTML = DATA_SOURCES.map(s => `
        <div class="source-card">
            <div class="source-card-header">
                <div class="source-icon">${s.icon}</div>
                <div>
                    <div class="source-name">${s.name}</div>
                    <div class="source-type">${s.type}</div>
                </div>
            </div>
            <div class="source-desc">${s.desc}</div>
            <div class="source-tags">${s.tags.map(t => `<span class="source-tag">${t}</span>`).join('')}</div>
            <a href="${s.url}" target="_blank" rel="noopener" class="source-link">🔗 Visit Source</a>
            <div class="source-status">
                <span class="source-status-dot ${s.status}"></span>
                <span>${s.status === 'active' ? 'Integrated' : 'Planned'}</span>
            </div>
        </div>
    `).join('');
}

// ===================== SETTINGS =====================
function setupSettings() {
    document.getElementById('save-api-keys')?.addEventListener('click', async () => {
        const keys = {
            finnhub: document.getElementById('api-finnhub')?.value || '',
            coingecko: document.getElementById('api-coingecko')?.value || '',
            etherscan: document.getElementById('api-etherscan')?.value || '',
        };
        localStorage.setItem('whalevault_api_keys', JSON.stringify(keys));
        showToast('🔄', 'Saving keys and connecting...', 'whale');
        LiveData.cache = {};
        LiveData.isLive = { crypto: false, stocks: false };
        const updated = await LiveData.syncAll();
        if (updated > 0) {
            showToast('✅', `Connected! ${updated} assets with live prices.`, 'bull');
            updateTickers();
            renderHeatmap();
            renderMarketTable();
            renderMarketOverview();
        } else {
            showToast('⚠️', 'Please check your API keys.', 'alert');
        }
    });

    document.getElementById('clear-cache')?.addEventListener('click', () => {
        localStorage.removeItem('whalevault_cache');
        LiveData.cache = {};
        document.getElementById('cache-size').textContent = '0 KB';
        showToast('🗑️', 'Cache cleared', 'alert');
    });

    document.getElementById('export-data')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ alerts: state.alerts, tokens: state.tokens, posts: state.posts }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'whalevault_export.json'; a.click();
        showToast('📥', 'Data exported', 'whale');
    });

    // Load saved keys
    try {
        const saved = JSON.parse(localStorage.getItem('whalevault_api_keys') || '{}');
        if (saved.finnhub) { const el = document.getElementById('api-finnhub'); if (el) el.value = saved.finnhub; }
        if (saved.coingecko) { const el = document.getElementById('api-coingecko'); if (el) el.value = saved.coingecko; }
        if (saved.etherscan) { const el = document.getElementById('api-etherscan'); if (el) el.value = saved.etherscan; }
    } catch(e) {}

    let total = 0;
    for (let key in localStorage) { if (key.startsWith('whalevault')) total += (localStorage[key] || '').length; }
    document.getElementById('cache-size').textContent = (total / 1024).toFixed(1) + ' KB';
}

// ===================== TOAST =====================
function showToast(icon, message, type = 'whale') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// ===================== LIVE UPDATES =====================
function startLiveUpdates() {
    // Whale alert simulation
    setInterval(() => {
        if (state.alertsPaused) return;
        const alert = generateWhaleAlert();
        alert.time = Date.now();
        state.alerts.unshift(alert);
        if (state.alerts.length > 100) state.alerts.pop();
        if (state.currentSection === 'whale-alerts') {
            const feed = document.getElementById('alert-feed');
            const div = document.createElement('div');
            div.innerHTML = renderAlertHTML(alert);
            const newItem = div.firstElementChild;
            newItem.classList.add('new-alert');
            feed.insertBefore(newItem, feed.firstElementChild);
        }
        document.getElementById('alert-count').textContent = state.alerts.length;
        updateAlertStats();
        if (alert.impact === 'high') showToast('🐋', `${formatUSD(alert.amount)} ${alert.token} ${alert.type} detected!`, 'bear');
    }, randInt(5000, 12000));

    // LIVE DATA SYNC: every 60 seconds
    setInterval(async () => {
        const updated = await LiveData.syncAll();
        if (updated > 0) {
            updateTickers();
            if (state.currentSection === 'market-overview') {
                renderHeatmap();
                renderMarketOverview();
            }
            const now = new Date();
            document.getElementById('last-update').textContent = `Last update: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        }
    }, 60000);

    // Demo mode drift for non-live tokens
    setInterval(() => {
        state.tokens.forEach(t => {
            if (!t._live) {
                t.price *= (1 + rand(-0.002, 0.002));
                t.change24h += rand(-0.05, 0.05);
            }
        });
        updateTickers();
        if (!LiveData.isLive.crypto && !LiveData.isLive.stocks) {
            state.fearGreedIndex = Math.max(5, Math.min(95, state.fearGreedIndex + randInt(-1, 2)));
        }
    }, 5000);
}
