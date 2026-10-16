// =============================================
// 1. 상수 (카테고리 목록)
// =============================================

// 구분(수입/지출)마다 고를 수 있는 카테고리
const CATEGORIES = {
  expense: ["식비", "교통", "주거", "쇼핑", "기타"],
  income: ["월급", "기타"],
};

// =============================================
// 화면 요소 찾기
// (HTML에서 id로 붙인 이름표로 요소를 찾아 변수에 담아 둠)
// =============================================

const dateInput = document.getElementById("date");
const categorySelect = document.getElementById("category");
const typeRadios = document.querySelectorAll('input[name="type"]');

// =============================================
// 5. 이벤트 처리
// =============================================

// 지금 선택된 구분을 알려 줌 ("expense" 또는 "income")
function getSelectedType() {
  return document.querySelector('input[name="type"]:checked').value;
}

// 선택된 구분에 맞게 카테고리 선택지를 다시 채움
function updateCategoryOptions() {
  const type = getSelectedType();
  const list = CATEGORIES[type];

  // 기존 선택지를 모두 지우고 안내 문구부터 다시 넣음
  categorySelect.innerHTML = '<option value="">-- 선택 --</option>';

  // 카테고리 하나마다 <option>을 만들어 붙임
  list.forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    categorySelect.appendChild(option);
  });
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

// 수입/지출 버튼을 바꿔 누를 때마다 카테고리를 다시 채움
typeRadios.forEach(function (radio) {
  radio.addEventListener("change", updateCategoryOptions);
});

// =============================================
// 시작: 페이지가 열리면 한 번 실행
// =============================================

dateInput.value = getToday();
updateCategoryOptions();
