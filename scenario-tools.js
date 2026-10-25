// =============================================
// 시나리오 탭 — 목표 비중(리밸런싱) · 세금 어림
// - 목표 비중: 자산을 네 묶음(비트코인 · 주식·ETF · 현금·예금 · 채권·기타)으로 나눠 목표 %와 비교,
//   맞추려면 얼마를 사고팔지, 새로 넣을 돈만으로 맞추면 어디에 얼마씩 넣을지
// - 세금: 해외주식 양도소득세(250만원 공제 후 22%), 배당소득세(15.4%), 비트코인(과세 예정)
// ※ 이름은 모두 scenario~ / SCENARIO~ 로 시작 (scenarioRebal~, scenarioTax~)
// simulate.js 뒤에 불러옴
// =============================================

// =============================================
// 1. 목표 비중
// =============================================

const SCENARIO_REBAL_KEY = "household-rebalance"; // { targets: { btc, stock, cash, other } | null, add } — 백업에 포함

// 묶음: 이름 · 색(검증된 팔레트) · 들어가는 자산군(networth.js의 그룹)
const SCENARIO_REBAL_BUCKETS = [
  { key: "btc", name: "비트코인", color: "#e34948", groups: ["crypto"] },
  { key: "stock", name: "주식·ETF", color: "#2a78d6", groups: ["kr-stock", "us-stock", "etf"] },
  { key: "cash", name: "현금·예금", color: "#008300", groups: ["cash", "deposit"] },
  { key: "other", name: "채권·기타", color: "#eda100", groups: ["bond", "etc"] },
];

function loadScenarioRebal() {
  const data = { targets: null, add: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(SCENARIO_REBAL_KEY));
    if (saved && typeof saved === "object") {
      if (saved.targets && typeof saved.targets === "object") data.targets = saved.targets;
      if (Number.isFinite(saved.add) && saved.add >= 0) data.add = saved.add;
    }
  } catch (error) {
    // 깨져 있으면 처음 상태
  }
  return data;
}

let scenarioRebal = loadScenarioRebal();

const scenarioRebalForm = document.getElementById("rebal-form");
const scenarioRebalSum = document.getElementById("rebal-sum");
const scenarioRebalNowBar = document.getElementById("rebal-now-bar");
const scenarioRebalTargetBar = document.getElementById("rebal-target-bar");
const scenarioRebalBody = document.getElementById("rebal-body");
const scenarioRebalAddResult = document.getElementById("rebal-add-result");

// 묶음별 지금 금액 → { btc: 원, ... , total }
function getScenarioRebalNow() {
  const networth = calculateNetworth(); // networth.js
  const now = { total: networth.value };
  SCENARIO_REBAL_BUCKETS.forEach(function (bucket) {
    now[bucket.key] = bucket.groups.reduce(function (sum, group) {
      return sum + (networth.valueByGroup[group] || 0);
    }, 0);
  });
  return now;
}

// 목표가 없으면 지금 비중(정수로 반올림)을 처음 값으로
function getScenarioRebalTargets(now) {
  if (scenarioRebal.targets) return scenarioRebal.targets;
  const targets = {};
  SCENARIO_REBAL_BUCKETS.forEach(function (bucket) {
    targets[bucket.key] = now.total > 0 ? Math.round((now[bucket.key] / now.total) * 100) : 0;
  });
  return targets;
}

function fillScenarioRebalBar(bar, parts) {
  bar.innerHTML = "";
  parts.forEach(function (part) {
    if (!(part.pct > 0)) return;
    const piece = document.createElement("span");
    piece.style.width = part.pct + "%";
    piece.style.background = part.color;
    piece.title = part.name + " " + part.pct.toFixed(1) + "%";
    bar.appendChild(piece);
  });
}

function renderScenarioRebal() {
  const now = getScenarioRebalNow();
  const targets = getScenarioRebalTargets(now);
  const f = scenarioRebalForm.elements;
  SCENARIO_REBAL_BUCKETS.forEach(function (bucket) {
    if (document.activeElement !== f[bucket.key]) f[bucket.key].value = targets[bucket.key];
  });
  if (document.activeElement !== f.add) f.add.value = scenarioRebal.add > 0 ? scenarioRebal.add : "";
  renderScenarioRebalSum();

  const total = now.total;
  fillScenarioRebalBar(scenarioRebalNowBar, SCENARIO_REBAL_BUCKETS.map(function (bucket) {
    return { name: bucket.name, color: bucket.color, pct: total > 0 ? (now[bucket.key] / total) * 100 : 0 };
  }));
  fillScenarioRebalBar(scenarioRebalTargetBar, SCENARIO_REBAL_BUCKETS.map(function (bucket) {
    return { name: bucket.name, color: bucket.color, pct: Number(targets[bucket.key]) || 0 };
  }));

  // 표: 묶음 · 지금(금액·%) · 목표 % · 맞추려면 (+사기 / -팔기)
  scenarioRebalBody.innerHTML = "";
  SCENARIO_REBAL_BUCKETS.forEach(function (bucket) {
    const value = now[bucket.key];
    const target = ((Number(targets[bucket.key]) || 0) / 100) * total;
    const diff = target - value;
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    const dot = document.createElement("span");
    dot.className = "alloc-swatch rebal-dot";
    dot.style.background = bucket.color;
    th.append(dot, bucket.name);
    const nowCell = document.createElement("td");
    nowCell.textContent = formatManwon(value) + " (" + (total > 0 ? ((value / total) * 100).toFixed(1) : "0") + "%)";
    const targetCell = document.createElement("td");
    targetCell.textContent = (Number(targets[bucket.key]) || 0) + "%";
    const action = document.createElement("td");
    if (total <= 0 || Math.abs(diff) < total * 0.01) {
      action.textContent = "그대로";
    } else {
      action.textContent = (diff > 0 ? formatManwon(diff) + " 사기" : formatManwon(-diff) + " 팔기");
      action.className = diff > 0 ? "profit-up" : "profit-down";
    }
    tr.append(th, nowCell, targetCell, action);
    scenarioRebalBody.appendChild(tr);
  });

  // 새로 넣을 돈만으로 맞추기: 모자란 묶음에 모자란 만큼의 비율로 나눠 넣음 (팔지 않음)
  const add = scenarioRebal.add;
  if (add > 0 && total >= 0) {
    const after = total + add;
    const needs = SCENARIO_REBAL_BUCKETS.map(function (bucket) {
      return Math.max(0, ((Number(targets[bucket.key]) || 0) / 100) * after - now[bucket.key]);
    });
    const needSum = needs.reduce(function (a, b) {
      return a + b;
    }, 0);
    const parts = [];
    SCENARIO_REBAL_BUCKETS.forEach(function (bucket, index) {
      const amount = needSum > 0 ? (add * needs[index]) / needSum : 0;
      if (amount >= 1000) parts.push(bucket.name + " " + formatManwon(amount));
    });
    scenarioRebalAddResult.textContent = parts.length > 0
      ? "새로 넣을 " + formatManwon(add) + "은(는) 팔지 않고 이렇게 나눠 넣으면 목표에 가까워져요: " + parts.join(" · ")
      : "이미 목표와 같아서 지금 비중대로 나눠 넣으면 돼요.";
    scenarioRebalAddResult.hidden = false;
  } else {
    scenarioRebalAddResult.textContent = "새로 넣을 돈을 적으면, 팔지 않고 어디에 얼마씩 넣으면 되는지 알려 드려요.";
  }
}

// 입력 중 합계 표시
function renderScenarioRebalSum() {
  const f = scenarioRebalForm.elements;
  const sum = SCENARIO_REBAL_BUCKETS.reduce(function (total, bucket) {
    return total + (Number(f[bucket.key].value) || 0);
  }, 0);
  scenarioRebalSum.textContent = "합계 " + (Math.round(sum * 10) / 10) + "%" + (Math.abs(sum - 100) < 0.05 ? "" : " (100%가 되게 맞춰 주세요)");
  scenarioRebalSum.classList.toggle("warn", Math.abs(sum - 100) >= 0.05);
}

scenarioRebalForm.addEventListener("input", renderScenarioRebalSum);

scenarioRebalForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const f = scenarioRebalForm.elements;
  const targets = {};
  let sum = 0;
  for (const bucket of SCENARIO_REBAL_BUCKETS) {
    const value = Number(f[bucket.key].value) || 0;
    if (value < 0 || value > 100) {
      alert("비중은 0~100% 사이로 넣어 주세요.");
      return;
    }
    targets[bucket.key] = value;
    sum += value;
  }
  if (Math.abs(sum - 100) >= 0.05) {
    alert("합계가 " + (Math.round(sum * 10) / 10) + "%예요. 100%가 되게 맞춰 주세요.");
    return;
  }
  const add = f.add.value.trim() === "" ? 0 : Number(f.add.value);
  scenarioRebal = { targets: targets, add: add >= 0 ? add : 0 };
  try {
    localStorage.setItem(SCENARIO_REBAL_KEY, JSON.stringify(scenarioRebal));
  } catch (error) {
    // 저장이 막혀도 이번에는 계산
  }
  document.activeElement.blur();
  renderScenarioRebal();
});

// =============================================
// 2. 세금 어림
// =============================================

const SCENARIO_TAX_KEY = "household-tax"; // { realized: 올해 이미 판 해외주식 손익 } — 백업에 포함
const SCENARIO_TAX_DEDUCTION = 2500000; // 해외주식·가상자산 기본공제 (1년)
const SCENARIO_TAX_RATE = 0.22; // 양도소득세 20% + 지방소득세 2%
const SCENARIO_DIVIDEND_RATE = 0.154; // 배당소득세 14% + 지방소득세 1.4%
const SCENARIO_FINANCIAL_LIMIT = 20000000; // 금융소득종합과세 기준 (1년 이자+배당)
// 국내에 상장된 해외 투자 ETF (팔 때 이익에 배당소득세 15.4%)
const SCENARIO_KR_OVERSEAS_WORDS = /미국|나스닥|S&P|해외|글로벌|선진국|중국|일본|인도|베트남|골드|금현물|원유|달러/;

function loadScenarioTax() {
  try {
    const saved = JSON.parse(localStorage.getItem(SCENARIO_TAX_KEY));
    if (saved && Number.isFinite(saved.realized)) return saved;
  } catch (error) {
    // 깨져 있으면 처음 상태
  }
  return { realized: 0 };
}

let scenarioTax = loadScenarioTax();

const scenarioTaxForm = document.getElementById("tax-form");
const scenarioTaxRealized = document.getElementById("tax-realized");
const scenarioTaxUnrealized = document.getElementById("tax-unrealized");
const scenarioTaxUnrealizedSub = document.getElementById("tax-unrealized-sub");
const scenarioTaxIfSell = document.getElementById("tax-if-sell");
const scenarioTaxIfSellSub = document.getElementById("tax-if-sell-sub");
const scenarioTaxFreeLeft = document.getElementById("tax-free-left");
const scenarioTaxTip = document.getElementById("tax-tip");
const scenarioTaxHoldings = document.getElementById("tax-holdings");
const scenarioTaxDividend = document.getElementById("tax-dividend");
const scenarioTaxCrypto = document.getElementById("tax-crypto");

// 해외주식(양도소득세 대상)인지: 해외주식 종류이거나, 시세가 달러인 종목
function isScenarioOverseas(asset) {
  if (asset.kind === "us-stock") return true;
  const quote = asset.ticker ? getMarketQuote(asset.ticker) : null; // market.js
  return Boolean(quote && quote.currency === "USD");
}

// 국내 상장 해외 ETF인지 (팔 때 배당소득세)
function isScenarioKrOverseasEtf(asset) {
  return asset.kind === "etf" && !isScenarioOverseas(asset) && SCENARIO_KR_OVERSEAS_WORDS.test(asset.name);
}

// "이름 … 금액" 한 줄 (dash-report와 같은 모양)
function createScenarioTaxRow(name, value, note, valueClass) {
  const li = document.createElement("li");
  li.className = "dash-report-row";
  const left = document.createElement("span");
  left.className = "dash-report-name";
  left.textContent = name;
  if (note) {
    const small = document.createElement("small");
    small.textContent = note;
    left.appendChild(small);
  }
  const right = document.createElement("span");
  right.className = "dash-report-value" + (valueClass ? " " + valueClass : "");
  right.textContent = value;
  li.append(left, right);
  return li;
}

function renderScenarioTax() {
  if (document.activeElement !== scenarioTaxRealized) scenarioTaxRealized.value = scenarioTax.realized ? scenarioTax.realized : "";

  // ① 해외주식
  const overseas = assets.filter(isScenarioOverseas); // assets.js
  let unrealized = 0;
  let gains = 0; // 이익 난 종목만의 이익 합계 (손해 종목은 빼고)
  scenarioTaxHoldings.innerHTML = "";
  overseas.forEach(function (asset) {
    const result = calculateAsset(asset); // assets.js
    unrealized += result.profit;
    gains += Math.max(0, result.profit);
    scenarioTaxHoldings.appendChild(createScenarioTaxRow(asset.name, formatSignedMoney(result.profit), "평가 " + formatManwon(result.value), getProfitClass(result.profit)));
  });
  const realized = scenarioTax.realized || 0;
  const gainIfSell = realized + unrealized;
  const taxIfSell = Math.max(0, gainIfSell - SCENARIO_TAX_DEDUCTION) * SCENARIO_TAX_RATE;
  const freeLeft = Math.max(0, SCENARIO_TAX_DEDUCTION - Math.max(0, realized));

  scenarioTaxUnrealized.textContent = overseas.length > 0 ? formatSignedMoney(unrealized) : "-";
  scenarioTaxUnrealized.className = getProfitClass(unrealized);
  scenarioTaxUnrealizedSub.textContent = overseas.length > 0 ? "해외 " + overseas.length + "종목" : "해외주식이 없어요";
  scenarioTaxIfSell.textContent = formatMoney(Math.round(taxIfSell));
  scenarioTaxIfSellSub.textContent = "(올해 손익 " + formatManwon(gainIfSell) + " − 250만) × 22%";
  scenarioTaxFreeLeft.textContent = formatManwon(freeLeft);

  // 아끼는 방법 (사실 안내, 권유 아님)
  let tip = "";
  if (gains > 0 && freeLeft > 0) {
    const sellNow = Math.min(gains, freeLeft);
    tip = "올해 안에 이익 난 종목을 이익이 약 " + formatManwon(sellNow) + "이 되는 만큼 팔았다가 바로 다시 사면, 그 이익은 세금 없이 확정되고 매입가가 올라가서 나중에 낼 세금이 줄어요. (공제 250만원은 해마다 새로 생기고, 남아도 다음 해로 넘어가지 않아요)";
  } else if (realized > SCENARIO_TAX_DEDUCTION && unrealized < 0) {
    tip = "손해 중인 종목을 올해 안에 팔면 이미 확정된 이익과 합쳐져서 올해 세금이 줄어요.";
  } else if (taxIfSell > 0) {
    tip = "공제를 넘는 이익이 있어요. 나눠서 해마다 250만원씩 확정하면 세금을 줄일 수 있어요.";
  }
  const krEtfs = assets.filter(isScenarioKrOverseasEtf);
  if (krEtfs.length > 0) {
    const krGain = krEtfs.reduce(function (sum, asset) {
      return sum + Math.max(0, calculateAsset(asset).profit);
    }, 0);
    tip += (tip ? " " : "") + "국내 상장 해외 ETF(" + krEtfs.map(function (a) { return a.name; }).join(", ") + ")는 양도세 대신 팔 때 이익의 15.4%를 떼요 (지금 팔면 약 " + formatManwon(krGain * SCENARIO_DIVIDEND_RATE) + ").";
  }
  scenarioTaxTip.textContent = tip;
  scenarioTaxTip.hidden = tip === "";

  // ② 배당
  const portfolio = calculatePortfolio(assets); // assets.js
  const dividend = portfolio.annualDividend;
  scenarioTaxDividend.innerHTML = "";
  scenarioTaxDividend.appendChild(createScenarioTaxRow("연 예상 배당 (세전)", formatMoney(Math.round(dividend)), "", ""));
  scenarioTaxDividend.appendChild(createScenarioTaxRow("떼는 세금", "-" + formatMoney(Math.round(dividend * SCENARIO_DIVIDEND_RATE)), "15.4% 기준", "profit-down"));
  scenarioTaxDividend.appendChild(createScenarioTaxRow("받는 돈 (세후)", formatMoney(Math.round(dividend * (1 - SCENARIO_DIVIDEND_RATE))), "월 약 " + formatMoney(Math.round((dividend * (1 - SCENARIO_DIVIDEND_RATE)) / 12)), ""));
  scenarioTaxDividend.appendChild(createScenarioTaxRow(
    "금융소득종합과세",
    dividend > SCENARIO_FINANCIAL_LIMIT ? "대상일 수 있어요" : "해당 없음",
    "1년 이자·배당 2,000만원 기준 (예금 이자 포함)",
    dividend > SCENARIO_FINANCIAL_LIMIT ? "profit-up" : ""
  ));

  // ③ 비트코인
  const crypto = calculateCryptoTotal(cryptos); // crypto.js
  scenarioTaxCrypto.innerHTML = "";
  scenarioTaxCrypto.appendChild(createScenarioTaxRow("지금 평가 손익", formatSignedMoney(crypto.profit), "", getProfitClass(crypto.profit)));
  scenarioTaxCrypto.appendChild(createScenarioTaxRow("2026년에 팔면", "세금 없음", "지금 기준 가상자산 양도 이익은 과세하지 않음", ""));
  scenarioTaxCrypto.appendChild(createScenarioTaxRow(
    "2027년 이후 팔면 (예정)",
    "약 " + formatManwon(Math.max(0, crypto.profit - SCENARIO_TAX_DEDUCTION) * SCENARIO_TAX_RATE),
    "250만원 공제 후 22% · 시행 시기·방식은 바뀔 수 있음",
    ""
  ));
}

scenarioTaxForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const value = scenarioTaxRealized.value.trim() === "" ? 0 : Number(scenarioTaxRealized.value);
  if (!Number.isFinite(value)) {
    alert("숫자로 넣어 주세요. 손해면 앞에 - 를 붙여 주세요.");
    return;
  }
  scenarioTax = { realized: value };
  try {
    localStorage.setItem(SCENARIO_TAX_KEY, JSON.stringify(scenarioTax));
  } catch (error) {
    // 저장이 막혀도 이번에는 계산
  }
  scenarioTaxRealized.blur();
  renderScenarioTax();
});

// =============================================
// 3. 다시 그리기
// =============================================

function renderScenarioTools() {
  renderScenarioRebal();
  renderScenarioTax();
}

document.addEventListener("data-saved", renderScenarioTools);
document.addEventListener("market-updated", renderScenarioTools);

renderScenarioTools();
