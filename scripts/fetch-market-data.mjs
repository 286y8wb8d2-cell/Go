// =============================================
// 주식·ETF·지수 시세 모으기 (GitHub Actions에서 6시간마다 실행)
// 주식 시세 서비스(야후 파이낸스)는 브라우저에서 직접 부를 수 없어서(CORS) 서버에서 대신 받음
// 개인정보 보호: 내가 가진 종목만 받으면 공개 저장소에 무엇을 가졌는지 드러나므로,
// 많이 거래되는 종목을 넓게 정해 두고 한꺼번에 받음 → 앱이 그중 내 종목만 골라 씀
// 결과: market-data.json ("data" 가지)
// 실행: node scripts/fetch-market-data.mjs  (Node 20 이상)
// =============================================

import { writeFile } from "node:fs/promises";
import { KOREA, US, MARKETS } from "./market-symbols.mjs";

// 야후는 브라우저처럼 꾸민 요청을 오히려 막는 경우가 있어서 정직한 이름을 씀
const HEADERS = { accept: "application/json", "user-agent": "Mozilla/5.0 (household-app data bot)" };
const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

// 받을 종목 목록은 market-symbols.mjs에

// ---------- 받기 ----------
async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value, digits = 4) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

// 종목 하나: 2년치 월봉 + 배당 기록 (너무 많다고 하면(429) 쉬었다가 다른 주소로 다시)
async function fetchQuote(symbol) {
  let json;
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = `https://${HOSTS[attempt % 2]}/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1mo&events=div`;
    try {
      json = await get(url);
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await wait(error.message === "HTTP 429" ? 4000 * (attempt + 1) : 1000);
    }
  }
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("결과 없음");
  const meta = result.meta;
  const price = meta.regularMarketPrice;
  if (!(price > 0)) throw new Error("가격 없음");
  const prev = meta.chartPreviousClose;
  // 최근 1년 배당: 합계와 지급한 달
  const yearAgo = Date.now() / 1000 - 365 * 24 * 3600;
  const dividends = Object.values(result.events?.dividends || {})
    .filter((d) => d.date >= yearAgo && d.amount > 0)
    .sort((a, b) => a.date - b.date);
  const divMonths = [...new Set(dividends.map((d) => new Date(d.date * 1000).getUTCMonth() + 1))].sort((a, b) => a - b);
  // 월말 종가 (작은 추이선용, 최근 24개월)
  const closes = (result.indicators?.quote?.[0]?.close || []).map((v) => round(v, 4)).filter((v) => v !== null);
  return {
    name: meta.longName || meta.shortName || symbol,
    type: meta.instrumentType || "", // "ETF" | "EQUITY" | "INDEX" 등
    currency: meta.currency,
    price: round(price, 4),
    change: round(meta.regularMarketChangePercent ?? (prev ? (price / prev - 1) * 100 : null), 3),
    time: meta.regularMarketTime,
    high52: round(meta.fiftyTwoWeekHigh, 4),
    low52: round(meta.fiftyTwoWeekLow, 4),
    divTTM: round(dividends.reduce((sum, d) => sum + d.amount, 0), 4),
    divMonths,
    closes: closes.slice(-24),
  };
}

// 여러 종목을 동시에 2개씩 (천천히)
async function fetchAll(symbols) {
  const results = {};
  const failed = [];
  let index = 0;
  async function worker() {
    while (index < symbols.length) {
      const symbol = symbols[index++];
      try {
        results[symbol] = await fetchQuote(symbol);
      } catch (error) {
        failed.push(symbol + "(" + error.message + ")");
      }
      await wait(400);
    }
  }
  await Promise.all([worker(), worker()]);
  return { results, failed };
}

const stockSymbols = [...Object.keys(KOREA), ...US];
const marketSymbols = Object.keys(MARKETS);
const stocks = await fetchAll(stockSymbols);
const markets = await fetchAll(marketSymbols);

// 야후에서 못 받은 국내 종목은 네이버 증권에서 (가격·등락률만)
async function fetchNaver(symbol) {
  const code = symbol.slice(0, 6);
  const json = await get(`https://m.stock.naver.com/api/stock/${code}/basic`);
  const price = Number(String(json.closePrice).replace(/,/g, ""));
  if (!(price > 0)) throw new Error("가격 없음");
  return {
    name: json.stockName || symbol,
    currency: "KRW",
    price,
    change: Number(json.fluctuationsRatio),
    time: Math.floor(Date.now() / 1000),
    high52: null,
    low52: null,
    divTTM: 0,
    divMonths: [],
    closes: [],
    source: "naver",
  };
}
const koreanMissing = Object.keys(KOREA).filter((symbol) => !stocks.results[symbol]);
if (koreanMissing.length > 0) {
  console.log(`국내 ${koreanMissing.length}개를 네이버로 다시 시도`);
  for (const symbol of koreanMissing) {
    try {
      stocks.results[symbol] = await fetchNaver(symbol);
    } catch (error) {
      // 그래도 안 되면 빠짐
    }
    await wait(200);
  }
}

// 국내 종목은 한글 이름으로
for (const [symbol, name] of Object.entries(KOREA)) {
  if (stocks.results[symbol]) stocks.results[symbol].name = name;
}
for (const [symbol, name] of Object.entries(MARKETS)) {
  if (markets.results[symbol]) markets.results[symbol].name = name;
}

console.log(`종목 ${Object.keys(stocks.results).length}/${stockSymbols.length}, 지수 ${Object.keys(markets.results).length}/${marketSymbols.length}`);
console.log("실패 수:", stocks.failed.length, "예:", stocks.failed.slice(0, 8).join(", "));

if (markets.failed.length) console.log("지수 실패:", markets.failed.join(", "));
console.log("예시 QQQ:", JSON.stringify(stocks.results.QQQ));
console.log("예시 SCHD:", JSON.stringify(stocks.results.SCHD));
console.log("예시 005930.KS:", JSON.stringify(stocks.results["005930.KS"]));

if (Object.keys(stocks.results).length < 10) {
  // 절반도 못 받았으면 실패로 보고 저장하지 않음 (지난번 파일이 그대로 남음)
  console.log("너무 많이 실패해서 저장하지 않음");
  process.exit(1);
}

await writeFile(
  "market-data.json",
  JSON.stringify({ updated: new Date().toISOString(), stocks: stocks.results, markets: markets.results })
);
console.log("저장 완료");
