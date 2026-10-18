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

// 받아 오기 (8초 넘으면 포기)
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
  const json = await (await get("https://xoomar.com/api/markets/etf-flows?asset=btc&days=180")).json();
  log("etf 예시:", sample({ ...json, data: json.data?.slice(0, 3) }));
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
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = days[days.length - 1].date;
  const funds = rows
    .filter((r) => r.date === lastDate)
    .sort((a, b) => (b.holdings || 0) - (a.holdings || 0));
  return { sourceUpdated: json.updatedAt || null, days, funds, lastDate };
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
  const rows = [...byMonth].map(([month, value]) => ({ month, value }));
  if (rows.length < 12) throw new Error("가격 데이터가 부족함");
  return rows;
});

// ---------- 거래소 BTC 출금 수수료 ----------
await collect("withdraw", async () => {
  const fees = {};
  const tries = [
    ["upbit", "https://ccx.upbit.com/api/v1/status/withdraw_fee", (json) => {
      const rows = (json.withdraw_fee_conditions || []).filter((r) => String(r.currency || r.coin || "").toUpperCase() === "BTC");
      log("upbit BTC 행:", sample(rows.slice(0, 3)));
      return rows;
    }],
    ["bithumb", "https://gw.bithumb.com/exchange/v1/coin-inout/info", (json) => {
      const list = json.data || json;
      const rows = (Array.isArray(list) ? list : Object.values(list)).filter((r) => JSON.stringify(r).includes('"BTC"'));
      log("bithumb BTC 행:", sample(rows.slice(0, 2)));
      return rows;
    }],
    ["korbit", "https://api.korbit.co.kr/v2/currencies", (json) => {
      const list = json.data || json;
      const rows = (Array.isArray(list) ? list : Object.values(list)).filter((r) => String(r.name || r.currency || r.symbol || "").toUpperCase() === "BTC");
      log("korbit BTC 행:", sample(rows.slice(0, 2)));
      return rows;
    }],
    ["binance", "https://www.binance.com/bapi/capital/v1/public/capital/getNetworkCoinAll", (json) => {
      const list = json.data || [];
      const rows = list.filter((r) => r.coin === "BTC");
      log("binance BTC 행:", sample(rows.slice(0, 1)));
      return rows;
    }],
  ];
  for (const [name, url, pick] of tries) {
    try {
      const json = await (await get(url)).json();
      const rows = pick(json);
      fees[name] = findBtcFees(rows);
      log(`  ${name} 수수료:`, JSON.stringify(fees[name]));
    } catch (error) {
      fees[name] = previous.withdraw?.[name] ?? null;
      log(`  ${name} 실패: ${error.message}`);
    }
  }
  if (!Object.values(fees).some(Boolean)) throw new Error("모든 거래소 실패");
  return fees;
});

// 응답 모양이 거래소마다 달라서, BTC 행 안에서 "fee"가 들어간 숫자 칸과 네트워크 이름을 찾아냄
// → { onchain: 0.0002, lightning: 0.00001 | null }
function findBtcFees(rows) {
  const result = { onchain: null, lightning: null };
  const visit = (node, network) => {
    if (!node || typeof node !== "object") return;
    const name = String(node.network || node.networkName || node.net_type || node.netType || node.chain || node.name || network || "").toLowerCase();
    for (const [key, value] of Object.entries(node)) {
      if (/withdraw.*fee|fee.*quantity|withdrawaltxfee|^fee$/i.test(key) && !/min|max|rate|percent|unit/i.test(key)) {
        const fee = num(typeof value === "object" && value ? value.amount ?? value.value : value);
        if (fee !== null && fee >= 0 && fee < 0.01) {
          if (name.includes("lightning") || name.includes("lnd")) result.lightning ??= fee;
          else result.onchain ??= fee;
        }
      }
      if (value && typeof value === "object") visit(value, name);
    }
  };
  rows.forEach((row) => visit(row, ""));
  if (result.onchain === null && result.lightning === null) throw new Error("BTC 수수료 칸을 못 찾음");
  return result;
}

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
