// =============================================
// 가계부 일정 → 아이폰 캘린더 (.ics 파일)
// - 이벤트 탭의 "다가오는 일"(대출 만기·완납, 할부 끝, 반감기, 직접 넣은 일) 중 앞으로 올 것만
// - 알림: 대출 만기는 7일 전·하루 전, 나머지는 하루 전 아침 9시
// - 일마다 고정 번호(UID)를 붙여서 같은 파일을 다시 넣어도 캘린더에 겹치지 않음
// ※ 이름은 모두 budgetCal~ 로 시작
// budget.js 뒤에 불러옴
// =============================================

const budgetCalBtn = document.getElementById("budget-cal-btn");
const budgetCalShare = document.getElementById("budget-cal-share");

// 캘린더 글자 안의 특수문자 처리 (쉼표·세미콜론·줄바꿈)
function escapeBudgetCal(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}

// 같은 일이면 늘 같은 번호 (제목+날짜로 만든 짧은 해시)
function getBudgetCalUid(event) {
  const text = event.date + "|" + event.title;
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return "household-" + event.date.replace(/-/g, "") + "-" + (hash >>> 0).toString(36) + "@go-app";
}

// "다가오는 일" → .ics 글자
function buildBudgetCalendar() {
  const rows = simulateBudget(getBudgetMonthsToHorizon()); // budget.js
  const today = getToday(); // common.js
  const events = getBudgetEvents(rows).filter(function (event) {
    return event.date >= today;
  }); // budget.js
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//household//나의 자산//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:나의 자산"];
  events.forEach(function (event) {
    const start = event.date.replace(/-/g, "");
    const next = new Date(event.date + "T00:00:00");
    next.setDate(next.getDate() + 1);
    const end = next.getFullYear() + String(next.getMonth() + 1).padStart(2, "0") + String(next.getDate()).padStart(2, "0");
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + getBudgetCalUid(event),
      "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + start,
      "DTEND;VALUE=DATE:" + end,
      "SUMMARY:" + escapeBudgetCal(event.title),
      "DESCRIPTION:" + escapeBudgetCal((event.note || "") + "\n나의 자산 앱 가계부에서 넣은 일정")
    );
    // 종일 일정의 알림은 그날 0시 기준: -PT15H = 전날 아침 9시, -P6DT15H = 7일 전 아침 9시
    const alarms = /만기/.test(event.title) ? ["-P6DT15H", "-PT15H"] : ["-PT15H"];
    alarms.forEach(function (trigger) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + escapeBudgetCal(event.title), "TRIGGER:" + trigger, "END:VALARM");
    });
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return { text: lines.join("\r\n") + "\r\n", count: events.length };
}

// 아이폰: 캘린더 파일을 열면 "모두 추가" 화면이 뜸
budgetCalBtn.addEventListener("click", function () {
  const calendar = buildBudgetCalendar();
  if (calendar.count === 0) {
    alert("앞으로 올 일정이 없어요.");
    return;
  }
  const url = URL.createObjectURL(new Blob([calendar.text], { type: "text/calendar;charset=utf-8" }));
  // 내려받기가 아니라 "열기"로 → 아이폰 사파리가 캘린더 추가 화면을 보여 줌
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 60000);
});

// 캘린더 화면이 안 뜨면: 파일로 공유 (파일 앱에서 열거나 다른 기기로)
budgetCalShare.addEventListener("click", function () {
  const calendar = buildBudgetCalendar();
  if (calendar.count === 0) {
    alert("앞으로 올 일정이 없어요.");
    return;
  }
  shareFile("household-events.ics", calendar.text, "text/calendar"); // common.js
});
