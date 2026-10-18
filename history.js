// =============================================
// 자산 추이 — 금융자산 탭, 전체 자산 아래
// 매달 총 자산을 자동으로 기록하고, 표(와 그래프)로 보여 줌
// 전체 자산(networth.js)의 계산을 쓰므로 그 뒤에 불러옴
// ※ 이름은 모두 history~ / HISTORY~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

const HISTORY_STORAGE_KEY = "household-history";

// 그래프에 그릴 선 3개: 기록의 항목 이름, 화면 이름, CSS class (색은 style.css)
const HISTORY_SERIES = [
  { key: "total", name: "총 자산", className: "series-1" },
  { key: "assets", name: "금융자산", className: "series-2" },
  { key: "crypto", name: "가상자산", className: "series-3" },
];

// 그래프 크기 (SVG 안의 좌표 단위. 실제 화면에서는 폭에 맞춰 늘어나거나 줄어듦)
const HISTORY_CHART = { width: 340, height: 200, left: 46, right: 12, top: 12, bottom: 26 };

// SVG 요소를 만들 때 필요한 이름 공간 (SVG는 HTML과 만드는 방법이 조금 다름)
const SVG_NS = "http://www.w3.org/2000/svg";

// =============================================
// 2. 저장/불러오기
// =============================================

// 달마다 한 줄: [{ month: "2026-10", total: 25000000, assets: 20050000, crypto: 4950000, updated: "2026-10-18" }]
let historyRecords = loadList(HISTORY_STORAGE_KEY);

function saveHistory() {
  // 달 순서(오래된 → 최근)로 정렬해서 저장
  historyRecords.sort(function (a, b) {
    return a.month < b.month ? -1 : a.month > b.month ? 1 : 0;
  });
  saveList(HISTORY_STORAGE_KEY, historyRecords);
}

// =============================================
// 화면 요소 찾기
// =============================================

const historyTableBody = document.getElementById("history-table-body");
const historyTableBox = document.getElementById("history-table-box");
const historyEmptyMessage = document.getElementById("history-empty-message");
const historySummaryText = document.getElementById("history-summary");
const historyChartBox = document.getElementById("history-chart-box");
const historyChart = document.getElementById("history-chart");
const historyReadout = document.getElementById("history-readout");

// 그래프에서 지금 고른 기록의 순번 (null이면 가장 최근 달)
let historySelectedIndex = null;

// =============================================
// 3. 기록하기
// =============================================

// 이번 달 기록을 지금 자산 값으로 만들거나 고침
// (그래서 따로 누르지 않아도 그달의 마지막 값이 남음)
function recordThisMonth() {
  const networth = calculateNetworth(); // networth.js
  const month = getToday().slice(0, 7); // "2026-10"
  const existing = historyRecords.find(function (record) {
    return record.month === month;
  });

  // 자산이 하나도 없고 이번 달 기록도 없으면 0원 기록은 만들지 않음
  if (!existing && networth.value <= 0) {
    return;
  }

  const record = {
    month: month,
    total: Math.round(networth.value),
    assets: Math.round(networth.assetsValue),
    crypto: Math.round(networth.cryptoValue),
    updated: getToday(),
  };

  // 값이 그대로면 저장하지 않음 (쓸데없는 저장 신호를 줄임)
  if (existing && existing.total === record.total && existing.assets === record.assets && existing.crypto === record.crypto) {
    return;
  }

  if (existing) {
    Object.assign(existing, record);
  } else {
    historyRecords.push(record);
  }
  saveHistory();
}

// =============================================
// 4. 화면 그리기
// =============================================

// "2026-10" → "2026년 10월"
function formatHistoryMonth(month) {
  return month.slice(0, 4) + "년 " + Number(month.slice(5, 7)) + "월";
}

// 기록 표를 그림 (최근 달이 위로)
function renderHistoryTable() {
  historyTableBody.innerHTML = "";
  const hasRecords = historyRecords.length > 0;
  historyEmptyMessage.hidden = hasRecords;
  historyTableBox.hidden = !hasRecords;
  historySummaryText.hidden = historyRecords.length < 2;

  // 처음 기록과 비교한 변화 (기록이 2개 이상일 때)
  if (historyRecords.length >= 2) {
    const first = historyRecords[0];
    const last = historyRecords[historyRecords.length - 1];
    const diff = last.total - first.total;
    historySummaryText.textContent =
      formatHistoryMonth(first.month) + "부터 " + formatSignedMoney(diff) +
      (first.total > 0 ? " (" + formatPercent((diff / first.total) * 100) + ")" : "");
    historySummaryText.className = "summary-sub " + getProfitClass(diff);
  }

  // 최근 달부터
  for (let i = historyRecords.length - 1; i >= 0; i--) {
    const record = historyRecords[i];
    const prev = i > 0 ? historyRecords[i - 1] : null;

    const row = document.createElement("tr");

    const monthCell = document.createElement("td");
    monthCell.textContent = formatHistoryMonth(record.month);

    const totalCell = document.createElement("td");
    totalCell.textContent = formatAmount(record.total);

    // 바로 전 기록과 비교 (중간 달 기록을 지웠으면 그 전 기록과 비교)
    const diffCell = document.createElement("td");
    if (prev) {
      const diff = record.total - prev.total;
      diffCell.textContent = (diff > 0 ? "+" : "") + formatAmount(diff);
      diffCell.className = getProfitClass(diff);
    } else {
      diffCell.textContent = "-";
    }

    const actionCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn history-delete-btn";
    deleteBtn.textContent = "삭제";
    deleteBtn.setAttribute("aria-label", formatHistoryMonth(record.month) + " 기록 삭제");
    deleteBtn.addEventListener("click", function () {
      const isThisMonth = record.month === getToday().slice(0, 7);
      const message =
        formatHistoryMonth(record.month) + " 기록을 삭제할까요?" +
        (isThisMonth ? "\n(이번 달 기록은 자산이 바뀌면 다시 만들어져요.)" : "");
      if (confirm(message)) {
        historyRecords = historyRecords.filter(function (item) {
          return item.month !== record.month;
        });
        saveHistory();
        renderHistory();
      }
    });
    actionCell.appendChild(deleteBtn);

    row.append(monthCell, totalCell, diffCell, actionCell);
    historyTableBody.appendChild(row);
  }
}

// 그래프 눈금에 쓸 "깔끔한" 최댓값 (예: 23,456,000 → 25,000,000)
function niceMax(value) {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    if (value <= step * power) {
      return step * power;
    }
  }
  return 10 * power;
}

// 눈금 글자: 짧게 (예: 25,000,000 → "2,500만", 150,000,000 → "1.5억")
function formatAxisValue(value) {
  if (value >= 100000000) return (value / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "억";
  if (value >= 10000) return Math.round(value / 10000).toLocaleString("ko-KR") + "만";
  return formatAmount(value);
}

// SVG 요소 하나를 만들어 속성을 붙여 돌려줌
function createSvg(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.keys(attributes).forEach(function (name) {
    element.setAttribute(name, attributes[name]);
  });
  return element;
}

// 선 그래프를 그림
function renderHistoryChart() {
  historyChart.innerHTML = "";
  const records = historyRecords;
  historyChartBox.hidden = records.length === 0;
  if (records.length === 0) {
    return;
  }
  if (historySelectedIndex === null || historySelectedIndex >= records.length) {
    historySelectedIndex = records.length - 1;
  }

  const c = HISTORY_CHART;
  const plotWidth = c.width - c.left - c.right;
  const plotHeight = c.height - c.top - c.bottom;

  // 세로축: 0부터 가장 큰 값(깔끔하게 올림)까지
  let maxValue = 0;
  records.forEach(function (record) {
    maxValue = Math.max(maxValue, record.total, record.assets, record.crypto);
  });
  const yMax = niceMax(maxValue);

  // 기록 순번 → 가로 위치, 금액 → 세로 위치
  function x(index) {
    return records.length === 1 ? c.left + plotWidth / 2 : c.left + (index / (records.length - 1)) * plotWidth;
  }
  function y(value) {
    return c.top + plotHeight - (value / yMax) * plotHeight;
  }

  // ① 가로 눈금선 4칸 + 왼쪽 금액 글자
  for (let i = 0; i <= 4; i++) {
    const value = (yMax / 4) * i;
    historyChart.appendChild(createSvg("line", { x1: c.left, x2: c.width - c.right, y1: y(value), y2: y(value), class: "chart-grid" }));
    const label = createSvg("text", { x: c.left - 6, y: y(value) + 4, class: "chart-axis-label", "text-anchor": "end" });
    label.textContent = formatAxisValue(value);
    historyChart.appendChild(label);
  }

  // ② 아래 달 글자: 너무 많으면 몇 개씩 건너뜀 (최대 6개 정도)
  const labelEvery = Math.ceil(records.length / 6);
  records.forEach(function (record, index) {
    const isLast = index === records.length - 1;
    if (index % labelEvery !== 0 && !isLast) return;
    // 마지막 달 글자와 너무 가까우면 건너뜀 (글자가 겹치지 않게)
    if (!isLast && labelEvery > 1 && records.length - 1 - index < labelEvery) return;
    const month = Number(record.month.slice(5, 7));
    // 1월이거나 첫 기록이면 연도도 함께 (예: "26.1월")
    const text = index === 0 || month === 1 ? record.month.slice(2, 4) + "." + month + "월" : month + "월";
    const label = createSvg("text", { x: x(index), y: c.height - 8, class: "chart-axis-label", "text-anchor": "middle" });
    label.textContent = text;
    historyChart.appendChild(label);
  });

  // ③ 선 3개 (기록이 1개면 선 없이 점만)
  HISTORY_SERIES.forEach(function (series) {
    if (records.length > 1) {
      const points = records
        .map(function (record, index) {
          return x(index) + "," + y(record[series.key]);
        })
        .join(" ");
      historyChart.appendChild(createSvg("polyline", { points: points, class: "chart-line " + series.className }));
    }
    // 마지막 달에는 점 (끝점 표시)
    const last = records[records.length - 1];
    historyChart.appendChild(
      createSvg("circle", { cx: x(records.length - 1), cy: y(last[series.key]), r: 4, class: "chart-dot " + series.className })
    );
  });

  // ④ 고른 달: 세로 안내선 + 각 선 위의 점
  const selected = records[historySelectedIndex];
  historyChart.appendChild(
    createSvg("line", { x1: x(historySelectedIndex), x2: x(historySelectedIndex), y1: c.top, y2: c.top + plotHeight, class: "chart-crosshair" })
  );
  HISTORY_SERIES.forEach(function (series) {
    historyChart.appendChild(
      createSvg("circle", { cx: x(historySelectedIndex), cy: y(selected[series.key]), r: 4, class: "chart-dot " + series.className })
    );
  });

  // ⑤ 아래 읽기 칸: 고른 달의 세 값 (값이 먼저, 이름은 작게)
  historyReadout.innerHTML = "";
  const title = document.createElement("span");
  title.className = "readout-title";
  title.textContent = formatHistoryMonth(selected.month);
  historyReadout.appendChild(title);
  HISTORY_SERIES.forEach(function (series) {
    const item = document.createElement("span");
    item.className = "readout-item";
    const key = document.createElement("span");
    key.className = "readout-key " + series.className;
    const value = document.createElement("strong");
    value.textContent = formatKoreanUnit(selected[series.key]);
    const name = document.createElement("span");
    name.className = "readout-name";
    name.textContent = series.name;
    item.append(key, value, name);
    historyReadout.appendChild(item);
  });
}

// 손가락·마우스 위치에서 가장 가까운 달을 골라 그래프를 다시 그림
function selectHistoryAt(clientX) {
  if (historyRecords.length === 0) return;
  const rect = historyChart.getBoundingClientRect();
  // 화면 좌표 → SVG 좌표 (그래프가 화면 폭에 맞춰 늘어나 있으므로 비율로 바꿈)
  const svgX = ((clientX - rect.left) / rect.width) * HISTORY_CHART.width;
  const c = HISTORY_CHART;
  const ratio = (svgX - c.left) / (c.width - c.left - c.right);
  const index = Math.round(ratio * (historyRecords.length - 1));
  const clamped = Math.min(Math.max(index, 0), historyRecords.length - 1);
  if (clamped !== historySelectedIndex) {
    historySelectedIndex = clamped;
    renderHistoryChart();
  }
}

// 자산 추이 전체를 다시 그림
function renderHistory() {
  renderHistoryTable();
  renderHistoryChart();
}

// 그래프를 누르거나 끌면 가장 가까운 달을 보여 줌
historyChart.addEventListener("pointerdown", function (event) {
  selectHistoryAt(event.clientX);
});
historyChart.addEventListener("pointermove", function (event) {
  // 마우스는 올리기만 해도, 손가락은 누른 채로 움직일 때
  if (event.pointerType === "mouse" || event.buttons > 0) {
    selectHistoryAt(event.clientX);
  }
});

// 키보드 ← → 로도 달을 옮길 수 있게
historyChart.addEventListener("keydown", function (event) {
  if (historyRecords.length === 0) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    historySelectedIndex = Math.min(Math.max(historySelectedIndex + step, 0), historyRecords.length - 1);
    renderHistoryChart();
  }
});

// =============================================
// 5. 이벤트 처리
// =============================================

// 금융자산이나 가상자산이 저장되면 이번 달 기록을 갱신
document.addEventListener("data-saved", function (event) {
  if (event.detail.key === ASSET_STORAGE_KEY || event.detail.key === CRYPTO_STORAGE_KEY) {
    recordThisMonth();
    renderHistory();
  }
});

// =============================================
// 시작: 열 때마다 이번 달 기록을 확인 (새 달이 되면 새 줄이 생김)
// =============================================

recordThisMonth();
renderHistory();
