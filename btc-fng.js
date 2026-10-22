// =============================================
// 비트코인 탭 — 시장 정보 ④ 공포·탐욕 지수 (Fear & Greed Index)
// alternative.me가 매일 발표하는 0~100 점수 (0 = 극단적 공포, 100 = 극단적 탐욕)
// 반원 게이지 + 어제·지난주·지난달 비교 + 최근 30일 막대
// (createSvg는 history.js, 자동 갱신 도구는 btc.js)
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 최근 31일치 (오늘 + 30일 전까지). 안 되면 다음 주소로
// (마지막 주소는 오늘 값 하나만 주는 가장 기본 주소)
const BTC_FNG_URLS = [
  "https://api.alternative.me/fng/?limit=31",
  "https://api.alternative.me/fng/?limit=31&format=json",
  "https://api.alternative.me/fng/",
];

// 하루에 한 번 바뀌는 값이라 10분마다만 확인
const BTC_FNG_EVERY_MS = 10 * 60 * 1000;

// 구간: 이 점수 미만까지 (게이지 색과 이름). 색은 검증된 팔레트의 빨강 → 초록
const BTC_FNG_ZONES = [
  { below: 25, name: "극단적 공포", color: "#e34948" },
  { below: 46, name: "공포", color: "#eb6834" },
  { below: 55, name: "중립", color: "#eda100" },
  { below: 76, name: "탐욕", color: "#1baf7a" },
  { below: 101, name: "극단적 탐욕", color: "#008300" },
];

// 게이지 크기 (viewBox 기준): 가운데 (100, 100), 반지름 80
const BTC_FNG_GAUGE = { cx: 100, cy: 100, r: 80 };

// =============================================
// 화면 요소
// =============================================

const btcFngGauge = document.getElementById("btc-fng-gauge");
const btcFngValue = document.getElementById("btc-fng-value");
const btcFngLabel = document.getElementById("btc-fng-label");
const btcFngCompare = document.getElementById("btc-fng-compare");
const btcFngBars = document.getElementById("btc-fng-bars");
const btcFngStatus = document.getElementById("btc-fng-status");
const btcFngMiniValue = document.getElementById("btc-fng-mini-value");
const btcFngMiniSub = document.getElementById("btc-fng-mini-sub");

// =============================================
// 2. 계산
// =============================================

// 점수 → 구간 { name, color }
function getBtcFngZone(value) {
  return BTC_FNG_ZONES.find(function (zone) {
    return value < zone.below;
  });
}

// 점수(0~100) → 반원 위의 점 (0점 = 왼쪽 끝, 100점 = 오른쪽 끝)
function getBtcFngPoint(value, radius) {
  const angle = Math.PI - (value / 100) * Math.PI;
  return {
    x: BTC_FNG_GAUGE.cx + radius * Math.cos(angle),
    y: BTC_FNG_GAUGE.cy - radius * Math.sin(angle),
  };
}

// =============================================
// 3. 화면 그리기
// =============================================

// 반원 게이지: 구간마다 색 띠 (띠 사이에 작은 틈) + 바늘
function renderBtcFngGauge(value) {
  btcFngGauge.innerHTML = "";
  const g = BTC_FNG_GAUGE;
  let from = 0;
  BTC_FNG_ZONES.forEach(function (zone) {
    const to = Math.min(zone.below, 100);
    const start = getBtcFngPoint(from + 0.6, g.r);
    const end = getBtcFngPoint(to - 0.6, g.r);
    btcFngGauge.appendChild(
      createSvg("path", {
        d: "M" + start.x + " " + start.y + " A" + g.r + " " + g.r + " 0 0 1 " + end.x + " " + end.y,
        class: "btc-fng-band",
        stroke: zone.color,
      })
    );
    from = to;
  });
  if (value === null) return;
  const tip = getBtcFngPoint(value, g.r - 14);
  btcFngGauge.appendChild(createSvg("line", { x1: g.cx, y1: g.cy, x2: tip.x, y2: tip.y, class: "btc-fng-needle" }));
  btcFngGauge.appendChild(createSvg("circle", { cx: g.cx, cy: g.cy, r: 5, class: "btc-fng-hub" }));
}

// 어제 · 지난주 · 지난달 점수
function renderBtcFngCompare(days) {
  btcFngCompare.innerHTML = "";
  [
    ["어제", days[1]],
    ["지난주", days[7]],
    ["지난달", days[30]],
  ].forEach(function (pair) {
    if (!pair[1]) return;
    const zone = getBtcFngZone(pair[1].value);
    const card = document.createElement("div");
    card.className = "btc-fng-card";
    const name = document.createElement("p");
    name.className = "btc-fng-card-name";
    name.textContent = pair[0];
    const value = document.createElement("p");
    value.className = "btc-fng-card-value";
    value.style.color = zone.color;
    value.textContent = pair[1].value;
    const label = document.createElement("p");
    label.className = "btc-fng-card-label";
    label.textContent = zone.name;
    card.append(name, value, label);
    btcFngCompare.appendChild(card);
  });
}

// 최근 30일 막대 (왼쪽이 30일 전, 오른쪽이 오늘). 막대 높이 = 점수, 색 = 구간
function renderBtcFngBars(days) {
  btcFngBars.innerHTML = "";
  const list = days.slice(0, 31).reverse();
  const width = 300;
  const height = 60;
  const slot = width / list.length;
  // 50점 기준선
  btcFngBars.appendChild(createSvg("line", { x1: 0, x2: width, y1: height / 2, y2: height / 2, class: "chart-grid" }));
  list.forEach(function (day, index) {
    const barHeight = Math.max(2, (day.value / 100) * height);
    const bar = createSvg("rect", {
      x: index * slot + 1,
      y: height - barHeight,
      width: Math.max(1, slot - 2),
      height: barHeight,
      rx: 1,
      fill: getBtcFngZone(day.value).color,
    });
    // 길게 누르거나 마우스를 올리면 날짜와 점수
    const tip = createSvg("title", {});
    const date = new Date(day.time * 1000);
    tip.textContent = date.getMonth() + 1 + "월 " + date.getDate() + "일: " + day.value;
    bar.appendChild(tip);
    btcFngBars.appendChild(bar);
  });
}

// =============================================
// 4. 데이터 받기 (자동 갱신 할 일)
// =============================================

// 주소를 차례로 시도해서 [{ value, time }] (최신이 맨 앞)
async function fetchBtcFngDays() {
  let lastError = null;
  for (const url of BTC_FNG_URLS) {
    try {
      const result = await fetchCryptoJson(url); // crypto.js
      // { data: [{ value: "45", timestamp: "1760745600", ... }, ...] }
      const days = result.data
        .map(function (item) {
          return { value: Number(item.value), time: Number(item.timestamp) };
        })
        .filter(function (day) {
          return Number.isFinite(day.value) && day.value >= 0 && day.value <= 100;
        });
      if (days.length > 0) return days;
      lastError = new Error("빈 응답");
    } catch (error) {
      lastError = error;
    }
  }
  // 직접 못 받으면 GitHub Actions가 모아 둔 예비 데이터 (getBtcData: btc-info.js)
  try {
    const data = await getBtcData();
    if (data.fng && data.fng.length > 0) return data.fng;
  } catch (error) {
    // 예비 데이터도 없음
  }
  throw lastError;
}

async function refreshBtcFng() {
  let days;
  try {
    days = await fetchBtcFngDays();
  } catch (error) {
    // 실패 이유도 함께 (화면을 캡처해 주면 원인을 알 수 있게)
    btcFngStatus.textContent =
      getBtcClock() + " 지수를 받지 못했어요 (" + describeBtcError(error) + "). 잠시 뒤 다시 시도해요."; // btc.js
    if (btcFngValue.textContent === "-") {
      btcFngLabel.textContent = "아직 받지 못했어요";
      btcFngMiniSub.textContent = "받지 못했어요";
    }
    return false;
  }

  const today = days[0];
  const zone = getBtcFngZone(today.value);
  renderBtcFngGauge(today.value);
  btcFngValue.textContent = today.value;
  btcFngValue.style.color = zone.color;
  btcFngLabel.textContent = zone.name;
  btcFngLabel.style.color = zone.color;
  btcFngMiniValue.textContent = today.value;
  btcFngMiniValue.style.color = zone.color;
  btcFngMiniSub.textContent = zone.name;
  setBtcSummary("fng", { value: today.value, name: zone.name, color: zone.color }); // 한눈에 4칸 (btc.js)
  renderBtcFngCompare(days);
  renderBtcFngBars(days);

  const date = new Date(today.time * 1000);
  btcFngStatus.textContent =
    date.getMonth() + 1 + "월 " + date.getDate() + "일 발표 · 하루 한 번 바뀌어요 · 출처: alternative.me";
  return true;
}

// =============================================
// 시작
// =============================================

renderBtcFngGauge(null); // 받기 전에는 색 띠만
addBtcTask(refreshBtcFng, BTC_FNG_EVERY_MS);
