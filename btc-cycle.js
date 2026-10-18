// =============================================
// 비트코인 탭 — ② 차트: 반감기 사이클 비교 + 월별 등락률
// 둘 다 btc-chart.js가 합쳐 둔 일봉(btcDailyCandles, 2010년부터)으로 계산
// - 반감기 사이클: 반감기 날 가격을 1로 놓고, 그 뒤 며칠째에 몇 배였는지 사이클끼리 겹쳐 봄
// - 월별 등락률: 해마다 달마다 얼마나 올랐/내렸는지 표 (오르면 빨강, 내리면 파랑)
// (createSvg는 history.js, getBtcTicks는 btc-chart.js)
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 비교할 사이클: 지금 사이클을 맨 앞에 (색은 검증된 팔레트 순서대로 고정)
const BTC_CYCLES = [
  { name: "지금 (2024~)", date: "2024-04-20", color: "#2a78d6", current: true },
  { name: "2020~", date: "2020-05-11", color: "#eb6834" },
  { name: "2016~", date: "2016-07-09", color: "#1baf7a" },
  { name: "2012~", date: "2012-11-28", color: "#eda100" },
];
const BTC_CYCLE_DAYS = 1460; // 반감기 사이 약 4년
const BTC_CYCLE_STEP = 2; // 이틀에 한 점 (점이 너무 많지 않게)
const BTC_CYCLE_CHART = { width: 340, height: 220, left: 40, right: 10, top: 10, bottom: 24 };

// 월별 등락률 색: 0%는 회색, 오르면 빨강·내리면 파랑으로 진해짐 (|등락률| 기준 4단계)
const BTC_HEAT_NEUTRAL = "#f0efec";
const BTC_HEAT_UP = "#dc2626";
const BTC_HEAT_DOWN = "#2563eb";
const BTC_HEAT_STEPS = [5, 15, 30]; // 이 % 미만이면 1·2·3단계, 이상이면 4단계

// =============================================
// 2. 상태 · 화면 요소
// =============================================

let btcCycleSeries = []; // [{ cycle, points: [{ day, ratio, time }] }]
let btcCycleScale = null;
let btcCycleSelectedDay = null;
let btcCycleToday = null; // 지금 사이클이 반감기 후 며칠째인지

const btcCycleChart = document.getElementById("btc-cycle-chart");
const btcCycleLegend = document.getElementById("btc-cycle-legend");
const btcCycleReadout = document.getElementById("btc-cycle-readout");
const btcHeatTable = document.getElementById("btc-heat-table");
const btcHeatSummary = document.getElementById("btc-heat-summary");

// =============================================
// 3. 계산
// =============================================

// "2024-04-20" → 그날 0시 (기기 시간)
function parseBtcDate(text) {
  const parts = text.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
}

// 날짜별 종가 찾기표 (getBtcDayKey: btc-chart.js)
function getBtcCloseByDay() {
  const map = new Map();
  btcDailyCandles.forEach(function (candle) {
    map.set(getBtcDayKey(candle.time), candle.close);
  });
  return map;
}

// 사이클마다: 반감기 날 종가 대비 몇 배인지
function calculateBtcCycles() {
  const closeByDay = getBtcCloseByDay();
  return BTC_CYCLES.map(function (cycle) {
    const start = parseBtcDate(cycle.date);
    const base = closeByDay.get(getBtcDayKey(start));
    const points = [];
    if (base) {
      for (let day = 0; day <= BTC_CYCLE_DAYS; day = day + BTC_CYCLE_STEP) {
        const time = new Date(start).setDate(new Date(start).getDate() + day);
        const close = closeByDay.get(getBtcDayKey(time));
        if (close) points.push({ day: day, ratio: close / base, time: time });
      }
    }
    return { cycle: cycle, points: points };
  }).filter(function (series) {
    return series.points.length > 1;
  });
}

// 달마다 마지막 종가 → [{ year, month(1~12), close }]
function getBtcMonthCloses() {
  const months = [];
  btcDailyCandles.forEach(function (candle) {
    const date = new Date(candle.time);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const last = months[months.length - 1];
    if (last && last.year === year && last.month === month) {
      last.close = candle.close;
    } else {
      months.push({ year: year, month: month, close: candle.close });
    }
  });
  return months;
}

// 두 색 사이 t(0~1) 지점의 색
function mixBtcColor(a, b, t) {
  const from = [1, 3, 5].map(function (i) {
    return parseInt(a.slice(i, i + 2), 16);
  });
  const to = [1, 3, 5].map(function (i) {
    return parseInt(b.slice(i, i + 2), 16);
  });
  return (
    "#" +
    from
      .map(function (value, i) {
        return Math.round(value + (to[i] - value) * t)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

// 등락률 → { background, dark(글자를 흰색으로 할지) }
function getBtcHeatColor(rate) {
  let level = BTC_HEAT_STEPS.findIndex(function (step) {
    return Math.abs(rate) < step;
  });
  if (level === -1) level = BTC_HEAT_STEPS.length;
  const t = (level + 1) / (BTC_HEAT_STEPS.length + 1); // 0.25, 0.5, 0.75, 1
  return { background: mixBtcColor(BTC_HEAT_NEUTRAL, rate >= 0 ? BTC_HEAT_UP : BTC_HEAT_DOWN, t), dark: t >= 0.75 };
}

// 등락률 짧게: +12, -3.4 (10 미만은 소수점 한 자리)
function formatBtcHeat(rate) {
  const abs = Math.abs(rate);
  const text = abs < 10 ? abs.toFixed(1) : String(Math.round(abs));
  if (Number(text) === 0) return "0";
  return (rate > 0 ? "+" : "-") + text;
}

// =============================================
// 4. 화면 그리기 — 반감기 사이클
// =============================================

function renderBtcCycleChart() {
  btcCycleSeries = calculateBtcCycles();
  btcCycleChart.innerHTML = "";
  if (btcCycleSeries.length === 0) return;

  const c = BTC_CYCLE_CHART;
  const plotWidth = c.width - c.left - c.right;
  const plotHeight = c.height - c.top - c.bottom;

  // 세로축(로그): 모든 사이클의 가장 작은 배수 ~ 가장 큰 배수
  let min = 1;
  let max = 1;
  btcCycleSeries.forEach(function (series) {
    series.points.forEach(function (point) {
      min = Math.min(min, point.ratio);
      max = Math.max(max, point.ratio);
    });
  });
  const yMin = Math.log10(min) - 0.08;
  const yMax = Math.log10(max) + 0.08;
  function x(day) {
    return c.left + (day / BTC_CYCLE_DAYS) * plotWidth;
  }
  function y(ratio) {
    return c.top + plotHeight - ((Math.log10(ratio) - yMin) / (yMax - yMin)) * plotHeight;
  }
  btcCycleScale = { x: x, y: y };

  // ① 가로 눈금 (×0.5, ×1, ×2, ×5, ×10 …) — ×1(반감기 날 가격)은 진하게
  getBtcTicks(Math.pow(10, yMin), Math.pow(10, yMax), true).forEach(function (value) {
    btcCycleChart.appendChild(
      createSvg("line", { x1: c.left, x2: c.width - c.right, y1: y(value), y2: y(value), class: value === 1 ? "btc-cycle-base" : "chart-grid" })
    );
    const label = createSvg("text", { x: c.left - 6, y: y(value) + 4, class: "chart-axis-label", "text-anchor": "end" });
    label.textContent = "×" + formatBtcDecimal(value, 1);
    btcCycleChart.appendChild(label);
  });

  // ② 아래 글자: 반감기 후 0 · 1년 · 2년 · 3년 · 4년
  for (let year = 0; year <= 4; year++) {
    const label = createSvg("text", { x: x(year * 365), y: c.height - 8, class: "chart-axis-label", "text-anchor": year === 0 ? "start" : year === 4 ? "end" : "middle" });
    label.textContent = year === 0 ? "반감기" : year + "년";
    btcCycleChart.appendChild(label);
  }

  // ③ 오늘 위치 (지금 사이클이 반감기 후 며칠째인지)
  btcCycleToday = Math.floor((Date.now() - parseBtcDate(BTC_CYCLES[0].date)) / BTC_DAY_MS); // btc.js
  if (btcCycleToday >= 0 && btcCycleToday <= BTC_CYCLE_DAYS) {
    btcCycleChart.appendChild(
      createSvg("line", { x1: x(btcCycleToday), x2: x(btcCycleToday), y1: c.top, y2: c.top + plotHeight, class: "btc-cycle-today" })
    );
    const label = createSvg("text", { x: x(btcCycleToday) + 3, y: c.top + 10, class: "chart-axis-label" });
    label.textContent = "오늘";
    btcCycleChart.appendChild(label);
  }

  // ④ 선: 옛 사이클부터 그려서 지금 사이클이 맨 위에 오게
  btcCycleSeries
    .slice()
    .reverse()
    .forEach(function (series) {
      const points = series.points
        .map(function (point) {
          return x(point.day).toFixed(1) + "," + y(point.ratio).toFixed(1);
        })
        .join(" ");
      btcCycleChart.appendChild(
        createSvg("polyline", { points: points, class: "btc-cycle-line" + (series.cycle.current ? " current" : ""), stroke: series.cycle.color })
      );
    });

  // ⑤ 고른 날 표시 (세로선 + 점들은 selectBtcCycleDay에서)
  btcCycleChart.appendChild(createSvg("line", { id: "btc-cycle-cross", y1: c.top, y2: c.top + plotHeight, class: "chart-crosshair" }));
  btcCycleChart.appendChild(createSvg("g", { id: "btc-cycle-dots" }));

  // 범례
  btcCycleLegend.innerHTML = "";
  btcCycleSeries.forEach(function (series) {
    const li = document.createElement("li");
    const key = document.createElement("span");
    key.className = "legend-line";
    key.style.background = series.cycle.color;
    li.append(key, series.cycle.name);
    btcCycleLegend.appendChild(li);
  });

  // 처음엔 지금 사이클의 마지막 날(가장 최근 기록)을 고름
  if (btcCycleSelectedDay === null) {
    const current = btcCycleSeries.find(function (series) {
      return series.cycle.current;
    });
    btcCycleSelectedDay = current ? current.points[current.points.length - 1].day : 0;
  }
  selectBtcCycleDay(btcCycleSelectedDay);
}

// 고른 날: 사이클마다 그날 몇 배였는지
function selectBtcCycleDay(day) {
  if (!btcCycleScale) return;
  const snapped = Math.round(day / BTC_CYCLE_STEP) * BTC_CYCLE_STEP;
  btcCycleSelectedDay = Math.min(Math.max(snapped, 0), BTC_CYCLE_DAYS);
  const cx = btcCycleScale.x(btcCycleSelectedDay);
  const cross = document.getElementById("btc-cycle-cross");
  cross.setAttribute("x1", cx);
  cross.setAttribute("x2", cx);
  const dots = document.getElementById("btc-cycle-dots");
  dots.innerHTML = "";

  btcCycleReadout.innerHTML = "";
  const title = document.createElement("span");
  title.className = "readout-title";
  title.textContent = "반감기 후 " + formatAmount(btcCycleSelectedDay) + "일째";
  btcCycleReadout.appendChild(title);

  btcCycleSeries.forEach(function (series) {
    // 그날 기록 (없으면 바로 옆 점까지 허용)
    const point = series.points.find(function (p) {
      return Math.abs(p.day - btcCycleSelectedDay) <= BTC_CYCLE_STEP;
    });
    if (!point) return;
    dots.appendChild(createSvg("circle", { cx: cx, cy: btcCycleScale.y(point.ratio), r: 4, fill: series.cycle.color, class: "chart-dot" }));
    const item = document.createElement("span");
    item.className = "readout-item";
    const key = document.createElement("span");
    key.className = "readout-key";
    key.style.background = series.cycle.color;
    const value = document.createElement("strong");
    value.textContent = "×" + formatBtcDecimal(point.ratio, point.ratio < 10 ? 2 : 1);
    const name = document.createElement("span");
    name.className = "readout-name";
    name.textContent = series.cycle.name;
    item.append(key, value, name);
    btcCycleReadout.appendChild(item);
  });
}

function selectBtcCycleAt(clientX) {
  if (!btcCycleScale) return;
  const rect = btcCycleChart.getBoundingClientRect();
  const svgX = ((clientX - rect.left) / rect.width) * BTC_CYCLE_CHART.width;
  const c = BTC_CYCLE_CHART;
  const day = ((svgX - c.left) / (c.width - c.left - c.right)) * BTC_CYCLE_DAYS;
  selectBtcCycleDay(day);
}

// =============================================
// 5. 화면 그리기 — 월별 등락률 표
// =============================================

function renderBtcHeatmap() {
  const months = getBtcMonthCloses();
  // rates[year][month] = 등락률(%)
  const rates = {};
  const yearly = {};
  for (let i = 1; i < months.length; i++) {
    const item = months[i];
    const rate = (item.close / months[i - 1].close - 1) * 100;
    (rates[item.year] = rates[item.year] || {})[item.month] = rate;
  }
  // 연간: 그해 마지막 종가 ÷ 전년도 마지막 종가
  const lastCloseOfYear = {};
  months.forEach(function (item) {
    lastCloseOfYear[item.year] = item.close;
  });
  Object.keys(lastCloseOfYear).forEach(function (year) {
    const before = lastCloseOfYear[Number(year) - 1];
    if (before) yearly[year] = (lastCloseOfYear[year] / before - 1) * 100;
  });

  const years = Object.keys(rates)
    .map(Number)
    .sort(function (a, b) {
      return b - a;
    });
  const now = new Date();

  btcHeatTable.innerHTML = "";
  // 제목 줄
  const head = document.createElement("tr");
  ["연도"].concat(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (m) {
      return m + "월";
    }),
    ["연간"]
  ).forEach(function (text) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = text;
    head.appendChild(th);
  });
  const thead = document.createElement("thead");
  thead.appendChild(head);
  btcHeatTable.appendChild(thead);

  // 칸 하나
  function createCell(rate, tip, ongoing) {
    const td = document.createElement("td");
    if (rate === undefined) {
      td.className = "btc-heat-empty";
      return td;
    }
    const color = getBtcHeatColor(rate);
    td.style.background = color.background;
    if (color.dark) td.style.color = "#ffffff";
    td.textContent = formatBtcHeat(rate);
    td.title = tip + ": " + formatPercent(rate) + (ongoing ? " (진행 중)" : "");
    if (ongoing) td.classList.add("btc-heat-ongoing");
    return td;
  }

  const tbody = document.createElement("tbody");
  years.forEach(function (year) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = year;
    tr.appendChild(th);
    for (let month = 1; month <= 12; month++) {
      const ongoing = year === now.getFullYear() && month === now.getMonth() + 1;
      tr.appendChild(createCell(rates[year][month], year + "년 " + month + "월", ongoing));
    }
    tr.appendChild(createCell(yearly[year], year + "년", year === now.getFullYear()));
    tbody.appendChild(tr);
  });

  // 아래 두 줄: 달마다 평균, 오른 해 비율 (지금 진행 중인 달은 빼고)
  const average = [];
  const upShare = [];
  for (let month = 1; month <= 12; month++) {
    const list = years
      .filter(function (year) {
        return !(year === now.getFullYear() && month === now.getMonth() + 1);
      })
      .map(function (year) {
        return rates[year][month];
      })
      .filter(function (rate) {
        return rate !== undefined;
      });
    const sum = list.reduce(function (total, rate) {
      return total + rate;
    }, 0);
    average.push(list.length > 0 ? sum / list.length : undefined);
    upShare.push(
      list.length > 0
        ? {
            up: list.filter(function (rate) {
              return rate > 0;
            }).length,
            total: list.length,
          }
        : null
    );
  }
  const avgRow = document.createElement("tr");
  avgRow.className = "btc-heat-foot";
  const avgTh = document.createElement("th");
  avgTh.scope = "row";
  avgTh.textContent = "평균";
  avgRow.appendChild(avgTh);
  average.forEach(function (rate, index) {
    avgRow.appendChild(createCell(rate, index + 1 + "월 평균", false));
  });
  avgRow.appendChild(document.createElement("td"));
  tbody.appendChild(avgRow);

  const upRow = document.createElement("tr");
  upRow.className = "btc-heat-foot";
  const upTh = document.createElement("th");
  upTh.scope = "row";
  upTh.textContent = "오른 해";
  upRow.appendChild(upTh);
  upShare.forEach(function (share) {
    const td = document.createElement("td");
    td.className = "btc-heat-share";
    td.textContent = share ? share.up + "/" + share.total : "";
    upRow.appendChild(td);
  });
  upRow.appendChild(document.createElement("td"));
  tbody.appendChild(upRow);
  btcHeatTable.appendChild(tbody);

  // 요약: 평균이 가장 좋았던 달과 나빴던 달
  let best = 0;
  let worst = 0;
  average.forEach(function (rate, index) {
    if (rate === undefined) return;
    if (average[best] === undefined || rate > average[best]) best = index;
    if (average[worst] === undefined || rate < average[worst]) worst = index;
  });
  btcHeatSummary.textContent = "";
  if (average[best] !== undefined) {
    btcHeatSummary.append("평균이 가장 좋았던 달은 ");
    const bestText = document.createElement("strong");
    bestText.className = "profit-up";
    bestText.textContent = best + 1 + "월(" + formatPercent(average[best]) + ")";
    btcHeatSummary.append(bestText, ", 가장 나빴던 달은 ");
    const worstText = document.createElement("strong");
    worstText.className = "profit-down";
    worstText.textContent = worst + 1 + "월(" + formatPercent(average[worst]) + ")";
    btcHeatSummary.append(worstText, "이에요.");
  }
}

function renderBtcCycleAll() {
  renderBtcCycleChart();
  renderBtcHeatmap();
}

// =============================================
// 6. 이벤트 처리
// =============================================

btcCycleChart.addEventListener("pointerdown", function (event) {
  selectBtcCycleAt(event.clientX);
});
btcCycleChart.addEventListener("pointermove", function (event) {
  if (event.pointerType === "mouse" || event.buttons > 0) selectBtcCycleAt(event.clientX);
});
btcCycleChart.addEventListener("keydown", function (event) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    selectBtcCycleDay(btcCycleSelectedDay + (event.key === "ArrowLeft" ? -1 : 1) * BTC_CYCLE_STEP * 5);
  }
});

// 일봉이 새로 합쳐지면 다시 계산 (고른 날도 새 마지막 날로)
document.addEventListener("btc-candles-updated", function () {
  btcCycleSelectedDay = null;
  renderBtcCycleAll();
});

// 시작 (btc-chart.js가 이미 과거 기록을 합쳐 둠)
renderBtcCycleAll();
