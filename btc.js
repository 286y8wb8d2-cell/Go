// =============================================
// 비트코인 탭 — 공통 도구
// - 작은 탭(한눈에 · 차트 · 네트워크 · 더보기) 바꾸기
// - 자동 갱신: 비트코인 탭을 보고 있을 때만 정해진 간격으로 새 정보를 받아 옴
//   (다른 탭에 있거나 앱을 내려 두면 멈춰서 데이터·배터리를 아낌)
// - 비트코인 설정(국내 거래소 선택, 스택 목표) 저장
// 다른 btc-*.js 파일이 여기 있는 도구를 씀
// ※ 다른 파일과 이름이 겹치지 않게 모두 btc~ / BTC~ 로 시작
// ※ 시세 서비스에는 아무 개인 정보도 보내지 않음 (보유량·금액 없음)
// =============================================

// =============================================
// 1. 상수
// =============================================

// 비트코인 설정 저장 이름 (백업에 포함됨)
const BTC_SETTINGS_KEY = "household-btc-settings";
// 마지막으로 본 작은 탭 (이 기기에서만 기억, 백업 안 함)
const BTC_VIEW_KEY = "household-btc-view";

// 자동 갱신: 5초마다 "할 때가 된 일"이 있는지 확인
const BTC_TICK_MS = 5000;
// 실패하면 이만큼 뒤에 다시 시도
const BTC_RETRY_MS = 30000;

const BTC_DAY_MS = 24 * 60 * 60 * 1000;

// =============================================
// 2. 설정 저장/불러오기
// =============================================

// { exchange: "upbit" | "bithumb", goal: 목표 BTC 수량(없으면 0) }
function loadBtcSettings() {
  const settings = { exchange: "upbit", goal: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(BTC_SETTINGS_KEY));
    if (saved && typeof saved === "object") {
      if (saved.exchange === "upbit" || saved.exchange === "bithumb") settings.exchange = saved.exchange;
      if (Number.isFinite(saved.goal) && saved.goal >= 0) settings.goal = saved.goal;
    }
  } catch (error) {
    // 깨져 있으면 기본값
  }
  return settings;
}

let btcSettings = loadBtcSettings();

function saveBtcSettings() {
  try {
    localStorage.setItem(BTC_SETTINGS_KEY, JSON.stringify(btcSettings));
  } catch (error) {
    // 저장 공간이 막혀 있어도 화면은 그대로 동작
  }
}

// =============================================
// 3. 자동 갱신 도구
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
// 켜지고 꺼질 때 "btc-active" 신호를 보냄 (실시간 연결·카운트다운이 이 신호를 들음)
function updateBtcTimer() {
  const shouldRun = currentTab === "crypto" && !document.hidden;
  if (shouldRun && btcTimer === null) {
    runBtcTasks();
    btcTimer = setInterval(runBtcTasks, BTC_TICK_MS);
    document.dispatchEvent(new CustomEvent("btc-active", { detail: { active: true } }));
  } else if (!shouldRun && btcTimer !== null) {
    clearInterval(btcTimer);
    btcTimer = null;
    document.dispatchEvent(new CustomEvent("btc-active", { detail: { active: false } }));
  }
}

function isBtcActive() {
  return btcTimer !== null;
}

// =============================================
// 4. 작은 탭 (한눈에 · 차트 · 네트워크 · 더보기)
// =============================================

const btcViewButtons = document.querySelectorAll("[data-btc-view]");
const btcViewPanels = document.querySelectorAll("[data-btc-view-panel]");

let btcView = "market";

function showBtcView(view, scroll) {
  btcView = view;
  btcViewButtons.forEach(function (button) {
    const active = button.dataset.btcView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  btcViewPanels.forEach(function (panel) {
    panel.hidden = panel.dataset.btcViewPanel !== view;
  });
  try {
    localStorage.setItem(BTC_VIEW_KEY, view);
  } catch (error) {
    // 무시
  }
  if (scroll) {
    window.scrollTo(0, 0);
  }
  // 작은 탭이 바뀌었다고 알림 (숨어 있을 때 크기를 못 잰 화면이 다시 맞추도록)
  document.dispatchEvent(new CustomEvent("btc-view-shown", { detail: { view: view } }));
}

btcViewButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    showBtcView(button.dataset.btcView, true);
  });
});

// 다른 곳에서 "이 작은 탭으로 가기" 버튼 (data-btc-goto="chain" 등, data-btc-scroll="칸 id"면 그 칸까지)
document.querySelectorAll("[data-btc-goto]").forEach(function (button) {
  button.addEventListener("click", function () {
    if (button.dataset.btcScroll) {
      // 탭이 바뀌는 그림이 끝난 뒤에 스크롤
      setTimeout(function () {
        openBtcSection(button.dataset.btcScroll, button.dataset.btcGoto);
      }, 50);
    } else {
      showBtcView(button.dataset.btcGoto, true);
    }
  });
});

// 칸 하나를 보여 주기: 그 칸이 있는 작은 탭으로 바꾸고, 접혀 있으면 펼친 뒤 그 칸까지 스크롤
function openBtcSection(id, view) {
  const section = document.getElementById(id);
  if (!section) return;
  if (view && view !== btcView) showBtcView(view, false);
  if (section.classList.contains("folded")) section.querySelector(".fold-btn").click();
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =============================================
// 4-1. 한눈에 4칸에 보여 줄 값 (각 파일이 값을 넣으면 btc-summary.js가 그림)
// =============================================

// kimp: 김치 프리미엄 %, fng: { value, name, color }, halving: { days, date }, fee: { normal, fast }
const btcSummary = { kimp: null, fng: null, halving: null, fee: null };

function setBtcSummary(key, value) {
  btcSummary[key] = value;
  document.dispatchEvent(new CustomEvent("btc-summary-updated", { detail: { key: key } }));
}

// =============================================
// 5. 작은 도구들
// =============================================

// 여러 곳 중 처음으로 성공한 곳의 숫자를 돌려줌 → { value, name }
// sources: [{ name, url, read(json) }]
async function tryBtcSources(sources) {
  let lastError = null;
  for (const source of sources) {
    try {
      const value = source.read(await fetchCryptoJson(source.url)); // fetchCryptoJson: crypto.js
      if (Number.isFinite(value) && value > 0) {
        return { value: value, name: source.name };
      }
    } catch (error) {
      lastError = error; // 이곳은 실패 → 다음 곳
    }
  }
  throw lastError || new Error("모든 곳에 접속 실패");
}

// 실패 이유를 짧은 말로 (화면 캡처로 원인을 알 수 있게)
function describeBtcError(error) {
  if (!error) return "알 수 없는 오류";
  if (error.name === "AbortError") return "응답 시간 초과";
  if (error.name === "TypeError") return "접속 차단 또는 네트워크 오류";
  return String(error.message || error).slice(0, 60);
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

// 내가 가진 비트코인 (비트코인 탭 "내 코인"에서 심볼이 BTC인 것들의 합)
// → { quantity, cost } (없으면 quantity 0)
function getMyBtcHolding() {
  let quantity = 0;
  let cost = 0;
  cryptos.forEach(function (crypto) {
    if (getCryptoSymbol(crypto) === "BTC") {
      // cryptos, getCryptoSymbol: crypto.js
      quantity = quantity + crypto.quantity;
      cost = cost + crypto.quantity * crypto.avgPrice;
    }
  });
  return { quantity: quantity, cost: cost };
}

// =============================================
// 접는 칸: 자주 안 보는 칸은 제목만 보이게 접어 둠 (제목을 누르면 펼침/접기, 이 휴대폰에 기억)
// =============================================

const BTC_OPEN_KEY = "household-btc-open"; // { "칸 제목": true/false } — 화면 설정이라 백업하지 않음

// 접어 둘 수 있는 칸 (처음엔 접힘, 목록에 없는 칸은 늘 펼침)
const BTC_FOLDED_TITLES = [
  "거래소 · 24시간 정보", "김치 프리미엄", "매수 vs 매도", "시장 지표", "공포·탐욕 지수 (F&G)", "코인 입력",
  "반감기 사이클 비교", "월별 등락률",
  "해시레이트", "블록 · 거래 · 주소 검색",
  "적립식 시뮬레이터", "솔로 채굴 확률", "이 금액은 몇 BTC?", "BIP39 단어 목록",
  "현물 ETF", "M2와 비트코인", "출금 수수료", "거래소 사고 연표",
];

// =============================================
// 6. 이벤트 처리
// =============================================

// 탭이 바뀌거나 앱을 내렸다 올리면 자동 갱신을 켜거나 끔
// (처음 켜는 것은 마지막 파일 btc-chain.js 끝에서 — 모든 할 일이 등록된 뒤)
document.addEventListener("tab-shown", updateBtcTimer);
document.addEventListener("visibilitychange", updateBtcTimer);

// 시작: 접는 칸 준비, 지난번에 보던 작은 탭 (없으면 시세)
setupFolding("#tab-crypto", BTC_OPEN_KEY, BTC_FOLDED_TITLES); // common.js
(function () {
  let saved = null;
  try {
    saved = localStorage.getItem(BTC_VIEW_KEY);
  } catch (error) {
    // 무시
  }
  // 예전 작은 탭 이름(도구·정보·내 코인)은 새 묶음으로
  saved = { tools: "more", info: "more", mine: "market" }[saved] || saved;
  const exists = Array.from(btcViewButtons).some(function (button) {
    return button.dataset.btcView === saved;
  });
  showBtcView(exists ? saved : "market", false);
})();
