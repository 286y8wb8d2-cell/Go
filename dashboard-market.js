// =============================================
// 홈(대시보드) — 시장 한눈에 · 최근 거래일 내 자산 변동 · 자산 목표
// 시세는 market.js (6시간마다 모아 두는 market-data.json)
// ※ 이름은 모두 dash~ / DASH~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 홈에 보여 줄 시장 지표 (시세 파일의 markets 이름)
const DASH_MARKET_TILES = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "나스닥" },
  { symbol: "^KS11", name: "코스피" },
  { symbol: "KRW=X", name: "원/달러", unit: "원" },
  { symbol: "^TNX", name: "미국 10년 금리", unit: "%" },
  { symbol: "BTC-USD", name: "비트코인", unit: "$" },
];

const DASH_GOAL_KEY = "household-goal"; // 예전 홈 목표 { amount } — 지금은 가계부 목표(household-budget.goal)를 씀, 옛 백업용

// =============================================
// 2. 화면 요소
// =============================================

const dashToday = document.getElementById("dash-today");
const dashMarketTiles = document.getElementById("dash-market-tiles");
const dashMarketNote = document.getElementById("dash-market-note");
const dashGoalForm = document.getElementById("dash-goal-form");
const dashGoalInput = document.getElementById("dash-goal-input");
const dashGoalBar = document.getElementById("dash-goal-bar");
const dashGoalText = document.getElementById("dash-goal-text");
const dashGoalSub = document.getElementById("dash-goal-sub");

// =============================================
// 3. 계산
// =============================================

// 목표는 하나: 가계부의 "순자산 목표"와 같은 값 (household-budget.goal)
// 가계부를 아직 저장한 적 없으면 예전 홈 목표(household-goal)를 씀
function loadDashGoal() {
  try {
    const budgetSaved = JSON.parse(localStorage.getItem("household-budget"));
    if (budgetSaved && Number.isFinite(budgetSaved.goal)) return budgetSaved.goal > 0 ? budgetSaved.goal : 0;
    const saved = JSON.parse(localStorage.getItem(DASH_GOAL_KEY));
    if (saved && Number.isFinite(saved.amount) && saved.amount > 0) return saved.amount;
  } catch (error) {
    // 깨져 있으면 목표 없음
  }
  return 0;
}

// 최근 거래일에 내 자산이 얼마나 움직였는지 (티커가 있는 종목 + 비트코인)
// 지금 가치 ÷ (1 + 등락률) = 그 전날 가치 → 차이를 모두 더함
function calculateDashTodayChange() {
  let change = 0;
  let base = 0;
  assets.forEach(function (asset) {
    const quote = getMarketQuote(asset.ticker); // market.js
    if (!quote || !Number.isFinite(quote.change)) return;
    const value = asset.quantity * asset.currentPrice;
    const before = value / (1 + quote.change / 100);
    change = change + (value - before);
    base = base + before;
  });
  const btc = marketData && marketData.markets["BTC-USD"];
  if (btc && Number.isFinite(btc.change)) {
    cryptos.forEach(function (crypto) {
      if (getCryptoSymbol(crypto) !== "BTC") return; // crypto.js
      const value = crypto.quantity * crypto.currentPrice;
      const before = value / (1 + btc.change / 100);
      change = change + (value - before);
      base = base + before;
    });
  }
  return base > 0 ? { change: change, rate: (change / base) * 100 } : null;
}

// 지난 기록(history.js)으로 본 월평균 증가액 (최근 12개월까지)
function calculateDashMonthlyGrowth() {
  const records = historyRecords.slice(-13); // history.js
  if (records.length < 2) return null;
  const first = records[0];
  const last = records[records.length - 1];
  return (last.total - first.total) / (records.length - 1);
}

// =============================================
// 4. 화면 그리기
// =============================================

function renderDashToday() {
  dashToday.textContent = "";
  const today = calculateDashTodayChange();
  if (!today) return;
  dashToday.append("최근 거래일 ");
  const strong = document.createElement("strong");
  strong.className = getProfitClass(today.change);
  strong.textContent = formatSignedMoney(Math.round(today.change)) + " (" + formatPercent(today.rate) + ")";
  dashToday.append(strong, " · 티커가 있는 종목 기준");
}

function renderDashMarket() {
  dashMarketTiles.innerHTML = "";
  if (!marketData) {
    dashMarketNote.textContent = marketError ? "시세를 받지 못했어요. 잠시 뒤 다시 시도해요." : "시세를 불러오는 중…";
    return;
  }
  DASH_MARKET_TILES.forEach(function (tile) {
    const quote = marketData.markets[tile.symbol];
    if (!quote) return;
    const div = document.createElement("div");
    div.className = "dash-market-tile";
    const name = document.createElement("p");
    name.className = "btc-tile-name";
    name.textContent = tile.name;
    const value = document.createElement("p");
    value.className = "dash-market-value";
    const digits = quote.price < 100 ? 2 : 0;
    const number = quote.price.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
    value.textContent = tile.unit === "$" ? "$" + number : number + (tile.unit && tile.unit !== "$" ? tile.unit : "");
    const change = document.createElement("p");
    change.className = "btc-tile-sub " + getProfitClass(quote.change || 0);
    change.textContent = Number.isFinite(quote.change) ? formatPercent(quote.change) : "";
    div.append(name, value, change, createMarketSparkline(quote.closes.slice(-12), 80, 18));
    dashMarketTiles.appendChild(div);
  });
  const updated = new Date(marketData.updated);
  dashMarketNote.textContent =
    (updated.getMonth() + 1) + "월 " + updated.getDate() + "일 " + String(updated.getHours()).padStart(2, "0") + ":" +
    String(updated.getMinutes()).padStart(2, "0") + " 기준 · 등락은 최근 거래일 · 선은 1년 추이";
}

function renderDashGoal() {
  const goal = loadDashGoal();
  if (document.activeElement !== dashGoalInput) dashGoalInput.value = goal > 0 ? goal : "";
  const total = calculateNetworth().value - getDashDebt(); // 순자산 (networth.js, dashboard.js)
  if (!(goal > 0)) {
    dashGoalBar.style.width = "0%";
    dashGoalText.textContent = "목표를 정하면 얼마나 왔는지 보여 줘요. (가계부의 순자산 목표와 같은 값)";
    dashGoalSub.textContent = "";
    return;
  }
  const progress = Math.max(0, Math.min(total / goal, 1)) * 100;
  dashGoalBar.style.width = progress.toFixed(1) + "%";
  dashGoalText.textContent = formatManwon(goal) + " 중 " + formatManwon(total) + " (" + progress.toFixed(1) + "%)";
  if (total >= goal) {
    dashGoalSub.textContent = "목표 달성! 🎉";
    return;
  }
  const growth = calculateDashMonthlyGrowth();
  const remaining = goal - total;
  dashGoalSub.textContent =
    "남은 금액 " + formatKoreanUnit(remaining) +
    (growth > 0
      ? " · 지난 기록의 월평균 증가(" + formatKoreanUnit(growth) + ")가 이어지면 약 " + formatDashMonths(Math.ceil(remaining / growth))
      : "");
}

function formatDashMonths(months) {
  if (months < 12) return months + "개월";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years + "년" + (rest > 0 ? " " + rest + "개월" : "");
}

function renderDashMarketAll() {
  renderDashToday();
  renderDashMarket();
  renderDashGoal();
}

// =============================================
// 5. 이벤트 처리
// =============================================

dashGoalForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const value = dashGoalInput.value.trim() === "" ? 0 : Number(dashGoalInput.value);
  if (!Number.isFinite(value) || value < 0 || value > 1e15) {
    alert("목표는 0 이상의 금액으로 넣어 주세요. (0이나 빈칸이면 목표 없음)");
    return;
  }
  // 가계부 목표에 저장 → 가계부 탭의 고리·미래 계산도 같은 목표를 씀 (budget.js)
  budget.goal = value;
  saveBudget();
  fillBudgetSettings();
  renderBudget();
  dashGoalInput.blur();
  renderDashGoal();
});

document.addEventListener("market-updated", renderDashMarketAll);
document.addEventListener("data-saved", renderDashMarketAll);

// 시작 (시세는 assets-market.js가 받아 옴 → market-updated)
renderDashMarketAll();
