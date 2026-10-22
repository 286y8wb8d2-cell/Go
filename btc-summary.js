// =============================================
// 비트코인 탭 "한눈에" — 가격 아래 30일 추이선과 지표 4칸
// - 4칸(김치 프리미엄 · 공포·탐욕 · 다음 반감기 · 전송 수수료)은 각 파일이 btc.js의 setBtcSummary로 넣은 값을 그림
// - 칸을 누르면 그 자세한 칸으로 (접혀 있으면 펼쳐서)
// ※ 이름은 모두 btc~ 로 시작 (btcSum~)
// btc-chain.js 뒤에 불러옴
// =============================================

const btcSumSpark = document.getElementById("btc-sum-spark");
const btcSumSparkNote = document.getElementById("btc-sum-spark-note");
const btcSumKimp = document.getElementById("btc-sum-kimp");
const btcSumKimpSub = document.getElementById("btc-sum-kimp-sub");
const btcSumFng = document.getElementById("btc-sum-fng");
const btcSumFngSub = document.getElementById("btc-sum-fng-sub");
const btcSumHalving = document.getElementById("btc-sum-halving");
const btcSumHalvingSub = document.getElementById("btc-sum-halving-sub");
const btcSumFee = document.getElementById("btc-sum-fee");
const btcSumFeeSub = document.getElementById("btc-sum-fee-sub");

const BTC_SUM_DAYS = 30;

// =============================================
// 1. 4칸
// =============================================

function renderBtcSumTiles() {
  const s = btcSummary; // btc.js
  if (Number.isFinite(s.kimp)) {
    btcSumKimp.textContent = formatPercent(s.kimp);
    btcSumKimp.className = "btc-sum-value " + getProfitClass(s.kimp);
    btcSumKimpSub.textContent = Math.abs(s.kimp) < 0.5 ? "해외와 거의 같아요" : s.kimp > 0 ? "국내가 더 비싸요" : "국내가 더 싸요";
  }
  if (s.fng) {
    btcSumFng.textContent = s.fng.value;
    btcSumFng.style.color = s.fng.color;
    btcSumFngSub.textContent = s.fng.name;
  }
  if (s.halving) {
    btcSumHalving.textContent = "D-" + s.halving.days.toLocaleString("ko-KR");
    btcSumHalving.className = "btc-sum-value";
    btcSumHalvingSub.textContent = s.halving.date;
  }
  if (s.fee && Number.isFinite(s.fee.normal)) {
    btcSumFee.textContent = formatBtcFeeRate(s.fee.normal) + " sat/vB"; // btc-chain.js
    // 보통 송금 1건이면 원화로 얼마쯤 (실시간 가격이 있을 때)
    btcSumFeeSub.textContent = btcDomesticPrice // btc-live.js
      ? "송금 1건 약 " + formatMoney((s.fee.normal * BTC_TYPICAL_TX_VBYTES * btcDomesticPrice) / 100000000) // btc-chain.js
      : "30분 안에 처리";
  }
}

// =============================================
// 2. 최근 30일 추이선 (일봉 종가 + 지금 가격)
// =============================================

function renderBtcSumSpark() {
  btcSumSpark.innerHTML = "";
  const since = Date.now() - BTC_SUM_DAYS * BTC_DAY_MS; // btc.js
  const points = btcDailyCandles // btc-chart.js
    .filter(function (candle) {
      return candle.time >= since;
    })
    .map(function (candle) {
      return candle.close;
    });
  if (btcDomesticPrice) points.push(btcDomesticPrice);
  // 최근 기록이 부족하면(아직 받는 중) 그리지 않음
  if (points.length < 5) {
    btcSumSpark.toggleAttribute("hidden", true);
    btcSumSparkNote.textContent = "";
    return;
  }
  btcSumSpark.toggleAttribute("hidden", false);
  const min = Math.min.apply(null, points);
  const max = Math.max.apply(null, points);
  const width = 300;
  const height = 48;
  function y(value) {
    return max === min ? height / 2 : 4 + (1 - (value - min) / (max - min)) * (height - 8);
  }
  const up = points[points.length - 1] >= points[0];
  const line = points
    .map(function (value, index) {
      return ((index / (points.length - 1)) * width).toFixed(1) + "," + y(value).toFixed(1);
    })
    .join(" ");
  // 선 아래를 옅게 채운 면 + 선
  btcSumSpark.appendChild(createSvg("polygon", { points: "0," + height + " " + line + " " + width + "," + height, class: up ? "btc-sum-area-up" : "btc-sum-area-down" })); // history.js
  btcSumSpark.appendChild(createSvg("polyline", { points: line, class: "btc-sum-line " + (up ? "btc-sum-line-up" : "btc-sum-line-down") }));
  const change = (points[points.length - 1] / points[0] - 1) * 100;
  btcSumSparkNote.textContent = "";
  btcSumSparkNote.append("최근 30일 ");
  const strong = document.createElement("strong");
  strong.className = getProfitClass(change);
  strong.textContent = formatPercent(change);
  btcSumSparkNote.append(strong, " · 최저 " + formatKoreanUnit(min) + " · 최고 " + formatKoreanUnit(max));
}

// 가격은 거래마다 바뀌므로 추이선은 10초에 한 번만 다시 그림
let btcSumSparkAt = 0;
function renderBtcSumSparkSometimes() {
  if (Date.now() - btcSumSparkAt < 10000) return;
  btcSumSparkAt = Date.now();
  renderBtcSumSpark();
}

// =============================================
// 3. 이벤트 처리
// =============================================

document.querySelectorAll("[data-btc-sum-target]").forEach(function (tile) {
  tile.addEventListener("click", function () {
    openBtcSection(tile.dataset.btcSumTarget, tile.dataset.btcSumView || "market"); // btc.js
  });
});

document.addEventListener("btc-summary-updated", renderBtcSumTiles);
document.addEventListener("btc-price-updated", function () {
  renderBtcSumTiles(); // 수수료의 원화 어림값
  renderBtcSumSparkSometimes();
});
document.addEventListener("btc-candles-updated", renderBtcSumSpark);

// 시작
renderBtcSumTiles();
renderBtcSumSpark();
