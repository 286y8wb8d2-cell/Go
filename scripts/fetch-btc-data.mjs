// =============================================
// 비트코인 예비 데이터 모으기 (GitHub Actions에서 6시간마다 실행)
// 브라우저에서는 막혀 있거나(CORS) 서버에서만 받을 수 있는 공개 정보를 모아
// btc-data.json 하나로 저장 → "data" 가지(branch)에 올려 앱이 읽어 감
// - 기업 보유량(코인게코), 현물 ETF 흐름(Xoomar), 미국 M2(FRED), 월별 달러 가격(Coin Metrics)
// - 거래소 출금 수수료(업비트·빗썸·코빗·바이낸스)
// - 공포·탐욕 지수, 도미넌스 (앱이 직접 못 받을 때 쓰는 예비)
// - 각 주소가 브라우저에서 열리는지(CORS) 점검 결과
// 한 곳이 실패하면 지난번에 모아 둔 값을 그대로 둠
// 실행: node scripts/fetch-btc-data.mjs  (Node 20 이상)
// =============================================

import { writeFile } from "node:fs/promises";

const REPO = process.env.GITHUB_REPOSITORY || "286y8wb8d2-cell/Go";
const PREVIOUS_URL = `https://raw.githubusercontent.com/${REPO}/data/btc-data.json`;
const SITE_ORIGIN = "https://286y8wb8d2-cell.github.io";
const HEADERS = { accept: "application/json", "user-agent": "Mozilla/5.0 (household-app data bot)" };

// 받아 오기 (15초 넘으면 포기)
async function get(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers: HEADERS, signal: controller.signal, ...options });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

const log = (...args) => console.log(...args);
const sample = (value) => JSON.stringify(value).slice(0, 700);

// 지난번 데이터 (실패한 항목은 이 값을 그대로 씀)
let previous = {};
try {
  previous = await (await get(PREVIOUS_URL + "?t=" + Date.now())).json();
  log("지난 데이터:", previous.updated);
} catch (error) {
  log("지난 데이터 없음:", error.message);
}

const out = { updated: new Date().toISOString(), status: {} };

// 항목 하나: 성공하면 새 값, 실패하면 지난 값
async function collect(name, job) {
  try {
    out[name] = await job();
    out.status[name] = "ok";
    log(`✅ ${name}`);
  } catch (error) {
    out[name] = previous[name] ?? null;
    out.status[name] = "실패: " + error.message;
    log(`❌ ${name}: ${error.message}`);
  }
}

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// ---------- 기업 보유량 ----------
await collect("treasury", async () => {
  const json = await (await get("https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin")).json();
  log("treasury 예시:", sample({ ...json, companies: json.companies?.slice(0, 2) }));
  const companies = (json.companies || [])
    .map((c) => ({
      name: String(c.name),
      symbol: String(c.symbol || ""),
      country: String(c.country || ""),
      holdings: num(c.total_holdings),
      valueUsd: num(c.total_current_value_usd),
      share: num(c.percentage_of_total_supply),
    }))
    .filter((c) => c.holdings > 0)
    .sort((a, b) => b.holdings - a.holdings);
  if (companies.length === 0) throw new Error("회사 목록이 비어 있음");
  return {
    totalHoldings: num(json.total_holdings),
    totalValueUsd: num(json.total_value_usd),
    dominance: num(json.market_cap_dominance),
    companies: companies.slice(0, 50),
  };
});

// ---------- 현물 ETF 흐름 ----------
await collect("etf", async () => {
  // 요청 방법에 따라 돌려주는 행 수가 다를 수 있어서 몇 가지를 시도하고 ETF 종류가 가장 많은 응답을 씀
  const variants = [
    "https://xoomar.com/api/markets/etf-flows?asset=btc&days=180",
    "https://xoomar.com/api/markets/etf-flows?asset=btc&days=30",
    "https://xoomar.com/api/markets/etf-flows?asset=btc&days=10",
    "https://xoomar.com/api/markets/etf-flows?asset=btc&days=180&limit=5000",
  ];
  let json = null;
  let bestTickers = -1;
  for (const url of variants) {
    try {
      const candidate = await (await get(url)).json();
      const rows = candidate.data || [];
      const tickers = new Set(rows.map((r) => r.ticker)).size;
      const dates = new Set(rows.map((r) => String(r.date).slice(0, 10))).size;
      const keys = Object.keys(candidate).filter((k) => k !== "data");
      log(`etf ${url.split("?")[1]} → 행 ${rows.length}, ETF ${tickers}종, 날짜 ${dates}일, 기타 키: ${keys.join(",")}`);
      if (tickers > bestTickers) {
        bestTickers = tickers;
        json = candidate;
      }
    } catch (error) {
      log(`etf ${url} 실패: ${error.message}`);
    }
  }
  if (!json) throw new Error("ETF 응답 없음");
  log("etf 티커:", [...new Set(json.data.map((r) => r.ticker))].join(","));
  const rows = (json.data || []).map((r) => ({
    date: String(r.date).slice(0, 10),
    ticker: String(r.ticker),
    issuer: String(r.issuer || ""),
    holdings: num(r.holdings),
    flowUsd: num(r.flowUsd),
    aumUsd: num(r.aumUsd),
  }));
  if (rows.length === 0) throw new Error("ETF 행이 비어 있음");
  // 날짜별 합계
  const byDate = new Map();
  for (const r of rows) {
    const day = byDate.get(r.date) || { date: r.date, flowUsd: 0, holdings: 0, funds: 0 };
    if (r.flowUsd !== null && Math.abs(r.flowUsd) < 5e9) day.flowUsd += r.flowUsd; // 말이 안 되게 큰 값은 뺌
    if (r.holdings !== null) day.holdings += r.holdings;
    day.funds += 1;
    byDate.set(r.date, day);
  }
  // 아직 일부 ETF만 발표된 날(보통 맨 마지막 날)은 빼고, 대부분 발표된 날까지만
  const allDays = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const maxFunds = Math.max(...allDays.map((d) => d.funds));
  const days = allDays.filter((d) => d.funds >= Math.ceil(maxFunds * 0.8));
  if (days.length === 0) throw new Error("완전한 날짜가 없음");
  const lastDate = days[days.length - 1].date;
  // ETF마다 가장 최근 행 (발표가 늦은 ETF도 빠지지 않게)
  const latestByTicker = new Map();
  for (const r of rows) {
    const old = latestByTicker.get(r.ticker);
    if (!old || r.date > old.date) latestByTicker.set(r.ticker, r);
  }
  const funds = [...latestByTicker.values()].sort((a, b) => (b.holdings || 0) - (a.holdings || 0));
  return { sourceUpdated: json.updatedAt || null, days, funds, lastDate, attribution: json.canonicalUrl || "https://xoomar.com/markets/api" };
});

// ---------- 미국 M2 통화량 (월별, 10억 달러) ----------
await collect("m2", async () => {
  const text = await (await get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL", { headers: { ...HEADERS, accept: "text/csv" } })).text();
  log("m2 예시:", text.slice(0, 120).replace(/\n/g, " | "));
  const rows = text
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(","))
    .filter((cells) => cells[0] >= "2010-01" && num(cells[1]) !== null)
    .map((cells) => ({ month: cells[0].slice(0, 7), value: num(cells[1]) }));
  if (rows.length < 12) throw new Error("M2 데이터가 부족함");
  return rows;
});

// ---------- 비트코인 월별 달러 가격 (월말 기준, M2 비교용) ----------
await collect("btcUsdMonthly", async () => {
  const text = await (await get("https://raw.githubusercontent.com/coinmetrics/data/master/csv/btc.csv", { headers: { ...HEADERS, accept: "text/csv" } })).text();
  const lines = text.trim().split("\n");
  const head = lines[0].split(",");
  const timeIndex = head.indexOf("time");
  const priceIndex = head.indexOf("PriceUSD");
  const byMonth = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const price = num(cells[priceIndex]);
    if (price && cells[priceIndex] !== "") byMonth.set(cells[timeIndex].slice(0, 7), Math.round(price * 100) / 100);
  }
  // Coin Metrics는 몇 달 늦게 올라오므로, 최근 1년은 코인게코 하루 가격으로 채움 (월말 값)
  try {
    const recent = await (await get("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily")).json();
    // Coin Metrics의 마지막 달(덜 찬 달일 수 있음)부터는 코인게코 값으로 (날짜순이라 마지막 값 = 월말)
    const lastCoinMetricsMonth = [...byMonth.keys()].sort().pop();
    for (const [time, price] of recent.prices || []) {
      const month = new Date(time).toISOString().slice(0, 7);
      if (month >= lastCoinMetricsMonth) byMonth.set(month, Math.round(price * 100) / 100);
    }
  } catch (error) {
    log("코인게코 최근 가격 실패:", error.message);
  }
  const rows = [...byMonth].map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month));
  if (rows.length < 12) throw new Error("가격 데이터가 부족함");
  log("btcUsdMonthly 마지막:", sample(rows.slice(-3)));
  return rows;
});

// ---------- 거래소 BTC 출금 수수료 ----------
// 거래소마다 응답 모양이 달라서 하나씩 읽음 → { onchain: 0.0002, lightning: 0.00001 | null }
const isLightning = (name) => /lightning|^ln$|lnd/i.test(String(name || ""));
const WITHDRAW_SOURCES = [
  ["upbit", "https://ccx.upbit.com/api/v1/status/withdraw_fee", (json) => {
    const rows = (json.withdraw_fee_conditions || []).filter((r) => r.currency === "BTC");
    return rows.map((r) => ({ lightning: isLightning(r.network_name) || isLightning(r.net_type), fee: num(r.withdraw_fee) }));
  }],
  ["bithumb", "https://gw.bithumb.com/exchange/v1/coin-inout/info", (json) => {
    const coin = (json.data || []).find((r) => r.coinSymbol === "BTC");
    return (coin?.networkInfoList || []).map((n) => ({ lightning: isLightning(n.networkName), fee: num(n.withdrawFeeQuantity) }));
  }],
  ["korbit", "https://api.korbit.co.kr/v2/currencies", (json) => {
    const coin = (json.data || []).find((r) => String(r.name).toLowerCase() === "btc");
    return (coin?.networkList || []).map((n) => ({ lightning: isLightning(n.name) || isLightning(n.fullName), fee: num(n.withdrawalTxFee) }));
  }],
  ["binance", "https://www.binance.com/bapi/capital/v1/public/capital/getNetworkCoinAll", (json) => {
    const coin = (json.data || []).find((r) => r.coin === "BTC");
    // BTC라도 다른 체인(BSC 등)으로 보내는 경우가 섞여 있어서 비트코인·라이트닝 네트워크만
    return (coin?.networkList || [])
      .filter((n) => n.network === "BTC" || isLightning(n.network) || isLightning(n.name))
      .map((n) => ({ lightning: n.network !== "BTC", fee: num(n.withdrawFee) }));
  }],
];
await collect("withdraw", async () => {
  const fees = {};
  for (const [name, url, read] of WITHDRAW_SOURCES) {
    try {
      const options = read(await (await get(url)).json());
      const onchain = options.find((o) => !o.lightning && o.fee !== null);
      const lightning = options.find((o) => o.lightning && o.fee !== null);
      if (!onchain) throw new Error("비트코인 네트워크 수수료를 못 찾음");
      fees[name] = { onchain: onchain.fee, lightning: lightning ? lightning.fee : null };
      log(`  ${name} 수수료:`, JSON.stringify(fees[name]));
    } catch (error) {
      fees[name] = previous.withdraw?.[name] ?? null;
      log(`  ${name} 실패: ${error.message}`);
    }
  }
  if (!Object.values(fees).some(Boolean)) throw new Error("모든 거래소 실패");
  return fees;
});

// ---------- 예비: 공포·탐욕 지수, 도미넌스 ----------
await collect("fng", async () => {
  const json = await (await get("https://api.alternative.me/fng/?limit=31")).json();
  return json.data.map((d) => ({ value: num(d.value), time: num(d.timestamp) }));
});
await collect("dominance", async () => {
  const json = await (await get("https://api.coingecko.com/api/v3/global")).json();
  return num(json.data.market_cap_percentage.btc);
});

// ---------- 브라우저 접속 점검 (CORS) ----------
// 앱(github.io)에서 직접 부를 때 막히는지: 응답의 access-control-allow-origin 헤더로 판단
const corsTargets = {
  "alternative.me F&G": "https://api.alternative.me/fng/?limit=1",
  "빗썸 시세": "https://api.bithumb.com/public/ticker/BTC_KRW",
  "빗썸 일봉": "https://api.bithumb.com/public/candlestick/BTC_KRW/24h",
  "업비트 시세(REST)": "https://api.upbit.com/v1/ticker?markets=KRW-BTC",
  "코인게코 global": "https://api.coingecko.com/api/v3/global",
  "코인게코 treasury": "https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin",
  "mempool blocks": "https://mempool.space/api/v1/blocks",
  "ExchangeRate-API": "https://open.er-api.com/v6/latest/USD",
  "바이낸스 data-api": "https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT",
  "Xoomar ETF": "https://xoomar.com/api/markets/etf-flows?asset=btc&days=1",
  "FRED csv": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL",
  "코빗": "https://api.korbit.co.kr/v2/currencies",
};
out.cors = {};
for (const [name, url] of Object.entries(corsTargets)) {
  try {
    const response = await fetch(url, { headers: { ...HEADERS, origin: SITE_ORIGIN } });
    const allow = response.headers.get("access-control-allow-origin");
    out.cors[name] = { status: response.status, allow: allow || "(없음 → 브라우저에서 막힘)" };
    if (name === "빗썸 일봉") {
      const json = await response.json();
      log("빗썸 일봉: 개수", json.data?.length, "처음", sample(json.data?.[0]), "마지막", sample(json.data?.[json.data.length - 1]));
    }
  } catch (error) {
    out.cors[name] = { status: 0, allow: "접속 실패: " + error.message };
  }
}
log("CORS 점검:", JSON.stringify(out.cors, null, 1));


await writeFile("btc-data.json", JSON.stringify(out));
log("저장 완료:", Object.entries(out.status).map(([k, v]) => `${k}=${v}`).join(", "));
