// =============================================
// 금융자산 탭 — 시세 연결 (market.js와 assets.js를 이어 줌)
// - 시세 상태 한 줄, 자동 갱신 켜고 끄기, "지금 적용" 버튼
// - 티커 입력칸의 자동 완성 목록
// - 다가오는 배당 (이번 달부터 3개월)
// ※ 이름은 모두 asset~ / ASSET~ 으로 시작
// =============================================

const assetMarketStatus = document.getElementById("asset-market-status");
const assetAutoPriceToggle = document.getElementById("asset-auto-price");
const assetAutoDivToggle = document.getElementById("asset-auto-div");
const assetApplyBtn = document.getElementById("asset-apply-btn");
const assetTickerList = document.getElementById("asset-ticker-list");
const assetDivUpcoming = document.getElementById("asset-div-upcoming");

// 시세 상태: 언제 기준인지, 몇 종목에 적용됐는지, 티커가 없는 종목이 있는지
function renderAssetMarketStatus() {
  assetAutoPriceToggle.checked = marketSettings.autoPrice;
  assetAutoDivToggle.checked = marketSettings.autoDividend;
  assetAutoDivToggle.disabled = !marketSettings.autoPrice;

  if (!marketData) {
    assetMarketStatus.textContent = marketError
      ? "시세를 받지 못했어요 (" + String(marketError.message || marketError).slice(0, 40) + "). 잠시 뒤 다시 시도해요."
      : "시세를 불러오는 중…";
    return;
  }
  const updated = new Date(marketData.updated);
  const parts = [
    "시세: " + (updated.getMonth() + 1) + "월 " + updated.getDate() + "일 " +
      String(updated.getHours()).padStart(2, "0") + ":" + String(updated.getMinutes()).padStart(2, "0") +
      " 기준 (6시간마다 새로 모음)",
  ];
  const withTicker = assets.filter(function (asset) {
    return asset.ticker;
  });
  const found = withTicker.filter(function (asset) {
    return getMarketQuote(asset.ticker);
  });
  if (withTicker.length > 0) parts.push(found.length + "/" + withTicker.length + "종목 시세 연결");
  const noTicker = assets.filter(function (asset) {
    return !asset.ticker && (asset.kind === "kr-stock" || asset.kind === "us-stock" || asset.kind === "etf");
  });
  if (noTicker.length > 0) parts.push("티커 없는 종목 " + noTicker.length + "개 (수정해서 티커를 넣으면 자동 갱신)");
  if (marketLastApplyResult && marketLastApplyResult.linked.length > 0) {
    parts.push("종목명으로 티커를 찾아 연결: " + marketLastApplyResult.linked.join(", "));
  }
  assetMarketStatus.textContent = parts.join(" · ");
}

// 티커 자동 완성: "QQQ — Invesco QQQ Trust" 처럼
function renderAssetTickerList() {
  assetTickerList.innerHTML = "";
  if (!marketData) return;
  Object.keys(marketData.stocks)
    .sort()
    .forEach(function (symbol) {
      const option = document.createElement("option");
      option.value = symbol.replace(/\.(KS|KQ)$/, "");
      option.label = marketData.stocks[symbol].name;
      assetTickerList.appendChild(option);
    });
}

// 다가오는 배당: 이번 달부터 3개월 동안 들어올 종목과 금액 (세전)
function renderAssetDivUpcoming() {
  assetDivUpcoming.innerHTML = "";
  const thisMonth = new Date().getMonth() + 1;
  for (let offset = 0; offset < 3; offset++) {
    const month = ((thisMonth - 1 + offset) % 12) + 1;
    const payers = [];
    assets.forEach(function (asset) {
      if (!(asset.dividendPerShare > 0)) return;
      const months = Array.isArray(asset.payMonths) && asset.payMonths.length > 0 ? asset.payMonths : [12];
      if (months.indexOf(month) === -1) return;
      payers.push({ name: asset.name, amount: (asset.dividendPerShare * asset.quantity) / months.length });
    });
    const li = document.createElement("li");
    li.className = "asset-upcoming";
    const title = document.createElement("strong");
    title.textContent = (offset === 0 ? "이번 달 (" + month + "월)" : month + "월");
    const total = payers.reduce(function (sum, payer) {
      return sum + payer.amount;
    }, 0);
    const amount = document.createElement("span");
    amount.className = "asset-upcoming-amount";
    amount.textContent = payers.length > 0 ? "약 " + formatMoney(Math.round(total)) : "배당 없음";
    const names = document.createElement("span");
    names.className = "asset-upcoming-names";
    names.textContent = payers
      .map(function (payer) {
        return payer.name + " " + formatMoney(Math.round(payer.amount));
      })
      .join(" · ");
    li.append(title, amount, names);
    assetDivUpcoming.appendChild(li);
  }
}

function renderAssetMarketAll() {
  renderAssetMarketStatus();
  renderAssetDivUpcoming();
}

// =============================================
// 이벤트 처리
// =============================================

assetAutoPriceToggle.addEventListener("change", function () {
  marketSettings.autoPrice = assetAutoPriceToggle.checked;
  // 켜는 순간 지금 시세를 바로 적용
  if (marketSettings.autoPrice && marketData) {
    applyMarketToAssets();
  }
  saveMarketSettings();
  renderAssetMarketStatus();
});

assetAutoDivToggle.addEventListener("change", function () {
  marketSettings.autoDividend = assetAutoDivToggle.checked;
  saveMarketSettings();
});

// "지금 적용": 자동 갱신을 꺼 둔 사람도 원할 때 한 번에
assetApplyBtn.addEventListener("click", async function () {
  assetApplyBtn.disabled = true;
  await refreshMarketData(true);
  const result = applyMarketToAssets();
  assetApplyBtn.disabled = false;
  renderAssetMarketStatus();
  if (!marketData) return;
  alert(
    (result.linked.length > 0 ? "종목명으로 티커를 찾아 연결: " + result.linked.join(", ") + "\n" : "") +
    result.updated + "개 종목의 현재가" + (marketSettings.autoDividend ? "·배당" : "") + "을 최신 시세로 바꿨어요." +
      (result.missing.length > 0 ? "\n시세를 못 찾은 티커: " + result.missing.join(", ") : "")
  );
});

document.addEventListener("market-updated", function () {
  renderAssetTickerList();
  renderAssetMarketAll();
});
// 종목을 고치면 상태·다가오는 배당도 다시
document.addEventListener("data-saved", function (event) {
  if (event.detail.key === ASSET_STORAGE_KEY) renderAssetMarketAll();
});

// 시작: 시세를 받아 옴 (받으면 market.js가 자동 적용 → 화면이 다시 그려짐)
renderAssetMarketAll();
refreshMarketData(false);

// 금융자산 작은 탭 (common.js)
setupSubTabs("assets", "summary");
