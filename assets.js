// =============================================
// 금융자산 탭
// (공통 도구 loadList, saveList, formatMoney, formatNumber는 common.js에 있음)
// ※ 다른 파일과 이름이 겹치지 않게 모두 asset~ / ASSET~ 으로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// localStorage에 저장할 때 쓰는 이름
const ASSET_STORAGE_KEY = "household-assets";

// 종류: 저장용 이름(영어) → 화면에 보일 이름(한글)
const ASSET_KINDS = {
  "kr-stock": "국내주식",
  "us-stock": "해외주식",
  etf: "ETF",
  bond: "채권",
  deposit: "예적금",
  cash: "현금",
  etc: "기타",
};

// 배당소득세율 (국내 기준 15.4% = 소득세 14% + 지방소득세 1.4%). 세후 금액 "추정"에만 사용
const ASSET_DIVIDEND_TAX_RATE = 0.154;

// 배당 지급월 빠른 선택 버튼
const ASSET_PAY_PRESETS = [
  { name: "월배당", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: "분기", months: [3, 6, 9, 12] },
  { name: "반기", months: [6, 12] },
  { name: "연 1회", months: [12] },
];

// 입력할 수 있는 가장 큰 값 (실수로 0을 너무 많이 넣는 것 방지)
const ASSET_MAX_VALUE = 1000000000000; // 1조

// =============================================
// 2. 저장/불러오기
// =============================================

// 모든 종목을 담아 두는 배열
let assets = loadList(ASSET_STORAGE_KEY);

function saveAssets() {
  saveList(ASSET_STORAGE_KEY, assets);
}

// 지금 수정 중인 종목의 id (수정 중이 아니면 null)
let assetEditingId = null;

// =============================================
// 화면 요소 찾기
// =============================================

const assetForm = document.getElementById("asset-form");
const assetNameInput = document.getElementById("asset-name");
const assetTickerInput = document.getElementById("asset-ticker");
const assetTickerInfo = document.getElementById("asset-ticker-info");
const assetTickerFillBtn = document.getElementById("asset-ticker-fill");
const assetKindSelect = document.getElementById("asset-kind");
const assetQuantityInput = document.getElementById("asset-quantity");
const assetAvgPriceInput = document.getElementById("asset-avg-price");
const assetCurrentPriceInput = document.getElementById("asset-current-price");
const assetDividendInput = document.getElementById("asset-dividend");
const assetMemoInput = document.getElementById("asset-memo");
const assetPayMonthBox = document.getElementById("asset-paymonth-box");
const assetPayPresetBox = document.getElementById("asset-pay-presets");
const assetPayMonthGrid = document.getElementById("asset-paymonth-grid");

// 1~12월 체크박스를 담아 둠 (buildPayMonthControls에서 만듦): [1월 체크박스, ..., 12월 체크박스]
const assetPayMonthChecks = [];
const assetSubmitBtn = document.getElementById("asset-submit-btn");
const assetCancelBtn = document.getElementById("asset-cancel-btn");
const assetList = document.getElementById("asset-list");
const assetEmptyMessage = document.getElementById("asset-empty-message");
const assetTotalValueText = document.getElementById("asset-total-value");
const assetTotalProfitText = document.getElementById("asset-total-profit");
const assetTotalRateText = document.getElementById("asset-total-rate");
const assetTotalCostText = document.getElementById("asset-total-cost");
const assetAllocBar = document.getElementById("asset-alloc-bar");
const assetAllocLegend = document.getElementById("asset-alloc-legend");
const assetDivAnnualText = document.getElementById("asset-div-annual");
const assetDivMonthlyText = document.getElementById("asset-div-monthly");
const assetDivYieldText = document.getElementById("asset-div-yield");
const assetDivAfterTaxText = document.getElementById("asset-div-after-tax");
const assetDivList = document.getElementById("asset-div-list");
const assetDivEmptyMessage = document.getElementById("asset-div-empty-message");
const assetDivChartBox = document.getElementById("asset-div-chart-box");
const assetDivChart = document.getElementById("asset-div-chart");
const assetDivChartNote = document.getElementById("asset-div-chart-note");
const assetDivMonthDetail = document.getElementById("asset-div-month-detail");

// 월별 배당 그래프에서 지금 선택한 달 (1~12, 처음에는 배당이 가장 많은 달)
let assetSelectedMonth = null;

// =============================================
// 3. 계산
// =============================================

// 종목 하나의 매입금액, 평가금액, 손익, 수익률(%), 배당을 계산해 돌려줌
function calculateAsset(asset) {
  const cost = asset.quantity * asset.avgPrice; // 매입금액 = 수량 × 평균 매입가
  const value = asset.quantity * asset.currentPrice; // 평가금액 = 수량 × 현재가
  const profit = value - cost; // 손익
  // 수익률: 매입금액이 0이면 나눌 수 없으니 0으로
  const rate = cost > 0 ? (profit / cost) * 100 : 0;

  // 예상 연 배당금 = 수량 × 주당 연간 배당금
  const annualDividend = asset.quantity * asset.dividendPerShare;
  // 배당수익률(현재가 기준) = 주당 배당금 ÷ 현재가
  const dividendYield = asset.currentPrice > 0 ? (asset.dividendPerShare / asset.currentPrice) * 100 : 0;
  // 매입가 기준 배당수익률 = 주당 배당금 ÷ 평균 매입가 (내가 산 가격 대비 몇 %를 받는지)
  const yieldOnCost = asset.avgPrice > 0 ? (asset.dividendPerShare / asset.avgPrice) * 100 : 0;

  return {
    cost: cost,
    value: value,
    profit: profit,
    rate: rate,
    annualDividend: annualDividend,
    dividendYield: dividendYield,
    yieldOnCost: yieldOnCost,
  };
}

// 전체 포트폴리오의 합계와 종류별 평가금액을 계산해 돌려줌
function calculatePortfolio(list) {
  let cost = 0;
  let value = 0;
  let annualDividend = 0;
  // 종류별 평가금액을 모을 상자: { "kr-stock": 0, "us-stock": 0, ... }
  const valueByKind = {};
  Object.keys(ASSET_KINDS).forEach(function (kind) {
    valueByKind[kind] = 0;
  });

  list.forEach(function (asset) {
    const result = calculateAsset(asset);
    cost = cost + result.cost;
    value = value + result.value;
    annualDividend = annualDividend + result.annualDividend;
    const kind = ASSET_KINDS[asset.kind] ? asset.kind : "etc";
    valueByKind[kind] = valueByKind[kind] + result.value;
  });

  const profit = value - cost;
  return {
    cost: cost,
    value: value,
    profit: profit,
    rate: cost > 0 ? (profit / cost) * 100 : 0,
    valueByKind: valueByKind,
    annualDividend: annualDividend,
    // 포트폴리오 배당수익률 = 연 배당금 합계 ÷ 총 평가금액
    dividendYield: value > 0 ? (annualDividend / value) * 100 : 0,
  };
}

// 1~12월 각각 들어올 배당과 종목별 내역을 계산해 돌려줌
// 결과: [ { month: 1, total: 0, items: [] }, ..., { month: 12, total: 14440, items: [{ name, amount }] } ]
// 연 배당금을 지급 횟수로 나눠서 각 지급월에 똑같이 담음 (지급월이 없는 예전 종목은 12월 한 번)
function calculateMonthlyDividends(list) {
  const months = [];
  for (let month = 1; month <= 12; month++) {
    months.push({ month: month, total: 0, items: [] });
  }
  list.forEach(function (asset) {
    const annual = calculateAsset(asset).annualDividend;
    if (annual <= 0) {
      return;
    }
    const payMonths = Array.isArray(asset.payMonths) && asset.payMonths.length > 0 ? asset.payMonths : [12];
    const perPayment = annual / payMonths.length;
    payMonths.forEach(function (month) {
      const slot = months[month - 1];
      slot.total = slot.total + perPayment;
      slot.items.push({ name: asset.name, amount: perPayment });
    });
  });
  return months;
}

// 평가금액이 큰 순서로 정렬한 새 배열을 돌려줌 (같으면 먼저 등록한 것이 앞)
function sortAssetsByValue(list) {
  return list.slice().sort(function (a, b) {
    const diff = calculateAsset(b).value - calculateAsset(a).value;
    if (diff !== 0) {
      return diff;
    }
    return Number(a.id) - Number(b.id);
  });
}

// =============================================
// 4. 화면 그리기
// =============================================

// 종목 하나로 목록의 한 줄(<li>)을 만들어 돌려줌
// totalValue: 전체 평가금액 (비중 계산에 사용)
function createAssetItem(asset, totalValue) {
  const result = calculateAsset(asset);

  const li = document.createElement("li");
  li.className = "asset-item";
  if (asset.id === assetEditingId) {
    li.classList.add("editing");
  }

  // 첫째 줄 왼쪽: 종목명 + [종류]
  const nameSpan = document.createElement("span");
  nameSpan.className = "asset-name";
  nameSpan.textContent = asset.name;

  const kindSpan = document.createElement("span");
  kindSpan.className = "asset-kind";
  kindSpan.textContent = ASSET_KINDS[asset.kind] || "기타";
  nameSpan.appendChild(kindSpan);

  // 첫째 줄 오른쪽: 평가금액
  const valueSpan = document.createElement("span");
  valueSpan.className = "asset-value";
  valueSpan.textContent = formatMoney(result.value);
  flashMarketValue(valueSpan, "asset-" + asset.id, result.value); // 시세가 바뀌면 반짝 (market.js)

  // 수량 · 평균 매입가 · 현재가
  // 주식·ETF는 "10주", 나머지(예적금, 채권 등)는 "수량 1"로 표시
  const detailSpan = document.createElement("span");
  detailSpan.className = "asset-detail";
  const isShare = asset.kind === "kr-stock" || asset.kind === "us-stock" || asset.kind === "etf";
  const quantityText = isShare ? formatNumber(asset.quantity) + "주" : "수량 " + formatNumber(asset.quantity);
  detailSpan.textContent =
    quantityText + " · 평균 " + formatMoney(asset.avgPrice) + " · 현재 " + formatMoney(asset.currentPrice);

  // 손익(수익률): 수익은 빨강, 손실은 파랑
  const profitSpan = document.createElement("span");
  profitSpan.className = "asset-profit " + getProfitClass(result.profit);
  profitSpan.textContent = formatSignedMoney(result.profit) + " (" + formatPercent(result.rate) + ")";

  // 비중: 전체 평가금액 중 이 종목이 차지하는 %
  const ratioSpan = document.createElement("span");
  ratioSpan.className = "asset-ratio";
  const ratio = totalValue > 0 ? (result.value / totalValue) * 100 : 0;
  ratioSpan.textContent = "비중 " + formatShare(ratio);

  // 버튼 묶음: 수정, 삭제
  const actions = document.createElement("span");
  actions.className = "asset-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "edit-btn";
  editBtn.textContent = "수정";
  editBtn.addEventListener("click", function () {
    startAssetEdit(asset);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", function () {
    if (confirm(asset.name + "\n이 종목을 삭제할까요?")) {
      deleteAsset(asset.id);
    }
  });
  actions.append(editBtn, deleteBtn);

  li.append(nameSpan, valueSpan, profitSpan, ratioSpan, detailSpan);

  // 시세 줄: 티커 · 최근 거래일 등락 · 52주 범위 안 위치 · 1년 추이선 (market.js)
  const quote = getMarketQuote(asset.ticker);
  if (asset.ticker) {
    const market = document.createElement("span");
    market.className = "asset-market";
    const ticker = document.createElement("span");
    ticker.className = "asset-ticker";
    ticker.textContent = normalizeMarketTicker(asset.ticker).replace(/\.(KS|KQ)$/, "");
    market.appendChild(ticker);
    if (quote) {
      // 지금 가격 (달러 종목은 달러로)
      const price = document.createElement("span");
      price.className = "asset-quote-price";
      price.textContent = quote.currency === "USD" ? "$" + formatNumber(Math.round(quote.price * 100) / 100) : formatMoney(quote.price);
      market.appendChild(price);
      if (Number.isFinite(quote.change)) {
        const change = document.createElement("span");
        change.className = getProfitClass(quote.change);
        change.textContent = formatPercent(quote.change);
        market.appendChild(change);
      }
      // 장 전·장 후(시간외) 가격: 정규장 가격 대비 등락
      if (quote.ext && Number.isFinite(quote.ext.change)) {
        const ext = document.createElement("span");
        ext.className = "asset-quote-ext " + getProfitClass(quote.ext.change);
        ext.textContent = "시간외 " + formatPercent(quote.ext.change);
        ext.title = "시간외 가격 " + (quote.currency === "USD" ? "$" : "") + formatNumber(quote.ext.price);
        market.appendChild(ext);
      }
      // 52주 최저~최고 중 지금 위치 (막대 위 점)
      if (quote.high52 > quote.low52) {
        const range = document.createElement("span");
        range.className = "asset-range";
        range.title = "52주 최저 " + formatAmount(quote.low52) + " ~ 최고 " + formatAmount(quote.high52);
        const dot = document.createElement("span");
        dot.className = "asset-range-dot";
        dot.style.left = Math.min(Math.max(((quote.price - quote.low52) / (quote.high52 - quote.low52)) * 100, 0), 100) + "%";
        range.appendChild(dot);
        const label = document.createElement("span");
        label.className = "asset-range-label";
        label.textContent = "52주";
        market.append(label, range);
      }
      market.appendChild(createMarketSparkline(quote.closes.slice(-12), 56, 16));
    } else {
      const missing = document.createElement("span");
      missing.className = "asset-range-label";
      missing.textContent = marketData ? "시세 없음" : "시세 불러오는 중";
      market.appendChild(missing);
    }
    li.appendChild(market);
  }
  li.appendChild(actions);
  return li;
}

// 포트폴리오 요약(합계 카드 + 종류별 비중 막대)을 그림
function renderAssetSummary(portfolio) {
  assetTotalValueText.textContent = formatMoney(portfolio.value);

  assetTotalProfitText.textContent = formatSignedMoney(portfolio.profit);
  assetTotalProfitText.className = getProfitClass(portfolio.profit);

  assetTotalRateText.textContent = formatPercent(portfolio.rate);
  assetTotalRateText.className = getProfitClass(portfolio.profit);

  assetTotalCostText.textContent =
    "총 매입금액 " + formatMoney(portfolio.cost) + " · " + assets.length + "종목";

  // 종류별 비중 막대 (종류 순서는 항상 같게 → 색이 종류마다 고정)
  const items = Object.keys(ASSET_KINDS).map(function (kind) {
    return { name: ASSET_KINDS[kind], value: portfolio.valueByKind[kind], colorClass: "kind-" + kind };
  });
  renderAllocation(assetAllocBar, assetAllocLegend, items); // common.js
}

// 배당 요약과 배당 종목 목록을 그림
function renderDividends(portfolio) {
  assetDivAnnualText.textContent = formatMoney(portfolio.annualDividend);
  assetDivMonthlyText.textContent = formatMoney(portfolio.annualDividend / 12);
  assetDivYieldText.textContent = portfolio.dividendYield.toFixed(2) + "%";
  assetDivAfterTaxText.textContent =
    "세후 연 약 " +
    formatMoney(portfolio.annualDividend * (1 - ASSET_DIVIDEND_TAX_RATE)) +
    " (배당소득세 15.4% 가정)";

  // 배당이 있는 종목만 골라 연 배당금이 큰 순서로
  const payers = assets
    .filter(function (asset) {
      return calculateAsset(asset).annualDividend > 0;
    })
    .sort(function (a, b) {
      return calculateAsset(b).annualDividend - calculateAsset(a).annualDividend;
    });

  assetDivList.innerHTML = "";
  payers.forEach(function (asset) {
    const result = calculateAsset(asset);
    const share = (result.annualDividend / portfolio.annualDividend) * 100;

    // 한 줄 모양
    // 삼성전자 .................. 연 14,440원
    // 주당 1,444원 · 수익률 1.93% (매입가 기준 2.06%) · 배당 비중 30.0%
    const li = document.createElement("li");
    li.className = "div-item";

    const name = document.createElement("span");
    name.className = "div-name";
    name.textContent = asset.name;

    const amount = document.createElement("span");
    amount.className = "div-amount";
    amount.textContent = "연 " + formatMoney(result.annualDividend);

    const detail = document.createElement("span");
    detail.className = "div-detail";
    detail.textContent =
      "주당 " + formatMoney(asset.dividendPerShare) +
      " · 수익률 " + result.dividendYield.toFixed(2) + "%" +
      " (매입가 기준 " + result.yieldOnCost.toFixed(2) + "%)" +
      " · 배당 비중 " + formatShare(share) +
      " · " + describePayMonths(asset.payMonths);

    li.append(name, amount, detail);
    assetDivList.appendChild(li);
  });

  assetDivEmptyMessage.hidden = payers.length > 0;
  renderDividendChart();
}

// 월별 배당 막대 그래프 (1~12월)
function renderDividendChart() {
  const months = calculateMonthlyDividends(assets);
  let max = 0;
  months.forEach(function (m) {
    max = Math.max(max, m.total);
  });

  assetDivChartBox.hidden = max <= 0;
  if (max <= 0) {
    assetSelectedMonth = null;
    return;
  }

  // 선택한 달이 없거나 그달 배당이 사라졌으면, 가장 많은 달을 선택
  const maxMonth = months.find(function (m) {
    return m.total === max;
  }).month;
  if (assetSelectedMonth === null || months[assetSelectedMonth - 1].total <= 0) {
    assetSelectedMonth = maxMonth;
  }

  // 막대 12개: 높이 = 그달 배당 ÷ 가장 많은 달 배당
  assetDivChart.innerHTML = "";
  months.forEach(function (m) {
    const column = document.createElement("button");
    column.type = "button";
    column.className = "month-col" + (m.month === assetSelectedMonth ? " selected" : "");
    column.setAttribute("aria-label", m.month + "월 배당 " + formatMoney(m.total));

    // 가장 많은 달 위에만 금액을 적음 (모든 막대에 숫자를 쓰면 읽기 어려움)
    const value = document.createElement("span");
    value.className = "month-value";
    // 칸이 좁아서 1만 원 이상은 "4.6만"처럼 소수점 한 자리 만 단위로
    const shortValue = m.total >= 10000 ? (m.total / 10000).toFixed(1) + "만" : formatAmount(m.total);
    value.textContent = m.month === maxMonth ? shortValue : "";

    const barArea = document.createElement("span");
    barArea.className = "month-bar-area";
    const bar = document.createElement("span");
    bar.className = "month-bar";
    bar.style.height = (m.total / max) * 100 + "%";
    barArea.appendChild(bar);

    const label = document.createElement("span");
    label.className = "month-label";
    label.textContent = m.month;

    column.append(value, barArea, label);
    // 막대를 누르면 그달 내역을 아래에 보여 줌
    column.addEventListener("click", function () {
      assetSelectedMonth = m.month;
      renderDividendChart();
    });
    assetDivChart.appendChild(column);
  });

  // 배당이 없는 달 안내
  const emptyMonths = months
    .filter(function (m) {
      return m.total <= 0;
    })
    .map(function (m) {
      return m.month;
    });
  assetDivChartNote.textContent =
    "가장 많은 달 " + maxMonth + "월" +
    (emptyMonths.length > 0 ? " · 배당 없는 달 " + emptyMonths.join("·") + "월" : " · 매달 배당이 들어와요");

  // 선택한 달의 내역: "6월 45,000원 — 삼성전자 3,610원 · TIGER 41,390원"
  const selected = months[assetSelectedMonth - 1];
  const parts = selected.items
    .slice()
    .sort(function (a, b) {
      return b.amount - a.amount;
    })
    .map(function (item) {
      return item.name + " " + formatMoney(item.amount);
    });
  assetDivMonthDetail.textContent =
    selected.month + "월 " + formatMoney(selected.total) +
    (parts.length > 0 ? " — " + parts.join(" · ") : " — 들어오는 배당 없음");
}

// 지급월을 글로 (예: [3, 6, 9, 12] → "지급 3·6·9·12월", 12개 → "매월 지급")
function describePayMonths(payMonths) {
  if (!Array.isArray(payMonths) || payMonths.length === 0) {
    return "지급월 미입력 (12월로 계산)";
  }
  if (payMonths.length === 12) {
    return "매월 지급";
  }
  return "지급 " + payMonths.join("·") + "월";
}

// 금융자산 탭 전체를 다시 그림 (요약 + 배당 + 목록)
function renderAssets() {
  const portfolio = calculatePortfolio(assets);
  renderAssetSummary(portfolio);
  renderDividends(portfolio);

  assetList.innerHTML = "";
  sortAssetsByValue(assets).forEach(function (asset) {
    assetList.appendChild(createAssetItem(asset, portfolio.value));
  });

  // 종목이 하나도 없을 때만 안내 문구를 보여 줌
  assetEmptyMessage.hidden = assets.length > 0;
}

// =============================================
// 5. 이벤트 처리
// =============================================

// 입력칸 글자를 숫자로 바꿈. 비어 있으면 emptyValue(기본 0)를 돌려줌
function readAssetNumber(input, emptyValue) {
  if (input.value.trim() === "") {
    return emptyValue === undefined ? 0 : emptyValue;
  }
  return Number(input.value);
}

// 입력한 종목에 문제가 있으면 안내 문구를, 없으면 빈 글자("")를 돌려줌
function validateAsset(asset) {
  if (asset.name === "") {
    return "종목명을 입력해 주세요.";
  }
  // Number.isFinite: 제대로 된 숫자인지 확인 (빈칸·글자는 통과 못 함)
  if (!Number.isFinite(asset.quantity) || asset.quantity <= 0) {
    return "수량은 0보다 큰 숫자로 입력해 주세요.";
  }
  const prices = [
    { value: asset.avgPrice, label: "평균 매입가" },
    { value: asset.currentPrice, label: "현재가" },
    { value: asset.dividendPerShare, label: "배당금" },
  ];
  for (const price of prices) {
    if (!Number.isFinite(price.value) || price.value < 0) {
      return price.label + ": 0 이상의 숫자로 입력해 주세요.";
    }
    if (price.value > ASSET_MAX_VALUE) {
      return price.label + ": 값이 너무 큽니다.";
    }
  }
  if (asset.quantity > ASSET_MAX_VALUE) {
    return "수량이 너무 큽니다.";
  }
  if (asset.dividendPerShare > 0 && asset.payMonths.length === 0) {
    return "배당 지급월을 하나 이상 골라 주세요.";
  }
  if (asset.ticker && !/^[A-Z0-9.\-^=]{1,20}$/.test(asset.ticker)) {
    return "티커는 영어·숫자로 넣어 주세요. (예: QQQ, 005930)";
  }
  return "";
}

// ---------------------------------------------
// 티커 입력: 시세 파일에서 찾아 미리 보여 주고, 버튼으로 칸 채우기 (market.js)
// ---------------------------------------------

function renderAssetTickerInfo() {
  const text = assetTickerInput.value.trim();
  assetTickerFillBtn.hidden = true;
  if (!text) {
    assetTickerInfo.textContent = "티커를 넣으면 현재가와 배당금이 자동으로 채워지고 계속 갱신돼요.";
    return;
  }
  const quote = getMarketQuote(text);
  if (!quote) {
    assetTickerInfo.textContent = marketData
      ? "이 티커는 시세 목록에 없어요. 현재가를 직접 넣어 주세요. (목록에 없는 종목은 말씀해 주시면 추가할 수 있어요)"
      : "시세 목록을 불러오는 중…";
    return;
  }
  const krw = toMarketKrw(quote.price, quote.currency);
  const parts = [quote.name, (quote.currency === "USD" ? "$" + formatAssetUsd(quote.price) : formatMoney(quote.price)) + (quote.currency === "USD" && krw ? " (약 " + formatMoney(Math.round(krw)) + ")" : "")];
  if (quote.divTTM > 0) {
    // 시세 파일의 달은 배당락일 기준이라 실제 입금은 몇 주 늦을 수 있음
    parts.push("배당 연 " + (quote.currency === "USD" ? "$" + quote.divTTM : formatMoney(quote.divTTM)) + " (" + describePayMonths(quote.divMonths) + ", 배당락 기준)");
  }
  assetTickerInfo.textContent = parts.join(" · ");
  assetTickerFillBtn.hidden = false;
}

// 달러 가격 글자 (소수 2자리까지)
function formatAssetUsd(value) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

// "채우기" 버튼: 이름(비었을 때)·종류·현재가·배당금·지급월을 시세로 채움
function fillAssetFromTicker() {
  const quote = getMarketQuote(assetTickerInput.value);
  if (!quote) return;
  const ticker = normalizeMarketTicker(assetTickerInput.value);
  assetTickerInput.value = ticker;
  if (!assetNameInput.value.trim()) assetNameInput.value = quote.name;
  const isEtf = quote.type === "ETF" || /ETF|KODEX|TIGER|SOL |ACE /i.test(quote.name);
  assetKindSelect.value = isEtf ? "etf" : isKoreanTicker(ticker) ? "kr-stock" : "us-stock";
  const krw = toMarketKrw(quote.price, quote.currency);
  if (krw) assetCurrentPriceInput.value = Math.round(krw * 100) / 100;
  if (quote.divTTM > 0 && quote.divMonths.length > 0) {
    assetDividendInput.value = Math.round(toMarketKrw(quote.divTTM, quote.currency) * 100) / 100;
    setPayMonths(quote.divMonths);
  } else {
    assetDividendInput.value = "";
  }
  updatePayMonthVisibility();
}

// ---------------------------------------------
// 배당 지급월 입력
// ---------------------------------------------

// 처음 한 번: 빠른 선택 버튼과 1~12월 체크박스를 만듦
function buildPayMonthControls() {
  ASSET_PAY_PRESETS.forEach(function (preset) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip-btn";
    button.textContent = preset.name;
    button.addEventListener("click", function () {
      setPayMonths(preset.months);
    });
    assetPayPresetBox.appendChild(button);
  });

  for (let month = 1; month <= 12; month++) {
    const label = document.createElement("label");
    label.className = "month-check";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.value = String(month);
    label.append(check, month + "월");
    assetPayMonthGrid.appendChild(label);
    assetPayMonthChecks.push(check);
  }
}

// 체크박스를 주어진 달들로 맞춤 (예: [3, 6, 9, 12])
function setPayMonths(months) {
  assetPayMonthChecks.forEach(function (check, index) {
    check.checked = months.indexOf(index + 1) !== -1;
  });
}

// 체크된 달들을 숫자 배열로 (예: [3, 6, 9, 12])
function readPayMonths() {
  const months = [];
  assetPayMonthChecks.forEach(function (check, index) {
    if (check.checked) {
      months.push(index + 1);
    }
  });
  return months;
}

// 배당금 칸에 0보다 큰 값이 있을 때만 지급월 입력을 보여 줌
function updatePayMonthVisibility() {
  assetPayMonthBox.hidden = !(Number(assetDividendInput.value) > 0);
}

assetDividendInput.addEventListener("input", updatePayMonthVisibility);

// 폼을 처음 상태로 되돌리고 수정 모드를 끝냄
function resetAssetForm() {
  assetForm.reset();
  renderAssetTickerInfo();
  updatePayMonthVisibility(); // 배당금이 비워졌으니 지급월 입력도 숨김
  assetEditingId = null;
  assetSubmitBtn.textContent = "추가";
  assetCancelBtn.hidden = true;
}

// 수정 시작: 종목의 값을 폼에 채우고 "수정 모드"로 바꿈
function startAssetEdit(asset) {
  assetEditingId = asset.id;

  assetNameInput.value = asset.name;
  assetKindSelect.value = asset.kind;
  assetTickerInput.value = asset.ticker || "";
  renderAssetTickerInfo();
  assetQuantityInput.value = asset.quantity;
  assetAvgPriceInput.value = asset.avgPrice;
  assetCurrentPriceInput.value = asset.currentPrice;
  // 배당이 0이면 빈칸으로 두어 "없으면 빈칸" 안내가 보이게
  assetDividendInput.value = asset.dividendPerShare > 0 ? asset.dividendPerShare : "";
  setPayMonths(Array.isArray(asset.payMonths) ? asset.payMonths : []); // 예전 종목은 지급월이 없음
  updatePayMonthVisibility();
  assetMemoInput.value = asset.memo;

  assetSubmitBtn.textContent = "수정 완료";
  assetCancelBtn.hidden = false;

  renderAssets(); // 수정 중인 줄 표시
  assetForm.scrollIntoView({ behavior: "smooth" });
}

assetTickerInput.addEventListener("input", renderAssetTickerInfo);
assetTickerFillBtn.addEventListener("click", fillAssetFromTicker);
document.addEventListener("market-updated", function () {
  renderAssetTickerInfo();
  renderAssets(); // 종목마다 시세 줄 다시
});

// 취소 버튼: 수정을 그만두고 폼을 비움
assetCancelBtn.addEventListener("click", function () {
  resetAssetForm();
  renderAssets();
});

// "추가" 또는 "수정 완료" 버튼을 누르면 실행
assetForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const asset = {
    // 수정 중이면 원래 id를 그대로, 새로 추가면 지금 시각으로 새 id
    id: assetEditingId !== null ? assetEditingId : String(Date.now()),
    name: assetNameInput.value.trim(),
    kind: assetKindSelect.value,
    ticker: normalizeMarketTicker(assetTickerInput.value), // 없으면 빈 글자 (market.js)
    quantity: readAssetNumber(assetQuantityInput, NaN), // 비어 있으면 NaN → 검사에서 걸림
    avgPrice: readAssetNumber(assetAvgPriceInput, NaN),
    currentPrice: readAssetNumber(assetCurrentPriceInput, NaN),
    dividendPerShare: readAssetNumber(assetDividendInput), // 비어 있으면 0 (배당 없음)
    memo: assetMemoInput.value.trim(),
  };
  // 배당이 있을 때만 지급월 저장 (배당이 없으면 빈 배열)
  asset.payMonths = asset.dividendPerShare > 0 ? readPayMonths() : [];

  const error = validateAsset(asset);
  if (error !== "") {
    alert(error);
    return;
  }

  if (assetEditingId === null) {
    assets.push(asset);
  } else {
    // 같은 id를 가진 종목을 찾아 새 값으로 바꿔 끼움
    const index = assets.findIndex(function (item) {
      return item.id === assetEditingId;
    });
    assets[index] = asset;
  }
  saveAssets();
  resetAssetForm();
  renderAssets();
});

// 종목 하나를 지우고 저장한 뒤 다시 그림
function deleteAsset(id) {
  assets = assets.filter(function (asset) {
    return asset.id !== id;
  });
  saveAssets();
  // 수정 중이던 종목을 지웠다면 수정 모드도 끝냄
  if (id === assetEditingId) {
    resetAssetForm();
  }
  renderAssets();
}

// =============================================
// 시작
// =============================================

buildPayMonthControls();
updatePayMonthVisibility();
renderAssetTickerInfo();
renderAssets();
