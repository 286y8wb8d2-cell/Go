// =============================================
// 자동 테스트 — 앱을 진짜 브라우저(크로미움)로 열어서 주요 기능이 망가지지 않았는지 확인
// 실행: (앱 폴더에서) python3 -m http.server 8765 &  →  node tests/run.cjs
// GitHub Actions(.github/workflows/test.yml)가 main에 올릴 때마다 자동으로 실행
// - 외부 시세 API·WebSocket은 tests/mocks.cjs의 가짜 응답으로 (인터넷 없이, 늘 같은 결과)
// - 테스트에 쓰는 숫자는 모두 지어낸 값 (개인 정보 없음)
// =============================================

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { install, fakeWs } = require("./mocks.cjs");

const BASE = process.env.APP_URL || "http://localhost:8765/index.html";
const FIX = path.join(__dirname, "fixtures");
const results = [];

function check(name, ok, detail) {
  results.push({ name: name, ok: Boolean(ok), detail: detail || "" });
  console.log((ok ? "  ✓ " : "  ✗ ") + name + (detail && !ok ? " — " + detail : ""));
}

// 테스트용 가짜 데이터
const SAMPLE = {
  "household-assets": [
    { id: "a1", name: "QQQ", kind: "us-stock", ticker: "QQQ", quantity: 2, avgPrice: 700000, currentPrice: 900000, dividendPerShare: 0, memo: "" },
    { id: "a2", name: "SCHD", kind: "etf", ticker: "SCHD", quantity: 20, avgPrice: 35000, currentPrice: 40000, dividendPerShare: 1400, memo: "" },
    { id: "a3", name: "비상금", kind: "cash", quantity: 1, avgPrice: 3000000, currentPrice: 3000000, dividendPerShare: 0, memo: "" },
  ],
  "household-crypto": [{ id: "c1", name: "비트코인", symbol: "BTC", quantity: 0.2, avgPrice: 100000000, currentPrice: 110000000, place: "", memo: "" }],
  "household-history": [{ month: "2026-09", assets: 4000000, crypto: 20000000, total: 24000000 }],
  "household-budget": {
    salary: 3000000, goal: 100000000, inflation: 2.5, horizon: 2030,
    scenarios: { low: 150000, base: 230000, high: 500000 },
    items: [
      { id: "i1", name: "생활비", amount: 600000, group: "living", start: "", end: "" },
      { id: "i2", name: "월세", amount: 500000, group: "housing", start: "", end: "" },
      { id: "i3", name: "휴대폰 할부", amount: 50000, group: "install", start: "", end: "2027-03" },
      { id: "i4", name: "적금", amount: 300000, group: "saving", start: "", end: "" },
    ],
    debts: [
      { id: "d1", name: "신용대출", balance: 10000000, rate: 6.5, kind: "amortize", monthly: 300000, maturity: "2029-12" },
      { id: "d2", name: "마이너스", balance: 2000000, rate: 5.5, kind: "interest", monthly: 0, maturity: addMonthsText(2) },
    ],
    events: [],
  },
};

function addMonthsText(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

async function newPage(browser, options) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }, options || {}));
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/ERR_|404|Failed to load/.test(m.text())) page.errors.push(m.text());
  });
  page.on("dialog", (d) => d.accept());
  await fakeWs(page);
  await install(page, options && options.mock);
  return page;
}

async function loadWith(page, data) {
  await page.goto(BASE);
  await page.evaluate((data) => {
    localStorage.clear();
    Object.keys(data).forEach((key) => localStorage.setItem(key, JSON.stringify(data[key])));
  }, data);
  await page.reload();
  await page.waitForTimeout(1500);
}

// ---------------------------------------------
// 1. 모든 탭·작은 탭을 라이트/다크로 열어 보기: 오류 없음, 옆으로 넘치지 않음
// ---------------------------------------------
async function testAllTabs(browser) {
  for (const scheme of ["light", "dark"]) {
    const page = await newPage(browser, { colorScheme: scheme });
    await loadWith(page, SAMPLE);
    let overflow = [];
    for (const tab of ["home", "budget", "assets", "crypto", "scenario"]) {
      await page.click(`.tab-btn[data-tab="${tab}"]`);
      await page.waitForTimeout(300);
      const subs = await page.$$eval(`#tab-${tab} [data-subtab], #tab-${tab} [data-btc-view]`, (b) => b.map((x) => x.dataset.subtab || x.dataset.btcView));
      for (const sub of subs.length ? subs : [null]) {
        if (sub) {
          await page.click(sub.includes(":") ? `[data-subtab="${sub}"]` : `[data-btc-view="${sub}"]`);
          await page.waitForTimeout(250);
        }
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        if (width > 390) overflow.push(tab + "/" + sub + "=" + width);
      }
    }
    check(scheme + ": 모든 탭 오류 없음", page.errors.length === 0, page.errors.join(" | "));
    check(scheme + ": 옆으로 넘치는 화면 없음", overflow.length === 0, overflow.join(", "));
    await page.context().close();
  }
}

// ---------------------------------------------
// 2. 홈: 순자산·할 일·리포트
// ---------------------------------------------
async function testHome(browser) {
  const page = await newPage(browser);
  await loadWith(page, SAMPLE);
  const label = await page.textContent("#dash-label");
  check("홈: 부채가 있으면 순자산으로 표시", /순자산/.test(label), label);
  const todos = await page.$$eval("#dash-todo-list li", (l) => l.map((x) => x.textContent));
  check("홈: 이번 달 할 일 나옴", todos.length > 0, String(todos.length));
  check("홈: 곧 오는 만기 알림", todos.some((t) => /마이너스 만기/.test(t)), todos.join(" / "));
  const report = await page.textContent("#dash-report-headline");
  check("홈: 월간 리포트 요약", /순자산이 약/.test(report), report);
  check("홈: 오류 없음", page.errors.length === 0, page.errors.join(" | "));
  await page.context().close();
}

// ---------------------------------------------
// 3. 가계부 실제 지출: 카드 명세서 CSV(EUC-KR)·웹페이지 표(.xls), 중복 건너뛰기, 취소·할부 처리
// ---------------------------------------------
async function testCard(browser) {
  const page = await newPage(browser);
  await loadWith(page, SAMPLE);
  await page.click('.tab-btn[data-tab="budget"]');
  await page.click('[data-subtab="budget:card"]');
  await page.setInputFiles("#card-file-input", path.join(FIX, "card-sample.csv"));
  await page.waitForTimeout(800);
  const status1 = await page.textContent("#card-import-status");
  check("카드: CSV 12건 읽음", /12건/.test(status1), status1);
  await page.setInputFiles("#card-file-input", path.join(FIX, "card-sample.csv"));
  await page.waitForTimeout(800);
  const status2 = await page.textContent("#card-import-status");
  check("카드: 같은 파일은 건너뜀", /이미 있던 12건/.test(status2), status2);
  await page.setInputFiles("#card-file-input", path.join(FIX, "card-sample.xls"));
  await page.waitForTimeout(800);
  check("카드: 웹페이지 표(.xls) 읽음", /5건/.test(await page.textContent("#card-import-status")));
  // 10월: 취소(-45,000)는 빼고 할부(1,200,000)는 제외 → 161,200원
  const total = await page.evaluate(() => getBudgetCardMonth("2026-10").total);
  check("카드: 10월 지출 합계 (취소 반영, 할부 제외)", total === 161200, String(total));
  check("카드: 오류 없음", page.errors.length === 0, page.errors.join(" | "));
  await page.context().close();
}

// ---------------------------------------------
// 4. 비트코인 매수 기록 → 평균 매입가, 보유 코인 잠금
// ---------------------------------------------
async function testTrades(browser) {
  const page = await newPage(browser);
  await loadWith(page, SAMPLE);
  await page.click('.tab-btn[data-tab="crypto"]');
  await page.click('[data-btc-view="market"]');
  await page.waitForTimeout(500);
  await page.click("#btc-trade-start-btn");
  await page.fill("#btc-trade-amount", "1000000");
  await page.dispatchEvent("#btc-trade-amount", "input");
  await page.fill("#btc-trade-price", "125000000");
  await page.dispatchEvent("#btc-trade-price", "input");
  check("매수 기록: 금액·체결가로 수량 자동 계산", (await page.inputValue("#btc-trade-qty")) === "0.008", await page.inputValue("#btc-trade-qty"));
  await page.click("#btc-trade-form button[type=submit]");
  await page.waitForTimeout(300);
  // (0.2 × 1억 + 0.008 × 1.25억) ÷ 0.208 = 100,961,538
  const synced = await page.evaluate(() => cryptos[0]);
  check("매수 기록: 평균 매입가·수량이 보유 코인에 반영", synced.quantity === 0.208 && synced.avgPrice === 100961538, JSON.stringify(synced));
  // 보유 코인 수정 시 수량·평단 칸은 잠김
  await page.evaluate(() => startCryptoEdit(cryptos[0]));
  check("매수 기록: 비트코인 수량 칸 잠김", await page.$eval("#crypto-quantity", (e) => e.readOnly));
  check("매수 기록: 오류 없음", page.errors.length === 0, page.errors.join(" | "));
  await page.context().close();
}

// ---------------------------------------------
// 5. 앱 잠금: 비밀번호 정하기 → 다시 열면 잠금 → 틀림/맞음
// ---------------------------------------------
async function testLock(browser) {
  const page = await newPage(browser);
  await loadWith(page, SAMPLE);
  const press = async (pin) => {
    for (const d of pin) await page.click(`[data-lock-key="${d}"]`);
    await page.waitForTimeout(150);
  };
  await page.click("#settings-btn");
  await page.click("#lock-set-btn");
  await press("2580");
  await press("2580");
  await page.reload();
  await page.waitForTimeout(800);
  check("잠금: 다시 열면 잠금 화면", await page.isVisible("#lock-screen"));
  check("잠금: 잠긴 동안 내용 가림", (await page.$eval("main", (e) => getComputedStyle(e).visibility)) === "hidden");
  await press("1111");
  check("잠금: 틀리면 안내", /달라요/.test(await page.textContent("#lock-message")));
  await press("2580");
  check("잠금: 맞으면 풀림", !(await page.isVisible("#lock-screen")));
  await page.click("#privacy-btn");
  check("금액 숨기기: 흐리게", (await page.$eval("#dash-total", (e) => getComputedStyle(e).filter)).includes("blur"));
  check("잠금: 오류 없음", page.errors.length === 0, page.errors.join(" | "));
  await page.context().close();
}

// ---------------------------------------------
// 6. 빠른 시세: 새 가격이 오면 금액이 바뀌고 "실시간" 표시
// ---------------------------------------------
async function testQuotes(browser) {
  let price = 640;
  const quotes = () => ({ updated: new Date().toISOString(), q: { QQQ: [price, 0.8, Math.floor(Date.now() / 1000), null, null] } });
  const page = await newPage(browser, { mock: { quotes: quotes } });
  await loadWith(page, SAMPLE);
  await page.click('.tab-btn[data-tab="assets"]');
  check("빠른 시세: 실시간 표시", /실시간/.test(await page.textContent("#asset-market-status")));
  const before = await page.evaluate(() => assets.find((a) => a.ticker === "QQQ").currentPrice);
  price = 660;
  await page.evaluate(() => refreshMarketQuotes());
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => assets.find((a) => a.ticker === "QQQ").currentPrice);
  check("빠른 시세: 새 가격으로 현재가 바뀜", after > before, before + " → " + after);
  check("빠른 시세: 오류 없음", page.errors.length === 0, page.errors.join(" | "));
  await page.context().close();
}

// ---------------------------------------------
// 7. 가로 화면 차트, 캘린더 파일, 세금·목표 비중 계산
// ---------------------------------------------
async function testMisc(browser) {
  const page = await newPage(browser);
  await loadWith(page, SAMPLE);
  await page.click('.tab-btn[data-tab="crypto"]');
  await page.click('[data-btc-view="chart"]');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  check("차트: 가로로 돌리면 화면 가득", await page.evaluate(() => document.body.classList.contains("btc-chart-full")));
  await page.setViewportSize({ width: 390, height: 844 });
  const cal = await page.evaluate(() => buildBudgetCalendar());
  check("캘린더: 앞으로 올 일정 .ics", cal.count > 0 && cal.text.includes("BEGIN:VCALENDAR") && cal.text.split("BEGIN:VEVENT").length - 1 === cal.count, String(cal.count));
  await page.click('.tab-btn[data-tab="scenario"]');
  await page.click('[data-subtab="scenario:tax"]');
  check("세금: 해외주식 손익 계산", /\+/.test(await page.textContent("#tax-unrealized")));
  await page.click('[data-subtab="scenario:rebal"]');
  check("목표 비중: 표 4줄", (await page.$$("#rebal-body tr")).length === 4);
  check("기타: 오류 없음", page.errors.length === 0, page.errors.join(" | "));
  await page.context().close();
}

// ---------------------------------------------
// 8. 인터넷 없이 열기 (서비스 워커)
// ---------------------------------------------
async function testOffline(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForTimeout(1000);
  check("오프라인: 인터넷 없이 열림", (await page.$$(".tab-btn")).length === 5);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  const tests = [testAllTabs, testHome, testCard, testTrades, testLock, testQuotes, testMisc, testOffline];
  for (const test of tests) {
    console.log("▶ " + test.name);
    try {
      await test(browser);
    } catch (error) {
      check(test.name + " 실행", false, String(error.message || error).split("\n")[0]);
    }
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " 통과");
  process.exit(failed.length > 0 ? 1 : 0);
})();
