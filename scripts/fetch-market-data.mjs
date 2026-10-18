// =============================================
// 주식·ETF·지수 시세 모으기 (GitHub Actions에서 6시간마다 실행)
// 주식 시세 서비스(야후 파이낸스)는 브라우저에서 직접 부를 수 없어서(CORS) 서버에서 대신 받음
// 개인정보 보호: 내가 가진 종목만 받으면 공개 저장소에 무엇을 가졌는지 드러나므로,
// 많이 거래되는 종목을 넓게 정해 두고 한꺼번에 받음 → 앱이 그중 내 종목만 골라 씀
// 결과: market-data.json ("data" 가지)
// 실행: node scripts/fetch-market-data.mjs  (Node 20 이상)
// =============================================

import { writeFile } from "node:fs/promises";

const HEADERS = {
  accept: "application/json",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
};

// ---------- 받을 종목 (야후 기호) ----------
// 국내: 6자리 코드 + .KS(코스피) / .KQ(코스닥)
const KOREA = {
  "005930.KS": "삼성전자", "005935.KS": "삼성전자우", "000660.KS": "SK하이닉스", "373220.KS": "LG에너지솔루션",
  "207940.KS": "삼성바이오로직스", "005380.KS": "현대차", "000270.KS": "기아", "005490.KS": "POSCO홀딩스",
  "035420.KS": "NAVER", "035720.KS": "카카오", "051910.KS": "LG화학", "006400.KS": "삼성SDI",
  "068270.KS": "셀트리온", "105560.KS": "KB금융", "055550.KS": "신한지주", "086790.KS": "하나금융지주",
  "316140.KS": "우리금융지주", "138040.KS": "메리츠금융지주", "024110.KS": "기업은행", "012330.KS": "현대모비스",
  "028260.KS": "삼성물산", "066570.KS": "LG전자", "003550.KS": "LG", "034730.KS": "SK", "017670.KS": "SK텔레콤",
  "030200.KS": "KT", "032830.KS": "삼성생명", "000810.KS": "삼성화재", "015760.KS": "한국전력", "033780.KS": "KT&G",
  "009150.KS": "삼성전기", "018260.KS": "삼성에스디에스", "010130.KS": "고려아연", "011200.KS": "HMM",
  "096770.KS": "SK이노베이션", "003670.KS": "포스코퓨처엠", "323410.KS": "카카오뱅크", "377300.KS": "카카오페이",
  "259960.KS": "크래프톤", "352820.KS": "하이브", "012450.KS": "한화에어로스페이스", "329180.KS": "HD현대중공업",
  "009540.KS": "HD한국조선해양", "010140.KS": "삼성중공업", "034020.KS": "두산에너빌리티", "042660.KS": "한화오션",
  "064350.KS": "현대로템", "079550.KS": "LIG넥스원", "042700.KS": "한미반도체", "247540.KQ": "에코프로비엠",
  "086520.KQ": "에코프로", "196170.KQ": "알테오젠", "028300.KQ": "HLB",
  // 국내 상장 ETF
  "069500.KS": "KODEX 200", "102110.KS": "TIGER 200", "122630.KS": "KODEX 레버리지", "114800.KS": "KODEX 인버스",
  "252670.KS": "KODEX 200선물인버스2X", "360750.KS": "TIGER 미국S&P500", "133690.KS": "TIGER 미국나스닥100",
  "379800.KS": "KODEX 미국S&P500TR", "379810.KS": "KODEX 미국나스닥100TR", "458730.KS": "TIGER 미국배당다우존스",
  "446720.KS": "SOL 미국배당다우존스", "381170.KS": "TIGER 미국테크TOP10 INDXX", "305720.KS": "KODEX 2차전지산업",
  "153130.KS": "KODEX 단기채권", "357870.KS": "TIGER CD금리투자KIS(합성)", "449170.KS": "TIGER KOFR금리액티브(합성)",
  "132030.KS": "KODEX 골드선물(H)", "411060.KS": "ACE KRX금현물", "441680.KS": "TIGER 미국나스닥100커버드콜(합성)",
};
// 미국 ETF·주식 (이름은 영어 그대로)
const US = [
  "SPY", "VOO", "IVV", "VTI", "QQQ", "QQQM", "DIA", "IWM", "VT", "VEA", "VWO", "SCHD", "JEPI", "JEPQ", "VIG", "VYM",
  "DGRO", "SPYD", "NOBL", "TLT", "IEF", "SHY", "BND", "AGG", "HYG", "LQD", "GLD", "IAU", "SLV", "SOXX", "SMH",
  "XLK", "XLF", "XLE", "XLV", "VNQ", "TQQQ", "SQQQ", "SOXL", "UPRO", "ARKK", "IBIT", "FBTC", "BITO", "SGOV", "BIL",
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "TSLA", "BRK-B", "AVGO", "JPM", "V", "MA", "UNH", "XOM",
  "JNJ", "PG", "HD", "COST", "KO", "PEP", "ABBV", "MRK", "LLY", "NFLX", "AMD", "INTC", "ORCL", "CRM", "ADBE", "CSCO",
  "QCOM", "TXN", "IBM", "DIS", "NKE", "MCD", "SBUX", "WMT", "T", "VZ", "PFE", "BA", "PLTR", "UBER", "SHOP", "ASML",
  "TSM", "MU", "ARM", "SMCI", "PYPL", "COIN", "MSTR", "RIVN", "BAC", "WFC", "GS", "CVX", "O", "MO", "PM",
];
// 시장 지수·환율·원자재 (홈 화면 "시장 한눈에")
const MARKETS = {
  "^GSPC": "S&P 500", "^IXIC": "나스닥", "^DJI": "다우", "^KS11": "코스피", "^KQ11": "코스닥",
  "^VIX": "VIX 공포지수", "^TNX": "미국 10년 금리", "KRW=X": "원/달러", "GC=F": "금", "CL=F": "WTI 유가",
};

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

// 종목 하나: 2년치 월봉 + 배당 기록
async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1mo&events=div`;
  let json;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      json = await get(url);
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await wait(1500 * attempt);
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

// 여러 종목을 동시에 4개씩
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
      await wait(150);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { results, failed };
}

const stockSymbols = [...Object.keys(KOREA), ...US];
const marketSymbols = Object.keys(MARKETS);
const stocks = await fetchAll(stockSymbols);
const markets = await fetchAll(marketSymbols);

// 국내 종목은 한글 이름으로
for (const [symbol, name] of Object.entries(KOREA)) {
  if (stocks.results[symbol]) stocks.results[symbol].name = name;
}
for (const [symbol, name] of Object.entries(MARKETS)) {
  if (markets.results[symbol]) markets.results[symbol].name = name;
}

console.log(`종목 ${Object.keys(stocks.results).length}/${stockSymbols.length}, 지수 ${Object.keys(markets.results).length}/${marketSymbols.length}`);
if (stocks.failed.length) console.log("실패:", stocks.failed.join(", "));
if (markets.failed.length) console.log("지수 실패:", markets.failed.join(", "));
console.log("예시 QQQ:", JSON.stringify(stocks.results.QQQ));
console.log("예시 SCHD:", JSON.stringify(stocks.results.SCHD));
console.log("예시 005930.KS:", JSON.stringify(stocks.results["005930.KS"]));

if (Object.keys(stocks.results).length < stockSymbols.length / 2) {
  // 절반도 못 받았으면 실패로 보고 저장하지 않음 (지난번 파일이 그대로 남음)
  console.log("너무 많이 실패해서 저장하지 않음");
  process.exit(1);
}

await writeFile(
  "market-data.json",
  JSON.stringify({ updated: new Date().toISOString(), stocks: stocks.results, markets: markets.results })
);
console.log("저장 완료");
