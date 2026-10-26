// 테스트용 가짜 응답: 거래소·시세 API와 WebSocket을 흉내 냄 (인터넷 없이, 늘 같은 결과로 테스트)
function makeCandles() {
  const rows = []; let price = 500000; const start = Date.UTC(2014, 0, 1) - 9 * 3600000;
  const days = Math.floor((Date.now() - start) / 86400000);
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i <= days; i++) {
    const open = price; const close = open * (1 + (rnd() - 0.485) * 0.06);
    const high = Math.max(open, close) * (1 + rnd() * 0.02); const low = Math.min(open, close) * (1 - rnd() * 0.02);
    rows.push([start + i * 86400000, String(Math.round(open)), String(Math.round(close)), String(Math.round(high)), String(Math.round(low)), "12.3"]);
    price = close;
  }
  // scale so last close ~ 150,000,000
  const k = 150000000 / Number(rows[rows.length - 1][2]);
  rows.forEach(r => { for (let j = 1; j <= 4; j++) r[j] = String(Math.round(Number(r[j]) * k)); });
  return rows;
}
const candles = makeCandles();
const now = () => Math.floor(Date.now() / 1000);
function blocks(tip) { return Array.from({ length: 15 }, (_, i) => ({ id: 'hash' + (tip - i), height: tip - i, timestamp: now() - i * 600 - 90, tx_count: 3000 + i * 10, size: 1500000, weight: 3990000 - i * 50000, extras: { medianFee: 4.2 + i, feeRange: [1.01, 3, 5, 200], totalFees: 5200000 + i * 1000, pool: { name: ['Foundry USA', 'AntPool', 'ViaBTC'][i % 3] } } })); }
async function install(p, opt = {}) {
  const state = { tip: 968500, fail: opt.fail || {}, hits: [] };
  const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
  const guard = (name, r, fn) => { state.hits.push(name); return state.fail[name] ? r.abort() : fn(); };
  await p.route('https://api.bithumb.com/**', r => { const u = r.request().url();
    if (u.includes('candlestick')) return guard('candle', r, () => json(r, { status: '0000', data: opt.candleDays ? candles.slice(-opt.candleDays) : candles }));
    if (u.includes('BTC_KRW')) return guard('bithumb', r, () => json(r, { status: '0000', data: { closing_price: '152300000', fluctate_rate_24H: '-1.25' } }));
    return json(r, { status: '0000', data: { BTC: { closing_price: '152300000' } } }); });
  await p.route('https://data-api.binance.vision/**', r => guard('binance', r, () => json(r, { symbol: 'BTCUSDT', price: '107800.50', lastPrice: '107800.50', priceChangePercent: '0.8' })));
  await p.route('https://open.er-api.com/**', r => guard('er', r, () => json(r, { result: 'success', rates: { KRW: 1385.2 } })));
  await p.route('https://api.coingecko.com/**', r => { const u = r.request().url();
    if (u.includes('/global')) return guard('cgglobal', r, () => json(r, { data: { market_cap_percentage: { btc: 57.34, eth: 9.1 } } }));
    if (u.includes('market_chart')) return guard('cgchart', r, () => json(r, { prices: candles.slice(-366).map(c => [c[0], Number(c[2])]) }));
    return guard('cg', r, () => json(r, { bitcoin: { usd: 107700, krw: 149300000 } })); });
  await p.route('https://mempool.space/**', r => { const u = r.request().url();
    return guard('mempool', r, () => {
      if (u.endsWith('/v1/blocks')) return json(r, blocks(state.tip));
      if (u.includes('mempool-blocks')) return json(r, [0, 1, 2, 3, 4].map(i => ({ blockSize: 1500000, blockVSize: i < 4 ? 997000 : 400000, nTx: 3500 - i * 100, totalFees: 4000000 - i * 500000, medianFee: 6 - i, feeRange: [3 - i * 0.5, 5, 80] })));
      if (u.includes('recommended')) return json(r, { fastestFee: 7, halfHourFee: 5, hourFee: 4, economyFee: 2, minimumFee: 1 });
      if (u.includes('difficulty-adjustment')) return json(r, { progressPercent: 40, difficultyChange: 2.13, remainingBlocks: 1200, remainingTime: 3 * 86400000, timeAvg: 590000 });
      if (u.endsWith('/mempool')) return json(r, { count: 23456, vsize: 30000000, total_fee: 1 });
      if (u.includes('/mining/hashrate/')) { const days = u.endsWith('3m') ? 90 : u.endsWith('1y') ? 365 : u.endsWith('3y') ? 1095 : 5000; const t = Math.floor(Date.now()/1000);
        return json(r, { hashrates: Array.from({ length: days }, (_, i) => ({ timestamp: t - (days - i) * 86400, avgHashrate: 1.1e21 * Math.pow(0.9985, days - i) * (1 + 0.05 * Math.sin(i / 9)) })), difficulty: Array.from({ length: Math.floor(days / 14) }, (_, i) => ({ time: t - (days - i * 14) * 86400, height: 900000 + i * 2016, difficulty: 1.5e14 * Math.pow(0.99, Math.floor(days / 14) - i), adjustment: 1.01 })), currentHashrate: 1.12e21, currentDifficulty: 1.5e14 }); }
      return r.abort(); }); });
  await p.route('https://api.alternative.me/**', r => guard('fng', r, () => json(r, { name: 'Fear and Greed Index', data: Array.from({ length: 31 }, (_, i) => ({ value: String([72, 65, 58, 50, 44, 38, 30, 22, 15, 28, 47][i % 11]), value_classification: 'x', timestamp: String(Math.floor(Date.now() / 1000 / 86400) * 86400 - i * 86400) })), metadata: { error: null } })));
  await p.route('https://raw.githubusercontent.com/**', r => { const u = r.request().url();
    if (u.includes('btc-data.json')) return guard('data', r, () => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: require('fs').readFileSync(__dirname + '/fixtures/btc-data.json', 'utf8') }));
    if (u.includes('quotes.json')) return guard('quotes', r, () => opt.quotes ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(opt.quotes()) }) : r.fulfill({ status: 404, body: '404' }));
    if (u.includes('market-data.json')) return guard('market', r, () => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: require('fs').readFileSync(__dirname + '/fixtures/market-data.json', 'utf8') }));
    if (u.includes('english.txt')) return guard('bip39', r, () => r.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: require('fs').readFileSync(__dirname + '/fixtures/english.txt', 'utf8') }));
    return r.abort(); });
  await p.route('https://blockstream.info/**', r => guard('blockstream', r, () => json(r, 968499)));
  return state;
}
async function fakeWs(p, opt = {}) {
  await p.addInitScript((opt) => {
    window.__wsLog = [];
    class FakeWS {
      constructor(url) { this.url = url; this.readyState = 0; window.__wsLog.push('open ' + url);
        if (opt.wsFail) { setTimeout(() => { this.onclose && this.onclose({}); }, 50); return; }
        setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); this._t = setInterval(() => this._tick(), 300); }, 50); }
      send(m) { window.__wsLog.push('send ' + this.url.slice(6, 20) + ' ' + m.slice(0, 60)); }
      close() { clearInterval(this._t); this.readyState = 3; window.__wsLog.push('close ' + this.url); }
      _tick() { const j = Math.round((Math.random() - 0.5) * 40000);
        const enc = s => new TextEncoder().encode(JSON.stringify(s)).buffer;
        const side = Math.random() < 0.58 ? 'BID' : 'ASK'; const size = Math.random() < 0.08 ? 1 + Math.random() * 3 : Math.random() * 0.2;
        if (this.url.includes('upbit')) { this.onmessage({ data: enc({ ty: 'ticker', cd: 'KRW-BTC', tp: 152400000 + j, scr: 0.0123, hp: 154000000, lp: 150100000, atp24h: 412345678901 }) }); this.onmessage({ data: enc({ ty: 'ticker', cd: 'KRW-USDT', tp: 1391.5, scr: 0.001 }) }); this.onmessage({ data: enc({ ty: 'trade', cd: 'KRW-BTC', tp: 152400000 + j, tv: size, ab: side }) }); }
        else if (this.url.includes('bithumb')) { this.onmessage({ data: enc({ ty: 'ticker', cd: 'KRW-BTC', tp: 152300000 + j, scr: 0.011, hp: 153900000, lp: 150000000, atp24h: 98765432101 }) }); this.onmessage({ data: enc({ ty: 'trade', cd: 'KRW-BTC', tp: 152300000 + j, tv: size / 2, ab: side }) }); }
        else if (this.url.includes('binance')) { this.onmessage({ data: JSON.stringify({ stream: 'btcusdt@ticker', data: { e: '24hrTicker', c: String(107900 + j / 1000), P: '0.95', h: '109000', l: '106500', q: '2345678901' } }) }); this.onmessage({ data: JSON.stringify({ stream: 'btcusdt@aggTrade', data: { e: 'aggTrade', p: '107900', q: String(size * 2), m: side === 'ASK' } }) }); }
        else if (this.url.includes('coinbase')) { this.onmessage({ data: JSON.stringify({ type: 'ticker', price: String(107950 + j / 1000), open_24h: '107000', high_24h: '109100', low_24h: '106400' }) }); this.onmessage({ data: JSON.stringify({ type: 'match', side: side === 'BID' ? 'sell' : 'buy', size: String(size), price: '107950' }) }); } }
    }
    window.WebSocket = FakeWS;
  }, opt);
}
module.exports = { install, fakeWs };
