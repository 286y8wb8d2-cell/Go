// =============================================
// 가계부 "실제 지출" — 카드 명세서 파일을 읽어 분류하고, 계획(카드 예산)과 비교
// - 카드사에서 받은 이용내역 파일: .csv / .xls(웹페이지 표 모양 포함) / .xlsx
//   엑셀 진짜 파일(.xlsx, 옛 .xls)은 읽는 도구(SheetJS)를 그때만 불러옴
// - 파일은 이 휴대폰 안에서만 읽음. 결과도 이 기기에만 저장 (백업 파일에는 포함)
// - 할부 결제는 가계부의 "할부" 항목으로 이미 계산하므로 이번 달 지출에서 뺌
// ※ 이름은 모두 budgetCard~ / BUDGET_CARD~ 로 시작
// budget.js 뒤에 불러옴
// =============================================

// =============================================
// 1. 상수
// =============================================

const BUDGET_CARD_KEY = "household-card"; // { tx: [...], cats: { 가맹점: 분류 }, budget: 한 달 카드 예산 }
const BUDGET_CARD_SHEETJS = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const BUDGET_CARD_KEEP_MONTHS = 24; // 이보다 오래된 내역은 지움

// 분류: 이름 → 색 (검증된 팔레트 순서), 가맹점 이름에 들어 있는 말로 자동 분류 (위에서부터 먼저 맞는 것)
const BUDGET_CARD_CATS = [
  { key: "subs", name: "구독·통신", color: "#6250d6", words: ["넷플릭스", "NETFLIX", "유튜브", "YOUTUBE", "GOOGLE", "구글", "APPLE", "애플", "디즈니", "티빙", "웨이브", "왓챠", "멜론", "스포티파이", "SPOTIFY", "쿠팡와우", "밀리의서재", "SKT", "SK텔레콤", "KT ", "LGU", "LG U", "통신", "CHATGPT", "OPENAI", "CLAUDE", "ANTHROPIC"] },
  { key: "cafe", name: "카페·간식", color: "#eb6834", words: ["스타벅스", "투썸", "이디야", "커피", "카페", "메가엠지씨", "메가커피", "컴포즈", "빽다방", "파리바게뜨", "뚜레쥬르", "베이커리", "배스킨", "던킨", "할리스", "폴바셋"] },
  { key: "food", name: "식비", color: "#2a78d6", words: ["배달의민족", "배민", "요기요", "쿠팡이츠", "식당", "음식", "김밥", "치킨", "피자", "맥도날드", "버거킹", "롯데리아", "맘스터치", "국밥", "고기", "횟집", "분식", "반점", "푸드", "한식", "중식", "일식", "갈비", "삼겹", "족발", "냉면", "초밥", "돈까스", "쌀국수", "식육", "BHC", "BBQ", "교촌"] },
  { key: "mart", name: "생활·마트", color: "#e87ba4", words: ["이마트", "홈플러스", "롯데마트", "코스트코", "GS25", "지에스25", "CU", "씨유", "세븐일레븐", "이마트24", "편의점", "마트", "슈퍼", "하나로", "다이소", "노브랜드"] },
  { key: "transport", name: "교통·차량", color: "#1baf7a", words: ["택시", "카카오T", "카카오모빌리티", "티머니", "버스", "지하철", "코레일", "KTX", "SRT", "주유", "오일", "칼텍스", "SK에너지", "S-OIL", "에쓰오일", "주차", "하이패스", "고속도로", "도로공사", "쏘카", "타다"] },
  { key: "shopping", name: "쇼핑", color: "#eda100", words: ["쿠팡", "네이버페이", "NAVER", "11번가", "G마켓", "지마켓", "옥션", "무신사", "올리브영", "29CM", "SSG", "신세계", "롯데백화점", "현대백화점", "에이블리", "지그재그", "알리익스프레스", "ALIEXPRESS", "테무", "TEMU", "이케아"] },
  { key: "health", name: "병원·약국", color: "#008300", words: ["병원", "의원", "약국", "치과", "한의원", "안과", "피부과", "내과", "정형외과", "이비인후과", "검진"] },
  { key: "etc", name: "기타", color: "#e34948", words: [] },
];

// =============================================
// 2. 저장/불러오기
// =============================================

function loadBudgetCard() {
  const data = { tx: [], cats: {}, budget: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(BUDGET_CARD_KEY));
    if (saved && typeof saved === "object") {
      if (Array.isArray(saved.tx)) {
        data.tx = saved.tx.filter(function (t) {
          return t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && typeof t.merchant === "string" && Number.isFinite(t.amount);
        });
      }
      if (saved.cats && typeof saved.cats === "object") data.cats = saved.cats;
      if (Number.isFinite(saved.budget) && saved.budget >= 0) data.budget = saved.budget;
    }
  } catch (error) {
    // 깨져 있으면 빈 내역
  }
  return data;
}

let budgetCard = loadBudgetCard();
let budgetCardMonth = null; // 화면에서 고른 달 "2026-10"

function saveBudgetCard() {
  try {
    localStorage.setItem(BUDGET_CARD_KEY, JSON.stringify(budgetCard));
  } catch (error) {
    alert("저장하지 못했어요. 저장 공간을 확인해 주세요.");
  }
  document.dispatchEvent(new CustomEvent("data-saved", { detail: { key: BUDGET_CARD_KEY } }));
}

// =============================================
// 3. 파일 읽기 → 표(줄마다 칸 목록)
// =============================================

// 글자 파일: UTF-8로 읽어 보고 글자가 깨지면 EUC-KR(국내 카드사 CSV에 흔함)로
function decodeBudgetCardText(buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (utf8.indexOf("�") === -1) return utf8;
  try {
    return new TextDecoder("euc-kr").decode(buffer);
  } catch (error) {
    return utf8;
  }
}

// CSV 한 덩어리 → [[칸, 칸, ...], ...] (따옴표 안의 쉼표·줄바꿈도 처리)
function parseBudgetCardCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// 웹페이지 표 모양(.xls로 저장된 HTML) → 줄 목록
function parseBudgetCardHtml(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return Array.from(doc.querySelectorAll("tr")).map(function (tr) {
    return Array.from(tr.querySelectorAll("th,td")).map(function (cell) {
      return cell.textContent.replace(/\s+/g, " ").trim();
    });
  });
}

// 진짜 엑셀 파일: SheetJS를 처음 쓸 때만 불러옴
let budgetCardSheetJs = null;
function loadBudgetCardSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (budgetCardSheetJs) return budgetCardSheetJs;
  budgetCardSheetJs = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = BUDGET_CARD_SHEETJS;
    script.onload = function () {
      resolve(window.XLSX);
    };
    script.onerror = function () {
      budgetCardSheetJs = null;
      reject(new Error("엑셀 읽기 도구를 불러오지 못했어요 (인터넷 연결 확인)"));
    };
    document.head.appendChild(script);
  });
  return budgetCardSheetJs;
}

async function readBudgetCardFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 8));
  // xlsx(PK..) 또는 옛 엑셀(D0 CF 11 E0)
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (isZip || isOle) {
    const XLSX = await loadBudgetCardSheetJs();
    const book = XLSX.read(buffer, { type: "array", cellDates: true });
    let rows = [];
    book.SheetNames.forEach(function (name) {
      rows = rows.concat(XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: true, defval: "" }));
    });
    return rows;
  }
  const text = decodeBudgetCardText(buffer);
  if (/<table/i.test(text)) return parseBudgetCardHtml(text);
  return parseBudgetCardCsv(text);
}

// =============================================
// 4. 표 → 거래 목록
// =============================================

const BUDGET_CARD_HEADS = {
  date: ["이용일", "거래일", "승인일", "사용일", "이용일자", "거래일자", "승인일자", "사용일자", "일자", "날짜", "이용일시", "거래일시", "승인일시"],
  merchant: ["가맹점", "이용처", "사용처", "상호", "이용하신곳", "가맹점명", "내용", "적요", "거래처"],
  // 앞에 있을수록 먼저 고름 (결제 예정 금액보다 실제 이용 금액)
  amount: ["이용금액", "승인금액", "사용금액", "거래금액", "결제금액", "금액", "원금"],
  status: ["취소", "상태", "승인구분", "구분", "거래구분"],
  installment: ["할부", "개월"],
};

function findBudgetCardColumn(header, words, exclude) {
  for (const word of words) {
    const index = header.findIndex(function (cell, i) {
      return exclude.indexOf(i) === -1 && String(cell).replace(/\s/g, "").indexOf(word) !== -1;
    });
    if (index !== -1) return index;
  }
  return -1;
}

// 날짜 칸 → "2026-10-19" (엑셀 날짜·숫자 날짜·"10.19"처럼 연도 없는 것도)
function parseBudgetCardDate(value, fallbackYear) {
  if (value instanceof Date && !isNaN(value)) {
    return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
  }
  if (typeof value === "number" && value > 30000 && value < 80000) {
    // 엑셀 날짜 번호 (1900년부터 센 날 수)
    return parseBudgetCardDate(new Date(Math.round((value - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000), fallbackYear);
  }
  const text = String(value || "").trim();
  let m = text.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  m = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = text.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return "20" + m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  m = text.match(/^(\d{1,2})[.\-/월]\s*(\d{1,2})/);
  if (m) return fallbackYear + "-" + m[1].padStart(2, "0") + "-" + m[2].padStart(2, "0");
  return "";
}

function parseBudgetCardAmount(value) {
  if (typeof value === "number") return value;
  const text = String(value || "").replace(/[,원\s]/g, "");
  const negative = /^\(.*\)$/.test(text) || text.indexOf("-") === 0;
  const number = Number(text.replace(/[()\-]/g, ""));
  return Number.isFinite(number) ? (negative ? -number : number) : NaN;
}

// 줄 목록 → { list: [{ date, merchant, amount, installment }], skipped }
function extractBudgetCardRows(rows) {
  // 제목 줄 찾기: 날짜·금액 칸 이름이 둘 다 있는 줄
  let headerIndex = -1;
  let cols = null;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const header = rows[i].map(function (cell) {
      return String(cell);
    });
    const date = findBudgetCardColumn(header, BUDGET_CARD_HEADS.date, []);
    const amount = findBudgetCardColumn(header, BUDGET_CARD_HEADS.amount, [date]);
    if (date !== -1 && amount !== -1) {
      const merchant = findBudgetCardColumn(header, BUDGET_CARD_HEADS.merchant, [date, amount]);
      cols = {
        date: date,
        amount: amount,
        merchant: merchant,
        status: findBudgetCardColumn(header, BUDGET_CARD_HEADS.status, [date, amount, merchant]),
        installment: findBudgetCardColumn(header, BUDGET_CARD_HEADS.installment, [date, amount, merchant]),
      };
      headerIndex = i;
      break;
    }
  }
  if (!cols) throw new Error("날짜·금액 칸을 찾지 못했어요. 카드사의 '이용내역' 파일인지 확인해 주세요.");

  const year = new Date().getFullYear();
  const list = [];
  let skipped = 0;
  rows.slice(headerIndex + 1).forEach(function (row) {
    const date = parseBudgetCardDate(row[cols.date], year);
    let amount = parseBudgetCardAmount(row[cols.amount]);
    if (!date || !Number.isFinite(amount) || amount === 0) {
      if (row.some(function (cell) { return String(cell).trim() !== ""; })) skipped++;
      return;
    }
    const status = cols.status !== -1 ? String(row[cols.status]) : "";
    if (/취소/.test(status) && amount > 0) amount = -amount;
    const installmentText = cols.installment !== -1 ? String(row[cols.installment]) : "";
    const months = Number((installmentText.match(/\d+/) || ["0"])[0]);
    list.push({
      date: date,
      merchant: (cols.merchant !== -1 ? String(row[cols.merchant]) : "").replace(/\s+/g, " ").trim() || "(이름 없음)",
      amount: Math.round(amount),
      installment: months > 1 ? months : 0,
    });
  });
  return { list: list, skipped: skipped };
}

// 가맹점 이름 → 분류 (직접 바꾼 적 있으면 그 분류)
function getBudgetCardCat(merchant) {
  if (budgetCard.cats[merchant]) return budgetCard.cats[merchant];
  const upper = merchant.toUpperCase();
  for (const cat of BUDGET_CARD_CATS) {
    if (cat.words.some(function (word) {
      return upper.indexOf(word.toUpperCase()) !== -1;
    })) return cat.key;
  }
  return "etc";
}

function getBudgetCardCatInfo(key) {
  return BUDGET_CARD_CATS.find(function (cat) {
    return cat.key === key;
  }) || BUDGET_CARD_CATS[BUDGET_CARD_CATS.length - 1];
}

// 새 내역 합치기: 같은 날·가맹점·금액이 이미 있으면 건너뜀 (같은 파일을 두 번 불러와도 두 번 세지 않게)
function mergeBudgetCardRows(list) {
  const counts = {};
  budgetCard.tx.forEach(function (t) {
    const key = t.date + "|" + t.merchant + "|" + t.amount;
    counts[key] = (counts[key] || 0) + 1;
  });
  const seen = {};
  let added = 0;
  list.forEach(function (row, index) {
    const key = row.date + "|" + row.merchant + "|" + row.amount;
    seen[key] = (seen[key] || 0) + 1;
    // 파일 안에서 같은 거래가 여러 번이면 그 횟수만큼은 인정
    if (seen[key] <= (counts[key] || 0)) return;
    budgetCard.tx.push({ id: Date.now().toString(36) + "-" + index, date: row.date, merchant: row.merchant, amount: row.amount, installment: row.installment });
    added++;
  });
  // 오래된 내역 정리 + 날짜순
  const oldest = addBudgetMonths(getBudgetThisMonth(), -BUDGET_CARD_KEEP_MONTHS); // budget.js
  budgetCard.tx = budgetCard.tx
    .filter(function (t) {
      return t.date.slice(0, 7) > oldest;
    })
    .sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
  return added;
}

// =============================================
// 5. 계산 (다른 파일도 씀: dash-report.js)
// =============================================

// 그달 내역과 합계 → { month, tx, total(할부 제외), installmentTotal, byCat: { food: 금액 } }
function getBudgetCardMonth(month) {
  const tx = budgetCard.tx.filter(function (t) {
    return t.date.slice(0, 7) === month;
  });
  const byCat = {};
  let total = 0;
  let installmentTotal = 0;
  tx.forEach(function (t) {
    if (t.installment > 1) {
      installmentTotal += t.amount;
      return;
    }
    total += t.amount;
    const cat = getBudgetCardCat(t.merchant);
    byCat[cat] = (byCat[cat] || 0) + t.amount;
  });
  return { month: month, tx: tx, total: total, installmentTotal: installmentTotal, byCat: byCat };
}

// 내역이 있는 달 목록 (최근 것부터)
function getBudgetCardMonths() {
  const months = {};
  budgetCard.tx.forEach(function (t) {
    months[t.date.slice(0, 7)] = true;
  });
  return Object.keys(months).sort().reverse();
}

// 카드 예산: 직접 정한 값, 없으면 가계부의 생활비 묶음 합계
function getBudgetCardBudget() {
  if (budgetCard.budget > 0) return budgetCard.budget;
  const month = getBudgetThisMonth();
  return budget.items // budget.js
    .filter(function (item) {
      return item.group === "living" && isBudgetItemActive(item, month);
    })
    .reduce(function (sum, item) {
      return sum + item.amount;
    }, 0);
}

// =============================================
// 6. 화면
// =============================================

const budgetCardImportBtn = document.getElementById("card-import-btn");
const budgetCardFileInput = document.getElementById("card-file-input");
const budgetCardImportStatus = document.getElementById("card-import-status");
const budgetCardEmpty = document.getElementById("card-empty");
const budgetCardContent = document.getElementById("card-content");
const budgetCardMonthTitle = document.getElementById("card-month-title");
const budgetCardMonthChips = document.getElementById("card-month-chips");
const budgetCardTotal = document.getElementById("card-total");
const budgetCardBudgetValue = document.getElementById("card-budget-value");
const budgetCardVsPrev = document.getElementById("card-vs-prev");
const budgetCardBudgetBar = document.getElementById("card-budget-bar");
const budgetCardBudgetNote = document.getElementById("card-budget-note");
const budgetCardBudgetForm = document.getElementById("card-budget-form");
const budgetCardBudgetInput = document.getElementById("card-budget-input");
const budgetCardCatBar = document.getElementById("card-cat-bar");
const budgetCardCatLegend = document.getElementById("card-cat-legend");
const budgetCardTopList = document.getElementById("card-top-list");
const budgetCardTxList = document.getElementById("card-tx-list");
const budgetCardDeleteMonth = document.getElementById("card-delete-month");

// "2026-10" → "10월" (올해가 아니면 "25년 10월")
function formatBudgetCardMonth(month) {
  const thisYear = String(new Date().getFullYear());
  return (month.slice(0, 4) === thisYear ? "" : month.slice(2, 4) + "년 ") + Number(month.slice(5, 7)) + "월";
}

function renderBudgetCard() {
  const months = getBudgetCardMonths();
  budgetCardEmpty.hidden = months.length > 0;
  budgetCardContent.hidden = months.length === 0;
  if (months.length === 0) return;
  if (!budgetCardMonth || months.indexOf(budgetCardMonth) === -1) budgetCardMonth = months[0];

  // 달 고르기 (최근 6개월)
  budgetCardMonthChips.innerHTML = "";
  months.slice(0, 6).forEach(function (month) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip-btn";
    chip.textContent = formatBudgetCardMonth(month);
    chip.setAttribute("aria-pressed", String(month === budgetCardMonth));
    chip.addEventListener("click", function () {
      budgetCardMonth = month;
      renderBudgetCard();
    });
    budgetCardMonthChips.appendChild(chip);
  });

  const data = getBudgetCardMonth(budgetCardMonth);
  const prev = getBudgetCardMonth(addBudgetMonths(budgetCardMonth, -1)); // budget.js
  const plan = getBudgetCardBudget();
  budgetCardMonthTitle.textContent = formatBudgetCardMonth(budgetCardMonth) + " 실제 지출";
  setShortMoney(budgetCardTotal, data.total); // common.js
  budgetCardBudgetValue.textContent = plan > 0 ? formatManwon(plan) : "없음";
  if (prev.tx.length > 0) {
    const diff = data.total - prev.total;
    budgetCardVsPrev.textContent = (diff > 0 ? "+" : "") + formatManwon(diff);
    // 지출은 늘면 나쁜 쪽이라 빨강(오름) 그대로 씀
    budgetCardVsPrev.className = getProfitClass(diff);
  } else {
    budgetCardVsPrev.textContent = "-";
    budgetCardVsPrev.className = "";
  }
  if (document.activeElement !== budgetCardBudgetInput) budgetCardBudgetInput.value = budgetCard.budget > 0 ? budgetCard.budget : "";

  // 예산 막대와 한 줄 평가
  const ratio = plan > 0 ? data.total / plan : 0;
  budgetCardBudgetBar.style.width = Math.min(100, ratio * 100).toFixed(1) + "%";
  budgetCardBudgetBar.classList.toggle("card-over", ratio > 1);
  const isThisMonth = budgetCardMonth === getBudgetThisMonth();
  let note = "";
  if (plan > 0) {
    if (ratio > 1) {
      note = "예산보다 " + formatManwon(data.total - plan) + " 더 썼어요.";
    } else if (isThisMonth) {
      // 이번 달은 지금까지 쓴 속도로 달 말을 어림
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const pace = (data.total / today.getDate()) * daysInMonth;
      note = "예산의 " + Math.round(ratio * 100) + "% 썼어요. 지금 속도면 이달 말 약 " + formatManwon(pace) +
        (pace > plan ? " (예산 초과 예상)" : " (예산 안)");
    } else {
      note = "예산 안에서 " + formatManwon(plan - data.total) + " 남겼어요.";
    }
  } else {
    note = "카드 예산을 정하면 계획과 비교해 드려요. (가계부에 '생활비' 묶음이 있으면 그 합계를 써요)";
  }
  if (data.installmentTotal > 0) note += " 할부 결제 " + formatManwon(data.installmentTotal) + "은 가계부 할부 항목으로 따로 계산해요.";
  budgetCardBudgetNote.textContent = note;
  budgetCardBudgetNote.className = "budget-note" + (ratio > 1 || (plan > 0 && isThisMonth && ratio > 0.9) ? " warn" : "");

  renderBudgetCardCats(data);
  renderBudgetCardTx(data);
}

// 분류별 막대 + 많이 쓴 가맹점
function renderBudgetCardCats(data) {
  budgetCardCatBar.innerHTML = "";
  budgetCardCatLegend.innerHTML = "";
  const positive = Math.max(1, data.total);
  BUDGET_CARD_CATS.forEach(function (cat) {
    const value = data.byCat[cat.key] || 0;
    if (value <= 0) return;
    const piece = document.createElement("span");
    piece.style.width = (value / positive) * 100 + "%";
    piece.style.background = cat.color;
    budgetCardCatBar.appendChild(piece);
    const li = document.createElement("li");
    const key = document.createElement("span");
    key.className = "alloc-swatch";
    key.style.background = cat.color;
    const name = document.createElement("span");
    name.className = "alloc-name";
    name.textContent = cat.name + " " + Math.round((value / positive) * 100) + "%";
    const amount = document.createElement("span");
    amount.className = "alloc-amount";
    amount.textContent = formatMoney(value);
    li.append(key, name, amount);
    budgetCardCatLegend.appendChild(li);
  });

  // 가맹점별 합계 상위 5곳
  const byMerchant = {};
  data.tx.forEach(function (t) {
    if (t.installment > 1) return;
    byMerchant[t.merchant] = byMerchant[t.merchant] || { amount: 0, count: 0 };
    byMerchant[t.merchant].amount += t.amount;
    byMerchant[t.merchant].count += 1;
  });
  budgetCardTopList.innerHTML = "";
  Object.keys(byMerchant)
    .sort(function (a, b) {
      return byMerchant[b].amount - byMerchant[a].amount;
    })
    .slice(0, 5)
    .forEach(function (merchant, index) {
      const li = document.createElement("li");
      const rank = document.createElement("span");
      rank.className = "card-top-rank";
      rank.textContent = index + 1;
      const name = document.createElement("span");
      name.className = "card-top-name";
      name.textContent = merchant;
      const count = document.createElement("small");
      count.textContent = byMerchant[merchant].count + "번";
      name.appendChild(count);
      const amount = document.createElement("strong");
      amount.textContent = formatMoney(byMerchant[merchant].amount);
      li.append(rank, name, amount);
      budgetCardTopList.appendChild(li);
    });
}

// 이용 내역 (분류 바꾸기)
function renderBudgetCardTx(data) {
  budgetCardTxList.innerHTML = "";
  data.tx.forEach(function (t) {
    const li = document.createElement("li");
    li.className = "card-tx";
    const text = document.createElement("span");
    text.className = "budget-edit-text";
    const name = document.createElement("strong");
    name.textContent = t.merchant;
    const sub = document.createElement("small");
    sub.textContent = t.date.slice(5).replace("-", ".") + (t.installment > 1 ? " · " + t.installment + "개월 할부" : "") + (t.amount < 0 ? " · 취소" : "");
    text.append(name, sub);
    const amount = document.createElement("span");
    amount.className = "budget-edit-amount" + (t.amount < 0 ? " profit-down" : "");
    amount.textContent = formatMoney(t.amount);
    const select = document.createElement("select");
    select.className = "card-cat-select";
    select.setAttribute("aria-label", t.merchant + " 분류");
    BUDGET_CARD_CATS.forEach(function (cat) {
      const option = document.createElement("option");
      option.value = cat.key;
      option.textContent = cat.name;
      select.appendChild(option);
    });
    select.value = getBudgetCardCat(t.merchant);
    select.disabled = t.installment > 1;
    select.addEventListener("change", function () {
      budgetCard.cats[t.merchant] = select.value;
      saveBudgetCard();
      renderBudgetCard();
    });
    li.append(text, amount, select);
    budgetCardTxList.appendChild(li);
  });
}

// =============================================
// 7. 이벤트 처리
// =============================================

budgetCardImportBtn.addEventListener("click", function () {
  budgetCardFileInput.click();
});

budgetCardFileInput.addEventListener("change", async function () {
  const file = budgetCardFileInput.files[0];
  budgetCardFileInput.value = "";
  if (!file) return;
  budgetCardImportStatus.textContent = "파일을 읽는 중…";
  try {
    const rows = await readBudgetCardFile(file);
    const result = extractBudgetCardRows(rows);
    if (result.list.length === 0) throw new Error("읽을 수 있는 거래가 없어요.");
    const added = mergeBudgetCardRows(result.list);
    saveBudgetCard();
    // 파일에서 가장 거래가 많은 달을 보여 줌
    const perMonth = {};
    result.list.forEach(function (row) {
      perMonth[row.date.slice(0, 7)] = (perMonth[row.date.slice(0, 7)] || 0) + 1;
    });
    budgetCardMonth = Object.keys(perMonth).sort(function (a, b) {
      return perMonth[b] - perMonth[a];
    })[0];
    budgetCardImportStatus.textContent =
      "거래 " + result.list.length + "건을 읽었어요" + (added < result.list.length ? " (이미 있던 " + (result.list.length - added) + "건은 건너뜀)" : "") +
      (result.skipped > 0 ? " · 읽지 못한 줄 " + result.skipped + "개" : "");
    renderBudgetCard();
  } catch (error) {
    budgetCardImportStatus.textContent = "읽지 못했어요: " + (error.message || error);
  }
});

budgetCardBudgetForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const value = budgetCardBudgetInput.value.trim() === "" ? 0 : Number(budgetCardBudgetInput.value);
  if (!(value >= 0)) {
    alert("예산은 0 이상으로 넣어 주세요. (비우면 가계부 생활비 합계를 써요)");
    return;
  }
  budgetCard.budget = value;
  saveBudgetCard();
  budgetCardBudgetInput.blur();
  renderBudgetCard();
});

budgetCardDeleteMonth.addEventListener("click", function () {
  if (!budgetCardMonth || !confirm(formatBudgetCardMonth(budgetCardMonth) + " 카드 내역을 모두 지울까요?")) return;
  budgetCard.tx = budgetCard.tx.filter(function (t) {
    return t.date.slice(0, 7) !== budgetCardMonth;
  });
  saveBudgetCard();
  budgetCardMonth = null;
  renderBudgetCard();
});

// 가계부 생활비가 바뀌면 예산(자동값)도 다시
document.addEventListener("data-saved", function (event) {
  if (event.detail.key === BUDGET_STORAGE_KEY) renderBudgetCard(); // budget.js
});

// 시작
renderBudgetCard();
