// =============================================
// 1. 상수 (카테고리 목록)
// =============================================

// 구분(수입/지출)마다 고를 수 있는 카테고리
const CATEGORIES = {
  expense: ["식비", "교통", "주거", "쇼핑", "기타"],
  income: ["월급", "기타"],
};

// localStorage에 저장할 때 쓰는 이름(열쇠)
const STORAGE_KEY = "household-entries";

// =============================================
// 2. 저장/불러오기 (localStorage)
// =============================================

// 저장된 내역을 꺼내 배열로 돌려줌. 저장된 게 없으면 빈 배열
function loadEntries() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return [];
  }
  // 저장된 글자가 깨져 있어도 앱이 멈추지 않게 try/catch로 감쌈
  try {
    return JSON.parse(saved);
  } catch (error) {
    return [];
  }
}

// 내역 배열을 글자(JSON)로 바꿔 저장함
function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// 모든 내역을 담아 두는 배열 (페이지가 열리면 저장된 내역을 불러옴)
let entries = loadEntries();

// =============================================
// 화면 요소 찾기
// (HTML에서 id로 붙인 이름표로 요소를 찾아 변수에 담아 둠)
// =============================================

const form = document.getElementById("entry-form");
const dateInput = document.getElementById("date");
const amountInput = document.getElementById("amount");
const memoInput = document.getElementById("memo");
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

// 폼을 처음 상태로 되돌림 (입력칸 비우기 + 오늘 날짜 + 카테고리 다시 채우기)
function resetForm() {
  form.reset();
  dateInput.value = getToday();
  updateCategoryOptions();
}

// "추가" 버튼을 누르면 (폼이 제출되면) 실행
form.addEventListener("submit", function (event) {
  // 폼의 기본 동작(페이지 새로고침)을 막음
  event.preventDefault();

  // 입력값을 모아 내역 한 건을 만듦
  const entry = {
    id: String(Date.now()), // 지금 시각(밀리초)을 고유번호로 사용
    date: dateInput.value,
    amount: Number(amountInput.value), // 글자 "12000"을 숫자 12000으로 바꿈
    type: getSelectedType(),
    category: categorySelect.value,
    memo: memoInput.value.trim(), // 앞뒤 공백 제거
  };

  entries.push(entry);
  saveEntries();
  resetForm();
});

// =============================================
// 시작: 페이지가 열리면 한 번 실행
// =============================================

resetForm();
