// =============================================
// 비트코인 탭 — 시장 정보 ② 캔들 차트
// 빗썸 일봉(하루 단위 시가·고가·저가·종가)을 받아서
// 주봉·월봉은 일봉을 묶어 계산하고, SVG로 직접 그림
// (createSvg, formatAxisValue는 history.js, 자동 갱신 도구는 btc.js)
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 빗썸 일봉 전체 (각 줄: [시각, 시가, 종가, 고가, 저가, 거래량])
const BTC_CANDLE_URL = "https://api.bithumb.com/public/candlestick/BTC_KRW/24h";
// 빗썸이 안 될 때: 코인게코 최근 1년 하루 가격 (고가·저가는 없음)
const BTC_CANDLE_FALLBACK_URL =
  "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=krw&days=365&interval=daily";

// 일봉 데이터는 10분마다 새로 받음 (오늘 봉이 계속 바뀌므로)
const BTC_CHART_EVERY_MS = 10 * 60 * 1000;

// 그래프 크기 (viewBox 기준, 실제로는 화면 폭에 맞춰 늘어남)
const BTC_CHART = { width: 340, height: 220, left: 46, right: 8, top: 10, bottom: 24 };

const BTC_DAY_MS = 24 * 60 * 60 * 1000;

// 기간 버튼 → 며칠
// (3개월: 일봉 몸통이 보일 만큼 봉이 적은 기간)
const BTC_RANGE_DAYS = { "3m": 92, "1y": 365, "4y": 4 * 365 + 1, all: Infinity };
const BTC_RANGE_NAMES = { "3m": "3개월", "1y": "1년", "4y": "4년", all: "전체 기간" };
const BTC_INTERVAL_NAMES = { day: "일봉", week: "주봉", month: "월봉" };

// =============================================
// 2. 상태
// =============================================

let btcDailyCandles = []; // [{ time, open, high, low, close }] 오래된 것부터
let btcChartFallback = false; // 코인게코 대체 데이터인지
let btcInterval = "day";
let btcRange = "3m";

let btcShownCandles = []; // 지금 그래프에 그린 봉들
let btcChartScale = null; // 그래프 좌표 계산 정보 (고른 봉 표시에 씀)
let btcSelectedIndex = null;

// =============================================
// 화면 요소
// =============================================

const btcChart = document.getElementById("btc-chart");
const btcChartChange = document.getElementById("btc-chart-change");
const btcChartReadout = document.getElementById("btc-chart-readout");
const btcChartStatus = document.getElementById("btc-chart-status");
const btcIntervalButtons = document.querySelectorAll("[data-btc-interval]");
const btcRangeButtons = document.querySelectorAll("[data-btc-range]");

// =============================================
// 3. 데이터 받기와 계산
// =============================================

// 빗썸 일봉: 칸 순서가 문서마다 달리 적혀 있는 경우가 있어서 데이터로 확인함
// - 종가 칸: "그날 종가 ≈ 다음 날 시가"가 가장 잘 맞는 칸
// - 나머지 두 칸 중 큰 값이 고가, 작은 값이 저가
function parseBithumbCandles(rows) {
  const numbers = rows
    .map(function (row) {
      return row.slice(0, 5).map(Number);
    })
    .filter(function (row) {
      return row.every(Number.isFinite) && row[1] > 0;
    });
  if (numbers.length < 2) {
    throw new Error("일봉 데이터가 부족해요");
  }

  // 최근 300개로 종가 칸 찾기
  const recent = numbers.slice(-300);
  let closeColumn = 2;
  let bestError = Infinity;
  [2, 3, 4].forEach(function (column) {
    let error = 0;
    for (let i = 0; i < recent.length - 1; i++) {
      error = error + Math.abs(recent[i][column] - recent[i + 1][1]) / recent[i + 1][1];
    }
    if (error < bestError) {
      bestError = error;
      closeColumn = column;
    }
  });

  return numbers.map(function (row) {
    const others = [2, 3, 4]
      .filter(function (column) {
        return column !== closeColumn;
      })
      .map(function (column) {
        return row[column];
      });
    const open = row[1];
    const close = row[closeColumn];
    return {
      time: row[0],
      open: open,
      close: close,
      high: Math.max(open, close, others[0], others[1]),
      low: Math.min(open, close, others[0], others[1]),
    };
  });
}

// 코인게코 하루 가격 → 봉 모양 (시가 = 전날 가격, 고가·저가는 시가·종가로 대신)
function parseCoinGeckoPrices(prices) {
  const candles = [];
  for (let i = 1; i < prices.length; i++) {
    const open = Number(prices[i - 1][1]);
    const close = Number(prices[i][1]);
    if (!(open > 0 && close > 0)) continue;
    candles.push({ time: prices[i][0], open: open, close: close, high: Math.max(open, close), low: Math.min(open, close) });
  }
  return candles;
}

// 일봉 받아 오기 (빗썸 → 코인게코)
async function refreshBtcCandles() {
  try {
    const result = await fetchCryptoJson(BTC_CANDLE_URL); // crypto.js
    if (!result || result.status !== "0000" || !Array.isArray(result.data)) {
      throw new Error("빗썸 응답 오류");
    }
    btcDailyCandles = parseBithumbCandles(result.data);
    btcChartFallback = false;
  } catch (error) {
    try {
      const result = await fetchCryptoJson(BTC_CANDLE_FALLBACK_URL);
      btcDailyCandles = parseCoinGeckoPrices(result.prices);
      btcChartFallback = true;
    } catch (fallbackError) {
      if (btcDailyCandles.length === 0) {
        btcChartStatus.textContent = getBtcClock() + " 차트 데이터를 받지 못했어요. 잠시 뒤 다시 시도해요.";
      }
      return false;
    }
  }
  btcSelectedIndex = null;
  renderBtcChart();
  return true;
}

// "그 봉이 속한 묶음"의 이름: 주봉은 그 주 월요일 날짜, 월봉은 "2026-10"
function getBtcGroupKey(time, interval) {
  const date = new Date(time);
  if (interval === "month") {
    return date.getFullYear() * 100 + date.getMonth();
  }
  const daysFromMonday = (date.getDay() + 6) % 7; // 월요일 0 … 일요일 6
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysFromMonday);
  return monday.getTime();
}

// 기간에 맞는 일봉만 골라서, 주봉·월봉이면 묶음
function getBtcShownCandles() {
  const days = BTC_RANGE_DAYS[btcRange];
  const from = Date.now() - days * BTC_DAY_MS;
  const daily = btcDailyCandles.filter(function (candle) {
    return candle.time >= from;
  });
  if (btcInterval === "day") {
    return daily;
  }
  // 같은 묶음끼리: 시가는 첫날, 종가는 마지막 날, 고가·저가는 그중 가장 높고 낮은 값
  const groups = [];
  let lastKey = null;
  daily.forEach(function (candle) {
    const key = getBtcGroupKey(candle.time, btcInterval);
    if (key !== lastKey) {
      groups.push({ time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close });
      lastKey = key;
    } else {
      const group = groups[groups.length - 1];
      group.high = Math.max(group.high, candle.high);
      group.low = Math.min(group.low, candle.low);
      group.close = candle.close;
    }
  });
  return groups;
}

// 눈금 간격을 1·2·2.5·5 × 10ⁿ 중 알맞은 값으로
function getBtcNiceStep(rough) {
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    if (rough <= step * power) {
      return step * power;
    }
  }
  return 10 * power;
}

// 세로축 눈금 값들
// - 보통: 최저~최고 사이를 4칸 정도로
// - 로그(전체 기간): 1·2·5 × 10ⁿ (많으면 10ⁿ만)
function getBtcTicks(min, max, useLog) {
  const ticks = [];
  if (useLog) {
    for (let power = Math.floor(Math.log10(min)); power <= Math.ceil(Math.log10(max)); power++) {
      [1, 2, 5].forEach(function (m) {
        const value = m * Math.pow(10, power);
        if (value >= min && value <= max) ticks.push(value);
      });
    }
    if (ticks.length > 6) {
      return ticks.filter(function (value) {
        // 10ⁿ인 값만 (log10 값이 정수)
        return Math.abs(Math.log10(value) - Math.round(Math.log10(value))) < 1e-9;
      });
    }
    return ticks;
  }
  const step = getBtcNiceStep((max - min) / 4);
  for (let value = Math.ceil(min / step) * step; value <= max; value = value + step) {
    ticks.push(value);
  }
  return ticks;
}

// 봉 날짜 글자 (고른 봉 안내용)
function formatBtcCandleDate(time) {
  const date = new Date(time);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (btcInterval === "month") return y + "년 " + m + "월";
  if (btcInterval === "week") return y + "년 " + m + "월 " + d + "일 주";
  return y + "년 " + m + "월 " + d + "일";
}

// =============================================
// 4. 화면 그리기
// =============================================

// 버튼 눌림 표시
function renderBtcChartButtons() {
  btcIntervalButtons.forEach(function (button) {
    button.setAttribute("aria-pressed", button.dataset.btcInterval === btcInterval ? "true" : "false");
  });
  btcRangeButtons.forEach(function (button) {
    button.setAttribute("aria-pressed", button.dataset.btcRange === btcRange ? "true" : "false");
  });
}

function renderBtcChart() {
  renderBtcChartButtons();
  btcChart.innerHTML = "";
  btcShownCandles = getBtcShownCandles();
  const candles = btcShownCandles;
  if (candles.length === 0) {
    btcChartChange.textContent = "";
    btcChartReadout.innerHTML = "";
    btcChartScale = null;
    return;
  }

  const c = BTC_CHART;
  const plotWidth = c.width - c.left - c.right;
  const plotHeight = c.height - c.top - c.bottom;

  // 세로축 범위: 가장 낮은 저가 ~ 가장 높은 고가 (위아래 약간 여유)
  let min = Infinity;
  let max = 0;
  candles.forEach(function (candle) {
    min = Math.min(min, candle.low);
    max = Math.max(max, candle.high);
  });
  // 전체 기간은 가격 차이가 수백 배라서 로그 눈금 (같은 높이 = 같은 비율의 변화)
  const useLog = btcRange === "all" && max / min > 20;
  let yMin;
  let yMax;
  if (useLog) {
    yMin = Math.log10(min) - 0.05;
    yMax = Math.log10(max) + 0.05;
  } else {
    const pad = (max - min) * 0.05 || max * 0.05;
    yMin = Math.max(0, min - pad);
    yMax = max + pad;
  }
  function y(value) {
    const v = useLog ? Math.log10(value) : value;
    return c.top + plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight;
  }
  // 봉 하나가 차지하는 폭과 가운데 위치
  const slot = plotWidth / candles.length;
  function x(index) {
    return c.left + slot * (index + 0.5);
  }
  btcChartScale = { x: x, y: y, slot: slot };

  // ① 가로 눈금선 + 왼쪽 가격 글자
  const tickMin = useLog ? Math.pow(10, yMin) : yMin;
  const tickMax = useLog ? Math.pow(10, yMax) : yMax;
  getBtcTicks(tickMin, tickMax, useLog).forEach(function (value) {
    btcChart.appendChild(createSvg("line", { x1: c.left, x2: c.width - c.right, y1: y(value), y2: y(value), class: "chart-grid" }));
    const label = createSvg("text", { x: c.left - 6, y: y(value) + 4, class: "chart-axis-label", "text-anchor": "end" });
    label.textContent = formatAxisValue(value); // history.js
    btcChart.appendChild(label);
  });

  // ② 아래 날짜 글자: 2년 넘게 보이면 연도, 아니면 달이 바뀌는 곳 (최대 5개)
  const spanDays = (candles[candles.length - 1].time - candles[0].time) / BTC_DAY_MS;
  const byYear = spanDays > 730;
  const marks = [];
  candles.forEach(function (candle, index) {
    if (index === 0) return;
    const now = new Date(candle.time);
    const before = new Date(candles[index - 1].time);
    if (byYear ? now.getFullYear() !== before.getFullYear() : now.getMonth() !== before.getMonth()) {
      marks.push(index);
    }
  });
  const every = Math.ceil(marks.length / 5);
  marks.forEach(function (index, order) {
    if (order % every !== 0) return;
    const date = new Date(candles[index].time);
    const month = date.getMonth() + 1;
    let text;
    if (byYear) {
      text = String(date.getFullYear());
    } else {
      text = month === 1 ? String(date.getFullYear()).slice(2) + ".1월" : month + "월";
    }
    const label = createSvg("text", { x: x(index), y: c.height - 8, class: "chart-axis-label", "text-anchor": "middle" });
    label.textContent = text;
    btcChart.appendChild(label);
  });

  // ③ 봉: 오른 봉(빨강)과 내린 봉(파랑)을 각각 경로 하나로 모아서 그림 (봉이 수천 개여도 빠르게)
  //    심지 = 고가~저가 세로선, 몸통 = 시가~종가 네모 (봉이 너무 촘촘하면 심지만)
  const bodyWidth = slot * 0.7;
  const drawBody = bodyWidth >= 1.5;
  const paths = { up: { wick: "", body: "" }, down: { wick: "", body: "" } };
  candles.forEach(function (candle, index) {
    const kind = candle.close >= candle.open ? "up" : "down";
    const cx = x(index);
    paths[kind].wick += "M" + cx.toFixed(2) + " " + y(candle.high).toFixed(2) + "V" + y(candle.low).toFixed(2);
    if (drawBody) {
      const top = y(Math.max(candle.open, candle.close));
      const height = Math.max(1, y(Math.min(candle.open, candle.close)) - top);
      paths[kind].body +=
        "M" + (cx - bodyWidth / 2).toFixed(2) + " " + top.toFixed(2) +
        "h" + bodyWidth.toFixed(2) + "v" + height.toFixed(2) + "h" + (-bodyWidth).toFixed(2) + "Z";
    }
  });
  ["up", "down"].forEach(function (kind) {
    if (paths[kind].wick) {
      btcChart.appendChild(
        createSvg("path", { d: paths[kind].wick, class: "btc-wick btc-" + kind, "stroke-width": drawBody ? 1 : Math.max(0.6, Math.min(slot, 1.5)) })
      );
    }
    if (paths[kind].body) {
      btcChart.appendChild(createSvg("path", { d: paths[kind].body, class: "btc-body btc-" + kind }));
    }
  });

  // ④ 고른 봉 표시용 세로선 (위치는 selectBtcCandle에서 옮김)
  btcChart.appendChild(createSvg("line", { id: "btc-crosshair", y1: c.top, y2: c.top + plotHeight, class: "chart-crosshair" }));

  // 기간 전체 변화: 첫 봉 시가 → 마지막 봉 종가
  const first = candles[0];
  const last = candles[candles.length - 1];
  const change = (last.close / first.open - 1) * 100;
  btcChartChange.textContent = "";
  const changeLabel = document.createElement("span");
  changeLabel.textContent = BTC_RANGE_NAMES[btcRange] + " 동안 ";
  const changeValue = document.createElement("strong");
  changeValue.className = getProfitClass(change);
  changeValue.textContent = formatPercent(change);
  const changeDetail = document.createElement("span");
  changeDetail.className = "btc-chart-change-detail";
  changeDetail.textContent = " (" + formatKoreanUnit(first.open) + " → " + formatKoreanUnit(last.close) + ")";
  btcChartChange.append(changeLabel, changeValue, changeDetail);

  // 아래 안내
  const notes = [BTC_INTERVAL_NAMES[btcInterval] + " " + candles.length + "개"];
  if (useLog) notes.push("로그 눈금 (같은 높이 = 같은 비율)");
  if (!drawBody) notes.push("봉이 촘촘해서 고가~저가 선만 표시");
  if (btcChartFallback) notes.push("빗썸 대신 코인게코 하루 가격 (최근 1년, 고가·저가 없음)");
  btcChartStatus.textContent = notes.join(" · ");

  if (btcSelectedIndex === null || btcSelectedIndex >= candles.length) {
    btcSelectedIndex = candles.length - 1;
  }
  selectBtcCandle(btcSelectedIndex);
}

// 고른 봉: 세로선을 옮기고 아래에 시가·고가·저가·종가를 보여 줌
// (봉 수천 개를 다시 그리지 않도록 이 부분만 바꿈)
function selectBtcCandle(index) {
  const candle = btcShownCandles[index];
  if (!candle || !btcChartScale) return;
  btcSelectedIndex = index;

  const crosshair = document.getElementById("btc-crosshair");
  const cx = btcChartScale.x(index);
  crosshair.setAttribute("x1", cx);
  crosshair.setAttribute("x2", cx);

  const change = (candle.close / candle.open - 1) * 100;
  btcChartReadout.innerHTML = "";
  const title = document.createElement("span");
  title.className = "readout-title";
  title.textContent = formatBtcCandleDate(candle.time) + " ";
  const changeText = document.createElement("strong");
  changeText.className = getProfitClass(change);
  changeText.textContent = formatPercent(change);
  title.appendChild(changeText);
  btcChartReadout.appendChild(title);

  [
    ["시가", candle.open],
    ["고가", candle.high],
    ["저가", candle.low],
    ["종가", candle.close],
  ].forEach(function (pair) {
    const item = document.createElement("span");
    item.className = "readout-item";
    const name = document.createElement("span");
    name.className = "readout-name";
    name.textContent = pair[0];
    const value = document.createElement("strong");
    value.textContent = formatKoreanUnit(pair[1]);
    item.append(name, value);
    btcChartReadout.appendChild(item);
  });
}

// 손가락·마우스 위치에서 가장 가까운 봉 고르기
function selectBtcCandleAt(clientX) {
  if (btcShownCandles.length === 0 || !btcChartScale) return;
  const rect = btcChart.getBoundingClientRect();
  const svgX = ((clientX - rect.left) / rect.width) * BTC_CHART.width;
  const index = Math.floor((svgX - BTC_CHART.left) / btcChartScale.slot);
  const clamped = Math.min(Math.max(index, 0), btcShownCandles.length - 1);
  if (clamped !== btcSelectedIndex) {
    selectBtcCandle(clamped);
  }
}

// =============================================
// 5. 이벤트 처리
// =============================================

btcIntervalButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    btcInterval = button.dataset.btcInterval;
    btcSelectedIndex = null;
    renderBtcChart();
  });
});

btcRangeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    btcRange = button.dataset.btcRange;
    btcSelectedIndex = null;
    renderBtcChart();
  });
});

btcChart.addEventListener("pointerdown", function (event) {
  selectBtcCandleAt(event.clientX);
});
btcChart.addEventListener("pointermove", function (event) {
  if (event.pointerType === "mouse" || event.buttons > 0) {
    selectBtcCandleAt(event.clientX);
  }
});

// 키보드 ← → 로 봉 옮기기
btcChart.addEventListener("keydown", function (event) {
  if (btcShownCandles.length === 0) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    selectBtcCandle(Math.min(Math.max(btcSelectedIndex + step, 0), btcShownCandles.length - 1));
  }
});

// 시작: 버튼 표시만 해 두고, 데이터는 비트코인 탭을 열 때 받음
renderBtcChartButtons();
btcChartStatus.textContent = "차트를 불러오는 중…";
addBtcTask(refreshBtcCandles, BTC_CHART_EVERY_MS);
