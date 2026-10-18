// =============================================
// 공통 도구 (모든 탭에서 같이 쓰는 함수)
// 이 파일은 index.html에서 다른 JS 파일보다 먼저 불러옴
//
// ※ 규칙: 여러 JS 파일이 이름을 함께 쓰기 때문에,
//   파일마다 겹치지 않는 이름을 써야 함 (예: 금융자산은 asset~, 가상자산은 crypto~)
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
}

// ---------------------------------------------
// 표시용 도구
// ---------------------------------------------

// 숫자를 "3,000,000원" 모양으로 바꿔 줌 (음수면 "-50,000원")
// 원 단위 아래(소수점)는 반올림해서 보여 줌
function formatMoney(amount) {
  // "|| 0": -0.4를 반올림하면 -0이 되어 "-0원"으로 보이는 것을 막음
  return (Math.round(amount) || 0).toLocaleString("ko-KR") + "원";
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
// 탭 전환
// ---------------------------------------------

// 마지막으로 본 탭을 기억해 둘 때 쓰는 이름
const ACTIVE_TAB_KEY = "household-active-tab";

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

// tabName(예: "ledger")에 해당하는 탭만 보이고 나머지는 숨김
function showTab(tabName) {
  tabButtons.forEach(function (button) {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    // 화면 읽기 프로그램에 "지금 선택된 탭"을 알려 줌
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  tabPanels.forEach(function (panel) {
    panel.hidden = panel.id !== "tab-" + tabName;
  });

  // 다음에 열 때 같은 탭이 보이도록 기억 (저장이 안 되는 환경이어도 앱은 계속 동작)
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tabName);
  } catch (error) {
    // 무시
  }
}

// 탭 버튼을 누르면 그 탭을 보여 줌
tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    showTab(button.dataset.tab);
  });
});

// 처음 열 때: 마지막으로 본 탭(없으면 가계부)을 보여 줌
(function () {
  let savedTab = null;
  try {
    savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
  } catch (error) {
    // 무시
  }
  // 저장된 이름이 실제로 있는 탭인지 확인
  const exists = Array.from(tabButtons).some(function (button) {
    return button.dataset.tab === savedTab;
  });
  showTab(exists ? savedTab : "ledger");
})();
