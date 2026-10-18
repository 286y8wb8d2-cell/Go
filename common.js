// =============================================
// 공통 도구 (모든 탭에서 같이 쓰는 함수)
// 이 파일은 index.html에서 다른 JS 파일보다 먼저 불러옴
//
// ※ 규칙: 여러 JS 파일이 이름을 함께 쓰기 때문에,
//   파일마다 겹치지 않는 이름을 써야 함 (예: 금융자산은 asset~, 비트코인은 crypto~)
// =============================================

// ---------------------------------------------
// 저장/불러오기 (localStorage)
// ---------------------------------------------

// key 이름으로 저장된 배열을 꺼내 돌려줌. 없거나 깨져 있으면 빈 배열
function loadList(key) {
  const saved = localStorage.getItem(key);
  if (saved === null) {
    return [];
  }
  // 저장된 글자가 깨져 있어도 앱이 멈추지 않게 try/catch로 감쌈
  try {
    const parsed = JSON.parse(saved);
    // 배열이 아닌 이상한 값이 저장돼 있으면 빈 배열로 시작
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

// 배열을 글자(JSON)로 바꿔 key 이름으로 저장함
function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
  // "저장됐어요" 신호를 보냄 → 다른 탭의 합계(networth.js 등)가 듣고 다시 계산함
  document.dispatchEvent(new CustomEvent("data-saved", { detail: { key: key } }));
}

// ---------------------------------------------
// 표시용 도구
// ---------------------------------------------

// 숫자를 "3,000,000원" 모양으로 바꿔 줌 (음수면 "-50,000원")
// 원 단위 아래(소수점)는 반올림해서 보여 줌
function formatMoney(amount) {
  return formatAmount(amount) + "원";
}

// "원" 없이 숫자만 "3,000,000" 모양으로 (표처럼 칸이 좁을 때 사용)
function formatAmount(amount) {
  // "|| 0": -0.4를 반올림하면 -0이 되어 "-0"으로 보이는 것을 막음
  return (Math.round(amount) || 0).toLocaleString("ko-KR");
}

// 큰 금액을 "억", "만" 단위로 짧게 (예: 123,456,789 → "1.23억원", 45,670,000 → "4,567만원")
// 좁은 칸에 금액을 넣을 때 사용. 1만 원 미만은 그대로
function formatKoreanUnit(amount) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 100000000) {
    return sign + (abs / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "억원";
  }
  if (abs >= 10000) {
    return sign + Math.round(abs / 10000).toLocaleString("ko-KR") + "만원";
  }
  return formatMoney(amount);
}

// 금액 앞에 +/- 부호를 붙여 줌 (예: "+50,000원", "-3,000원", 0이면 "0원")
function formatSignedMoney(amount) {
  const rounded = Math.round(amount);
  return (rounded > 0 ? "+" : "") + formatMoney(rounded);
}

// 퍼센트를 부호와 함께 소수점 둘째 자리까지 (예: "+7.14%", "-3.20%")
function formatPercent(value) {
  const fixed = value.toFixed(2);
  // -0.00% 처럼 보이지 않게, 반올림해서 0이면 부호 없이
  if (Number(fixed) === 0) {
    return "0.00%";
  }
  return (value > 0 ? "+" : "") + fixed + "%";
}

// 손익 숫자에 따라 class 이름을 돌려줌 (style.css에서 수익은 빨강, 손실은 파랑)
// 반올림해서 0원이면 색을 칠하지 않음
function getProfitClass(amount) {
  const rounded = Math.round(amount);
  if (rounded > 0) return "profit-up";
  if (rounded < 0) return "profit-down";
  return "";
}

// 비중(%)을 소수점 첫째 자리까지 (예: "12.3%")
// 0보다 크지만 0.1%도 안 되면 "0.0%" 대신 "0.1% 미만"으로 (갖고 있는데 0처럼 보이지 않게)
function formatShare(percent) {
  if (percent > 0 && percent < 0.05) {
    return "0.1% 미만";
  }
  return percent.toFixed(1) + "%";
}

// 단가(한 개 가격)를 보여 줌: 100원 미만이면 소수점 넷째 자리까지, 아니면 원 단위로
// (가격이 1원도 안 되는 코인이 "0원"으로 보이지 않게)
function formatPrice(price) {
  if (Math.abs(price) < 100) {
    return price.toLocaleString("ko-KR", { maximumFractionDigits: 4 }) + "원";
  }
  return formatMoney(price);
}

// 수량처럼 소수점이 있을 수 있는 숫자를 "1,234.5" 모양으로 (소수점은 8자리까지)
function formatNumber(value) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 8 });
}

// 오늘 날짜를 "2026-10-16" 모양의 글자로 만들어 줌
function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  // 월은 0부터 시작하므로 +1, 한 자리면 앞에 0을 붙여 두 자리로 맞춤
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

// ---------------------------------------------
// 비중 막대 + 범례 그리기 (금융자산·비트코인·전체 자산에서 같이 씀)
// ---------------------------------------------

// bar: 막대를 넣을 칸, legend: 범례 목록(<ul>)
// items: [{ name: "국내주식", value: 750000, colorClass: "kind-kr-stock" }, ...]
//        → 이 순서 그대로 그림 (색이 순위가 아니라 항목을 따라가도록, 순서는 부르는 쪽에서 고정)
function renderAllocation(bar, legend, items) {
  bar.innerHTML = "";
  legend.innerHTML = "";

  // 합계 (0원인 항목은 뺌)
  const shown = items.filter(function (item) {
    return item.value > 0;
  });
  let total = 0;
  shown.forEach(function (item) {
    total = total + item.value;
  });

  // 합계가 0이면 비중을 계산할 수 없으니 막대와 범례를 숨김
  bar.hidden = total <= 0;
  legend.hidden = total <= 0;
  if (total <= 0) {
    return;
  }

  shown.forEach(function (item) {
    const ratio = (item.value / total) * 100;
    const label = item.name + " " + formatShare(ratio);

    // 막대 조각: 너비 = 비중(%)
    const segment = document.createElement("span");
    segment.className = "alloc-segment " + item.colorClass;
    segment.style.width = ratio + "%";
    segment.title = label + " (" + formatMoney(item.value) + ")"; // PC에서 마우스를 올리면 보임

    // 범례 한 줄: ■ 국내주식 45.2% ........ 1,234,000원
    const li = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "alloc-swatch " + item.colorClass;
    const name = document.createElement("span");
    name.className = "alloc-name";
    name.textContent = label;
    const amount = document.createElement("span");
    amount.className = "alloc-amount";
    amount.textContent = formatMoney(item.value);
    li.append(swatch, name, amount);

    bar.appendChild(segment);
    legend.appendChild(li);
  });
}

// ---------------------------------------------
// 탭 전환
// ---------------------------------------------

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

// 탭 순서 (버튼 순서 그대로): ["home", "assets", "crypto", "scenario"]
const TAB_ORDER = Array.from(tabButtons).map(function (button) {
  return button.dataset.tab;
});

// 지금 보고 있는 탭 이름
let currentTab = null;

// 사용자가 "움직임 줄이기"를 켜 두었는지 (켜져 있으면 미끄러지는 효과를 끔)
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// tabName(예: "assets")에 해당하는 탭만 보이고 나머지는 숨김
function showTab(tabName) {
  // 옆으로 넘어가는 방향 (다음 탭이면 오른쪽에서, 이전 탭이면 왼쪽에서 들어옴)
  const fromIndex = TAB_ORDER.indexOf(currentTab);
  const toIndex = TAB_ORDER.indexOf(tabName);
  const isFirstShow = currentTab === null;
  const changed = currentTab !== tabName;
  currentTab = tabName;

  tabButtons.forEach(function (button) {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    // 화면 읽기 프로그램에 "지금 선택된 탭"을 알려 줌
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  tabPanels.forEach(function (panel) {
    panel.hidden = panel.id !== "tab-" + tabName;
    // 밀던 중에 남은 움직임 지우기
    panel.style.transform = "";
    panel.style.transition = "";
  });

  // 탭이 바뀌면: 새 탭이 옆에서 미끄러져 들어오고, 화면 맨 위로
  if (changed && !isFirstShow) {
    const panel = document.getElementById("tab-" + tabName);
    if (!reduceMotion) {
      panel.classList.remove("slide-from-left", "slide-from-right");
      void panel.offsetWidth; // 효과를 처음부터 다시 시작하게 하는 요령 (화면 다시 계산)
      panel.classList.add(toIndex > fromIndex ? "slide-from-right" : "slide-from-left");
    }
    window.scrollTo(0, 0);
  }

  // 주소 끝에 "#assets"처럼 탭 이름을 남김 → 새로고침해도 보던 탭이 그대로
  // (홈 화면 아이콘으로 새로 열면 주소에 #이 없으니 홈부터 보임)
  // replaceState: 페이지를 다시 불러오지 않고 주소만 바꿈
  history.replaceState(null, "", tabName === "home" ? location.pathname + location.search : "#" + tabName);

  // 다른 파일에 "탭이 바뀌었다"고 알림 (예: 비트코인 탭의 자동 갱신 켜고 끄기)
  document.dispatchEvent(new CustomEvent("tab-shown", { detail: { tab: tabName } }));
}

// 탭 버튼을 누르면 그 탭을 보여 줌
tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    showTab(button.dataset.tab);
  });
});

// ---------------------------------------------
// 손가락으로 밀어서 탭 넘기기 (아이폰 사진 넘기듯)
// 왼쪽으로 밀면 다음 탭, 오른쪽으로 밀면 이전 탭
// ---------------------------------------------

// 이만큼(px) 넘게 밀어야 탭이 넘어감 (조금 밀다 놓으면 제자리로)
const SWIPE_DISTANCE = 60;

// 밀어서 넘기기를 하지 않을 곳: 입력칸, 옆으로 스크롤되는 표·블록 줄, 끌어서 보는 그래프
const SWIPE_IGNORE = "input, select, textarea, .table-scroll, .history-chart, .btc-chart, .btc-blocks";

// 지금 밀고 있는 손가락 정보 (안 밀고 있으면 null)
let swipe = null;

document.addEventListener(
  "touchstart",
  function (event) {
    // 손가락 하나일 때만, 그리고 제외할 곳이 아닐 때만
    if (event.touches.length !== 1 || event.target.closest(SWIPE_IGNORE)) {
      swipe = null;
      return;
    }
    const touch = event.touches[0];
    swipe = {
      startX: touch.clientX,
      startY: touch.clientY,
      direction: null, // 처음 조금 움직였을 때 "가로"인지 "세로"인지 정함
      panel: document.getElementById("tab-" + currentTab),
    };
  },
  { passive: true }
);

// 미는 동안: 가로로 밀고 있으면 화면이 손가락을 따라 움직임
document.addEventListener(
  "touchmove",
  function (event) {
    if (!swipe) return;
    const touch = event.touches[0];
    const dx = touch.clientX - swipe.startX;
    const dy = touch.clientY - swipe.startY;

    // 10px 넘게 움직이면 방향을 정함 (세로 스크롤이면 넘기기는 하지 않음)
    if (swipe.direction === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      swipe.direction = Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
    }
    if (swipe.direction !== "horizontal" || reduceMotion) return;

    // 첫 탭에서 오른쪽, 마지막 탭에서 왼쪽으로 밀면 넘어갈 탭이 없으니 조금만 끌려옴
    const index = TAB_ORDER.indexOf(currentTab);
    const noTab = (dx > 0 && index === 0) || (dx < 0 && index === TAB_ORDER.length - 1);
    swipe.panel.style.transition = "none";
    swipe.panel.style.transform = "translateX(" + dx * (noTab ? 0.2 : 0.5) + "px)";
  },
  { passive: true }
);

// 손을 떼면: 충분히 밀었으면 옆 탭으로, 아니면 제자리로
document.addEventListener("touchend", function (event) {
  if (!swipe) return;
  const current = swipe;
  swipe = null;
  if (current.direction !== "horizontal") return;

  const dx = event.changedTouches[0].clientX - current.startX;
  const index = TAB_ORDER.indexOf(currentTab);
  const target = dx < 0 ? TAB_ORDER[index + 1] : TAB_ORDER[index - 1];

  if (Math.abs(dx) >= SWIPE_DISTANCE && target) {
    showTab(target);
    hideSwipeHint();
  } else {
    // 제자리로 부드럽게 돌아감
    current.panel.style.transition = "transform 0.2s ease";
    current.panel.style.transform = "";
  }
});

document.addEventListener("touchcancel", function () {
  if (swipe && swipe.panel) {
    swipe.panel.style.transform = "";
  }
  swipe = null;
});

// 처음 한 번만 "밀어서 넘길 수 있어요" 안내 (터치 화면에서만)
const SWIPE_HINT_KEY = "household-swipe-hint-seen";
const swipeHint = document.getElementById("swipe-hint");

function hideSwipeHint() {
  if (swipeHint.hidden) return;
  swipeHint.hidden = true;
  try {
    localStorage.setItem(SWIPE_HINT_KEY, "yes");
  } catch (error) {
    // 무시
  }
}

(function () {
  let seen = false;
  try {
    seen = localStorage.getItem(SWIPE_HINT_KEY) === "yes";
  } catch (error) {
    // 무시
  }
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (isTouch && !seen) {
    swipeHint.hidden = false;
    setTimeout(hideSwipeHint, 5000); // 5초 뒤 저절로 사라짐
  }
})();

// 처음 열 때: 주소에 탭 이름(#assets 등)이 있으면 그 탭, 없으면 홈(대시보드)
(function () {
  const hashTab = location.hash.slice(1); // "#assets" → "assets"
  const exists = Array.from(tabButtons).some(function (button) {
    return button.dataset.tab === hashTab;
  });
  showTab(exists ? hashTab : "home");
})();

// ---------------------------------------------
// 새 버전 알림
// 휴대폰(특히 홈 화면에 추가한 앱)은 예전 화면을 한동안 기억해 둠.
// version.json(항상 새로 받음)의 버전이 지금 화면보다 높으면 위에 "새 버전" 알림을 띄움
// ---------------------------------------------

// 지금 화면의 버전 (<html data-version="33">)
const APP_VERSION = Number(document.documentElement.dataset.version) || 0;
const updateBanner = document.getElementById("update-banner");
const updateBannerText = document.getElementById("update-banner-text");
const updateBannerBtn = document.getElementById("update-banner-btn");

let lastUpdateCheck = 0;
let newestVersion = 0;

async function checkAppUpdate() {
  // 너무 자주 확인하지 않게 (10분에 한 번)
  if (Date.now() - lastUpdateCheck < 10 * 60 * 1000) return;
  lastUpdateCheck = Date.now();
  try {
    // ?t=시각: 주소가 매번 달라져서 예전에 받아 둔 파일을 쓰지 않음
    const response = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    if (!response.ok) return;
    const info = await response.json();
    newestVersion = Number(info.version) || 0;
    if (newestVersion > APP_VERSION) {
      updateBannerText.textContent = "새 버전(v" + newestVersion + ")이 나왔어요.";
      updateBanner.hidden = false;
    }
  } catch (error) {
    // 인터넷이 안 되면 다음에
  }
}

// "업데이트" 버튼: 주소에 ?v=새버전을 붙여서 열면 예전 화면 대신 새 화면을 받아 옴
updateBannerBtn.addEventListener("click", function () {
  location.replace(location.pathname + "?v=" + newestVersion + location.hash);
});

checkAppUpdate();
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) checkAppUpdate();
});
