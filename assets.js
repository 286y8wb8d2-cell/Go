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
const assetList = document.getElementById("asset-list");
const assetEmptyMessage = document.getElementById("asset-empty-message");

// =============================================
// 4. 화면 그리기
// =============================================

// 종목 하나로 목록의 한 줄(<li>)을 만들어 돌려줌
function createAssetItem(asset) {
  const li = document.createElement("li");
  li.className = "asset-item";

  // 첫째 줄 왼쪽: 종목명 + [종류]
  const nameSpan = document.createElement("span");
  nameSpan.className = "asset-name";
  nameSpan.textContent = asset.name;

  const kindSpan = document.createElement("span");
  kindSpan.className = "asset-kind";
  kindSpan.textContent = ASSET_KINDS[asset.kind] || "기타";
  nameSpan.appendChild(kindSpan);

  // 첫째 줄 오른쪽: 현재가
  const priceSpan = document.createElement("span");
  priceSpan.className = "asset-price";
  priceSpan.textContent = formatMoney(asset.currentPrice);

  // 둘째 줄: 수량 · 평균 매입가 (· 배당금이 있으면 배당금)
  // 주식·ETF는 "10주", 나머지(예적금, 채권 등)는 "수량 1"로 표시
  const detailSpan = document.createElement("span");
  detailSpan.className = "asset-detail";
  const isShare = asset.kind === "kr-stock" || asset.kind === "us-stock" || asset.kind === "etf";
  const quantityText = isShare ? formatNumber(asset.quantity) + "주" : "수량 " + formatNumber(asset.quantity);
  let detail = quantityText + " · 평균 " + formatMoney(asset.avgPrice);
  if (asset.dividendPerShare > 0) {
    detail = detail + " · 배당 " + formatMoney(asset.dividendPerShare);
  }
  detailSpan.textContent = detail;

  // 삭제 버튼
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", function () {
    if (confirm(asset.name + "\n이 종목을 삭제할까요?")) {
      deleteAsset(asset.id);
    }
  });

  li.append(nameSpan, priceSpan, detailSpan, deleteBtn);
  return li;
}

// 종목 목록 전체를 다시 그림
function renderAssets() {
  assetList.innerHTML = "";
  assets.forEach(function (asset) {
    assetList.appendChild(createAssetItem(asset));
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

// "추가" 버튼을 누르면 실행
assetForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const asset = {
    id: String(Date.now()),
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

  assets.push(asset);
  saveAssets();
  renderAssets();
  assetForm.reset();
});

// 종목 하나를 지우고 저장한 뒤 다시 그림
function deleteAsset(id) {
  assets = assets.filter(function (asset) {
    return asset.id !== id;
  });
  saveAssets();
  renderAssets();
}

// =============================================
// 시작
// =============================================

renderAssets();
