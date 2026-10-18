// =============================================
// 홈(대시보드) 탭 — 앱을 열면 가장 먼저 보이는 화면
// 총 자산 규모를 한눈에: 큰 숫자 + 추이선, 자산 구성 막대, 핵심 숫자 4칸, 큰 종목 TOP 5
// 다른 파일들의 계산 함수를 모두 쓰므로 history.js 뒤에 불러옴
// ※ 이름은 모두 dash~ / DASH~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 큰 종목 목록에 보여 줄 개수
const DASH_TOP_COUNT = 5;

// 작은 추이선 크기 (SVG 좌표)
const DASH_SPARK = { width: 300, height: 56, pad: 6 };

// =============================================
// 화면 요소 찾기
// =============================================

const dashTotalText = document.getElementById("dash-total");
const dashChangeText = document.getElementById("dash-change");
const dashSpark = document.getElementById("dash-spark");
const dashSparkNote = document.getElementById("dash-spark-note");
const dashEmpty = document.getElementById("dash-empty");
const dashContent = document.getElementById("dash-content");
const dashAllocBar = document.getElementById("dash-alloc-bar");
const dashAllocLegend = document.getElementById("dash-alloc-legend");
const dashProfitText = document.getElementById("dash-profit");
const dashProfitSub = document.getElementById("dash-profit-sub");
const dashDividendText = document.getElementById("dash-dividend");
const dashDividendSub = document.getElementById("dash-dividend-sub");
const dashCryptoProfitText = document.getElementById("dash-crypto-profit");
const dashCryptoProfitSub = document.getElementById("dash-crypto-profit-sub");
const dashCryptoShareText = document.getElementById("dash-crypto-share");
const dashCryptoShareSub = document.getElementById("dash-crypto-share-sub");
const dashTopList = document.getElementById("dash-top-list");

// =============================================
// 3. 계산
// =============================================

// 칸이 좁은 곳의 금액: 100만 원 미만은 원 단위 그대로, 그 이상은 "만·억" 단위로 짧게
// (작은 금액을 "1만원"처럼 뭉개지 않으려고)
function formatDashMoney(amount) {
  return Math.abs(amount) < 1000000 ? formatMoney(amount) : formatKoreanUnit(amount);
}

// 금융자산과 비트코인을 한 목록으로 모아 평가금액이 큰 순서로
// 결과: [{ name, group: "국내주식", value }]
function getDashHoldings() {
  const list = [];
  assets.forEach(function (asset) {
    list.push({ name: asset.name, group: ASSET_KINDS[asset.kind] || "기타", value: calculateAsset(asset).value });
  });
  cryptos.forEach(function (crypto) {
    list.push({ name: crypto.name, group: "비트코인", value: calculateCrypto(crypto).value });
  });
  return list
    .filter(function (item) {
      return item.value > 0;
    })
    .sort(function (a, b) {
      return b.value - a.value;
    });
}

// =============================================
// 4. 화면 그리기
// =============================================

// 맨 위 큰 숫자 + 직전 기록 대비 변화 + 작은 추이선
function renderDashHero(networth) {
  dashTotalText.textContent = formatMoney(networth.value);

  // 직전 달 기록과 비교 (이번 달 기록은 지금 값과 같으므로 그 앞 기록과 비교)
  const thisMonth = getToday().slice(0, 7);
  const previous = historyRecords.filter(function (record) {
    return record.month < thisMonth;
  });
  const last = previous[previous.length - 1];
  if (last) {
    const diff = networth.value - last.total;
    dashChangeText.textContent =
      formatHistoryMonth(last.month) + " 대비 " + formatSignedMoney(diff) +
      (last.total > 0 ? " (" + formatPercent((diff / last.total) * 100) + ")" : "");
    dashChangeText.className = "dash-change " + getProfitClass(diff);
  } else {
    dashChangeText.textContent = "다음 달부터 지난달과 비교해 보여 드려요.";
    dashChangeText.className = "dash-change";
  }

  renderDashSpark();
}

// 작은 추이선: 월별 총 자산 (최근 12개 기록)
function renderDashSpark() {
  dashSpark.innerHTML = "";
  const records = historyRecords.slice(-12);
  // SVG에는 .hidden 속성이 없어서(HTML 요소 전용) hidden 속성을 직접 넣고 뺌
  dashSpark.toggleAttribute("hidden", records.length < 2);
  if (records.length < 2) {
    dashSparkNote.textContent = "";
    return;
  }

  const s = DASH_SPARK;
  let min = Infinity;
  let max = -Infinity;
  records.forEach(function (record) {
    min = Math.min(min, record.total);
    max = Math.max(max, record.total);
  });
  // 값이 모두 같으면 가운데에 평평하게
  const range = max - min || 1;
  function x(index) {
    return s.pad + (index / (records.length - 1)) * (s.width - s.pad * 2);
  }
  function y(value) {
    return max === min ? s.height / 2 : s.pad + (1 - (value - min) / range) * (s.height - s.pad * 2);
  }

  const points = records
    .map(function (record, index) {
      return x(index) + "," + y(record.total);
    })
    .join(" ");
  dashSpark.appendChild(createSvg("polyline", { points: points, class: "dash-spark-line" })); // createSvg: history.js
  const lastIndex = records.length - 1;
  dashSpark.appendChild(createSvg("circle", { cx: x(lastIndex), cy: y(records[lastIndex].total), r: 4, class: "dash-spark-dot" }));

  // 처음과 끝 값을 글로 (그래프 아래)
  dashSparkNote.textContent =
    formatHistoryMonth(records[0].month) + " " + formatKoreanUnit(records[0].total) +
    " → " + formatHistoryMonth(records[lastIndex].month) + " " + formatKoreanUnit(records[lastIndex].total);
}

// 핵심 숫자 4칸
function renderDashKpis(networth, portfolio) {
  // ① 총 손익
  dashProfitText.textContent = formatDashMoney(networth.profit);
  if (networth.profit > 0) {
    dashProfitText.textContent = "+" + dashProfitText.textContent;
  }
  dashProfitText.className = "dash-kpi-value " + getProfitClass(networth.profit);
  dashProfitSub.textContent = "수익률 " + formatPercent(networth.rate);

  // ② 연 예상 배당
  dashDividendText.textContent = formatDashMoney(portfolio.annualDividend);
  dashDividendSub.textContent = "월평균 " + formatDashMoney(portfolio.annualDividend / 12);

  // ③ 비트코인 손익과 수익률
  const cryptoTotal = calculateCryptoTotal(cryptos); // crypto.js
  dashCryptoProfitText.textContent = (cryptoTotal.profit > 0 ? "+" : "") + formatDashMoney(cryptoTotal.profit);
  dashCryptoProfitText.className = "dash-kpi-value " + getProfitClass(cryptoTotal.profit);
  dashCryptoProfitSub.textContent = "수익률 " + formatPercent(cryptoTotal.rate);

  // ④ 비트코인 비중
  const cryptoShare = networth.value > 0 ? (networth.cryptoValue / networth.value) * 100 : 0;
  dashCryptoShareText.textContent = formatShare(cryptoShare);
  dashCryptoShareSub.textContent = formatDashMoney(networth.cryptoValue);
}

// 큰 종목 TOP 5: 막대 길이 = 총 자산에서 차지하는 비중 (한 가지 색으로 크기만 비교)
function renderDashTop(networth) {
  dashTopList.innerHTML = "";
  const holdings = getDashHoldings().slice(0, DASH_TOP_COUNT);
  holdings.forEach(function (item, index) {
    const share = networth.value > 0 ? (item.value / networth.value) * 100 : 0;

    // 한 줄 모양
    // 1  삼성전자 [국내주식] ........ 3,750,000원
    //    [■■■■■■■□□□□□□□]               15.0%
    const li = document.createElement("li");
    li.className = "dash-top-item";

    const rank = document.createElement("span");
    rank.className = "dash-top-rank";
    rank.textContent = index + 1;

    const name = document.createElement("span");
    name.className = "dash-top-name";
    name.textContent = item.name;
    const tag = document.createElement("span");
    tag.className = "asset-kind";
    tag.textContent = item.group;
    name.appendChild(tag);

    const value = document.createElement("span");
    value.className = "dash-top-value";
    value.textContent = formatMoney(item.value);

    const track = document.createElement("span");
    track.className = "category-track dash-top-track";
    const fill = document.createElement("span");
    fill.className = "category-fill dash-top-fill";
    fill.style.width = share + "%";
    track.appendChild(fill);

    const shareText = document.createElement("span");
    shareText.className = "dash-top-share";
    shareText.textContent = formatShare(share);

    li.append(rank, name, value, track, shareText);
    dashTopList.appendChild(li);
  });
}

// 대시보드 전체를 다시 그림
function renderDashboard() {
  const networth = calculateNetworth(); // networth.js
  const portfolio = calculatePortfolio(assets); // assets.js

  // 자산이 하나도 없으면 안내만
  const hasAssets = networth.value > 0;
  dashEmpty.hidden = hasAssets;
  dashContent.hidden = !hasAssets;

  renderDashHero(networth);
  if (!hasAssets) {
    return;
  }

  // 자산 구성 막대 (전체 자산과 같은 자산군·같은 색)
  const items = NETWORTH_GROUPS.map(function (group) {
    return { name: getNetworthGroupName(group), value: networth.valueByGroup[group], colorClass: "kind-" + group };
  });
  renderAllocation(dashAllocBar, dashAllocLegend, items); // common.js

  renderDashKpis(networth, portfolio);
  renderDashTop(networth);
}

// =============================================
// 5. 이벤트 처리
// =============================================

// "자세히" 버튼: data-goto에 적힌 탭으로 이동
document.querySelectorAll("[data-goto]").forEach(function (button) {
  button.addEventListener("click", function () {
    showTab(button.dataset.goto); // common.js
    window.scrollTo(0, 0);
  });
});

// 어느 탭에서든 데이터가 바뀌면 다시 그림
document.addEventListener("data-saved", renderDashboard);

// =============================================
// 시작
// =============================================

renderDashboard();

// 홈 화면 앱(주소창 없이 열림)으로 실행 중이면, 비어 있는 홈에 "사파리와 저장 공간이 따로" 안내
(function () {
  const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  document.getElementById("dash-standalone-note").hidden = !standalone;
})();
