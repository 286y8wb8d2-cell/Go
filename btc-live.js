// =============================================
// 비트코인 탭 — ① 시세: 실시간 가격 · 김치 프리미엄 · 시장 지표
// - 실시간 가격: 업비트·빗썸·바이낸스·코인베이스 웹소켓 (거래가 일어날 때마다 바로 받음)
//   체결(누가 사고팔았는지)은 btc-flow.js로 넘김
//   ※ 업비트는 일반 주소(REST)로는 브라우저에서 막혀 있지만 웹소켓은 열려 있음
// - 웹소켓이 안 되면 30초마다 일반 주소로 (빗썸 → 해외: 바이낸스·코인게코)
// - 김치 프리미엄: 환율 기준 + USDT(테더) 기준 두 가지
// - 시장 지표: 비트코인 도미넌스, 원/달러 환율, USDT 시세
// (자동 갱신 도구와 작은 도구들은 btc.js)
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 웹소켓 주소와 연결되면 보낼 글 (받을 종목 신청)
// - 업비트·빗썸: 현재가(ticker)는 { ty: "ticker", cd: 종목, tp: 가격, scr: 24시간 변동률, hp/lp: 고가/저가, atp24h: 거래대금 }
//               체결(trade)은 { ty: "trade", tp: 가격, tv: 수량, ab: "BID"(사는 쪽이 체결) | "ASK"(파는 쪽이 체결) }
// - 바이낸스: 두 흐름을 한 번에 (24시간 시세 + 체결) → { stream, data }
// - 코인베이스: 현재가(ticker)와 체결(match)
function getBtcKoreanSubscribe() {
  return JSON.stringify([
    { ticket: "household-" + Math.random().toString(36).slice(2) },
    { type: "ticker", codes: ["KRW-BTC", "KRW-USDT"] },
    { type: "trade", codes: ["KRW-BTC"] },
    { format: "SIMPLE" },
  ]);
}
const BTC_SOCKETS = {
  upbit: { name: "업비트", url: "wss://api.upbit.com/websocket/v1", subscribe: getBtcKoreanSubscribe },
  bithumb: { name: "빗썸", url: "wss://ws-api.bithumb.com/websocket/v1", subscribe: getBtcKoreanSubscribe },
  binance: { name: "바이낸스", url: "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcusdt@aggTrade", subscribe: null },
  coinbase: {
    name: "코인베이스",
    url: "wss://ws-feed.exchange.coinbase.com",
    subscribe: function () {
      return JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker", "matches"] });
    },
  },
};

// 웹소켓이 끊기면 다시 연결: 2초부터 시작해 최대 30초 간격
const BTC_SOCKET_RETRY_MIN_MS = 2000;
const BTC_SOCKET_RETRY_MAX_MS = 30000;

// 이 시간 안에 받은 가격만 "지금 가격"으로 씀
const BTC_PRICE_FRESH_MS = 2 * 60 * 1000;

// 화면은 너무 자주 바꾸지 않게 (거래가 1초에 수십 번 올 수 있음)
const BTC_RENDER_GAP_MS = 400;

// 일반 주소 (웹소켓이 안 될 때)
const BTC_BITHUMB_TICKER_URL = "https://api.bithumb.com/public/ticker/BTC_KRW";
const BTC_GLOBAL_SOURCES = [
  {
    name: "바이낸스",
    url: "https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT",
    read: function (json) {
      return Number(json.lastPrice);
    },
  },
  {
    name: "코인게코",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    read: function (json) {
      return Number(json.bitcoin.usd);
    },
  },
];

// 원/달러 환율 (위에서부터 차례로)
const BTC_FX_SOURCES = [
  {
    name: "ExchangeRate-API",
    url: "https://open.er-api.com/v6/latest/USD",
    read: function (json) {
      return Number(json.rates.KRW);
    },
  },
  {
    // 코인게코의 비트코인 원화 가격 ÷ 달러 가격 = 코인게코가 쓰는 환율
    name: "코인게코",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,krw",
    read: function (json) {
      return Number(json.bitcoin.krw) / Number(json.bitcoin.usd);
    },
  },
];
const BTC_FX_KEEP_MS = 60 * 60 * 1000; // 환율은 1시간 동안 다시 씀

// 도미넌스: 전체 코인 시가총액 중 비트코인 비중
const BTC_GLOBAL_URL = "https://api.coingecko.com/api/v3/global";

const BTC_REST_EVERY_MS = 30000;
const BTC_DOMINANCE_EVERY_MS = 10 * 60 * 1000;

// =============================================
// 2. 상태
// =============================================

// 받아 온 가격: { price, change(24시간 %), time(받은 시각), via: "실시간" | "30초", high, low, volume(24시간 거래대금) }
const btcPrices = { upbit: null, bithumb: null, usdt: null, binance: null, coinbase: null };
let btcFx = null; // { value, name, time }
let btcDominance = null; // 57.3 (%)

// 웹소켓: { upbit: { socket, retryMs, timer, open }, ... }
const btcSockets = {};

let btcRenderTimer = null;
let btcLastRenderedPrice = null;

// 다른 파일이 쓰는 "지금 원화 가격" (실시간 블록의 수수료 원화 환산 등)
let btcDomesticPrice = null;

// =============================================
// 화면 요소
// =============================================

const btcExchangeButtons = document.querySelectorAll("[data-btc-exchange]");
const btcLiveKrw = document.getElementById("btc-live-krw");
const btcLiveKrwSub = document.getElementById("btc-live-krw-sub");
const btcLiveOther = document.getElementById("btc-live-other");
const btcLiveUsd = document.getElementById("btc-live-usd");
const btcLiveUsdSub = document.getElementById("btc-live-usd-sub");
const btcLiveSats = document.getElementById("btc-live-sats");
const btcLiveSatsSub = document.getElementById("btc-live-sats-sub");
const btcLiveMine = document.getElementById("btc-live-mine");
const btcLiveMineValue = document.getElementById("btc-live-mine-value");
const btcLiveMineSub = document.getElementById("btc-live-mine-sub");
const btcLiveStatus = document.getElementById("btc-live-status");
const btcLiveStats = document.getElementById("btc-live-stats");
const btcExchangeTableBody = document.getElementById("btc-exchange-table-body");

const btcKimpRate = document.getElementById("btc-kimp-rate");
const btcKimpDiff = document.getElementById("btc-kimp-diff");
const btcKimpDomestic = document.getElementById("btc-kimp-domestic");
const btcKimpDomesticSub = document.getElementById("btc-kimp-domestic-sub");
const btcKimpGlobal = document.getElementById("btc-kimp-global");
const btcKimpGlobalSub = document.getElementById("btc-kimp-global-sub");
const btcKimpUsdt = document.getElementById("btc-kimp-usdt");
const btcKimpStatus = document.getElementById("btc-kimp-status");

const btcDomValue = document.getElementById("btc-dom-value");
const btcDomSub = document.getElementById("btc-dom-sub");
const btcFxValue = document.getElementById("btc-fx-value");
const btcFxSub = document.getElementById("btc-fx-sub");
const btcUsdtValue = document.getElementById("btc-usdt-value");
const btcUsdtSub = document.getElementById("btc-usdt-sub");

// =============================================
// 3. 계산
// =============================================

// 최근에 받은 가격만 (오래된 값은 null)
function getFreshBtcPrice(key) {
  const item = btcPrices[key];
  return item && Date.now() - item.time < BTC_PRICE_FRESH_MS ? item : null;
}

// 지금 원화 가격: 고른 거래소 → 다른 거래소 순서
function getBtcKrw() {
  const first = btcSettings.exchange; // btc.js
  const second = first === "upbit" ? "bithumb" : "upbit";
  const found = getFreshBtcPrice(first) || getFreshBtcPrice(second);
  if (!found) return null;
  return {
    price: found.price,
    change: found.change,
    via: found.via,
    high: found.high,
    low: found.low,
    volume: found.volume,
    exchange: found === getFreshBtcPrice(first) ? first : second,
  };
}

// 달러 → 원 환율 (1시간 안에 받은 것)
function getBtcFxValue() {
  return btcFx ? btcFx.value : null;
}

// =============================================
// 4. 화면 그리기
// =============================================

// 너무 자주 그리지 않게 모아서 한 번에
function scheduleBtcRender() {
  if (btcRenderTimer !== null) return;
  btcRenderTimer = setTimeout(function () {
    btcRenderTimer = null;
    renderBtcLive();
  }, BTC_RENDER_GAP_MS);
}

function renderBtcExchangeButtons() {
  btcExchangeButtons.forEach(function (button) {
    button.setAttribute("aria-pressed", button.dataset.btcExchange === btcSettings.exchange ? "true" : "false");
  });
}

function renderBtcLive() {
  renderBtcExchangeButtons();
  const krw = getBtcKrw();
  const usd = getFreshBtcPrice("binance");
  const fx = getBtcFxValue();
  btcDomesticPrice = krw ? krw.price : null;

  // ① 큰 가격 (오르면 빨강, 내리면 파랑으로 잠깐 깜빡)
  if (krw) {
    btcLiveKrw.textContent = formatMoney(krw.price);
    if (btcLastRenderedPrice !== null && krw.price !== btcLastRenderedPrice) {
      btcLiveKrw.classList.remove("btc-tick-up", "btc-tick-down");
      void btcLiveKrw.offsetWidth;
      btcLiveKrw.classList.add(krw.price > btcLastRenderedPrice ? "btc-tick-up" : "btc-tick-down");
    }
    btcLastRenderedPrice = krw.price;
    btcLiveKrwSub.textContent = BTC_SOCKETS[krw.exchange].name + " · 24시간 ";
    const change = document.createElement("strong");
    change.className = getProfitClass(krw.change);
    change.textContent = formatPercent(krw.change);
    btcLiveKrwSub.appendChild(change);

    // 다른 거래소 가격 한 줄
    const otherKey = krw.exchange === "upbit" ? "bithumb" : "upbit";
    const other = getFreshBtcPrice(otherKey);
    btcLiveOther.textContent = other
      ? BTC_SOCKETS[otherKey].name + " " + formatMoney(other.price) + " (" + formatSignedMoney(other.price - krw.price) + ")"
      : "";

    // 24시간 고가 · 저가 · 거래대금
    const stats = [];
    if (krw.high > 0) stats.push("고가 " + formatKoreanUnit(krw.high));
    if (krw.low > 0) stats.push("저가 " + formatKoreanUnit(krw.low));
    if (krw.volume > 0) stats.push("거래대금 " + formatKoreanUnit(krw.volume));
    btcLiveStats.textContent = stats.length > 0 ? "24시간 " + stats.join(" · ") : "";

    // 1,000원으로 살 수 있는 비트코인 (사토시 = 1억분의 1 BTC)
    btcLiveSats.textContent = formatBtcDecimal((1000 / krw.price) * 100000000, 0) + " sats";
    btcLiveSatsSub.textContent = "1 sat = " + formatBtcDecimal(krw.price / 100000000, 2) + "원";
  }

  // ② 해외 가격
  if (usd) {
    btcLiveUsd.textContent = "$" + formatBtcDecimal(usd.price, 0);
    btcLiveUsdSub.textContent = "";
    const change = document.createElement("span");
    change.className = getProfitClass(usd.change);
    change.textContent = "24시간 " + formatPercent(usd.change);
    btcLiveUsdSub.appendChild(change);
  }

  // ③ 내 비트코인 지금 가치 (저장하지 않고 보여 주기만)
  const mine = getMyBtcHolding(); // btc.js
  btcLiveMine.hidden = !(krw && mine.quantity > 0);
  if (krw && mine.quantity > 0) {
    const value = mine.quantity * krw.price;
    const profit = value - mine.cost;
    btcLiveMineValue.textContent = formatMoney(value);
    btcLiveMineSub.textContent = formatNumber(mine.quantity) + " BTC · 손익 ";
    const profitText = document.createElement("strong");
    profitText.className = getProfitClass(profit);
    profitText.textContent = formatSignedMoney(profit) + (mine.cost > 0 ? " (" + formatPercent((profit / mine.cost) * 100) + ")" : "");
    btcLiveMineSub.appendChild(profitText);
  }

  renderBtcSocketStatus();
  renderBtcKimp(krw, usd, fx);
  renderBtcExchangeTable(usd, fx);
  renderBtcTiles(fx);
  // 계산기·스택 목표 등이 새 가격으로 다시 계산하도록 알림
  document.dispatchEvent(new CustomEvent("btc-price-updated"));
}

// 연결 상태 한 줄
function renderBtcSocketStatus() {
  const live = Object.keys(BTC_SOCKETS).filter(function (key) {
    return btcSockets[key] && btcSockets[key].open;
  });
  if (live.length > 0) {
    btcLiveStatus.textContent =
      "● 실시간 연결: " +
      live
        .map(function (key) {
          return BTC_SOCKETS[key].name;
        })
        .join(" · ");
    btcLiveStatus.classList.add("btc-live-on");
  } else {
    btcLiveStatus.textContent = getBtcKrw()
      ? "실시간 연결이 안 돼서 30초마다 새로 받고 있어요."
      : "시세를 불러오는 중…";
    btcLiveStatus.classList.remove("btc-live-on");
  }
}

// 김치 프리미엄(%) = (국내 가격 ÷ 해외 가격을 원화로 바꾼 값 - 1) × 100
function renderBtcKimp(krw, usd, fx) {
  if (krw) {
    btcKimpDomestic.textContent = formatMoney(krw.price);
    btcKimpDomesticSub.textContent = BTC_SOCKETS[krw.exchange].name;
  }
  const globalKrw = usd && fx ? usd.price * fx : null;
  if (globalKrw) {
    btcKimpGlobal.textContent = formatMoney(globalKrw);
    btcKimpGlobalSub.textContent = "$" + formatBtcDecimal(usd.price, 0) + " × " + formatBtcDecimal(fx, 1) + "원";
  }

  if (krw && globalKrw) {
    const rate = (krw.price / globalKrw - 1) * 100;
    btcKimpRate.textContent = formatPercent(rate);
    btcKimpRate.className = "btc-big " + getProfitClass(rate);
    btcKimpDiff.textContent =
      (rate >= 0 ? "국내가 " : "국내가 해외보다 ") +
      formatKoreanUnit(Math.abs(krw.price - globalKrw)) +
      (rate >= 0 ? " 더 비싸요" : " 더 싸요");
    btcKimpStatus.textContent =
      "해외: " + (btcPrices.binance ? btcPrices.binance.source : "-") + " · 환율: " + (btcFx ? btcFx.name : "-");
  }

  // USDT 기준: 국내에서 테더(≈1달러)를 얼마에 사고파는지로 계산
  const usdt = getFreshBtcPrice("usdt");
  if (krw && usd && usdt) {
    const rate = (krw.price / (usd.price * usdt.price) - 1) * 100;
    btcKimpUsdt.textContent = "";
    btcKimpUsdt.append("USDT 기준 김프 ");
    const strong = document.createElement("strong");
    strong.className = getProfitClass(rate);
    strong.textContent = formatPercent(rate);
    btcKimpUsdt.append(strong, " (테더 1개 " + formatBtcDecimal(usdt.price, 1) + "원)");
  }
}

// 거래소별 가격: 원화로 바꾼 가격과, 해외(바이낸스) 대비 몇 % 비싼지
function renderBtcExchangeTable(usd, fx) {
  btcExchangeTableBody.innerHTML = "";
  const base = usd && fx ? usd.price * fx : null; // 바이낸스 가격의 원화 환산 = 기준
  [
    ["upbit", "업비트", "KRW"],
    ["bithumb", "빗썸", "KRW"],
    ["binance", "바이낸스", "USDT"],
    ["coinbase", "코인베이스", "USD"],
  ].forEach(function (item) {
    const price = getFreshBtcPrice(item[0]);
    if (!price) return;
    const krw = item[2] === "KRW" ? price.price : fx ? price.price * fx : null;
    const tr = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = item[1];
    const original = document.createElement("td");
    original.textContent = item[2] === "KRW" ? formatMoney(price.price) : "$" + formatBtcDecimal(price.price, 0);
    const won = document.createElement("td");
    won.textContent = krw ? formatKoreanUnit(krw) : "-";
    const premium = document.createElement("td");
    if (krw && base) {
      const rate = (krw / base - 1) * 100;
      premium.textContent = item[0] === "binance" ? "기준" : formatPercent(rate);
      if (item[0] !== "binance") premium.className = getProfitClass(rate);
    } else {
      premium.textContent = "-";
    }
    tr.append(name, original, won, premium);
    btcExchangeTableBody.appendChild(tr);
  });
}

// 시장 지표 칸: 도미넌스 · 환율 · USDT
function renderBtcTiles(fx) {
  if (btcDominance !== null) {
    btcDomValue.textContent = btcDominance.toFixed(1) + "%";
    btcDomSub.textContent = "전체 코인 시가총액 중";
  }
  if (fx) {
    btcFxValue.textContent = formatBtcDecimal(fx, 1) + "원";
    btcFxSub.textContent = "1달러 · " + btcFx.name;
  }
  const usdt = getFreshBtcPrice("usdt");
  if (usdt) {
    btcUsdtValue.textContent = formatBtcDecimal(usdt.price, 1) + "원";
    if (fx) {
      const gap = (usdt.price / fx - 1) * 100;
      btcUsdtSub.textContent = "환율보다 " + formatPercent(gap);
    } else {
      btcUsdtSub.textContent = "테더 1개";
    }
  }
}

// =============================================
// 5. 웹소켓 (실시간)
// =============================================

// 받은 글 → 가격 저장
function handleBtcSocketMessage(key, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return;
  }
  const now = Date.now();
  if (key === "binance") {
    const stream = String(data.stream || "");
    const item = data.data || data;
    if (stream.indexOf("aggTrade") !== -1 || item.e === "aggTrade") {
      // { p: 가격, q: 수량, m: true면 파는 쪽이 체결(매도) } → btc-flow.js
      recordBtcTrade("binance", item.m ? "sell" : "buy", Number(item.q), Number(item.p), now);
      return;
    }
    // 24시간 시세: { c: 마지막 가격, P: 변동률(%), h/l: 고가/저가, q: 거래대금(USDT) }
    const price = Number(item.c);
    if (price > 0) {
      btcPrices.binance = { price: price, change: Number(item.P), time: now, via: "실시간", source: "바이낸스", high: Number(item.h), low: Number(item.l), volume: Number(item.q) };
    }
  } else if (key === "coinbase") {
    if (data.type === "ticker") {
      const price = Number(data.price);
      const open = Number(data.open_24h);
      if (price > 0) {
        btcPrices.coinbase = { price: price, change: open > 0 ? (price / open - 1) * 100 : 0, time: now, via: "실시간", high: Number(data.high_24h), low: Number(data.low_24h) };
      }
    } else if (data.type === "match") {
      // 코인베이스의 side는 "먼저 걸어 둔 주문" 쪽이라서 실제로 체결시킨 쪽은 반대
      recordBtcTrade("coinbase", data.side === "buy" ? "sell" : "buy", Number(data.size), Number(data.price), now);
      return;
    } else {
      return;
    }
  } else {
    const price = Number(data.tp);
    if (!(price > 0)) return;
    if (data.ty === "trade") {
      if (data.cd === "KRW-BTC") recordBtcTrade(key, data.ab === "BID" ? "buy" : "sell", Number(data.tv), price, now);
      return;
    }
    const change = Number(data.scr) * 100; // 0.0123 → 1.23%
    if (data.cd === "KRW-BTC") {
      btcPrices[key] = { price: price, change: change, time: now, via: "실시간", high: Number(data.hp), low: Number(data.lp), volume: Number(data.atp24h) };
    } else if (data.cd === "KRW-USDT") {
      btcPrices.usdt = { price: price, change: change, time: now, via: "실시간" };
    }
  }
  scheduleBtcRender();
}

function connectBtcSocket(key) {
  const info = BTC_SOCKETS[key];
  const state = btcSockets[key] || (btcSockets[key] = { socket: null, retryMs: BTC_SOCKET_RETRY_MIN_MS, timer: null, open: false });
  if (state.socket) return;
  let socket;
  try {
    socket = new WebSocket(info.url);
  } catch (error) {
    scheduleBtcReconnect(key);
    return;
  }
  socket.binaryType = "arraybuffer"; // 업비트는 글을 바이트로 보냄
  state.socket = socket;

  socket.onopen = function () {
    state.open = true;
    state.retryMs = BTC_SOCKET_RETRY_MIN_MS;
    if (info.subscribe) socket.send(info.subscribe());
    scheduleBtcRender();
  };
  socket.onmessage = function (event) {
    const text = typeof event.data === "string" ? event.data : new TextDecoder("utf-8").decode(event.data);
    handleBtcSocketMessage(key, text);
  };
  socket.onclose = function () {
    state.socket = null;
    state.open = false;
    scheduleBtcRender();
    scheduleBtcReconnect(key);
  };
  socket.onerror = function () {
    // 이어서 onclose가 불림 → 거기서 다시 연결
  };
}

// 비트코인 탭을 보고 있을 때만 다시 연결 (간격은 점점 늘림)
function scheduleBtcReconnect(key) {
  const state = btcSockets[key];
  if (!state || state.timer !== null || !isBtcActive()) return; // isBtcActive: btc.js
  state.timer = setTimeout(function () {
    state.timer = null;
    if (isBtcActive()) connectBtcSocket(key);
  }, state.retryMs);
  state.retryMs = Math.min(state.retryMs * 2, BTC_SOCKET_RETRY_MAX_MS);
}

function startBtcSockets() {
  Object.keys(BTC_SOCKETS).forEach(connectBtcSocket);
}

function stopBtcSockets() {
  Object.keys(btcSockets).forEach(function (key) {
    const state = btcSockets[key];
    clearTimeout(state.timer);
    state.timer = null;
    if (state.socket) {
      state.socket.onclose = null; // 일부러 닫는 것이니 다시 연결하지 않음
      state.socket.close();
      state.socket = null;
    }
    state.open = false;
  });
}

// =============================================
// 6. 일반 주소로 받기 (자동 갱신 할 일)
// =============================================

// 환율: 1시간 안에 받은 게 있으면 그대로 씀
async function refreshBtcFx() {
  if (btcFx && Date.now() - btcFx.time < BTC_FX_KEEP_MS) return btcFx;
  const found = await tryBtcSources(BTC_FX_SOURCES); // btc.js
  btcFx = { value: found.value, name: found.name, time: Date.now() };
  return btcFx;
}

// 30초마다: 환율, 그리고 웹소켓으로 못 받고 있는 가격만 일반 주소로
async function refreshBtcRest() {
  const jobs = [refreshBtcFx()];
  if (!getFreshBtcPrice("upbit") && !getFreshBtcPrice("bithumb")) {
    jobs.push(
      fetchCryptoJson(BTC_BITHUMB_TICKER_URL).then(function (result) {
        if (!result || result.status !== "0000" || !result.data) throw new Error("빗썸 응답 오류");
        const price = Number(result.data.closing_price);
        if (price > 0) {
          btcPrices.bithumb = {
            price: price,
            change: Number(result.data.fluctate_rate_24H),
            time: Date.now(),
            via: "30초",
            high: Number(result.data.max_price),
            low: Number(result.data.min_price),
            volume: Number(result.data.acc_trade_value_24H),
          };
        }
      })
    );
  }
  if (!getFreshBtcPrice("binance")) {
    jobs.push(
      tryBtcSources(BTC_GLOBAL_SOURCES).then(function (found) {
        const old = btcPrices.binance;
        btcPrices.binance = { price: found.value, change: old ? old.change : 0, time: Date.now(), via: "30초", source: found.name };
      })
    );
  }
  const results = await Promise.allSettled(jobs);
  renderBtcLive();

  const failed = results.filter(function (result) {
    return result.status === "rejected";
  });
  if (!getBtcKrw() || !getFreshBtcPrice("binance") || !btcFx) {
    btcKimpStatus.textContent =
      getBtcClock() + " 일부 정보를 받지 못했어요" +
      (failed.length > 0 ? " (" + describeBtcError(failed[0].reason) + ")" : "") + ". 잠시 뒤 다시 시도해요.";
    if (btcKimpRate.textContent === "-") btcKimpDiff.textContent = "아직 계산하지 못했어요.";
    return false;
  }
  return true;
}

// 10분마다: 도미넌스
async function refreshBtcDominance() {
  try {
    const result = await fetchCryptoJson(BTC_GLOBAL_URL);
    const value = Number(result.data.market_cap_percentage.btc);
    if (!(value > 0)) throw new Error("값 없음");
    btcDominance = value;
    renderBtcTiles(getBtcFxValue());
    return true;
  } catch (error) {
    // 예비 데이터(btc-info.js)에 있으면 그 값
    try {
      const data = await getBtcData();
      if (data.dominance > 0) {
        btcDominance = data.dominance;
        renderBtcTiles(getBtcFxValue());
        return true;
      }
    } catch (fallbackError) {
      // 예비 데이터도 없음
    }
    if (btcDominance === null) btcDomSub.textContent = "받지 못했어요";
    return false;
  }
}

// =============================================
// 7. 이벤트 처리
// =============================================

btcExchangeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    btcSettings.exchange = button.dataset.btcExchange;
    saveBtcSettings(); // btc.js
    btcLastRenderedPrice = null;
    renderBtcLive();
  });
});

// 비트코인 탭을 열면 연결, 떠나면 끊음
document.addEventListener("btc-active", function (event) {
  if (event.detail.active) {
    startBtcSockets();
  } else {
    stopBtcSockets();
  }
});

// 내 코인을 고치면 "내 비트코인 지금 가치"도 다시
document.addEventListener("data-saved", function (event) {
  if (event.detail.key === CRYPTO_STORAGE_KEY) scheduleBtcRender();
});

// 시작
renderBtcExchangeButtons();
addBtcTask(refreshBtcRest, BTC_REST_EVERY_MS);
addBtcTask(refreshBtcDominance, BTC_DOMINANCE_EVERY_MS);
