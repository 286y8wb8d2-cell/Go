// =============================================
// 시나리오 탭 — B. 미래 적립 시뮬레이션
// "지금 자산에 매달 50만 원씩 10년 더 넣으면?"
// 전체 자산(networth.js) 값을 불러오는 버튼이 있어서 그 파일보다 뒤에 불러옴
// ※ 이름은 모두 sim~ / SIM~ 으로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 입력값을 기억해 둘 때 쓰는 이름 (다음에 열어도 그대로 보이게)
const SIM_SETTINGS_KEY = "household-sim-settings";

// 처음 열었을 때 기본값
const SIM_DEFAULTS = {
  start: 0,
  monthly: 500000,
  years: 10,
  dividendYield: 2,
  reinvest: true,
  rates: { bad: 2, base: 5, good: 8 }, // 비관 / 기본 / 낙관 연 수익률(%)
};

// 세 가지 경우: 저장용 이름 → 화면 이름
const SIM_CASES = [
  { key: "bad", name: "비관" },
  { key: "base", name: "기본" },
  { key: "good", name: "낙관" },
];

// 입력 범위 (벗어나면 범위 끝값으로 계산)
const SIM_LIMITS = {
  start: [0, 10000000000000], // 0 ~ 10조
  monthly: [0, 10000000000], // 0 ~ 100억
  years: [1, 50],
  dividendYield: [0, 30],
  rate: [-50, 50],
};

// =============================================
// 화면 요소 찾기
// =============================================

const simStartInput = document.getElementById("sim-start");
const simMonthlyInput = document.getElementById("sim-monthly");
const simYearsInput = document.getElementById("sim-years");
const simDividendInput = document.getElementById("sim-dividend");
const simReinvestInput = document.getElementById("sim-reinvest");
const simRateInputs = {
  bad: document.getElementById("sim-rate-bad"),
  base: document.getElementById("sim-rate-base"),
  good: document.getElementById("sim-rate-good"),
};
const simLoadNetworthBtn = document.getElementById("sim-load-networth");
const simCards = document.getElementById("sim-cards");
const simPrincipalText = document.getElementById("sim-principal");
const simDividendText = document.getElementById("sim-dividend-result");
const simTableBody = document.getElementById("sim-table-body");

// =============================================
// 2. 저장/불러오기 (입력값 기억)
// =============================================

// 저장된 입력값을 불러옴. 없거나 깨져 있으면 기본값
function loadSimSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIM_SETTINGS_KEY));
    if (saved && typeof saved === "object") {
      // 기본값 위에 저장된 값을 덮어씀 (새로 생긴 항목은 기본값 유지)
      return Object.assign({}, SIM_DEFAULTS, saved, {
        rates: Object.assign({}, SIM_DEFAULTS.rates, saved.rates),
      });
    }
  } catch (error) {
    // 무시하고 기본값 사용
  }
  return SIM_DEFAULTS;
}

function saveSimSettings(settings) {
  try {
    localStorage.setItem(SIM_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    // 저장이 안 되는 환경이어도 계산은 계속
  }
}

// =============================================
// 3. 계산
// =============================================

// 숫자를 범위 안으로 (이상한 값이면 fallback)
function clampSimNumber(value, range, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, range[0]), range[1]);
}

// 입력칸 값 읽기 (비어 있으면 0)
function readSimNumber(input) {
  return input.value.trim() === "" ? 0 : Number(input.value);
}

// 입력칸에서 설정을 읽음
function readSimSettings() {
  return {
    start: clampSimNumber(readSimNumber(simStartInput), SIM_LIMITS.start, 0),
    monthly: clampSimNumber(readSimNumber(simMonthlyInput), SIM_LIMITS.monthly, 0),
    years: Math.round(clampSimNumber(readSimNumber(simYearsInput), SIM_LIMITS.years, 1)),
    dividendYield: clampSimNumber(readSimNumber(simDividendInput), SIM_LIMITS.dividendYield, 0),
    reinvest: simReinvestInput.checked,
    rates: {
      bad: clampSimNumber(readSimNumber(simRateInputs.bad), SIM_LIMITS.rate, 0),
      base: clampSimNumber(readSimNumber(simRateInputs.base), SIM_LIMITS.rate, 0),
      good: clampSimNumber(readSimNumber(simRateInputs.good), SIM_LIMITS.rate, 0),
    },
  };
}

// 한 가지 수익률로 기간 동안 매달 계산해서 연도별 결과를 돌려줌
// 매달 순서: ① 그달 투자금을 넣고 → ② 가격이 오르고(수익률) → ③ 배당을 받음
function simulate(settings, annualRate) {
  // 연 수익률을 한 달 수익률로: (1 + 연)^(1/12) - 1  (예: 연 5% → 월 약 0.407%)
  const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  // 배당은 1년치를 12로 나눠 매달 받는다고 단순하게 가정
  const monthlyDividendRate = settings.dividendYield / 100 / 12;

  let balance = settings.start; // 평가액
  let principal = settings.start; // 내가 넣은 돈(원금)
  let totalDividend = 0; // 지금까지 받은 배당 합계
  let yearDividend = 0; // 올해 받은 배당
  const rows = [];

  for (let month = 1; month <= settings.years * 12; month++) {
    balance = balance + settings.monthly;
    principal = principal + settings.monthly;

    balance = balance * (1 + monthlyRate);

    const dividend = balance * monthlyDividendRate;
    totalDividend = totalDividend + dividend;
    yearDividend = yearDividend + dividend;
    if (settings.reinvest) {
      balance = balance + dividend; // 재투자: 배당으로 다시 투자
    }

    // 12개월마다 한 줄 기록
    if (month % 12 === 0) {
      rows.push({
        year: month / 12,
        principal: principal,
        balance: balance,
        totalDividend: totalDividend,
        yearDividend: yearDividend,
      });
      yearDividend = 0;
    }
  }

  const last = rows[rows.length - 1];
  // 재투자하지 않으면 받은 배당은 현금으로 따로 쌓임 → 최종 자산에 더함
  const finalTotal = last.balance + (settings.reinvest ? 0 : last.totalDividend);
  return {
    rows: rows,
    principal: last.principal,
    finalTotal: finalTotal,
    gain: finalTotal - last.principal,
    totalDividend: last.totalDividend,
    lastYearDividend: last.yearDividend,
  };
}

// =============================================
// 4. 화면 그리기
// =============================================

// 설정을 입력칸에 채움
function fillSimInputs(settings) {
  simStartInput.value = settings.start;
  simMonthlyInput.value = settings.monthly;
  simYearsInput.value = settings.years;
  simDividendInput.value = settings.dividendYield;
  simReinvestInput.checked = settings.reinvest;
  SIM_CASES.forEach(function (c) {
    simRateInputs[c.key].value = settings.rates[c.key];
  });
}

// 계산하고 결과를 그림 (입력이 바뀔 때마다 실행)
function renderSimulation() {
  const settings = readSimSettings();
  saveSimSettings(settings);

  // 세 가지 경우를 각각 계산
  const results = {};
  SIM_CASES.forEach(function (c) {
    results[c.key] = simulate(settings, settings.rates[c.key]);
  });

  // ① 경우별 카드: 비관 / 기본 / 낙관
  simCards.innerHTML = "";
  SIM_CASES.forEach(function (c) {
    const result = results[c.key];
    const card = document.createElement("div");
    card.className = "summary-card";

    const title = document.createElement("p");
    title.textContent = c.name + " (연 " + settings.rates[c.key] + "%)";

    const total = document.createElement("p");
    total.className = "sim-card-total";
    total.textContent = formatKoreanUnit(result.finalTotal);

    const gain = document.createElement("p");
    gain.className = "sim-card-gain " + getProfitClass(result.gain);
    const gainRate = result.principal > 0 ? (result.gain / result.principal) * 100 : 0;
    gain.textContent = "원금 대비 " + formatPercent(gainRate);

    card.append(title, total, gain);
    simCards.appendChild(card);
  });

  // ② 아래 설명 줄
  const base = results.base;
  simPrincipalText.textContent =
    settings.years + "년 동안 넣은 원금 " + formatMoney(base.principal) +
    " (시작 " + formatKoreanUnit(settings.start) + " + 매월 " + formatKoreanUnit(settings.monthly) + ")";

  simDividendText.textContent =
    "기본 기준 " + settings.years + "년째 배당 연 " + formatMoney(base.lastYearDividend) +
    " (월 " + formatMoney(base.lastYearDividend / 12) + ") · 누적 배당 " + formatKoreanUnit(base.totalDividend) +
    (settings.reinvest ? " (재투자)" : " (현금 수령)");

  // ③ 연도별 표 (칸이 좁아서 만원 단위)
  simTableBody.innerHTML = "";
  base.rows.forEach(function (row, index) {
    const tr = document.createElement("tr");
    const cells = [
      row.year + "년",
      formatAmount(row.principal / 10000),
      formatAmount(rowTotal(results.bad, index, settings) / 10000),
      formatAmount(rowTotal(results.base, index, settings) / 10000),
      formatAmount(rowTotal(results.good, index, settings) / 10000),
    ];
    cells.forEach(function (text) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    simTableBody.appendChild(tr);
  });
}

// 표의 한 칸: 그 해의 평가액 (재투자하지 않으면 그때까지 받은 현금 배당도 더함)
function rowTotal(result, index, settings) {
  const row = result.rows[index];
  return row.balance + (settings.reinvest ? 0 : row.totalDividend);
}

// =============================================
// 5. 이벤트 처리
// =============================================

// 입력칸이 바뀔 때마다 다시 계산
[simStartInput, simMonthlyInput, simYearsInput, simDividendInput, simReinvestInput]
  .concat(Object.values(simRateInputs))
  .forEach(function (input) {
    input.addEventListener("input", renderSimulation);
  });

// "현재 자산" 버튼: 전체 자산(금융 + 가상)을 시작 금액으로
simLoadNetworthBtn.addEventListener("click", function () {
  const networth = calculateNetworth(); // networth.js
  if (networth.value <= 0) {
    alert("금융자산이나 비트코인을 먼저 입력해 주세요.");
    return;
  }
  simStartInput.value = Math.round(networth.value);
  renderSimulation();
});

// =============================================
// 시작
// =============================================

fillSimInputs(loadSimSettings());
renderSimulation();
