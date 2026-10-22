// =============================================
// 비트코인 탭 — ④ 도구 + 내 코인의 스택 목표
// - 계산기: BTC · 사토시 · 원 · 달러를 서로 바꿈 (실시간 가격 기준)
// - 적립식 시뮬레이터: "그때부터 매달 10만 원씩 샀다면?" (2010년부터의 일봉으로 계산)
// - 솔로 채굴 확률: 내 채굴기로 블록을 찾을 확률 (네트워크 해시레이트는 btc-chain.js가 받아 옴)
// - 스택 목표: 목표 BTC 수량까지 얼마나 모았는지 (설정은 btc.js가 저장, 백업에 포함)
// - 이 금액은 몇 BTC?: 아파트 값 같은 큰 금액이 지금·예전에 몇 BTC였는지
// - BIP39 단어 목록: 시드 문구에 쓰는 2048개 영어 단어 (보기만, 아무것도 저장·전송 안 함)
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

const BTC_SATS = 100000000; // 1 BTC = 1억 사토시

// 해시레이트 단위 (1초에 몇 번 계산하는지)
const BTC_HASH_UNITS = { GH: 1e9, TH: 1e12, PH: 1e15 };
const BTC_BLOCKS_PER_DAY = 144; // 10분에 한 블록

const BTC_DCA_CHART = { width: 340, height: 200, left: 46, right: 10, top: 10, bottom: 24 };
const BTC_DCA_COLORS = { value: "#2a78d6", invested: "#eb6834" }; // 지금 가치 · 투자한 돈

// 몇 BTC 계산: 이만큼 전과 비교
const BTC_WORTH_YEARS_AGO = [1, 2, 4, 8, 12];
// BIP39 영어 단어 목록 (비트코인 공식 제안 문서 저장소)
const BTC_BIP39_URL = "https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt";

// =============================================
// 2. 상태 · 화면 요소
// =============================================

let btcBip39Words = null; // 받아 온 단어 2048개

// 네트워크 정보: { hashrate(H/s), difficulty } — btc-chain.js가 채움
let btcNetwork = null;

let btcConvLast = "btc"; // 마지막으로 고친 칸 (가격이 바뀌면 이 칸 기준으로 다시 계산)
let btcDcaSeries = [];
let btcDcaScale = null;

const btcConvInputs = {
  btc: document.getElementById("btc-conv-btc"),
  sats: document.getElementById("btc-conv-sats"),
  krw: document.getElementById("btc-conv-krw"),
  usd: document.getElementById("btc-conv-usd"),
};
const btcConvNote = document.getElementById("btc-conv-note");

const btcDcaForm = document.getElementById("btc-dca-form");
const btcDcaAmount = document.getElementById("btc-dca-amount");
const btcDcaCycle = document.getElementById("btc-dca-cycle");
const btcDcaStart = document.getElementById("btc-dca-start");
const btcDcaResult = document.getElementById("btc-dca-result");
const btcDcaChart = document.getElementById("btc-dca-chart");
const btcDcaReadout = document.getElementById("btc-dca-readout");
const btcDcaNote = document.getElementById("btc-dca-note");

const btcSoloHash = document.getElementById("btc-solo-hash");
const btcSoloUnit = document.getElementById("btc-solo-unit");
const btcSoloResult = document.getElementById("btc-solo-result");
const btcSoloStatus = document.getElementById("btc-solo-status");
const btcSoloPresets = document.querySelectorAll("[data-btc-solo]");

const btcGoalForm = document.getElementById("btc-goal-form");
const btcGoalInput = document.getElementById("btc-goal-input");
const btcGoalBar = document.getElementById("btc-goal-bar");
const btcGoalText = document.getElementById("btc-goal-text");
const btcGoalSub = document.getElementById("btc-goal-sub");

const btcWorthInput = document.getElementById("btc-worth-input");
const btcWorthPresets = document.querySelectorAll("[data-btc-worth]");
const btcWorthNow = document.getElementById("btc-worth-now");
const btcWorthTableBody = document.getElementById("btc-worth-table-body");
const btcWorthNote = document.getElementById("btc-worth-note");

const btcBip39Search = document.getElementById("btc-bip39-search");
const btcBip39List = document.getElementById("btc-bip39-list");
const btcBip39Status = document.getElementById("btc-bip39-status");

// =============================================
// 3. 공통: 지금 가격
// =============================================

// 지금 원화 가격: 실시간(btc-live.js) → 없으면 차트의 마지막 종가
function getBtcToolPrice() {
  if (btcDomesticPrice) return { price: btcDomesticPrice, live: true };
  const last = btcDailyCandles[btcDailyCandles.length - 1]; // btc-chart.js
  return last ? { price: last.close, live: false, time: last.time } : null;
}

// 지금 달러 가격: 바이낸스 → 원화 ÷ 환율
function getBtcToolUsd(krwPrice) {
  const usd = getFreshBtcPrice("binance"); // btc-live.js
  if (usd) return usd.price;
  const fx = getBtcFxValue();
  return fx ? krwPrice / fx : null;
}

// 입력칸 숫자 (비었거나 이상하면 null)
function readBtcNumber(input) {
  const value = Number(input.value);
  return input.value !== "" && Number.isFinite(value) && value >= 0 ? value : null;
}

// =============================================
// 4. 계산기
// =============================================

function renderBtcConverter() {
  const now = getBtcToolPrice();
  if (!now) {
    btcConvNote.textContent = "가격을 불러오는 중…";
    return;
  }
  const usdPrice = getBtcToolUsd(now.price);
  const source = readBtcNumber(btcConvInputs[btcConvLast]);
  if (source === null) return;

  // 고친 칸 → BTC 수량
  let btc;
  if (btcConvLast === "btc") btc = source;
  if (btcConvLast === "sats") btc = source / BTC_SATS;
  if (btcConvLast === "krw") btc = source / now.price;
  if (btcConvLast === "usd") btc = usdPrice ? source / usdPrice : null;
  if (btc === null) return;

  // BTC 수량 → 나머지 칸 (고치고 있는 칸은 그대로)
  const values = {
    btc: Number(btc.toFixed(8)),
    sats: Math.round(btc * BTC_SATS),
    krw: Math.round(btc * now.price),
    usd: usdPrice ? Number((btc * usdPrice).toFixed(2)) : "",
  };
  Object.keys(btcConvInputs).forEach(function (key) {
    if (key !== btcConvLast) btcConvInputs[key].value = values[key];
  });

  btcConvNote.textContent =
    "기준: 1 BTC = " + formatMoney(now.price) +
    (usdPrice ? " · $" + formatBtcDecimal(usdPrice, 0) : "") +
    (now.live ? " (실시간)" : " (마지막 기록 가격)");
}

// =============================================
// 5. 적립식(DCA) 시뮬레이터
// =============================================

// 정해진 날마다 같은 금액으로 샀다고 계산
// cycle: "day" 매일 · "week" 매주(시작한 요일) · "month" 매달(그달 첫 거래일)
function simulateBtcDca(amount, cycle, startTime) {
  const candles = btcDailyCandles.filter(function (candle) {
    return candle.time >= startTime;
  });
  if (candles.length === 0) return null;

  let btc = 0;
  let invested = 0;
  let buys = 0;
  let lastMonth = null;
  const series = []; // 그래프용: 산 날마다 { time, invested, value }
  candles.forEach(function (candle, index) {
    const date = new Date(candle.time);
    let buy = false;
    if (cycle === "day") buy = true;
    if (cycle === "week") buy = index % 7 === 0;
    if (cycle === "month") {
      const key = date.getFullYear() * 12 + date.getMonth();
      buy = key !== lastMonth;
      lastMonth = key;
    }
    if (buy) {
      btc = btc + amount / candle.close;
      invested = invested + amount;
      buys = buys + 1;
    }
    // 그래프 점은 너무 많지 않게 (매일이면 7일마다)
    if (buy && (cycle !== "day" || buys % 7 === 1)) {
      series.push({ time: candle.time, invested: invested, value: btc * candle.close });
    }
  });

  const now = getBtcToolPrice();
  const nowPrice = now ? now.price : candles[candles.length - 1].close;
  series.push({ time: Date.now(), invested: invested, value: btc * nowPrice });
  return {
    btc: btc,
    invested: invested,
    buys: buys,
    value: btc * nowPrice,
    avgPrice: invested / btc,
    // 같은 돈을 첫날 한 번에 샀다면
    lumpValue: (invested / candles[0].close) * nowPrice,
    series: series,
    usesHistory: candles[0].source === "history",
  };
}

function renderBtcDca() {
  const amount = readBtcNumber(btcDcaAmount);
  const startText = btcDcaStart.value; // "2022-01"
  btcDcaResult.innerHTML = "";
  btcDcaChart.innerHTML = "";
  btcDcaReadout.innerHTML = "";
  if (!amount || !/^\d{4}-\d{2}$/.test(startText)) {
    btcDcaNote.textContent = "금액과 시작 달을 넣어 주세요.";
    return;
  }
  const parts = startText.split("-").map(Number);
  const result = simulateBtcDca(amount, btcDcaCycle.value, new Date(parts[0], parts[1] - 1, 1).getTime());
  if (!result || result.buys === 0) {
    btcDcaNote.textContent = "그 기간의 가격 기록이 없어요. 2010년 7월 이후로 골라 주세요.";
    return;
  }

  // 결과 4칸
  const profit = result.value - result.invested;
  const lumpProfit = result.lumpValue - result.invested;
  [
    ["투자한 돈", formatKoreanUnit(result.invested), result.buys.toLocaleString("ko-KR") + "번 매수", ""],
    ["지금 가치", formatKoreanUnit(result.value), formatPercent((profit / result.invested) * 100), getProfitClass(profit)],
    ["모은 비트코인", formatBtcDecimal(result.btc, 4) + " BTC", formatBtcDecimal(Math.round(result.btc * BTC_SATS), 0) + " sats", ""],
    ["평균 매입가", formatKoreanUnit(result.avgPrice), "1 BTC 기준", ""],
  ].forEach(function (item) {
    const card = document.createElement("div");
    card.className = "summary-card";
    const name = document.createElement("p");
    name.textContent = item[0];
    const value = document.createElement("p");
    value.textContent = item[1];
    const sub = document.createElement("p");
    sub.className = "btc-card-sub " + item[3];
    sub.textContent = item[2];
    card.append(name, value, sub);
    btcDcaResult.appendChild(card);
  });

  btcDcaNote.textContent =
    "같은 돈을 첫날 한 번에 샀다면 " + formatKoreanUnit(result.lumpValue) + " (" + formatPercent((lumpProfit / result.invested) * 100) + ")" +
    (result.usesHistory ? " · 빗썸 기록 이전은 달러 가격 × 당시 환율로 계산" : "") +
    " · 수수료·세금은 빼지 않았어요.";

  btcDcaSeries = result.series;
  renderBtcDcaChart();
}

// 두 선: 지금 가치(파랑) · 투자한 돈(주황)
function renderBtcDcaChart() {
  const series = btcDcaSeries;
  btcDcaChart.innerHTML = "";
  if (series.length < 2) return;
  const c = BTC_DCA_CHART;
  const plotWidth = c.width - c.left - c.right;
  const plotHeight = c.height - c.top - c.bottom;
  let max = 0;
  series.forEach(function (point) {
    max = Math.max(max, point.invested, point.value);
  });
  const yMax = niceMax(max); // history.js
  const t0 = series[0].time;
  const t1 = series[series.length - 1].time;
  function x(time) {
    return c.left + ((time - t0) / (t1 - t0 || 1)) * plotWidth;
  }
  function y(value) {
    return c.top + plotHeight - (value / yMax) * plotHeight;
  }
  btcDcaScale = { x: x, y: y, t0: t0, t1: t1 };

  for (let i = 0; i <= 4; i++) {
    const value = (yMax / 4) * i;
    btcDcaChart.appendChild(createSvg("line", { x1: c.left, x2: c.width - c.right, y1: y(value), y2: y(value), class: "chart-grid" }));
    const label = createSvg("text", { x: c.left - 6, y: y(value) + 4, class: "chart-axis-label", "text-anchor": "end" });
    label.textContent = formatAxisValue(value);
    btcDcaChart.appendChild(label);
  }
  // 아래: 시작 연도 · 끝 연도
  [
    [t0, "start"],
    [t1, "end"],
  ].forEach(function (pair) {
    const date = new Date(pair[0]);
    const label = createSvg("text", { x: x(pair[0]), y: c.height - 8, class: "chart-axis-label", "text-anchor": pair[1] });
    label.textContent = date.getFullYear() + "." + (date.getMonth() + 1);
    btcDcaChart.appendChild(label);
  });

  ["invested", "value"].forEach(function (key) {
    const points = series
      .map(function (point) {
        return x(point.time).toFixed(1) + "," + y(point[key]).toFixed(1);
      })
      .join(" ");
    btcDcaChart.appendChild(createSvg("polyline", { points: points, class: "chart-line", stroke: BTC_DCA_COLORS[key] }));
  });
  btcDcaChart.appendChild(createSvg("line", { id: "btc-dca-cross", y1: c.top, y2: c.top + plotHeight, class: "chart-crosshair" }));
  btcDcaChart.appendChild(createSvg("g", { id: "btc-dca-dots" }));
  selectBtcDcaIndex(series.length - 1);
}

function selectBtcDcaIndex(index) {
  const point = btcDcaSeries[index];
  if (!point || !btcDcaScale) return;
  const cx = btcDcaScale.x(point.time);
  const cross = document.getElementById("btc-dca-cross");
  cross.setAttribute("x1", cx);
  cross.setAttribute("x2", cx);
  const dots = document.getElementById("btc-dca-dots");
  dots.innerHTML = "";
  btcDcaReadout.innerHTML = "";
  const date = new Date(point.time);
  const title = document.createElement("span");
  title.className = "readout-title";
  title.textContent = index === btcDcaSeries.length - 1 ? "지금" : date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일";
  btcDcaReadout.appendChild(title);
  [
    ["value", "지금 가치"],
    ["invested", "투자한 돈"],
  ].forEach(function (pair) {
    dots.appendChild(createSvg("circle", { cx: cx, cy: btcDcaScale.y(point[pair[0]]), r: 4, fill: BTC_DCA_COLORS[pair[0]], class: "chart-dot" }));
    const item = document.createElement("span");
    item.className = "readout-item";
    const key = document.createElement("span");
    key.className = "readout-key";
    key.style.background = BTC_DCA_COLORS[pair[0]];
    const value = document.createElement("strong");
    value.textContent = formatKoreanUnit(point[pair[0]]);
    const name = document.createElement("span");
    name.className = "readout-name";
    name.textContent = pair[1];
    item.append(key, value, name);
    btcDcaReadout.appendChild(item);
  });
}

function selectBtcDcaAt(clientX) {
  if (!btcDcaScale || btcDcaSeries.length === 0) return;
  const rect = btcDcaChart.getBoundingClientRect();
  const svgX = ((clientX - rect.left) / rect.width) * BTC_DCA_CHART.width;
  const c = BTC_DCA_CHART;
  const time = btcDcaScale.t0 + ((svgX - c.left) / (c.width - c.left - c.right)) * (btcDcaScale.t1 - btcDcaScale.t0);
  // 가장 가까운 점
  let best = 0;
  btcDcaSeries.forEach(function (point, index) {
    if (Math.abs(point.time - time) < Math.abs(btcDcaSeries[best].time - time)) best = index;
  });
  selectBtcDcaIndex(best);
}

// =============================================
// 6. 솔로 채굴 확률
// =============================================

// 내 해시레이트 ÷ 전체 해시레이트 = 블록 하나를 내가 찾을 확률
function renderBtcSolo() {
  btcSoloResult.innerHTML = "";
  const value = readBtcNumber(btcSoloHash);
  if (!btcNetwork) {
    btcSoloStatus.textContent = "네트워크 해시레이트를 받는 중… (블록 탭의 정보를 씀)";
    return;
  }
  if (!value) {
    btcSoloStatus.textContent = "채굴기 해시레이트를 넣어 주세요.";
    return;
  }
  const myHash = value * BTC_HASH_UNITS[btcSoloUnit.value];
  const share = myHash / btcNetwork.hashrate; // 블록 하나당 확률
  const perDay = 1 - Math.exp(-BTC_BLOCKS_PER_DAY * share);
  const perYear = 1 - Math.exp(-BTC_BLOCKS_PER_DAY * 365 * share);
  const expectedDays = 1 / (BTC_BLOCKS_PER_DAY * share);
  const reward = calculateBtcHalving(btcTipHeight || estimateBtcHeight(), BTC_BLOCK_MS).reward; // btc-chain.js
  const rewardKrw = btcDomesticPrice ? reward * btcDomesticPrice : null;

  // 아주 작은 확률은 "약 1/N"로
  function formatChance(p) {
    if (p >= 0.01) return (p * 100).toFixed(2) + "%";
    return "약 " + Math.round(1 / p).toLocaleString("ko-KR") + "분의 1";
  }
  function formatWait(days) {
    if (days < 365) return "약 " + Math.max(1, Math.round(days)).toLocaleString("ko-KR") + "일";
    return "약 " + formatBtcDecimal(days / 365, days < 3650 ? 1 : 0) + "년";
  }
  [
    ["하루 안에 찾을 확률", formatChance(perDay)],
    ["1년 안에 찾을 확률", formatChance(perYear)],
    ["평균 기다리는 시간", formatWait(expectedDays)],
    ["찾으면 받는 보상", reward + " BTC" + (rewardKrw ? " ≈ " + formatKoreanUnit(rewardKrw) : "")],
  ].forEach(function (item) {
    const card = document.createElement("div");
    card.className = "summary-card";
    const name = document.createElement("p");
    name.textContent = item[0];
    const val = document.createElement("p");
    val.textContent = item[1];
    card.append(name, val);
    btcSoloResult.appendChild(card);
  });
  btcSoloStatus.textContent =
    "전체 네트워크 " + formatBtcDecimal(btcNetwork.hashrate / 1e18, 0) + " EH/s 기준 · 보상에 수수료는 빼고 계산 · 확률이므로 운에 따라 훨씬 빠르거나 늦을 수 있어요.";
}

// =============================================
// 7. 스택 목표 (내 코인)
// =============================================

function renderBtcGoal() {
  const goal = btcSettings.goal; // btc.js
  const mine = getMyBtcHolding();
  if (document.activeElement !== btcGoalInput) {
    btcGoalInput.value = goal > 0 ? goal : "";
  }
  if (!(goal > 0)) {
    btcGoalBar.style.width = "0%";
    btcGoalText.textContent = "목표 수량을 정하면 얼마나 모았는지 보여 줘요.";
    btcGoalSub.textContent = mine.quantity > 0 ? "지금 " + formatNumber(mine.quantity) + " BTC를 갖고 있어요." : "";
    return;
  }
  const progress = Math.min(mine.quantity / goal, 1) * 100;
  btcGoalBar.style.width = progress.toFixed(1) + "%";
  btcGoalText.textContent =
    formatNumber(goal) + " BTC 중 " + formatNumber(Number(mine.quantity.toFixed(8))) + " BTC (" + progress.toFixed(1) + "%)";
  const remaining = goal - mine.quantity;
  if (remaining <= 0) {
    btcGoalSub.textContent = "목표 달성! 🎉";
    return;
  }
  const now = getBtcToolPrice();
  btcGoalSub.textContent =
    "남은 양 " + formatBtcDecimal(Math.round(remaining * BTC_SATS), 0) + " sats" +
    (now ? " ≈ " + formatKoreanUnit(remaining * now.price) + " (지금 가격)" : "");
}

// =============================================
// 7-1. 이 금액은 몇 BTC?
// =============================================

// 그날(또는 그 직전) 종가: 일봉에서 찾기
function getBtcCloseAt(time) {
  let found = null;
  for (let i = btcDailyCandles.length - 1; i >= 0; i--) {
    if (btcDailyCandles[i].time <= time) {
      found = btcDailyCandles[i];
      break;
    }
  }
  return found;
}

function renderBtcWorth() {
  btcWorthTableBody.innerHTML = "";
  const amount = readBtcNumber(btcWorthInput);
  const now = getBtcToolPrice();
  if (!amount || !now) {
    btcWorthNow.textContent = "-";
    return;
  }
  btcWorthNow.textContent = formatBtcDecimal(amount / now.price, amount / now.price < 10 ? 3 : 1) + " BTC";
  BTC_WORTH_YEARS_AGO.forEach(function (years) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    const candle = getBtcCloseAt(date.getTime());
    if (!candle) return;
    const then = amount / candle.close;
    const tr = document.createElement("tr");
    const when = document.createElement("th");
    when.scope = "row";
    when.textContent = years + "년 전";
    const btc = document.createElement("td");
    btc.textContent = formatBtcDecimal(then, then < 10 ? 3 : then < 1000 ? 1 : 0) + " BTC";
    const price = document.createElement("td");
    price.textContent = formatKoreanUnit(candle.close);
    const times = document.createElement("td");
    times.textContent = "×" + formatBtcDecimal(then / (amount / now.price), 1);
    tr.append(when, btc, price, times);
    btcWorthTableBody.appendChild(tr);
  });
  btcWorthNote.textContent =
    "같은 원화 금액이 그때는 몇 BTC였는지예요. 집값·물가가 변한 것은 넣지 않았어요. (×: 지금보다 몇 배 많은 BTC가 필요했는지)";
}

// =============================================
// 7-2. BIP39 단어 목록
// =============================================

// 처음 도구 탭을 열 때 한 번만 받아 옴
async function loadBtcBip39() {
  if (btcBip39Words) return;
  btcBip39Status.textContent = "단어 목록을 불러오는 중…";
  try {
    const response = await fetch(BTC_BIP39_URL);
    if (!response.ok) throw new Error("응답 오류 " + response.status);
    const words = (await response.text()).trim().split(/\s+/);
    if (words.length !== 2048) throw new Error("단어 수가 2048개가 아님");
    btcBip39Words = words;
    renderBtcBip39();
  } catch (error) {
    btcBip39Status.textContent = "단어 목록을 받지 못했어요 (" + describeBtcError(error) + ").";
  }
}

function renderBtcBip39() {
  if (!btcBip39Words) return;
  const query = btcBip39Search.value.trim().toLowerCase();
  btcBip39List.innerHTML = "";
  const matches = [];
  btcBip39Words.forEach(function (word, index) {
    if (!query || word.indexOf(query) === 0 || String(index + 1) === query) matches.push(index);
  });
  // 너무 많으면 앞의 200개만 (검색으로 좁히도록)
  matches.slice(0, 200).forEach(function (index) {
    const li = document.createElement("li");
    const number = document.createElement("span");
    number.className = "btc-bip39-num";
    number.textContent = index + 1;
    li.append(number, btcBip39Words[index]);
    btcBip39List.appendChild(li);
  });
  btcBip39Status.textContent =
    (query ? "'" + query + "'(으)로 시작하는 단어 " + matches.length + "개" : "전체 2048개 중 앞 200개") +
    " · 모든 단어는 앞 4글자만으로 구분돼요.";
}

// =============================================
// 8. 이벤트 처리
// =============================================

Object.keys(btcConvInputs).forEach(function (key) {
  btcConvInputs[key].addEventListener("input", function () {
    btcConvLast = key;
    renderBtcConverter();
  });
});

btcDcaForm.addEventListener("submit", function (event) {
  event.preventDefault();
  renderBtcDca();
});
[btcDcaAmount, btcDcaCycle, btcDcaStart].forEach(function (input) {
  input.addEventListener("change", renderBtcDca);
});
btcDcaChart.addEventListener("pointerdown", function (event) {
  selectBtcDcaAt(event.clientX);
});
btcDcaChart.addEventListener("pointermove", function (event) {
  if (event.pointerType === "mouse" || event.buttons > 0) selectBtcDcaAt(event.clientX);
});

btcSoloHash.addEventListener("input", renderBtcSolo);
btcSoloUnit.addEventListener("change", renderBtcSolo);
btcSoloPresets.forEach(function (button) {
  button.addEventListener("click", function () {
    btcSoloHash.value = button.dataset.btcSolo;
    btcSoloUnit.value = "TH";
    renderBtcSolo();
  });
});

btcGoalForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const value = readBtcNumber(btcGoalInput);
  if (value === null || value > 21000000) {
    alert("목표는 0보다 크고 2,100만 BTC 이하로 넣어 주세요. (0이나 빈칸이면 목표 없음)");
    return;
  }
  btcSettings.goal = value;
  saveBtcSettings();
  btcGoalInput.blur();
  renderBtcGoal();
});

btcWorthInput.addEventListener("input", renderBtcWorth);
btcWorthPresets.forEach(function (button) {
  button.addEventListener("click", function () {
    btcWorthInput.value = button.dataset.btcWorth;
    renderBtcWorth();
  });
});
btcBip39Search.addEventListener("input", renderBtcBip39);
document.addEventListener("btc-view-shown", function (event) {
  if (event.detail.view === "more") loadBtcBip39();
});

// 가격이 바뀌면 (btc-live.js가 알림) — 너무 자주 다시 계산하지 않게 2초에 한 번
let btcToolsPriceTime = 0;
document.addEventListener("btc-price-updated", function () {
  if (Date.now() - btcToolsPriceTime < 2000) return;
  btcToolsPriceTime = Date.now();
  renderBtcConverter();
  renderBtcGoal();
  renderBtcWorth();
});
// 일봉이 새로 합쳐지면 적립식·몇 BTC 다시 계산
document.addEventListener("btc-candles-updated", function () {
  renderBtcDca();
  renderBtcWorth();
});
// 네트워크 정보가 오면 (btc-chain.js가 알림)
document.addEventListener("btc-network-updated", renderBtcSolo);
// 내 코인을 고치면 목표 진행률 다시
document.addEventListener("data-saved", function (event) {
  if (event.detail.key === CRYPTO_STORAGE_KEY) renderBtcGoal();
});

// 시작: 적립식은 4년 전 1월부터 매달 10만 원으로 미리 계산해 둠
(function () {
  btcDcaStart.max = getToday().slice(0, 7); // 이번 달까지만
  btcDcaStart.value = new Date().getFullYear() - 4 + "-01";
  renderBtcConverter();
  renderBtcDca();
  renderBtcSolo();
  renderBtcGoal();
  renderBtcWorth();
  if (btcView === "more") loadBtcBip39(); // btc.js (지난번에 더보기 탭을 보던 중이면)
})();
