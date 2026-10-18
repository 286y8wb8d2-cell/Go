// =============================================
// 비트코인 탭 — 매수 vs 매도 (실시간 체결 흐름)
// 거래소 체결 하나하나를 "사려는 쪽이 체결시켰는지(매수) / 팔려는 쪽이 체결시켰는지(매도)"로 나눠
// 최근 1·5·15분 동안 어느 쪽 힘이 셌는지 보여 줌. 1 BTC 이상의 큰 거래도 따로 모음
// 체결 정보는 btc-live.js의 웹소켓이 recordBtcTrade()로 넘겨 줌 (저장하지 않고 화면에만)
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

const BTC_FLOW_KEEP_MS = 15 * 60 * 1000; // 최근 15분만 기억
const BTC_FLOW_WINDOWS = { "1m": 60 * 1000, "5m": 5 * 60 * 1000, "15m": 15 * 60 * 1000 };
const BTC_FLOW_WINDOW_NAMES = { "1m": "1분", "5m": "5분", "15m": "15분" };
const BTC_WHALE_BTC = 1; // 이 수량 이상이면 "큰 거래"
const BTC_WHALE_SHOW = 10;
const BTC_FLOW_EXCHANGES = { upbit: "업비트", bithumb: "빗썸", binance: "바이낸스", coinbase: "코인베이스" };

// =============================================
// 2. 상태 · 화면 요소
// =============================================

// 1초 단위 묶음: [{ second, exchange, buy, sell }] (BTC 수량)
let btcFlowBuckets = [];
let btcWhales = []; // [{ time, exchange, side, size, price }]
let btcFlowWindow = "5m";
let btcFlowTimer = null;

const btcFlowBuy = document.getElementById("btc-flow-buy");
const btcFlowSell = document.getElementById("btc-flow-sell");
const btcFlowBuyBar = document.getElementById("btc-flow-buy-bar");
const btcFlowSellBar = document.getElementById("btc-flow-sell-bar");
const btcFlowRows = document.getElementById("btc-flow-rows");
const btcWhaleList = document.getElementById("btc-whale-list");
const btcFlowStatus = document.getElementById("btc-flow-status");
const btcFlowButtons = document.querySelectorAll("[data-btc-flow]");

// =============================================
// 3. 체결 받기
// =============================================

// side: "buy" | "sell", size: BTC 수량, price: 그 거래소 가격(원 또는 달러)
function recordBtcTrade(exchange, side, size, price, time) {
  if (!(size > 0) || !BTC_FLOW_EXCHANGES[exchange]) return;
  const second = Math.floor(time / 1000);
  const last = btcFlowBuckets[btcFlowBuckets.length - 1];
  let bucket = null;
  // 같은 초·같은 거래소면 합침 (최근 몇 개만 뒤져 봄)
  for (let i = btcFlowBuckets.length - 1; i >= 0 && i >= btcFlowBuckets.length - 6; i--) {
    if (btcFlowBuckets[i].second === second && btcFlowBuckets[i].exchange === exchange) {
      bucket = btcFlowBuckets[i];
      break;
    }
  }
  if (!bucket) {
    bucket = { second: second, exchange: exchange, buy: 0, sell: 0 };
    btcFlowBuckets.push(bucket);
  }
  bucket[side] = bucket[side] + size;
  if (size >= BTC_WHALE_BTC) {
    btcWhales.unshift({ time: time, exchange: exchange, side: side, size: size, price: price });
    btcWhales = btcWhales.slice(0, BTC_WHALE_SHOW);
  }
  // 오래된 것 정리
  if (last && second - btcFlowBuckets[0].second > BTC_FLOW_KEEP_MS / 1000) {
    const cutoff = second - BTC_FLOW_KEEP_MS / 1000;
    btcFlowBuckets = btcFlowBuckets.filter(function (item) {
      return item.second >= cutoff;
    });
  }
}

// =============================================
// 4. 화면 그리기
// =============================================

function renderBtcFlow() {
  btcFlowButtons.forEach(function (button) {
    button.setAttribute("aria-pressed", button.dataset.btcFlow === btcFlowWindow ? "true" : "false");
  });
  const from = Math.floor((Date.now() - BTC_FLOW_WINDOWS[btcFlowWindow]) / 1000);
  const total = { buy: 0, sell: 0 };
  const byExchange = {};
  btcFlowBuckets.forEach(function (bucket) {
    if (bucket.second < from) return;
    total.buy += bucket.buy;
    total.sell += bucket.sell;
    const item = byExchange[bucket.exchange] || (byExchange[bucket.exchange] = { buy: 0, sell: 0 });
    item.buy += bucket.buy;
    item.sell += bucket.sell;
  });
  const sum = total.buy + total.sell;
  if (sum === 0) {
    btcFlowStatus.textContent = isBtcActive() ? "체결을 모으는 중… (실시간 연결이 필요해요)" : "";
    return;
  }
  const buyShare = (total.buy / sum) * 100;
  btcFlowBuy.textContent = "매수 " + buyShare.toFixed(1) + "%";
  btcFlowSell.textContent = "매도 " + (100 - buyShare).toFixed(1) + "%";
  btcFlowBuyBar.style.width = buyShare + "%";
  btcFlowSellBar.style.width = 100 - buyShare + "%";

  // 거래소별 한 줄씩
  btcFlowRows.innerHTML = "";
  Object.keys(BTC_FLOW_EXCHANGES).forEach(function (key) {
    const item = byExchange[key];
    if (!item) return;
    const share = (item.buy / (item.buy + item.sell)) * 100;
    const li = document.createElement("li");
    li.className = "btc-flow-row";
    const name = document.createElement("span");
    name.className = "btc-flow-name";
    name.textContent = BTC_FLOW_EXCHANGES[key];
    const bar = document.createElement("span");
    bar.className = "btc-flow-mini";
    const fill = document.createElement("span");
    fill.className = "btc-flow-mini-buy";
    fill.style.width = share + "%";
    bar.appendChild(fill);
    const text = document.createElement("span");
    text.className = "btc-flow-amount";
    text.textContent = formatBtcDecimal(item.buy, 2) + " / " + formatBtcDecimal(item.sell, 2) + " BTC";
    li.append(name, bar, text);
    btcFlowRows.appendChild(li);
  });

  // 큰 거래
  btcWhaleList.innerHTML = "";
  btcWhales.forEach(function (whale) {
    const li = document.createElement("li");
    li.className = "btc-whale " + whale.side;
    const date = new Date(whale.time);
    const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(function (n) {
        return String(n).padStart(2, "0");
      })
      .join(":");
    const side = document.createElement("strong");
    side.className = whale.side === "buy" ? "profit-up" : "profit-down";
    side.textContent = whale.side === "buy" ? "매수" : "매도";
    li.append(time + " · " + BTC_FLOW_EXCHANGES[whale.exchange] + " · ", side, " " + formatBtcDecimal(whale.size, 3) + " BTC");
    btcWhaleList.appendChild(li);
  });
  if (btcWhales.length === 0) {
    const li = document.createElement("li");
    li.className = "btc-whale empty";
    li.textContent = BTC_WHALE_BTC + " BTC 이상 거래를 기다리는 중…";
    btcWhaleList.appendChild(li);
  }

  btcFlowStatus.textContent =
    "최근 " + BTC_FLOW_WINDOW_NAMES[btcFlowWindow] + " 동안 매수 " + formatBtcDecimal(total.buy, 2) + " BTC · 매도 " + formatBtcDecimal(total.sell, 2) +
    " BTC · 앱을 연 뒤부터 모은 값이에요.";
}

// 시세 탭을 보고 있을 때만 1초마다 다시 그림
function updateBtcFlowTimer() {
  const run = isBtcActive() && btcView === "market"; // btc.js
  if (run && btcFlowTimer === null) {
    renderBtcFlow();
    btcFlowTimer = setInterval(renderBtcFlow, 1000);
  } else if (!run && btcFlowTimer !== null) {
    clearInterval(btcFlowTimer);
    btcFlowTimer = null;
  }
}

// =============================================
// 5. 이벤트 처리
// =============================================

btcFlowButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    btcFlowWindow = button.dataset.btcFlow;
    renderBtcFlow();
  });
});
document.addEventListener("btc-active", updateBtcFlowTimer);
document.addEventListener("btc-view-shown", updateBtcFlowTimer);
