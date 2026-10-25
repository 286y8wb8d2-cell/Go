// =============================================
// 기록 백업·복원 (workout.js 다음에 불러옴)
// 내보내기: wkState 전체를 .json 파일 하나로 (휴대폰은 공유 창 → 파일 앱·카톡 등에 저장)
// 불러오기: 그 파일을 골라 "합치기"(지금 기록 + 파일 기록) 또는 "바꾸기"
// 마지막 백업 날짜는 따로 저장 (불러오기로 덮이지 않게)
// =============================================

const WK_BK_APP = "daily-workout";
const WK_BK_VERSION = 1;
const WK_BK_LAST_KEY = "workout-last-backup";
const WK_BK_NAG_DAYS = 14; // 이만큼 지나면 위에 알림

function wkBkLast() {
  try {
    return localStorage.getItem(WK_BK_LAST_KEY) || "";
  } catch (e) {
    return "";
  }
}

// 백업할 게 있는지 (설정만 있고 기록이 없으면 알림 안 띄움)
function wkBkHasData(st) {
  return Object.keys(st.log || {}).length > 0 || Object.keys(st.lifts || {}).length > 0 || Object.keys(st.weeks || {}).length > 0;
}

function wkBkSummary(st) {
  const lifts = st.lifts || {};
  const liftCount = Object.keys(lifts).reduce((n, k) => n + lifts[k].length, 0);
  return {
    days: Object.keys(st.log || {}).length,
    weeks: Object.keys(st.weeks || {}).length,
    liftNames: Object.keys(lifts).length,
    liftCount: liftCount,
  };
}

// 파일 내용 검사 (다른 앱 파일·고장 난 파일이면 null)
function wkBkParse(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    return null;
  }
  if (!obj || obj.app !== WK_BK_APP || typeof obj.data !== "object" || !obj.data) return null;
  const d = obj.data;
  const isObj = (v) => v === undefined || (typeof v === "object" && v !== null && !Array.isArray(v));
  if (!isObj(d.weeks) || !isObj(d.log) || !isObj(d.lifts) || !isObj(d.profile)) return null;
  const weeksOk = Object.keys(d.weeks || {}).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(d.weeks[k].slots));
  const liftsOk = Object.keys(d.lifts || {}).every((k) => Array.isArray(d.lifts[k]) &&
    d.lifts[k].every((r) => typeof r.d === "string" && typeof r.kg === "number" && isFinite(r.kg)));
  if (!weeksOk || !liftsOk) return null;
  return obj;
}

// ---------- 내보내기 ----------
async function wkBkExport() {
  const now = new Date();
  const payload = { app: WK_BK_APP, version: WK_BK_VERSION, exportedAt: now.toISOString(), data: wkState };
  const text = JSON.stringify(payload, null, 1);
  const name = "workout-backup-" + wkDateKey(now) + ".json"; // 파일 이름은 영어로 (한글은 일부 브라우저에서 깨짐)
  let done = false;
  // 휴대폰: 공유 창으로 (파일 앱 저장, 카톡 나에게 보내기 등)
  try {
    const file = new File([text], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "운동 기록 백업" });
      done = true;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return; // 공유 창에서 취소
  }
  // 그 밖: 파일로 내려받기
  if (!done) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  try {
    localStorage.setItem(WK_BK_LAST_KEY, wkDateKey(now));
  } catch (e) { /* 저장 공간 문제는 무시 */ }
  wkRenderBackup("내보냈어요 ✓ 파일을 안전한 곳(파일 앱, 카톡 나에게 보내기 등)에 보관하세요.");
}

// ---------- 불러오기 ----------
let wkBkPending = null; // 고른 파일 (합치기/바꾸기 기다리는 중)

function wkBkPick(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const obj = wkBkParse(String(reader.result || ""));
    if (!obj) {
      wkBkPending = null;
      wkRenderBackup("이 파일은 워크아웃 백업 파일이 아니거나 망가졌어요. 다른 파일을 골라 주세요.", true);
      return;
    }
    wkBkPending = obj;
    wkRenderBackup();
  };
  reader.onerror = () => wkRenderBackup("파일을 읽지 못했어요. 다시 골라 주세요.", true);
  reader.readAsText(file);
}

// 합치기: 지금 기록을 지키면서 파일에만 있는 것을 더함
function wkBkMerge(cur, inc) {
  const out = JSON.parse(JSON.stringify(cur));
  if (!out.profile && inc.profile) out.profile = inc.profile;
  out.weeks = out.weeks || {};
  Object.keys(inc.weeks || {}).forEach((k) => {
    const a = out.weeks[k];
    const b = inc.weeks[k];
    const doneN = (w) => Object.keys(w.done || {}).length;
    if (!a || doneN(b) > doneN(a)) out.weeks[k] = b;
  });
  out.log = Object.assign({}, inc.log || {}, out.log || {});
  out.runs = Object.assign({}, inc.runs || {}, out.runs || {});
  out.lifts = out.lifts || {};
  Object.keys(inc.lifts || {}).forEach((name) => {
    const have = {};
    (out.lifts[name] || []).forEach((r) => (have[r.d] = true));
    const merged = (out.lifts[name] || []).concat(inc.lifts[name].filter((r) => !have[r.d]));
    merged.sort((x, y) => (x.d < y.d ? -1 : 1));
    out.lifts[name] = merged.slice(-40);
  });
  const minOf = (x, y) => (x == null ? y : y == null ? x : x < y ? x : y);
  out.firstWeek = minOf(out.firstWeek, inc.firstWeek);
  out.calStart = minOf(out.calStart, inc.calStart);
  if (!out.lastChoice && inc.lastChoice) out.lastChoice = inc.lastChoice;
  return out;
}

function wkBkApply(mode) {
  if (!wkBkPending) return;
  const inc = wkBkPending.data;
  wkState = mode === "replace" ? JSON.parse(JSON.stringify(inc)) : wkBkMerge(wkState, inc);
  if (!wkState.weeks) wkState.weeks = {};
  if (!wkState.log) wkState.log = {};
  if (wkState.lsdDay == null) wkState.lsdDay = 5;
  if (wkState.profile) wkApplyProfile(wkState.profile);
  wkBkPending = null;
  wkDraft = null;
  wkSave();
  wkRender();
  wkRenderBackup(mode === "replace" ? "파일 기록으로 바꿨어요 ✓" : "기록을 합쳤어요 ✓");
}

// ---------- 화면 ----------
function wkRenderBackup(msg, isError) {
  const box = document.getElementById("wk-backup");
  if (!box) return;
  const last = wkBkLast();
  const s = wkBkSummary(wkState);
  let html = `<h2>기록 백업</h2>
    <p class="wk-note">기록은 이 휴대폰 안에만 저장돼요. 앱을 지우거나, 폰을 바꾸거나, 홈 화면에 다시 추가하면 사라질 수 있어요. 가끔 내보내 두세요.</p>
    <p class="wk-bk-status">지금 기록: 운동한 날 <b>${s.days}일</b> · 주간 계획 <b>${s.weeks}주</b> · 무게 기록 <b>${s.liftNames}개 동작</b><br>
      마지막 백업: <b>${last ? wkShortDate(last) + " (" + wkBkAgo(last) + ")" : "아직 없어요"}</b></p>`;
  if (msg) html += `<p class="wk-bk-msg${isError ? " err" : ""}">${msg}</p>`;
  if (wkBkPending) {
    const p = wkBkSummary(wkBkPending.data);
    const when = (wkBkPending.exportedAt || "").slice(0, 10);
    html += `<div class="wk-bk-confirm">
      <p><b>${when ? wkShortDate(when) + "에 만든 " : ""}백업 파일</b><br>운동한 날 ${p.days}일 · 주간 계획 ${p.weeks}주 · 무게 기록 ${p.liftNames}개 동작 (${p.liftCount}번)</p>
      <button type="button" class="wk-primary" data-bk="merge">합치기 (추천)</button>
      <p class="wk-note">지금 기록은 그대로 두고, 파일에만 있는 기록을 더해요.</p>
      <button type="button" class="wk-ghost" data-bk="replace">바꾸기</button>
      <p class="wk-note">지금 기록을 지우고 파일 내용으로 바꿔요.</p>
      <button type="button" class="wk-ghost" data-bk="cancel">취소</button>
    </div>`;
  } else {
    html += `<div class="wk-bk-row">
      <button type="button" class="wk-bk-btn" data-bk="export">📤 내보내기</button>
      <label class="wk-bk-btn">📥 불러오기<input type="file" accept=".json,application/json" hidden data-bk-file></label>
    </div>`;
  }
  box.innerHTML = html;
  box.querySelectorAll("[data-bk]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.bk;
    if (k === "export") wkBkExport();
    else if (k === "merge") wkBkApply("merge");
    else if (k === "replace") {
      if (confirm("지금 기록을 모두 지우고 파일 내용으로 바꿀까요?")) wkBkApply("replace");
    } else {
      wkBkPending = null;
      wkRenderBackup();
    }
  }));
  const inp = box.querySelector("[data-bk-file]");
  if (inp) inp.addEventListener("change", () => {
    if (inp.files && inp.files[0]) wkBkPick(inp.files[0]);
  });
  wkRenderBackupNag();
}

function wkBkAgo(dk) {
  const days = Math.round((wkToday() - new Date(dk + "T00:00:00")) / 864e5);
  return days <= 0 ? "오늘" : days + "일 전";
}

// 위쪽 알림: 기록이 있는데 오래 백업 안 했으면
function wkRenderBackupNag() {
  const bar = document.getElementById("wk-backup-nag");
  if (!bar) return;
  const last = wkBkLast();
  const days = last ? Math.round((wkToday() - new Date(last + "T00:00:00")) / 864e5) : Infinity;
  const show = wkBkHasData(wkState) && days >= WK_BK_NAG_DAYS;
  bar.hidden = !show;
  if (show) {
    bar.querySelector("span").textContent = last ? `기록을 백업한 지 ${days}일 지났어요.` : "기록을 아직 백업하지 않았어요.";
  }
}

document.getElementById("wk-backup-nag-btn").addEventListener("click", () => {
  wkSetTab("more");
  document.getElementById("wk-backup").scrollIntoView({ behavior: "smooth" });
});
wkRenderBackup();
