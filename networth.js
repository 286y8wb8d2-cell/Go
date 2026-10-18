// =============================================
// 전체 자산(순자산) 요약 — 금융자산 탭 맨 위
// 금융자산(assets.js) + 비트코인(crypto.js)을 합쳐서 보여 줌
// 이 파일은 다른 JS 파일의 계산 함수를 쓰므로 index.html에서 맨 마지막에 불러옴
// ※ 이름은 모두 networth~ 로 시작
// =============================================

// 자산군 목록: 금융자산 종류 7개 + 비트코인 (색 순서도 이 순서로 고정)
const NETWORTH_GROUPS = Object.keys(ASSET_KINDS).concat(["crypto"]);

const networthTotalText = document.getElementById("networth-total");
const networthAssetsText = document.getElementById("networth-assets");
const networthCryptoText = document.getElementById("networth-crypto");
const networthProfitText = document.getElementById("networth-profit");
const networthAllocBar = document.getElementById("networth-alloc-bar");
const networthAllocLegend = document.getElementById("networth-alloc-legend");

// 자산군 이름 (비트코인만 따로 추가)
function getNetworthGroupName(group) {
  return group === "crypto" ? "비트코인" : ASSET_KINDS[group];
}

// 전체 자산을 계산해 돌려줌
function calculateNetworth() {
  const portfolio = calculatePortfolio(assets); // assets.js
  const cryptoTotal = calculateCryptoTotal(cryptos); // crypto.js

  // 자산군별 금액: 금융자산 종류별 금액 + 비트코인 합계
  const valueByGroup = Object.assign({}, portfolio.valueByKind, { crypto: cryptoTotal.value });

  const cost = portfolio.cost + cryptoTotal.cost;
  const value = portfolio.value + cryptoTotal.value;
  const profit = value - cost;
  return {
    assetsValue: portfolio.value,
    cryptoValue: cryptoTotal.value,
    value: value,
    profit: profit,
    rate: cost > 0 ? (profit / cost) * 100 : 0,
    valueByGroup: valueByGroup,
  };
}

// 전체 자산 요약을 그림
function renderNetworth() {
  const networth = calculateNetworth();

  networthTotalText.textContent = formatMoney(networth.value);
  networthAssetsText.textContent = formatMoney(networth.assetsValue);
  networthCryptoText.textContent = formatMoney(networth.cryptoValue);

  networthProfitText.textContent =
    "총 손익 " + formatSignedMoney(networth.profit) + " (" + formatPercent(networth.rate) + ")";
  networthProfitText.className = "summary-sub " + getProfitClass(networth.profit);

  // 자산군별 비중 막대 (자산군 순서 고정 → 색 고정)
  const items = NETWORTH_GROUPS.map(function (group) {
    return { name: getNetworthGroupName(group), value: networth.valueByGroup[group], colorClass: "kind-" + group };
  });
  renderAllocation(networthAllocBar, networthAllocLegend, items); // common.js
}

// 어느 탭에서든 데이터가 저장되면 다시 계산 (common.js의 saveList가 보내는 신호)
document.addEventListener("data-saved", renderNetworth);

// 시작
renderNetworth();
