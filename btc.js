// =============================================
// 비트코인 탭 — 시장 정보 ① 자동 갱신 + 김치 프리미엄
// 비트코인 탭을 보고 있을 때만 정해진 간격으로 새 정보를 받아 옴
// (다른 탭에 있거나 앱을 내려 두면 멈춰서 데이터·배터리를 아낌)
// 차트는 btc-chart.js, 반감기·실시간 블록은 btc-chain.js
// ※ 다른 파일과 이름이 겹치지 않게 모두 btc~ / BTC~ 로 시작
// ※ 시세 서비스에는 아무 개인 정보도 보내지 않음 (보유량·금액 없음)
// =============================================

// =============================================
// 1. 상수
// =============================================

// 국내 가격: 빗썸 비트코인 원화 시세
const BTC_BITHUMB_TICKER_URL = "https://api.bithumb.com/public/ticker/BTC_KRW";

// 해외 가격(달러): 위에서부터 차례로 시도
// 바이낸스는 달러와 거의 같은 테더(USDT) 가격
const BTC_GLOBAL_SOURCES = [
  {
    name: "바이낸스",
    url: "https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT",
    read: function (json) {
      return Number(json.price);
    },
  },
  {
    name: "코인게코",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    read: function (json) {
      return Number(json.bitcoin.usd);
    },
  },
];

// 원/달러 환율: 위에서부터 차례로 시도
const BTC_FX_SOURCES = [
  {
    name: "ExchangeRate-API",
    url: "https://open.er-api.com/v6/latest/USD",
    read: function (json) {
      return Number(json.rates.KRW);
    },
  },
  {
    // 코인게코의 비트코인 원화 가격 ÷ 달러 가격 = 코인게코가 쓰는 환율
    name: "코인게코",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,krw",
    read: function (json) {
      return Number(json.bitcoin.krw) / Number(json.bitcoin.usd);
    },
  },
];

// 환율은 자주 바뀌지 않으니 한 번 받으면 1시간 동안 다시 쓰기
const BTC_FX_KEEP_MS = 60 * 60 * 1000;

// 자동 갱신: 5초마다 "할 때가 된 일"이 있는지 확인
const BTC_TICK_MS = 5000;
// 실패하면 이만큼 뒤에 다시 시도
const BTC_RETRY_MS = 30000;

// 김치 프리미엄 갱신 간격
const BTC_KIMP_EVERY_MS = 30000;

// =============================================
// 2. 상태 (지금까지 받아 온 값)
// =============================================

// 빗썸 비트코인 원화 가격 (실시간 블록의 수수료를 원화로 바꿀 때도 씀)
let btcDomesticPrice = null;

// 환율과 받아 온 시각
let btcFx = null; // { value: 1390.5, name: "ExchangeRate-API", time: 1760000000000 }

// =============================================
// 3. 자동 갱신 도구 (btc-chart.js, btc-chain.js도 같이 씀)
// =============================================

// 할 일 목록: { run: 실행할 함수, everyMs: 간격, lastRun: 마지막 실행 시각, busy: 실행 중인지 }
// run은 성공하면 true, 실패하면 false를 돌려줌 (실패하면 BTC_RETRY_MS 뒤에 다시)
const btcTasks = [];
let btcTimer = null;

function addBtcTask(run, everyMs) {
  btcTasks.push({ run: run, everyMs: everyMs, lastRun: 0, busy: false });
}

// 간격이 지난 일만 실행
function runBtcTasks() {
  const now = Date.now();
  btcTasks.forEach(function (task) {
    if (task.busy || now - task.lastRun < task.everyMs) {
      return;
    }
    task.busy = true;
    task.lastRun = now;
    Promise.resolve()
      .then(task.run)
      .then(function (ok) {
        if (ok === false) {
          // 실패 → 간격을 다 기다리지 않고 조금 뒤에 다시
          task.lastRun = now - task.everyMs + BTC_RETRY_MS;
        }
      })
      .catch(function () {
        task.lastRun = now - task.everyMs + BTC_RETRY_MS;
      })
      .finally(function () {
        task.busy = false;
      });
  });
}

// 비트코인 탭을 보고 있고 앱이 화면에 떠 있을 때만 돌아가게
function updateBtcTimer() {
  const shouldRun = currentTab === "crypto" && !document.hidden;
  if (shouldRun && btcTimer === null) {
    runBtcTasks();
    btcTimer = setInterval(runBtcTasks, BTC_TICK_MS);
  } else if (!shouldRun && btcTimer !== null) {
    clearInterval(btcTimer);
    btcTimer = null;
  }
}

// 여러 곳 중 처음으로 성공한 곳의 숫자를 돌려줌 → { value, name }
async function tryBtcSources(sources) {
  for (const source of sources) {
    try {
      const value = source.read(await fetchCryptoJson(source.url)); // fetchCryptoJson: crypto.js
      if (Number.isFinite(value) && value > 0) {
        return { value: value, name: source.name };
      }
    } catch (error) {
      // 이곳은 실패 → 다음 곳
    }
  }
  throw new Error("모든 곳에 접속 실패");
}

// 지금 시각을 "18:20:15" 모양으로
function getBtcClock() {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(function (n) {
      return String(n).padStart(2, "0");
    })
    .join(":");
}

// 소수점 자리까지 정해서 숫자 글자로 (예: 107800.5 → "107,800.5")
function formatBtcDecimal(value, digits) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

// =============================================
// 4. 김치 프리미엄
// =============================================

const btcKimpRate = document.getElementById("btc-kimp-rate");
const btcKimpDiff = document.getElementById("btc-kimp-diff");
const btcKimpDomestic = document.getElementById("btc-kimp-domestic");
const btcKimpDomesticSub = document.getElementById("btc-kimp-domestic-sub");
const btcKimpGlobal = document.getElementById("btc-kimp-global");
const btcKimpGlobalSub = document.getElementById("btc-kimp-global-sub");
const btcKimpStatus = document.getElementById("btc-kimp-status");

// 빗썸 원화 가격 (+ 24시간 변동률)
async function fetchBtcDomestic() {
  const result = await fetchCryptoJson(BTC_BITHUMB_TICKER_URL);
  if (!result || result.status !== "0000" || !result.data) {
    throw new Error("빗썸 응답 오류");
  }
  return {
    price: Number(result.data.closing_price),
    change: Number(result.data.fluctate_rate_24H), // 24시간 변동률(%)
  };
}

// 환율: 1시간 안에 받은 게 있으면 그대로 씀
async function getBtcFx() {
  if (btcFx && Date.now() - btcFx.time < BTC_FX_KEEP_MS) {
    return btcFx;
  }
  const found = await tryBtcSources(BTC_FX_SOURCES);
  btcFx = { value: found.value, name: found.name, time: Date.now() };
  return btcFx;
}

// 세 가지를 동시에 받아서 김치 프리미엄 계산
// 김치 프리미엄(%) = (국내 가격 ÷ 해외 가격을 원화로 바꾼 값 - 1) × 100
async function refreshBtcKimp() {
  const results = await Promise.allSettled([fetchBtcDomestic(), tryBtcSources(BTC_GLOBAL_SOURCES), getBtcFx()]);
  const domestic = results[0].status === "fulfilled" ? results[0].value : null;
  const global = results[1].status === "fulfilled" ? results[1].value : null;
  const fx = results[2].status === "fulfilled" ? results[2].value : null;

  // 국내 가격 칸
  if (domestic && Number.isFinite(domestic.price) && domestic.price > 0) {
    btcDomesticPrice = domestic.price;
    btcKimpDomestic.textContent = formatMoney(domestic.price);
    if (Number.isFinite(domestic.change)) {
      btcKimpDomesticSub.textContent = "24시간 " + formatPercent(domestic.change);
      btcKimpDomesticSub.className = "btc-card-sub " + getProfitClass(domestic.change);
    }
  }

  // 해외 가격 칸
  const globalKrw = global && fx ? global.value * fx.value : null;
  if (globalKrw) {
    btcKimpGlobal.textContent = formatMoney(globalKrw);
    btcKimpGlobalSub.textContent = "$" + formatBtcDecimal(global.value, 0) + " × " + formatBtcDecimal(fx.value, 1) + "원";
    btcKimpGlobalSub.className = "btc-card-sub";
  }

  // 김치 프리미엄 (세 가지가 다 있어야 계산 가능)
  if (btcDomesticPrice && globalKrw) {
    const rate = (btcDomesticPrice / globalKrw - 1) * 100;
    btcKimpRate.textContent = formatPercent(rate);
    btcKimpRate.className = "btc-big " + getProfitClass(rate);
    btcKimpDiff.textContent =
      (rate >= 0 ? "국내가 " : "국내가 해외보다 ") +
      formatKoreanUnit(Math.abs(btcDomesticPrice - globalKrw)) +
      (rate >= 0 ? " 더 비싸요" : " 더 싸요");
    btcKimpStatus.textContent =
      getBtcClock() + " 갱신 · 30초마다 자동 · 해외: " + global.name + ", 환율: " + fx.name;
    return true;
  }

  // 무엇이 안 됐는지 알려 줌
  const failed = [];
  if (!domestic) failed.push("빗썸");
  if (!global) failed.push("해외 시세");
  if (!fx) failed.push("환율");
  if (btcKimpRate.textContent === "-") {
    btcKimpDiff.textContent = "아직 계산하지 못했어요.";
  }
  btcKimpStatus.textContent =
    getBtcClock() + " " + failed.join("·") + " 정보를 받지 못했어요. 잠시 뒤 다시 시도해요.";
  return false;
}

addBtcTask(refreshBtcKimp, BTC_KIMP_EVERY_MS);

// =============================================
// 5. 이벤트 처리
// =============================================

// 탭이 바뀌거나 앱을 내렸다 올리면 자동 갱신을 켜거나 끔
// (처음 켜는 것은 마지막 파일 btc-chain.js 끝에서 — 모든 할 일이 등록된 뒤)
document.addEventListener("tab-shown", updateBtcTimer);
document.addEventListener("visibilitychange", updateBtcTimer);
