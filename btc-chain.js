// =============================================
// 비트코인 탭 — 시장 정보 ③ 반감기 + 실시간 블록
// mempool.space 공개 정보로 현재 블록 번호, 방금 채굴된 블록,
// 채굴을 기다리는 블록(예상), 추천 수수료를 보여 줌
// (자동 갱신 도구와 btcDomesticPrice는 btc.js)
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

const BTC_MEMPOOL_API = "https://mempool.space/api";
const BTC_MEMPOOL_SITE = "https://mempool.space";
// mempool.space가 안 될 때 현재 블록 번호만이라도 받을 곳
const BTC_BLOCKSTREAM_TIP_URL = "https://blockstream.info/api/blocks/tip/height";

// 블록은 30초마다, 난이도 조정 정보는 5분마다
const BTC_BLOCKS_EVERY_MS = 30000;
const BTC_DIFFICULTY_EVERY_MS = 5 * 60 * 1000;

// 화면에 보여 줄 블록 수
const BTC_PENDING_COUNT = 3; // 채굴 대기 (예상)
const BTC_MINED_COUNT = 6; // 방금 채굴된

// 블록 하나의 최대 크기: 무게 400만 = 가상 크기(vB) 100만
const BTC_MAX_BLOCK_WEIGHT = 4000000;
const BTC_MAX_BLOCK_VSIZE = 1000000;

// 보통 송금 1건의 크기 (수수료를 원화로 어림할 때)
const BTC_TYPICAL_TX_VBYTES = 140;

// 반감기: 21만 블록마다 보상이 절반
const BTC_HALVING_INTERVAL = 210000;
const BTC_FIRST_REWARD = 50;
const BTC_BLOCK_MS = 10 * 60 * 1000; // 목표 블록 간격 10분
// 지난 반감기 기록
const BTC_HALVINGS = [
  { height: 210000, date: "2012-11-28", reward: 25 },
  { height: 420000, date: "2016-07-09", reward: 12.5 },
  { height: 630000, date: "2020-05-11", reward: 6.25 },
  { height: 840000, date: "2024-04-20", reward: 3.125 },
];
// 4번째 반감기 블록이 나온 시각 (인터넷이 안 될 때 현재 블록 번호를 어림하는 기준)
const BTC_LAST_HALVING_TIME = Date.UTC(2024, 3, 20, 0, 9);

// =============================================
// 2. 상태
// =============================================

let btcTipHeight = null; // 현재 블록 번호 (받아 오기 전에는 null)
let btcAvgBlockMs = null; // 최근 평균 블록 간격 (난이도 조정 정보에서)
let btcLastMinedHeight = null; // 새 블록이 나왔는지 비교용
let btcDifficulty = null; // 난이도 조정 정보

// =============================================
// 화면 요소
// =============================================

const btcHalvingTitle = document.getElementById("btc-halving-title");
const btcHalvingDday = document.getElementById("btc-halving-dday");
const btcHalvingDate = document.getElementById("btc-halving-date");
const btcHalvingBar = document.getElementById("btc-halving-bar");
const btcHalvingProgress = document.getElementById("btc-halving-progress");
const btcHalvingHeight = document.getElementById("btc-halving-height");
const btcHalvingReward = document.getElementById("btc-halving-reward");
const btcHalvingList = document.getElementById("btc-halving-list");
const btcHalvingNote = document.getElementById("btc-halving-note");

const btcBlocksBox = document.getElementById("btc-blocks");
const btcFeeBox = document.getElementById("btc-fees");
const btcMempoolInfo = document.getElementById("btc-mempool-info");
const btcBlocksStatus = document.getElementById("btc-blocks-status");

// =============================================
// 3. 계산
// =============================================

// 반감기 정보 계산
function calculateBtcHalving(height, avgBlockMs) {
  const era = Math.floor(height / BTC_HALVING_INTERVAL); // 지금까지 반감기 횟수
  const nextHeight = (era + 1) * BTC_HALVING_INTERVAL;
  const remaining = nextHeight - height;
  const reward = BTC_FIRST_REWARD / Math.pow(2, era);
  return {
    number: era + 1, // 다음 반감기가 몇 번째인지
    nextHeight: nextHeight,
    remaining: remaining,
    progress: ((height - era * BTC_HALVING_INTERVAL) / BTC_HALVING_INTERVAL) * 100,
    reward: reward,
    nextReward: reward / 2,
    eta: Date.now() + remaining * avgBlockMs, // 예상 시각
  };
}

// 인터넷 없이 어림한 현재 블록 번호 (10분에 1개라고 보고)
function estimateBtcHeight() {
  return 840000 + Math.floor((Date.now() - BTC_LAST_HALVING_TIME) / BTC_BLOCK_MS);
}

// 몇 초 전인지 → "방금", "3분 전", "2시간 전"
function formatBtcAgo(seconds) {
  if (seconds < 60) return "방금";
  if (seconds < 3600) return Math.floor(seconds / 60) + "분 전";
  return Math.floor(seconds / 3600) + "시간 전";
}

// 수수료율 글자 (10 미만은 소수점 한 자리)
function formatBtcFeeRate(rate) {
  return formatBtcDecimal(rate, rate < 10 ? 1 : 0); // btc.js
}

// 사토시 → "0.052 BTC"
function formatBtcSats(sats) {
  return formatBtcDecimal(sats / 100000000, 3) + " BTC";
}

// 남은 시간(ms) → "약 3일", "약 5시간"
function formatBtcDuration(ms) {
  const hours = ms / (60 * 60 * 1000);
  if (hours >= 48) return "약 " + Math.round(hours / 24) + "일";
  if (hours >= 1) return "약 " + Math.round(hours) + "시간";
  return "약 " + Math.max(1, Math.round(hours * 60)) + "분";
}

// =============================================
// 4. 화면 그리기
// =============================================

function renderBtcHalving() {
  const isEstimate = btcTipHeight === null;
  const height = isEstimate ? estimateBtcHeight() : btcTipHeight;
  const halving = calculateBtcHalving(height, btcAvgBlockMs || BTC_BLOCK_MS);

  btcHalvingTitle.textContent = "다음 반감기 (" + halving.number + "번째)";
  const days = Math.ceil((halving.eta - Date.now()) / BTC_DAY_MS); // BTC_DAY_MS: btc-chart.js
  btcHalvingDday.textContent = "D-" + days.toLocaleString("ko-KR");
  const eta = new Date(halving.eta);
  btcHalvingDate.textContent =
    eta.getFullYear() + "년 " + (eta.getMonth() + 1) + "월 " + eta.getDate() + "일쯤 · 블록 " + formatAmount(halving.nextHeight);

  btcHalvingBar.style.width = halving.progress.toFixed(1) + "%";
  btcHalvingProgress.textContent =
    "지난 반감기 이후 " + halving.progress.toFixed(1) + "% 지남 · 남은 블록 " + formatAmount(halving.remaining) + "개";

  btcHalvingHeight.textContent = (isEstimate ? "약 " : "") + formatAmount(height);
  btcHalvingReward.textContent = formatBtcDecimal(halving.reward, 8) + " → " + formatBtcDecimal(halving.nextReward, 8) + " BTC";

  btcHalvingNote.textContent = isEstimate
    ? "실제 블록 번호를 아직 받지 못해서 10분에 1블록으로 어림한 값이에요."
    : "예상 날짜는 최근 평균 블록 간격(" +
      (btcAvgBlockMs ? (btcAvgBlockMs / 60000).toFixed(1) + "분" : "10분") +
      ")으로 계산해서 조금씩 바뀌어요.";
}

// 지난 반감기 목록 (한 번만 그림)
function renderBtcHalvingList() {
  btcHalvingList.innerHTML = "";
  BTC_HALVINGS.forEach(function (halving, index) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = index + 1 + "번째 · " + halving.date.replace(/-/g, ".");
    const reward = document.createElement("span");
    reward.className = "btc-halving-reward";
    reward.textContent = formatBtcDecimal(halving.reward * 2, 8) + " → " + formatBtcDecimal(halving.reward, 8) + " BTC";
    li.append(name, reward);
    btcHalvingList.appendChild(li);
  });
}

// 블록 하나 (채굴 대기 / 채굴됨 공통 모양)
// info: { title, fee, range, total, count, foot, sub, fill(0~1), link, pending, isNew }
function createBtcBlock(info) {
  const block = document.createElement(info.link ? "a" : "div");
  block.className = "btc-block" + (info.pending ? " pending" : " mined") + (info.isNew ? " btc-block-new" : "");
  if (info.link) {
    block.href = info.link;
    block.target = "_blank";
    block.rel = "noopener";
  }
  // 아래에서부터 차오르는 색: 블록이 얼마나 꽉 찼는지
  const fill = document.createElement("span");
  fill.className = "btc-block-fill";
  fill.style.height = Math.round(Math.min(Math.max(info.fill, 0), 1) * 100) + "%";
  block.appendChild(fill);

  [
    ["btc-block-title", info.title],
    ["btc-block-fee", info.fee],
    ["btc-block-range", info.range],
    ["btc-block-total", info.total],
    ["btc-block-count", info.count],
    ["btc-block-foot", info.foot],
    ["btc-block-sub", info.sub],
  ].forEach(function (pair) {
    if (!pair[1]) return;
    const line = document.createElement("span");
    line.className = pair[0];
    line.textContent = pair[1];
    block.appendChild(line);
  });
  return block;
}

// 블록 줄: [대기 3 … 대기 1] | [방금 채굴 … 예전]
function renderBtcBlocks(pendingBlocks, minedBlocks) {
  const isFirst = btcBlocksBox.children.length === 0;
  const newest = minedBlocks[0] ? minedBlocks[0].height : null;
  const hasNewBlock = btcLastMinedHeight !== null && newest !== null && newest > btcLastMinedHeight;
  btcBlocksBox.innerHTML = "";

  // 대기 중인 블록: 가장 늦게 채굴될 것이 왼쪽 끝
  pendingBlocks
    .slice(0, BTC_PENDING_COUNT)
    .reverse()
    .forEach(function (block, reversedIndex, list) {
      const order = list.length - reversedIndex; // 1 = 다음 블록
      const range = Array.isArray(block.feeRange) && block.feeRange.length > 0 ? block.feeRange : null;
      btcBlocksBox.appendChild(
        createBtcBlock({
          title: order === 1 ? "다음 블록" : order + "번째 대기",
          fee: "~" + formatBtcFeeRate(Number(block.medianFee)) + " sat/vB",
          range: range ? formatBtcFeeRate(range[0]) + " - " + formatBtcFeeRate(range[range.length - 1]) + " sat/vB" : "",
          total: formatBtcSats(Number(block.totalFees)),
          count: formatAmount(Number(block.nTx)) + "건",
          foot: "약 " + order * 10 + "분 후",
          fill: Number(block.blockVSize) / BTC_MAX_BLOCK_VSIZE,
          pending: true,
        })
      );
    });

  // 가운데 구분선
  const divider = document.createElement("span");
  divider.className = "btc-blocks-divider";
  divider.setAttribute("aria-hidden", "true");
  btcBlocksBox.appendChild(divider);

  // 방금 채굴된 블록: 가장 최근 것이 구분선 바로 옆
  const nowSeconds = Date.now() / 1000;
  minedBlocks.slice(0, BTC_MINED_COUNT).forEach(function (block, index) {
    const extras = block.extras || {};
    const range = Array.isArray(extras.feeRange) && extras.feeRange.length > 0 ? extras.feeRange : null;
    btcBlocksBox.appendChild(
      createBtcBlock({
        title: "#" + formatAmount(block.height),
        fee: Number.isFinite(extras.medianFee) ? "~" + formatBtcFeeRate(extras.medianFee) + " sat/vB" : "",
        range: range ? formatBtcFeeRate(range[0]) + " - " + formatBtcFeeRate(range[range.length - 1]) + " sat/vB" : "",
        total: Number.isFinite(extras.totalFees) ? formatBtcSats(extras.totalFees) : "",
        count: formatAmount(Number(block.tx_count)) + "건",
        foot: formatBtcAgo(nowSeconds - Number(block.timestamp)),
        sub: extras.pool && extras.pool.name ? String(extras.pool.name) : "",
        fill: Number(block.weight) / BTC_MAX_BLOCK_WEIGHT,
        link: block.id ? BTC_MEMPOOL_SITE + "/block/" + encodeURIComponent(block.id) : null,
        isNew: hasNewBlock && index === 0,
      })
    );
  });

  // 처음 그릴 때: 구분선 근처(다음 블록과 최신 블록)가 보이게 가로 위치 맞춤
  if (isFirst) {
    btcBlocksBox.scrollLeft = Math.max(0, divider.offsetLeft - btcBlocksBox.clientWidth / 2);
  }
  if (newest !== null) {
    btcLastMinedHeight = newest;
  }
}

// 추천 수수료 4칸 (+ 보통 송금 1건이면 원화로 얼마쯤인지)
function renderBtcFees(fees) {
  btcFeeBox.innerHTML = "";
  [
    ["빠름", "다음 블록", fees.fastestFee],
    ["보통", "30분 안", fees.halfHourFee],
    ["느림", "1시간 안", fees.hourFee],
    ["최저", "여유 있게", fees.economyFee],
  ].forEach(function (item) {
    const rate = Number(item[2]);
    if (!Number.isFinite(rate)) return;
    const card = document.createElement("div");
    card.className = "btc-fee-card";
    const name = document.createElement("p");
    name.className = "btc-fee-name";
    name.textContent = item[0] + " · " + item[1];
    const value = document.createElement("p");
    value.className = "btc-fee-value";
    value.textContent = formatBtcFeeRate(rate) + " sat/vB";
    card.append(name, value);
    if (btcDomesticPrice) {
      const won = document.createElement("p");
      won.className = "btc-fee-won";
      won.textContent = "약 " + formatMoney((rate * BTC_TYPICAL_TX_VBYTES * btcDomesticPrice) / 100000000);
      card.appendChild(won);
    }
    btcFeeBox.appendChild(card);
  });
}

// 대기 중인 거래 수 + 다음 난이도 조정
function renderBtcMempoolInfo(mempool) {
  const parts = [];
  if (mempool && Number.isFinite(mempool.count)) {
    parts.push("채굴을 기다리는 거래 " + formatAmount(mempool.count) + "건");
  }
  if (btcDifficulty && Number.isFinite(btcDifficulty.remainingTime) && Number.isFinite(btcDifficulty.difficultyChange)) {
    parts.push(
      "다음 난이도 조정 " + formatBtcDuration(btcDifficulty.remainingTime) + " 뒤 (예상 " + formatPercent(btcDifficulty.difficultyChange) + ")"
    );
  }
  btcMempoolInfo.textContent = parts.join(" · ");
}

// =============================================
// 5. 데이터 받기 (자동 갱신 할 일)
// =============================================

// 블록·대기 블록·수수료·대기 거래 수를 동시에 받음
async function refreshBtcBlocks() {
  const results = await Promise.allSettled([
    fetchCryptoJson(BTC_MEMPOOL_API + "/v1/blocks"), // crypto.js
    fetchCryptoJson(BTC_MEMPOOL_API + "/v1/fees/mempool-blocks"),
    fetchCryptoJson(BTC_MEMPOOL_API + "/v1/fees/recommended"),
    fetchCryptoJson(BTC_MEMPOOL_API + "/mempool"),
  ]);
  const value = function (i) {
    return results[i].status === "fulfilled" ? results[i].value : null;
  };
  const mined = Array.isArray(value(0)) ? value(0) : null;
  const pending = Array.isArray(value(1)) ? value(1) : [];
  const fees = value(2);
  const mempool = value(3);

  if (mined && mined.length > 0) {
    btcTipHeight = Number(mined[0].height);
    renderBtcBlocks(pending, mined);
  } else {
    // 블록 목록을 못 받으면 블록 번호만이라도 다른 곳에서
    try {
      const height = Number(await fetchCryptoJson(BTC_BLOCKSTREAM_TIP_URL)); // 응답이 숫자 하나
      if (height > 0) btcTipHeight = height;
    } catch (error) {
      // 그래도 안 되면 어림값 유지
    }
  }
  if (fees) renderBtcFees(fees);
  renderBtcMempoolInfo(mempool);
  renderBtcHalving();

  if (mined) {
    btcBlocksStatus.textContent = getBtcClock() + " 갱신 · 30초마다 자동 · 출처: mempool.space";
    return true;
  }
  btcBlocksStatus.textContent = getBtcClock() + " mempool.space에 접속하지 못했어요. 잠시 뒤 다시 시도해요.";
  return false;
}

// 난이도 조정 정보: 평균 블록 간격(반감기 예상 날짜에 씀)과 다음 조정 예상
async function refreshBtcDifficulty() {
  try {
    const result = await fetchCryptoJson(BTC_MEMPOOL_API + "/v1/difficulty-adjustment");
    btcDifficulty = result;
    // 너무 이상한 값(1분 미만, 1시간 초과)은 쓰지 않음
    if (result.timeAvg > 60000 && result.timeAvg < 3600000) {
      btcAvgBlockMs = result.timeAvg;
    }
    renderBtcHalving();
    return true;
  } catch (error) {
    return false;
  }
}

// =============================================
// 시작
// =============================================

renderBtcHalvingList();
renderBtcHalving(); // 실제 블록 번호를 받기 전에는 어림값으로
addBtcTask(refreshBtcBlocks, BTC_BLOCKS_EVERY_MS);
addBtcTask(refreshBtcDifficulty, BTC_DIFFICULTY_EVERY_MS);

// 모든 할 일을 등록했으니, 지금 비트코인 탭이면 자동 갱신 시작 (btc.js)
updateBtcTimer();
