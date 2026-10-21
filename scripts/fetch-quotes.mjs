// =============================================
// 빠른 시세 (GitHub Actions에서 평일 내내 2분마다 실행 → quotes 가지)
// market-data.json(6시간마다, 배당·52주·추이선까지)과 달리 지금 가격과 등락만 가볍게 받음
// - 야후 "spark" 주소로 한 번에 20종목씩 → 180여 종목도 10번 안쪽 요청
// - 미국 종목은 장 전·장 후(시간외) 가격도 따로 담음
// 결과: quotes.json  { updated, q: { "QQQ": [가격, 등락률%, 시각(초), 시간외 가격|null, 시간외 등락률|null] } }
// 실행: node scripts/fetch-quotes.mjs  (Node 20 이상)
// =============================================

import { writeFile } from "node:fs/promises";
import { KOREA, US, MARKETS } from "./market-symbols.mjs";

const HEADERS = { accept: "application/json", "user-agent": "Mozilla/5.0 (household-app data bot)" };
const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const BATCH = 20;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value, digits) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

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

// 응답 모양이 두 가지라 둘 다 읽음
// ① { spark: { result: [{ symbol, response: [{ meta, timestamp, indicators }] }] } }
// ② { "QQQ": { symbol, timestamp, close, chartPreviousClose, ... } }
function readSpark(json) {
  const out = [];
  if (json && json.spark && Array.isArray(json.spark.result)) {
    json.spark.result.forEach((item) => {
      const r = item.response && item.response[0];
      if (!r || !r.meta) return;
      out.push({
        symbol: item.symbol,
        meta: r.meta,
        times: r.timestamp || [],
        closes: (r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) || [],
      });
    });
  } else if (json && typeof json === "object") {
    Object.values(json).forEach((item) => {
      if (!item || !item.symbol) return;
      out.push({ symbol: item.symbol, meta: item, times: item.timestamp || [], closes: item.close || [] });
    });
  }
  return out;
}

function toQuote(row) {
  const meta = row.meta;
  const price = meta.regularMarketPrice;
  if (!(price > 0)) return null;
  const prev = meta.previousClose || meta.chartPreviousClose;
  const time = meta.regularMarketTime || 0;
  const change = prev > 0 ? (price / prev - 1) * 100 : null;
  // 정규장이 끝난 뒤(또는 열리기 전)에 찍힌 마지막 가격 = 시간외
  let extPrice = null;
  let extChange = null;
  for (let i = row.closes.length - 1; i >= 0; i--) {
    if (!Number.isFinite(row.closes[i])) continue;
    if (row.times[i] > time + 60) {
      extPrice = row.closes[i];
      extChange = (extPrice / price - 1) * 100;
    }
    break;
  }
  return [round(price, 4), round(change, 3), time, round(extPrice, 4), round(extChange, 3)];
}

async function fetchBatch(symbols) {
  const list = symbols.map(encodeURIComponent).join(",");
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `https://${HOSTS[attempt % 2]}/v8/finance/spark?symbols=${list}&range=1d&interval=5m&includePrePost=true`;
    try {
      return readSpark(await get(url));
    } catch (error) {
      if (attempt === 2) throw error;
      await wait(error.message === "HTTP 429" ? 3000 * (attempt + 1) : 800);
    }
  }
  return [];
}

const symbols = [...Object.keys(KOREA), ...US, ...Object.keys(MARKETS)];
const quotes = {};
const failed = [];
for (let i = 0; i < symbols.length; i += BATCH) {
  const batch = symbols.slice(i, i + BATCH);
  try {
    const rows = await fetchBatch(batch);
    rows.forEach((row) => {
      const quote = toQuote(row);
      if (quote) quotes[row.symbol] = quote;
    });
  } catch (error) {
    failed.push(batch[0] + "…(" + error.message + ")");
  }
  await wait(300);
}

const count = Object.keys(quotes).length;
console.log(`빠른 시세 ${count}/${symbols.length}`, failed.length ? "실패: " + failed.join(", ") : "");
console.log("예시 QQQ:", JSON.stringify(quotes.QQQ), "005930.KS:", JSON.stringify(quotes["005930.KS"]), "KRW=X:", JSON.stringify(quotes["KRW=X"]));
if (count < 10) {
  console.log("너무 많이 실패해서 저장하지 않음");
  process.exit(1);
}
await writeFile("quotes.json", JSON.stringify({ updated: new Date().toISOString(), q: quotes }));
