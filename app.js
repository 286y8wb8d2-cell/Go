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

// 지금 화면에 보여 주는 연도와 월 (처음에는 이번 달)
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1; // 1~12

// 지금 수정 중인 내역의 id (수정 중이 아니면 null)
let editingId = null;

// =============================================
// 화면 요소 찾기
// (HTML에서 id로 붙인 이름표로 요소를 찾아 변수에 담아 둠)
// =============================================

const form = document.getElementById("entry-form");
const dateInput = document.getElementById("date");
const amountInput = document.getElementById("amount");
const memoInput = document.getElementById("memo");
const categorySelect = document.getElementById("category");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const typeRadios = document.querySelectorAll('input[name="type"]');
const entryList = document.getElementById("entry-list");
const emptyMessage = document.getElementById("empty-message");
const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const currentMonthLabel = document.getElementById("current-month");
const totalIncomeText = document.getElementById("total-income");
const totalExpenseText = document.getElementById("total-expense");
const balanceText = document.getElementById("balance");

// =============================================
// 3. 계산
// =============================================

// 지금 보고 있는 달을 "2026-10" 모양의 글자로 돌려줌
function getMonthKey() {
  return currentYear + "-" + String(currentMonth).padStart(2, "0");
}

// 지금 보고 있는 달의 내역만 골라 돌려줌
function getEntriesOfMonth() {
  const monthKey = getMonthKey();
  // 날짜 "2026-10-16"이 "2026-10"으로 시작하면 10월 내역
  return entries.filter(function (entry) {
    return entry.date.startsWith(monthKey);
  });
}

// 내역 목록의 총수입, 총지출, 잔액을 계산해 돌려줌
function calculateSummary(list) {
  let income = 0;
  let expense = 0;

  list.forEach(function (entry) {
    if (entry.type === "income") {
      income = income + entry.amount;
    } else {
      expense = expense + entry.amount;
    }
  });

  return {
    income: income,
    expense: expense,
    balance: income - expense,
  };
}

// 내역을 최신순으로 정렬한 새 배열을 돌려줌 (원래 배열은 그대로 둠)
function sortByNewest(list) {
  return list.slice().sort(function (a, b) {
    // 날짜가 다르면 날짜가 늦은 쪽이 앞으로
    // ("2026-10-16" 같은 글자는 글자 순서가 곧 날짜 순서라서 바로 비교할 수 있음)
    if (a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    // 날짜가 같으면 나중에 입력한 쪽(id가 큰 쪽)이 앞으로
    return Number(b.id) - Number(a.id);
  });
}

// =============================================
// 4. 화면 그리기
// =============================================

// 내역 한 건으로 목록의 한 줄(<li>)을 만들어 돌려줌
function createListItem(entry) {
  const li = document.createElement("li");
  li.className = "entry " + entry.type; // 예: "entry expense" (9단계에서 색을 다르게 줄 때 사용)
  // 지금 수정 중인 줄이면 표시를 붙여 둠 (9단계에서 강조할 때 사용)
  if (entry.id === editingId) {
    li.classList.add("editing");
  }

  const dateSpan = document.createElement("span");
  dateSpan.className = "entry-date";
  dateSpan.textContent = entry.date;

  const categorySpan = document.createElement("span");
  categorySpan.className = "entry-category";
  categorySpan.textContent = entry.category;

  const memoSpan = document.createElement("span");
  memoSpan.className = "entry-memo";
  memoSpan.textContent = entry.memo;

  // 수입은 +, 지출은 - 를 붙여 보여 줌
  const amountSpan = document.createElement("span");
  amountSpan.className = "entry-amount";
  const sign = entry.type === "income" ? "+" : "-";
  amountSpan.textContent = sign + entry.amount + "원";

  // 수정 버튼: 누르면 위쪽 입력 폼에 이 내역의 값을 채움
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "edit-btn";
  editBtn.textContent = "수정";
  editBtn.addEventListener("click", function () {
    startEdit(entry);
  });

  // 삭제 버튼: 누르면 확인 창을 띄우고, "확인"을 누를 때만 지움
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", function () {
    const message = entry.date + " " + entry.category + " " + entry.amount + "원\n이 내역을 삭제할까요?";
    if (confirm(message)) {
      deleteEntry(entry.id);
    }
  });

  li.append(dateSpan, categorySpan, memoSpan, amountSpan, editBtn, deleteBtn);
  return li;
}

// 월 표시 글자를 바꿈 (예: "2026년 10월")
function renderMonth() {
  currentMonthLabel.textContent = currentYear + "년 " + currentMonth + "월";
}

// 지금 보고 있는 달의 총수입, 총지출, 잔액을 보여 줌
function renderSummary() {
  const summary = calculateSummary(getEntriesOfMonth());
  totalIncomeText.textContent = summary.income + "원";
  totalExpenseText.textContent = summary.expense + "원";
  balanceText.textContent = summary.balance + "원";
}

// 지금 보고 있는 달의 목록을 다시 그림
function renderList() {
  const sorted = sortByNewest(getEntriesOfMonth());

  // 기존 목록을 비우고 처음부터 다시 채움
  entryList.innerHTML = "";
  sorted.forEach(function (entry) {
    entryList.appendChild(createListItem(entry));
  });

  // 내역이 하나도 없을 때만 안내 문구를 보여 줌
  emptyMessage.hidden = sorted.length > 0;
}

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

// 화면 전체를 다시 그림 (월 표시 + 요약 + 목록)
function render() {
  renderMonth();
  renderSummary();
  renderList();
}

// 이전 달로 이동 (1월에서 누르면 작년 12월로)
prevMonthBtn.addEventListener("click", function () {
  currentMonth = currentMonth - 1;
  if (currentMonth < 1) {
    currentMonth = 12;
    currentYear = currentYear - 1;
  }
  render();
});

// 다음 달로 이동 (12월에서 누르면 내년 1월로)
nextMonthBtn.addEventListener("click", function () {
  currentMonth = currentMonth + 1;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear = currentYear + 1;
  }
  render();
});

// 폼을 처음 상태로 되돌림 (입력칸 비우기 + 오늘 날짜 + 카테고리 다시 채우기 + 수정 모드 끝내기)
function resetForm() {
  form.reset();
  dateInput.value = getToday();
  updateCategoryOptions();

  editingId = null;
  submitBtn.textContent = "추가";
  cancelBtn.hidden = true;
}

// 수정 시작: 내역의 값을 폼에 채우고 "수정 모드"로 바꿈
function startEdit(entry) {
  editingId = entry.id;

  dateInput.value = entry.date;
  // 구분 라디오 버튼 중 이 내역의 구분과 같은 것을 선택
  document.querySelector('input[name="type"][value="' + entry.type + '"]').checked = true;
  // 구분이 바뀌었을 수 있으니 카테고리 선택지를 먼저 다시 채운 뒤 값을 고름
  updateCategoryOptions();
  categorySelect.value = entry.category;
  amountInput.value = entry.amount;
  memoInput.value = entry.memo;

  submitBtn.textContent = "수정 완료";
  cancelBtn.hidden = false;

  render(); // 수정 중인 줄 표시를 반영
  // 휴대폰에서는 폼이 화면 밖에 있을 수 있으니 폼이 보이게 스크롤
  form.scrollIntoView({ behavior: "smooth" });
}

// 취소 버튼: 수정을 그만두고 폼을 비움
cancelBtn.addEventListener("click", function () {
  resetForm();
  render(); // 수정 중인 줄 표시를 지움
});

// "추가" 또는 "수정 완료" 버튼을 누르면 (폼이 제출되면) 실행
form.addEventListener("submit", function (event) {
  // 폼의 기본 동작(페이지 새로고침)을 막음
  event.preventDefault();

  // 입력값을 모아 내역 한 건을 만듦
  const entry = {
    // 수정 중이면 원래 id를 그대로 쓰고, 새로 추가면 지금 시각(밀리초)을 고유번호로 사용
    id: editingId !== null ? editingId : String(Date.now()),
    date: dateInput.value,
    amount: Number(amountInput.value), // 글자 "12000"을 숫자 12000으로 바꿈
    type: getSelectedType(),
    category: categorySelect.value,
    memo: memoInput.value.trim(), // 앞뒤 공백 제거
  };

  if (editingId === null) {
    // 새로 추가
    entries.push(entry);
  } else {
    // 수정: 같은 id를 가진 내역을 찾아 새 값으로 바꿔 끼움
    const index = entries.findIndex(function (item) {
      return item.id === editingId;
    });
    entries[index] = entry;
  }
  saveEntries();

  // 방금 입력한 내역이 있는 달로 화면을 옮김 (다른 달 날짜를 입력해도 바로 보이게)
  currentYear = Number(entry.date.slice(0, 4));
  currentMonth = Number(entry.date.slice(5, 7));
  resetForm(); // 수정 모드도 여기서 끝남
  render();
});

// id가 같은 내역 하나를 지우고 저장한 뒤 화면을 다시 그림
function deleteEntry(id) {
  // id가 다른 것만 남김 = id가 같은 것만 빠짐
  entries = entries.filter(function (entry) {
    return entry.id !== id;
  });
  saveEntries();
  // 수정 중이던 내역을 지웠다면 수정 모드도 끝냄
  if (id === editingId) {
    resetForm();
  }
  render();
}

// =============================================
// 시작: 페이지가 열리면 한 번 실행
// =============================================

resetForm();
render();
