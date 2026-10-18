// =============================================
// 주식·ETF·지수 시세 (금융자산·홈에서 같이 씀)
// GitHub Actions가 6시간마다 모아 두는 market-data.json(data 가지)을 읽음
// - 주식 시세 서비스는 브라우저에서 바로 부를 수 없어서(CORS) 서버(Actions)가 대신 받아 둠
// - 내 종목만 받으면 무엇을 가졌는지 공개 저장소에 드러나므로, 많이 거래되는 종목을 넓게 받아 두고
//   여기서 내 종목(티커)만 골라 씀 → 내 보유 정보는 어디에도 보내지 않음
// - "자동 시세 갱신"을 켜 두면 새 시세가 올 때마다 금융자산의 현재가·배당을 알아서 바꿔 줌
// ※ 이름은 모두 market~ / MARKET~ 로 시작
// assets.js보다 먼저 불러옴 (함수만 만들어 두고, 금융자산을 바꾸는 일은 시세를 받은 뒤에)
// =============================================

// =============================================
// 1. 상수
// =============================================

const MARKET_DATA_URL = "https://raw.githubusercontent.com/286y8wb8d2-cell/Go/data/market-data.json";
const MARKET_REFRESH_MS = 30 * 60 * 1000; // 30분이 지나면 다시 받음
const MARKET_SETTINGS_KEY = "household-market-settings"; // 백업에 포함
const MARKET_FX_SYMBOL = "KRW=X"; // 원/달러 환율

// =============================================
// 2. 상태 · 설정
// =============================================

let marketData = null; // { updated, stocks: { "QQQ": {...} }, markets: { "^GSPC": {...} } }
let marketLoadedAt = 0;
let marketLoading = null;
let marketError = null;

// { autoPrice: 새 시세로 현재가 자동 갱신, autoDividend: 배당금·지급월도, appliedAt: 마지막으로 적용한 시세 시각(참고용) }
function loadMarketSettings() {
  const settings = { autoPrice: true, autoDividend: true, appliedAt: "" };
  try {
    const saved = JSON.parse(localStorage.getItem(MARKET_SETTINGS_KEY));
    if (saved && typeof saved === "object") {
      if (typeof saved.autoPrice === "boolean") settings.autoPrice = saved.autoPrice;
      if (typeof saved.autoDividend === "boolean") settings.autoDividend = saved.autoDividend;
      if (typeof saved.appliedAt === "string") settings.appliedAt = saved.appliedAt;
    }
  } catch (error) {
    // 깨져 있으면 기본값
  }
  return settings;
}

let marketSettings = loadMarketSettings();

function saveMarketSettings() {
  try {
    localStorage.setItem(MARKET_SETTINGS_KEY, JSON.stringify(marketSettings));
  } catch (error) {
    // 저장이 막혀도 화면은 동작
  }
}

// =============================================
// 3. 시세 받기
// =============================================

// 30분 안에 받은 게 있으면 그대로 (force면 새로)
async function refreshMarketData(force) {
  if (!force && marketData && Date.now() - marketLoadedAt < MARKET_REFRESH_MS) return marketData;
  if (marketLoading) return marketLoading;
  marketLoading = (async function () {
    try {
      // ?t=: 30분마다 주소가 바뀌어 예전에 받아 둔 파일을 쓰지 않음
      const response = await fetch(MARKET_DATA_URL + "?t=" + Math.floor(Date.now() / MARKET_REFRESH_MS));
      if (!response.ok) throw new Error("응답 오류 " + response.status);
      const json = await response.json();
      if (!json || !json.stocks) throw new Error("시세 파일 모양이 달라요");
      marketData = json;
      marketLoadedAt = Date.now();
      marketError = null;
    } catch (error) {
      marketError = error;
    } finally {
      marketLoading = null;
    }
    document.dispatchEvent(new CustomEvent("market-updated"));
    return marketData;
  })();
  return marketLoading;
}

// =============================================
// 4. 시세 읽기 도구
// =============================================

// 입력한 티커를 시세 파일의 이름으로 (소문자 → 대문자, 국내 6자리 코드는 .KS/.KQ 붙이기)
function normalizeMarketTicker(text) {
  const ticker = String(text || "").trim().toUpperCase();
  if (!ticker) return "";
  if (/^\d{6}$/.test(ticker) && marketData) {
    if (marketData.stocks[ticker + ".KS"]) return ticker + ".KS";
    if (marketData.stocks[ticker + ".KQ"]) return ticker + ".KQ";
  }
  return ticker;
}

function getMarketQuote(ticker) {
  if (!marketData || !ticker) return null;
  return marketData.stocks[normalizeMarketTicker(ticker)] || null;
}

// 원/달러 환율 (시세 파일 기준)
function getMarketFx() {
  const fx = marketData && marketData.markets[MARKET_FX_SYMBOL];
  return fx ? fx.price : null;
}

// 시세의 원화 값 (달러면 환율을 곱함, 다른 통화는 지원 안 함)
function toMarketKrw(value, currency) {
  if (!Number.isFinite(value)) return null;
  if (currency === "KRW") return value;
  if (currency === "USD") {
    const fx = getMarketFx();
    return fx ? value * fx : null;
  }
  return null;
}

// 시세 파일의 시각 → "10월 17일"
function getMarketDateText(seconds) {
  const date = new Date(seconds * 1000);
  return date.getMonth() + 1 + "월 " + date.getDate() + "일";
}

// 국내 종목인지 (.KS / .KQ)
function isKoreanTicker(ticker) {
  return /\.(KS|KQ)$/.test(normalizeMarketTicker(ticker));
}

// 작은 추이선 SVG (월말 종가 목록 → 선 하나). 오르면 빨강, 내리면 파랑
function createMarketSparkline(closes, width, height) {
  const svg = createSvgElement("svg", { viewBox: "0 0 " + width + " " + height, class: "market-spark", "aria-hidden": "true" });
  const values = (closes || []).filter(function (v) {
    return Number.isFinite(v);
  });
  if (values.length < 2) return svg;
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const points = values
    .map(function (value, index) {
      const x = (index / (values.length - 1)) * width;
      const y = max === min ? height / 2 : height - 2 - ((value - min) / (max - min)) * (height - 4);
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
  svg.appendChild(
    createSvgElement("polyline", { points: points, class: values[values.length - 1] >= values[0] ? "market-spark-up" : "market-spark-down" })
  );
  return svg;
}

// SVG 요소 만들기 (history.js의 createSvg는 이 파일보다 늦게 불러오므로 따로)
function createSvgElement(tag, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.keys(attributes).forEach(function (name) {
    element.setAttribute(name, attributes[name]);
  });
  return element;
}

// =============================================
// 5. 금융자산에 시세 적용
// =============================================

// 종목명으로 티커 찾기: 이름이 티커와 같거나(QQQ) 국내 종목 이름과 같으면(삼성전자)
function findMarketTickerByName(name) {
  if (!marketData) return "";
  const text = String(name || "").trim();
  const upper = text.toUpperCase();
  if (marketData.stocks[upper]) return upper;
  const symbols = Object.keys(marketData.stocks);
  for (const symbol of symbols) {
    if (marketData.stocks[symbol].name === text || symbol.replace(/\.(KS|KQ)$/, "") === upper) return symbol;
  }
  return "";
}

// 티커 칸이 생기기 전에 넣은 종목(ticker가 아예 없는)은 종목명으로 티커를 찾아 연결
// (수정 화면에서 일부러 비워 둔 종목은 ""라서 건드리지 않음) → 연결한 종목 이름 목록
function linkMarketTickers() {
  const linked = [];
  assets.forEach(function (asset) {
    if (asset.ticker !== undefined) return;
    const ticker = findMarketTickerByName(asset.name);
    if (ticker) {
      asset.ticker = ticker;
      linked.push(asset.name);
    }
  });
  return linked;
}

// 티커가 있는 종목의 현재가(원)와, 켜 두었으면 배당금·지급월을 최신 시세로 바꿈
// → { updated: 바뀐 종목 수, missing: 시세를 못 찾은 티커 목록, noTicker: 티커가 없는 종목 수 }
function applyMarketToAssets() {
  const result = { updated: 0, missing: [], noTicker: 0, linked: [] };
  if (!marketData) return result;
  result.linked = linkMarketTickers();
  assets.forEach(function (asset) {
    // assets: assets.js
    if (!asset.ticker) {
      if (asset.kind === "kr-stock" || asset.kind === "us-stock" || asset.kind === "etf") result.noTicker += 1;
      return;
    }
    const quote = getMarketQuote(asset.ticker);
    const price = quote ? toMarketKrw(quote.price, quote.currency) : null;
    if (!price) {
      result.missing.push(asset.ticker);
      return;
    }
    const before = JSON.stringify([asset.currentPrice, asset.dividendPerShare, asset.payMonths]);
    asset.currentPrice = Math.round(price * 100) / 100;
    if (marketSettings.autoDividend && quote.divTTM > 0 && quote.divMonths.length > 0) {
      asset.dividendPerShare = Math.round(toMarketKrw(quote.divTTM, quote.currency) * 100) / 100;
      asset.payMonths = quote.divMonths.slice();
    }
    result.updated += 1;
    if (JSON.stringify([asset.currentPrice, asset.dividendPerShare, asset.payMonths]) !== before) result.changed = true;
  });
  // 실제로 바뀐 게 있을 때만 저장 (같은 시세를 다시 받았을 때는 그대로)
  if (result.changed || result.linked.length > 0) {
    saveAssets(); // assets.js (저장하면서 다른 화면에도 알림)
    renderAssets();
  }
  marketSettings.appliedAt = marketData.updated;
  saveMarketSettings();
  return result;
}

// 시세를 받을 때마다: 자동 갱신이 켜져 있으면 적용 (바뀐 게 없으면 저장하지 않음)
let marketLastApplyResult = null;
document.addEventListener("market-updated", function () {
  if (marketData && marketSettings.autoPrice) {
    marketLastApplyResult = applyMarketToAssets();
  }
});

// 앱을 열 때, 그리고 다시 화면에 띄울 때 (30분이 지났으면) 새 시세 확인
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) refreshMarketData(false);
});
