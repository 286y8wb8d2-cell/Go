// =============================================
// 시나리오 탭 — A. 가격 변동 시나리오
// "주식 -20%, 코인 +50%가 되면 내 자산은?"
// 금융자산(assets.js), 가상자산(crypto.js), 전체 자산(networth.js)의 계산 함수를 씀
// → index.html에서 그 파일들보다 뒤에 불러옴
// ※ 이름은 모두 scenario~ / SCENARIO~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

const SCENARIO_STORAGE_KEY = "household-scenarios";

// 변동률 입력 범위: -100%(전부 잃음) ~ +1000%(11배)
const SCENARIO_MIN_CHANGE = -100;
const SCENARIO_MAX_CHANGE = 1000;

// 예시 시나리오 (버튼을 누르면 입력칸이 이 값으로 채워짐, 적지 않은 자산군은 0%)
const SCENARIO_PRESETS = [
  {
    name: "폭락장 예시",
    changes: { "kr-stock": -30, "us-stock": -30, etf: -30, bond: 5, crypto: -60 },
  },
  {
    name: "조정장 예시",
    changes: { "kr-stock": -10, "us-stock": -10, etf: -10, crypto: -25 },
  },
  {
    name: "상승장 예시",
    changes: { "kr-stock": 20, "us-stock": 20, etf: 20, crypto: 50 },
  },
];

// =============================================
// 2. 저장/불러오기
// =============================================

// 저장한 시나리오 목록: [{ id, name, changes: { "kr-stock": -20, ..., crypto: -50, items: { "asset:123": -30 } } }]
// changes.items: 종목별로 따로 정한 변동률 (없으면 자산군 값을 따름). 이름표는 "asset:종목id" / "crypto:코인id"
let scenarios = loadList(SCENARIO_STORAGE_KEY);

function saveScenarios() {
  saveList(SCENARIO_STORAGE_KEY, scenarios);
}

// =============================================
// 화면 요소 찾기
// =============================================

const scenarioPresetBox = document.getElementById("scenario-presets");
const scenarioInputBox = document.getElementById("scenario-inputs");
const scenarioResetBtn = document.getElementById("scenario-reset-btn");
const scenarioItemsBox = document.getElementById("scenario-items-box");
const scenarioItemsSummary = document.getElementById("scenario-items-summary");
const scenarioItemsList = document.getElementById("scenario-items");

// 종목별 입력칸을 담아 둠: { "asset:123": <input>, "crypto:456": <input> }
let scenarioItemInputs = {};
const scenarioTotalText = document.getElementById("scenario-total");
const scenarioDiffText = document.getElementById("scenario-diff");
const scenarioNowText = document.getElementById("scenario-now");
const scenarioProfitText = document.getElementById("scenario-profit");
const scenarioDividendText = document.getElementById("scenario-dividend");
const scenarioTableBody = document.getElementById("scenario-table-body");
const scenarioNameInput = document.getElementById("scenario-name");
const scenarioSaveForm = document.getElementById("scenario-save-form");
const scenarioList = document.getElementById("scenario-list");
const scenarioEmptyMessage = document.getElementById("scenario-empty-message");
const scenarioNoAssetMessage = document.getElementById("scenario-no-asset-message");

// 자산군마다 만든 입력칸을 담아 둠: { "kr-stock": <input>, ..., crypto: <input> }
const scenarioInputs = {};

// =============================================
// 3. 계산
// =============================================

// 변동률 묶음(changes)을 적용했을 때의 결과를 계산해 돌려줌
// changes 예: { "kr-stock": -20, crypto: -50 } (없는 자산군은 0%)
function calculateScenario(changes) {
  // 자산군마다 "현재 금액"과 "시나리오 금액"을 모음
  const groups = {};
  NETWORTH_GROUPS.forEach(function (group) {
    groups[group] = { now: 0, after: 0 };
  });

  const items = changes.items || {};

  // 변동률(%)을 곱할 배수로: -20% → 0.8, +50% → 1.5
  // 종목별 값이 있으면 그 값을, 없으면 자산군 값을 씀
  function multiplier(group, itemKey) {
    const change = items[itemKey] !== undefined ? items[itemKey] : changes[group] || 0;
    return 1 + change / 100;
  }

  let cost = 0;
  let dividendNow = 0;

  assets.forEach(function (asset) {
    const result = calculateAsset(asset);
    const group = ASSET_KINDS[asset.kind] ? asset.kind : "etc";
    groups[group].now = groups[group].now + result.value;
    groups[group].after = groups[group].after + result.value * multiplier(group, "asset:" + asset.id);
    cost = cost + result.cost;
    dividendNow = dividendNow + result.annualDividend;
  });

  // 가상자산은 코인마다 따로 (코인별 변동률이 있을 수 있어서)
  cryptos.forEach(function (crypto) {
    const result = calculateCrypto(crypto);
    groups.crypto.now = groups.crypto.now + result.value;
    groups.crypto.after = groups.crypto.after + result.value * multiplier("crypto", "crypto:" + crypto.id);
    cost = cost + result.cost;
  });

  let now = 0;
  let after = 0;
  NETWORTH_GROUPS.forEach(function (group) {
    now = now + groups[group].now;
    after = after + groups[group].after;
  });

  // 금융자산만의 평가금액 (배당수익률 계산용)
  const assetsNow = now - groups.crypto.now;
  const assetsAfter = after - groups.crypto.after;

  return {
    groups: groups,
    now: now,
    after: after,
    diff: after - now,
    diffRate: now > 0 ? ((after - now) / now) * 100 : 0,
    profitAfter: after - cost, // 시나리오 후 총 손익 (매입금액은 그대로)
    profitRateAfter: cost > 0 ? ((after - cost) / cost) * 100 : 0,
    // 주당 배당금은 그대로라고 가정 → 배당금은 같고, 가격이 바뀌니 배당수익률만 바뀜
    dividend: dividendNow,
    yieldNow: assetsNow > 0 ? (dividendNow / assetsNow) * 100 : 0,
    yieldAfter: assetsAfter > 0 ? (dividendNow / assetsAfter) * 100 : 0,
  };
}

// 변동률 묶음을 짧은 글로 (예: "국내주식 -30% · 가상자산 -60%")
function describeChanges(changes) {
  const parts = [];
  NETWORTH_GROUPS.forEach(function (group) {
    const value = changes[group] || 0;
    if (value !== 0) {
      parts.push(getNetworthGroupName(group) + " " + (value > 0 ? "+" : "") + value + "%");
    }
  });
  // 종목별 값 (지금은 없는 종목은 건너뜀)
  const items = changes.items || {};
  Object.keys(items).forEach(function (key) {
    const name = getScenarioItemName(key);
    if (name !== null) {
      const value = items[key];
      parts.push(name + " " + (value > 0 ? "+" : "") + value + "%");
    }
  });
  return parts.length > 0 ? parts.join(" · ") : "변동 없음";
}

// "asset:123" 같은 이름표로 종목 이름을 찾음 (없으면 null)
function getScenarioItemName(key) {
  const id = key.slice(key.indexOf(":") + 1);
  const list = key.startsWith("asset:") ? assets : cryptos;
  const found = list.find(function (item) {
    return item.id === id;
  });
  return found ? found.name : null;
}

// =============================================
// 4. 화면 그리기
// =============================================

// 입력칸에서 지금 변동률 묶음을 읽음 (비어 있거나 이상한 값은 0, 범위 밖은 범위 안으로)
function readScenarioChanges() {
  const changes = {};
  NETWORTH_GROUPS.forEach(function (group) {
    let value = Number(scenarioInputs[group].value);
    if (!Number.isFinite(value)) {
      value = 0;
    }
    value = Math.min(Math.max(value, SCENARIO_MIN_CHANGE), SCENARIO_MAX_CHANGE);
    changes[group] = value;
  });

  // 종목별: 값을 넣은 칸만 저장 (빈칸은 자산군을 따름)
  changes.items = {};
  Object.keys(scenarioItemInputs).forEach(function (key) {
    const text = scenarioItemInputs[key].value.trim();
    const value = Number(text);
    if (text !== "" && Number.isFinite(value)) {
      changes.items[key] = Math.min(Math.max(value, SCENARIO_MIN_CHANGE), SCENARIO_MAX_CHANGE);
    }
  });
  return changes;
}

// 변동률 묶음을 입력칸에 채움 (0%는 빈칸으로 두어 눈에 덜 띄게)
function fillScenarioInputs(changes) {
  NETWORTH_GROUPS.forEach(function (group) {
    const value = changes[group] || 0;
    scenarioInputs[group].value = value === 0 ? "" : value;
  });
  const items = changes.items || {};
  Object.keys(scenarioItemInputs).forEach(function (key) {
    scenarioItemInputs[key].value = items[key] !== undefined ? items[key] : "";
  });
  updateScenarioItemsSummary();
}

// 종목별 입력칸을 지금 보유 종목·코인으로 다시 만듦 (이미 넣어 둔 값은 유지)
function buildScenarioItemInputs() {
  const keep = {};
  Object.keys(scenarioItemInputs).forEach(function (key) {
    keep[key] = scenarioItemInputs[key].value;
  });

  scenarioItemsList.innerHTML = "";
  scenarioItemInputs = {};

  const rows = assets
    .map(function (asset) {
      return { key: "asset:" + asset.id, name: asset.name, group: ASSET_KINDS[asset.kind] || "기타" };
    })
    .concat(
      cryptos.map(function (crypto) {
        return { key: "crypto:" + crypto.id, name: crypto.name, group: "가상자산" };
      })
    );

  rows.forEach(function (row) {
    // 한 줄: [종목명 (자산군)] [  %  ]
    const wrapper = document.createElement("div");
    wrapper.className = "scenario-item-row";

    const label = document.createElement("label");
    label.htmlFor = "scenario-item-" + row.key.replace(":", "-");
    label.textContent = row.name;
    const groupTag = document.createElement("span");
    groupTag.className = "asset-kind";
    groupTag.textContent = row.group;
    label.appendChild(groupTag);

    const input = document.createElement("input");
    input.type = "number";
    input.id = "scenario-item-" + row.key.replace(":", "-");
    input.step = "any";
    input.min = String(SCENARIO_MIN_CHANGE);
    input.max = String(SCENARIO_MAX_CHANGE);
    input.placeholder = "자산군 따름";
    input.value = keep[row.key] !== undefined ? keep[row.key] : "";
    input.addEventListener("input", function () {
      updateScenarioItemsSummary();
      renderScenarioResult();
    });

    scenarioItemInputs[row.key] = input;
    wrapper.append(label, input);
    scenarioItemsList.appendChild(wrapper);
  });

  scenarioItemsBox.hidden = rows.length === 0;
  updateScenarioItemsSummary();
}

// 접힌 제목에 몇 개를 따로 정했는지 표시
function updateScenarioItemsSummary() {
  let count = 0;
  Object.keys(scenarioItemInputs).forEach(function (key) {
    if (scenarioItemInputs[key].value.trim() !== "") {
      count = count + 1;
    }
  });
  scenarioItemsSummary.textContent = "종목별로 따로 정하기" + (count > 0 ? " (" + count + "개 설정됨)" : " (선택)");
}

// 처음 한 번: 예시 버튼과 자산군별 입력칸을 만듦
function buildScenarioControls() {
  SCENARIO_PRESETS.forEach(function (preset) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip-btn";
    button.textContent = preset.name;
    button.addEventListener("click", function () {
      fillScenarioInputs(preset.changes);
      renderScenarioResult();
    });
    scenarioPresetBox.appendChild(button);
  });

  NETWORTH_GROUPS.forEach(function (group) {
    const wrapper = document.createElement("div");

    const label = document.createElement("label");
    label.htmlFor = "scenario-change-" + group;
    label.textContent = getNetworthGroupName(group) + " (%)";

    const input = document.createElement("input");
    input.type = "number";
    input.id = "scenario-change-" + group;
    input.step = "any";
    input.min = String(SCENARIO_MIN_CHANGE);
    input.max = String(SCENARIO_MAX_CHANGE);
    // inputMode="decimal"은 쓰지 않음: 아이폰 숫자 키패드에는 마이너스(-) 키가 없어서 하락을 입력할 수 없음
    input.placeholder = "0";
    // 숫자를 바꿀 때마다 바로 다시 계산
    input.addEventListener("input", renderScenarioResult);

    scenarioInputs[group] = input;
    wrapper.append(label, input);
    scenarioInputBox.appendChild(wrapper);
  });
}

// 지금 입력한 시나리오의 결과를 그림
function renderScenarioResult() {
  const result = calculateScenario(readScenarioChanges());

  // 자산이 하나도 없으면 안내 문구
  scenarioNoAssetMessage.hidden = result.now > 0;

  scenarioTotalText.textContent = formatMoney(result.after);

  scenarioDiffText.textContent = formatSignedMoney(result.diff) + " (" + formatPercent(result.diffRate) + ")";
  scenarioDiffText.className = getProfitClass(result.diff);

  scenarioNowText.textContent = "현재 총 자산 " + formatMoney(result.now);

  scenarioProfitText.textContent =
    "시나리오 후 총 손익 " + formatSignedMoney(result.profitAfter) +
    " (" + formatPercent(result.profitRateAfter) + ")";

  scenarioDividendText.textContent =
    "예상 배당 연 " + formatMoney(result.dividend) +
    " · 배당수익률 " + result.yieldNow.toFixed(2) + "% → " + result.yieldAfter.toFixed(2) + "%";

  // 자산군별 표: 갖고 있는 자산군만
  scenarioTableBody.innerHTML = "";
  NETWORTH_GROUPS.forEach(function (group) {
    const g = result.groups[group];
    if (g.now <= 0) {
      return;
    }
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = getNetworthGroupName(group);

    const nowCell = document.createElement("td");
    nowCell.textContent = formatAmount(g.now); // 표는 칸이 좁아서 "원" 없이 (제목에 단위 표시)

    const afterCell = document.createElement("td");
    afterCell.textContent = formatAmount(g.after);

    const diffCell = document.createElement("td");
    const groupDiff = Math.round(g.after - g.now);
    diffCell.textContent = (groupDiff > 0 ? "+" : "") + formatAmount(groupDiff);
    diffCell.className = getProfitClass(g.after - g.now);

    row.append(nameCell, nowCell, afterCell, diffCell);
    scenarioTableBody.appendChild(row);
  });
}

// 저장한 시나리오 목록을 그림 (자산이 바뀌면 결과도 지금 자산 기준으로 다시 계산됨)
function renderScenarioList() {
  scenarioList.innerHTML = "";

  scenarios.forEach(function (scenario) {
    const result = calculateScenario(scenario.changes);

    // 한 줄 모양
    // 폭락 대비 .................. 5,230,000원
    // 국내주식 -30% · 가상자산 -60%
    // -1,520,000원 (-22.5%) ..... [불러오기] [삭제]
    const li = document.createElement("li");
    li.className = "scenario-item";

    const name = document.createElement("span");
    name.className = "scenario-item-name";
    name.textContent = scenario.name;

    const total = document.createElement("span");
    total.className = "scenario-item-total";
    total.textContent = formatMoney(result.after);

    const changes = document.createElement("span");
    changes.className = "scenario-item-changes";
    changes.textContent = describeChanges(scenario.changes);

    const diff = document.createElement("span");
    diff.className = "scenario-item-diff " + getProfitClass(result.diff);
    diff.textContent = formatSignedMoney(result.diff) + " (" + formatPercent(result.diffRate) + ")";

    const actions = document.createElement("span");
    actions.className = "scenario-item-actions";

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "edit-btn";
    loadBtn.textContent = "불러오기";
    loadBtn.addEventListener("click", function () {
      fillScenarioInputs(scenario.changes);
      scenarioNameInput.value = scenario.name;
      renderScenarioResult();
      scenarioInputBox.scrollIntoView({ behavior: "smooth" });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", function () {
      if (confirm(scenario.name + "\n이 시나리오를 삭제할까요?")) {
        scenarios = scenarios.filter(function (item) {
          return item.id !== scenario.id;
        });
        saveScenarios();
        renderScenarioList();
      }
    });

    actions.append(loadBtn, deleteBtn);
    li.append(name, total, changes, diff, actions);
    scenarioList.appendChild(li);
  });

  scenarioEmptyMessage.hidden = scenarios.length > 0;
}

// =============================================
// 5. 이벤트 처리
// =============================================

// 초기화: 모든 변동률을 0%로
scenarioResetBtn.addEventListener("click", function () {
  fillScenarioInputs({});
  scenarioNameInput.value = "";
  renderScenarioResult();
});

// 저장: 지금 입력한 변동률을 이름과 함께 저장 (같은 이름이 있으면 덮어씀)
scenarioSaveForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const name = scenarioNameInput.value.trim();
  if (name === "") {
    alert("시나리오 이름을 입력해 주세요.");
    return;
  }

  const changes = readScenarioChanges();
  const existing = scenarios.find(function (item) {
    return item.name === name;
  });

  if (existing) {
    if (!confirm('"' + name + '" 시나리오를 지금 값으로 바꿀까요?')) {
      return;
    }
    existing.changes = changes;
  } else {
    scenarios.push({ id: String(Date.now()), name: name, changes: changes });
  }
  saveScenarios();
  renderScenarioList();
  scenarioNameInput.value = "";
});

// 다른 탭에서 자산이 바뀌면 결과를 다시 계산 (common.js의 saveList가 보내는 신호)
document.addEventListener("data-saved", function (event) {
  if (event.detail.key !== SCENARIO_STORAGE_KEY) {
    buildScenarioItemInputs(); // 종목이 늘거나 줄었을 수 있음
    renderScenarioResult();
    renderScenarioList();
  }
});

// =============================================
// 시작
// =============================================

buildScenarioControls();
buildScenarioItemInputs();
renderScenarioResult();
renderScenarioList();
