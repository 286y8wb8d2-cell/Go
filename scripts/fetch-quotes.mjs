// =============================================
// 빠른 시세 (GitHub Actions에서 평일 내내 2분마다 실행 → quotes 가지)
// market-data.json(6시간마다, 배당·52주·추이선까지)과 달리 지금 가격과 등락만 가볍게 받음
// - 야후 "spark" 주소로 한 번에 20종목씩 (5분 간격 가격 목록 + 전날 종가)
// - 미국 종목은 장 전·장 후(시간외) 가격도 받아서, 뉴욕 시각 9:30~16:00 밖의 가격은 시간외로 따로 담음
//   (국내 종목에 시간외를 같이 요청하면 야후가 오류를 내서 나눠서 요청)
// 결과: quotes.json  { updated, q: { "QQQ": [정규장 가격|null, 등락률%|null, 시각(초), 시간외 가격|null, 시간외 등락률|null] } }
//   정규장 가격이 null = 오늘 정규장이 아직 안 열림 (앱은 지난 가격을 그대로 둠)
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
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const error = new Error("HTTP " + response.status);
      error.body = body.slice(0, 160);
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// 응답 모양이 두 가지라 둘 다 읽음 → [{ symbol, meta, times, closes }]
// ① { spark: { result: [{ symbol, response: [{ meta, timestamp, indicators }] }] } }
// ② { "QQQ": { symbol, timestamp, close, previousClose, chartPreviousClose, ... } }
function readSpark(json) {
  const out = [];
  if (json && json.spark && Array.isArray(json.spark.result)) {
    json.spark.result.forEach((item) => {
      const r = item.response && item.response[0];
      if (!r) return;
      const quote = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
      out.push({ symbol: item.symbol, meta: r.meta || {}, times: r.timestamp || [], closes: quote.close || [] });
    });
  } else if (json && typeof json === "object") {
    Object.values(json).forEach((item) => {
      if (!item || !item.symbol) return;
      out.push({ symbol: item.symbol, meta: item, times: item.timestamp || [], closes: item.close || [] });
    });
  }
  return out;
}

// 뉴욕 시각으로 정규장(9:30~16:00) 안인지
const nyClock = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function isUsRegular(seconds) {
  const [hour, minute] = nyClock.format(new Date(seconds * 1000)).split(":").map(Number);
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

// 가격 목록 → [정규장 가격, 등락률, 시각, 시간외 가격, 시간외 등락률]
function toQuote(row, usSession) {
  const prev = row.meta.previousClose || row.meta.chartPreviousClose;
  const points = [];
  row.closes.forEach((close, i) => {
    if (Number.isFinite(close) && close > 0 && row.times[i]) points.push({ time: row.times[i], close });
  });
  let regular = null;
  let ext = null;
  points.forEach((point) => {
    if (!usSession || isUsRegular(point.time)) regular = point;
    else ext = point; // 마지막 시간외 가격
  });
  if (row.meta.regularMarketPrice > 0 && !usSession) {
    regular = { time: row.meta.regularMarketTime || (regular && regular.time) || 0, close: row.meta.regularMarketPrice };
  }
  if (ext && regular && ext.time < regular.time) ext = null; // 장 전 가격은 정규장이 열리면 의미 없음
  if (!regular && !ext) return null;
  const price = regular ? regular.close : null;
  const base = price || prev; // 시간외 등락: 정규장 가격(없으면 전날 종가) 대비
  return [
    round(price, 4),
    price && prev > 0 ? round((price / prev - 1) * 100, 3) : null,
    regular ? regular.time : ext.time,
    ext ? round(ext.close, 4) : null,
    ext && base > 0 ? round((ext.close / base - 1) * 100, 3) : null,
  ];
}

async function fetchBatch(symbols, prePost) {
  const list = symbols.map(encodeURIComponent).join(",");
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = `https://${HOSTS[attempt % 2]}/v8/finance/spark?symbols=${list}&range=1d&interval=5m` + (prePost ? "&includePrePost=true" : "");
    try {
      return readSpark(await get(url));
    } catch (error) {
      if (attempt === 1) throw error;
      await wait(error.message === "HTTP 429" ? 4000 : 800);
    }
  }
  return [];
}

const quotes = {};
const failed = [];

// 묶음마다: 미국 종목은 시간외까지 (안 되면 시간외 없이 한 번 더)
async function fetchGroup(symbols, usSession) {
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    let rows = [];
    let withExt = usSession;
    try {
      rows = await fetchBatch(batch, usSession);
    } catch (error) {
      if (!usSession) {
        failed.push(batch[0] + "…(" + error.message + " " + (error.body || "") + ")");
      } else {
        withExt = false;
        try {
          rows = await fetchBatch(batch, false);
        } catch (error2) {
          failed.push(batch[0] + "…(" + error2.message + ")");
        }
      }
    }
    rows.forEach((row) => {
      const quote = toQuote(row, withExt);
      if (quote) quotes[row.symbol] = quote;
    });
    await wait(300);
  }
}

const others = [...Object.keys(KOREA), ...Object.keys(MARKETS)];
await fetchGroup(others, false);
await fetchGroup(US, true);

const total = others.length + US.length;
const count = Object.keys(quotes).length;
console.log(`빠른 시세 ${count}/${total}`, failed.length ? "실패 " + failed.length + "묶음: " + failed.slice(0, 5).join(", ") : "");
console.log("예시 QQQ:", JSON.stringify(quotes.QQQ), "TSLA:", JSON.stringify(quotes.TSLA), "005930.KS:", JSON.stringify(quotes["005930.KS"]), "KRW=X:", JSON.stringify(quotes["KRW=X"]));
if (count < 10) {
  console.log("너무 많이 실패해서 저장하지 않음");
  process.exit(1);
}
await writeFile("quotes.json", JSON.stringify({ updated: new Date().toISOString(), q: quotes }));
