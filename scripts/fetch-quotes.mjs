// =============================================
// 빠른 시세 (GitHub Actions에서 평일 내내 2분마다 실행 → quotes 가지)
// market-data.json(6시간마다, 배당·52주·추이선까지)과 달리 지금 가격과 등락만 가볍게 받음
// - 야후 "spark" 주소로 한 번에 여러 종목씩 (안 되면 종목마다 따로)
// - 미국 종목은 장 전·장 후(시간외) 가격도 따로 담음
// 결과: quotes.json  { updated, q: { "QQQ": [가격, 등락률%, 시각(초), 시간외 가격|null, 시간외 등락률|null] } }
// 실행: node scripts/fetch-quotes.mjs  (Node 20 이상)
// =============================================

import { writeFile } from "node:fs/promises";
import { KOREA, US, MARKETS } from "./market-symbols.mjs";

const HEADERS = { accept: "application/json", "user-agent": "Mozilla/5.0 (household-app data bot)" };
const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value, digits) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const error = new Error("HTTP " + response.status);
      error.body = body.slice(0, 200);
      throw error;
    }
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

// 야후가 받아 주는 주소 모양이 바뀔 때가 있어서 여러 가지를 차례로 시도 (처음 통한 것을 계속 씀)
const VARIANTS = [
  { path: "v8/finance/spark", query: "range=1d&interval=5m&includePrePost=true", batch: 20 },
  { path: "v8/finance/spark", query: "range=1d&interval=5m", batch: 20 },
  { path: "v7/finance/spark", query: "range=1d&interval=5m&includePrePost=true", batch: 20 },
  { path: "v8/finance/spark", query: "range=1d&interval=1d", batch: 10 },
  { path: "v7/finance/spark", query: "range=1d&interval=1d", batch: 10 },
];

async function fetchBatch(variant, symbols) {
  const list = symbols.map(encodeURIComponent).join(",");
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = `https://${HOSTS[attempt % 2]}/${variant.path}?symbols=${list}&${variant.query}`;
    try {
      return readSpark(await get(url));
    } catch (error) {
      // 400(주소 모양 문제)은 다시 해도 같으니 바로 다음 모양으로
      if (attempt === 1 || error.message === "HTTP 400") throw error;
      await wait(error.message === "HTTP 429" ? 4000 : 800);
    }
  }
  return [];
}

// 종목 하나씩 (spark가 모두 안 될 때만): 정규장·시간외까지 나오는 chart 주소
async function fetchChart(symbol) {
  const url = `https://${HOSTS[0]}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=true`;
  const json = await get(url);
  const r = json.chart && json.chart.result && json.chart.result[0];
  if (!r) return [];
  return [{ symbol, meta: r.meta, times: r.timestamp || [], closes: (r.indicators.quote[0] || {}).close || [] }];
}

const symbols = [...Object.keys(KOREA), ...US, ...Object.keys(MARKETS)];
const quotes = {};
const failed = [];

// 1) 처음 20종목으로 어느 모양이 통하는지 찾기
let variant = null;
for (const candidate of VARIANTS) {
  try {
    const rows = await fetchBatch(candidate, symbols.slice(0, candidate.batch));
    if (rows.length > 0) {
      variant = candidate;
      console.log("쓰는 주소:", candidate.path, candidate.query, "→", rows.length, "종목");
      break;
    }
    console.log("빈 응답:", candidate.path, candidate.query);
  } catch (error) {
    console.log("안 됨:", candidate.path, candidate.query, error.message, error.body || "");
  }
  await wait(300);
}

if (variant) {
  for (let i = 0; i < symbols.length; i += variant.batch) {
    const batch = symbols.slice(i, i + variant.batch);
    try {
      const rows = await fetchBatch(variant, batch);
      rows.forEach((row) => {
        const quote = toQuote(row);
        if (quote) quotes[row.symbol] = quote;
      });
    } catch (error) {
      failed.push(batch[0] + "…(" + error.message + ")");
    }
    await wait(300);
  }
} else {
  // 2) spark가 모두 막혔으면 종목마다 따로 (동시에 3개씩)
  console.log("spark가 모두 안 돼서 종목마다 받음");
  let index = 0;
  async function worker() {
    while (index < symbols.length) {
      const symbol = symbols[index++];
      try {
        const rows = await fetchChart(symbol);
        rows.forEach((row) => {
          const quote = toQuote(row);
          if (quote) quotes[row.symbol] = quote;
        });
      } catch (error) {
        failed.push(symbol + "(" + error.message + ")");
      }
      await wait(150);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
}

const count = Object.keys(quotes).length;
console.log(`빠른 시세 ${count}/${symbols.length}`, failed.length ? "실패 " + failed.length + "개: " + failed.slice(0, 8).join(", ") : "");
console.log("예시 QQQ:", JSON.stringify(quotes.QQQ), "005930.KS:", JSON.stringify(quotes["005930.KS"]), "KRW=X:", JSON.stringify(quotes["KRW=X"]));
if (count < 10) {
  console.log("너무 많이 실패해서 저장하지 않음");
  process.exit(1);
}
await writeFile("quotes.json", JSON.stringify({ updated: new Date().toISOString(), q: quotes }));
