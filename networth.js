// =============================================
// 전체 자산 계산 — 금융자산 + 비트코인 (홈·가계부·시나리오가 씀)
// 금융자산(assets.js) + 비트코인(crypto.js)을 합쳐서 계산
// 이 파일은 다른 JS 파일의 계산 함수를 쓰므로 index.html에서 맨 마지막에 불러옴
// ※ 이름은 모두 networth~ 로 시작
// =============================================

// 자산군 목록: 금융자산 종류 7개 + 비트코인 (색 순서도 이 순서로 고정)
const NETWORTH_GROUPS = Object.keys(ASSET_KINDS).concat(["crypto"]);

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

// (금융자산 탭의 "전체 자산" 칸은 홈과 겹쳐서 없앰 → 계산 함수만 남김. 다른 탭이 calculateNetworth를 씀)
