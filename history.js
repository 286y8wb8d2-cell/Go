// =============================================
// 자산 추이 — 금융자산 탭, 전체 자산 아래
// 매달 총 자산을 자동으로 기록하고, 표(와 그래프)로 보여 줌
// 전체 자산(networth.js)의 계산을 쓰므로 그 뒤에 불러옴
// ※ 이름은 모두 history~ / HISTORY~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

const HISTORY_STORAGE_KEY = "household-history";

// =============================================
// 2. 저장/불러오기
// =============================================

// 달마다 한 줄: [{ month: "2026-10", total: 25000000, assets: 20050000, crypto: 4950000, updated: "2026-10-18" }]
let historyRecords = loadList(HISTORY_STORAGE_KEY);

function saveHistory() {
  // 달 순서(오래된 → 최근)로 정렬해서 저장
  historyRecords.sort(function (a, b) {
    return a.month < b.month ? -1 : a.month > b.month ? 1 : 0;
  });
  saveList(HISTORY_STORAGE_KEY, historyRecords);
}

// =============================================
// 화면 요소 찾기
// =============================================

const historyTableBody = document.getElementById("history-table-body");
const historyTableBox = document.getElementById("history-table-box");
const historyEmptyMessage = document.getElementById("history-empty-message");
const historySummaryText = document.getElementById("history-summary");

// =============================================
// 3. 기록하기
// =============================================

// 이번 달 기록을 지금 자산 값으로 만들거나 고침
// (그래서 따로 누르지 않아도 그달의 마지막 값이 남음)
function recordThisMonth() {
  const networth = calculateNetworth(); // networth.js
  const month = getToday().slice(0, 7); // "2026-10"
  const existing = historyRecords.find(function (record) {
    return record.month === month;
  });

  // 자산이 하나도 없고 이번 달 기록도 없으면 0원 기록은 만들지 않음
  if (!existing && networth.value <= 0) {
    return;
  }

  const record = {
    month: month,
    total: Math.round(networth.value),
    assets: Math.round(networth.assetsValue),
    crypto: Math.round(networth.cryptoValue),
    updated: getToday(),
  };

  // 값이 그대로면 저장하지 않음 (쓸데없는 저장 신호를 줄임)
  if (existing && existing.total === record.total && existing.assets === record.assets && existing.crypto === record.crypto) {
    return;
  }

  if (existing) {
    Object.assign(existing, record);
  } else {
    historyRecords.push(record);
  }
  saveHistory();
}

// =============================================
// 4. 화면 그리기
// =============================================

// "2026-10" → "2026년 10월"
function formatHistoryMonth(month) {
  return month.slice(0, 4) + "년 " + Number(month.slice(5, 7)) + "월";
}

// 기록 표를 그림 (최근 달이 위로)
function renderHistoryTable() {
  historyTableBody.innerHTML = "";
  const hasRecords = historyRecords.length > 0;
  historyEmptyMessage.hidden = hasRecords;
  historyTableBox.hidden = !hasRecords;
  historySummaryText.hidden = historyRecords.length < 2;

  // 처음 기록과 비교한 변화 (기록이 2개 이상일 때)
  if (historyRecords.length >= 2) {
    const first = historyRecords[0];
    const last = historyRecords[historyRecords.length - 1];
    const diff = last.total - first.total;
    historySummaryText.textContent =
      formatHistoryMonth(first.month) + "부터 " + formatSignedMoney(diff) +
      (first.total > 0 ? " (" + formatPercent((diff / first.total) * 100) + ")" : "");
    historySummaryText.className = "summary-sub " + getProfitClass(diff);
  }

  // 최근 달부터
  for (let i = historyRecords.length - 1; i >= 0; i--) {
    const record = historyRecords[i];
    const prev = i > 0 ? historyRecords[i - 1] : null;

    const row = document.createElement("tr");

    const monthCell = document.createElement("td");
    monthCell.textContent = formatHistoryMonth(record.month);

    const totalCell = document.createElement("td");
    totalCell.textContent = formatAmount(record.total);

    // 바로 전 기록과 비교 (중간 달 기록을 지웠으면 그 전 기록과 비교)
    const diffCell = document.createElement("td");
    if (prev) {
      const diff = record.total - prev.total;
      diffCell.textContent = (diff > 0 ? "+" : "") + formatAmount(diff);
      diffCell.className = getProfitClass(diff);
    } else {
      diffCell.textContent = "-";
    }

    const actionCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn history-delete-btn";
    deleteBtn.textContent = "삭제";
    deleteBtn.setAttribute("aria-label", formatHistoryMonth(record.month) + " 기록 삭제");
    deleteBtn.addEventListener("click", function () {
      const isThisMonth = record.month === getToday().slice(0, 7);
      const message =
        formatHistoryMonth(record.month) + " 기록을 삭제할까요?" +
        (isThisMonth ? "\n(이번 달 기록은 자산이 바뀌면 다시 만들어져요.)" : "");
      if (confirm(message)) {
        historyRecords = historyRecords.filter(function (item) {
          return item.month !== record.month;
        });
        saveHistory();
        renderHistory();
      }
    });
    actionCell.appendChild(deleteBtn);

    row.append(monthCell, totalCell, diffCell, actionCell);
    historyTableBody.appendChild(row);
  }
}

// 자산 추이 전체를 다시 그림
function renderHistory() {
  renderHistoryTable();
}

// =============================================
// 5. 이벤트 처리
// =============================================

// 금융자산이나 가상자산이 저장되면 이번 달 기록을 갱신
document.addEventListener("data-saved", function (event) {
  if (event.detail.key === ASSET_STORAGE_KEY || event.detail.key === CRYPTO_STORAGE_KEY) {
    recordThisMonth();
    renderHistory();
  }
});

// =============================================
// 시작: 열 때마다 이번 달 기록을 확인 (새 달이 되면 새 줄이 생김)
// =============================================

recordThisMonth();
renderHistory();
