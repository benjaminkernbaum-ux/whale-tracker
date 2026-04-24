// ============================================================
// WHALEVAULT v6.0 — Global Equity Intelligence Terminal
// Markets: S&P500, NASDAQ, DOW, RUT, DAX, CAC40, FTSE, HK50, NI225
// Equities: Magnificent 7 + 20 Major Stocks
// Sources: SEC EDGAR, BaFin, AMF, FCA, EDINET, HKEX, CFTC
// APIs: Finnhub (stocks/indices)
// ============================================================

// ===================== LIVE DATA MANAGER =====================
const LiveData = {
    finnhubMap: {
        // Indices via ETFs
        'US500': 'SPY', 'US100': 'QQQ', 'US30': 'DIA', 'RUT': 'IWM',
        'DAX': 'EWG', 'CAC40': 'EWQ', 'FTSE': 'EWU', 'HK50': 'EWH', 'NI225': 'EWJ',
        // Magnificent 7
        'AAPL':'AAPL','MSFT':'MSFT','NVDA':'NVDA','TSLA':'TSLA',
        'AMZN':'AMZN','META':'META','GOOGL':'GOOGL',
        // Major US Equities
        'JPM':'JPM','GS':'GS','BAC':'BAC','MS':'MS',
        'JNJ':'JNJ','UNH':'UNH','PFE':'PFE',
        'XOM':'XOM','CVX':'CVX',
        'WMT':'WMT','KO':'KO','PG':'PG',
        'BA':'BA','CAT':'CAT','GE':'GE','V':'V',
    },
    indexMultiplier: {
        'US500': 10.1, 'US30': 97.5, 'US100': 49.0, 'RUT': 9.2,
        'HK50': 720, 'DAX': 625, 'CAC40': 280, 'FTSE': 274, 'NI225': 530,
    },
    cache: {},
    CACHE_TTL: 30000,
    isLive: { stocks: false },

    getApiKeys() {
        try { return JSON.parse(localStorage.getItem('whalevault_api_keys') || '{}'); }
        catch { return {}; }
    },

    isCached(key) {
        return this.cache[key] && (Date.now() - this.cache[key].ts < this.CACHE_TTL);
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

        // Stocks/Indices via Finnhub
        const keys = this.getApiKeys();
        if (keys.finnhub) {
            const allTokens = state.tokens;
            for (let i = 0; i < allTokens.length; i++) {
                const token = allTokens[i];
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
                if (i < allTokens.length - 1) await new Promise(r => setTimeout(r, 80));
            }
        }

        // 3. Fear & Greed
        const fng = await this.fetchFearGreed();
        if (fng !== null) state.fearGreedIndex = fng;

        // Update mode badge
        const badge = document.getElementById('mode-badge');
        const label = badge.querySelector('.mode-label');
        if (this.isLive.stocks) {
            label.textContent = '🟢 LIVE';
            badge.style.background = 'rgba(16,185,129,0.1)';
            badge.style.borderColor = 'rgba(16,185,129,0.2)';
            badge.style.color = '#10b981';
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
    // INDICES — Americas
    { symbol: 'US500', name: 'S&P 500', price: 5580.25, mcap: 0, change24h: 0.45, change7d: 1.23, assetClass: 'Index', market: 'indices', region: 'us', icon: '🇺🇸' },
    { symbol: 'US100', name: 'NASDAQ 100', price: 19420.80, mcap: 0, change24h: -0.34, change7d: 2.15, assetClass: 'Index', market: 'indices', region: 'us', icon: '🇺🇸' },
    { symbol: 'US30', name: 'Dow Jones 30', price: 41890.50, mcap: 0, change24h: 0.62, change7d: 0.89, assetClass: 'Index', market: 'indices', region: 'us', icon: '🇺🇸' },
    { symbol: 'RUT', name: 'Russell 2000', price: 2045.30, mcap: 0, change24h: -1.12, change7d: -2.50, assetClass: 'Index', market: 'indices', region: 'us', icon: '🇺🇸' },
    // INDICES — Europe
    { symbol: 'DAX', name: 'DAX 40', price: 22580.30, mcap: 0, change24h: -0.23, change7d: 1.45, assetClass: 'Index', market: 'indices', region: 'eu', icon: '🇩🇪' },
    { symbol: 'CAC40', name: 'CAC 40', price: 7880.60, mcap: 0, change24h: 0.56, change7d: 0.90, assetClass: 'Index', market: 'indices', region: 'eu', icon: '🇫🇷' },
    { symbol: 'FTSE', name: 'FTSE 100', price: 8650.70, mcap: 0, change24h: 0.15, change7d: 0.67, assetClass: 'Index', market: 'indices', region: 'eu', icon: '🇬🇧' },
    // INDICES — Asia
    { symbol: 'HK50', name: 'Hang Seng 50', price: 23150.40, mcap: 0, change24h: 1.89, change7d: 4.56, assetClass: 'Index', market: 'indices', region: 'asia', icon: '🇭🇰' },
    { symbol: 'NI225', name: 'Nikkei 225', price: 37240.10, mcap: 0, change24h: -1.12, change7d: -2.30, assetClass: 'Index', market: 'indices', region: 'asia', icon: '🇯🇵' },

    // MAGNIFICENT 7
    { symbol: 'AAPL', name: 'Apple', price: 217.90, mcap: 3340e9, change24h: 0.67, change7d: 2.34, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🍎', sector: 'Tech' },
    { symbol: 'MSFT', name: 'Microsoft', price: 420.50, mcap: 3120e9, change24h: 1.23, change7d: 3.45, assetClass: 'Equity', market: 'equities', region: 'us', icon: '💻', sector: 'Tech' },
    { symbol: 'NVDA', name: 'NVIDIA', price: 112.80, mcap: 2750e9, change24h: -2.15, change7d: -5.30, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🎮', sector: 'Semiconductors' },
    { symbol: 'GOOGL', name: 'Alphabet', price: 163.70, mcap: 2010e9, change24h: 0.34, change7d: 1.89, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🔍', sector: 'Tech' },
    { symbol: 'AMZN', name: 'Amazon', price: 198.30, mcap: 2050e9, change24h: 0.89, change7d: 1.56, assetClass: 'Equity', market: 'equities', region: 'us', icon: '📦', sector: 'Consumer/Cloud' },
    { symbol: 'META', name: 'Meta Platforms', price: 585.20, mcap: 1480e9, change24h: -0.56, change7d: 2.10, assetClass: 'Equity', market: 'equities', region: 'us', icon: '👤', sector: 'Tech' },
    { symbol: 'TSLA', name: 'Tesla', price: 268.40, mcap: 855e9, change24h: 3.45, change7d: 8.90, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🚗', sector: 'EV/Energy' },

    // MAJOR US EQUITIES
    { symbol: 'JPM', name: 'JP Morgan', price: 245.80, mcap: 710e9, change24h: 0.78, change7d: 3.20, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🏦', sector: 'Banking' },
    { symbol: 'GS', name: 'Goldman Sachs', price: 540.30, mcap: 178e9, change24h: -0.45, change7d: 1.23, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🏦', sector: 'Banking' },
    { symbol: 'BAC', name: 'Bank of America', price: 42.80, mcap: 340e9, change24h: 0.90, change7d: 2.10, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🏦', sector: 'Banking' },
    { symbol: 'MS', name: 'Morgan Stanley', price: 108.50, mcap: 175e9, change24h: 0.55, change7d: 1.80, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🏦', sector: 'Banking' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', price: 162.40, mcap: 390e9, change24h: -0.20, change7d: 0.45, assetClass: 'Equity', market: 'equities', region: 'us', icon: '💊', sector: 'Healthcare' },
    { symbol: 'UNH', name: 'UnitedHealth', price: 520.30, mcap: 480e9, change24h: 0.34, change7d: 1.20, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🏥', sector: 'Healthcare' },
    { symbol: 'PFE', name: 'Pfizer', price: 28.90, mcap: 163e9, change24h: -1.20, change7d: -3.40, assetClass: 'Equity', market: 'equities', region: 'us', icon: '💉', sector: 'Pharma' },
    { symbol: 'XOM', name: 'ExxonMobil', price: 118.60, mcap: 498e9, change24h: 0.45, change7d: 2.30, assetClass: 'Equity', market: 'equities', region: 'us', icon: '⛽', sector: 'Energy' },
    { symbol: 'CVX', name: 'Chevron', price: 162.80, mcap: 305e9, change24h: -0.30, change7d: 1.10, assetClass: 'Equity', market: 'equities', region: 'us', icon: '⛽', sector: 'Energy' },
    { symbol: 'WMT', name: 'Walmart', price: 78.50, mcap: 632e9, change24h: 0.22, change7d: 0.80, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🛒', sector: 'Consumer' },
    { symbol: 'KO', name: 'Coca-Cola', price: 62.40, mcap: 270e9, change24h: 0.10, change7d: 0.50, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🥤', sector: 'Consumer' },
    { symbol: 'PG', name: 'Procter & Gamble', price: 170.20, mcap: 401e9, change24h: -0.15, change7d: 0.65, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🧴', sector: 'Consumer' },
    { symbol: 'BA', name: 'Boeing', price: 178.90, mcap: 111e9, change24h: -1.80, change7d: -4.20, assetClass: 'Equity', market: 'equities', region: 'us', icon: '✈️', sector: 'Industrial' },
    { symbol: 'CAT', name: 'Caterpillar', price: 365.40, mcap: 178e9, change24h: 0.90, change7d: 3.50, assetClass: 'Equity', market: 'equities', region: 'us', icon: '🚜', sector: 'Industrial' },
    { symbol: 'GE', name: 'GE Aerospace', price: 185.60, mcap: 202e9, change24h: 0.45, change7d: 2.10, assetClass: 'Equity', market: 'equities', region: 'us', icon: '⚙️', sector: 'Industrial' },
    { symbol: 'V', name: 'Visa', price: 298.70, mcap: 600e9, change24h: 0.35, change7d: 1.40, assetClass: 'Equity', market: 'equities', region: 'us', icon: '💳', sector: 'FinTech' },

];

// ===================== ENTITY DATA — 30+ Institutions =====================
const ENTITY_PROFILES = {
    // US Asset Managers & Hedge Funds
    'BlackRock': { ceo: 'Larry Fink', aum: 10500e9, strategy: 'Multi-Asset', cik: '1364742', type: 'institutional', region: 'us', icon: '🏛️', reputation: 95, founded: 1988, hq: 'New York, NY', sector: 'Asset Management', regulator: 'sec', track: { win: 72, avg90d: 8.4, trades: 2340 } },
    'Vanguard': { ceo: 'Tim Buckley', aum: 8600e9, strategy: 'Index/Passive', cik: '102909', type: 'institutional', region: 'us', icon: '🏛️', reputation: 88, founded: 1975, hq: 'Malvern, PA', sector: 'Asset Management', regulator: 'sec', track: { win: 64, avg90d: 4.2, trades: 1200 } },
    'State Street': { ceo: 'Ron O\'Hanley', aum: 4100e9, strategy: 'Index/ETF', cik: '93751', type: 'institutional', region: 'us', icon: '🏛️', reputation: 86, founded: 1792, hq: 'Boston, MA', sector: 'Asset Management', regulator: 'sec', track: { win: 62, avg90d: 3.8, trades: 980 } },
    'Fidelity': { ceo: 'Abigail Johnson', aum: 4500e9, strategy: 'Active/Index', cik: '315066', type: 'institutional', region: 'us', icon: '🏛️', reputation: 87, founded: 1946, hq: 'Boston, MA', sector: 'Asset Management', regulator: 'sec', track: { win: 66, avg90d: 5.1, trades: 1560 } },
    'Bridgewater Associates': { ceo: 'Ray Dalio', aum: 124e9, strategy: 'Global Macro', cik: '1350694', type: 'institutional', region: 'us', icon: '🏛️', reputation: 92, founded: 1975, hq: 'Westport, CT', sector: 'Hedge Fund', regulator: 'sec', track: { win: 68, avg90d: 12.1, trades: 890 } },
    'Citadel': { ceo: 'Ken Griffin', aum: 62e9, strategy: 'Quant/Market Making', cik: '1423053', type: 'institutional', region: 'us', icon: '🏛️', reputation: 94, founded: 1990, hq: 'Miami, FL', sector: 'Hedge Fund', regulator: 'sec', track: { win: 78, avg90d: 15.3, trades: 12450 } },
    'Renaissance Technologies': { ceo: 'Peter Brown', aum: 106e9, strategy: 'Quantitative', cik: '1037389', type: 'institutional', region: 'us', icon: '🏛️', reputation: 98, founded: 1982, hq: 'East Setauket, NY', sector: 'Hedge Fund', regulator: 'sec', track: { win: 82, avg90d: 18.7, trades: 8900 } },
    'Goldman Sachs AM': { ceo: 'David Solomon', aum: 2800e9, strategy: 'Multi-Strategy', cik: '886982', type: 'institutional', region: 'us', icon: '🏦', reputation: 90, founded: 1869, hq: 'New York, NY', sector: 'Investment Bank', regulator: 'sec', track: { win: 70, avg90d: 9.2, trades: 15800 } },
    'JP Morgan AM': { ceo: 'Jamie Dimon', aum: 3000e9, strategy: 'Multi-Asset', cik: '19617', type: 'institutional', region: 'us', icon: '🏦', reputation: 91, founded: 2000, hq: 'New York, NY', sector: 'Investment Bank', regulator: 'sec', track: { win: 71, avg90d: 7.8, trades: 9200 } },
    'Berkshire Hathaway': { ceo: 'Warren Buffett', aum: 370e9, strategy: 'Value Investing', cik: '1067983', type: 'institutional', region: 'us', icon: '🏛️', reputation: 97, founded: 1965, hq: 'Omaha, NE', sector: 'Conglomerate', regulator: 'sec', track: { win: 71, avg90d: 5.8, trades: 156 } },
    'Two Sigma': { ceo: 'John Overdeck', aum: 60e9, strategy: 'Systematic/AI', cik: '1479506', type: 'institutional', region: 'us', icon: '🏛️', reputation: 91, founded: 2001, hq: 'New York, NY', sector: 'Hedge Fund', regulator: 'sec', track: { win: 71, avg90d: 9.8, trades: 5600 } },
    'D.E. Shaw': { ceo: 'David Shaw', aum: 55e9, strategy: 'Multi-Strategy', cik: '1009207', type: 'institutional', region: 'us', icon: '🏛️', reputation: 90, founded: 1988, hq: 'New York, NY', sector: 'Hedge Fund', regulator: 'sec', track: { win: 74, avg90d: 11.2, trades: 4200 } },
    'Millennium Management': { ceo: 'Israel Englander', aum: 59e9, strategy: 'Multi-Manager', cik: '1273087', type: 'institutional', region: 'us', icon: '🏛️', reputation: 88, founded: 1989, hq: 'New York, NY', sector: 'Hedge Fund', regulator: 'sec', track: { win: 69, avg90d: 7.6, trades: 6700 } },
    'Point72': { ceo: 'Steve Cohen', aum: 27e9, strategy: 'Discretionary/Quant', cik: '1603466', type: 'institutional', region: 'us', icon: '🏛️', reputation: 86, founded: 2014, hq: 'Stamford, CT', sector: 'Hedge Fund', regulator: 'sec', track: { win: 66, avg90d: 6.4, trades: 3100 } },
    'Soros Fund Management': { ceo: 'George Soros', aum: 28e9, strategy: 'Global Macro', cik: '1029160', type: 'institutional', region: 'us', icon: '🏛️', reputation: 96, founded: 1970, hq: 'New York, NY', sector: 'Family Office', regulator: 'sec', track: { win: 73, avg90d: 14.5, trades: 540 } },
    'PIMCO': { ceo: 'Emmanuel Roman', aum: 1740e9, strategy: 'Fixed Income/Macro', cik: '811830', type: 'institutional', region: 'us', icon: '🏛️', reputation: 87, founded: 1971, hq: 'Newport Beach, CA', sector: 'Asset Management', regulator: 'sec', track: { win: 63, avg90d: 3.9, trades: 760 } },
    'AQR Capital': { ceo: 'Cliff Asness', aum: 98e9, strategy: 'Systematic/Factor', cik: '1167557', type: 'institutional', region: 'us', icon: '🏛️', reputation: 85, founded: 1998, hq: 'Greenwich, CT', sector: 'Hedge Fund', regulator: 'sec', track: { win: 67, avg90d: 8.0, trades: 2400 } },
    'Pershing Square': { ceo: 'Bill Ackman', aum: 18e9, strategy: 'Activist/Concentrated', cik: '1336528', type: 'institutional', region: 'us', icon: '🏛️', reputation: 84, founded: 2004, hq: 'New York, NY', sector: 'Hedge Fund', regulator: 'sec', track: { win: 62, avg90d: 7.3, trades: 95 } },
    'Tiger Global': { ceo: 'Chase Coleman', aum: 20e9, strategy: 'Growth/Tech', cik: '1167483', type: 'institutional', region: 'us', icon: '🏛️', reputation: 82, founded: 2001, hq: 'New York, NY', sector: 'Hedge Fund', regulator: 'sec', track: { win: 59, avg90d: -3.2, trades: 1890 } },
    'Capital Group': { ceo: 'Tim Armour', aum: 2600e9, strategy: 'Active/Growth', cik: '44201', type: 'institutional', region: 'us', icon: '🏛️', reputation: 89, founded: 1931, hq: 'Los Angeles, CA', sector: 'Asset Management', regulator: 'sec', track: { win: 65, avg90d: 4.5, trades: 800 } },
    'Wellington Mgmt': { ceo: 'Jean Hynes', aum: 1200e9, strategy: 'Multi-Asset/Active', cik: '106926', type: 'institutional', region: 'us', icon: '🏛️', reputation: 86, founded: 1928, hq: 'Boston, MA', sector: 'Asset Management', regulator: 'sec', track: { win: 64, avg90d: 5.0, trades: 1100 } },
    'Invesco': { ceo: 'Andrew Schlossberg', aum: 1600e9, strategy: 'Index/Active', cik: '914208', type: 'institutional', region: 'us', icon: '🏛️', reputation: 82, founded: 1935, hq: 'Atlanta, GA', sector: 'Asset Management', regulator: 'sec', track: { win: 61, avg90d: 3.5, trades: 650 } },
    // European
    'Norway Sovereign Fund': { ceo: 'Nicolai Tangen', aum: 1700e9, strategy: 'Sovereign Wealth', cik: '1552797', type: 'institutional', region: 'eu', icon: '🇳🇴', reputation: 93, founded: 1990, hq: 'Oslo, Norway', sector: 'Sovereign Fund', regulator: 'bafin', track: { win: 65, avg90d: 5.1, trades: 420 } },
    'Amundi': { ceo: 'Valérie Baudson', aum: 2300e9, strategy: 'Multi-Asset', cik: null, type: 'institutional', region: 'eu', icon: '🇫🇷', reputation: 84, founded: 2010, hq: 'Paris, France', sector: 'Asset Management', regulator: 'amf', track: { win: 63, avg90d: 4.0, trades: 920 } },
    'DWS Group': { ceo: 'Stefan Hoops', aum: 900e9, strategy: 'Index/Active', cik: null, type: 'institutional', region: 'eu', icon: '🇩🇪', reputation: 80, founded: 1956, hq: 'Frankfurt, Germany', sector: 'Asset Management', regulator: 'bafin', track: { win: 60, avg90d: 3.2, trades: 540 } },
    'Schroders': { ceo: 'Peter Harrison', aum: 900e9, strategy: 'Active/Multi-Asset', cik: null, type: 'institutional', region: 'eu', icon: '🇬🇧', reputation: 83, founded: 1804, hq: 'London, UK', sector: 'Asset Management', regulator: 'fca', track: { win: 62, avg90d: 3.8, trades: 470 } },
    'Legal & General': { ceo: 'António Simões', aum: 1500e9, strategy: 'Index/Insurance', cik: null, type: 'institutional', region: 'eu', icon: '🇬🇧', reputation: 81, founded: 1836, hq: 'London, UK', sector: 'Asset Management', regulator: 'fca', track: { win: 61, avg90d: 3.0, trades: 380 } },
    // Asia & Sovereign
    'Abu Dhabi Investment Authority': { ceo: 'Hamed bin Zayed', aum: 993e9, strategy: 'Sovereign Diversified', cik: null, type: 'institutional', region: 'asia', icon: '🇦🇪', reputation: 89, founded: 1976, hq: 'Abu Dhabi, UAE', sector: 'Sovereign Fund', regulator: 'hkex', track: { win: 66, avg90d: 6.3, trades: 310 } },
    'GIC Singapore': { ceo: 'Lim Chow Kiat', aum: 770e9, strategy: 'Sovereign/Multi-Asset', cik: null, type: 'institutional', region: 'asia', icon: '🇸🇬', reputation: 88, founded: 1981, hq: 'Singapore', sector: 'Sovereign Fund', regulator: 'hkex', track: { win: 67, avg90d: 5.5, trades: 290 } },
    'Temasek Holdings': { ceo: 'Dilhan Pillay', aum: 380e9, strategy: 'Growth/Strategic', cik: null, type: 'institutional', region: 'asia', icon: '🇸🇬', reputation: 87, founded: 1974, hq: 'Singapore', sector: 'Sovereign Fund', regulator: 'hkex', track: { win: 64, avg90d: 7.2, trades: 210 } },
    'CIC (China)': { ceo: 'Peng Chun', aum: 1350e9, strategy: 'Sovereign Wealth', cik: null, type: 'institutional', region: 'asia', icon: '🇨🇳', reputation: 85, founded: 2007, hq: 'Beijing, China', sector: 'Sovereign Fund', regulator: 'hkex', track: { win: 63, avg90d: 4.8, trades: 180 } },

};

const WHALE_NAMES = Object.keys(ENTITY_PROFILES);
const TX_TYPES = ['buy', 'sell', 'position', 'hedge'];
const SUBREDDITS = ['wallstreetbets', 'stocks', 'investing', 'options'];
const TOPICS = [
    'S&P 500 ATH', 'NASDAQ correction', 'Fed rate cut', 'inflation', 'recession fears',
    'trade war tariffs', 'China stimulus', 'dollar strength', 'DAX breakout', 'FTSE rally',
    'earnings season', 'tech selloff', 'Magnificent 7', 'Russell 2000 rotation', 'sector rotation',
    'smart money flow', 'COT report', 'institutional buying', 'short squeeze', 'dark pool activity',
    'Nikkei momentum', 'Hang Seng recovery', 'CAC 40 defence', '13F filings', 'options flow',
    'gold safe haven', 'oil OPEC', 'VIX spike', 'yield curve', 'jobs data', 'CPI surprise',
];

// ===================== LEADERBOARD =====================
const LEADERBOARD_ENTITIES = [
    { name: 'BlackRock', icon: '🏛️', type: 'institutional', strategy: 'Multi-Asset', aum: 10500e9, winRate: 72, pnl90d: 8.4, totalVol: 890e9, txCount: 2340 },
    { name: 'Vanguard', icon: '🏛️', type: 'institutional', strategy: 'Index/Passive', aum: 8600e9, winRate: 64, pnl90d: 4.2, totalVol: 560e9, txCount: 1200 },
    { name: 'Citadel', icon: '🏛️', type: 'institutional', strategy: 'Quant/Market Making', aum: 62e9, winRate: 78, pnl90d: 15.3, totalVol: 420e9, txCount: 12450 },
    { name: 'Renaissance Tech', icon: '🏛️', type: 'institutional', strategy: 'Quantitative', aum: 106e9, winRate: 82, pnl90d: 18.7, totalVol: 310e9, txCount: 8900 },
    { name: 'Bridgewater', icon: '🏛️', type: 'institutional', strategy: 'Global Macro', aum: 124e9, winRate: 68, pnl90d: 12.1, totalVol: 67e9, txCount: 890 },
    { name: 'Two Sigma', icon: '🏛️', type: 'institutional', strategy: 'Systematic/AI', aum: 60e9, winRate: 71, pnl90d: 9.8, totalVol: 180e9, txCount: 5600 },
    { name: 'D.E. Shaw', icon: '🏛️', type: 'institutional', strategy: 'Multi-Strategy', aum: 55e9, winRate: 74, pnl90d: 11.2, totalVol: 150e9, txCount: 4200 },
    { name: 'Berkshire Hathaway', icon: '🏛️', type: 'institutional', strategy: 'Value Investing', aum: 370e9, winRate: 71, pnl90d: 5.8, totalVol: 45e9, txCount: 156 },
    { name: 'Norway Sovereign', icon: '🇳🇴', type: 'institutional', strategy: 'Sovereign Wealth', aum: 1700e9, winRate: 65, pnl90d: 5.1, totalVol: 120e9, txCount: 420 },
    { name: 'Soros Fund Mgmt', icon: '🏛️', type: 'institutional', strategy: 'Global Macro', aum: 28e9, winRate: 73, pnl90d: 14.5, totalVol: 18e9, txCount: 540 },

];

// ===================== OFFICIAL DATA SOURCES =====================
const DATA_SOURCES = [
    { name: 'SEC EDGAR', icon: '🏛️', type: '13F Institutional Filings', region: 'us', desc: 'Official US Securities & Exchange Commission database. 13F-HR quarterly filings from institutional managers reveal exact stock holdings, position changes, and portfolio concentration.', tags: ['13F', 'equities', 'institutional', 'SEC', 'quarterly'], url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=13-F&dateb=&owner=include&count=40&search_text=&action=getcompany', status: 'active' },
    { name: 'SEC 13F Data Sets', icon: '📊', type: 'Quarterly Filing Downloads', region: 'us', desc: 'Flattened, downloadable quarterly data sets extracted from Form 13F XML submissions. The most reliable as-filed official records for batch analysis.', tags: ['13F', 'download', 'historical', 'XML'], url: 'https://www.sec.gov/data/form-13f-data-sets', status: 'active' },
    { name: 'CFTC COT Report', icon: '📋', type: 'Futures Positioning', region: 'us', desc: 'Commitment of Traders — weekly positioning of commercials, large speculators and managed money in index futures, commodities, and currencies.', tags: ['commodities', 'futures', 'COT', 'positioning'], url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders', status: 'active' },
    { name: 'BaFin (Germany)', icon: '🇩🇪', type: 'Voting Rights >3%', region: 'eu', desc: 'German Federal Financial Supervisory Authority. Publishes voting rights notifications when institutional shareholders cross 3%, 5%, 10%, 15%, 20%, 25%, 30%, 50%, or 75% thresholds.', tags: ['DAX', 'Germany', 'voting rights', 'threshold'], url: 'https://www.bafin.de/EN/PublikationenDaten/Datenbanken/Stimmrechte/stimmrechte_node_en.html', status: 'active' },
    { name: 'AMF BDIF (France)', icon: '🇫🇷', type: 'Major Holdings >5%', region: 'eu', desc: 'Autorité des Marchés Financiers — BDIF database. Major holding notifications triggered at 5%, 10%, 15%, 20%, 25%, 30%, 33%, 50%, 66%, 90%, and 95% thresholds.', tags: ['CAC 40', 'France', 'major holdings', 'threshold'], url: 'https://www.amf-france.org/en/databases-and-tools', status: 'active' },
    { name: 'FCA / RNS (UK)', icon: '🇬🇧', type: 'TR-1 Major Shareholdings', region: 'eu', desc: 'Financial Conduct Authority — DTR5 rules. TR-1 forms for major shareholding notifications in UK-listed companies. Published via Regulatory News Service (RNS).', tags: ['FTSE', 'UK', 'TR-1', 'shareholding'], url: 'https://www.fca.org.uk/markets/primary-markets/regulatory-disclosures/disclosure-major-shareholdings', status: 'active' },
    { name: 'EDINET (Japan)', icon: '🇯🇵', type: '5%+ Large Shareholding', region: 'asia', desc: 'Electronic Disclosure for Investors NETwork — FSA Japan. Large shareholding reports required when investors exceed 5% ownership. Available via EDINET API v2.', tags: ['Nikkei', 'Japan', '5% rule', 'FSA'], url: 'https://disclosure2.edinet-fsa.go.jp', status: 'active' },
    { name: 'HKEX / SFC (HK)', icon: '🇭🇰', type: 'Disclosure of Interests >5%', region: 'asia', desc: 'Hong Kong Exchanges & SFC. Part XV disclosures when shareholders hold 5%+ of voting shares. CCASS data shows custodian-level holdings.', tags: ['Hang Seng', 'Hong Kong', 'DOI', 'CCASS'], url: 'https://www.hkexnews.hk/sdw/search/searchsdw.aspx', status: 'active' },
    { name: 'WhaleWisdom', icon: '🦑', type: 'Parsed 13F Data', region: 'us', desc: 'Community-built 13F filing explorer. Tracks SEC filings from 5000+ hedge funds and asset managers with quarter-over-quarter comparison.', tags: ['13F', 'hedge funds', 'parsed', 'comparison'], url: 'https://whalewisdom.com', status: 'active' },
    { name: 'Unusual Whales', icon: '🐙', type: 'Options Flow & Dark Pool', region: 'us', desc: 'Real-time unusual options activity and dark pool prints. Detects large institutional bets on US equities via options and off-exchange trading.', tags: ['options', 'dark pool', 'flow', 'equities'], url: 'https://unusualwhales.com', status: 'active' },
    { name: 'Finviz', icon: '📈', type: 'Screener & Insider Trading', region: 'us', desc: 'Advanced stock screener with market heatmap, insider trading data from SEC Form 4 filings, and fundamental analysis for US equities.', tags: ['screener', 'insider', 'heatmap', 'fundamentals'], url: 'https://finviz.com', status: 'active' },
    { name: 'TradingView', icon: '📉', type: 'Charts & Technical Analysis', region: 'global', desc: 'Leading charting platform with real-time data for global indices, equities, commodities. Community-driven trade ideas and technical analysis.', tags: ['charts', 'technical', 'multi-asset'], url: 'https://tradingview.com', status: 'active' },
    { name: 'Fear & Greed Index', icon: '😱', type: 'Market Sentiment', region: 'us', desc: 'CNN Fear & Greed Index — composite of 7 market indicators tracking investor sentiment from extreme fear (0) to extreme greed (100).', tags: ['sentiment', 'fear', 'greed'], url: 'https://edition.cnn.com/markets/fear-and-greed', status: 'active' },
];

// ===================== SOURCE LINK HELPERS =====================
function getSourceInfo(market, token, entity) {
    const profile = ENTITY_PROFILES[entity];
    const reg = profile?.regulator || 'sec';
    const clean = token.replace('/USD','').replace('/','');
    const sources = {
        sec: [
            { name: 'SEC EDGAR', url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${profile?.cik || ''}&type=13F&dateb=&owner=include&count=10`, icon: '🏛️' },
            { name: 'WhaleWisdom', url: `https://whalewisdom.com/stock/${clean.toLowerCase()}`, icon: '🦑' },
            { name: 'Finviz', url: `https://finviz.com/quote.ashx?t=${clean}`, icon: '📈' },
        ],
        bafin: [
            { name: 'BaFin', url: 'https://www.bafin.de/EN/PublikationenDaten/Datenbanken/Stimmrechte/stimmrechte_node_en.html', icon: '🇩🇪' },
            { name: 'TradingView', url: `https://www.tradingview.com/symbols/${clean}/`, icon: '📉' },
        ],
        amf: [
            { name: 'AMF BDIF', url: 'https://www.amf-france.org/en/databases-and-tools', icon: '🇫🇷' },
            { name: 'TradingView', url: `https://www.tradingview.com/symbols/${clean}/`, icon: '📉' },
        ],
        fca: [
            { name: 'FCA DTR5', url: 'https://www.fca.org.uk/markets/primary-markets/regulatory-disclosures/disclosure-major-shareholdings', icon: '🇬🇧' },
            { name: 'LSE RNS', url: 'https://www.londonstockexchange.com/news', icon: '📋' },
        ],
        edinet: [
            { name: 'EDINET', url: 'https://disclosure2.edinet-fsa.go.jp', icon: '🇯🇵' },
            { name: 'TradingView', url: `https://www.tradingview.com/symbols/${clean}/`, icon: '📉' },
        ],
        hkex: [
            { name: 'HKEX DOI', url: 'https://www.hkexnews.hk/sdw/search/searchsdw.aspx', icon: '🇭🇰' },
            { name: 'SFC', url: 'https://www.sfc.hk', icon: '🏛️' },
        ],
    };
    const pool = sources[reg] || sources.sec;
    return pool[randInt(0, pool.length)];
}

// ===================== UTILITIES =====================
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max)); }
function randEl(arr) { return arr[randInt(0, arr.length)]; }
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

// ===================== MARKET SESSION DETECTOR =====================
function getMarketSessions() {
    const now = new Date();
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();
    const t = utcH * 60 + utcM;
    // US: 13:30-20:00 UTC (9:30-16:00 ET)
    const usOpen = t >= 810 && t < 1200;
    const usPre = t >= 720 && t < 810;
    // EU: 07:00-15:30 UTC (8:00-16:30 CET)
    const euOpen = t >= 420 && t < 930;
    const euPre = t >= 360 && t < 420;
    // Asia: 00:00-06:00 UTC (Tokyo 9:00-15:00 JST)
    const asiaOpen = t >= 0 && t < 360;
    const asiaPre = t >= 1380 || (t >= 0 && t < 0); // simplified
    return {
        us: usOpen ? 'open' : usPre ? 'premarket' : 'closed',
        eu: euOpen ? 'open' : euPre ? 'premarket' : 'closed',
        asia: asiaOpen ? 'open' : 'closed',
    };
}

function updateMarketSessions() {
    const s = getMarketSessions();
    ['us', 'eu', 'asia'].forEach(r => {
        const el = document.getElementById('session-' + r);
        if (el) { el.className = 'session-dot ' + s[r]; el.title = r.toUpperCase() + ' Market: ' + s[r]; }
    });
}

// ===================== SMART MONEY SCORE =====================
function calcSmartMoneyScore(entity, amount, type) {
    const profile = ENTITY_PROFILES[entity];
    if (!profile) return { score: randInt(30, 65), components: {} };
    let score = 0; const c = {};
    c.reputation = Math.round(profile.reputation * 0.25); score += c.reputation;
    c.trackRecord = Math.round((profile.track.win / 100) * 25); score += c.trackRecord;
    const pctOfAum = (amount / profile.aum) * 100;
    c.conviction = Math.min(20, Math.round(pctOfAum * 200)); score += c.conviction;
    c.timing = type === 'buy' && profile.track.avg90d > 0 ? 15 : type === 'hedge' ? 12 : type === 'position' ? 10 : 7;
    score += c.timing;
    c.diversification = 10; score += c.diversification;
    return { score: Math.min(99, score), components: c };
}

// ===================== FILING INFO GENERATOR =====================
function generateFilingInfo(market, entity) {
    const profile = ENTITY_PROFILES[entity];
    const now = new Date();
    const d = new Date(now - randInt(1, 45) * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    if (!profile?.regulator) return { type: randEl(['13F-HR', 'SC 13G', 'Form 4']), date: dateStr, cik: profile?.cik || null, shares: randInt(50000, 12e6), prevShares: randInt(30000, 10e6), changePercent: rand(-40, 80).toFixed(1), regulator: 'sec' };
    const reg = profile?.regulator || 'sec';
    const types = {
        sec: ['13F-HR', '13F-HR/A', 'SC 13G', 'SC 13D', 'Form 4'],
        bafin: ['Voting Rights §33', 'Voting Rights §34', 'Stimmrechte Meldung'],
        amf: ['Major Holdings', 'Déclaration de franchissement', 'DOI Filing'],
        fca: ['TR-1 Notification', 'DTR 5 Filing', 'Major Shareholding'],
        edinet: ['Large Shareholding Report', '5% Rule Filing', 'Change Report'],
        hkex: ['DOI Part XV', 'CCASS Participant', 'Substantial Shareholder'],
    };
    return { type: randEl(types[reg] || types.sec), date: dateStr, cik: profile?.cik || null, shares: randInt(50000, 12e6), prevShares: randInt(30000, 10e6), changePercent: rand(-40, 80).toFixed(1), regulator: reg };
}

// ===================== INSIGHT GENERATOR =====================
function generateInsight(type, market, tokenName, amount, entity) {
    const profile = ENTITY_PROFILES[entity];
    const ceo = profile?.ceo?.split(' ')[0] || 'Management';
    const reg = profile?.regulator || 'sec';
    const regName = { sec: 'SEC EDGAR', bafin: 'BaFin', amf: 'AMF', fca: 'FCA', edinet: 'EDINET', hkex: 'HKEX' }[reg] || 'regulatory';

    const insights = {
        buy: {
            equities: [
                `${entity} initiates ${formatUSD(amount)} position in ${tokenName}. ${regName} filing shows ${ceo}'s team sees undervaluation vs peer group.`,
                `13F reveals ${entity} accumulated ${tokenName} shares. High-conviction bet — dark pool data confirms sustained institutional accumulation.`,
                `${entity} increases ${tokenName} stake by ${rand(10,45).toFixed(0)}%. ${regName} filing detected by WhaleVault — contrarian play amid sector weakness.`,
            ],
            indices: [
                `${entity} increasing exposure to ${tokenName}. ${ceo} sees value after pullback — systematic models triggered momentum signals.`,
                `${entity} adds ${tokenName} exposure ahead of earnings season. ${regName} records show broadening market participation thesis.`,
            ],
        },
        sell: {
            equities: [
                `${entity} exiting ${tokenName} — ${formatUSD(amount)} divestment. ${regName} filing suggests rotation from growth to value/defensives.`,
                `${entity} reduces ${tokenName} stake per ${regName}. Post-earnings repositioning — limited upside at current multiples.`,
            ],
            indices: [
                `${entity} reduces ${tokenName} allocation by ${rand(10,35).toFixed(0)}%. Risk models flagging overextension — partial de-risk.`,
            ],
        },
        position: {
            equities: [`${entity} adjusts ${tokenName} position — ${regName} filing shows portfolio rebalancing within concentration limits.`],
            indices: [`${entity} rebalancing ${tokenName} weighting. Systematic allocation after sector correlation breakdown.`],
        },
        hedge: {
            equities: [`${entity} hedging ${tokenName} via collar strategy — protective put + covered call. ${regName} options filing detected.`],
            indices: [`${entity} hedging ${tokenName} with put spreads. VIX positioning expects 2-4 weeks elevated volatility.`],
        },
    };
    const pool = insights[type]?.[market] || [`${entity} ${type}s ${formatUSD(amount)} in ${tokenName}. Institutional flow detected via ${regName}.`];
    return randEl(pool);
}

// ===================== CONVERGENCE SIGNALS =====================
function generateConvergenceSignals(token, type) {
    const signals = [];
    if (Math.random() > 0.4) signals.push({ icon: '📊', label: 'COT Report', detail: type === 'buy' ? 'Commercials net long increasing' : 'Large specs reducing', sentiment: type === 'buy' ? 'bullish' : 'bearish' });
    if (Math.random() > 0.5) signals.push({ icon: '📈', label: 'Options Flow', detail: `Unusual ${type === 'buy' ? 'call' : 'put'} activity detected`, sentiment: type === 'buy' ? 'bullish' : 'bearish' });
    if (Math.random() > 0.55) signals.push({ icon: '💬', label: 'Social Sentiment', detail: `Reddit trending ${type === 'buy' ? 'positive' : 'negative'}`, sentiment: type === 'buy' ? 'bullish' : 'neutral' });
    if (Math.random() > 0.6) signals.push({ icon: '🏦', label: 'Dark Pool', detail: `${type === 'buy' ? 'Accumulation' : 'Distribution'} patterns`, sentiment: type === 'buy' ? 'bullish' : 'bearish' });
    if (Math.random() > 0.65) signals.push({ icon: '📋', label: '13F Filing', detail: `${type === 'buy' ? 'Position increase' : 'Position decrease'} reported`, sentiment: type === 'buy' ? 'bullish' : 'bearish' });
    return signals;
}

// ===================== ALERT GENERATOR =====================
function generateWhaleAlert() {
    const token = randEl(TOKENS);
    const amount = rand(500000, 80000000);
    const type = randEl(TX_TYPES);
    const impact = amount > 20e6 ? 'high' : amount > 5e6 ? 'medium' : 'low';
    const isInst = true;
    const whaleName = randEl(WHALE_NAMES);
    const profile = ENTITY_PROFILES[whaleName];
    const source = getSourceInfo(token.market, token.symbol, whaleName);
    const filing = generateFilingInfo(token.market, whaleName);
    const sms = calcSmartMoneyScore(whaleName, amount, type);
    const insight = generateInsight(type, token.market, token.name, amount, whaleName);
    const actionLabel = { buy: 'Accumulation — new position or increase', sell: 'Reduction — partial or full exit', position: 'Rebalancing — portfolio adjustment', hedge: 'Hedge — risk protection' };
    return {
        id: Date.now() + randInt(0, 9999), token: token.symbol, tokenName: token.name,
        market: token.market, region: token.region, amount, type, impact,
        from: whaleName,
        to: actionLabel[type],
        time: Date.now() - randInt(0, 3600000), whaleName, profile, filing,
        smartMoneyScore: sms.score, smsComponents: sms.components, insight,
        actionLabel: actionLabel[type],
        sourceUrl: source.url, sourceName: source.name, sourceIcon: source.icon,
        convergenceSignals: generateConvergenceSignals(token, type),
    };
}

// ===================== FILING GENERATOR =====================
function generateFiling() {
    const entity = randEl(WHALE_NAMES.filter(n => ENTITY_PROFILES[n].type === 'institutional'));
    const profile = ENTITY_PROFILES[entity];
    const reg = profile.regulator || 'sec';
    const regName = { sec: 'SEC EDGAR', bafin: 'BaFin', amf: 'AMF', fca: 'FCA', edinet: 'EDINET', hkex: 'HKEX' }[reg];
    const d = new Date(Date.now() - randInt(1, 90) * 86400000);
    const stocks = TOKENS.filter(t => t.market === 'equities');
    const holdingCount = randInt(3, 8);
    const holdings = [];
    for (let i = 0; i < holdingCount; i++) {
        const s = randEl(stocks);
        const changePct = rand(-30, 50).toFixed(1);
        holdings.push({ symbol: s.symbol, name: s.name, shares: randInt(10000, 5e6), change: changePct });
    }
    return { entity, profile, regulator: reg, regulatorName: regName, date: d.toISOString().split('T')[0], filingType: generateFilingInfo('equities', entity).type, holdings, totalValue: rand(100e6, 50e9), cik: profile.cik };
}

// ===================== REDDIT POST GENERATOR =====================
function generateRedditPost() {
    const titles = [
        'S&P 500 at all-time high but breadth is horrible — divergence warning',
        'Smart money rotating out of tech into value — 13F data confirms',
        'BlackRock increasing positions in every Mag 7 stock — here\'s the data',
        'Goldman Sachs sees 15% upside for DAX by year-end',
        'FTSE 100 finally breaking out — UK defense stocks leading',
        'Dark pool flow showing massive accumulation in NVDA',
        'Nikkei 225 trapped in a range — BOJ policy keeping lid on',
        'Russell 2000 rotation is real — small caps outperforming',
        'Warren Buffett increased Berkshire cash to record — topping signal?',
        'Fed might cut rates in June — impact on tech stocks',
        'CAC 40 outperforming expectations — European defense rotation',
        'Hang Seng rallying — China stimulus finally working',
        'Bridgewater\'s latest 13F shows massive gold accumulation',
        'Analysis: why Dollar will weaken and help EM equities',
        'Options flow screaming bullish on banks — JPM, GS, BAC',
    ];
    return {
        title: randEl(titles), subreddit: randEl(SUBREDDITS), upvotes: randInt(50, 5000),
        comments: randInt(20, 800), sentiment: randEl(['positive', 'negative', 'neutral']),
        sentimentScore: rand(-1, 1), time: Date.now() - randInt(0, 86400000),
        author: 'u/' + randEl(['SmartMoneyTracker', 'IndexTraderPro', 'MacroResearcher', 'WallStreetInsider', 'EquityAnalyst', '13FHunter', 'DAXTrader', 'GlobalMacro']),
    };
}

// ===================== STATE =====================
const state = {
    currentTab: 'home',
    alerts: [], alertsPaused: false,
    filings: [],
    trackedInstitutions: [],
    tokens: JSON.parse(JSON.stringify(TOKENS)),
    posts: [],
    fearGreedIndex: randInt(25, 85),
    notifications: [],
    selectedRegion: 'all',
};

// ===================== INITIALIZATION =====================
document.addEventListener('DOMContentLoaded', () => {
    for (let i = 0; i < 25; i++) state.alerts.push(generateWhaleAlert());
    state.alerts.sort((a, b) => b.time - a.time);
    for (let i = 0; i < 20; i++) state.filings.push(generateFiling());
    state.filings.sort((a, b) => new Date(b.date) - new Date(a.date));
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
    setupTabs(); setupDrawer(); setupNotifications(); setupSearch();
    setupSettings(); setupRegionTabs(); setupInstitutionalTracker();
    renderDataSources();

    showToast('🔄', 'Connecting to global data sources...', 'whale');
    const updated = await LiveData.syncAll();
    if (updated > 0) showToast('✅', `${updated} assets updated with live prices!`, 'bull');
    else showToast('ℹ️', 'Demo mode active. Configure API keys in Settings.', 'alert');

    updateTickers(); renderWhaleAlerts(); renderLeaderboard();
    renderMarketOverview(); renderVolumeScanner();
    renderCohortAnalysis(); renderCommunityIntel();
    renderFilingMonitor(); updateAlertStats();
    renderHome(); // Must be after alerts/leaderboard are populated
    startLiveUpdates();
    document.getElementById('last-update').textContent = 'Last update: now';
}

// ===================== TAB NAVIGATION =====================
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });
    document.querySelectorAll('.drawer-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => { setTab(btn.dataset.tab); closeDrawer(); });
    });
}

function setTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-screen').forEach(s => s.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    const screen = document.getElementById('tab-' + tab);
    if (btn) btn.classList.add('active');
    if (screen) screen.classList.add('active');
    // Scroll to top of content
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
}
window.setTab = setTab;

// ===================== DRAWER =====================
function setupDrawer() {
    const toggle = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('drawer-overlay');
    const close = document.getElementById('drawer-close');
    toggle.addEventListener('click', () => overlay.classList.add('open'));
    close.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDrawer(); });
}
function closeDrawer() { document.getElementById('drawer-overlay').classList.remove('open'); }
window.closeDrawer = closeDrawer;

// ===================== NOTIFICATIONS =====================
function setupNotifications() {
    const bell = document.getElementById('notif-bell');
    const panel = document.getElementById('notif-panel');
    bell.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== bell) panel.classList.remove('open'); });
    document.getElementById('notif-mark-read')?.addEventListener('click', () => {
        state.notifications = [];
        renderNotifications();
        bell.querySelector('.notif-dot').style.display = 'none';
    });
}
function addNotification(icon, text) {
    state.notifications.unshift({ icon, text, time: Date.now() });
    if (state.notifications.length > 20) state.notifications.pop();
    renderNotifications();
    const dot = document.querySelector('.notif-dot');
    if (dot) dot.style.display = 'block';
}
function renderNotifications() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (state.notifications.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:0.78rem">No notifications</div>';
        return;
    }
    list.innerHTML = state.notifications.slice(0, 15).map(n =>
        `<div class="notif-item"><span class="ni-icon">${n.icon}</span><span class="ni-text">${n.text}</span><span class="ni-time">${timeAgo(Date.now() - n.time)}</span></div>`
    ).join('');
}

// ===================== HOME SCREEN =====================
function renderHome() {
    renderHomeKPIs();
    renderPodium();
    renderCarousel();
}
function renderHomeKPIs() {
    const el = id => document.getElementById(id);
    el('kpi-txns').textContent = state.alerts.length;
    const totalVol = state.alerts.reduce((s, a) => s + a.amount, 0);
    el('kpi-vol').textContent = formatUSD(totalVol);
    const unique = new Set(state.alerts.map(a => a.whaleName));
    el('kpi-whales').textContent = unique.size;
    const fng = state.fearGreedIndex;
    const fngLabel = fng <= 25 ? 'Extreme Fear' : fng <= 45 ? 'Fear' : fng <= 55 ? 'Neutral' : fng <= 75 ? 'Greed' : 'Extreme Greed';
    el('kpi-fng').textContent = fng + ' ' + fngLabel;
}
function renderPodium() {
    const sorted = [...LEADERBOARD_ENTITIES].sort((a, b) => b.pnl90d - a.pnl90d);
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3, 8);
    const medals = ['🥇', '🥈', '🥉'];
    const classes = ['gold', 'silver', 'bronze'];
    const podium = document.getElementById('podium');
    // Order: silver(#2), gold(#1), bronze(#3)
    const order = [1, 0, 2];
    podium.innerHTML = order.map(i => {
        const e = top3[i];
        if (!e) return '';
        const pnlColor = e.pnl90d >= 0 ? 'positive-text' : 'negative-text';
        return `<div class="podium-slot ${classes[i]}">
            <div class="podium-medal">${medals[i]}</div>
            <div class="podium-name">${e.name}</div>
            <div class="podium-pnl ${pnlColor}">${e.pnl90d >= 0 ? '+' : ''}${e.pnl90d}%</div>
            <div class="podium-aum">${formatUSD(e.aum)}</div>
        </div>`;
    }).join('');
    const rankedList = document.getElementById('ranked-list');
    rankedList.innerHTML = rest.map((e, i) => {
        const pnlColor = e.pnl90d >= 0 ? 'positive-text' : 'negative-text';
        return `<div class="ranked-item">
            <span class="ri-rank">${i + 4}</span>
            <span class="ri-icon">${e.icon}</span>
            <span class="ri-name">${e.name}</span>
            <span class="ri-pnl ${pnlColor}">${e.pnl90d >= 0 ? '+' : ''}${e.pnl90d}%</span>
        </div>`;
    }).join('');
}
function renderCarousel() {
    const track = document.getElementById('carousel-track');
    const featured = state.alerts.slice(0, 6);
    const typeClass = { buy: 'cc-buy', sell: 'cc-sell', hedge: 'cc-hedge', position: 'cc-position' };
    track.innerHTML = featured.map(a => {
        const cls = typeClass[a.type] || 'cc-position';
        return `<div class="carousel-card ${cls}">
            <div class="cc-type">${a.type.toUpperCase()} SIGNAL</div>
            <div class="cc-entity">${a.whaleName}</div>
            <div class="cc-asset">${a.tokenName} (${a.token})</div>
            <div class="cc-amount">${formatUSD(a.amount)}</div>
            <span class="cc-cta">View Details →</span>
        </div>`;
    }).join('');
}
function trackFromHome() {
    const v = document.getElementById('home-track-input').value.trim();
    if (v) { setTab('wallets'); trackInstitution(v); }
}
window.trackFromHome = trackFromHome;

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
    const c = document.getElementById('search-results');
    if (!query) { c.innerHTML = '<div style="padding:18px;color:var(--text-faint);font-size:0.82rem;">Type to search stocks, indices, institutions...</div>'; return; }
    const q = query.toLowerCase();
    const matches = state.tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)).slice(0, 8);
    let html = '';
    matches.forEach(t => {
        const cc = t.change24h >= 0 ? 'positive-text' : 'negative-text';
        const live = t._live ? ' 🟢' : '';
        const regionTag = { us: '🇺🇸', eu: '🇪🇺', asia: '🌏', global: '🌍' }[t.region] || '';
        html += `<div class="search-result-item" onclick="navigateTo('global-markets');document.getElementById('search-modal').classList.add('hidden')">
            <span class="result-icon">${t.icon || '💰'}</span>
            <div class="result-info"><div class="result-name">${t.symbol}${live} ${regionTag}</div><div class="result-meta">${t.name} • ${formatUSD(t.price)} • ${t.assetClass}</div></div>
            <span class="${cc}" style="font-family:var(--font-mono);font-size:0.78rem">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%</span>
        </div>`;
    });
    c.innerHTML = html || `<div style="padding:18px;color:var(--text-faint);font-size:0.82rem;">No results for "${query}"</div>`;
}

// ===================== REGION TABS =====================
function setupRegionTabs() {
    document.querySelectorAll('.region-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.region-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.selectedRegion = tab.dataset.region;
            renderMarketOverview();
        });
    });
}

// ===================== TICKERS =====================
function updateTickers() {
    const find = sym => state.tokens.find(t => t.symbol === sym);
    setTicker('sp500', find('US500')); setTicker('nasdaq', find('US100'));
    setTicker('dow', find('US30')); setTicker('dax', find('DAX'));
    setTicker('ftse', find('FTSE')); setTicker('nikkei', find('NI225'));
    const fng = state.fearGreedIndex;
    const fngVal = document.getElementById('fng-value');
    if (fngVal) fngVal.textContent = fng;
    const fngLabel = document.getElementById('fng-label');
    const label = fng <= 25 ? 'Extreme Fear' : fng <= 45 ? 'Fear' : fng <= 55 ? 'Neutral' : fng <= 75 ? 'Greed' : 'Extreme Greed';
    if (fngLabel) { fngLabel.textContent = label; fngLabel.className = 'ticker-change ' + (fng >= 50 ? 'positive' : 'negative'); }
    // Mobile ticker
    setMobileTicker('sp500', find('US500')); setMobileTicker('nasdaq', find('US100'));
    setMobileTicker('dow', find('US30')); setMobileTicker('dax', find('DAX'));
    setMobileTicker('nikkei', find('NI225'));
    const mtFng = document.getElementById('mt-fng');
    const mtFngC = document.getElementById('mt-fng-c');
    if (mtFng) mtFng.textContent = fng;
    if (mtFngC) { mtFngC.textContent = label; mtFngC.className = 'mt-change ' + (fng >= 50 ? 'ticker-change positive' : 'ticker-change negative'); }
}

function setTicker(id, token) {
    if (!token) return;
    const priceEl = document.getElementById('price-' + id);
    if (priceEl) priceEl.textContent = formatUSD(token.price);
    const el = document.getElementById('change-' + id);
    if (el) {
        el.textContent = (token.change24h >= 0 ? '+' : '') + token.change24h.toFixed(2) + '%';
        el.className = 'ticker-change ' + (token.change24h >= 0 ? 'positive' : 'negative');
    }
}
function setMobileTicker(id, token) {
    if (!token) return;
    const priceEl = document.getElementById('mt-' + id);
    if (priceEl) priceEl.textContent = formatUSD(token.price);
    const changeEl = document.getElementById('mt-' + id + '-c');
    if (changeEl) {
        changeEl.textContent = (token.change24h >= 0 ? '+' : '') + token.change24h.toFixed(2) + '%';
        changeEl.className = 'mt-change ticker-change ' + (token.change24h >= 0 ? 'positive' : 'negative');
    }
}

// ===================== TOAST =====================
function showToast(icon, msg, type = 'whale') {
    const tc = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `<span style="font-size:16px">${icon}</span><span>${msg}</span>`;
    tc.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 4000);
}

// ===================== WHALE ALERTS =====================
function getScoreColor(s) { return s >= 80 ? 'var(--accent-bull)' : s >= 60 ? 'var(--accent-info)' : s >= 40 ? 'var(--accent-warn)' : 'var(--accent-bear)'; }
function getScoreLabel(s) { return s >= 80 ? 'Very High' : s >= 60 ? 'High' : s >= 40 ? 'Moderate' : 'Low'; }

function renderAlertHTML(a) {
    const mktLabel = { indices: '📊 INDEX', equities: '📈 EQUITY' }[a.market] || a.market;
    const isInst = true;
    const sms = a.smartMoneyScore || randInt(30, 80);
    const smsColor = getScoreColor(sms);
    const filing = a.filing || {};
    const regionFlag = { us: '🇺🇸', eu: '🇪🇺', asia: '🌏', global: '🌍' }[a.region] || '';
    const regBadge = filing.regulator ? `<span class="regulator-badge ${filing.regulator}">${{ sec:'SEC', bafin:'BaFin', amf:'AMF', fca:'FCA', edinet:'EDINET', hkex:'HKEX' }[filing.regulator] || ''}</span>` : '';
    const sourceLink = a.sourceUrl ? `<a href="${a.sourceUrl}" target="_blank" rel="noopener" class="alert-source-link">${a.sourceIcon || '🔗'} ${a.sourceName}</a>` : '';
    const filingBadge = filing.type ? `<span class="filing-badge">${filing.type}</span>` : '';
    const cikLink = filing.cik ? `<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filing.cik}&type=13F&dateb=&owner=include&count=10" target="_blank" rel="noopener" class="cik-link">🔗 CIK: ${filing.cik}</a>` : '';
    const sharesInfo = filing.shares ? `${filing.shares.toLocaleString()} shares` : filing.blockNumber ? `Block #${filing.blockNumber.toLocaleString()}` : '';
    const filingLine = filing.type ? `<div class="alert-filing-line">📋 ${filing.type} • ${filing.date} ${regBadge} ${cikLink} ${sharesInfo}</div>` : '';
    const signalsHTML = (a.convergenceSignals || []).map(s => `<span class="convergence-chip ${s.sentiment === 'bullish' ? 'signal-bullish' : s.sentiment === 'bearish' ? 'signal-bearish' : 'signal-neutral'}" title="${s.detail}">${s.icon} ${s.label}</span>`).join('');
    const typeIcon = { buy: '🟢', sell: '🔴', position: '🔵', hedge: '🟠' }[a.type] || '⚪';

    return `<div class="alert-item" data-chain="${a.market}" data-impact="${a.impact}" data-id="${a.id}" onclick="toggleAlertExpand(this)">
        <div class="alert-main-row">
            <div class="alert-type-icon">${typeIcon}</div>
            <div class="alert-info">
                <div class="alert-title">${a.tokenName} (${a.token}) ${regionFlag} <span style="font-size:0.65rem;color:var(--text-faint)">${mktLabel}</span> ${filingBadge}</div>
                <div class="alert-meta">
                    <span>${isInst ? a.whaleName : shortAddr(a.from)}</span>
                    <span>→ ${isInst ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : shortAddr(a.to)}</span>
                    <span>${sourceLink}</span>
                </div>
            </div>
            <div style="text-align:right">
                <div class="alert-amount">${formatUSD(a.amount)}</div>
                <div class="alert-time">${timeAgo(Date.now() - a.time)}</div>
            </div>
        </div>
        <div class="alert-expand">
            <div class="alert-insight">💡 ${a.insight}</div>
            ${filingLine}
            <div class="alert-detail-grid">
                <div class="alert-detail-card"><h4>🧠 Smart Money Score</h4><div class="detail-value" style="color:${smsColor}">${sms}/100 — ${getScoreLabel(sms)}</div><div class="sms-bar"><div class="sms-bar-fill" style="width:${sms}%;background:${smsColor}"></div></div></div>
                <div class="alert-detail-card"><h4>🏛️ Entity Profile</h4><p><strong>${a.whaleName}</strong><br>${a.profile?.sector || ''} • ${a.profile?.hq || ''}<br>AUM: ${formatUSD(a.profile?.aum || 0)}</p></div>
                <div class="alert-detail-card"><h4>📊 Track Record</h4><p>Win Rate: ${a.profile?.track?.win || '—'}%<br>90d P&L: ${a.profile?.track?.avg90d > 0 ? '+' : ''}${a.profile?.track?.avg90d || '—'}%<br>Total Trades: ${(a.profile?.track?.trades || 0).toLocaleString()}</p></div>
            </div>
            ${signalsHTML ? '<div class="convergence-signals">' + signalsHTML + '</div>' : ''}
        </div>
    </div>`;
}

function toggleAlertExpand(el) { el.classList.toggle('expanded'); }

function renderWhaleAlerts() {
    const feed = document.getElementById('alert-feed');
    const chainF = document.getElementById('alert-chain-filter').value;
    const impactF = document.getElementById('alert-impact-filter').value;
    const regionF = document.getElementById('alert-region-filter').value;
    let filtered = state.alerts;
    if (chainF !== 'all') filtered = filtered.filter(a => a.market === chainF);
    if (impactF !== 'all') filtered = filtered.filter(a => a.impact === impactF);
    if (regionF !== 'all') filtered = filtered.filter(a => a.region === regionF || a.region === 'global');
    feed.innerHTML = filtered.slice(0, 30).map(a => renderAlertHTML(a)).join('');
    const alertCountEl = document.getElementById('tab-alert-count');
    if (alertCountEl) alertCountEl.textContent = state.alerts.length;
}

function updateAlertStats() {
    document.getElementById('stat-total-txns').textContent = state.alerts.length;
    const totalVol = state.alerts.reduce((s, a) => s + a.amount, 0);
    document.getElementById('stat-volume-moved').textContent = formatUSD(totalVol);
    const largest = Math.max(...state.alerts.map(a => a.amount));
    document.getElementById('stat-largest-txn').textContent = formatUSD(largest);
    const unique = new Set(state.alerts.map(a => a.whaleName));
    document.getElementById('stat-active-whales').textContent = unique.size;
    // Update tab badge
    const tabBadge = document.getElementById('tab-alert-count');
    if (tabBadge) tabBadge.textContent = state.alerts.length;
}

// ===================== LEADERBOARD =====================
function renderLeaderboard() {
    const sort = document.getElementById('leaderboard-sort').value;
    const filter = document.getElementById('leaderboard-filter').value;
    let data = [...LEADERBOARD_ENTITIES];
    if (filter !== 'all') data = data.filter(e => e.type === filter);
    data.sort((a, b) => {
        if (sort === 'pnl') return b.pnl90d - a.pnl90d;
        if (sort === 'winrate') return b.winRate - a.winRate;
        if (sort === 'volume') return b.totalVol - a.totalVol;
        return b.aum - a.aum;
    });
    const body = document.getElementById('leaderboard-body');
    body.innerHTML = data.map((e, i) => {
        const pnlColor = e.pnl90d >= 0 ? 'positive-text' : 'negative-text';
        return `<div class="lb-row">
            <div class="lb-rank">${i + 1}</div>
            <div class="lb-entity"><span class="lb-entity-icon">${e.icon}</span><div class="lb-entity-info"><div class="lb-entity-name">${e.name}</div><div class="lb-entity-strategy">${e.strategy}</div></div></div>
            <div class="lb-stat">${formatUSD(e.aum)}</div>
            <div class="lb-stat">${e.winRate}%</div>
            <div class="lb-stat ${pnlColor}">${e.pnl90d >= 0 ? '+' : ''}${e.pnl90d}%</div>
            <div class="lb-stat">${formatUSD(e.totalVol)}</div>
            <div class="lb-stat">${e.txCount.toLocaleString()}</div>
        </div>`;
    }).join('');
}

// ===================== GLOBAL MARKETS =====================
function renderMarketOverview() {
    const heatmap = document.getElementById('market-heatmap');
    let filtered = state.tokens;
    if (state.selectedRegion !== 'all') {
        const regionMap = { americas: 'us', europe: 'eu', asia: 'asia' };
        const r = regionMap[state.selectedRegion];
        if (r) filtered = filtered.filter(t => t.region === r);
    }

    heatmap.innerHTML = filtered.map(t => {
        const c24 = t.change24h;
        const intensity = Math.min(Math.abs(c24) / 5, 1);
        const r = c24 >= 0 ? 16 : 239; const g = c24 >= 0 ? 185 : 68; const b = c24 >= 0 ? 129 : 68;
        const bg = `rgba(${r},${g},${b},${0.08 + intensity * 0.25})`;
        const regionFlag = { us: '🇺🇸', eu: '🇪🇺', asia: '🌏', global: '🌍' }[t.region] || '';
        const live = t._live ? '<span class="cell-live">● LIVE</span>' : '';
        return `<div class="heatmap-cell" style="background:${bg}" title="${t.name} — ${t.assetClass}">
            <div><div class="cell-symbol">${t.icon} ${t.symbol}</div><div class="cell-name">${t.name}</div></div>
            <div><span class="cell-price">${formatUSD(t.price)}</span> <span class="cell-change">${c24 >= 0 ? '+' : ''}${c24.toFixed(2)}%</span></div>
            <span class="cell-region">${regionFlag}</span>
            ${live}
        </div>`;
    }).join('');

    // Update stat cards
    const find = sym => state.tokens.find(t => t.symbol === sym);
    const sp = find('US500'), nq = find('US100'), dx = find('DAX'), ni = find('NI225');
    if (sp) document.getElementById('stat-sp500-price').textContent = formatUSD(sp.price);
    if (nq) document.getElementById('stat-nasdaq-price').textContent = formatUSD(nq.price);
    if (dx) document.getElementById('stat-dax-price').textContent = formatUSD(dx.price);
    if (ni) document.getElementById('stat-nikkei-price').textContent = formatUSD(ni.price);

    // View toggle
    const toggle = document.getElementById('market-view-toggle');
    if (toggle && !toggle._setup) {
        toggle._setup = true;
        toggle.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                toggle.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const v = btn.dataset.view;
                document.getElementById('market-heatmap').classList.toggle('hidden', v !== 'heatmap');
                document.getElementById('market-table-container').classList.toggle('hidden', v !== 'table');
                if (v === 'table') renderMarketTable();
            });
        });
    }
}

function renderMarketTable() {
    const body = document.getElementById('market-table-body');
    let sorted = [...state.tokens].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
    body.innerHTML = sorted.map((t, i) => {
        const cc24 = t.change24h >= 0 ? 'positive-text' : 'negative-text';
        const cc7 = t.change7d >= 0 ? 'positive-text' : 'negative-text';
        const regionTag = { us: 'US', eu: 'EU', asia: 'ASIA', global: 'GLOBAL' }[t.region] || '';
        const regionClass = { us: 'us', eu: 'eu', asia: 'asia', global: 'global' }[t.region] || '';
        return `<tr>
            <td>${i + 1}</td>
            <td><span style="margin-right:6px">${t.icon}</span>${t.symbol} — ${t.name} ${t._live ? '🟢' : ''}</td>
            <td style="font-family:var(--font-mono)">${formatUSD(t.price)}</td>
            <td class="${cc24}" style="font-family:var(--font-mono)">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%</td>
            <td class="${cc7}" style="font-family:var(--font-mono)">${t.change7d >= 0 ? '+' : ''}${t.change7d.toFixed(2)}%</td>
            <td><span class="region-tag ${regionClass}">${regionTag}</span></td>
            <td>${t.assetClass}</td>
            <td style="font-family:var(--font-mono)">${t._vol24h ? formatUSD(t._vol24h) : '—'}</td>
        </tr>`;
    }).join('');
}

// ===================== VOLUME SCANNER =====================
function renderVolumeScanner() {
    const grid = document.getElementById('volume-scanner-grid');
    const minSpike = parseFloat(document.getElementById('volume-min-spike')?.value || 1.5);
    const scanData = state.tokens.filter(t => t.market === 'equities' || t.market === 'indices').map(t => {
        const spike = rand(0.5, 6);
        return { ...t, spike, avgVol: rand(1e8, 5e9), currentVol: rand(1e8, 5e9) * spike };
    }).filter(d => d.spike >= minSpike).sort((a, b) => b.spike - a.spike).slice(0, 16);

    grid.innerHTML = scanData.map(d => {
        const spikeClass = d.spike >= 3 ? 'spike-high' : d.spike >= 2 ? 'spike-medium' : 'spike-low';
        const barWidth = Math.min((d.spike / 6) * 100, 100);
        const barColor = d.spike >= 3 ? 'var(--accent-bear)' : d.spike >= 2 ? 'var(--accent-warn)' : 'var(--accent-bull)';
        return `<div class="volume-card">
            <div class="volume-card-header">
                <span class="volume-card-symbol">${d.icon} ${d.symbol}</span>
                <span class="volume-card-spike ${spikeClass}">${d.spike.toFixed(1)}x</span>
            </div>
            <div style="font-size:0.68rem;color:var(--text-faint);margin-top:4px">${d.name} • Vol: ${formatUSD(d.currentVol)}</div>
            <div class="volume-card-bar"><div class="volume-card-bar-fill" style="width:${barWidth}%;background:${barColor}"></div></div>
        </div>`;
    }).join('');
}

// ===================== COHORT ANALYSIS =====================
function renderCohortAnalysis() {
    const tiers = [
        { id: 'sovereign', long: rand(55, 75) },
        { id: 'institutional', long: rand(50, 70) },
        { id: 'hedgefund', long: rand(40, 65) },
        { id: 'family', long: rand(45, 60) },
        { id: 'retail', long: rand(35, 55) },
    ];
    tiers.forEach(tier => {
        const short = 100 - tier.long;
        const el = id => document.getElementById(id);
        el(tier.id + '-count').textContent = randInt(8, 200);
        el(tier.id + '-position').textContent = formatUSD(rand(1e8, 50e9));
        el(tier.id + '-long').style.width = tier.long + '%';
        el(tier.id + '-short').style.width = short + '%';
        el(tier.id + '-long-pct').textContent = tier.long.toFixed(0) + '% Long';
        el(tier.id + '-short-pct').textContent = short.toFixed(0) + '% Short';
    });
    renderCohortChart();
}

function renderCohortChart() {
    const ctx = document.getElementById('cohort-timeline-chart');
    if (!ctx) return;
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const gen = (base) => labels.map(() => { base += rand(-5, 5); return Math.max(20, Math.min(80, base)); });
    new Chart(ctx, {
        type: 'line', data: {
            labels, datasets: [
                { label: 'Sovereign', data: gen(65), borderColor: '#8b5cf6', tension: 0.4, borderWidth: 2, fill: false, pointRadius: 0 },
                { label: 'Institutional', data: gen(60), borderColor: '#3b82f6', tension: 0.4, borderWidth: 2, fill: false, pointRadius: 0 },
                { label: 'Hedge Fund', data: gen(55), borderColor: '#10b981', tension: 0.4, borderWidth: 2, fill: false, pointRadius: 0 },
                { label: 'Family Office', data: gen(50), borderColor: '#eab308', tension: 0.4, borderWidth: 2, fill: false, pointRadius: 0 },
                { label: 'Retail', data: gen(45), borderColor: '#ef4444', tension: 0.4, borderWidth: 2, fill: false, pointRadius: 0 },
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } }, scales: { y: { ticks: { color: '#64748b', callback: v => v + '% Long' }, grid: { color: 'rgba(148,163,184,0.06)' } }, x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.06)' } } } }
    });
}

// ===================== FILING MONITOR =====================
function renderFilingMonitor() {
    const feed = document.getElementById('filing-feed');
    const regionF = document.getElementById('filing-region-filter')?.value || 'all';
    let filtered = state.filings;
    if (regionF !== 'all') filtered = filtered.filter(f => f.regulator === regionF);

    feed.innerHTML = filtered.slice(0, 15).map(f => {
        const regBadge = `<span class="regulator-badge ${f.regulator}">${f.regulatorName}</span>`;
        const holdingsHTML = f.holdings.map(h => {
            const changeClass = parseFloat(h.change) >= 0 ? 'change-up' : 'change-down';
            const arrow = parseFloat(h.change) >= 0 ? '▲' : '▼';
            return `<span class="filing-holding-chip">${h.symbol} <span class="${changeClass}">${arrow}${Math.abs(h.change)}%</span></span>`;
        }).join('');
        const cikLink = f.cik ? `<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${f.cik}&type=13F" target="_blank" rel="noopener" class="filing-link">🏛️ SEC EDGAR (CIK: ${f.cik})</a>` : '';
        const regLink = {
            bafin: '<a href="https://www.bafin.de/EN/PublikationenDaten/Datenbanken/Stimmrechte/stimmrechte_node_en.html" target="_blank" rel="noopener" class="filing-link">🇩🇪 BaFin Database</a>',
            amf: '<a href="https://www.amf-france.org/en/databases-and-tools" target="_blank" rel="noopener" class="filing-link">🇫🇷 AMF BDIF</a>',
            fca: '<a href="https://www.fca.org.uk/markets/primary-markets/regulatory-disclosures" target="_blank" rel="noopener" class="filing-link">🇬🇧 FCA RNS</a>',
            edinet: '<a href="https://disclosure2.edinet-fsa.go.jp" target="_blank" rel="noopener" class="filing-link">🇯🇵 EDINET</a>',
            hkex: '<a href="https://www.hkexnews.hk/sdw/search/searchsdw.aspx" target="_blank" rel="noopener" class="filing-link">🇭🇰 HKEX DOI</a>',
        }[f.regulator] || '';

        return `<div class="filing-card">
            <div class="filing-card-header">
                <div class="filing-card-title">${f.profile?.icon || '🏛️'} ${f.entity} ${regBadge} <span class="filing-badge">${f.filingType}</span></div>
                <div class="filing-card-meta">${f.date} • Total Value: ${formatUSD(f.totalValue)}</div>
            </div>
            <div style="font-size:0.72rem;color:var(--text-faint)">${f.profile?.strategy || ''} • ${f.profile?.hq || ''} • AUM: ${formatUSD(f.profile?.aum || 0)}</div>
            <div class="filing-holdings">${holdingsHTML}</div>
            <div class="filing-links">${cikLink}${regLink}<a href="https://whalewisdom.com" target="_blank" rel="noopener" class="filing-link">🦑 WhaleWisdom</a></div>
        </div>`;
    }).join('');

    // Stats
    document.getElementById('stat-filings-count').textContent = state.filings.length;
    document.getElementById('stat-inst-reporting').textContent = new Set(state.filings.map(f => f.entity)).size;
    const avgChange = state.filings.flatMap(f => f.holdings.map(h => parseFloat(h.change)));
    document.getElementById('stat-avg-change').textContent = (avgChange.reduce((a, b) => a + b, 0) / avgChange.length).toFixed(1) + '%';
    document.getElementById('stat-largest-filing').textContent = formatUSD(Math.max(...state.filings.map(f => f.totalValue)));
}

// ===================== INSTITUTIONAL TRACKER =====================
function setupInstitutionalTracker() {
    document.querySelectorAll('.sample-wallet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.address;
            trackInstitution(name);
        });
    });
    document.getElementById('inst-search-btn')?.addEventListener('click', () => {
        const v = document.getElementById('inst-search-input').value.trim();
        if (v) trackInstitution(v);
    });
}

function trackInstitution(query) {
    const q = query.toLowerCase();
    const match = Object.entries(ENTITY_PROFILES).find(([name]) => name.toLowerCase().includes(q));
    if (!match) { showToast('⚠️', 'Institution not found in database', 'alert'); return; }
    const [name, profile] = match;
    const panel = document.getElementById('inst-detail-panel');
    const emptyState = document.getElementById('inst-empty-state');
    if (emptyState) emptyState.style.display = 'none';
    panel.classList.remove('hidden');

    // Generate holdings
    const stocks = TOKENS.filter(t => t.market === 'equities');
    const holdings = [];
    for (let i = 0; i < randInt(5, 12); i++) {
        const s = randEl(stocks);
        holdings.push({ symbol: s.symbol, name: s.name, shares: randInt(100000, 10e6), value: rand(10e6, 5e9), change: rand(-30, 60).toFixed(1) });
    }

    const regLinks = {
        sec: `<a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${profile.cik || ''}&type=13F&dateb=&owner=include&count=10" target="_blank" class="filing-link">🏛️ SEC EDGAR</a>`,
        bafin: '<a href="https://www.bafin.de" target="_blank" class="filing-link">🇩🇪 BaFin</a>',
        amf: '<a href="https://www.amf-france.org" target="_blank" class="filing-link">🇫🇷 AMF</a>',
        fca: '<a href="https://www.fca.org.uk" target="_blank" class="filing-link">🇬🇧 FCA</a>',
        edinet: '<a href="https://disclosure2.edinet-fsa.go.jp" target="_blank" class="filing-link">🇯🇵 EDINET</a>',
        hkex: '<a href="https://www.hkexnews.hk" target="_blank" class="filing-link">🇭🇰 HKEX</a>',
    };

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
            <div>
                <h2 style="font-size:1.2rem;font-weight:800">${profile.icon} ${name}</h2>
                <p style="font-size:0.78rem;color:var(--text-faint)">${profile.sector} • ${profile.hq} • Founded ${profile.founded || '—'}</p>
            </div>
            <div style="text-align:right">
                <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700">${formatUSD(profile.aum)}</div>
                <div style="font-size:0.68rem;color:var(--text-faint)">Assets Under Management</div>
            </div>
        </div>
        <div class="alert-detail-grid">
            <div class="alert-detail-card"><h4>Strategy</h4><p>${profile.strategy}</p></div>
            <div class="alert-detail-card"><h4>CEO / Manager</h4><p>${profile.ceo}</p></div>
            <div class="alert-detail-card"><h4>Track Record</h4><p>Win Rate: ${profile.track.win}%<br>90d P&L: ${profile.track.avg90d > 0 ? '+' : ''}${profile.track.avg90d}%<br>Trades: ${profile.track.trades.toLocaleString()}</p></div>
            <div class="alert-detail-card"><h4>Region / Regulator</h4><p>${{ us:'🇺🇸 Americas', eu:'🇪🇺 Europe', asia:'🌏 Asia-Pacific', global:'🌍 Global' }[profile.region] || '🌍 Global'}<br>Filed via: ${{ sec:'SEC EDGAR', bafin:'BaFin', amf:'AMF', fca:'FCA', edinet:'EDINET', hkex:'HKEX' }[profile.regulator] || '—'}</p></div>
        </div>
        <h3 class="subsection-title" style="margin-top:16px">📊 Top Holdings (Simulated from latest filing)</h3>
        <div class="filing-holdings" style="margin-bottom:12px">${holdings.map(h => {
            const cc = parseFloat(h.change) >= 0 ? 'change-up' : 'change-down';
            const arrow = parseFloat(h.change) >= 0 ? '▲' : '▼';
            return `<span class="filing-holding-chip">${h.symbol} ${formatUSD(h.value)} <span class="${cc}">${arrow}${Math.abs(h.change)}%</span></span>`;
        }).join('')}</div>
        <div class="filing-links">${regLinks[profile.regulator] || regLinks.sec}<a href="https://whalewisdom.com" target="_blank" class="filing-link">🦑 WhaleWisdom</a><a href="https://finviz.com" target="_blank" class="filing-link">📈 Finviz</a></div>
    `;
}

// ===================== COMMUNITY INTEL =====================
function renderCommunityIntel() {
    // Sentiment stats
    const sentiments = state.posts.map(p => p.sentimentScore);
    const avgSent = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    document.getElementById('stat-sentiment').textContent = avgSent > 0.2 ? '🟢 Bullish' : avgSent < -0.2 ? '🔴 Bearish' : '🟡 Neutral';
    document.getElementById('stat-posts-count').textContent = state.posts.length;
    document.getElementById('stat-trending').textContent = randEl(TOPICS).split(' ').slice(0,3).join(' ');
    document.getElementById('stat-fear').textContent = state.fearGreedIndex + '/100';

    // Sentiment heatmap
    const heatmap = document.getElementById('sentiment-heatmap');
    const equities = state.tokens.filter(t => t.market === 'equities' || t.market === 'indices').slice(0, 16);
    heatmap.innerHTML = equities.map(t => {
        const s = rand(-1, 1);
        const bg = s > 0.3 ? 'rgba(16,185,129,0.15)' : s < -0.3 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.1)';
        const color = s > 0.3 ? 'var(--accent-bull)' : s < -0.3 ? 'var(--accent-bear)' : 'var(--accent-warn)';
        return `<div class="sentiment-cell" style="background:${bg};color:${color}"><span class="sent-symbol">${t.symbol}</span><span class="sent-score">${s > 0 ? '+' : ''}${s.toFixed(2)}</span></div>`;
    }).join('');

    // Word cloud
    const cloud = document.getElementById('word-cloud');
    cloud.innerHTML = TOPICS.slice(0, 20).map(t => `<span class="word-tag" style="font-size:${rand(0.65, 1.1).toFixed(2)}rem">${t}</span>`).join('');

    // Posts
    const posts = document.getElementById('community-posts');
    posts.innerHTML = state.posts.slice(0, 10).map(p => {
        return `<div class="community-post">
            <div class="post-title">${p.title}</div>
            <div class="post-meta">
                <span>r/${p.subreddit}</span><span>⬆️ ${p.upvotes}</span><span>💬 ${p.comments}</span>
                <span class="post-sentiment ${p.sentiment}">${p.sentiment}</span>
                <span>${p.author} • ${timeAgo(Date.now() - p.time)}</span>
            </div>
        </div>`;
    }).join('');
}

// ===================== DATA SOURCES =====================
function renderDataSources() {
    const grid = document.getElementById('sources-grid');
    grid.innerHTML = DATA_SOURCES.map(s => {
        const regionBadge = s.region ? `<span class="region-tag ${s.region === 'global' ? 'global' : s.region}">${{ us: '🇺🇸 US', eu: '🇪🇺 EU', asia: '🌏 ASIA', global: '🌍 GLOBAL' }[s.region] || ''}</span>` : '';
        return `<div class="source-card">
            <div class="source-card-header">
                <span class="source-icon">${s.icon}</span>
                <div><div class="source-name">${s.name} ${regionBadge}</div><div class="source-type">${s.type}</div></div>
            </div>
            <div class="source-desc">${s.desc}</div>
            <div class="source-tags">${s.tags.map(t => `<span class="source-tag">${t}</span>`).join('')}</div>
            <a href="${s.url}" target="_blank" rel="noopener" class="source-link">🔗 Visit ${s.name}</a>
            <span class="source-status ${s.status}">● ${s.status}</span>
        </div>`;
    }).join('');
}

// ===================== SETTINGS =====================
function setupSettings() {
    const keys = LiveData.getApiKeys();
    if (keys.finnhub) document.getElementById('api-finnhub').value = keys.finnhub;

    document.getElementById('save-api-keys')?.addEventListener('click', () => {
        const obj = {
            finnhub: document.getElementById('api-finnhub').value.trim(),
        };
        localStorage.setItem('whalevault_api_keys', JSON.stringify(obj));
        showToast('✅', 'API keys saved! Refreshing data...', 'bull');
        LiveData.cache = {};
        LiveData.syncAll().then(n => {
            if (n > 0) showToast('🟢', `${n} assets now live!`, 'bull');
            updateTickers(); renderMarketOverview();
        });
    });

    document.getElementById('clear-cache')?.addEventListener('click', () => { LiveData.cache = {}; localStorage.removeItem('whalevault_cache'); showToast('🗑️', 'Cache cleared', 'alert'); });
    document.getElementById('export-data')?.addEventListener('click', () => {
        const data = { alerts: state.alerts.slice(0, 50), filings: state.filings, tokens: state.tokens, timestamp: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'whalevault-export.json'; a.click();
        showToast('📦', 'Data exported!', 'bull');
    });

    // Alert filters
    ['alert-chain-filter', 'alert-impact-filter', 'alert-region-filter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', renderWhaleAlerts);
    });
    document.getElementById('alert-pause')?.addEventListener('click', () => {
        state.alertsPaused = !state.alertsPaused;
        showToast(state.alertsPaused ? '⏸️' : '▶️', state.alertsPaused ? 'Feed paused' : 'Feed resumed', 'alert');
    });

    ['filing-region-filter', 'filing-type-filter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', renderFilingMonitor);
    });
    ['volume-timeframe', 'volume-min-spike'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', renderVolumeScanner);
    });

    // Cache size
    const cacheSize = JSON.stringify(localStorage).length;
    const cacheEl = document.getElementById('cache-size');
    if (cacheEl) cacheEl.textContent = (cacheSize / 1024).toFixed(1) + ' KB';
}

// ===================== LIVE UPDATES =====================
function startLiveUpdates() {
    // New alerts every 8-15 seconds
    setInterval(() => {
        if (state.alertsPaused) return;
        const alert = generateWhaleAlert();
        state.alerts.unshift(alert);
        if (state.alerts.length > 100) state.alerts.pop();
        if (state.currentTab === 'alerts') { renderWhaleAlerts(); updateAlertStats(); }
        if (state.currentTab === 'home') { renderHomeKPIs(); renderCarousel(); }
        addNotification(alert.type === 'buy' ? '🟢' : alert.type === 'sell' ? '🔴' : '🟠', `${alert.whaleName} ${alert.type}s ${formatUSD(alert.amount)} in ${alert.tokenName}`);
        // Update tab badge
        const tabBadge = document.getElementById('tab-alert-count');
        if (tabBadge) tabBadge.textContent = state.alerts.length;
    }, randInt(8000, 15000));

    // Price micro-ticks every 3 seconds
    setInterval(() => {
        state.tokens.forEach(t => {
            if (!t._live) {
                const volatility = t.market === 'indices' ? 0.02 : 0.05;
                const pctChange = (Math.random() - 0.5) * volatility;
                t.price *= (1 + pctChange / 100);
                t.change24h += (Math.random() - 0.5) * 0.05;
            }
        });
        updateTickers();
    }, 3000);

    // Full data sync every 60 seconds
    setInterval(async () => {
        const updated = await LiveData.syncAll();
        if (updated > 0 && state.currentTab === 'markets') renderMarketOverview();
        updateTickers();
        const ts = new Date().toLocaleTimeString();
        document.getElementById('last-update').textContent = 'Last update: ' + ts;
        const drawerUpdate = document.getElementById('drawer-last-update');
        if (drawerUpdate) drawerUpdate.textContent = 'Last update: ' + ts;
    }, 60000);
}
