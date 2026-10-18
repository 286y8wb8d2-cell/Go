// =============================================
// 비트코인 탭 — ⑤ 정보: 기업 보유량 · 현물 ETF · M2와 비트코인 · 출금 수수료
// 브라우저에서 바로 받기 어려운 정보는 GitHub Actions가 6시간마다 모아 두는
// "예비 데이터"(data 가지의 btc-data.json, scripts/fetch-btc-data.mjs)를 읽음
// (기업 보유량·ETF는 예비 데이터가 없으면 원래 주소에서 직접 받음)
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 예비 데이터 주소 (저장소의 data 가지)
const BTC_DATA_URL = "https://raw.githubusercontent.com/286y8wb8d2-cell/Go/data/btc-data.json";
const BTC_DATA_EVERY_MS = 30 * 60 * 1000;

const BTC_TREASURY_URL = "https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin";
const BTC_TREASURY_SHOW = 10; // 처음에 보여 줄 회사 수

const BTC_ETF_DAYS_SHOWN = 60; // ETF 흐름 막대 개수
const BTC_ETF_CHART = { width: 340, height: 160, left: 40, right: 6, top: 10, bottom: 22 };

// M2 비교 차트
const BTC_M2_CHART = { width: 340, height: 220, left: 44, right: 10, top: 10, bottom: 24 };
const BTC_M2_COLORS = { btc: "#2a78d6", m2: "#eb6834" };
const BTC_M2_RANGES = { "5y": 5, "10y": 10, all: 100 };

// 거래소 이름
const BTC_EXCHANGE_NAMES = { upbit: "업비트", bithumb: "빗썸", korbit: "코빗", binance: "바이낸스" };

// 나라 이름 (기업 보유량)
const BTC_COUNTRY_NAMES = { US: "미국", JP: "일본", CA: "캐나다", GB: "영국", DE: "독일", CN: "중국", HK: "홍콩", KR: "한국", AU: "호주", FR: "프랑스", SE: "스웨덴", NO: "노르웨이", BR: "브라질", SG: "싱가포르", TH: "태국", CH: "스위스", NL: "네덜란드", ES: "스페인", IT: "이탈리아", BM: "버뮤다", KY: "케이맨" };

// =============================================
// 2. 상태 · 화면 요소
// =============================================

let btcData = null; // 예비 데이터 전체
let btcDataPromise = null;
let btcTreasuryAll = false; // "전체 보기" 눌렀는지
let btcM2Range = "10y";

const btcDataStatus = document.getElementById("btc-data-status");
const btcTreasurySummary = document.getElementById("btc-treasury-summary");
const btcTreasuryList = document.getElementById("btc-treasury-list");
const btcTreasuryMore = document.getElementById("btc-treasury-more");
const btcEtfSummary = document.getElementById("btc-etf-summary");
const btcEtfChart = document.getElementById("btc-etf-chart");
const btcEtfReadout = document.getElementById("btc-etf-readout");
const btcEtfList = document.getElementById("btc-etf-list");
const btcEtfSource = document.getElementById("btc-etf-source");
const btcM2Chart = document.getElementById("btc-m2-chart");
const btcM2Summary = document.getElementById("btc-m2-summary");
const btcM2Readout = document.getElementById("btc-m2-readout");
const btcM2Buttons = document.querySelectorAll("[data-btc-m2-range]");
const btcFeeTableBody = document.getElementById("btc-fee-table-body");
const btcFeeNote = document.getElementById("btc-fee-note");

// =============================================
// 3. 예비 데이터 받기
// =============================================

// 한 번 받으면 30분 동안 다시 씀 (다른 파일도 예비로 씀: 공포·탐욕 지수 등)
function getBtcData(force) {
  if (!force && btcDataPromise) return btcDataPromise;
  btcDataPromise = fetchCryptoJson(BTC_DATA_URL + "?t=" + Math.floor(Date.now() / BTC_DATA_EVERY_MS))
    .then(function (json) {
      btcData = json;
      return json;
    })
    .catch(function (error) {
      btcDataPromise = null; // 다음에 다시 시도
      throw error;
    });
  return btcDataPromise;
}

async function refreshBtcInfo() {
  try {
    await getBtcData(true);
  } catch (error) {
    btcDataStatus.textContent = getBtcClock() + " 예비 데이터를 받지 못했어요 (" + describeBtcError(error) + ").";
  }
  if (btcData) {
    const updated = new Date(btcData.updated);
    const month = updated.getMonth() + 1;
    const clock = String(updated.getHours()).padStart(2, "0") + ":" + String(updated.getMinutes()).padStart(2, "0");
    btcDataStatus.textContent = "예비 데이터: " + month + "월 " + updated.getDate() + "일 " + clock + " 기준 · 6시간마다 자동으로 모음";
  }
  await renderBtcTreasury();
  await renderBtcEtf();
  renderBtcM2();
  renderBtcWithdrawFees();
  return btcData !== null;
}

// =============================================
// 4. 기업 보유량
// =============================================

async function renderBtcTreasury() {
  let treasury = btcData && btcData.treasury;
  if (!treasury) {
    // 예비 데이터가 없으면 코인게코에서 직접
    try {
      const json = await fetchCryptoJson(BTC_TREASURY_URL);
      treasury = {
        totalHoldings: json.total_holdings,
        totalValueUsd: json.total_value_usd,
        companies: json.companies.map(function (c) {
          return { name: c.name, symbol: c.symbol, country: c.country, holdings: c.total_holdings, valueUsd: c.total_current_value_usd, share: c.percentage_of_total_supply };
        }),
      };
    } catch (error) {
      btcTreasurySummary.textContent = "기업 보유량을 받지 못했어요 (" + describeBtcError(error) + ").";
      return;
    }
  }
  const supplyShare = (treasury.totalHoldings / 21000000) * 100;
  btcTreasurySummary.textContent = "";
  const big = document.createElement("strong");
  big.textContent = formatBtcDecimal(treasury.totalHoldings, 0) + " BTC";
  btcTreasurySummary.append("상장 기업들이 가진 비트코인 ", big, " · 전체 2,100만 개의 " + supplyShare.toFixed(2) + "%");

  btcTreasuryList.innerHTML = "";
  const max = treasury.companies[0] ? treasury.companies[0].holdings : 1;
  treasury.companies.slice(0, btcTreasuryAll ? 50 : BTC_TREASURY_SHOW).forEach(function (company, index) {
    const li = document.createElement("li");
    li.className = "dash-top-item";
    const rank = document.createElement("span");
    rank.className = "dash-top-rank";
    rank.textContent = index + 1;
    const name = document.createElement("span");
    name.className = "dash-top-name";
    name.textContent = company.name;
    const group = document.createElement("span");
    group.className = "dash-top-group";
    group.textContent = BTC_COUNTRY_NAMES[company.country] || company.country;
    name.appendChild(group);
    const value = document.createElement("span");
    value.className = "dash-top-value";
    value.textContent = formatBtcDecimal(company.holdings, 0) + " BTC";
    const track = document.createElement("span");
    track.className = "category-track dash-top-track";
    const fill = document.createElement("span");
    fill.className = "category-fill dash-top-fill";
    fill.style.width = Math.max(1, (company.holdings / max) * 100) + "%";
    track.appendChild(fill);
    const share = document.createElement("span");
    share.className = "dash-top-share";
    share.textContent = company.valueUsd ? "$" + formatBtcDecimal(company.valueUsd / 1e9, 1) + "B" : "";
    li.append(rank, name, value, track, share);
    btcTreasuryList.appendChild(li);
  });
  btcTreasuryMore.hidden = treasury.companies.length <= BTC_TREASURY_SHOW;
  btcTreasuryMore.textContent = btcTreasuryAll ? "접기" : "전체 보기 (" + Math.min(treasury.companies.length, 50) + "개)";
}

// =============================================
// 5. 현물 ETF
// =============================================

async function renderBtcEtf() {
  const etf = btcData && btcData.etf;
  btcEtfChart.innerHTML = "";
  if (!etf || !etf.days || etf.days.length === 0) {
    btcEtfSummary.textContent = "ETF 정보를 받지 못했어요. 잠시 뒤 다시 시도해요.";
    return;
  }
  const days = etf.days.slice(-BTC_ETF_DAYS_SHOWN);
  const last = etf.days[etf.days.length - 1];
  const week = etf.days.slice(-5).reduce(function (sum, day) {
    return sum + day.flowUsd;
  }, 0);

  btcEtfSummary.innerHTML = "";
  [
    ["최근 하루 순유입", formatBtcUsd(last.flowUsd), last.date.slice(5).replace("-", "/") + " 기준", getProfitClass(last.flowUsd)],
    ["최근 5거래일", formatBtcUsd(week), "순유입 합계", getProfitClass(week)],
    ["ETF가 가진 비트코인", formatBtcDecimal(last.holdings, 0) + " BTC", ((last.holdings / 21000000) * 100).toFixed(2) + "% (2,100만 개 중)", ""],
    ["추적 중인 ETF", last.funds + "개", "미국 현물 ETF", ""],
  ].forEach(function (item) {
    const card = document.createElement("div");
    card.className = "summary-card";
    const name = document.createElement("p");
    name.textContent = item[0];
    const value = document.createElement("p");
    value.textContent = item[1];
    if (item[3]) value.className = item[3];
    const sub = document.createElement("p");
    sub.className = "btc-card-sub";
    sub.textContent = item[2];
    card.append(name, value, sub);
    btcEtfSummary.appendChild(card);
  });

  // 하루 순유입 막대 (들어오면 빨강 위로, 나가면 파랑 아래로)
  const c = BTC_ETF_CHART;
  const plotWidth = c.width - c.left - c.right;
  const plotHeight = c.height - c.top - c.bottom;
  let maxAbs = 1;
  days.forEach(function (day) {
    maxAbs = Math.max(maxAbs, Math.abs(day.flowUsd));
  });
  const yMax = niceMax(maxAbs / 1e6) * 1e6; // history.js
  function y(value) {
    return c.top + plotHeight / 2 - (value / yMax) * (plotHeight / 2);
  }
  const slot = plotWidth / days.length;
  [-yMax, 0, yMax].forEach(function (value) {
    btcEtfChart.appendChild(createSvg("line", { x1: c.left, x2: c.width - c.right, y1: y(value), y2: y(value), class: value === 0 ? "btc-cycle-base" : "chart-grid" }));
    const label = createSvg("text", { x: c.left - 6, y: y(value) + 4, class: "chart-axis-label", "text-anchor": "end" });
    label.textContent = value === 0 ? "0" : (value > 0 ? "+" : "-") + formatBtcDecimal(Math.abs(value) / 1e6, 0) + "M";
    btcEtfChart.appendChild(label);
  });
  [0, days.length - 1].forEach(function (index, order) {
    const label = createSvg("text", { x: c.left + slot * (index + 0.5), y: c.height - 6, class: "chart-axis-label", "text-anchor": order === 0 ? "start" : "end" });
    label.textContent = days[index].date.slice(5).replace("-", "/");
    btcEtfChart.appendChild(label);
  });
  days.forEach(function (day, index) {
    const top = Math.min(y(day.flowUsd), y(0));
    const height = Math.max(1, Math.abs(y(day.flowUsd) - y(0)));
    const bar = createSvg("rect", {
      x: c.left + slot * index + Math.min(1, slot * 0.15),
      y: top,
      width: Math.max(1, slot - Math.min(2, slot * 0.3)),
      height: height,
      rx: 1,
      class: day.flowUsd >= 0 ? "btc-body btc-up" : "btc-body btc-down",
      "data-index": index,
    });
    btcEtfChart.appendChild(bar);
  });
  btcEtfChart.dataset.days = JSON.stringify(days.map(function (day) {
    return [day.date, day.flowUsd];
  }));
  selectBtcEtfDay(days.length - 1);

  // 회사별 목록 (가진 비트코인이 많은 순)
  btcEtfList.innerHTML = "";
  const totalHoldings = etf.funds.reduce(function (sum, fund) {
    return sum + (fund.holdings || 0);
  }, 0);
  etf.funds.forEach(function (fund) {
    const tr = document.createElement("tr");
    [
      fund.ticker,
      fund.issuer,
      fund.holdings !== null ? formatBtcDecimal(fund.holdings, 0) : "-",
      fund.holdings !== null && totalHoldings > 0 ? ((fund.holdings / totalHoldings) * 100).toFixed(1) + "%" : "-",
      fund.flowUsd !== null ? formatBtcUsd(fund.flowUsd) : "-",
    ].forEach(function (text, index) {
      const td = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) td.scope = "row";
      td.textContent = text;
      if (index === 4 && fund.flowUsd) td.className = getProfitClass(fund.flowUsd);
      tr.appendChild(td);
    });
    btcEtfList.appendChild(tr);
  });
  btcEtfSource.href = etf.attribution || "https://xoomar.com/markets/api";
}

// 막대 하나 고르기 → 아래에 그날 순유입
function selectBtcEtfDay(index) {
  let days = [];
  try {
    days = JSON.parse(btcEtfChart.dataset.days || "[]");
  } catch (error) {
    return;
  }
  const day = days[index];
  if (!day) return;
  btcEtfChart.querySelectorAll("rect").forEach(function (rect) {
    rect.classList.toggle("btc-bar-dim", Number(rect.dataset.index) !== index);
  });
  btcEtfReadout.innerHTML = "";
  const title = document.createElement("span");
  title.className = "readout-title";
  title.textContent = day[0].replace(/-/g, ".") + " 순유입";
  const value = document.createElement("strong");
  value.className = getProfitClass(day[1]);
  value.textContent = formatBtcUsd(day[1]);
  btcEtfReadout.append(title, value);
}

// 달러 금액: +$123.4M / -$1.2B
function formatBtcUsd(value) {
  const abs = Math.abs(value);
  if (abs < 50000) return "$0";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  if (abs >= 1e9) return sign + "$" + formatBtcDecimal(abs / 1e9, 2) + "B";
  return sign + "$" + formatBtcDecimal(abs / 1e6, 1) + "M";
}

// =============================================
// 6. M2와 비트코인 (같은 출발점 100으로 맞춘 비교)
// =============================================

function renderBtcM2() {
  btcM2Buttons.forEach(function (button) {
    button.setAttribute("aria-pressed", button.dataset.btcM2Range === btcM2Range ? "true" : "false");
  });
  btcM2Chart.innerHTML = "";
  const m2 = btcData && btcData.m2;
  const btc = btcData && btcData.btcUsdMonthly;
  if (!m2 || !btc) {
    btcM2Summary.textContent = "M2 정보를 받지 못했어요. 잠시 뒤 다시 시도해요.";
    return;
  }
  // 두 자료가 모두 있는 달만, 고른 기간만큼
  const btcByMonth = new Map(
    btc.map(function (row) {
      return [row.month, row.value];
    })
  );
  const startYear = new Date().getFullYear() - BTC_M2_RANGES[btcM2Range];
  const rows = m2
    .filter(function (row) {
      return btcByMonth.has(row.month) && Number(row.month.slice(0, 4)) >= startYear;
    })
    .map(function (row) {
      return { month: row.month, m2: row.value, btc: btcByMonth.get(row.month) };
    });
  if (rows.length < 2) return;
  const base = rows[0];
  rows.forEach(function (row) {
    row.m2Index = (row.m2 / base.m2) * 100;
    row.btcIndex = (row.btc / base.btc) * 100;
  });

  const c = BTC_M2_CHART;
  const plotWidth = c.width - c.left - c.right;
  const plotHeight = c.height - c.top - c.bottom;
  let min = 100;
  let max = 100;
  rows.forEach(function (row) {
    min = Math.min(min, row.m2Index, row.btcIndex);
    max = Math.max(max, row.m2Index, row.btcIndex);
  });
  const yMin = Math.log10(min) - 0.05;
  const yMax = Math.log10(max) + 0.05;
  function x(index) {
    return c.left + (index / (rows.length - 1)) * plotWidth;
  }
  function y(value) {
    return c.top + plotHeight - ((Math.log10(value) - yMin) / (yMax - yMin)) * plotHeight;
  }
  getBtcTicks(Math.pow(10, yMin), Math.pow(10, yMax), true).forEach(function (value) {
    btcM2Chart.appendChild(createSvg("line", { x1: c.left, x2: c.width - c.right, y1: y(value), y2: y(value), class: value === 100 ? "btc-cycle-base" : "chart-grid" }));
    const label = createSvg("text", { x: c.left - 6, y: y(value) + 4, class: "chart-axis-label", "text-anchor": "end" });
    label.textContent = formatBtcDecimal(value, 0);
    btcM2Chart.appendChild(label);
  });
  [0, rows.length - 1].forEach(function (index, order) {
    const label = createSvg("text", { x: x(index), y: c.height - 8, class: "chart-axis-label", "text-anchor": order === 0 ? "start" : "end" });
    label.textContent = rows[index].month.replace("-", ".");
    btcM2Chart.appendChild(label);
  });
  ["m2", "btc"].forEach(function (key) {
    const points = rows
      .map(function (row, index) {
        return x(index).toFixed(1) + "," + y(row[key + "Index"]).toFixed(1);
      })
      .join(" ");
    btcM2Chart.appendChild(createSvg("polyline", { points: points, class: "chart-line", stroke: BTC_M2_COLORS[key] }));
  });
  btcM2Chart.appendChild(createSvg("line", { id: "btc-m2-cross", y1: c.top, y2: c.top + plotHeight, class: "chart-crosshair" }));
  btcM2Chart.appendChild(createSvg("g", { id: "btc-m2-dots" }));
  btcM2Chart.rows = rows;
  btcM2Chart.scale = { x: x, y: y };

  const last = rows[rows.length - 1];
  btcM2Summary.textContent =
    formatBtcMonth(base.month) + "부터 미국 통화량(M2)은 ×" + formatBtcDecimal(last.m2Index / 100, 2) +
    ", 비트코인(달러)은 ×" + formatBtcDecimal(last.btcIndex / 100, last.btcIndex >= 1000 ? 0 : 1) + "가 됐어요.";
  selectBtcM2Index(rows.length - 1);
}

function selectBtcM2Index(index) {
  const rows = btcM2Chart.rows;
  const scale = btcM2Chart.scale;
  if (!rows || !rows[index]) return;
  const row = rows[index];
  const cx = scale.x(index);
  const cross = document.getElementById("btc-m2-cross");
  cross.setAttribute("x1", cx);
  cross.setAttribute("x2", cx);
  const dots = document.getElementById("btc-m2-dots");
  dots.innerHTML = "";
  btcM2Readout.innerHTML = "";
  const title = document.createElement("span");
  title.className = "readout-title";
  title.textContent = formatBtcMonth(row.month);
  btcM2Readout.appendChild(title);
  [
    ["btc", "비트코인", "$" + formatBtcDecimal(row.btc, 0)],
    ["m2", "미국 M2", "$" + formatBtcDecimal(row.m2 / 1000, 1) + "조"],
  ].forEach(function (item) {
    dots.appendChild(createSvg("circle", { cx: cx, cy: scale.y(row[item[0] + "Index"]), r: 4, fill: BTC_M2_COLORS[item[0]], class: "chart-dot" }));
    const span = document.createElement("span");
    span.className = "readout-item";
    const key = document.createElement("span");
    key.className = "readout-key";
    key.style.background = BTC_M2_COLORS[item[0]];
    const value = document.createElement("strong");
    value.textContent = item[2];
    const name = document.createElement("span");
    name.className = "readout-name";
    name.textContent = item[1] + " (" + formatBtcDecimal(row[item[0] + "Index"], 0) + ")";
    span.append(key, value, name);
    btcM2Readout.appendChild(span);
  });
}

// "2016-01" → "2016년 1월"
function formatBtcMonth(month) {
  return month.slice(0, 4) + "년 " + Number(month.slice(5, 7)) + "월";
}

// =============================================
// 7. 출금 수수료
// =============================================

function renderBtcWithdrawFees() {
  btcFeeTableBody.innerHTML = "";
  const fees = btcData && btcData.withdraw;
  if (!fees) {
    btcFeeNote.textContent = "출금 수수료를 받지 못했어요. 잠시 뒤 다시 시도해요.";
    return;
  }
  const price = btcDomesticPrice; // btc-live.js
  Object.keys(BTC_EXCHANGE_NAMES)
    .filter(function (key) {
      return fees[key];
    })
    .sort(function (a, b) {
      return fees[a].onchain - fees[b].onchain;
    })
    .forEach(function (key) {
      const fee = fees[key];
      const tr = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = BTC_EXCHANGE_NAMES[key];
      const onchain = document.createElement("td");
      onchain.textContent = formatBtcDecimal(fee.onchain, 8) + " BTC";
      const won = document.createElement("td");
      won.textContent = price ? "약 " + formatMoney(fee.onchain * price) : "-";
      const lightning = document.createElement("td");
      lightning.textContent = fee.lightning !== null ? formatBtcDecimal(fee.lightning, 8) + " BTC" : "없음";
      tr.append(name, onchain, won, lightning);
      btcFeeTableBody.appendChild(tr);
    });
  btcFeeNote.textContent =
    "개인 지갑으로 옮길 때 드는 비용이에요. 원화는 지금 시세로 어림한 값이고, 실제 수수료는 거래소 공지를 확인하세요. 라이트닝은 거래소가 지원할 때만 표시돼요.";
}

// =============================================
// 8. 이벤트 처리 · 시작
// =============================================

btcTreasuryMore.addEventListener("click", function () {
  btcTreasuryAll = !btcTreasuryAll;
  renderBtcTreasury();
});

function pickBtcIndex(chart, clientX, count, left, width) {
  const rect = chart.getBoundingClientRect();
  const svgX = ((clientX - rect.left) / rect.width) * width;
  return Math.min(Math.max(Math.round(((svgX - left) / (width - left - 10)) * (count - 1)), 0), count - 1);
}

btcEtfChart.addEventListener("pointerdown", function (event) {
  const target = event.target.closest("rect");
  if (target) selectBtcEtfDay(Number(target.dataset.index));
});

["pointerdown", "pointermove"].forEach(function (type) {
  btcM2Chart.addEventListener(type, function (event) {
    if (type === "pointermove" && event.pointerType !== "mouse" && event.buttons === 0) return;
    const rows = btcM2Chart.rows;
    if (!rows) return;
    selectBtcM2Index(pickBtcIndex(btcM2Chart, event.clientX, rows.length, BTC_M2_CHART.left, BTC_M2_CHART.width));
  });
});

btcM2Buttons.forEach(function (button) {
  button.addEventListener("click", function () {
    btcM2Range = button.dataset.btcM2Range;
    renderBtcM2();
  });
});

// 시세가 바뀌면 출금 수수료 원화 다시 (너무 자주는 아니게: 표만 다시 그림)
let btcFeeRenderTime = 0;
document.addEventListener("btc-price-updated", function () {
  if (Date.now() - btcFeeRenderTime < 10000) return;
  btcFeeRenderTime = Date.now();
  if (btcData) renderBtcWithdrawFees();
});

addBtcTask(refreshBtcInfo, BTC_DATA_EVERY_MS);
