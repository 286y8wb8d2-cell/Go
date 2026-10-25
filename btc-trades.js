// =============================================
// 비트코인 매수 기록 → 수량·평균 매입가 자동 계산
// - 살 때(팔 때)마다 날짜·금액·체결가·수량을 남기면 이동평균으로 평균 매입가를 계산
//   (국내 거래소처럼: 사면 평균이 바뀌고, 팔면 평균은 그대로 수량만 줄어듦)
// - 계산 결과를 "보유 코인"의 비트코인(심볼 BTC)에 반영 → 다른 탭(홈·가계부·시나리오)도 같은 값을 씀
// - 차트(btc-chart.js)에 매수·매도한 날을 표시할 때도 씀
// ※ 이름은 모두 btc~ / BTC~ 로 시작 (btcTrade~)
// btc.js 바로 뒤, btc-chart.js보다 먼저 불러옴
// =============================================

const BTC_TRADES_KEY = "household-btc-trades"; // [{ id, date, type: "buy"|"sell", qty, price }] — 백업에 포함

let btcTrades = loadList(BTC_TRADES_KEY).filter(function (trade) {
  return trade && /^\d{4}-\d{2}-\d{2}$/.test(trade.date) && (trade.type === "buy" || trade.type === "sell") && trade.qty > 0 && trade.price > 0;
}); // common.js

function saveBtcTrades() {
  saveList(BTC_TRADES_KEY, btcTrades); // common.js
}

// 날짜순(같은 날이면 넣은 순서)
function getSortedBtcTrades() {
  return btcTrades.slice().sort(function (a, b) {
    return a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date);
  });
}

// 기록 전체로 지금 상태 계산 → { qty, cost, avg, realized, buys, sells, invested }
function calculateBtcTradePosition() {
  let qty = 0;
  let cost = 0; // 남은 수량의 매입 원가 합계
  let realized = 0; // 판 것에서 생긴 손익
  let invested = 0; // 산 금액 합계
  getSortedBtcTrades().forEach(function (trade) {
    if (trade.type === "buy") {
      qty += trade.qty;
      cost += trade.qty * trade.price;
      invested += trade.qty * trade.price;
    } else {
      const sellQty = Math.min(trade.qty, qty);
      const avg = qty > 0 ? cost / qty : 0;
      realized += sellQty * (trade.price - avg);
      cost -= sellQty * avg;
      qty -= sellQty;
    }
  });
  // 아주 작은 소수 오차 정리
  if (qty < 1e-9) {
    qty = 0;
    cost = 0;
  }
  return { qty: qty, cost: cost, avg: qty > 0 ? cost / qty : 0, realized: realized, invested: invested };
}

// "보유 코인"의 비트코인 찾기 (심볼 BTC)
function findBtcTradeCrypto() {
  return cryptos.find(function (crypto) {
    return getCryptoSymbol(crypto) === "BTC"; // crypto.js
  });
}

// 계산 결과를 보유 코인에 반영 (없으면 새로 만듦)
function syncBtcTradesToCrypto() {
  if (btcTrades.length === 0) return;
  const position = calculateBtcTradePosition();
  let crypto = findBtcTradeCrypto();
  if (!crypto) {
    crypto = { id: String(Date.now()), name: "비트코인", symbol: "BTC", quantity: 0, avgPrice: 0, currentPrice: btcDomesticPrice || position.avg, place: "", memo: "매수 기록으로 계산" };
    cryptos.push(crypto);
  }
  crypto.quantity = Math.round(position.qty * 1e8) / 1e8;
  crypto.avgPrice = Math.round(position.avg);
  if (!(crypto.currentPrice > 0)) crypto.currentPrice = crypto.avgPrice;
  saveCryptos(); // crypto.js (저장하면서 다른 화면에도 알림)
  renderCryptos();
}

// =============================================
// 화면
// =============================================

const btcTradeSummary = document.getElementById("btc-trade-summary");
const btcTradeStartBtn = document.getElementById("btc-trade-start-btn");
const btcTradeForm = document.getElementById("btc-trade-form");
const btcTradeType = document.getElementById("btc-trade-type");
const btcTradeDate = document.getElementById("btc-trade-date");
const btcTradeAmount = document.getElementById("btc-trade-amount");
const btcTradePrice = document.getElementById("btc-trade-price");
const btcTradeQty = document.getElementById("btc-trade-qty");
const btcTradeNowPrice = document.getElementById("btc-trade-now-price");
const btcTradeList = document.getElementById("btc-trade-list");

function renderBtcTrades() {
  const holding = findBtcTradeCrypto();
  // 기록이 없고 이미 비트코인이 있으면: 지금 보유량을 첫 기록으로 넣는 버튼
  btcTradeStartBtn.hidden = !(btcTrades.length === 0 && holding && holding.quantity > 0);

  if (btcTrades.length === 0) {
    btcTradeSummary.textContent = "아직 기록이 없어요.";
  } else {
    const p = calculateBtcTradePosition();
    btcTradeSummary.textContent = "";
    btcTradeSummary.append("기록 " + btcTrades.length + "건 · 보유 " + formatBtcDecimal(p.qty, 8) + " BTC · 평균 매입가 "); // btc.js
    const avg = document.createElement("strong");
    avg.textContent = formatMoney(p.avg);
    btcTradeSummary.appendChild(avg);
    if (p.realized !== 0) {
      btcTradeSummary.append(" · 판 것의 손익 ");
      const realized = document.createElement("strong");
      realized.className = getProfitClass(p.realized);
      realized.textContent = formatSignedMoney(p.realized);
      btcTradeSummary.appendChild(realized);
    }
  }

  btcTradeList.innerHTML = "";
  getSortedBtcTrades()
    .reverse()
    .forEach(function (trade) {
      const li = document.createElement("li");
      li.className = "btc-trade-item";
      const badge = document.createElement("span");
      badge.className = "btc-trade-badge " + (trade.type === "buy" ? "buy" : "sell");
      badge.textContent = trade.type === "buy" ? "매수" : "매도";
      const text = document.createElement("span");
      text.className = "budget-edit-text";
      const title = document.createElement("strong");
      title.textContent = formatBtcDecimal(trade.qty, 8) + " BTC";
      const sub = document.createElement("small");
      sub.textContent = trade.date.replace(/-/g, ".") + " · " + formatMoney(trade.price) + "에" + (trade.memo ? " · " + trade.memo : "");
      text.append(title, sub);
      const amount = document.createElement("span");
      amount.className = "budget-edit-amount";
      amount.textContent = formatMoney(trade.qty * trade.price);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete-btn";
      del.textContent = "삭제";
      del.addEventListener("click", function () {
        if (!confirm(trade.date + " " + (trade.type === "buy" ? "매수" : "매도") + " 기록을 지울까요?\n보유 수량과 평균 매입가가 다시 계산돼요.")) return;
        btcTrades = btcTrades.filter(function (t) {
          return t.id !== trade.id;
        });
        saveBtcTrades();
        syncBtcTradesToCrypto();
        renderBtcTrades();
      });
      li.append(badge, text, amount, del);
      btcTradeList.appendChild(li);
    });
}

// 금액·체결가·수량 중 마지막으로 고친 두 칸으로 나머지 한 칸 채우기
let btcTradeLastEdited = [];
function fillBtcTradeForm(edited) {
  btcTradeLastEdited = btcTradeLastEdited.filter(function (name) {
    return name !== edited;
  });
  btcTradeLastEdited.push(edited);
  if (btcTradeLastEdited.length > 2) btcTradeLastEdited.shift();
  if (btcTradeLastEdited.length < 2) return;
  const amount = Number(btcTradeAmount.value);
  const price = Number(btcTradePrice.value);
  const qty = Number(btcTradeQty.value);
  const has = function (name) {
    return btcTradeLastEdited.indexOf(name) !== -1;
  };
  if (has("amount") && has("price") && amount > 0 && price > 0) btcTradeQty.value = Math.round((amount / price) * 1e8) / 1e8;
  else if (has("price") && has("qty") && price > 0 && qty > 0) btcTradeAmount.value = Math.round(price * qty);
  else if (has("amount") && has("qty") && amount > 0 && qty > 0) btcTradePrice.value = Math.round(amount / qty);
}

// =============================================
// 이벤트 처리
// =============================================

[["amount", btcTradeAmount], ["price", btcTradePrice], ["qty", btcTradeQty]].forEach(function (pair) {
  pair[1].addEventListener("input", function () {
    fillBtcTradeForm(pair[0]);
  });
});

btcTradeNowPrice.addEventListener("click", function () {
  if (!btcDomesticPrice) {
    alert("아직 실시간 가격을 받지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    return;
  }
  btcTradePrice.value = Math.round(btcDomesticPrice); // btc-live.js
  fillBtcTradeForm("price");
});

btcTradeForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const trade = {
    id: Date.now().toString(36),
    date: btcTradeDate.value || getToday(), // common.js
    type: btcTradeType.value,
    qty: Number(btcTradeQty.value),
    price: Number(btcTradePrice.value),
  };
  if (!(trade.qty > 0) || !(trade.price > 0)) {
    alert("금액·체결가·수량 중 두 칸을 넣어 주세요.");
    return;
  }
  if (trade.date > getToday()) {
    alert("앞으로 올 날짜는 넣을 수 없어요.");
    return;
  }
  if (trade.type === "sell") {
    // 그날까지 가진 수량보다 많이 팔 수는 없음
    const before = calculateBtcTradePosition().qty;
    if (trade.qty > before + 1e-9) {
      alert("기록상 보유 수량(" + formatBtcDecimal(before, 8) + " BTC)보다 많이 팔 수 없어요.");
      return;
    }
  }
  // 처음 기록인데 이미 비트코인을 갖고 있으면: 지금 보유분을 덮어써도 되는지 확인
  const holding = findBtcTradeCrypto();
  if (btcTrades.length === 0 && holding && holding.quantity > 0 &&
    !confirm("첫 기록이에요. 앞으로는 기록으로 보유 수량·평균 매입가를 계산해요.\n지금 보유분(" + formatBtcDecimal(holding.quantity, 8) + " BTC)을 먼저 '지금 보유량을 첫 기록으로 넣기'로 넣어 두는 게 좋아요.\n그래도 이 기록만으로 계산할까요?")) {
    return;
  }
  btcTrades.push(trade);
  saveBtcTrades();
  syncBtcTradesToCrypto();
  btcTradeForm.reset();
  btcTradeDate.value = getToday();
  btcTradeLastEdited = [];
  renderBtcTrades();
});

// 지금 보유량(수량·평균 매입가)을 오늘 날짜의 매수 한 건으로
btcTradeStartBtn.addEventListener("click", function () {
  const holding = findBtcTradeCrypto();
  if (!holding) return;
  btcTrades.push({ id: Date.now().toString(36), date: getToday(), type: "buy", qty: holding.quantity, price: holding.avgPrice, memo: "기존 보유분" });
  saveBtcTrades();
  syncBtcTradesToCrypto();
  renderBtcTrades();
});

// 보유 코인을 직접 고치거나 백업을 불러오면 버튼·요약 다시
document.addEventListener("data-saved", function (event) {
  if (event.detail.key === "household-crypto") renderBtcTrades();
});

// 시작
btcTradeDate.value = getToday();
renderBtcTrades();
