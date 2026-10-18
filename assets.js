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
const assetKindSelect = document.getElementById("asset-kind");
const assetQuantityInput = document.getElementById("asset-quantity");
const assetAvgPriceInput = document.getElementById("asset-avg-price");
const assetCurrentPriceInput = document.getElementById("asset-current-price");
const assetDividendInput = document.getElementById("asset-dividend");
const assetMemoInput = document.getElementById("asset-memo");
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

  li.append(nameSpan, valueSpan, profitSpan, ratioSpan, detailSpan, actions);
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

  // 종류별 비중 막대와 설명(범례)을 처음부터 다시 그림
  assetAllocBar.innerHTML = "";
  assetAllocLegend.innerHTML = "";

  // 평가금액이 0이면 비중을 계산할 수 없으니 막대를 숨김
  const hasValue = portfolio.value > 0;
  assetAllocBar.hidden = !hasValue;
  assetAllocLegend.hidden = !hasValue;
  if (!hasValue) {
    return;
  }

  // 종류 순서는 항상 같게 (색이 종류마다 고정되도록), 금액이 0인 종류는 건너뜀
  Object.keys(ASSET_KINDS).forEach(function (kind) {
    const kindValue = portfolio.valueByKind[kind];
    if (kindValue <= 0) {
      return;
    }
    const ratio = (kindValue / portfolio.value) * 100;
    const label = ASSET_KINDS[kind] + " " + formatShare(ratio);

    // 막대 조각: 너비 = 비중(%)
    const segment = document.createElement("span");
    segment.className = "alloc-segment kind-" + kind;
    segment.style.width = ratio + "%";
    segment.title = label + " (" + formatMoney(kindValue) + ")"; // PC에서 마우스를 올리면 보임

    // 범례 한 줄: ■ 국내주식 45.2% 1,234,000원
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "alloc-swatch kind-" + kind;
    const name = document.createElement("span");
    name.className = "alloc-name";
    name.textContent = label;
    const amount = document.createElement("span");
    amount.className = "alloc-amount";
    amount.textContent = formatMoney(kindValue);
    item.append(swatch, name, amount);

    assetAllocBar.appendChild(segment);
    assetAllocLegend.appendChild(item);
  });
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
      " · 배당 비중 " + formatShare(share);

    li.append(name, amount, detail);
    assetDivList.appendChild(li);
  });

  assetDivEmptyMessage.hidden = payers.length > 0;
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
  return "";
}

// 폼을 처음 상태로 되돌리고 수정 모드를 끝냄
function resetAssetForm() {
  assetForm.reset();
  assetEditingId = null;
  assetSubmitBtn.textContent = "추가";
  assetCancelBtn.hidden = true;
}

// 수정 시작: 종목의 값을 폼에 채우고 "수정 모드"로 바꿈
function startAssetEdit(asset) {
  assetEditingId = asset.id;

  assetNameInput.value = asset.name;
  assetKindSelect.value = asset.kind;
  assetQuantityInput.value = asset.quantity;
  assetAvgPriceInput.value = asset.avgPrice;
  assetCurrentPriceInput.value = asset.currentPrice;
  // 배당이 0이면 빈칸으로 두어 "없으면 빈칸" 안내가 보이게
  assetDividendInput.value = asset.dividendPerShare > 0 ? asset.dividendPerShare : "";
  assetMemoInput.value = asset.memo;

  assetSubmitBtn.textContent = "수정 완료";
  assetCancelBtn.hidden = false;

  renderAssets(); // 수정 중인 줄 표시
  assetForm.scrollIntoView({ behavior: "smooth" });
}

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
    quantity: readAssetNumber(assetQuantityInput, NaN), // 비어 있으면 NaN → 검사에서 걸림
    avgPrice: readAssetNumber(assetAvgPriceInput, NaN),
    currentPrice: readAssetNumber(assetCurrentPriceInput, NaN),
    dividendPerShare: readAssetNumber(assetDividendInput), // 비어 있으면 0 (배당 없음)
    memo: assetMemoInput.value.trim(),
  };

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

renderAssets();
