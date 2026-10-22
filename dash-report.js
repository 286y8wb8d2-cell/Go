// =============================================
// 홈 — 이번 달 할 일 + 월간 리포트
// - 할 일: 가계부(월급·대출)·카드 지출·자산·백업 상태를 보고 지금 할 만한 일을 골라 숫자와 함께 제안 (최대 4개)
// - 리포트: 이번 달/지난달의 자산 변화, 대출 상환, 카드 지출, 저축 계획을 한 장으로
// 가계부(budget.js), 카드(budget-card.js), 자산 기록(history.js), 백업(backup.js의 저장 이름)을 모두 씀
// ※ 이름은 모두 dash~ / DASH~ 로 시작
// =============================================

const DASH_TODO_MAX = 4;
const DASH_DAY_MS = 24 * 60 * 60 * 1000;
const DASH_MATURITY_SOON_DAYS = 120; // 만기가 이 안에 오면 알려 줌

const dashTodoSection = document.getElementById("dash-todo-section");
const dashTodoList = document.getElementById("dash-todo-list");
const dashReportChips = document.getElementById("dash-report-chips");
const dashReportHeadline = document.getElementById("dash-report-headline");
const dashReportList = document.getElementById("dash-report-list");

let dashReportMonth = null; // 리포트에서 고른 달

// =============================================
// 1. 계산 도구
// =============================================

// 이번 달 계획 (가계부): 여유돈, 저축, 대출 원금이 줄어드는 양, 매달 나가는 돈
function getDashPlan() {
  const hasBudget = budget.salary > 0 || budget.items.length > 0 || budget.debts.length > 0; // budget.js
  if (!hasBudget) return null;
  const row = simulateBudget(1)[0]; // budget.js
  const debtNow = budget.debts.reduce(function (sum, d) {
    return sum + d.balance;
  }, 0);
  return {
    surplus: row.surplus,
    saving: row.groups.saving,
    principal: Math.max(0, debtNow - row.debt), // 이번 달 갚는 원금 (만기 일시상환 포함)
    outflow: budget.salary - row.surplus - row.groups.saving, // 저축 말고 매달 나가는 돈 (지출 + 대출)
    debtNow: debtNow,
  };
}

// 금융자산 중 바로 꺼내 쓸 수 있는 돈 (현금 종류)
function getDashCash() {
  return assets // assets.js
    .filter(function (asset) {
      return asset.kind === "cash";
    })
    .reduce(function (sum, asset) {
      return sum + calculateAsset(asset).value;
    }, 0);
}

function getDashBackupDays() {
  try {
    const last = localStorage.getItem("household-last-backup"); // backup.js의 BACKUP_LAST_KEY (그 파일이 더 늦게 불러와짐)
    if (!last) return Infinity;
    return Math.round((new Date(getToday()) - new Date(last)) / DASH_DAY_MS); // common.js
  } catch (error) {
    return Infinity;
  }
}

// 다른 탭(과 작은 탭)으로 가기
function goDashTarget(target) {
  if (target === "settings") {
    document.getElementById("settings-btn").click();
    return;
  }
  const parts = target.split(":");
  showTab(parts[0]); // common.js
  if (parts[1]) {
    const button = document.querySelector('[data-subtab="' + parts[0] + ":" + parts[1] + '"]');
    if (button) button.click();
  }
}

// =============================================
// 2. 이번 달 할 일
// =============================================

// → [{ title, sub, tone: "warn" | "good" | "", target }]
function getDashTodos() {
  const todos = [];
  const plan = getDashPlan();
  const thisMonth = getBudgetThisMonth(); // budget.js
  const today = getToday();

  if (!plan) {
    todos.push({ title: "가계부에 월급·지출·대출 넣기", sub: "넣어 두면 여유돈·대출·목표에 맞춘 할 일을 골라 드려요.", tone: "", target: "budget:flow" });
  }

  // ① 이번 달 적자
  if (plan && plan.surplus < 0) {
    todos.push({ title: "이번 달 " + formatManwon(-plan.surplus) + " 적자예요", sub: "지출이나 저축 계획을 조금 줄여 흑자로 맞춰 보세요.", tone: "warn", target: "budget:flow" });
  }

  // ② 곧 오는 대출 만기
  budget.debts.forEach(function (debt) {
    if (!debt.maturity || debt.balance <= 0) return;
    const date = debt.maturity + "-28";
    const days = Math.round((new Date(date) - new Date(today)) / DASH_DAY_MS);
    if (days < 0 || days > DASH_MATURITY_SOON_DAYS) return;
    if (debt.kind === "interest") {
      todos.push({
        title: debt.name + " 만기 D-" + days,
        sub: "원금 " + formatManwon(debt.balance) + " 상환 또는 연장 준비 (지금 현금 " + formatManwon(getDashCash()) + ")",
        tone: "warn",
        target: "budget:debt",
      });
    } else {
      todos.push({ title: debt.name + " 곧 끝나요 (D-" + days + ")", sub: "끝나면 매달 " + formatManwon(debt.monthly) + " 여유가 생겨요.", tone: "good", target: "budget:events" });
    }
  });

  // ③ 카드 지출 속도 (이번 달 내역이 있을 때)
  const card = getBudgetCardMonth(thisMonth); // budget-card.js
  const cardBudget = getBudgetCardBudget();
  if (card.tx.length > 0 && cardBudget > 0) {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const pace = (card.total / now.getDate()) * daysInMonth;
    if (pace > cardBudget * 1.05) {
      todos.push({
        title: "카드 지출 속도가 빨라요",
        sub: "지금 속도면 이달 " + formatManwon(pace) + " (예산 " + formatManwon(cardBudget) + "). 남은 " + (daysInMonth - now.getDate()) + "일은 하루 " + formatManwon(Math.max(0, cardBudget - card.total) / Math.max(1, daysInMonth - now.getDate())) + " 안으로.",
        tone: "warn",
        target: "budget:card",
      });
    }
  }

  // ④ 비상금: 현금이 매달 나가는 돈의 3개월치보다 적으면
  if (plan && plan.outflow > 0) {
    const target = plan.outflow * 3;
    const cash = getDashCash();
    if (cash < target) {
      todos.push({
        title: "비상금 " + formatManwon(target - cash) + " 더 모으기",
        sub: "목표는 매달 나가는 돈 3개월치 " + formatManwon(target) + " · 지금 현금 " + formatManwon(cash) + (cash === 0 ? " (금융자산에 '현금' 종류로 넣어 두면 계산돼요)" : ""),
        tone: "",
        target: "assets:holdings",
      });
    }
  }

  // ⑤ 가장 비싼 대출 미리 갚기 (여유돈이 있을 때)
  if (plan && plan.surplus > 50000) {
    const priciest = budget.debts
      .filter(function (d) {
        return d.balance > 0 && d.rate >= 4;
      })
      .sort(function (a, b) {
        return b.rate - a.rate;
      })[0];
    if (priciest) {
      const extra = Math.min(plan.surplus, priciest.balance);
      // 매달 extra씩 12번 더 갚으면 첫 1년 동안 줄어드는 이자: extra × 금리 × (1+2+…+12)/12
      const saved = (extra * (priciest.rate / 100) * 78) / 12;
      todos.push({
        title: priciest.name + "(" + priciest.rate + "%) 미리 갚기",
        sub: "여유돈 " + formatManwon(extra) + "씩 매달 더 갚으면 첫 1년에만 이자 약 " + formatManwon(saved) + " 줄어요.",
        tone: "",
        target: "budget:debt",
      });
    }
  }

  // ⑥ 다음 달 끝나는 할부·지출
  const nextMonth = addBudgetMonths(thisMonth, 1);
  budget.items.forEach(function (item) {
    if (item.end === thisMonth) {
      todos.push({ title: item.name + " 이번 달로 끝", sub: "다음 달(" + Number(nextMonth.slice(5)) + "월)부터 매달 " + formatManwon(item.amount) + " 여유 → 어디에 쓸지 미리 정해 두세요.", tone: "good", target: "budget:now" });
    }
  });

  // ⑦ 백업
  const backupDays = getDashBackupDays();
  if (backupDays > 30) {
    todos.push({
      title: "데이터 백업하기",
      sub: backupDays === Infinity ? "아직 한 번도 백업하지 않았어요. ⚙ 설정 → 내보내기" : backupDays + "일 동안 백업하지 않았어요. ⚙ 설정 → 내보내기",
      tone: "",
      target: "settings",
    });
  }

  return todos.slice(0, DASH_TODO_MAX);
}

function renderDashTodos() {
  const todos = getDashTodos();
  dashTodoSection.hidden = todos.length === 0;
  dashTodoList.innerHTML = "";
  todos.forEach(function (todo) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dash-todo" + (todo.tone ? " " + todo.tone : "");
    const mark = document.createElement("span");
    mark.className = "dash-todo-mark";
    mark.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "dash-todo-text";
    const title = document.createElement("strong");
    title.textContent = todo.title;
    const sub = document.createElement("small");
    sub.textContent = todo.sub;
    text.append(title, sub);
    button.append(mark, text);
    button.addEventListener("click", function () {
      goDashTarget(todo.target);
    });
    li.appendChild(button);
    dashTodoList.appendChild(li);
  });
}

// =============================================
// 3. 월간 리포트
// =============================================

// 자산 기록에서 그달·지난달 값
function getDashHistory(month) {
  return historyRecords.find(function (record) {
    return record.month === month;
  }); // history.js
}

function renderDashReport() {
  const thisMonth = getBudgetThisMonth();
  const choices = [thisMonth, addBudgetMonths(thisMonth, -1)];
  if (!dashReportMonth || choices.indexOf(dashReportMonth) === -1) dashReportMonth = thisMonth;

  dashReportChips.innerHTML = "";
  choices.forEach(function (month, index) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip-btn";
    chip.textContent = index === 0 ? "이번 달" : "지난달";
    chip.setAttribute("aria-pressed", String(month === dashReportMonth));
    chip.addEventListener("click", function () {
      dashReportMonth = month;
      renderDashReport();
    });
    dashReportChips.appendChild(chip);
  });

  const month = dashReportMonth;
  const prevMonth = addBudgetMonths(month, -1);
  const isThisMonth = month === thisMonth;
  const rows = [];
  const plan = getDashPlan();

  // 자산 변화 (월별 자동 기록)
  const record = getDashHistory(month);
  const prevRecord = getDashHistory(prevMonth);
  let assetChange = null;
  if (record && prevRecord) {
    assetChange = record.total - prevRecord.total;
    rows.push({ name: "총 자산", value: formatManwon(record.total), change: assetChange, note: Number(prevMonth.slice(5)) + "월보다" });
    const cryptoChange = record.crypto - prevRecord.crypto;
    if (record.crypto > 0 || prevRecord.crypto > 0) rows.push({ name: "　비트코인", value: formatManwon(record.crypto), change: cryptoChange, note: "" });
    rows.push({ name: "　금융자산", value: formatManwon(record.assets), change: record.assets - prevRecord.assets, note: "" });
  } else if (record) {
    rows.push({ name: "총 자산", value: formatManwon(record.total), change: null, note: "지난달 기록이 없어 비교는 다음 달부터" });
  }

  // 대출 원금 (계획 기준)
  if (plan && plan.principal > 0) {
    rows.push({ name: "갚은 대출 원금", value: formatManwon(plan.principal), change: null, note: "계획 기준" });
  }

  // 카드 지출
  const card = getBudgetCardMonth(month);
  const prevCard = getBudgetCardMonth(prevMonth);
  if (card.tx.length > 0) {
    const top = Object.keys(card.byCat).sort(function (a, b) {
      return card.byCat[b] - card.byCat[a];
    })[0];
    rows.push({
      name: "카드 지출",
      value: formatManwon(card.total),
      change: prevCard.tx.length > 0 ? card.total - prevCard.total : null,
      note: (top ? "가장 많이: " + getBudgetCardCatInfo(top).name + " " + formatManwon(card.byCat[top]) : "") + (isThisMonth ? " · 지금까지" : ""),
      spending: true,
    });
  }

  // 저축·여유 계획
  if (plan) {
    if (plan.saving > 0) rows.push({ name: "저축·투자 (계획)", value: formatManwon(plan.saving), change: null, note: "" });
    rows.push({ name: "월 여유돈 (계획)", value: formatManwon(plan.surplus), change: null, note: plan.surplus < 0 ? "적자" : "" });
  }

  // 한 줄 요약: 순자산 변화 ≈ 자산 변화 + 갚은 원금
  if (assetChange !== null) {
    const netChange = assetChange + (plan ? plan.principal : 0);
    dashReportHeadline.textContent = "";
    dashReportHeadline.append((isThisMonth ? "이번 달 지금까지 " : Number(month.slice(5)) + "월에 ") + "순자산이 약 ");
    const strong = document.createElement("strong");
    strong.className = getProfitClass(netChange);
    strong.textContent = (netChange >= 0 ? "+" : "") + formatManwon(netChange);
    dashReportHeadline.append(strong, netChange >= 0 ? " 늘었어요." : " 줄었어요.");
  } else {
    dashReportHeadline.textContent = rows.length > 0 ? "자산 기록이 두 달 이상 쌓이면 순자산 변화를 알려 드려요." : "자산·가계부·카드 내역을 넣으면 매달 리포트가 만들어져요.";
  }

  dashReportList.innerHTML = "";
  rows.forEach(function (row) {
    const li = document.createElement("li");
    li.className = "dash-report-row";
    const name = document.createElement("span");
    name.className = "dash-report-name";
    name.textContent = row.name;
    if (row.note) {
      const note = document.createElement("small");
      note.textContent = row.note;
      name.appendChild(note);
    }
    const value = document.createElement("span");
    value.className = "dash-report-value";
    value.textContent = row.value;
    if (row.change !== null && row.change !== undefined) {
      const change = document.createElement("small");
      change.className = getProfitClass(row.change);
      change.textContent = (row.change >= 0 ? "+" : "") + formatManwon(row.change);
      value.appendChild(change);
    }
    li.append(name, value);
    dashReportList.appendChild(li);
  });
}

function renderDashReportAll() {
  renderDashTodos();
  renderDashReport();
}

// =============================================
// 4. 이벤트 처리
// =============================================

document.addEventListener("data-saved", renderDashReportAll);
document.addEventListener("market-updated", renderDashReportAll);
document.addEventListener("tab-shown", function () {
  if (currentTab === "home") renderDashReportAll(); // common.js (백업 날짜 등 바뀐 것 반영)
});

renderDashReportAll();
