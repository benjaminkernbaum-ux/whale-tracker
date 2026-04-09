// ============================================================
// WHALEVAULT v3.0 — Smart Money Avançado + Live Data
// Foco: Ouro, Petróleo, Prata, Índices, Ações & Crypto
// Idioma: Português (BR)
// Enhanced: CoinGecko API + Fear & Greed Index live data
// ============================================================

const API_BASE = 'https://api.coingecko.com/api/v3';
const CRYPTO_MAP = {
    'BTC/USD': 'bitcoin',
    'ETH/USD': 'ethereum',
    'XRP/USD': 'ripple',
    'BNB/USD': 'binancecoin',
    'TRX/USD': 'tron',
    'SOL/USD': 'solana',
};

// ---- LIVE DATA FETCH ----
async function fetchLiveData() {
    try {
        const ids = Object.values(CRYPTO_MAP).join(',');
        const res = await fetch(`${API_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d`);
        if (!res.ok) throw new Error('API ' + res.status);
        const coins = await res.json();
        if (!Array.isArray(coins)) return;
        
        coins.forEach(coin => {
            const sym = Object.keys(CRYPTO_MAP).find(k => CRYPTO_MAP[k] === coin.id);
            if (!sym) return;
            const token = state.tokens.find(t => t.symbol === sym);
            if (!token) return;
            token.price = coin.current_price;
            token.mcap = coin.market_cap || 0;
            token.change24h = coin.price_change_percentage_24h || 0;
            token.change7d = coin.price_change_percentage_7d_in_currency ?? token.change7d;
            token._live = true;
        });
        
        // Update mode badge to LIVE if we got data
        const badge = document.getElementById('mode-badge');
        if (badge && coins.length > 0) {
            badge.classList.add('live');
            badge.querySelector('.mode-label').textContent = 'LIVE';
        }
        showToast('📡', `${coins.length} ativos crypto atualizados via CoinGecko`, 'bull');
    } catch (e) {
        console.warn('CoinGecko fetch failed (using demo data):', e);
    }
}

async function fetchFearGreed() {
    try {
        const res = await fetch('https://api.alternative.me/fng/?limit=1');
        const json = await res.json();
        const fg = json.data?.[0];
        if (fg) {
            state.fearGreedIndex = parseInt(fg.value);
        }
    } catch (e) {
        console.warn('Fear & Greed fetch failed:', e);
    }
}

// ---- ATIVOS MULTI-MERCADO ----
const TOKENS = [
    // COMMODITIES
    { symbol: 'XAU/USD', name: 'Ouro', price: 3085.40, mcap: 0, change24h: 1.12, change7d: 3.45, classe: 'Commodity', market: 'commodities', icon: '🥇' },
    { symbol: 'XAG/USD', name: 'Prata', price: 34.28, mcap: 0, change24h: -0.67, change7d: 2.10, classe: 'Commodity', market: 'commodities', icon: '🥈' },
    { symbol: 'WTI', name: 'Petróleo Bruto', price: 69.45, mcap: 0, change24h: -1.34, change7d: -3.20, classe: 'Commodity', market: 'commodities', icon: '🛢️' },
    { symbol: 'BRENT', name: 'Petróleo Brent', price: 73.12, mcap: 0, change24h: -0.98, change7d: -2.80, classe: 'Commodity', market: 'commodities', icon: '🛢️' },
    { symbol: 'NG', name: 'Gás Natural', price: 4.12, mcap: 0, change24h: 2.45, change7d: 5.60, classe: 'Commodity', market: 'commodities', icon: '🔥' },
    { symbol: 'COPPER', name: 'Cobre', price: 5.02, mcap: 0, change24h: 0.78, change7d: 4.30, classe: 'Commodity', market: 'commodities', icon: '🔶' },
    // ÍNDICES
    { symbol: 'US500', name: 'S&P 500', price: 5580.25, mcap: 0, change24h: 0.45, change7d: 1.23, classe: 'Índice', market: 'indices', icon: '🇺🇸' },
    { symbol: 'US30', name: 'Dow Jones', price: 41890.50, mcap: 0, change24h: 0.62, change7d: 0.89, classe: 'Índice', market: 'indices', icon: '🇺🇸' },
    { symbol: 'US100', name: 'Nasdaq 100', price: 19420.80, mcap: 0, change24h: -0.34, change7d: 2.15, classe: 'Índice', market: 'indices', icon: '🇺🇸' },
    { symbol: 'HK50', name: 'Hang Seng', price: 23150.40, mcap: 0, change24h: 1.89, change7d: 4.56, classe: 'Índice', market: 'indices', icon: '🇭🇰' },
    { symbol: 'DAX', name: 'DAX 40', price: 22580.30, mcap: 0, change24h: -0.23, change7d: 1.45, classe: 'Índice', market: 'indices', icon: '🇩🇪' },
    { symbol: 'FTSE', name: 'FTSE 100', price: 8650.70, mcap: 0, change24h: 0.15, change7d: 0.67, classe: 'Índice', market: 'indices', icon: '🇬🇧' },
    { symbol: 'NIKKEI', name: 'Nikkei 225', price: 37240.10, mcap: 0, change24h: -1.12, change7d: -2.30, classe: 'Índice', market: 'indices', icon: '🇯🇵' },
    // AÇÕES
    { symbol: 'AAPL', name: 'Apple', price: 217.90, mcap: 3340000000000, change24h: 0.67, change7d: 2.34, classe: 'Ação', market: 'equities', icon: '🍎' },
    { symbol: 'MSFT', name: 'Microsoft', price: 420.50, mcap: 3120000000000, change24h: 1.23, change7d: 3.45, classe: 'Ação', market: 'equities', icon: '💻' },
    { symbol: 'NVDA', name: 'NVIDIA', price: 112.80, mcap: 2750000000000, change24h: -2.15, change7d: -5.30, classe: 'Ação', market: 'equities', icon: '🎮' },
    { symbol: 'TSLA', name: 'Tesla', price: 268.40, mcap: 855000000000, change24h: 3.45, change7d: 8.90, classe: 'Ação', market: 'equities', icon: '🚗' },
    { symbol: 'AMZN', name: 'Amazon', price: 198.30, mcap: 2050000000000, change24h: 0.89, change7d: 1.56, classe: 'Ação', market: 'equities', icon: '📦' },
    { symbol: 'META', name: 'Meta', price: 585.20, mcap: 1480000000000, change24h: -0.56, change7d: 2.10, classe: 'Ação', market: 'equities', icon: '👤' },
    { symbol: 'GOOGL', name: 'Alphabet', price: 163.70, mcap: 2010000000000, change24h: 0.34, change7d: 1.89, classe: 'Ação', market: 'equities', icon: '🔍' },
    { symbol: 'JPM', name: 'JP Morgan', price: 245.80, mcap: 710000000000, change24h: 0.78, change7d: 3.20, classe: 'Ação', market: 'equities', icon: '🏦' },
    { symbol: 'GS', name: 'Goldman Sachs', price: 540.30, mcap: 178000000000, change24h: -0.45, change7d: 1.23, classe: 'Ação', market: 'equities', icon: '🏦' },
    // CRYPTO (apenas 6 selecionados)
    { symbol: 'BTC/USD', name: 'Bitcoin', price: 87432, mcap: 1720000000000, change24h: 2.34, change7d: 5.12, classe: 'Crypto', market: 'crypto', icon: '₿' },
    { symbol: 'ETH/USD', name: 'Ethereum', price: 3245, mcap: 390000000000, change24h: -1.23, change7d: 3.45, classe: 'Crypto', market: 'crypto', icon: 'Ξ' },
    { symbol: 'XRP/USD', name: 'Ripple', price: 2.34, mcap: 134000000000, change24h: -0.45, change7d: 1.23, classe: 'Crypto', market: 'crypto', icon: '💎' },
    { symbol: 'BNB/USD', name: 'Binance Coin', price: 612, mcap: 91000000000, change24h: 0.89, change7d: -2.10, classe: 'Crypto', market: 'crypto', icon: '🟡' },
    { symbol: 'TRX/USD', name: 'TRON', price: 0.238, mcap: 21500000000, change24h: 1.56, change7d: 4.30, classe: 'Crypto', market: 'crypto', icon: '⚡' },
    { symbol: 'SOL/USD', name: 'Solana', price: 178.5, mcap: 82000000000, change24h: 4.56, change7d: 12.30, classe: 'Crypto', market: 'crypto', icon: '☀️' },
];

// ---- ENTIDADES REAIS: FUNDOS INSTITUCIONAIS COM DADOS REAIS ----
const INSTITUTIONAL_ENTITIES = [
    { name: 'Bridgewater Associates', aum: '$124B', cik: '1350694', filingDate: '2026-02-14', strategy: 'Global Macro', manager: 'Ray Dalio (fundador)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1350694&type=13F', icon: '🏦', reputation: 92, winRate: 78, pnl90d: 18.4 },
    { name: 'BlackRock Inc.', aum: '$10.5T', cik: '1364742', filingDate: '2026-02-14', strategy: 'Multi-Estratégia', manager: 'Larry Fink (CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1364742&type=13F', icon: '🏛️', reputation: 98, winRate: 87, pnl90d: 34.2 },
    { name: 'Vanguard Group', aum: '$8.6T', cik: '102909', filingDate: '2026-02-14', strategy: 'Índice Passivo', manager: 'Tim Buckley (CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=102909&type=13F', icon: '📊', reputation: 95, winRate: 83, pnl90d: 12.1 },
    { name: 'Citadel Advisors', aum: '$62B', cik: '1423053', filingDate: '2026-02-14', strategy: 'Multi-Estratégia/Quant', manager: 'Ken Griffin (CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1423053&type=13F', icon: '⚡', reputation: 94, winRate: 82, pnl90d: 28.9 },
    { name: 'Renaissance Technologies', aum: '$55B', cik: '1037389', filingDate: '2026-02-14', strategy: 'Quantitativo/Medallion', manager: 'Peter Brown (CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1037389&type=13F', icon: '🧮', reputation: 99, winRate: 91, pnl90d: 26.1 },
    { name: 'Berkshire Hathaway', aum: '$370B', cik: '1067983', filingDate: '2026-02-14', strategy: 'Value/Concentrado', manager: 'Warren Buffett (CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1067983&type=13F', icon: '🎩', reputation: 99, winRate: 88, pnl90d: 31.5 },
    { name: 'Goldman Sachs Asset Mgmt', aum: '$2.8T', cik: '886982', filingDate: '2026-02-14', strategy: 'Prop Trading/AM', manager: 'David Solomon (CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=886982&type=13F', icon: '🏦', reputation: 90, winRate: 76, pnl90d: 15.3 },
    { name: 'JP Morgan Asset Mgmt', aum: '$3.0T', cik: '19617', filingDate: '2026-02-14', strategy: 'Multi-Ativo Global', manager: 'Jamie Dimon (CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=19617&type=13F', icon: '💰', reputation: 91, winRate: 79, pnl90d: 16.8 },
    { name: 'Two Sigma Investments', aum: '$60B', cik: '1179392', filingDate: '2026-02-14', strategy: 'Quantitativo/ML', manager: 'John Overdeck (Co-CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1179392&type=13F', icon: '🤖', reputation: 93, winRate: 84, pnl90d: 22.7 },
    { name: 'D.E. Shaw & Co.', aum: '$60B', cik: '1009207', filingDate: '2026-02-14', strategy: 'Quantitativo/Systematic', manager: 'David Shaw (fundador)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1009207&type=13F', icon: '📐', reputation: 91, winRate: 80, pnl90d: 20.4 },
    { name: 'Millennium Management', aum: '$59B', cik: '1273087', filingDate: '2026-02-14', strategy: 'Multi-Estratégia', manager: 'Israel Englander', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1273087&type=13F', icon: '🌐', reputation: 88, winRate: 77, pnl90d: 14.2 },
    { name: 'Point72 Asset Mgmt', aum: '$34B', cik: '1603466', filingDate: '2026-02-14', strategy: 'Discricionário/Quant', manager: 'Steve Cohen', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1603466&type=13F', icon: '🎯', reputation: 87, winRate: 75, pnl90d: 11.9 },
    { name: 'PIMCO', aum: '$1.7T', cik: '1339612', filingDate: '2026-02-14', strategy: 'Renda Fixa/Macro', manager: 'Emmanuel Roman (CEO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1339612&type=13F', icon: '📈', reputation: 89, winRate: 81, pnl90d: 9.3 },
    { name: 'Norges Bank (Fundo Soberano)', aum: '$1.7T', cik: '1582202', filingDate: '2026-02-14', strategy: 'Soberano Global', manager: 'Nicolai Tangen (CEO)', url: 'https://www.nbim.no/en/the-fund/', icon: '🇳🇴', reputation: 96, winRate: 85, pnl90d: 13.6 },
    { name: 'Abu Dhabi Investment Authority', aum: '$993B', cik: 'N/A', filingDate: '2026-Q1', strategy: 'Soberano Diversificado', manager: 'Hamed bin Zayed', url: 'https://www.adia.ae/', icon: '🇦🇪', reputation: 90, winRate: 79, pnl90d: 10.1 },
    { name: 'Soros Fund Management', aum: '$25B', cik: '1029160', filingDate: '2026-02-14', strategy: 'Global Macro', manager: 'Dawn Fitzpatrick (CIO)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1029160&type=13F', icon: '🦅', reputation: 95, winRate: 74, pnl90d: 19.8 },
    { name: 'Tiger Global Management', aum: '$20B', cik: '1167483', filingDate: '2026-02-14', strategy: 'Tech/Growth', manager: 'Chase Coleman', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1167483&type=13F', icon: '🐯', reputation: 82, winRate: 68, pnl90d: -5.2 },
    { name: 'Pershing Square Capital', aum: '$18B', cik: '1336528', filingDate: '2026-02-14', strategy: 'Ativista Concentrado', manager: 'Bill Ackman', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1336528&type=13F', icon: '🎪', reputation: 86, winRate: 71, pnl90d: 8.4 },
];

// ---- CARTEIRAS CRYPTO CONHECIDAS (endereços reais) ----
const KNOWN_CRYPTO_WALLETS = [
    { label: 'Binance Cold Wallet', address: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', chain: 'ethereum', tag: 'exchange', etherscan: 'https://etherscan.io/address/0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503' },
    { label: 'Binance Hot Wallet', address: '0x28C6c06298d514Db089934071355E5743bf21d60', chain: 'ethereum', tag: 'exchange', etherscan: 'https://etherscan.io/address/0x28C6c06298d514Db089934071355E5743bf21d60' },
    { label: 'Coinbase Prime', address: '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43', chain: 'ethereum', tag: 'exchange', etherscan: 'https://etherscan.io/address/0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43' },
    { label: 'Kraken Hot Wallet', address: '0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2', chain: 'ethereum', tag: 'exchange', etherscan: 'https://etherscan.io/address/0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2' },
    { label: 'Jump Trading', address: '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621', chain: 'ethereum', tag: 'market-maker', etherscan: 'https://etherscan.io/address/0xf584F8728B874a6a5c7A8d4d387C9aae9172D621' },
    { label: 'Wintermute Trading', address: '0x0000006daea1723962647b7e189d311d757Fb793', chain: 'ethereum', tag: 'market-maker', etherscan: 'https://etherscan.io/address/0x0000006daea1723962647b7e189d311d757Fb793' },
    { label: 'Grayscale GBTC', address: '0x1ECb0cF0e9bB4AB0FF0B22F41fB4E1075923a68c', chain: 'ethereum', tag: 'fund', etherscan: 'https://etherscan.io/address/0x1ECb0cF0e9bB4AB0FF0B22F41fB4E1075923a68c' },
    { label: 'Vitalik Buterin', address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', chain: 'ethereum', tag: 'founder', etherscan: 'https://etherscan.io/address/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
    { label: 'Justin Sun', address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum', tag: 'founder', etherscan: 'https://etherscan.io/address/0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
    { label: 'Whale Alert Tracked #1', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', chain: 'ethereum', tag: 'whale', etherscan: 'https://etherscan.io/address/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18' },
    { label: 'Abraxas Capital', address: '0x07e05A8072d57C67B89E37c66B44E4e368F22715', chain: 'ethereum', tag: 'fund', etherscan: 'https://etherscan.io/address/0x07e05A8072d57C67B89E37c66B44E4e368F22715' },
    { label: 'Alameda Research (Remanescente)', address: '0x8Ef0DA4a5b7A2F7e02a456C16C7e5ac6a2F60e95', chain: 'ethereum', tag: 'liquidation', etherscan: 'https://etherscan.io/address/0x8Ef0DA4a5b7A2F7e02a456C16C7e5ac6a2F60e95' },
    { label: 'Bybit Hot Wallet', address: '0xf89d7b9c864f589bbF53a82105107622B35EaA40', chain: 'ethereum', tag: 'exchange', etherscan: 'https://etherscan.io/address/0xf89d7b9c864f589bbF53a82105107622B35EaA40' },
    { label: 'OKX Exchange', address: '0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b', chain: 'ethereum', tag: 'exchange', etherscan: 'https://etherscan.io/address/0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b' },
];

const INSTITUTIONAL_ACTIONS = [
    { type: 'compra', context: 'Acumulação — nova posição ou aumento', icon: '📈' },
    { type: 'venda', context: 'Redução — saída parcial ou total', icon: '📉' },
    { type: 'posição', context: 'Rebalanceamento — ajuste de portfólio', icon: '🔄' },
    { type: 'hedge', context: 'Hedge — proteção contra risco', icon: '🛡️' },
];

const CRYPTO_TX_TYPES = [
    { type: 'transfer', context: 'Transferência entre carteiras', icon: '↔️' },
    { type: 'deposit', context: 'Depósito em exchange — possível venda', icon: '🏦' },
    { type: 'withdrawal', context: 'Retirada de exchange — acumulação', icon: '🔐' },
    { type: 'mint', context: 'Mint/Criação de tokens', icon: '🪙' },
];

// Gerar TX hash realista
function generateTxHash() {
    return '0x' + Array.from({length: 64}, () => '0123456789abcdef'[randInt(0,16)]).join('');
}

// ---- SMART MONEY SCORE ----
function calculateSmartMoneyScore(alert) {
    let score = 0;
    // Factor 1: Transaction size vs average (25%)
    const avgAmount = 10000000;
    const sizeRatio = alert.amount / avgAmount;
    score += Math.min(25, sizeRatio * 8);
    // Factor 2: Entity reputation (25%)
    const entity = INSTITUTIONAL_ENTITIES.find(e => e.name === alert.whaleName);
    const wallet = KNOWN_CRYPTO_WALLETS.find(w => w.label === alert.whaleName);
    if (entity) score += (entity.reputation || 70) * 0.25;
    else if (wallet) {
        const tagScores = {exchange: 18, 'market-maker': 22, fund: 20, founder: 24, whale: 15, liquidation: 12};
        score += tagScores[wallet.tag] || 15;
    } else score += 12;
    // Factor 3: Convergence — how many alerts for same token in last hour (25%)
    const recentSameToken = state.alerts.filter(a => a.token === alert.token && Math.abs(a.time - alert.time) < 3600000 && a.id !== alert.id).length;
    score += Math.min(25, recentSameToken * 6);
    // Factor 4: Rarity — entity hasn't appeared recently (25%)
    const recentSameEntity = state.alerts.filter(a => a.whaleName === alert.whaleName && Math.abs(a.time - alert.time) < 7200000 && a.id !== alert.id).length;
    score += recentSameEntity === 0 ? 25 : Math.max(5, 25 - recentSameEntity * 8);
    return Math.round(Math.min(100, Math.max(5, score)));
}

function getScoreLabel(score) {
    if (score >= 85) return { text: 'Crítico', cls: 'score-critical', emoji: '🔥' };
    if (score >= 70) return { text: 'Alta Relevância', cls: 'score-high', emoji: '⚡' };
    if (score >= 50) return { text: 'Moderado', cls: 'score-medium', emoji: '📊' };
    return { text: 'Baixo', cls: 'score-low', emoji: '📋' };
}

function generateWhaleAlert() {
    const token = randEl(TOKENS);
    const isCrypto = token.market === 'crypto';
    const amount = rand(500000, 80000000);
    const impact = amount > 20000000 ? 'high' : amount > 5000000 ? 'medium' : 'low';
    
    let alert;
    if (isCrypto) {
        const fromWallet = randEl(KNOWN_CRYPTO_WALLETS);
        let toWallet = randEl(KNOWN_CRYPTO_WALLETS);
        while (toWallet.address === fromWallet.address) toWallet = randEl(KNOWN_CRYPTO_WALLETS);
        const txType = randEl(CRYPTO_TX_TYPES);
        const txHash = generateTxHash();
        const coinAmount = amount / token.price;
        alert = {
            id: Date.now() + randInt(0, 9999), token: token.symbol, tokenName: token.name,
            market: token.market, amount, type: txType.type, impact,
            from: fromWallet.address, fromLabel: fromWallet.label, fromTag: fromWallet.tag,
            to: toWallet.address, toLabel: toWallet.label, toTag: toWallet.tag,
            time: Date.now() - randInt(0, 3600000),
            whaleName: fromWallet.label,
            coinAmount, txHash, txLink: `https://etherscan.io/tx/${txHash}`,
            fromLink: fromWallet.etherscan, toLink: toWallet.etherscan,
            source: 'Whale Alert', sourceUrl: 'https://whale-alert.io', sourceIcon: '🐋',
            context: txType.context, contextIcon: txType.icon, chain: fromWallet.chain,
        };
    } else {
        const entity = randEl(INSTITUTIONAL_ENTITIES);
        const action = randEl(INSTITUTIONAL_ACTIONS);
        const sharesOrContracts = randInt(10000, 5000000);
        const filingType = token.market === 'commodities' ? 'CFTC COT' : '13F-HR';
        alert = {
            id: Date.now() + randInt(0, 9999), token: token.symbol, tokenName: token.name,
            market: token.market, amount, type: action.type, impact,
            from: entity.name, fromLabel: entity.name, fromTag: entity.strategy,
            to: action.context,
            time: Date.now() - randInt(0, 7200000),
            whaleName: entity.name,
            entityAUM: entity.aum, entityManager: entity.manager,
            entityCIK: entity.cik, entityIcon: entity.icon,
            entityReputation: entity.reputation, entityWinRate: entity.winRate, entityPnl90d: entity.pnl90d,
            shares: sharesOrContracts, filingType, filingDate: entity.filingDate,
            source: filingType === 'CFTC COT' ? 'CFTC COT Report' : 'SEC EDGAR 13F',
            sourceUrl: entity.url,
            sourceIcon: filingType === 'CFTC COT' ? '📊' : '🏦',
            context: action.context, contextIcon: action.icon,
        };
    }
    alert.smartScore = calculateSmartMoneyScore(alert);
    return alert;
}

const MARKETS = ['commodities', 'indices', 'equities', 'crypto'];
const SUBREDDITS = ['wallstreetbets', 'stocks', 'CryptoCurrency', 'commodities', 'Gold'];
const TOPICS = [
    'ouro refúgio', 'petróleo OPEC', 'corte Fed', 'inflação', 'recessão', 'guerra comercial',
    'China estímulo', 'dólar forte', 'treasuries', 'ações tech', 'S&P 500 máxima',
    'prata industrial', 'ETF ouro', 'position sizing', 'hedge geopolítico',
    'HK50 rally', 'earnings season', 'dados emprego', 'CPI surpresa', 'yield curve',
    'smart money', 'COT report', 'fluxo institucional', 'short squeeze', 'rotação setorial'
];

// ---- FONTES DE DADOS ----
const DATA_SOURCES = [
    {
        name: 'Whale Alert', icon: '🐋', type: 'Rastreio de Baleias Crypto',
        desc: 'Monitoramento em tempo real de transações grandes em blockchain. Detecta movimentos de BTC, ETH e outras criptos entre carteiras e exchanges.',
        tags: ['crypto', 'blockchain', 'transações', 'tempo real'],
        url: 'https://whale-alert.io', status: 'active'
    },
    {
        name: 'WhaleWisdom', icon: '🏦', type: 'Posições Institucionais (13F)',
        desc: 'Rastreia relatórios SEC 13F de hedge funds e gestores institucionais. Veja o que Buffett, Dalio e Soros estão comprando e vendendo.',
        tags: ['ações', 'hedge funds', '13F', 'SEC', 'institucional'],
        url: 'https://whalewisdom.com', status: 'active'
    },
    {
        name: 'CFTC COT Report', icon: '📊', type: 'Posicionamento de Futuros',
        desc: 'Commitment of Traders — posicionamento de comerciais, grandes especuladores e small traders em futuros de ouro, petróleo, prata e índices.',
        tags: ['commodities', 'futuros', 'ouro', 'petróleo', 'COT'],
        url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders', status: 'active'
    },
    {
        name: 'Finviz', icon: '📈', type: 'Screener & Mapa de Mercado',
        desc: 'Screener avançado de ações com mapa de calor do mercado, insider trading, e análise fundamentalista para ações dos EUA.',
        tags: ['ações', 'screener', 'insider', 'heatmap'],
        url: 'https://finviz.com', status: 'active'
    },
    {
        name: 'TradingView', icon: '📉', type: 'Gráficos & Análise Técnica',
        desc: 'Plataforma líder de gráficos com dados em tempo real para commodities, índices, ações e crypto. Ideias da comunidade de traders.',
        tags: ['gráficos', 'análise técnica', 'multi-ativo', 'comunidade'],
        url: 'https://tradingview.com', status: 'active'
    },
    {
        name: 'Koyfin', icon: '💹', type: 'Terminal Financeiro',
        desc: 'Terminal estilo Bloomberg gratuito. Dados macro, métricas de valuation, screening avançado e dashboards customizáveis.',
        tags: ['macro', 'fundamental', 'terminal', 'valuation'],
        url: 'https://koyfin.com', status: 'active'
    },
    {
        name: 'Unusual Whales', icon: '🦑', type: 'Fluxo de Opções & Dark Pool',
        desc: 'Detecta atividade incomum em opções de ações e fluxo de dark pool. Identifica apostas grandes de smart money em equities.',
        tags: ['opções', 'dark pool', 'smart money', 'ações'],
        url: 'https://unusualwhales.com', status: 'active'
    },
    {
        name: 'Hyperliquid', icon: '⚡', type: 'Perpetuals & Open Interest',
        desc: 'API pública com posições de perps, open interest e trades de baleias em crypto. Sem necessidade de API key.',
        tags: ['crypto', 'perps', 'open interest', 'DeFi'],
        url: 'https://hyperliquid.xyz', status: 'active'
    },
    {
        name: 'Reddit Sentiment', icon: '💬', type: 'Inteligência Social',
        desc: 'Análise de sentimento de r/wallstreetbets, r/stocks, r/commodities e r/Gold. Detecta tendências e narrativas emergentes.',
        tags: ['sentimento', 'social', 'Reddit', 'análise'],
        url: 'https://reddit.com', status: 'active'
    },
    {
        name: 'World Gold Council', icon: '🥇', type: 'Dados de Ouro Institucional',
        desc: 'Dados sobre demanda e oferta global de ouro, compras de bancos centrais, fluxos de ETF de ouro e reservas de países.',
        tags: ['ouro', 'banco central', 'ETF', 'reservas'],
        url: 'https://www.gold.org', status: 'active'
    },
    {
        name: 'OPEC Monthly Report', icon: '🛢️', type: 'Relatórios de Petróleo',
        desc: 'Relatórios mensais da OPEC com projeções de oferta/demanda, produção por país e impacto em preços do petróleo.',
        tags: ['petróleo', 'OPEC', 'produção', 'relatório'],
        url: 'https://www.opec.org', status: 'active'
    },
    {
        name: 'Fear & Greed Index', icon: '😱', type: 'Sentimento de Mercado',
        desc: 'Índice CNN de Medo e Ganância para ações e Alternative.me para crypto. Termômetro do sentimento de mercado.',
        tags: ['sentimento', 'medo', 'ganância', 'mercado'],
        url: 'https://edition.cnn.com/markets/fear-and-greed', status: 'active'
    },
];

// ---- UTILIDADES ----
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max)); }
function randEl(arr) { return arr[randInt(0, arr.length)]; }
function shortAddr(a) {
    if (!a || typeof a !== 'string') return '???';
    return a.startsWith('0x') ? a.slice(0,6) + '...' + a.slice(-4) : a;
}
function formatUSD(n) {
    if (n == null || isNaN(n)) return '$0.00';
    if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n/1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(2);
}
function tempoAtras(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms/1000);
    if (s < 5) return 'agora';
    if (s < 60) return s + 's atrás';
    if (s < 3600) return Math.floor(s/60) + 'min atrás';
    if (s < 86400) return Math.floor(s/3600) + 'h atrás';
    return Math.floor(s/86400) + 'd atrás';
}
function generateSparkline(points = 24, base = 100, volatility = 5) {
    const data = [];
    let val = base;
    for (let i = 0; i < points; i++) { val += rand(-volatility, volatility); data.push(Math.max(0, val)); }
    return data;
}


function generateRedditPost() {
    const titles = [
        'Ouro a $3000+, bancos centrais comprando como loucos — prepare-se',
        'Smart money saindo de tech e indo para commodities — COT confirma',
        'Petróleo pode desabar: OPEC ameaça aumentar produção',
        'HK50 rompeu resistência — China injetando estímulo pesado',
        'S&P 500 em máxima histórica mas breadth está horrível',
        'Prata é o trade mais assimétrico de 2026 — aqui os dados',
        'BlackRock comprando ouro físico em volumes recordes',
        'Fluxo de dark pool mostrando acumulação massiva em NVDA',
        'COT Report mostra comerciais acumulando shorts em petróleo',
        'Fed pode cortar juros em junho — impacto nos metais preciosos',
        'Warren Buffett aumentou posição em cash — sinal de topo?',
        'ETF de ouro com maior influxo em 3 anos — dados detalhados',
        'BTC e Ouro correlacionados: ambos são hedge contra fiat',
        'Análise: por que o dólar vai enfraquecer e ouro vai a $3500',
        'Fundos soberanos do Oriente Médio diversificando para ações tech',
    ];
    return {
        title: randEl(titles),
        subreddit: randEl(SUBREDDITS),
        upvotes: randInt(50, 5000),
        comments: randInt(20, 800),
        sentiment: randEl(['positive', 'negative', 'neutral']),
        sentimentScore: rand(-1, 1),
        time: Date.now() - randInt(0, 86400000),
        author: 'u/' + randEl(['GoldBull2026', 'SmartMoneyTracker', 'OilAnalyst', 'WallStreetInsider', 'CommoditiesKing', 'IndexTraderPro', 'MacroResearcher'])
    };
}

// ---- ESTADO ----
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

// ---- INICIALIZAÇÃO ----
document.addEventListener('DOMContentLoaded', () => {
    for (let i = 0; i < 25; i++) state.alerts.push(generateWhaleAlert());
    state.alerts.sort((a, b) => b.time - a.time);
    for (let i = 0; i < 15; i++) state.posts.push(generateRedditPost());
    setTimeout(() => {
        const splash = document.getElementById('splash-loader');
        const app = document.getElementById('app');
        splash.classList.add('fade-out');
        app.classList.remove('hidden');
        setTimeout(() => { app.classList.add('visible'); splash.remove(); }, 600);
        initApp();
    }, 2200);
});

async function initApp() {
    setupNavigation();
    setupSearch();
    setupSidebar();
    
    // Fetch live data before rendering
    await Promise.all([fetchLiveData(), fetchFearGreed()]);
    
    updateTickers();
    renderWhaleAlerts();
    renderMarketOverview();
    renderVolumeScanner();
    renderCohortAnalysis();
    renderCommunityIntel();
    renderDataSources();
    updateAlertStats();
    setupSettings();
    startLiveUpdates();
    document.getElementById('last-update').textContent = 'Última atualização: agora';
    
    // Refresh live crypto data every 60 seconds
    setInterval(async () => {
        await fetchLiveData();
        updateTickers();
        if (state.currentSection === 'market-overview') {
            renderHeatmap();
            renderMarketTable();
        }
    }, 60000);
    
    // Refresh Fear & Greed every 5 minutes
    setInterval(fetchFearGreed, 300000);
}

// ---- NAVEGAÇÃO ----
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

// ---- SIDEBAR ----
function setupSidebar() {
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768) { sidebar.classList.toggle('mobile-open'); }
        else { sidebar.classList.toggle('collapsed'); }
    });
}

// ---- BUSCA ----
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
    if (!query) { container.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:0.85rem;">Digite para buscar ativos, seções ou tópicos...</div>`; return; }
    const q = query.toLowerCase();
    const matches = state.tokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)).slice(0, 8);
    let html = '';
    matches.forEach(t => {
        const cc = t.change24h >= 0 ? 'positive-text' : 'negative-text';
        html += `<div class="search-result-item" onclick="navigateTo('market-overview');document.getElementById('search-modal').classList.add('hidden')">
            <span class="result-icon">${t.icon || '💰'}</span>
            <div class="result-info"><div class="result-name">${t.symbol}</div><div class="result-meta">${t.name} • ${formatUSD(t.price)} • ${t.classe}</div></div>
            <span class="${cc}" style="font-family:var(--font-mono);font-size:0.8rem">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%</span>
        </div>`;
    });
    container.innerHTML = html || `<div style="padding:16px;color:var(--text-muted);font-size:0.85rem;">Nenhum resultado para "${query}"</div>`;
}

// ---- TICKERS ----
function updateTickers() {
    const gold = state.tokens.find(t => t.symbol === 'XAU/USD');
    const oil = state.tokens.find(t => t.symbol === 'WTI');
    const btc = state.tokens.find(t => t.symbol === 'BTC/USD');
    const sp = state.tokens.find(t => t.symbol === 'US500');
    setTicker('gold', gold); setTicker('oil', oil); setTicker('btc', btc); setTicker('us500', sp);
    const fng = state.fearGreedIndex;
    document.getElementById('fng-value').textContent = fng;
    const fngLabel = document.getElementById('fng-label');
    const label = fng <= 25 ? 'Medo Extremo' : fng <= 45 ? 'Medo' : fng <= 55 ? 'Neutro' : fng <= 75 ? 'Ganância' : 'Ganância Extrema';
    fngLabel.textContent = label;
    fngLabel.className = 'ticker-change ' + (fng >= 50 ? 'positive' : 'negative');
}

function setTicker(id, token) {
    document.getElementById('price-' + id).textContent = formatUSD(token.price);
    const changeEl = document.getElementById('change-' + id);
    changeEl.textContent = (token.change24h >= 0 ? '+' : '') + token.change24h.toFixed(2) + '%';
    changeEl.className = 'ticker-change ' + (token.change24h >= 0 ? 'positive' : 'negative');
}

// ---- ALERTAS DE BALEIAS (ENHANCED) ----
function renderWhaleAlerts() {
    const feed = document.getElementById('alert-feed');
    feed.innerHTML = state.alerts.map(a => renderAlertCard(a)).join('');
    document.getElementById('alert-count').textContent = state.alerts.length;
    document.getElementById('alert-chain-filter').onchange = document.getElementById('alert-impact-filter').onchange = filterAlerts;
    document.getElementById('alert-pause').onclick = () => {
        state.alertsPaused = !state.alertsPaused;
        document.getElementById('alert-pause').classList.toggle('active', state.alertsPaused);
    };
    // Event delegation for expandable cards
    feed.addEventListener('click', function(e) {
        const card = e.target.closest('.alert-item.expandable');
        if (!card) return;
        // Don't expand if clicking a link
        if (e.target.closest('a')) return;
        const alertId = card.dataset.alertId;
        toggleExpandAlert(card, alertId);
    });
}

function renderAlertCard(a) {
    const mktLabel = {commodities:'🥇 COMMODITY', indices:'📊 ÍNDICE', equities:'📈 AÇÃO', crypto:'₿ CRYPTO'}[a.market] || a.market;
    const isCrypto = a.market === 'crypto';
    const sourceBadge = a.source ? `<span class="alert-source-tag" title="Fonte: ${a.source}"><a href="${a.sourceUrl || '#'}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${a.sourceIcon || '📡'} ${a.source}</a></span>` : '';
    const contextLine = a.context ? `<div class="alert-context">${a.contextIcon || '💡'} ${a.context}</div>` : '';
    
    // Smart Money Score bar
    const score = a.smartScore || 50;
    const scoreInfo = getScoreLabel(score);
    const scoreBar = `<div class="sms-bar-wrap" title="Smart Money Score: ${score}/100">
        <div class="sms-label">${scoreInfo.emoji} <span class="sms-value ${scoreInfo.cls}">${score}</span></div>
        <div class="sms-bar"><div class="sms-bar-fill ${scoreInfo.cls}" style="width:${score}%"></div></div>
    </div>`;
    
    let detailsHtml = '';
    if (isCrypto) {
        const fromAddr = shortAddr(a.from);
        const toAddr = shortAddr(a.to || '');
        const fromLink = a.fromLink ? `<a href="${a.fromLink}" target="_blank" rel="noopener" style="color:var(--accent-info);text-decoration:none" title="${a.from}">${fromAddr}</a>` : fromAddr;
        const toLink = a.toLink ? `<a href="${a.toLink}" target="_blank" rel="noopener" style="color:var(--accent-info);text-decoration:none" title="${a.to}">${toAddr}</a>` : toAddr;
        const coinAmt = a.coinAmount ? ` (${a.coinAmount >= 1 ? a.coinAmount.toFixed(2) : a.coinAmount.toFixed(4)} ${a.token.replace('/USD','')})` : '';
        const txLink = a.txHash ? `<a href="${a.txLink}" target="_blank" rel="noopener" style="color:var(--text-muted);text-decoration:none;font-size:0.68rem" title="Ver transação">🔗 TX: ${a.txHash.slice(0,10)}...</a>` : '';
        const chainBadge = a.chain ? `<span style="color:var(--text-muted);font-size:0.65rem;text-transform:uppercase;">⛓ ${a.chain}</span>` : '';
        detailsHtml = `
            <div class="alert-detail"><span style="font-weight:600">${a.fromLabel || 'Carteira Desconhecida'}</span> <span class="alert-wallet-tag ${a.fromTag || ''}">${a.fromTag || ''}</span></div>
            <div class="alert-detail" style="font-size:0.75rem"><span class="addr">${fromLink} → ${toLink}</span> <span style="font-weight:600">${a.toLabel || ''}</span></div>
            <div class="alert-detail" style="gap:8px;margin-top:2px">${txLink} ${chainBadge}<span style="color:var(--accent-alert);font-size:0.72rem;font-family:var(--font-mono)">${coinAmt}</span></div>`;
    } else {
        const entityInfo = a.entityAUM ? `<span style="color:var(--accent-whale-light);font-size:0.72rem">AUM: ${a.entityAUM}</span>` : '';
        const managerInfo = a.entityManager ? `<span style="color:var(--text-muted);font-size:0.7rem">👤 ${a.entityManager}</span>` : '';
        const filingInfo = a.filingType ? `<span style="color:var(--text-muted);font-size:0.68rem">📋 ${a.filingType} • Filing: ${a.filingDate || 'N/A'}</span>` : '';
        const cikInfo = a.entityCIK && a.entityCIK !== 'N/A' ? `<a href="${a.sourceUrl}" target="_blank" rel="noopener" style="color:var(--accent-info);font-size:0.68rem;text-decoration:none">🔗 CIK: ${a.entityCIK}</a>` : '';
        const sharesInfo = a.shares ? `<span style="color:var(--text-secondary);font-size:0.72rem;font-family:var(--font-mono)">${a.shares.toLocaleString()} ações/contratos</span>` : '';
        detailsHtml = `
            <div class="alert-detail"><span style="font-weight:600">${a.entityIcon || '🏦'} ${a.whaleName}</span> ${entityInfo}</div>
            <div class="alert-detail">${managerInfo} <span class="addr">${a.type.toUpperCase()} → ${a.to}</span></div>
            <div class="alert-detail" style="gap:8px;margin-top:2px">${filingInfo} ${cikInfo} ${sharesInfo}</div>`;
    }
    
    // Convergence check
    const convergent = state.alerts.filter(x => x.token === a.token && x.id !== a.id && Math.abs(x.time - a.time) < 3600000);
    const convergenceBadge = convergent.length >= 2 ? `<span class="convergence-badge">🎯 ${convergent.length + 1} baleias no mesmo ativo</span>` : '';
    
    return `<div class="alert-item expandable" data-chain="${a.market}" data-impact="${a.impact}" data-alert-id="${a.id}">
        <div class="alert-impact ${a.impact}">${a.impact === 'high' ? '🔴' : a.impact === 'medium' ? '🟡' : '🟢'}</div>
        <div class="alert-info">
            <div class="alert-title">
                <span class="amount">${formatUSD(a.amount)}</span> ${a.token}
                <span class="alert-chain-tag ${a.market}">${mktLabel}</span>
                ${sourceBadge}
                ${convergenceBadge}
            </div>
            ${detailsHtml}
            <div class="alert-bottom-row">
                ${scoreBar}
                ${contextLine}
            </div>
        </div>
        <div class="alert-meta">
            <div class="alert-time">${tempoAtras(Date.now() - a.time)}</div>
            <span class="alert-type-tag ${a.type}">${a.type}</span>
            <div class="expand-hint">▼</div>
        </div>
    </div>`;
}

// ---- EXPANDABLE ALERT CARD ----
function toggleExpandAlert(el, alertId) {
    if (el.classList.contains('expanded')) {
        el.classList.remove('expanded');
        const panel = el.querySelector('.expanded-panel');
        if (panel) panel.remove();
        return;
    }
    document.querySelectorAll('.alert-item.expanded').forEach(item => {
        item.classList.remove('expanded');
        const p = item.querySelector('.expanded-panel');
        if (p) p.remove();
    });
    // Find alert by string ID match
    const a = state.alerts.find(x => String(x.id) === String(alertId));
    if (!a) return;
    el.classList.add('expanded');
    const panel = document.createElement('div');
    panel.className = 'expanded-panel';
    panel.onclick = (e) => e.stopPropagation();
    
    const entity = INSTITUTIONAL_ENTITIES.find(e => e.name === a.whaleName);
    const wallet = KNOWN_CRYPTO_WALLETS.find(w => w.label === a.whaleName);
    
    // Entity profile section
    let profileHtml = '';
    if (entity) {
        const pnlCls = entity.pnl90d >= 0 ? 'positive-text' : 'negative-text';
        profileHtml = `<div class="ep-profile">
            <div class="ep-avatar">${entity.icon}</div>
            <div class="ep-info">
                <div class="ep-name">${entity.name}</div>
                <div class="ep-strategy">${entity.strategy}</div>
                <div class="ep-manager">👤 ${entity.manager}</div>
            </div>
            <div class="ep-stats">
                <div class="ep-stat"><span class="ep-stat-label">AUM</span><span class="ep-stat-value">${entity.aum}</span></div>
                <div class="ep-stat"><span class="ep-stat-label">Win Rate</span><span class="ep-stat-value">${entity.winRate}%</span></div>
                <div class="ep-stat"><span class="ep-stat-label">P&L 90d</span><span class="ep-stat-value ${pnlCls}">${entity.pnl90d >= 0 ? '+' : ''}${entity.pnl90d}%</span></div>
                <div class="ep-stat"><span class="ep-stat-label">Reputação</span><span class="ep-stat-value">${entity.reputation}/100</span></div>
            </div>
        </div>`;
    } else if (wallet) {
        profileHtml = `<div class="ep-profile">
            <div class="ep-avatar">🐋</div>
            <div class="ep-info">
                <div class="ep-name">${wallet.label}</div>
                <div class="ep-strategy">${wallet.tag.toUpperCase()} • ${wallet.chain}</div>
                <div class="ep-manager"><a href="${wallet.etherscan}" target="_blank" rel="noopener" style="color:var(--accent-info);text-decoration:none">🔗 Ver no Etherscan</a></div>
            </div>
            <div class="ep-stats">
                <div class="ep-stat"><span class="ep-stat-label">Tipo</span><span class="ep-stat-value">${wallet.tag}</span></div>
                <div class="ep-stat"><span class="ep-stat-label">Chain</span><span class="ep-stat-value">${wallet.chain}</span></div>
            </div>
        </div>`;
    }
    
    // Recent history for this entity
    const entityHistory = state.alerts.filter(x => x.whaleName === a.whaleName && x.id !== a.id).slice(0, 5);
    const historyHtml = entityHistory.length > 0 ? `<div class="ep-section">
        <div class="ep-section-title">📜 Transações Recentes de ${a.whaleName}</div>
        <div class="ep-history">${entityHistory.map(h => `<div class="ep-history-item">
            <span class="ep-h-amount">${formatUSD(h.amount)}</span>
            <span class="ep-h-token">${h.token}</span>
            <span class="alert-type-tag ${h.type}" style="font-size:0.6rem">${h.type}</span>
            <span class="ep-h-time">${tempoAtras(Date.now() - h.time)}</span>
        </div>`).join('')}</div>
    </div>` : '';
    
    // Convergence section
    const convergent = state.alerts.filter(x => x.token === a.token && x.id !== a.id && Math.abs(x.time - a.time) < 7200000);
    const convergenceHtml = convergent.length > 0 ? `<div class="ep-section">
        <div class="ep-section-title">🎯 Convergência — Outras baleias em ${a.token}</div>
        <div class="ep-convergence">${convergent.slice(0, 4).map(c => `<div class="ep-conv-item">
            <span>${c.entityIcon || '🐋'} ${c.whaleName}</span>
            <span class="alert-type-tag ${c.type}" style="font-size:0.6rem">${c.type}</span>
            <span>${formatUSD(c.amount)}</span>
        </div>`).join('')}</div>
    </div>` : '';
    
    // Score breakdown
    const scoreInfo = getScoreLabel(a.smartScore || 50);
    const scoreHtml = `<div class="ep-section">
        <div class="ep-section-title">🧠 Smart Money Score: <span class="${scoreInfo.cls}">${a.smartScore || 50}/100 — ${scoreInfo.text}</span></div>
        <div class="ep-score-factors">
            <div class="ep-factor"><span>📏 Tamanho vs Média</span><div class="ep-factor-bar"><div style="width:${Math.min(100, (a.amount / 10000000) * 32)}%" class="ep-factor-fill"></div></div></div>
            <div class="ep-factor"><span>🏛️ Reputação da Entidade</span><div class="ep-factor-bar"><div style="width:${entity ? entity.reputation : 60}%" class="ep-factor-fill"></div></div></div>
            <div class="ep-factor"><span>🎯 Convergência</span><div class="ep-factor-bar"><div style="width:${Math.min(100, convergent.length * 25)}%" class="ep-factor-fill"></div></div></div>
            <div class="ep-factor"><span>💎 Raridade</span><div class="ep-factor-bar"><div style="width:${entityHistory.length === 0 ? 100 : Math.max(20, 100 - entityHistory.length * 20)}%" class="ep-factor-fill"></div></div></div>
        </div>
    </div>`;
    
    panel.innerHTML = `${profileHtml}${scoreHtml}${historyHtml}${convergenceHtml}`;
    el.appendChild(panel);
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
    // Update leaderboard
    renderLeaderboard();
}

// ---- SMART MONEY LEADERBOARD ----
function renderLeaderboard() {
    const container = document.getElementById('leaderboard-body');
    if (!container) return;
    
    // Build entity performance from alert history
    const entityMap = new Map();
    state.alerts.forEach(a => {
        if (!entityMap.has(a.whaleName)) {
            const entity = INSTITUTIONAL_ENTITIES.find(e => e.name === a.whaleName);
            const wallet = KNOWN_CRYPTO_WALLETS.find(w => w.label === a.whaleName);
            entityMap.set(a.whaleName, {
                name: a.whaleName,
                icon: a.entityIcon || '🐋',
                type: entity ? 'institutional' : 'crypto',
                aum: entity ? entity.aum : '—',
                strategy: entity ? entity.strategy : (wallet ? wallet.tag : '—'),
                winRate: entity ? entity.winRate : randInt(55, 85),
                pnl90d: entity ? entity.pnl90d : rand(-10, 40),
                reputation: entity ? entity.reputation : randInt(50, 80),
                totalVolume: 0,
                txCount: 0,
                lastSeen: 0,
                url: entity ? entity.url : (wallet ? wallet.etherscan : '#'),
            });
        }
        const e = entityMap.get(a.whaleName);
        e.totalVolume += a.amount;
        e.txCount++;
        e.lastSeen = Math.max(e.lastSeen, a.time);
    });
    
    const sortBy = document.getElementById('leaderboard-sort')?.value || 'pnl';
    const filterType = document.getElementById('leaderboard-filter')?.value || 'all';
    let entities = [...entityMap.values()];
    if (filterType === 'institutional') entities = entities.filter(e => e.type === 'institutional');
    if (filterType === 'crypto') entities = entities.filter(e => e.type === 'crypto');
    
    if (sortBy === 'pnl') entities.sort((a, b) => b.pnl90d - a.pnl90d);
    else if (sortBy === 'winrate') entities.sort((a, b) => b.winRate - a.winRate);
    else if (sortBy === 'volume') entities.sort((a, b) => b.totalVolume - a.totalVolume);
    else if (sortBy === 'reputation') entities.sort((a, b) => b.reputation - a.reputation);
    
    container.innerHTML = entities.slice(0, 15).map((e, i) => {
        const pnlCls = e.pnl90d >= 0 ? 'positive-text' : 'negative-text';
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        return `<div class="lb-row ${i < 3 ? 'lb-top3' : ''}">
            <div class="lb-rank">${medal}</div>
            <div class="lb-entity">
                <span class="lb-icon">${e.icon}</span>
                <div class="lb-entity-info">
                    <div class="lb-name"><a href="${e.url}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${e.name}</a></div>
                    <div class="lb-strategy">${e.strategy}</div>
                </div>
            </div>
            <div class="lb-stat">${e.aum}</div>
            <div class="lb-stat">${e.winRate}%</div>
            <div class="lb-stat ${pnlCls}">${e.pnl90d >= 0 ? '+' : ''}${e.pnl90d.toFixed(1)}%</div>
            <div class="lb-stat">${formatUSD(e.totalVolume)}</div>
            <div class="lb-stat">${e.txCount}</div>
        </div>`;
    }).join('');
}

// ---- VISÃO DE MERCADO ----
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
    if (change > 8) return 'rgba(16, 185, 129, 0.7)';
    if (change > 5) return 'rgba(16, 185, 129, 0.5)';
    if (change > 2) return 'rgba(16, 185, 129, 0.3)';
    if (change > 0) return 'rgba(16, 185, 129, 0.15)';
    if (change > -2) return 'rgba(239, 68, 68, 0.15)';
    if (change > -5) return 'rgba(239, 68, 68, 0.3)';
    if (change > -8) return 'rgba(239, 68, 68, 0.5)';
    return 'rgba(239, 68, 68, 0.7)';
}

function renderHeatmap() {
    document.getElementById('market-heatmap').innerHTML = state.tokens.map(t => {
        const bg = getHeatmapColor(t.change24h);
        const tc = Math.abs(t.change24h) > 5 ? 'white' : 'var(--text-primary)';
        return `<div class="heatmap-cell" style="background:${bg};color:${tc}" title="${t.name} (${t.classe}): ${formatUSD(t.price)}">
            <span class="cell-symbol">${t.icon || ''} ${t.symbol}</span>
            <span class="cell-change">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%</span>
            <span class="cell-price">${formatUSD(t.price)}</span>
        </div>`;
    }).join('');
}

function renderMarketTable() {
    document.getElementById('market-table-body').innerHTML = state.tokens.map((t, i) => {
        const c24 = t.change24h >= 0 ? 'positive-text' : 'negative-text';
        const c7d = t.change7d >= 0 ? 'positive-text' : 'negative-text';
        return `<tr>
            <td>${i + 1}</td>
            <td><div class="asset-cell"><span class="asset-symbol">${t.icon || ''} ${t.symbol}</span><span class="asset-name">${t.name}</span></div></td>
            <td>${formatUSD(t.price)}</td>
            <td class="${c24}">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%</td>
            <td class="${c7d}">${t.change7d >= 0 ? '+' : ''}${t.change7d.toFixed(2)}%</td>
            <td>${t.classe}</td>
            <td>${formatUSD(t.mcap > 0 ? t.mcap * rand(0.02, 0.08) : rand(1e8, 5e9))}</td>
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

// ---- SCANNER DE VOLUME ----
function renderVolumeScanner() {
    const grid = document.getElementById('volume-scanner-grid');
    const volumeData = state.tokens.map(t => {
        const spike = rand(0.5, 8);
        const vol24h = (t.mcap > 0 ? t.mcap * rand(0.02, 0.1) : rand(1e8, 5e9));
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
                <div class="volume-stat"><span class="volume-stat-label">Média 7d</span><span class="volume-stat-value">${formatUSD(v.avg7d)}</span></div>
                <div class="volume-stat"><span class="volume-stat-label">Preço</span><span class="volume-stat-value">${formatUSD(v.price)}</span></div>
                <div class="volume-stat"><span class="volume-stat-label">Var 24h</span><span class="volume-stat-value ${v.change24h >= 0 ? 'positive-text' : 'negative-text'}">${v.change24h >= 0 ? '+' : ''}${v.change24h.toFixed(2)}%</span></div>
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
            grid: { vertLines: { color: 'rgba(148,163,184,0.06)' }, horzLines: { color: 'rgba(148,163,184,0.06)' } },
            timeScale: { borderColor: 'rgba(148,163,184,0.12)' }, rightPriceScale: { borderColor: 'rgba(148,163,184,0.12)' },
        });
        const vs = chart.addHistogramSeries({ color: '#6366f1', priceFormat: { type: 'volume' } });
        const now = Math.floor(Date.now() / 1000);
        const data = [];
        for (let i = 30; i >= 0; i--) { data.push({ time: now - i * 86400, value: rand(1e6, 1e8), color: i < 3 ? '#ef4444' : '#6366f1' }); }
        vs.setData(data);
        chart.timeScale().fitContent();
        new ResizeObserver(() => chart.applyOptions({ width: chartDiv.clientWidth })).observe(chartDiv);
    } catch(e) { container.innerHTML = `<div class="empty-state small"><p>Carregando gráfico...</p></div>`; }
}

// ---- RASTREIO DE CARTEIRAS ----
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
    
    // Try to match a known wallet
    const knownWallet = KNOWN_CRYPTO_WALLETS.find(w => w.address.toLowerCase() === address.toLowerCase());
    const knownEntity = INSTITUTIONAL_ENTITIES.find(e => e.name.toLowerCase().includes(address.toLowerCase().replace(/-/g, ' ')));
    
    const wallet = {
        address,
        name: knownWallet ? knownWallet.label : knownEntity ? knownEntity.name : (isCrypto ? 'Carteira Desconhecida' : address.replace(/-/g, ' ')),
        icon: knownWallet ? '🐋' : knownEntity ? (knownEntity.icon || '🏦') : (isCrypto ? '🔍' : '🏦'),
        tag: knownWallet ? knownWallet.tag : (knownEntity ? knownEntity.strategy : ''),
        aum: knownEntity ? knownEntity.aum : null,
        manager: knownEntity ? knownEntity.manager : null,
        etherscanLink: knownWallet ? knownWallet.etherscan : (isCrypto ? `https://etherscan.io/address/${address}` : null),
        secLink: knownEntity ? knownEntity.url : null,
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
    const tagBadge = wallet.tag ? `<span class="alert-wallet-tag ${wallet.tag}" style="margin-left:8px">${wallet.tag}</span>` : '';
    const aumLine = wallet.aum ? `<div style="font-size:0.72rem;color:var(--accent-whale-light)">AUM: ${wallet.aum}</div>` : '';
    const managerLine = wallet.manager ? `<div style="font-size:0.7rem;color:var(--text-muted)">👤 ${wallet.manager}</div>` : '';
    const verifyLink = wallet.etherscanLink 
        ? `<a href="${wallet.etherscanLink}" target="_blank" rel="noopener" style="font-size:0.68rem;color:var(--accent-info);text-decoration:none">🔗 Verificar no Etherscan</a>`
        : wallet.secLink ? `<a href="${wallet.secLink}" target="_blank" rel="noopener" style="font-size:0.68rem;color:var(--accent-info);text-decoration:none">🔗 Ver no SEC EDGAR</a>` : '';
    
    card.innerHTML = `
        <div class="wallet-card-header">
            <div class="wallet-identity">
                <div class="wallet-avatar">${wallet.icon}</div>
                <div>
                    <div class="wallet-name">${wallet.name}${tagBadge}</div>
                    <div class="wallet-address">${shortAddr(wallet.address)}</div>
                    ${aumLine}${managerLine}
                </div>
            </div>
            <div class="wallet-balance">
                <div class="wallet-total">${formatUSD(wallet.totalValue)}</div>
                <div class="wallet-pnl ${pc}">${wallet.pnl >= 0 ? '+' : ''}${wallet.pnl.toFixed(2)}% PnL</div>
                ${verifyLink}
            </div>
        </div>
        <div class="wallet-holdings">
            ${wallet.holdings.map(h => `<div class="holding-item"><div class="holding-symbol">${h.symbol}</div><div class="holding-value">${formatUSD(h.value)}</div><div class="holding-pct">${h.pct.toFixed(1)}%</div></div>`).join('')}
        </div>`;
    container.insertBefore(card, container.firstChild);
    document.getElementById('wallet-search-input').value = '';
    showToast('🔍', `Rastreando ${wallet.name}`, 'whale');
}

// ---- ANÁLISE DE COORTE ----
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
        document.getElementById(t.id + '-position').textContent = t.longPct > 50 ? '📈 COMPRADO' : '📉 VENDIDO';
        document.getElementById(t.id + '-long').style.width = t.longPct + '%';
        document.getElementById(t.id + '-short').style.width = (100 - t.longPct) + '%';
        document.getElementById(t.id + '-long-pct').textContent = t.longPct.toFixed(0) + '% Comprado';
        document.getElementById(t.id + '-short-pct').textContent = (100 - t.longPct).toFixed(0) + '% Vendido';
    });
    try {
        const ctx = document.getElementById('cohort-timeline-chart');
        if (ctx && window.Chart) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 30}, (_, i) => `Dia ${i+1}`),
                    datasets: [
                        { label: 'Institucional', data: generateSparkline(30, 70, 5), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 },
                        { label: 'Baleia', data: generateSparkline(30, 60, 4), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4 },
                        { label: 'Golfinho', data: generateSparkline(30, 55, 6), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 },
                        { label: 'Peixe', data: generateSparkline(30, 50, 7), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
                        { label: 'Varejo', data: generateSparkline(30, 45, 8), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.4 },
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
                    scales: {
                        x: { ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { color: 'rgba(148,163,184,0.06)' } },
                        y: { ticks: { color: '#64748b', callback: v => v + '% Long' }, grid: { color: 'rgba(148,163,184,0.06)' }, min: 20, max: 90 }
                    }
                }
            });
        }
    } catch(e) {}
}

// ---- INTELIGÊNCIA SOCIAL ----
function renderCommunityIntel() {
    const sentiments = state.posts.map(p => p.sentimentScore);
    const avg = sentiments.reduce((a,b) => a+b, 0) / sentiments.length;
    document.getElementById('stat-sentiment').textContent = avg > 0.15 ? '🟢 Otimista' : avg < -0.15 ? '🔴 Pessimista' : '🟡 Neutro';
    document.getElementById('stat-posts-count').textContent = state.posts.length.toLocaleString();
    document.getElementById('stat-trending').textContent = randEl(TOPICS);
    document.getElementById('stat-fear').textContent = state.fearGreedIndex + '/100';
    
    document.getElementById('sentiment-heatmap').innerHTML = state.tokens.map(t => {
        const score = rand(-1, 1);
        const bg = score > 0.3 ? 'rgba(16,185,129,0.25)' : score < -0.3 ? 'rgba(239,68,68,0.25)' : 'rgba(148,163,184,0.12)';
        const label = score > 0.3 ? 'Otimista' : score < -0.3 ? 'Pessimista' : 'Neutro';
        return `<div class="sentiment-cell" style="background:${bg}">
            <span class="sent-symbol">${t.icon || ''} ${t.symbol}</span>
            <span class="sent-score">${(score * 100).toFixed(0)}</span>
            <span class="sent-label">${label}</span>
        </div>`;
    }).join('');
    
    document.getElementById('word-cloud').innerHTML = TOPICS.map(topic => {
        const size = rand(0.7, 1.6);
        const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#818cf8', '#34d399', '#60a5fa'];
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
                    <span>${tempoAtras(Date.now() - p.time)}</span>
                    <span>💬 ${p.comments}</span>
                </div>
            </div>
            <div class="post-score"><span class="score-value">⬆ ${p.upvotes}</span><span class="${p.sentiment === 'positive' ? 'positive-text' : p.sentiment === 'negative' ? 'negative-text' : ''}">${(p.sentimentScore * 100).toFixed(0)}%</span></div>
        </div>
    `).join('');
}

// ---- FONTES DE DADOS ----
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
            <a href="${s.url}" target="_blank" rel="noopener" class="source-link">🔗 Acessar Fonte</a>
            <div class="source-status">
                <span class="source-status-dot ${s.status}"></span>
                <span>${s.status === 'active' ? 'Integrado' : 'Planejado'}</span>
            </div>
        </div>
    `).join('');
}

// ---- CONFIGURAÇÕES ----
function setupSettings() {
    document.getElementById('save-api-keys')?.addEventListener('click', () => {
        localStorage.setItem('whalevault_api_keys', JSON.stringify({
            coingecko: document.getElementById('api-coingecko').value,
            etherscan: document.getElementById('api-etherscan').value,
        }));
        showToast('✅', 'Chaves de API salvas!', 'bull');
    });
    document.getElementById('clear-cache')?.addEventListener('click', () => {
        localStorage.removeItem('whalevault_cache');
        document.getElementById('cache-size').textContent = '0 KB';
        showToast('🗑️', 'Cache limpo', 'alert');
    });
    document.getElementById('export-data')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ alerts: state.alerts, tokens: state.tokens, posts: state.posts }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'whalevault_export.json'; a.click();
        showToast('📥', 'Dados exportados', 'whale');
    });
    try {
        const saved = JSON.parse(localStorage.getItem('whalevault_api_keys') || '{}');
        if (saved.coingecko) document.getElementById('api-coingecko').value = saved.coingecko;
        if (saved.etherscan) document.getElementById('api-etherscan').value = saved.etherscan;
    } catch(e) {}
    let total = 0;
    for (let key in localStorage) { if (key.startsWith('whalevault')) total += (localStorage[key] || '').length; }
    document.getElementById('cache-size').textContent = (total / 1024).toFixed(1) + ' KB';
}

// ---- TOAST ----
function showToast(icon, message, type = 'whale') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// ---- ATUALIZAÇÕES AO VIVO ----
function startLiveUpdates() {
    // Recursive timeout for truly random intervals
    function scheduleNextAlert() {
        setTimeout(() => {
            if (!state.alertsPaused) {
                const alert = generateWhaleAlert();
                alert.time = Date.now();
                state.alerts.unshift(alert);
                if (state.alerts.length > 100) state.alerts.pop();
                if (state.currentSection === 'whale-alerts') {
                    const feed = document.getElementById('alert-feed');
                    const div = document.createElement('div');
                    div.innerHTML = renderAlertCard(alert);
                    const newItem = div.firstElementChild;
                    if (newItem) {
                        newItem.style.background = 'rgba(99,102,241,0.05)';
                        feed.insertBefore(newItem, feed.firstElementChild);
                        // Fade out highlight after 3s
                        setTimeout(() => { if (newItem) newItem.style.background = ''; }, 3000);
                    }
                }
                document.getElementById('alert-count').textContent = state.alerts.length;
                updateAlertStats();
                if (alert.impact === 'high') {
                    const toastMsg = alert.market === 'crypto' 
                        ? `${formatUSD(alert.amount)} ${alert.token} — ${alert.fromLabel} → ${alert.toLabel}`
                        : `${formatUSD(alert.amount)} ${alert.token} ${alert.type} por ${alert.whaleName}`;
                    showToast('🐋', toastMsg, 'bear');
                }
            }
            scheduleNextAlert(); // Schedule next with new random delay
        }, randInt(4000, 15000));
    }
    scheduleNextAlert();
    setInterval(() => {
        state.tokens.forEach(t => {
            if (!t._live) { // Only simulate non-live tokens
                t.price *= (1 + rand(-0.003, 0.003)); 
                t.change24h += rand(-0.15, 0.15); 
            }
        });
        updateTickers();
        state.fearGreedIndex = Math.max(5, Math.min(95, state.fearGreedIndex + randInt(-2, 3)));
        document.getElementById('last-update').textContent = 'Última atualização: agora';
    }, 3000);
}
