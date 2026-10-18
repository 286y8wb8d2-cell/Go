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
// 비중 막대 + 범례 그리기 (금융자산·가상자산·전체 자산에서 같이 씀)
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

  // 주소 끝에 "#assets"처럼 탭 이름을 남김 → 새로고침해도 보던 탭이 그대로
  // (홈 화면 아이콘으로 새로 열면 주소에 #이 없으니 홈부터 보임)
  // replaceState: 페이지를 다시 불러오지 않고 주소만 바꿈
  history.replaceState(null, "", tabName === "home" ? location.pathname + location.search : "#" + tabName);
}

// 탭 버튼을 누르면 그 탭을 보여 줌
tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    showTab(button.dataset.tab);
  });
});

// 처음 열 때: 주소에 탭 이름(#assets 등)이 있으면 그 탭, 없으면 홈(대시보드)
(function () {
  const hashTab = location.hash.slice(1); // "#assets" → "assets"
  const exists = Array.from(tabButtons).some(function (button) {
    return button.dataset.tab === hashTab;
  });
  showTab(exists ? hashTab : "home");
})();
