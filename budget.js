// =============================================
// 가계부 탭 — 월급과 지출, 부채, 미래 계획
// 매달 들어오고 나가는 돈(월급·지출·저축·대출 상환)을 정해 두면
// - 이번 달 돈의 흐름과 여유돈
// - 할부·대출이 끝날 때마다 여유돈이 얼마나 늘어나는지
// - 부채가 줄어드는 모습, 순자산이 목표까지 가는 길(비트코인 가격 시나리오별)
// 을 계산해서 보여 줌
// 자산(금융자산·비트코인)은 다른 탭의 값을 그대로 씀 → 순자산 = 자산 - 부채
// 모든 값은 이 기기에만 저장되고 백업 파일에 포함됨 (어디에도 보내지 않음)
// ※ 이름은 모두 budget~ / BUDGET~ 으로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

const BUDGET_STORAGE_KEY = "household-budget";

// 지출 묶음: 저장용 이름 → 화면 이름과 색 (색은 검증된 팔레트 순서대로 고정)
const BUDGET_GROUPS = {
  fixed: { name: "고정비", color: "#2a78d6" },
  living: { name: "생활비", color: "#eb6834" },
  housing: { name: "주거", color: "#1baf7a" },
  install: { name: "할부", color: "#eda100" },
  saving: { name: "저축·투자", color: "#6250d6" },
  etc: { name: "기타", color: "#e87ba4" },
};
const BUDGET_LOAN_COLOR = "#e34948"; // 대출 상환·이자
const BUDGET_SURPLUS_COLOR = "#008300"; // 여유

// 부채 종류
const BUDGET_DEBT_KINDS = {
  amortize: "원리금 상환", // 매달 같은 금액(원금+이자)을 갚음
  equal: "원금균등", // 매달 같은 원금 + 그달 이자 (갚을수록 이자가 줄어듦)
  interest: "이자만", // 매달 이자만, 만기에 원금 한꺼번에
};

// 2028년 4월쯤 다음 반감기 (이벤트 목록에 함께 표시)
const BUDGET_HALVING_MONTH = "2028-04";

// 처음 쓸 때의 빈 가계부
function getEmptyBudget() {
  return {
    salary: 0,
    goal: 300000000, // 순자산 목표 3억
    inflation: 2.5, // 물가상승률(연 %)
    horizon: 2030, // 미래 계산 마지막 해
    scenarios: { low: 150000, base: 230000, high: 500000 }, // 비트코인 가격 시나리오 (달러)
    items: [], // [{ id, name, amount, group, start: "YYYY-MM", end: "YYYY-MM" }]
    debts: [], // [{ id, name, balance, rate, kind, monthly, maturity: "YYYY-MM" }]
    events: [], // [{ id, date: "YYYY-MM-DD", title, note }]
  };
}

// =============================================
// 2. 저장/불러오기
// =============================================

function loadBudget() {
  const budget = getEmptyBudget();
  try {
    const saved = JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY));
    if (saved && typeof saved === "object") {
      Object.keys(budget).forEach(function (key) {
        if (saved[key] !== undefined) budget[key] = saved[key];
      });
      budget.scenarios = Object.assign(getEmptyBudget().scenarios, saved.scenarios || {});
    }
    // 백업 파일에서 온 값이 이상해도 화면이 멈추지 않게 모양이 맞는 것만 남김
    ["items", "debts", "events"].forEach(function (key) {
      if (!Array.isArray(budget[key])) budget[key] = [];
    });
    budget.items = budget.items.filter(function (item) {
      return item && typeof item.name === "string" && Number.isFinite(item.amount) && BUDGET_GROUPS[item.group];
    });
    budget.debts = budget.debts.filter(function (debt) {
      return debt && typeof debt.name === "string" && Number.isFinite(debt.balance) && Number.isFinite(debt.rate) &&
        Number.isFinite(debt.monthly) && BUDGET_DEBT_KINDS[debt.kind];
    });
    budget.events = budget.events.filter(function (event) {
      return event && typeof event.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date);
    });
    ["salary", "goal", "inflation", "horizon"].forEach(function (key) {
      if (!Number.isFinite(budget[key])) budget[key] = getEmptyBudget()[key];
    });
  } catch (error) {
    // 깨져 있으면 빈 가계부
  }
  return budget;
}

let budget = loadBudget();

function saveBudget() {
  try {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
  } catch (error) {
    alert("저장하지 못했어요. 저장 공간을 확인해 주세요.");
  }
  // 홈 등 다른 화면도 다시 계산하도록 (common.js의 saveList와 같은 신호)
  document.dispatchEvent(new CustomEvent("data-saved", { detail: { key: BUDGET_STORAGE_KEY } }));
}

// =============================================
// 3. 계산 도구
// =============================================

// 이번 달 "2026-10"
function getBudgetThisMonth() {
  return getToday().slice(0, 7); // common.js
}

// "2026-10"에 n개월 더하기
function addBudgetMonths(month, count) {
  const year = Number(month.slice(0, 4));
  const index = year * 12 + Number(month.slice(5, 7)) - 1 + count;
  return Math.floor(index / 12) + "-" + String((index % 12) + 1).padStart(2, "0");
}

// 두 달 사이 개월 수 (b - a)
function diffBudgetMonths(a, b) {
  return Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7)) - (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)));
}

// "2027-07" → "27.07"
function formatBudgetMonth(month) {
  return month.slice(2, 4) + "." + month.slice(5, 7);
}

// 원 → "18.4만" (만원 단위, 100만 넘으면 소수점 없이)
function formatBudgetMan(won) {
  const man = won / 10000;
  const abs = Math.abs(man);
  const text = abs >= 100 ? Math.round(man).toLocaleString("ko-KR") : (Math.round(man * 10) / 10).toLocaleString("ko-KR");
  return text + "만";
}

// 그달에 살아 있는 지출 항목인지 (시작·끝 달 사이)
function isBudgetItemActive(item, month) {
  return (!item.start || month >= item.start) && (!item.end || month <= item.end);
}

// 지금 자산 (다른 탭): 금융자산 합계 + 비트코인
function getBudgetAssetsNow() {
  const networth = calculateNetworth(); // networth.js
  const btc = getMyBtcHolding(); // btc.js
  return { total: networth.value, crypto: networth.cryptoValue, btcQuantity: btc.quantity, btcCost: btc.cost };
}

// 지금 비트코인 1개 가격(원)과 원/달러 환율
function getBudgetBtcPrice() {
  const fx = getMarketFx() || getBtcFxValue() || 1400; // market.js, btc-live.js
  let price = btcDomesticPrice; // btc-live.js (실시간)
  const usd = marketData && marketData.markets["BTC-USD"];
  if (!price && usd) price = usd.price * fx;
  if (!price) {
    const last = btcDailyCandles[btcDailyCandles.length - 1]; // btc-chart.js
    price = last ? last.close : 0;
  }
  return { krw: price, fx: fx, usd: price / fx };
}

// =============================================
// 4. 달마다 계산 (지금부터 목표 해 말까지)
// =============================================

// 매달: 수입, 묶음별 지출, 대출 상환, 여유돈, 쌓인 현금·저축, 부채 잔액
// → [{ month, groups: { fixed: 금액, ... }, loan, surplus, cash, saved, debt, debtByName, endings: [이름] }]
function simulateBudget(months) {
  const start = getBudgetThisMonth();
  const balances = budget.debts.map(function (debt) {
    return debt.balance;
  });
  let cash = 0; // 여유돈이 쌓인 현금 (만기 일시상환도 여기서 나감)
  let saved = 0; // 저축·투자로 모은 돈
  const rows = [];
  for (let i = 0; i < months; i++) {
    const month = addBudgetMonths(start, i);
    const groups = {};
    Object.keys(BUDGET_GROUPS).forEach(function (key) {
      groups[key] = 0;
    });
    budget.items.forEach(function (item) {
      if (isBudgetItemActive(item, month)) groups[item.group] = (groups[item.group] || 0) + item.amount;
    });

    // 대출: 원리금은 이자를 뺀 나머지만큼 잔액이 줄고, 이자만 내는 대출은 만기에 한꺼번에 갚음
    let loan = 0;
    let payoff = 0;
    budget.debts.forEach(function (debt, index) {
      if (balances[index] <= 0) return;
      const interest = (balances[index] * debt.rate) / 100 / 12;
      if (debt.kind === "amortize") {
        const pay = Math.min(debt.monthly, balances[index] + interest);
        loan = loan + pay;
        balances[index] = Math.max(0, balances[index] - (pay - interest));
      } else if (debt.kind === "equal") {
        const principal = Math.min(debt.monthly, balances[index]);
        loan = loan + principal + interest;
        balances[index] = balances[index] - principal;
      } else {
        loan = loan + interest;
      }
      // 만기 달: 남은 원금을 현금으로 한꺼번에
      if (debt.maturity && month >= debt.maturity && balances[index] > 0) {
        payoff = payoff + balances[index];
        balances[index] = 0;
      }
    });

    const spend = Object.keys(groups).reduce(function (sum, key) {
      return sum + groups[key];
    }, 0);
    const surplus = budget.salary - spend - loan;
    cash = cash + surplus - payoff;
    saved = saved + groups.saving;
    rows.push({
      month: month,
      groups: groups,
      loan: loan,
      surplus: surplus,
      cash: cash,
      saved: saved,
      debt: balances.reduce(function (sum, b) {
        return sum + b;
      }, 0),
      balances: balances.slice(),
    });
  }
  return rows;
}

// 목표 해 12월까지 몇 달인지
function getBudgetMonthsToHorizon() {
  return Math.max(1, diffBudgetMonths(getBudgetThisMonth(), budget.horizon + "-12") + 1);
}

// 비트코인 가격이 지금 → 목표 해 말 시나리오 가격까지 서서히 움직인다고 보고 순자산 길을 계산
// (원화 금액, 매달)
function getBudgetNetPath(rows, targetUsd) {
  const now = getBudgetAssetsNow();
  const price = getBudgetBtcPrice();
  const otherAssets = now.total - now.crypto; // 금융자산 + 비트코인 외 코인
  return rows.map(function (row, index) {
    const ratio = rows.length > 1 ? index / (rows.length - 1) : 1;
    const usd = price.usd + (targetUsd - price.usd) * ratio;
    return otherAssets + now.btcQuantity * usd * price.fx + row.cash + row.saved - row.debt;
  });
}

// 여유돈이 바뀌는 때: 지출이 끝나거나 대출이 끝나는 달 (지금 → 목표 해 말)
function getBudgetSteps(rows) {
  const steps = [{ month: rows[0].month, label: "지금", surplus: rows[0].surplus }];
  for (let i = 1; i < rows.length; i++) {
    if (Math.abs(rows[i].surplus - rows[i - 1].surplus) < 1000) continue;
    const reasons = [];
    budget.items.forEach(function (item) {
      if (isBudgetItemActive(item, rows[i - 1].month) && !isBudgetItemActive(item, rows[i].month)) reasons.push(item.name);
      if (!isBudgetItemActive(item, rows[i - 1].month) && isBudgetItemActive(item, rows[i].month)) reasons.push(item.name + " 시작");
    });
    // 잔액은 그달 상환 뒤 값 → 지난달에 0이 됐으면(마지막 상환) 이번 달부터 상환이 없음
    budget.debts.forEach(function (debt, index) {
      const before = i >= 2 ? rows[i - 2].balances[index] : debt.balance;
      if (before > 0 && rows[i - 1].balances[index] <= 0) reasons.push(debt.name);
    });
    steps.push({ month: rows[i].month, label: reasons.join(" · ") || "변동", surplus: rows[i].surplus });
  }
  return steps;
}

// =============================================
// 5. 화면 요소
// =============================================

const budgetEmpty = document.getElementById("budget-empty");
const budgetContent = document.getElementById("budget-content");
const budgetRingBar = document.getElementById("budget-ring-bar");
const budgetRingPct = document.getElementById("budget-ring-pct");
const budgetRingGoal = document.getElementById("budget-ring-goal");
const budgetNetText = document.getElementById("budget-net");
const budgetHeroKpis = document.getElementById("budget-hero-kpis");
const budgetFlowBar = document.getElementById("budget-flow-bar");
const budgetFlowLegend = document.getElementById("budget-flow-legend");
const budgetFlowTitle = document.getElementById("budget-flow-title");
const budgetFlowNote = document.getElementById("budget-flow-note");
const budgetStepList = document.getElementById("budget-steps");
const budgetDebtKpis = document.getElementById("budget-debt-kpis");
const budgetLadder = document.getElementById("budget-ladder");
const budgetDebtChart = document.getElementById("budget-debt-chart");
const budgetDebtLegend = document.getElementById("budget-debt-legend");
const budgetFutureCards = document.getElementById("budget-future-cards");
const budgetNetChart = document.getElementById("budget-net-chart");
const budgetNetLegend = document.getElementById("budget-net-legend");
const budgetNetReadout = document.getElementById("budget-net-readout");
const budgetRealTable = document.getElementById("budget-real-body");
const budgetBtcTable = document.getElementById("budget-btc-body");
const budgetBtcGoal = document.getElementById("budget-btc-goal");
const budgetEventList = document.getElementById("budget-events");

// 편집 폼
const budgetSalaryInput = document.getElementById("budget-salary");
const budgetSettingsForm = document.getElementById("budget-settings-form");
const budgetItemList = document.getElementById("budget-item-list");
const budgetItemForm = document.getElementById("budget-item-form");
const budgetDebtList = document.getElementById("budget-debt-list");
const budgetDebtForm = document.getElementById("budget-debt-form");
const budgetEventForm = document.getElementById("budget-event-form");
const budgetCustomEventList = document.getElementById("budget-custom-events");

let budgetEditing = { item: null, debt: null, event: null }; // 수정 중인 항목 id

// =============================================
// 6. 화면 그리기 — 위쪽 요약(순자산 고리)
// =============================================

function renderBudgetHero(rows) {
  const now = getBudgetAssetsNow();
  const debt = rows[0] ? budget.debts.reduce(function (sum, d) {
    return sum + d.balance;
  }, 0) : 0;
  const net = now.total - debt;
  const pct = budget.goal > 0 ? Math.max(0, (net / budget.goal) * 100) : 0;
  const circumference = 2 * Math.PI * 54;
  budgetRingBar.style.strokeDasharray = circumference;
  budgetRingBar.style.strokeDashoffset = circumference * (1 - Math.min(1, pct / 100));
  budgetRingPct.textContent = pct.toFixed(1) + "%";
  budgetRingGoal.textContent = "순자산 " + formatKoreanUnit(budget.goal).replace("원", "") + "까지";
  budgetNetText.textContent = formatBudgetMan(net) + "원";

  budgetHeroKpis.innerHTML = "";
  [
    ["총 자산", formatBudgetMan(now.total), ""],
    ["총 부채", formatBudgetMan(debt), "profit-down"],
    ["월 여유돈", rows[0] ? formatBudgetMan(rows[0].surplus) : "-", rows[0] && rows[0].surplus >= 0 ? "profit-up" : "profit-down"],
  ].forEach(function (item) {
    const div = document.createElement("div");
    div.className = "budget-kpi";
    const label = document.createElement("p");
    label.className = "btc-tile-name";
    label.textContent = item[0];
    const value = document.createElement("p");
    value.className = "budget-kpi-value " + item[2];
    value.textContent = item[1];
    div.append(label, value);
    budgetHeroKpis.appendChild(div);
  });
}

// =============================================
// 7. 현황: 이번 달 돈의 흐름 + 여유돈이 늘어나는 순서
// =============================================

function renderBudgetFlow(rows) {
  const row = rows[0];
  budgetFlowTitle.textContent = "세후 " + formatBudgetMan(budget.salary) + "원 기준";
  const parts = Object.keys(BUDGET_GROUPS)
    .map(function (key) {
      return { name: BUDGET_GROUPS[key].name, value: row.groups[key], color: BUDGET_GROUPS[key].color };
    })
    .concat([
      { name: "대출 상환·이자", value: row.loan, color: BUDGET_LOAN_COLOR },
      { name: "여유", value: Math.max(0, row.surplus), color: BUDGET_SURPLUS_COLOR },
    ])
    .filter(function (part) {
      return part.value > 0;
    });
  budgetFlowBar.innerHTML = "";
  budgetFlowLegend.innerHTML = "";
  const base = Math.max(budget.salary, 1);
  parts.forEach(function (part) {
    const piece = document.createElement("span");
    piece.style.width = (part.value / base) * 100 + "%";
    piece.style.background = part.color;
    piece.title = part.name + " " + formatBudgetMan(part.value);
    budgetFlowBar.appendChild(piece);

    const li = document.createElement("li");
    const key = document.createElement("span");
    key.className = "alloc-swatch";
    key.style.background = part.color;
    const name = document.createElement("span");
    name.className = "alloc-name";
    name.textContent = part.name + " " + Math.round((part.value / base) * 100) + "%";
    const value = document.createElement("span");
    value.className = "alloc-amount";
    value.textContent = formatBudgetMan(part.value);
    li.append(key, name, value);
    budgetFlowLegend.appendChild(li);
  });
  budgetFlowNote.className = "budget-note" + (row.surplus < 100000 ? " warn" : "");
  budgetFlowNote.textContent =
    row.surplus < 0
      ? "이번 달은 " + formatBudgetMan(-row.surplus) + "원 적자예요. 지출이나 저축을 조금 줄여 보세요."
      : "이번 달 여유 " + formatBudgetMan(row.surplus) + "원 (저축·투자 " + formatBudgetMan(row.groups.saving) + "원은 따로)" +
        (row.surplus < 100000 ? " · 여유가 10만 원도 안 돼요." : "");

  // 여유돈이 늘어나는 순서
  budgetStepList.innerHTML = "";
  const steps = getBudgetSteps(rows);
  const max = Math.max.apply(
    null,
    steps.map(function (step) {
      return Math.abs(step.surplus);
    }).concat([1])
  );
  steps.forEach(function (step) {
    const li = document.createElement("li");
    li.className = "budget-step";
    const when = document.createElement("span");
    when.className = "budget-step-month";
    when.textContent = step.label === "지금" ? "지금" : formatBudgetMonth(step.month);
    const label = document.createElement("span");
    label.className = "budget-step-label";
    label.textContent = step.label === "지금" ? "지금 설정" : step.label;
    const track = document.createElement("span");
    track.className = "budget-step-track";
    const fill = document.createElement("span");
    fill.className = "budget-step-fill";
    fill.style.width = Math.max(0, (step.surplus / max) * 100) + "%";
    track.appendChild(fill);
    const value = document.createElement("span");
    value.className = "budget-step-value " + (step.surplus >= 0 ? "profit-up" : "profit-down");
    value.textContent = formatBudgetMan(step.surplus);
    li.append(when, label, track, value);
    budgetStepList.appendChild(li);
  });
}

// =============================================
// 8. 부채: 사다리 + 잔액이 줄어드는 모습
// =============================================

// 금리가 높을수록 진한 색 (무이자는 보라)
function getBudgetRateColor(rate) {
  if (rate === 0) return "#6250d6";
  if (rate >= 6) return "#e34948";
  if (rate >= 5) return "#eb6834";
  return "#2a78d6";
}

function renderBudgetDebts(rows) {
  const debts = budget.debts;
  const total = debts.reduce(function (sum, d) {
    return sum + d.balance;
  }, 0);
  const yearlyInterest = debts.reduce(function (sum, d) {
    return sum + (d.balance * d.rate) / 100;
  }, 0);
  const priciest = debts.slice().sort(function (a, b) {
    return b.rate - a.rate;
  })[0];
  const lump = debts
    .filter(function (d) {
      return d.kind === "interest";
    })
    .reduce(function (sum, d) {
      return sum + d.balance;
    }, 0);

  budgetDebtKpis.innerHTML = "";
  [
    ["총 부채", formatBudgetMan(total), debts.length + "건"],
    ["연 이자 합계", formatBudgetMan(yearlyInterest), "지금 잔액 기준"],
    ["가장 비싼 빚", priciest ? priciest.rate + "%" : "-", priciest ? priciest.name + " · 먼저 갚기" : ""],
    ["만기 일시상환", formatBudgetMan(lump), "이자만 내는 대출"],
  ].forEach(function (item) {
    const card = document.createElement("div");
    card.className = "summary-card";
    const name = document.createElement("p");
    name.textContent = item[0];
    const value = document.createElement("p");
    value.textContent = item[1];
    const sub = document.createElement("p");
    sub.className = "btc-card-sub";
    sub.textContent = item[2];
    card.append(name, value, sub);
    budgetDebtKpis.appendChild(card);
  });

  // 사다리: 막대 길이 = 잔액, 색 = 금리
  budgetLadder.innerHTML = "";
  const max = Math.max.apply(
    null,
    debts.map(function (d) {
      return d.balance;
    }).concat([1])
  );
  debts
    .slice()
    .sort(function (a, b) {
      return b.balance - a.balance;
    })
    .forEach(function (debt) {
      const li = document.createElement("li");
      li.className = "budget-ladder-row";
      const name = document.createElement("span");
      name.className = "budget-ladder-name";
      name.textContent = debt.name;
      const sub = document.createElement("small");
      sub.textContent = BUDGET_DEBT_KINDS[debt.kind] + " · " + debt.rate + "%";
      name.appendChild(sub);
      const track = document.createElement("span");
      track.className = "budget-ladder-track";
      const fill = document.createElement("span");
      fill.className = "budget-ladder-fill";
      fill.style.width = (debt.balance / max) * 100 + "%";
      fill.style.background = getBudgetRateColor(debt.rate);
      const label = document.createElement("em");
      label.textContent = formatBudgetMan(debt.balance);
      track.append(fill, label);
      const end = document.createElement("span");
      end.className = "budget-ladder-end";
      end.textContent = debt.maturity ? formatBudgetMonth(debt.maturity) : "-";
      const endSub = document.createElement("small");
      endSub.textContent = "만기";
      end.appendChild(endSub);
      li.append(name, track, end);
      budgetLadder.appendChild(li);
    });

  renderBudgetDebtChart();
}

// 해마다 1월의 부채 잔액을 쌓은 막대 (대출마다 색, 지금부터 마지막 만기 해까지)
function renderBudgetDebtChart() {
  budgetDebtChart.innerHTML = "";
  budgetDebtLegend.innerHTML = "";
  if (budget.debts.length === 0) return;
  const lastMaturity = budget.debts.reduce(function (latest, d) {
    return d.maturity && d.maturity > latest ? d.maturity : latest;
  }, getBudgetThisMonth());
  const months = Math.min(240, diffBudgetMonths(getBudgetThisMonth(), lastMaturity) + 2);
  const rows = simulateBudget(months);
  // 지금 + 매년 1월
  const picks = rows.filter(function (row, index) {
    return index === 0 || row.month.slice(5) === "01";
  });
  const palette = ["#2a78d6", "#e34948", "#eb6834", "#1baf7a", "#eda100", "#6250d6", "#e87ba4", "#008300"];
  const width = 340;
  const height = 200;
  const left = 40;
  const bottom = 22;
  const top = 8;
  const plotHeight = height - top - bottom;
  const max = niceMax(picks[0].debt / 10000) * 10000; // history.js
  const slot = (width - left - 6) / picks.length;
  for (let i = 0; i <= 4; i++) {
    const value = (max / 4) * i;
    const y = top + plotHeight - (value / max) * plotHeight;
    budgetDebtChart.appendChild(createSvg("line", { x1: left, x2: width - 6, y1: y, y2: y, class: "chart-grid" }));
    const label = createSvg("text", { x: left - 4, y: y + 3, class: "chart-axis-label", "text-anchor": "end" });
    label.textContent = Math.round(value / 10000).toLocaleString("ko-KR") + "만";
    budgetDebtChart.appendChild(label);
  }
  picks.forEach(function (row, index) {
    let base = top + plotHeight;
    const x = left + slot * index + slot * 0.18;
    const w = slot * 0.64;
    row.balances.forEach(function (balance, debtIndex) {
      if (balance <= 0) return;
      const h = (balance / max) * plotHeight;
      const rect = createSvg("rect", { x: x, y: base - h, width: w, height: Math.max(0, h - 1), fill: palette[debtIndex % palette.length] });
      const tip = createSvg("title", {});
      tip.textContent = row.month.replace("-", ".") + " " + budget.debts[debtIndex].name + " " + formatBudgetMan(balance);
      rect.appendChild(tip);
      budgetDebtChart.appendChild(rect);
      base = base - h;
    });
    const label = createSvg("text", { x: x + w / 2, y: height - 7, class: "chart-axis-label", "text-anchor": "middle" });
    label.textContent = index === 0 ? "지금" : "'" + row.month.slice(2, 4);
    budgetDebtChart.appendChild(label);
  });
  budget.debts.forEach(function (debt, index) {
    const li = document.createElement("li");
    const key = document.createElement("span");
    key.className = "legend-line";
    key.style.background = palette[index % palette.length];
    key.style.height = "8px";
    key.style.width = "8px";
    li.append(key, debt.name);
    budgetDebtLegend.appendChild(li);
  });
}

// =============================================
// 9. 미래: 순자산이 자라는 길 · 물가 반영 · 목표 비트코인 가격
// =============================================

const BUDGET_SCENARIO_LINES = [
  { key: "low", name: "보수", color: "#e34948" },
  { key: "base", name: "기본", color: "#2a78d6" },
  { key: "high", name: "낙관", color: "#1baf7a" },
];
let budgetNetPaths = null;
let budgetNetRows = null;
let budgetNetScale = null;

function renderBudgetFuture(rows) {
  const now = getBudgetAssetsNow();
  const price = getBudgetBtcPrice();
  budgetNetRows = rows;
  budgetNetPaths = {};
  BUDGET_SCENARIO_LINES.forEach(function (line) {
    budgetNetPaths[line.key] = getBudgetNetPath(rows, budget.scenarios[line.key]);
  });

  // 순자산 길 차트
  budgetNetChart.innerHTML = "";
  const width = 340;
  const height = 220;
  const left = 46;
  const right = 8;
  const top = 10;
  const bottom = 24;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  let min = 0;
  let max = budget.goal;
  BUDGET_SCENARIO_LINES.forEach(function (line) {
    budgetNetPaths[line.key].forEach(function (value) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
  });
  const yMax = niceMax(max / 10000) * 10000;
  const yMin = min < 0 ? -niceMax(-min / 10000) * 10000 : 0;
  function x(index) {
    return left + (rows.length > 1 ? (index / (rows.length - 1)) * plotWidth : plotWidth / 2);
  }
  function y(value) {
    return top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
  }
  budgetNetScale = { x: x, y: y };
  for (let i = 0; i <= 4; i++) {
    const value = yMin + ((yMax - yMin) / 4) * i;
    budgetNetChart.appendChild(createSvg("line", { x1: left, x2: width - right, y1: y(value), y2: y(value), class: "chart-grid" }));
    const label = createSvg("text", { x: left - 4, y: y(value) + 3, class: "chart-axis-label", "text-anchor": "end" });
    label.textContent = formatAxisValue(Math.abs(value)).replace(/^/, value < 0 ? "-" : ""); // history.js
    budgetNetChart.appendChild(label);
  }
  // 목표선
  if (budget.goal > 0 && budget.goal <= yMax) {
    budgetNetChart.appendChild(createSvg("line", { x1: left, x2: width - right, y1: y(budget.goal), y2: y(budget.goal), class: "btc-avg-line" }));
    const goalLabel = createSvg("text", { x: left + 2, y: y(budget.goal) - 4, class: "btc-avg-label" });
    goalLabel.textContent = "목표 " + formatAxisValue(budget.goal);
    budgetNetChart.appendChild(goalLabel);
  }
  // 해 바뀌는 곳 글자
  rows.forEach(function (row, index) {
    // "지금"과 너무 가까운 해 글자는 겹치므로 뺌
    if (index === 0 || (row.month.slice(5) === "01" && index >= 5)) {
      const label = createSvg("text", { x: x(index), y: height - 8, class: "chart-axis-label", "text-anchor": index === 0 ? "start" : "middle" });
      label.textContent = index === 0 ? "지금" : row.month.slice(0, 4);
      budgetNetChart.appendChild(label);
    }
  });
  BUDGET_SCENARIO_LINES.forEach(function (line) {
    const points = budgetNetPaths[line.key]
      .map(function (value, index) {
        return x(index).toFixed(1) + "," + y(value).toFixed(1);
      })
      .join(" ");
    budgetNetChart.appendChild(createSvg("polyline", { points: points, class: "chart-line" + (line.key === "base" ? " budget-line-base" : ""), stroke: line.color }));
  });
  budgetNetChart.appendChild(createSvg("line", { id: "budget-net-cross", y1: top, y2: top + plotHeight, class: "chart-crosshair" }));
  budgetNetChart.appendChild(createSvg("g", { id: "budget-net-dots" }));

  budgetNetLegend.innerHTML = "";
  BUDGET_SCENARIO_LINES.forEach(function (line) {
    const li = document.createElement("li");
    const key = document.createElement("span");
    key.className = "legend-line";
    key.style.background = line.color;
    li.append(key, line.name + " $" + Math.round(budget.scenarios[line.key] / 1000).toLocaleString("ko-KR") + "K");
    budgetNetLegend.appendChild(li);
  });
  selectBudgetNetIndex(rows.length - 1);

  // 핵심 시점 카드: 지금 / 각 해 말
  budgetFutureCards.innerHTML = "";
  const last = rows.length - 1;
  [
    ["이번 달 말", 0],
    [rows[last].month.slice(0, 4) + "년 말", last],
  ].forEach(function (pair) {
    const index = pair[1];
    const card = document.createElement("div");
    card.className = "budget-pj";
    const title = document.createElement("h3");
    title.textContent = pair[0];
    card.appendChild(title);
    [
      ["월 여유돈", formatBudgetMan(rows[index].surplus)],
      ["남은 부채", formatBudgetMan(rows[index].debt)],
      ["모은 돈 (여유+저축)", formatBudgetMan(rows[index].cash + rows[index].saved)],
    ]
      .concat(
        BUDGET_SCENARIO_LINES.map(function (line) {
          return ["순자산 · " + line.name, formatBudgetMan(budgetNetPaths[line.key][index])];
        })
      )
      .forEach(function (item) {
        const p = document.createElement("p");
        p.className = "budget-pj-row";
        const name = document.createElement("span");
        name.textContent = item[0];
        const value = document.createElement("strong");
        value.textContent = item[1];
        p.append(name, value);
        card.appendChild(p);
      });
    budgetFutureCards.appendChild(card);
  });

  // 명목 vs 물가 반영 (해마다 12월, 기본 시나리오)
  budgetRealTable.innerHTML = "";
  rows.forEach(function (row, index) {
    if (row.month.slice(5) !== "12" && index !== 0) return;
    const years = index / 12;
    const nominal = budgetNetPaths.base[index];
    const real = nominal / Math.pow(1 + budget.inflation / 100, years);
    const tr = document.createElement("tr");
    [index === 0 ? "이번 달 말" : row.month.slice(0, 4) + "년 말", formatBudgetMan(nominal), formatBudgetMan(real)].forEach(function (text, i) {
      const cell = document.createElement(i === 0 ? "th" : "td");
      if (i === 0) cell.scope = "row";
      cell.textContent = text;
      tr.appendChild(cell);
    });
    budgetRealTable.appendChild(tr);
  });

  // 목표가별 손익 (내 비트코인 기준)
  budgetBtcTable.innerHTML = "";
  const debtNow = budget.debts.reduce(function (sum, d) {
    return sum + d.balance;
  }, 0);
  const nonBtcNow = now.total - now.crypto - debtNow;
  const targets = [Math.round(price.usd / 1000) * 1000, 100000, 150000, 200000, 230000, 300000, 500000, 1000000];
  targets.forEach(function (usd, i) {
    const value = now.btcQuantity * usd * price.fx;
    const profit = value - now.btcCost;
    const tr = document.createElement("tr");
    if (i === 0) tr.className = "budget-row-now";
    const cells = [
      (usd >= 1000000 ? "$" + usd / 1000000 + "M" : "$" + Math.round(usd / 1000) + "K") + (i === 0 ? " 지금" : ""),
      formatBudgetMan(value),
      (profit >= 0 ? "+" : "") + formatBudgetMan(profit),
      now.btcCost > 0 ? formatPercent((profit / now.btcCost) * 100) : "-",
      formatBudgetMan(nonBtcNow + value),
    ];
    cells.forEach(function (text, index) {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      cell.textContent = text;
      if (index === 2 || index === 3) cell.className = getProfitClass(profit);
      tr.appendChild(cell);
    });
    budgetBtcTable.appendChild(tr);
  });

  // 순자산 목표에 필요한 비트코인 가격: 지금 구조 / 목표 해 말 구조
  budgetBtcGoal.textContent = "";
  if (now.btcQuantity > 0 && budget.goal > 0) {
    const needNow = (budget.goal - nonBtcNow) / (now.btcQuantity * price.fx);
    const nonBtcEnd = budgetNetPaths.base[last] - now.btcQuantity * budget.scenarios.base * price.fx;
    const needEnd = (budget.goal - nonBtcEnd) / (now.btcQuantity * price.fx);
    budgetBtcGoal.append("순자산 " + formatKoreanUnit(budget.goal) + "까지 비트코인 가격이 지금 구조면 ");
    const a = document.createElement("strong");
    a.textContent = "$" + Math.max(0, Math.round(needNow / 1000)).toLocaleString("ko-KR") + "K";
    const b = document.createElement("strong");
    b.textContent = "$" + Math.max(0, Math.round(needEnd / 1000)).toLocaleString("ko-KR") + "K";
    budgetBtcGoal.append(a, ", 부채·저축이 정리된 " + rows[last].month.slice(0, 4) + "년 말이면 ", b, " 필요해요. (내 비트코인 " + formatNumber(now.btcQuantity) + "개 기준)");
  }
}

function selectBudgetNetIndex(index) {
  if (!budgetNetRows || !budgetNetScale || !budgetNetRows[index]) return;
  const cx = budgetNetScale.x(index);
  const cross = document.getElementById("budget-net-cross");
  cross.setAttribute("x1", cx);
  cross.setAttribute("x2", cx);
  const dots = document.getElementById("budget-net-dots");
  dots.innerHTML = "";
  budgetNetReadout.innerHTML = "";
  const title = document.createElement("span");
  title.className = "readout-title";
  title.textContent = budgetNetRows[index].month.replace("-", "년 ") + "월";
  budgetNetReadout.appendChild(title);
  BUDGET_SCENARIO_LINES.forEach(function (line) {
    const value = budgetNetPaths[line.key][index];
    dots.appendChild(createSvg("circle", { cx: cx, cy: budgetNetScale.y(value), r: 4, fill: line.color, class: "chart-dot" }));
    const item = document.createElement("span");
    item.className = "readout-item";
    const key = document.createElement("span");
    key.className = "readout-key";
    key.style.background = line.color;
    const strong = document.createElement("strong");
    strong.textContent = formatBudgetMan(value);
    const name = document.createElement("span");
    name.className = "readout-name";
    name.textContent = line.name;
    item.append(key, strong, name);
    budgetNetReadout.appendChild(item);
  });
}

// =============================================
// 10. 이벤트: 지출·대출이 끝나는 날 + 반감기 + 직접 넣은 일
// =============================================

function getBudgetEvents(rows) {
  const events = [];
  const thisMonth = getBudgetThisMonth();
  budget.items.forEach(function (item) {
    if (item.end && item.end >= thisMonth) {
      events.push({ date: addBudgetMonths(item.end, 1) + "-01", title: item.name + " 끝", note: "+" + formatBudgetMan(item.amount) + " 여유", kind: "up" });
    }
    if (item.start && item.start > thisMonth) {
      events.push({ date: item.start + "-01", title: item.name + " 시작", note: "-" + formatBudgetMan(item.amount) + "/월", kind: "" });
    }
  });
  budget.debts.forEach(function (debt) {
    if (!debt.maturity || debt.maturity < thisMonth) return;
    events.push({
      date: debt.maturity + "-28",
      title: debt.name + (debt.kind === "interest" ? " 만기" : " 완납"),
      note: debt.kind === "interest" ? formatBudgetMan(debt.balance) + " 일시상환 (또는 연장) · 이자 끝" : "+" + formatBudgetMan(debt.monthly) + " 여유",
      kind: debt.kind === "interest" ? "" : "up",
    });
  });
  if (BUDGET_HALVING_MONTH >= thisMonth) {
    events.push({ date: BUDGET_HALVING_MONTH + "-15", title: "비트코인 반감기 (예상)", note: "채굴 보상 3.125 → 1.5625 BTC", kind: "btc" });
  }
  budget.events.forEach(function (event) {
    events.push({ date: event.date, title: event.title, note: event.note, kind: "custom", id: event.id });
  });
  return events.sort(function (a, b) {
    return a.date.localeCompare(b.date);
  });
}

function renderBudgetEvents(rows) {
  budgetEventList.innerHTML = "";
  const today = getToday();
  let nextMarked = false;
  getBudgetEvents(rows).forEach(function (event) {
    const li = document.createElement("li");
    li.className = "budget-event" + (event.date < today ? " past" : "");
    const date = document.createElement("span");
    date.className = "budget-event-date";
    date.textContent = event.date.slice(2, 7).replace("-", ".");
    const body = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = event.title;
    body.appendChild(title);
    if (!nextMarked && event.date >= today) {
      nextMarked = true;
      date.classList.add("next");
      const dday = document.createElement("span");
      dday.className = "budget-dday";
      dday.textContent = "D-" + Math.max(0, Math.round((new Date(event.date) - new Date(today)) / 86400000));
      body.appendChild(dday);
    }
    const note = document.createElement("small");
    note.className = event.kind === "up" ? "profit-up" : "";
    note.textContent = event.note || "";
    body.appendChild(note);
    li.append(date, body);
    budgetEventList.appendChild(li);
  });
}

// =============================================
// 11. 편집: 월급·설정, 지출 항목, 부채, 직접 넣는 이벤트
// =============================================

function fillBudgetSettings() {
  budgetSalaryInput.value = budget.salary || "";
  budgetSettingsForm.elements.goal.value = budget.goal || "";
  budgetSettingsForm.elements.inflation.value = budget.inflation;
  budgetSettingsForm.elements.horizon.value = budget.horizon;
  budgetSettingsForm.elements.low.value = budget.scenarios.low;
  budgetSettingsForm.elements.base.value = budget.scenarios.base;
  budgetSettingsForm.elements.high.value = budget.scenarios.high;
}

// 목록 한 줄 (이름 · 설명 · 금액 · 수정/삭제)
function createBudgetRow(title, sub, amount, onEdit, onDelete) {
  const li = document.createElement("li");
  li.className = "budget-edit-row";
  const text = document.createElement("span");
  text.className = "budget-edit-text";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = sub;
  text.append(strong, small);
  const value = document.createElement("span");
  value.className = "budget-edit-amount";
  value.textContent = amount;
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "edit-btn";
  edit.textContent = "수정";
  edit.addEventListener("click", onEdit);
  const del = document.createElement("button");
  del.type = "button";
  del.className = "delete-btn";
  del.textContent = "삭제";
  del.addEventListener("click", function () {
    if (confirm(title + "\n삭제할까요?")) onDelete();
  });
  li.append(text, value, edit, del);
  return li;
}

function renderBudgetEditors() {
  // 지출 항목 (묶음 순서대로)
  budgetItemList.innerHTML = "";
  const thisMonth = getBudgetThisMonth();
  Object.keys(BUDGET_GROUPS).forEach(function (group) {
    budget.items
      .filter(function (item) {
        return item.group === group;
      })
      .forEach(function (item) {
        const period = (item.start ? formatBudgetMonth(item.start) + "부터 " : "") + (item.end ? formatBudgetMonth(item.end) + "까지" : "");
        const ended = item.end && item.end < thisMonth;
        budgetItemList.appendChild(
          createBudgetRow(
            item.name + (ended ? " (끝남)" : ""),
            BUDGET_GROUPS[group].name + (period ? " · " + period : " · 계속"),
            formatBudgetMan(item.amount),
            function () {
              startBudgetEdit("item", item);
            },
            function () {
              budget.items = budget.items.filter(function (x) {
                return x.id !== item.id;
              });
              saveBudget();
              renderBudget();
            }
          )
        );
      });
  });
  // 부채
  budgetDebtList.innerHTML = "";
  budget.debts.forEach(function (debt) {
    budgetDebtList.appendChild(
      createBudgetRow(
        debt.name,
        BUDGET_DEBT_KINDS[debt.kind] + " · " + debt.rate + "% · " +
          (debt.kind === "interest" ? "월 이자 " + formatBudgetMan((debt.balance * debt.rate) / 1200) : "월 " + (debt.kind === "equal" ? "원금 " : "") + formatBudgetMan(debt.monthly)) + (debt.maturity ? " · " + formatBudgetMonth(debt.maturity) + " 만기" : ""),
        formatBudgetMan(debt.balance),
        function () {
          startBudgetEdit("debt", debt);
        },
        function () {
          budget.debts = budget.debts.filter(function (x) {
            return x.id !== debt.id;
          });
          saveBudget();
          renderBudget();
        }
      )
    );
  });
  // 직접 넣은 이벤트
  budgetCustomEventList.innerHTML = "";
  budget.events.forEach(function (event) {
    budgetCustomEventList.appendChild(
      createBudgetRow(
        event.title,
        event.note || "",
        event.date.replace(/-/g, "."),
        function () {
          startBudgetEdit("event", event);
        },
        function () {
          budget.events = budget.events.filter(function (x) {
            return x.id !== event.id;
          });
          saveBudget();
          renderBudget();
        }
      )
    );
  });
}

const BUDGET_FORMS = { item: budgetItemForm, debt: budgetDebtForm, event: budgetEventForm };

// 수정 시작: 폼에 값을 채우고 버튼 글자를 "수정 완료"로
function startBudgetEdit(type, target) {
  const form = BUDGET_FORMS[type];
  budgetEditing[type] = target.id;
  Object.keys(target).forEach(function (key) {
    if (form.elements[key] && key !== "id") form.elements[key].value = target[key] === undefined ? "" : target[key];
  });
  form.querySelector("[type=submit]").textContent = "수정 완료";
  form.querySelector(".budget-cancel").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetBudgetForm(type) {
  const form = BUDGET_FORMS[type];
  form.reset();
  budgetEditing[type] = null;
  form.querySelector("[type=submit]").textContent = "추가";
  form.querySelector(".budget-cancel").hidden = true;
}

// 폼 값 → 항목 (문제가 있으면 안내 문구를 던짐)
function readBudgetForm(type) {
  const f = BUDGET_FORMS[type].elements;
  const num = function (name) {
    return f[name].value.trim() === "" ? NaN : Number(f[name].value);
  };
  const month = function (name) {
    const value = f[name].value;
    return /^\d{4}-\d{2}$/.test(value) ? value : "";
  };
  const id = budgetEditing[type] || String(Date.now());
  if (type === "item") {
    const item = { id: id, name: f.name.value.trim(), amount: num("amount"), group: f.group.value, start: month("start"), end: month("end") };
    if (!item.name) throw new Error("이름을 넣어 주세요.");
    if (!(item.amount >= 0)) throw new Error("금액을 0 이상으로 넣어 주세요.");
    if (item.start && item.end && item.end < item.start) throw new Error("끝나는 달이 시작보다 빨라요.");
    return item;
  }
  if (type === "debt") {
    const debt = { id: id, name: f.name.value.trim(), balance: num("balance"), rate: num("rate"), kind: f.kind.value, monthly: num("monthly"), maturity: month("maturity") };
    if (!debt.name) throw new Error("이름을 넣어 주세요.");
    if (!(debt.balance >= 0) || !(debt.rate >= 0) || !(debt.monthly >= 0)) throw new Error("잔액·금리·월 상환액을 0 이상으로 넣어 주세요.");
    if (debt.kind === "interest" && !debt.maturity) throw new Error("이자만 내는 대출은 만기 달을 넣어 주세요.");
    return debt;
  }
  const event = { id: id, date: f.date.value, title: f.title.value.trim(), note: f.note.value.trim() };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !event.title) throw new Error("날짜와 제목을 넣어 주세요.");
  return event;
}

function setupBudgetForm(type, listName) {
  const form = BUDGET_FORMS[type];
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    let entry;
    try {
      entry = readBudgetForm(type);
    } catch (error) {
      alert(error.message);
      return;
    }
    const list = budget[listName];
    const index = list.findIndex(function (x) {
      return x.id === entry.id;
    });
    if (index === -1) list.push(entry);
    else list[index] = entry;
    saveBudget();
    resetBudgetForm(type);
    renderBudget();
  });
  form.querySelector(".budget-cancel").addEventListener("click", function () {
    resetBudgetForm(type);
  });
}

// =============================================
// 12. 전체 그리기
// =============================================

function renderBudget() {
  const hasData = budget.salary > 0 || budget.items.length > 0 || budget.debts.length > 0;
  budgetEmpty.hidden = hasData;
  budgetContent.hidden = !hasData;
  renderBudgetEditors();
  if (!hasData) return;
  const rows = simulateBudget(getBudgetMonthsToHorizon());
  renderBudgetHero(rows);
  renderBudgetFlow(rows);
  renderBudgetDebts(rows);
  renderBudgetFuture(rows);
  renderBudgetEvents(rows);
}

// =============================================
// 13. 이벤트 처리
// =============================================

budgetSalaryInput.addEventListener("change", function () {
  const value = Number(budgetSalaryInput.value);
  if (!(value >= 0)) {
    alert("월급은 0 이상으로 넣어 주세요.");
    return;
  }
  budget.salary = value;
  saveBudget();
  renderBudget();
});

budgetSettingsForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const f = budgetSettingsForm.elements;
  const values = { goal: Number(f.goal.value), inflation: Number(f.inflation.value), horizon: Number(f.horizon.value), low: Number(f.low.value), base: Number(f.base.value), high: Number(f.high.value) };
  const thisYear = new Date().getFullYear();
  if (!(values.goal >= 0) || !(values.inflation >= 0 && values.inflation <= 30) || !(values.horizon >= thisYear && values.horizon <= thisYear + 30) ||
    !(values.low > 0 && values.base > 0 && values.high > 0)) {
    alert("목표는 0 이상, 물가는 0~30%, 마지막 해는 " + thisYear + "~" + (thisYear + 30) + ", 비트코인 가격은 0보다 크게 넣어 주세요.");
    return;
  }
  budget.goal = values.goal;
  budget.inflation = values.inflation;
  budget.horizon = Math.round(values.horizon);
  budget.scenarios = { low: values.low, base: values.base, high: values.high };
  saveBudget();
  renderBudget();
  alert("설정을 저장했어요.");
});

setupBudgetForm("item", "items");
setupBudgetForm("debt", "debts");
setupBudgetForm("event", "events");

["pointerdown", "pointermove"].forEach(function (type) {
  budgetNetChart.addEventListener(type, function (event) {
    if (type === "pointermove" && event.pointerType !== "mouse" && event.buttons === 0) return;
    if (!budgetNetRows) return;
    const rect = budgetNetChart.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * 340;
    const index = Math.round(((svgX - 46) / (340 - 46 - 8)) * (budgetNetRows.length - 1));
    selectBudgetNetIndex(Math.min(Math.max(index, 0), budgetNetRows.length - 1));
  });
});

// 자산·시세가 바뀌면 순자산 다시 (가계부 자기 저장 신호는 이미 다시 그렸으니 빼고)
document.addEventListener("data-saved", function (event) {
  if (event.detail.key !== BUDGET_STORAGE_KEY) renderBudget();
});
document.addEventListener("market-updated", renderBudget);

// 시작
fillBudgetSettings();
setupSubTabs("budget", "now"); // common.js
renderBudget();
