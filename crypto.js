// =============================================
// 가상자산 탭
// (공통 도구 loadList, saveList, formatMoney, formatPrice, formatNumber 등은 common.js에 있음)
// ※ 다른 파일과 이름이 겹치지 않게 모두 crypto~ / CRYPTO~ 로 시작
// 구조는 금융자산(assets.js)과 같고, 배당이 없고 보관처가 있다는 점만 다름
// =============================================

// =============================================
// 1. 상수
// =============================================

const CRYPTO_STORAGE_KEY = "household-crypto";

// 입력할 수 있는 가장 큰 값
const CRYPTO_MAX_VALUE = 1000000000000; // 1조

// 비중 막대에서 코인마다 다른 색을 줄 수 있는 개수 (style.css의 .coin-color-0 ~ 6)
// 이보다 많으면 나머지는 "기타"로 묶음
const CRYPTO_COLOR_COUNT = 7;

// 업비트 공개 시세 주소 (로그인이 필요 없는 공개 정보. 코인 심볼만 보내고 보유량·금액은 보내지 않음)
const CRYPTO_UPBIT_MARKETS_URL = "https://api.upbit.com/v1/market/all";
const CRYPTO_UPBIT_TICKER_URL = "https://api.upbit.com/v1/ticker?markets=";

// 마지막으로 시세를 불러온 시각을 기억하는 이름
const CRYPTO_PRICE_UPDATED_KEY = "household-crypto-price-updated";

// 응답을 기다리는 최대 시간 (10초)
const CRYPTO_FETCH_TIMEOUT = 10000;

// =============================================
// 2. 저장/불러오기
// =============================================

let cryptos = loadList(CRYPTO_STORAGE_KEY);

function saveCryptos() {
  saveList(CRYPTO_STORAGE_KEY, cryptos);
}

// 지금 수정 중인 코인의 id (수정 중이 아니면 null)
let cryptoEditingId = null;

// =============================================
// 화면 요소 찾기
// =============================================

const cryptoForm = document.getElementById("crypto-form");
const cryptoNameInput = document.getElementById("crypto-name");
const cryptoSymbolInput = document.getElementById("crypto-symbol");
const cryptoRefreshBtn = document.getElementById("crypto-refresh-btn");
const cryptoRefreshStatus = document.getElementById("crypto-refresh-status");
const cryptoQuantityInput = document.getElementById("crypto-quantity");
const cryptoAvgPriceInput = document.getElementById("crypto-avg-price");
const cryptoCurrentPriceInput = document.getElementById("crypto-current-price");
const cryptoPlaceInput = document.getElementById("crypto-place");
const cryptoMemoInput = document.getElementById("crypto-memo");
const cryptoSubmitBtn = document.getElementById("crypto-submit-btn");
const cryptoCancelBtn = document.getElementById("crypto-cancel-btn");
const cryptoList = document.getElementById("crypto-list");
const cryptoEmptyMessage = document.getElementById("crypto-empty-message");
const cryptoTotalValueText = document.getElementById("crypto-total-value");
const cryptoTotalProfitText = document.getElementById("crypto-total-profit");
const cryptoTotalRateText = document.getElementById("crypto-total-rate");
const cryptoTotalCostText = document.getElementById("crypto-total-cost");
const cryptoAllocBar = document.getElementById("crypto-alloc-bar");
const cryptoAllocLegend = document.getElementById("crypto-alloc-legend");

// =============================================
// 3. 계산
// =============================================

// 코인 하나의 매입금액, 평가금액, 손익, 수익률(%)
function calculateCrypto(crypto) {
  const cost = crypto.quantity * crypto.avgPrice;
  const value = crypto.quantity * crypto.currentPrice;
  const profit = value - cost;
  const rate = cost > 0 ? (profit / cost) * 100 : 0;
  return { cost: cost, value: value, profit: profit, rate: rate };
}

// 전체 합계
function calculateCryptoTotal(list) {
  let cost = 0;
  let value = 0;
  list.forEach(function (crypto) {
    const result = calculateCrypto(crypto);
    cost = cost + result.cost;
    value = value + result.value;
  });
  const profit = value - cost;
  return {
    cost: cost,
    value: value,
    profit: profit,
    rate: cost > 0 ? (profit / cost) * 100 : 0,
  };
}

// 평가금액이 큰 순서로 정렬한 새 배열 (같으면 먼저 등록한 것이 앞)
function sortCryptosByValue(list) {
  return list.slice().sort(function (a, b) {
    const diff = calculateCrypto(b).value - calculateCrypto(a).value;
    if (diff !== 0) {
      return diff;
    }
    return Number(a.id) - Number(b.id);
  });
}

// 코인마다 색 번호를 정함: 등록한 순서대로 0, 1, 2 ... (7번째 이후는 "other")
// 색이 평가금액 순위가 아니라 코인을 따라가도록, 등록 순서(id)로 정함
function getCryptoColorMap(list) {
  const byRegistered = list.slice().sort(function (a, b) {
    return Number(a.id) - Number(b.id);
  });
  const colorMap = {};
  byRegistered.forEach(function (crypto, index) {
    colorMap[crypto.id] = index < CRYPTO_COLOR_COUNT ? String(index) : "other";
  });
  return colorMap;
}

// =============================================
// 4. 화면 그리기
// =============================================

// 코인 하나로 목록의 한 줄을 만듦 (모양은 금융자산 목록과 같은 class를 씀)
function createCryptoItem(crypto, totalValue) {
  const result = calculateCrypto(crypto);

  const li = document.createElement("li");
  li.className = "asset-item";
  if (crypto.id === cryptoEditingId) {
    li.classList.add("editing");
  }

  // 코인명 + [보관처]
  const nameSpan = document.createElement("span");
  nameSpan.className = "asset-name";
  nameSpan.textContent = crypto.name;
  if (crypto.place !== "") {
    const placeSpan = document.createElement("span");
    placeSpan.className = "asset-kind";
    placeSpan.textContent = crypto.place;
    nameSpan.appendChild(placeSpan);
  }

  // 평가금액
  const valueSpan = document.createElement("span");
  valueSpan.className = "asset-value";
  valueSpan.textContent = formatMoney(result.value);

  // 손익(수익률)
  const profitSpan = document.createElement("span");
  profitSpan.className = "asset-profit " + getProfitClass(result.profit);
  profitSpan.textContent = formatSignedMoney(result.profit) + " (" + formatPercent(result.rate) + ")";

  // 비중
  const ratioSpan = document.createElement("span");
  ratioSpan.className = "asset-ratio";
  const ratio = totalValue > 0 ? (result.value / totalValue) * 100 : 0;
  ratioSpan.textContent = "비중 " + formatShare(ratio);

  // 수량 · 평균 매입가 · 현재가
  const detailSpan = document.createElement("span");
  detailSpan.className = "asset-detail";
  detailSpan.textContent =
    formatNumber(crypto.quantity) + "개 · 평균 " + formatPrice(crypto.avgPrice) +
    " · 현재 " + formatPrice(crypto.currentPrice);

  // 수정, 삭제 버튼
  const actions = document.createElement("span");
  actions.className = "asset-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "edit-btn";
  editBtn.textContent = "수정";
  editBtn.addEventListener("click", function () {
    startCryptoEdit(crypto);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", function () {
    if (confirm(crypto.name + "\n이 코인을 삭제할까요?")) {
      deleteCrypto(crypto.id);
    }
  });
  actions.append(editBtn, deleteBtn);

  li.append(nameSpan, valueSpan, profitSpan, ratioSpan, detailSpan, actions);
  return li;
}

// 요약 카드 + 코인별 비중 막대
function renderCryptoSummary(total) {
  cryptoTotalValueText.textContent = formatMoney(total.value);

  cryptoTotalProfitText.textContent = formatSignedMoney(total.profit);
  cryptoTotalProfitText.className = getProfitClass(total.profit);

  cryptoTotalRateText.textContent = formatPercent(total.rate);
  cryptoTotalRateText.className = getProfitClass(total.profit);

  cryptoTotalCostText.textContent = "총 매입금액 " + formatMoney(total.cost) + " · " + cryptos.length + "개 코인";

  // 코인별 비중 막대: 색 번호별로 평가금액을 모음 ("other"는 여러 코인이 합쳐짐)
  const colorMap = getCryptoColorMap(cryptos);
  const groups = []; // [{ name, value, colorClass }]
  const otherGroup = { name: "기타", value: 0, colorClass: "coin-color-other" };

  cryptos
    .slice()
    .sort(function (a, b) {
      return Number(a.id) - Number(b.id); // 막대 조각 순서도 등록 순서로 고정
    })
    .forEach(function (crypto) {
      const value = calculateCrypto(crypto).value;
      if (colorMap[crypto.id] === "other") {
        otherGroup.value = otherGroup.value + value;
      } else {
        groups.push({ name: crypto.name, value: value, colorClass: "coin-color-" + colorMap[crypto.id] });
      }
    });
  groups.push(otherGroup); // 0원이면 renderAllocation이 알아서 건너뜀

  renderAllocation(cryptoAllocBar, cryptoAllocLegend, groups); // common.js
}

// 가상자산 탭 전체를 다시 그림
function renderCryptos() {
  const total = calculateCryptoTotal(cryptos);
  renderCryptoSummary(total);

  cryptoList.innerHTML = "";
  sortCryptosByValue(cryptos).forEach(function (crypto) {
    cryptoList.appendChild(createCryptoItem(crypto, total.value));
  });

  cryptoEmptyMessage.hidden = cryptos.length > 0;
}

// =============================================
// 5. 이벤트 처리
// =============================================

// 입력칸 글자를 숫자로. 비어 있으면 NaN (검사에서 걸리게)
function readCryptoNumber(input) {
  if (input.value.trim() === "") {
    return NaN;
  }
  return Number(input.value);
}

function validateCrypto(crypto) {
  if (crypto.symbol !== "" && !/^[A-Z0-9]{1,10}$/.test(crypto.symbol)) {
    return "심볼은 영어 대문자와 숫자로만 입력해 주세요. (예: BTC)";
  }
  if (crypto.name === "") {
    return "코인명을 입력해 주세요.";
  }
  if (!Number.isFinite(crypto.quantity) || crypto.quantity <= 0) {
    return "수량은 0보다 큰 숫자로 입력해 주세요.";
  }
  if (crypto.quantity > CRYPTO_MAX_VALUE) {
    return "수량이 너무 큽니다.";
  }
  const prices = [
    { value: crypto.avgPrice, label: "평균 매입가" },
    { value: crypto.currentPrice, label: "현재가" },
  ];
  for (const price of prices) {
    if (!Number.isFinite(price.value) || price.value < 0) {
      return price.label + ": 0 이상의 숫자로 입력해 주세요.";
    }
    if (price.value > CRYPTO_MAX_VALUE) {
      return price.label + ": 값이 너무 큽니다.";
    }
  }
  return "";
}

function resetCryptoForm() {
  cryptoForm.reset();
  cryptoEditingId = null;
  cryptoSubmitBtn.textContent = "추가";
  cryptoCancelBtn.hidden = true;
}

function startCryptoEdit(crypto) {
  cryptoEditingId = crypto.id;

  cryptoNameInput.value = crypto.name;
  cryptoSymbolInput.value = crypto.symbol || ""; // 예전 코인에는 심볼이 없음
  cryptoQuantityInput.value = crypto.quantity;
  cryptoAvgPriceInput.value = crypto.avgPrice;
  cryptoCurrentPriceInput.value = crypto.currentPrice;
  cryptoPlaceInput.value = crypto.place;
  cryptoMemoInput.value = crypto.memo;

  cryptoSubmitBtn.textContent = "수정 완료";
  cryptoCancelBtn.hidden = false;

  renderCryptoRefreshStatus();
renderCryptos();
  cryptoForm.scrollIntoView({ behavior: "smooth" });
}

cryptoCancelBtn.addEventListener("click", function () {
  resetCryptoForm();
  renderCryptoRefreshStatus();
renderCryptos();
});

cryptoForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const crypto = {
    id: cryptoEditingId !== null ? cryptoEditingId : String(Date.now()),
    name: cryptoNameInput.value.trim(),
    symbol: cryptoSymbolInput.value.trim().toUpperCase(), // btc → BTC
    quantity: readCryptoNumber(cryptoQuantityInput),
    avgPrice: readCryptoNumber(cryptoAvgPriceInput),
    currentPrice: readCryptoNumber(cryptoCurrentPriceInput),
    place: cryptoPlaceInput.value.trim(),
    memo: cryptoMemoInput.value.trim(),
  };

  const error = validateCrypto(crypto);
  if (error !== "") {
    alert(error);
    return;
  }

  if (cryptoEditingId === null) {
    cryptos.push(crypto);
  } else {
    const index = cryptos.findIndex(function (item) {
      return item.id === cryptoEditingId;
    });
    cryptos[index] = crypto;
  }
  saveCryptos();
  resetCryptoForm();
  renderCryptoRefreshStatus();
renderCryptos();
});

function deleteCrypto(id) {
  cryptos = cryptos.filter(function (crypto) {
    return crypto.id !== id;
  });
  saveCryptos();
  if (id === cryptoEditingId) {
    resetCryptoForm();
  }
  renderCryptoRefreshStatus();
renderCryptos();
}

// ---------------------------------------------
// 업비트 시세 불러오기
// ---------------------------------------------

// 코인의 심볼: 심볼 칸이 있으면 그 값, 없으면 이름 속 영어 대문자 단어 (예: "비트코인 BTC" → "BTC")
function getCryptoSymbol(crypto) {
  if (crypto.symbol) {
    return crypto.symbol;
  }
  const found = crypto.name.match(/\b[A-Z][A-Z0-9]{1,9}\b/g);
  return found ? found[found.length - 1] : null;
}

// 주소에서 JSON을 받아 옴 (10초 넘게 걸리면 포기)
async function fetchCryptoJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, CRYPTO_FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error("응답 오류 " + response.status);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// "마지막 갱신" 안내를 보여 줌
function renderCryptoRefreshStatus(message) {
  if (message) {
    cryptoRefreshStatus.textContent = message;
    return;
  }
  let last = null;
  try {
    last = localStorage.getItem(CRYPTO_PRICE_UPDATED_KEY);
  } catch (error) {
    // 무시
  }
  cryptoRefreshStatus.textContent = last
    ? "마지막 시세 갱신: " + last
    : "심볼(예: BTC)이 있는 코인의 현재가를 업비트 원화 시세로 바꿔요.";
}

// 지금 시각을 "2026-10-18 10:32" 모양으로
function getNowText() {
  const now = new Date();
  return getToday() + " " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

cryptoRefreshBtn.addEventListener("click", async function () {
  // 심볼별로 코인 묶기 (같은 코인을 거래소별로 여러 줄 넣었을 수 있음)
  const bySymbol = {};
  const noSymbol = [];
  cryptos.forEach(function (crypto) {
    const symbol = getCryptoSymbol(crypto);
    if (symbol) {
      (bySymbol[symbol] = bySymbol[symbol] || []).push(crypto);
    } else {
      noSymbol.push(crypto.name);
    }
  });
  const symbols = Object.keys(bySymbol);
  if (symbols.length === 0) {
    alert("심볼이 있는 코인이 없어요. 코인을 수정해서 심볼(예: BTC)을 넣어 주세요.");
    return;
  }

  cryptoRefreshBtn.disabled = true;
  cryptoRefreshBtn.textContent = "불러오는 중…";
  try {
    // ① 업비트 원화 마켓 목록 (없는 코인을 물어보면 업비트가 전체를 오류로 돌려주기 때문에 먼저 걸러 냄)
    const markets = await fetchCryptoJson(CRYPTO_UPBIT_MARKETS_URL);
    const krwMarkets = new Set(
      markets.map(function (item) {
        return item.market;
      })
    );
    const found = symbols.filter(function (symbol) {
      return krwMarkets.has("KRW-" + symbol);
    });
    const notFound = symbols.filter(function (symbol) {
      return !krwMarkets.has("KRW-" + symbol);
    });

    // ② 찾은 코인들의 현재가를 한 번에
    let updatedCount = 0;
    if (found.length > 0) {
      const tickers = await fetchCryptoJson(
        CRYPTO_UPBIT_TICKER_URL +
          found
            .map(function (symbol) {
              return "KRW-" + symbol;
            })
            .join(",")
      );
      tickers.forEach(function (ticker) {
        const symbol = String(ticker.market).replace("KRW-", "");
        const price = Number(ticker.trade_price);
        if (!bySymbol[symbol] || !Number.isFinite(price) || price < 0) {
          return;
        }
        bySymbol[symbol].forEach(function (crypto) {
          crypto.currentPrice = price;
          updatedCount = updatedCount + 1;
        });
      });
    }

    if (updatedCount > 0) {
      try {
        localStorage.setItem(CRYPTO_PRICE_UPDATED_KEY, getNowText());
      } catch (error) {
        // 무시
      }
      saveCryptos();
      renderCryptoRefreshStatus();
renderCryptos();
    }

    // 결과 안내 (몇 개 바뀌었는지 + 못 찾은 코인)
    const notes = ["마지막 시세 갱신: " + getNowText() + " (" + updatedCount + "개 코인)"];
    if (notFound.length > 0) {
      notes.push("업비트 원화 마켓에 없음: " + notFound.join(", ") + ".");
    }
    if (noSymbol.length > 0) {
      notes.push("심볼이 없어 건너뜀: " + noSymbol.join(", ") + ".");
    }
    renderCryptoRefreshStatus(notes.join(" "));
  } catch (error) {
    renderCryptoRefreshStatus(
      "시세를 불러오지 못했어요. 인터넷 연결을 확인하고 잠시 뒤 다시 눌러 주세요. (브라우저가 업비트 접속을 막았을 수도 있어요)"
    );
  } finally {
    cryptoRefreshBtn.disabled = false;
    cryptoRefreshBtn.textContent = "업비트 시세 불러오기";
  }
});

// =============================================
// 시작
// =============================================

renderCryptoRefreshStatus();
renderCryptos();
