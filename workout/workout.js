// =============================================
// 데일리 워크아웃: 주간 계획 만들기·저장·화면 그리기
// 저장: localStorage "workout-state" (이 기기에만)
// =============================================

const WK_KEY = "workout-state";
const WK_DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

// ---------- 날짜 ----------
function wkToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function wkDayIndex(d) {
  return (d.getDay() + 6) % 7; // 월=0 … 일=6
}
function wkMonday(d) {
  const m = new Date(d);
  m.setDate(m.getDate() - wkDayIndex(d));
  return m;
}
function wkDateKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
// 1970년부터 몇 번째 주인지 (주마다 동작이 돌아가게 하는 번호)
function wkAbsWeek(monday) {
  return Math.round(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) / 864e5 / 7);
}
function wkAddDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ---------- 저장 ----------
function wkLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(WK_KEY));
    if (s && s.weeks) {
      // 예전(v1) 기록: 주간 계획의 완료 표시를 달력 기록으로 옮김
      if (!s.log) {
        s.log = {};
        Object.keys(s.weeks).forEach((k) => {
          const w = s.weeks[k];
          const [y, m, d] = k.split("-").map(Number);
          w.slots.forEach((sl) => {
            if (w.done[sl.day]) s.log[wkDateKey(new Date(y, m - 1, d + sl.day))] = sl.type;
          });
        });
      }
      return s;
    }
  } catch (e) { /* 비어 있거나 깨짐 → 새로 */ }
  return { firstWeek: null, lsdDay: 5, weeks: {}, log: {} };
}
function wkSave() {
  try {
    // 너무 오래된 주는 정리 (최근 26주만)
    const keys = Object.keys(wkState.weeks).sort();
    while (keys.length > 26) delete wkState.weeks[keys.shift()];
    localStorage.setItem(WK_KEY, JSON.stringify(wkState));
  } catch (e) { /* 저장 공간 문제는 무시 */ }
}

let wkState = wkLoad();
if (wkState.profile) wkApplyProfile(wkState.profile);
const wkNow = wkToday();
const wkMon = wkMonday(wkNow);
const wkWeekKey = wkDateKey(wkMon);
const wkTodayIdx = wkDayIndex(wkNow);
let wkPick = null;        // 설정 화면에서 고른 일수
let wkViewDay = wkTodayIdx; // 계획 화면에서 보고 있는 요일

// ---------- 요일에 세션 놓기 ----------
// 오늘부터 일요일까지 남은 날 중에 고르게 펼치고, LSD는 고른 주말 요일에
function wkAvailDays(fromDay) {
  const avail = [];
  for (let d = fromDay; d < 7; d++) if (wkProfile.days[d]) avail.push(d);
  return avail;
}

function wkPlace(n, lsdDay, fromDay) {
  const types = wkTemplateFor(n);
  const avail = wkAvailDays(fromDay);
  const slots = [];
  const hasLsd = types.indexOf("lsd") >= 0;
  const hasRec = types.indexOf("recovery") >= 0;
  let lsdAt = -1;
  if (hasLsd) {
    lsdAt = avail.indexOf(lsdDay) >= 0 ? lsdDay : avail[avail.length - 1];
    slots.push({ day: lsdAt, type: "lsd" });
  }
  let main = types.filter((t) => t !== "lsd" && t !== "recovery");
  let rest = avail.filter((d) => d !== lsdAt);
  // 회복일: LSD 다음 날이 있으면 거기, 없으면 남은 날 맨 앞
  if (hasRec) {
    const after = rest.filter((d) => d > lsdAt);
    const recDay = after.length ? after[0] : rest[0];
    slots.push({ day: recDay, type: "recovery" });
    rest = rest.filter((d) => d !== recDay);
  }
  // 나머지는 LSD 전 날들에 고르게, 모자라면 뒤쪽 날까지
  const before = rest.filter((d) => d < lsdAt || lsdAt < 0);
  const after = rest.filter((d) => d > lsdAt && lsdAt >= 0);
  let pool = before;
  if (before.length < main.length) pool = before.concat(after);
  const k = main.length;
  const picked = [];
  for (let i = 0; i < k; i++) {
    let idx = Math.round(((i + 0.5) * pool.length) / k - 0.5);
    idx = Math.min(Math.max(idx, picked.length ? picked[picked.length - 1] + 1 : 0), pool.length - (k - i));
    picked.push(idx);
  }
  picked.forEach((idx, i) => slots.push({ day: pool[idx], type: main[i] }));
  slots.forEach((s) => (s.place = wkAutoPlace(s.type)));
  return slots.sort((a, b) => a.day - b.day);
}

// 근력 날 장소: 설정의 "어디서"에 따라 (둘 다면 하체·상체는 헬스장, 전신·서킷은 집)
function wkAutoPlace(type) {
  if (WK_STRENGTH_TYPES.indexOf(type) < 0) return "";
  const wh = wkProfile.where;
  if (wh === "gym") return "gym";
  if (wh === "both") return ["lower", "upper", "upperB"].indexOf(type) >= 0 ? "gym" : "home";
  return "home";
}

// ---------- 요일별로 직접 정하기 ----------
// choice[d] = "rest" | "run" | "home" | "gym" → 그날에 맞는 세션
const WK_KINDS = [["rest", "휴식"], ["run", "러닝"], ["home", "홈트"], ["gym", "헬스장"]];
const WK_RUN_ALL = ["runQ", "easy", "lsd", "combo"];

function wkPlanManual(choice, fromDay) {
  const runDays = [];
  const strDays = [];
  for (let d = fromDay; d < 7; d++) {
    if (choice[d] === "run") runDays.push(d);
    else if (choice[d] === "home" || choice[d] === "gym") strDays.push(d);
  }
  const slots = [];
  // 러닝: 가장 늦은 주말 러닝 날(없으면 마지막 러닝 날)은 LSD, 다른 하루는 포인트, 나머지는 이지
  let lsdDay = -1;
  if (runDays.length >= 2 || (runDays.length === 1 && wkProfile.race !== "none" && runDays[0] >= 5)) {
    const wkend = runDays.filter((d) => d >= 5);
    lsdDay = wkend.length ? wkend[wkend.length - 1] : runDays[runDays.length - 1];
  }
  let qUsed = false;
  runDays.forEach((d) => {
    let type = "easy";
    if (d === lsdDay) type = "lsd";
    else if (!qUsed && runDays.length >= 3) { type = "runQ"; qUsed = true; }
    else if (!qUsed && runDays.length === 2 && lsdDay >= 0) { type = "runQ"; qUsed = true; }
    slots.push({ day: d, type: type });
  });
  // 근력: 개수와 목표에 맞춰 하체·상체 골고루
  const types = wkStrengthList(strDays.length, runDays.length);
  strDays.forEach((d, i) => slots.push({ day: d, type: types[i], place: choice[d] }));
  // LSD 전날 하체는 피하기 (다른 근력 날과 바꿈)
  const before = slots.find((s) => s.day === lsdDay - 1 && s.type === "lower");
  const other = slots.find((s) => s.place && s.type !== "lower" && s.day !== lsdDay - 1);
  if (before && other) {
    const t = before.type;
    before.type = other.type;
    other.type = t;
  }
  return slots.sort((a, b) => a.day - b.day);
}

// 계획을 짠 뒤에 하루만 바꾸기
function wkChangeDay(week, d, kind) {
  const old = wkSlotOf(week, d);
  if (week.done[d]) wkLogSet(wkDateKey(wkAddDays(wkMon, d)), false);
  week.slots = week.slots.filter((s) => s.day !== d);
  wkClearDay(week, d);
  delete week.done[d];
  if (kind !== "rest") {
    let type;
    let place;
    if (kind === "run") {
      const hasLsd = week.slots.some((s) => s.type === "lsd");
      const hasQ = week.slots.some((s) => s.type === "runQ");
      type = !hasLsd && d >= 5 ? "lsd" : !hasQ && week.slots.some((s) => WK_RUN_ALL.indexOf(s.type) >= 0) ? "runQ" : "easy";
    } else {
      place = kind;
      const present = week.slots.filter((s) => s.place).map((s) => s.type);
      type = old && old.place ? old.type : ["lower", "upper", "full", "upperB"].find((t) => present.indexOf(t) < 0) || "full";
    }
    week.slots.push({ day: d, type: type, place: place });
    week.slots.sort((a, b) => a.day - b.day);
  }
  week.days = week.slots.length;
  wkSave();
}

// 그날 세션이 어떤 종류인지 (바꾸기 줄에서 켜 둘 칩)
function wkKindOf(slot) {
  if (!slot) return "rest";
  if (WK_RUN_ALL.indexOf(slot.type) >= 0) return "run";
  if (slot.type === "recovery") return "";
  return slot.place || "home";
}

function wkPhaseOf(absWeek) {
  const first = wkState.firstWeek == null ? absWeek : wkState.firstWeek;
  return (((absWeek - first) % 4) + 4) % 4;
}

// ---------- 설정 화면 ----------
let wkMode = "auto"; // 이번 주 짜는 방법: auto(며칠만 고르기) | manual(요일별로)
let wkChoice = null; // 요일별 종류

function wkSetupSlots() {
  return wkMode === "manual" ? wkPlanManual(wkChoice, wkTodayIdx) : wkPick ? wkPlace(wkPick, wkState.lsdDay, wkTodayIdx) : [];
}

function wkRenderSetup() {
  document.getElementById("wk-setup").hidden = false;
  document.getElementById("wk-plan").hidden = true;
  if (!wkChoice) wkChoice = (wkState.lastChoice || ["rest", "rest", "rest", "rest", "rest", "rest", "rest"]).slice();
  document.querySelectorAll("#wk-mode-seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === wkMode));
  document.getElementById("wk-auto").hidden = wkMode !== "auto";
  document.getElementById("wk-manual").hidden = wkMode !== "manual";
  // 요일별: 오늘부터 일요일까지 줄마다 종류 고르기
  const man = document.getElementById("wk-manual-list");
  man.innerHTML = "";
  for (let d = wkTodayIdx; d < 7; d++) {
    const row = document.createElement("div");
    row.className = "wk-man-row";
    row.innerHTML = `<b>${WK_DAY_NAMES[d]}</b><div class="wk-chips">` + WK_KINDS.map(([k, label]) =>
      `<button type="button" class="wk-chip wk-chip-sm${wkChoice[d] === k ? " on" : ""}" data-man="${d}" data-kind="${k}">${label}</button>`).join("") + `</div>`;
    man.appendChild(row);
  }
  man.querySelectorAll("[data-man]").forEach((b) => b.addEventListener("click", () => {
    wkChoice[Number(b.dataset.man)] = b.dataset.kind;
    wkRenderSetup();
  }));
  const left = wkAvailDays(wkTodayIdx).length;
  if (wkPick > left) wkPick = null;
  const box = document.getElementById("wk-day-buttons");
  box.innerHTML = "";
  for (let n = 1; n <= 7; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = n + "일";
    b.disabled = n > left;
    if (wkPick === n) b.classList.add("on");
    b.addEventListener("click", () => {
      wkPick = n;
      wkRenderSetup();
    });
    box.appendChild(b);
  }
  const okDays = wkAvailDays(wkTodayIdx).map((d) => WK_DAY_NAMES[d]).join("·");
  document.getElementById("wk-day-note").textContent = !left
    ? "이번 주에 남은 운동 가능한 요일이 없어요. ⚙ 내 설정에서 요일을 바꿀 수 있어요."
    : (wkTodayIdx > 0 ? `오늘(${WK_DAY_NAMES[wkTodayIdx]})부터 ` : "") + `운동할 수 있는 날은 ${okDays} — 최대 ${left}일까지 고를 수 있어요.`;

  // LSD 요일: 러닝을 하고, 운동 가능한 주말이 있을 때만
  const weekend = [5, 6].filter((d) => wkProfile.days[d]);
  if (weekend.length && weekend.indexOf(wkState.lsdDay) < 0) wkState.lsdDay = weekend[0];
  const showLsd = wkProfile.run !== "none" && weekend.length > 0 && (!wkPick || wkTemplateFor(wkPick).indexOf("lsd") >= 0);
  document.getElementById("wk-lsd-wrap").hidden = !showLsd;
  document.querySelectorAll("#wk-lsd-seg button").forEach((b) => {
    b.hidden = !wkProfile.days[Number(b.dataset.lsd)];
    b.classList.toggle("on", Number(b.dataset.lsd) === wkState.lsdDay);
  });

  if (wkMode === "manual") document.getElementById("wk-lsd-wrap").hidden = true;
  const prev = document.getElementById("wk-preview");
  prev.innerHTML = "";
  const make = document.getElementById("wk-make");
  const slots = wkSetupSlots();
  make.disabled = !slots.length;
  if (!slots.length) {
    prev.innerHTML = `<li class='wk-note'>${wkMode === "manual" ? "요일마다 러닝·홈트·헬스장을 골라 주세요." : "위에서 일수를 골라 주세요."}</li>`;
    return;
  }
  slots.forEach((s) => {
    const li = document.createElement("li");
    const title = s.place === "gym" ? WK_GYM_TITLE[s.type].replace(" · 헬스장", "") : WK_TYPES[s.type].title;
    li.innerHTML = `<b>${WK_DAY_NAMES[s.day]}</b><span class="wk-dot" style="background:${WK_TYPES[s.type].color}"></span>${title}${wkPlaceTag(s.place)}`;
    prev.appendChild(li);
  });
  const runs = slots.filter((s) => ["runQ", "easy", "lsd", "combo"].indexOf(s.type) >= 0).length;
  const rec = slots.filter((s) => s.type === "recovery").length;
  const li = document.createElement("li");
  li.className = "wk-summary";
  li.textContent = `구성: 러닝 ${runs} · 근력 ${slots.length - runs - rec}${rec ? " · 회복 " + rec : ""} — ${wkGoalText()}`;
  prev.appendChild(li);
}

function wkMakePlan() {
  const slots = wkSetupSlots();
  if (!slots.length) return;
  const abs = wkAbsWeek(wkMon);
  if (wkState.firstWeek == null) wkState.firstWeek = abs;
  if (wkMode === "manual") wkState.lastChoice = wkChoice.slice();
  wkState.weeks[wkWeekKey] = {
    days: slots.length,
    mode: wkMode,
    lsd: wkState.lsdDay,
    w: abs,
    p: wkPhaseOf(abs),
    slots: slots,
    swaps: {},
    checks: {},
    done: {},
  };
  // 달력에 이미 체크한 날이면 계획에도 완료로
  const week = wkState.weeks[wkWeekKey];
  week.slots.forEach((s) => {
    if (wkState.log[wkDateKey(wkAddDays(wkMon, s.day))]) week.done[s.day] = true;
  });
  wkSave();
  wkViewDay = wkTodayIdx;
  wkRender();
}

// ---------- 계획 화면 ----------
function wkSlotOf(week, day) {
  return week.slots.find((s) => s.day === day);
}

function wkRenderPlan() {
  const week = wkState.weeks[wkWeekKey];
  document.getElementById("wk-setup").hidden = true;
  document.getElementById("wk-plan").hidden = false;

  // 요일 줄
  const strip = document.getElementById("wk-strip");
  strip.innerHTML = "";
  for (let d = 0; d < 7; d++) {
    const s = wkSlotOf(week, d);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wk-strip-day";
    if (d === wkViewDay) b.classList.add("on");
    if (d === wkTodayIdx) b.classList.add("today");
    if (s && week.done[d]) b.classList.add("done");
    const date = wkAddDays(wkMon, d).getDate();
    b.innerHTML = `<span class="wk-sd-name">${WK_DAY_NAMES[d]}</span><span class="wk-sd-date">${date}</span>` +
      (s ? `<span class="wk-sd-tag" style="background:${WK_TYPES[s.type].color}">${week.done[d] ? "✓" : (s.place === "gym" ? "🏋" : "") + WK_TYPES[s.type].short}</span>` : `<span class="wk-sd-rest">휴식</span>`);
    b.addEventListener("click", () => {
      wkViewDay = d;
      wkRenderPlan();
    });
    strip.appendChild(b);
  }

  wkRenderSession(week);
  wkRenderHistory();
  wkRenderToday();
}

function wkPlaceTag(place) {
  return place === "gym" ? `<span class="wk-place gym">🏋️ 헬스장</span>` : place === "home" ? `<span class="wk-place">🏠 홈트</span>` : "";
}

function wkEqTags(eqs) {
  return eqs.map((e) => `<span class="wk-eq wk-eq-${e}">${WK_EQ[e]}</span>`).join("");
}

// 한 요일 세션에서 실제로 하는 동작들 (바꾸기 반영)
function wkExercisesOf(week, slot, ses) {
  const out = [];
  ses.blocks.forEach((blk, bi) => (blk.items || []).forEach((it, ii) => {
    const pool = wkPool(it.pool);
    out.push(pool[(it.idx + (week.swaps[`${slot.day}-${bi}-${ii}`] || 0)) % pool.length]);
  }));
  return out;
}

// 실내 근력 날이 피해야 할 동작: 이번 주 다른 날 2점, 지난주 1점
function wkUsedMap(week, day) {
  const used = {};
  const prevKey = wkDateKey(wkAddDays(wkMon, -7));
  [[wkState.weeks[prevKey], 1], [week, 2]].forEach(([wk, score]) => {
    if (!wk) return;
    wk.slots.forEach((s, i) => {
      if ((wk === week && s.day === day) || s.type === "indoor") return;
      wkExercisesOf(wk, s, wkBuildSession(s.type, wk.w, wk.p, i, null, false, s.place)).forEach((ex) => {
        used[ex.n] = Math.max(used[ex.n] || 0, score);
      });
    });
  });
  return used;
}

function wkSessionFor(week, slot) {
  const dayNo = week.slots.indexOf(slot);
  const used = slot.type === "indoor" ? wkUsedMap(week, slot.day) : null;
  return wkBuildSession(slot.type, week.w, week.p, dayNo, used, !!slot.orig, slot.place);
}

// 그 요일의 체크·바꾸기 기록 지우기 (세션 종류를 바꿀 때)
function wkClearDay(week, d) {
  [week.checks, week.swaps].forEach((obj) => Object.keys(obj).forEach((k) => {
    if (k.split("-")[0] === String(d)) delete obj[k];
  }));
}

function wkRenderSession(week) {
  const box = document.getElementById("wk-session");
  const d = wkViewDay;
  const slot = wkSlotOf(week, d);
  const dayLabel = (d === wkTodayIdx ? "오늘 · " : "") + WK_DAY_NAMES[d] + "요일";

  // 이 날 종류 바꾸기 (러닝·홈트·헬스장·휴식)
  const changeRow = `<div class="wk-change"><span>이 날 바꾸기</span><div class="wk-chips">` + WK_KINDS.map(([k, label]) =>
    `<button type="button" class="wk-chip wk-chip-sm${wkKindOf(slot) === k ? " on" : ""}" data-kind="${k}">${label}</button>`).join("") + `</div></div>`;
  const bindChange = (root) => root.querySelectorAll(".wk-change [data-kind]").forEach((b) => b.addEventListener("click", () => {
    if (wkKindOf(wkSlotOf(week, d)) === b.dataset.kind) return;
    wkChangeDay(week, d, b.dataset.kind);
    wkRenderPlan();
    wkRenderCal();
  }));

  if (!slot) {
    const todaySlot = wkSlotOf(week, wkTodayIdx);
    box.innerHTML = `<div class="wk-card"><p class="wk-day-label">${dayLabel}</p><h2>쉬는 날</h2>
      <p class="wk-note">가벼운 걷기나 스트레칭 정도면 충분해요. 근육은 쉬는 동안 자라요.</p>
      ${d === wkTodayIdx && !todaySlot ? "<p class='wk-note'>오늘 운동하고 싶으면 아래에서 종류를 고르거나, 다른 요일 운동을 눌러 '오늘로 옮기기'를 하세요.</p>" : ""}${changeRow}</div>`;
    bindChange(box);
    return;
  }

  const ses = wkSessionFor(week, slot);
  const allEq = {};
  const exByKey = {};
  const card = document.createElement("div");
  card.className = "wk-card wk-session";
  if (week.done[d]) card.classList.add("is-done");

  let html = `<p class="wk-day-label">${dayLabel}</p>
    <h2><span class="wk-dot" style="background:${WK_TYPES[slot.type].color}"></span>${ses.title}</h2>
    <p class="wk-note">약 ${ses.min}분 ${wkPlaceTag(slot.place)}</p><div class="wk-eq-row" data-eq-row></div>
    ${week.done[d] ? "" : `<button type="button" class="wk-primary wk-start-sm" data-run>▶ ${wkRunLabel(week, d)}</button>`}`;
  if (WK_RUN_TYPES.indexOf(slot.type) >= 0 && !week.done[d]) {
    html += `<button type="button" class="wk-rain" data-indoor>🌧 비 와요 · 실내 근력으로 바꾸기</button>`;
    if (wkProfile.treadmill) html += `<p class="wk-note">러닝머신이 있으면 그대로 러닝머신에서 해도 좋아요 (경사 1%로 하면 바깥과 비슷해요).</p>`;
  }
  if (slot.type === "indoor" && ses.note) {
    html += `<p class="wk-indoor-note">${ses.note}</p>`;
    if (!week.done[d]) html += `<button type="button" class="wk-ghost wk-ghost-sm" data-outdoor>↩ 원래 러닝(${WK_TYPES[slot.orig || "easy"].short})으로 되돌리기</button>`;
  }

  ses.blocks.forEach((blk, bi) => {
    html += `<div class="wk-block"><div class="wk-block-head"><h3>${blk.name}</h3>`;
    if (blk.rest) html += `<button type="button" class="wk-rest" data-rest="${blk.rest}">휴식 ${blk.rest}초</button>`;
    html += `</div>`;
    if (blk.text) {
      const key = `${d}-${bi}-t`;
      const ok = week.checks[key] ? "on" : "";
      html += `<ul class="wk-steps">${blk.text.map((t) => `<li>${t}</li>`).join("")}</ul>`;
      if (blk.tip) html += `<p class="wk-tip">${blk.tip}</p>`;
      if (blk.run || blk.cardio) {
        if (blk.run) allEq.run = true;
        html += `<button type="button" class="wk-check ${ok}" data-check="${key}">${ok ? "✓ 했어요" : "다 했으면 누르기"}</button>`;
      }
    }
    if (blk.tip && !blk.text) html += `<p class="wk-tip wk-main-tip">💡 ${blk.tip}</p>`;
    if (blk.circuit || blk.emom) {
      const key = `${d}-${bi}-r`;
      const n = blk.circuit || 1;
      const got = week.checks[key] || 0;
      html += `<div class="wk-rounds">${blk.circuit ? "라운드" : "완료"} ` +
        Array.from({ length: n }, (_, i) => `<button type="button" class="wk-set ${i < got ? "on" : ""}" data-set="${key}" data-n="${i + 1}">${i + 1}</button>`).join("") + `</div>`;
    }
    (blk.items || []).forEach((it, ii) => {
      const key = `${d}-${bi}-${ii}`;
      const pool = wkPool(it.pool);
      const ex = pool[(it.idx + (week.swaps[key] || 0)) % pool.length];
      exByKey[key] = ex;
      ex.eq.forEach((e) => (allEq[e] = true));
      const reps = wkRepsText(ex, week.p);
      const got = week.checks[key] || 0;
      html += `<div class="wk-ex"><div class="wk-ex-top"><div><button type="button" class="wk-ex-name" data-show="${key}" data-reps="${blk.circuit || blk.emom ? reps : `${it.sets}세트 × ${reps}`}"><span class="wk-play">▶</span>${ex.n}</button>
        <div class="wk-ex-meta">${blk.circuit || blk.emom ? reps : `${it.sets}세트 × ${reps}`}</div></div>
        <button type="button" class="wk-swap" data-swap="${key}" aria-label="다른 동작으로 바꾸기">↻ 바꾸기</button></div>
        <p class="wk-tip">${ex.tip}</p>`;
      if (wkTracksWeight(ex)) {
        const date = wkDateKey(wkAddDays(wkMon, d));
        const today = wkLiftHistory(ex.n).find((r) => r.d === date);
        const goal = wkLiftGoal(it.pool, ex, date, week.p);
        html += `<div class="wk-lift" data-lift="${key}" data-pool="${it.pool}">
          <div class="wk-lift-info">${goal ? `지난번 <b>${goal.prev.kg}kg${goal.prev.reps ? " × " + goal.prev.reps + "회" : ""}</b> (${wkShortDate(goal.prev.d)}) → 오늘 목표 <b>${goal.kg}kg</b><br><span>${goal.why}</span>` : "처음 기록해요. 가벼운 무게로 시작해 적어 두면 다음부터 목표를 알려 드려요"}</div>
          <div class="wk-lift-in"><input type="number" inputmode="decimal" step="0.5" min="0" class="wk-input wk-kg" data-lkg placeholder="${goal ? goal.kg : "kg"}" value="${today ? today.kg : ""}"> kg ×
            <input type="number" inputmode="numeric" min="0" class="wk-input wk-kg" data-lreps placeholder="횟수" value="${today && today.reps ? today.reps : ""}"> 회
            <button type="button" class="wk-lift-save${today ? " saved" : ""}">${today ? "✓ 저장됨" : "저장"}</button></div>
          <p class="wk-lift-hint">횟수는 마지막 세트에 한 횟수를 적어요</p>
        </div>`;
      }
      html += `<div class="wk-ex-bottom"><span>${wkEqTags(ex.eq)}</span>`;
      if (!blk.circuit && !blk.emom) {
        html += `<span class="wk-sets">` + Array.from({ length: it.sets }, (_, i) =>
          `<button type="button" class="wk-set ${i < got ? "on" : ""}" data-set="${key}" data-n="${i + 1}">${i + 1}</button>`).join("") + `</span>`;
      }
      html += `</div></div>`;
    });
    html += `</div>`;
  });

  html += `<button type="button" class="wk-primary" data-finish>${week.done[d] ? "✓ 완료한 운동 (다시 누르면 취소)" : "운동 완료!"}</button>`;
  if (!week.done[d]) html += changeRow;
  if (d !== wkTodayIdx && !wkSlotOf(week, wkTodayIdx) && !week.done[d]) {
    html += `<button type="button" class="wk-ghost" data-move>오늘로 옮기기</button>`;
  }
  card.innerHTML = html;
  bindChange(card);
  card.querySelector("[data-eq-row]").innerHTML = wkEqTags(Object.keys(WK_EQ).filter((e) => allEq[e]));
  box.innerHTML = "";
  box.appendChild(card);

  // 버튼 동작
  card.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.set;
    const n = Number(b.dataset.n);
    week.checks[key] = (week.checks[key] || 0) === n ? n - 1 : n;
    if (b.closest(".wk-ex") && week.checks[key] === n) wkStartTimer(Number(b.closest(".wk-block").querySelector("[data-rest]")?.dataset.rest || 60));
    wkSave();
    wkRenderSession(week);
  }));
  card.querySelectorAll("[data-check]").forEach((b) => b.addEventListener("click", () => {
    week.checks[b.dataset.check] = !week.checks[b.dataset.check];
    wkSave();
    wkRenderSession(week);
  }));
  card.querySelectorAll("[data-swap]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.swap;
    week.swaps[key] = (week.swaps[key] || 0) + 1;
    week.checks[key] = 0;
    wkSave();
    wkRenderSession(week);
  }));
  card.querySelectorAll(".wk-lift").forEach((box) => {
    const btn = box.querySelector(".wk-lift-save");
    const kgIn = box.querySelector("[data-lkg]");
    const repIn = box.querySelector("[data-lreps]");
    const dirty = () => { btn.classList.remove("saved"); btn.textContent = "저장"; };
    kgIn.addEventListener("input", dirty);
    repIn.addEventListener("input", dirty);
    btn.addEventListener("click", () => {
      const ex = exByKey[box.dataset.lift];
      // 무게를 비워 두면 목표(또는 지난번) 무게로
      const kg = parseFloat(kgIn.value) || parseFloat(kgIn.placeholder) || 0;
      if (!kg) { kgIn.focus(); return; }
      wkLiftSave(ex.n, wkDateKey(wkAddDays(wkMon, d)), kg, parseInt(repIn.value, 10) || 0);
      kgIn.value = kg;
      btn.classList.add("saved");
      btn.textContent = "✓ 저장됨";
      wkRenderHistory();
    });
  });
  card.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => {
    wkOpenMotion(exByKey[b.dataset.show], b.dataset.reps);
  }));
  const runBtn = card.querySelector("[data-run]");
  if (runBtn) runBtn.addEventListener("click", () => wkRunOpen(d));
  const indoorBtn = card.querySelector("[data-indoor]");
  if (indoorBtn) indoorBtn.addEventListener("click", () => {
    slot.orig = slot.type;
    slot.type = "indoor";
    wkClearDay(week, d);
    wkSave();
    wkRenderPlan();
  });
  const outdoorBtn = card.querySelector("[data-outdoor]");
  if (outdoorBtn) outdoorBtn.addEventListener("click", () => {
    slot.type = slot.orig || "easy";
    delete slot.orig;
    wkClearDay(week, d);
    wkSave();
    wkRenderPlan();
  });
  card.querySelectorAll("[data-rest]").forEach((b) => b.addEventListener("click", () => wkStartTimer(Number(b.dataset.rest))));
  card.querySelector("[data-finish]").addEventListener("click", () => {
    week.done[d] = !week.done[d];
    wkLogSet(wkDateKey(wkAddDays(wkMon, d)), week.done[d], slot.type);
    wkSave();
    wkRenderPlan();
    wkRenderCal();
    if (week.done[d]) window.scrollTo({ top: 0, behavior: "smooth" });
  });
  const mv = card.querySelector("[data-move]");
  if (mv) mv.addEventListener("click", () => {
    slot.day = wkTodayIdx;
    week.slots.sort((a, b) => a.day - b.day);
    // 옮긴 날의 체크 기록도 따라가게 (키 앞의 요일 숫자 바꾸기)
    [week.checks, week.swaps].forEach((obj) => Object.keys(obj).forEach((k) => {
      if (k.split("-")[0] === String(d)) {
        obj[wkTodayIdx + k.slice(String(d).length)] = obj[k];
        delete obj[k];
      }
    }));
    wkViewDay = wkTodayIdx;
    wkSave();
    wkRenderPlan();
  });
}

function wkRenderHistory() {
  const ul = document.getElementById("wk-history");
  ul.innerHTML = "";
  const keys = Object.keys(wkState.weeks).sort().reverse().slice(0, 8);
  keys.forEach((k) => {
    const w = wkState.weeks[k];
    const done = w.slots.filter((s) => w.done[s.day]).length;
    const [y, m, dd] = k.split("-").map(Number);
    const li = document.createElement("li");
    li.innerHTML = `<span>${m}/${dd} 주${k === wkWeekKey ? " (이번 주)" : ""} · ${WK_PHASES[w.p].name.split(" · ")[1]}</span><b>${done}/${w.slots.length}</b>`;
    ul.appendChild(li);
  });
  // 무게 기록: 동작마다 최근 무게와 처음보다 얼마나 늘었는지 (누르면 그래프)
  const lifts = document.getElementById("wk-lifts");
  const names = Object.keys(wkState.lifts || {}).sort((a, b) => (wkLiftHistory(b).slice(-1)[0].d > wkLiftHistory(a).slice(-1)[0].d ? 1 : -1));
  document.getElementById("wk-lifts-wrap").hidden = !names.length;
  lifts.innerHTML = names.map((n) => {
    const h = wkLiftHistory(n);
    const diff = Math.round((h[h.length - 1].kg - h[0].kg) * 10) / 10;
    return `<li><button type="button" class="wk-lift-row" data-liftname="${n}"><span>${n}</span><b>${h[h.length - 1].kg}kg${diff ? ` <small>(${diff > 0 ? "+" : ""}${diff})</small>` : ""}</b></button></li>`;
  }).join("");
  lifts.querySelectorAll("[data-liftname]").forEach((b) => b.addEventListener("click", () => {
    const n = b.dataset.liftname;
    let ex = null;
    Object.keys(WK_POOLS).forEach((k) => WK_POOLS[k].forEach((e) => { if (e.n === n && !ex) ex = e; }));
    if (ex) wkOpenMotion(ex, "기록 " + wkLiftHistory(n).length + "번");
  }));
}

// ---------- 무게 기록 (헬스장 동작) ----------
// wkState.lifts["동작 이름"] = [{ d: "YYYY-MM-DD", kg, reps }] 날짜순, 동작마다 최근 40개
function wkTracksWeight(ex) {
  return ex.eq.indexOf("gym") >= 0;
}
function wkLiftHistory(name) {
  return (wkState.lifts && wkState.lifts[name]) || [];
}
function wkLiftSave(name, date, kg, reps) {
  if (!wkState.lifts) wkState.lifts = {};
  const list = wkLiftHistory(name).filter((r) => r.d !== date);
  if (kg > 0) list.push({ d: date, kg: kg, reps: reps > 0 ? reps : null });
  list.sort((a, b) => (a.d < b.d ? -1 : 1));
  wkState.lifts[name] = list.slice(-40);
  if (!wkState.lifts[name].length) delete wkState.lifts[name];
  wkSave();
}
// 오늘 목표: 지난번에 목표 횟수(범위 위쪽)를 채웠으면 무게 올리기, 아니면 같은 무게로 횟수 늘리기
function wkLiftGoal(pool, ex, date, p) {
  const prev = wkLiftHistory(ex.n).filter((r) => r.d < date).pop();
  if (!prev) return null;
  const nums = wkRepsText(ex, p).match(/\d+/g);
  const top = nums ? Number(nums[nums.length - 1]) : 0;
  const inc = ex.wt === "db" ? 2 : ["gSquat", "gHinge", "gLegAcc"].indexOf(pool) >= 0 ? 5 : 2.5;
  if (prev.reps && top && prev.reps >= top) return { prev: prev, kg: prev.kg + inc, why: `지난번 ${top}회를 채워서 +${inc}kg` };
  return { prev: prev, kg: prev.kg, why: "같은 무게로 횟수 늘리기" };
}
const wkShortDate = (d) => Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10));

// 무게 변화 그래프 (선 하나: 제목이 무엇인지 말하므로 범례 없음, 점을 누르면 값)
function wkLiftChart(box, name) {
  const list = wkLiftHistory(name).slice(-12);
  box.innerHTML = "";
  if (!list.length) return;
  const W = 320, H = 150, L = 38, R = 46, T = 14, B = 26;
  const t = list.map((r) => new Date(r.d + "T00:00:00").getTime());
  const t0 = t[0], t1 = Math.max(t[t.length - 1], t0 + 864e5);
  let lo = Math.min(...list.map((r) => r.kg)), hi = Math.max(...list.map((r) => r.kg));
  if (hi - lo < 5) { lo -= 2.5; hi += 2.5; }
  const x = (v) => (list.length === 1 ? (L + W - R) / 2 : L + ((v - t0) / (t1 - t0)) * (W - L - R));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, at, parent) => { const e = document.createElementNS(ns, tag); Object.keys(at).forEach((k) => e.setAttribute(k, at[k])); parent.appendChild(e); return e; };
  const wrap = document.createElement("div");
  wrap.innerHTML = `<h3>무게 기록</h3><p class="wk-lift-tip" aria-live="polite">점을 누르면 그날 기록이 보여요</p>`;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "wk-chart", role: "img", "aria-label": name + " 무게 기록 그래프" }, wrap);
  [lo, Math.round(lo + hi) / 2, hi].forEach((v) => { // 가운데 눈금은 0.5kg 단위로
    el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "wk-chart-grid" }, svg);
    el("text", { x: L - 6, y: y(v) + 4, class: "wk-chart-ax", "text-anchor": "end" }, svg).textContent = Math.round(v * 10) / 10;
  });
  el("text", { x: x(t[0]), y: H - 8, class: "wk-chart-ax", "text-anchor": list.length === 1 ? "middle" : "start" }, svg).textContent = wkShortDate(list[0].d);
  if (list.length > 1) el("text", { x: x(t[t.length - 1]), y: H - 8, class: "wk-chart-ax", "text-anchor": "end" }, svg).textContent = wkShortDate(list[list.length - 1].d);
  if (list.length > 1) el("polyline", { points: list.map((r, i) => x(t[i]) + "," + y(r.kg)).join(" "), class: "wk-chart-line" }, svg);
  const tip = wrap.querySelector(".wk-lift-tip");
  list.forEach((r, i) => {
    const g = el("g", { class: "wk-chart-pt", tabindex: 0 }, svg);
    el("circle", { cx: x(t[i]), cy: y(r.kg), r: 14, class: "wk-chart-hit" }, g); // 손가락으로 누르기 쉽게
    el("circle", { cx: x(t[i]), cy: y(r.kg), r: 4.5, class: "wk-chart-dot" }, g);
    const show = () => (tip.textContent = `${wkShortDate(r.d)} · ${r.kg}kg${r.reps ? " × " + r.reps + "회" : ""}`);
    g.addEventListener("click", show);
    g.addEventListener("mouseenter", show);
    g.addEventListener("focus", show);
  });
  const last = list[list.length - 1];
  el("text", { x: x(t[t.length - 1]) + 8, y: y(last.kg) + 4, class: "wk-chart-label" }, svg).textContent = last.kg + "kg";
  // 표로도 (최근 6번)
  const table = document.createElement("table");
  table.className = "wk-lift-table";
  table.innerHTML = "<tr><th>날짜</th><th>무게</th><th>횟수</th></tr>" + list.slice(-6).reverse()
    .map((r) => `<tr><td>${wkShortDate(r.d)}</td><td>${r.kg}kg</td><td>${r.reps ? r.reps + "회" : "-"}</td></tr>`).join("");
  wrap.appendChild(table);
  box.appendChild(wrap);
}

// ---------- 월 달력 ----------
// 기록: wkState.log["YYYY-MM-DD"] = 세션 종류(계획에 없던 날은 "free")
// 달력은 처음 쓰기 시작한 달(calStart)부터 이번 달까지 넘겨 볼 수 있음
if (!wkState.calStart) {
  wkState.calStart = wkDateKey(wkNow).slice(0, 7);
  wkSave();
}
let wkCalY = wkNow.getFullYear();
let wkCalM = wkNow.getMonth(); // 0~11

function wkLogSet(dk, on, type) {
  if (on) wkState.log[dk] = type || "free";
  else delete wkState.log[dk];
}

// 그 날짜가 들어 있는 주의 계획에서 세션 찾기
function wkPlanOn(date) {
  const week = wkState.weeks[wkDateKey(wkMonday(date))];
  if (!week) return null;
  const slot = wkSlotOf(week, wkDayIndex(date));
  return slot ? { week: week, slot: slot } : null;
}

function wkRenderCal() {
  const ym = wkCalY + "-" + String(wkCalM + 1).padStart(2, "0");
  const nowYm = wkDateKey(wkNow).slice(0, 7);
  document.getElementById("wk-cal-title").textContent = `${wkCalY}년 ${wkCalM + 1}월`;
  document.getElementById("wk-cal-prev").disabled = ym <= wkState.calStart;
  document.getElementById("wk-cal-next").disabled = ym >= nowYm;

  const grid = document.getElementById("wk-cal-grid");
  grid.innerHTML = "";
  const first = new Date(wkCalY, wkCalM, 1);
  const last = new Date(wkCalY, wkCalM + 1, 0).getDate();
  for (let i = 0; i < wkDayIndex(first); i++) grid.appendChild(document.createElement("span"));
  let count = 0;
  let runs = 0;
  let strength = 0;
  for (let day = 1; day <= last; day++) {
    const date = new Date(wkCalY, wkCalM, day);
    const dk = wkDateKey(date);
    const type = wkState.log[dk];
    const plan = wkPlanOn(date);
    const future = date > wkNow;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wk-cal-day";
    if (dk === wkDateKey(wkNow)) b.classList.add("today");
    if (type) {
      b.classList.add("done");
      count++;
      if (["runQ", "easy", "lsd"].indexOf(type) >= 0) runs++;
      else if (["upper", "upperB", "lower", "full", "indoor"].indexOf(type) >= 0) strength++;
    }
    b.disabled = future || dk.slice(0, 7) < wkState.calStart;
    const color = plan ? WK_TYPES[plan.slot.type].color : "";
    b.innerHTML = `<span class="wk-cal-num">${day}</span>` +
      (type ? `<span class="wk-cal-mark">✓</span>` : plan ? `<span class="wk-dot" style="background:${color}"></span>` : "");
    if (plan) b.title = WK_TYPES[plan.slot.type].title;
    b.addEventListener("click", () => {
      const on = !wkState.log[dk];
      if (plan) {
        plan.week.done[plan.slot.day] = on;
        wkLogSet(dk, on, plan.slot.type);
      } else {
        wkLogSet(dk, on, "free");
      }
      wkSave();
      wkRender();
    });
    grid.appendChild(b);
  }
  const passed = ym === nowYm ? wkNow.getDate() : last;
  document.getElementById("wk-cal-sum").innerHTML = count
    ? `<b>${count}일</b> 운동 (지난 ${passed}일 중) · 러닝 ${runs} · 근력 ${strength}${count - runs - strength ? " · 기타 " + (count - runs - strength) : ""}`
    : "아직 체크한 날이 없어요.";
}

document.getElementById("wk-cal-prev").addEventListener("click", () => {
  wkCalM--;
  if (wkCalM < 0) { wkCalM = 11; wkCalY--; }
  wkRenderCal();
});
document.getElementById("wk-cal-next").addEventListener("click", () => {
  wkCalM++;
  if (wkCalM > 11) { wkCalM = 0; wkCalY++; }
  wkRenderCal();
});

// ---------- 동작 보기 (아래에서 올라오는 창) ----------
let wkStopMotion = null;

// 동작에 쓰는 기구 (3D·막대 그림에 들려 줄 것)
function wkWeightOf(ex) {
  return ex.wt !== undefined ? ex.wt : ex.eq.indexOf("db") >= 0 ? "db" : ex.eq.indexOf("kb4") >= 0 || ex.eq.indexOf("kb12") >= 0 ? "kb" : null;
}

// box에 동작 그림 넣기: 3D가 준비 안 됐으면 막대 그림을 먼저 보여 주고, 받아지면 3D로 바꿈
// 3D 그림판은 하나라서 동작 보기 창과 운동 모드가 같이 씀 (나중에 부른 쪽이 가져감)
let wkMotionToken = 0;
function wkPlayMotion(box, ex, on3d) {
  const key = WK_MOTION_OF[ex.n];
  const weight = wkWeightOf(ex);
  if (wkStopMotion) wkStopMotion();
  wkStopMotion = null;
  const token = ++wkMotionToken;
  const start3d = () => {
    const stop = m3Play(box, key, weight, ex.n);
    if (stop) {
      wkStopMotion = stop;
      if (on3d) on3d();
    }
    return !!stop;
  };
  if (m3Model && start3d()) return;
  wkStopMotion = moPlay(box, key, weight);
  if (!m3Model) m3Load().then((ok) => {
    if (!ok || token !== wkMotionToken) return;
    if (wkStopMotion) wkStopMotion();
    wkStopMotion = null;
    if (!start3d()) wkStopMotion = moPlay(box, key, weight); // 3D가 안 되는 기기
  });
}
function wkStopAnyMotion() {
  wkMotionToken++;
  if (wkStopMotion) wkStopMotion();
  wkStopMotion = null;
}

function wkOpenMotion(ex, reps) {
  const key = WK_MOTION_OF[ex.n];
  document.getElementById("wk-sheet-title").textContent = ex.n;
  document.getElementById("wk-sheet-reps").textContent = reps;
  document.getElementById("wk-sheet-how").innerHTML = (WK_HOW_EX[ex.n] || WK_HOW[key] || []).map((t) => `<li>${t}</li>`).join("");
  document.getElementById("wk-sheet-tip").textContent = "💡 " + ex.tip;
  document.getElementById("wk-sheet-eq").innerHTML = wkEqTags(ex.eq);
  wkLiftChart(document.getElementById("wk-sheet-lift"), ex.n);
  // 실제 사람 시범: 유튜브 검색 (괄호 속 설명은 빼고 "자세"를 붙임)
  const q = ex.n.replace(/\s*\(.*?\)/g, "").replace(/\s*\+.*$/, "") + " 자세";
  document.getElementById("wk-sheet-video").href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  document.getElementById("wk-sheet").hidden = false;
  document.body.classList.add("wk-noscroll");
  const mus = WK_MUSCLES_EX[ex.n] || WK_MUSCLES[key] || { p: [] };
  const chips = (list, cls) => list.map((id) => `<span class="wk-mus ${cls}">${WK_MUSCLE_NAMES[id]}</span>`).join("");
  document.getElementById("wk-sheet-muscles").innerHTML =
    `<div><b>주로</b>${chips(mus.p || [], "hot")}</div>` + (mus.s && mus.s.length ? `<div><b>보조</b>${chips(mus.s, "help")}</div>` : "");
  const hint = document.getElementById("wk-sheet-hint");
  hint.hidden = true;
  wkPlayMotion(document.getElementById("wk-sheet-anim"), ex, () => (hint.hidden = false));
}
function wkCloseMotion() {
  wkStopAnyMotion();
  document.getElementById("wk-sheet").hidden = true;
  if (!wkRunActive()) document.body.classList.remove("wk-noscroll");
  else wkRunRender(true); // 운동 모드 위에서 열었으면 운동 모드 그림을 다시 살림
}
document.querySelectorAll("[data-sheet-close]").forEach((b) => b.addEventListener("click", wkCloseMotion));

// ---------- 휴식 타이머 ----------
let wkTimerEnd = 0;
let wkTimerId = null;
let wkAudio = null;

function wkStartTimer(sec) {
  try {
    wkAudio = wkAudio || new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { /* 소리 없이 */ }
  wkTimerEnd = Date.now() + sec * 1000;
  document.getElementById("wk-timer").hidden = false;
  document.getElementById("wk-timer").classList.remove("ring");
  clearInterval(wkTimerId);
  wkTimerId = setInterval(wkTick, 250);
  wkTick();
}
function wkTick() {
  const left = Math.max(0, Math.ceil((wkTimerEnd - Date.now()) / 1000));
  document.getElementById("wk-timer-text").textContent =
    String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
  if (left === 0) {
    clearInterval(wkTimerId);
    document.getElementById("wk-timer").classList.add("ring");
    wkBeep();
    setTimeout(() => (document.getElementById("wk-timer").hidden = true), 4000);
  }
}
function wkBeep() {
  if (!wkAudio) return;
  [0, 0.25, 0.5].forEach((t) => {
    const o = wkAudio.createOscillator();
    const g = wkAudio.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(wkAudio.destination);
    o.start(wkAudio.currentTime + t);
    o.stop(wkAudio.currentTime + t + 0.15);
  });
}

// 목표를 한 줄로 ("풀코스 + 근력·근육 키우기")
function wkGoalText() {
  const q = (k, v) => (WK_PROFILE_Q.find((x) => x.key === k).opts.find((o) => o[0] === v) || [, ""])[1];
  const parts = [];
  if (wkProfile.race !== "none") parts.push(q("race", wkProfile.race) + " 준비");
  wkProfile.goals.forEach((g) => parts.push(q("goals", g)));
  const left = wkWeeksToRace(wkAbsWeek(wkMon));
  return (parts.join(" + ") || "균형 잡힌 운동") + (left != null && left >= 0 ? ` (대회까지 ${left}주)` : "");
}

// ---------- 내 설정 질문 (처음 설정 단계 · 설정 탭에서 바꾸기) ----------
// 질문 목록: key, 제목, 고르는 값들 [값, 글자], multi(여러 개)
// equip·days는 설정 안에서 따로 저장(장비는 각각 true/false, 요일은 7칸 배열)
const WK_EQUIP_KEYS = ["kb", "db", "bench", "bar", "band", "rope", "treadmill"];
const WK_PROFILE_Q = [
  { key: "race", ask: "달리기 목표가 있나요?", help: "대회를 준비 중이면 날짜도 알려 주세요. 남은 주에 맞춰 짜 드려요.", title: "달리기 목표 (하나)", opts: [["none", "없음"], ["5k", "5km"], ["10k", "10km"], ["half", "하프마라톤"], ["full", "풀코스 마라톤"]] },
  { key: "goals", ask: "또 어떤 걸 원하세요?", help: "여러 개 고를 수 있어요.", title: "그 밖의 목표 (여러 개 가능)", multi: true,
    opts: [["strength", "근력·근육 키우기"], ["fatloss", "체중 감량"], ["cardio", "심폐 체력"], ["mobility", "유연성·자세"], ["health", "건강 유지"]] },
  { key: "run", ask: "지금 쉬지 않고 얼마나 달릴 수 있나요?", help: "러닝 거리와 속도를 정하는 데 써요.", title: "지금 쉬지 않고 달릴 수 있는 시간", opts: [["none", "러닝 안 함"], ["beg", "걷기 섞어야 함"], ["r30", "30분"], ["r60", "1시간 이상"], ["r120", "2시간 이상 (풀코스 경험)"]] },
  { key: "exp", ask: "근력 운동은 해 봤나요?", help: "처음이면 쉬운 동작과 적은 횟수로 시작해요.", title: "근력 운동 경험", opts: [["beg", "처음이에요"], ["mid", "6개월~2년"], ["adv", "2년 이상"]] },
  { key: "age", ask: "나이대를 알려 주세요", help: "회복 시간과 강도를 맞추는 데 써요.", title: "나이대", opts: [[20, "20대 이하"], [30, "30대"], [40, "40대"], [50, "50대"], [60, "60대 이상"]] },
  { key: "intensity", ask: "어느 정도 강도가 좋아요?", help: "세트 수와 쉬는 시간이 달라져요.", title: "원하는 강도", opts: [["easy", "가볍게"], ["mid", "보통"], ["hard", "세게"]] },
  { key: "pullups", ask: "턱걸이는 몇 개 할 수 있나요?", help: "못 해도 괜찮아요. 쉬운 당기기 동작으로 바꿔 드려요.", title: "턱걸이 최대 개수", opts: [[0, "못 해요"], [1, "1~4개"], [5, "5~9개"], [10, "10개 이상"]] },
  { key: "where", ask: "근력 운동은 주로 어디서 하나요?", help: "헬스장이면 바벨·머신 루틴도 넣어 드려요.", title: "근력 운동은 주로 어디서?", opts: [["home", "집 (홈트)"], ["gym", "헬스장"], ["both", "둘 다"]] },
  { key: "equip", ask: "집에 있는 운동 장비를 골라 주세요", help: "없어도 괜찮아요. 맨몸 운동으로 짜 드려요.", title: "집에 있는 장비 (여러 개 선택)", multi: true,
    opts: [["kb", "커틀벨"], ["db", "덤벨"], ["bench", "평벤치"], ["bar", "턱걸이 기구"], ["band", "저항 밴드"], ["rope", "줄넘기"], ["treadmill", "러닝머신"]] },
  { key: "days", ask: "운동할 수 있는 요일은?", help: "이 요일 안에서만 운동을 넣어요.", title: "운동할 수 있는 요일", multi: true, opts: WK_DAY_NAMES.map((n, i) => [i, n]) },
  { key: "minutes", ask: "근력 운동은 한 번에 몇 분 할 수 있나요?", help: "러닝 날은 따로 계산해요.", title: "한 번에 운동할 시간 (근력)", opts: [[20, "20분"], [30, "30분"], [45, "45분"], [60, "60분"], [90, "90분"]] },
  { key: "limits", ask: "조심해야 할 부위가 있나요?", help: "고르면 그 부위에 무리가 가는 동작을 빼요. 없으면 그냥 다음.", title: "조심해야 할 부위 (있으면 선택)", multi: true, opts: [["knee", "무릎"], ["back", "허리"], ["shoulder", "어깨"], ["wrist", "손목"], ["ankle", "발목"]] },
];
let wkDraft = null; // 고치는 중인 설정

function wkDraftValue(key) {
  if (key === "equip") return WK_EQUIP_KEYS.filter((k) => wkDraft[k]);
  if (key === "days") return wkDraft.days.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
  return wkDraft[key];
}

// 답 하나 고르기 (처음 설정·설정 바꾸기 공통)
function wkPickAnswer(key, raw) {
  const q = WK_PROFILE_Q.find((x) => x.key === key);
  const v = typeof q.opts[0][0] === "number" ? Number(raw) : raw;
  if (q.key === "equip") wkDraft[v] = !wkDraft[v];
  else if (q.key === "days") wkDraft.days[v] = !wkDraft.days[v];
  else if (q.multi) wkDraft[q.key] = wkDraft[q.key].indexOf(v) >= 0 ? wkDraft[q.key].filter((x) => x !== v) : wkDraft[q.key].concat([v]);
  else wkDraft[q.key] = v;
  // 러닝 안 하면 달리기 목표는 없음, 달리기 목표가 있으면 러닝은 함
  if (q.key === "run" && v === "none") wkDraft.race = "none";
  if (q.key === "race" && v !== "none" && wkDraft.run === "none") wkDraft.run = "beg";
}

// 입력칸(이름·대회 날짜·무게)에 적은 것은 다시 그리기 전에 담아 두기
function wkKeepTyped() {
  const nm = document.getElementById("wk-pf-name");
  if (nm) wkDraft.name = nm.value.trim();
  const rd = document.getElementById("wk-pf-race");
  if (rd) wkDraft.raceDate = rd.value;
}

// 장비 무게 입력칸
function wkWeightInputs() {
  return `<div class="wk-weights">
    ${wkDraft.kb ? `<label>커틀벨 가벼운 것 <input type="number" inputmode="decimal" class="wk-input wk-kg" data-w="kbLight" value="${wkDraft.kbLight}">kg</label>
    <label>커틀벨 무거운 것 <input type="number" inputmode="decimal" class="wk-input wk-kg" data-w="kbHeavy" value="${wkDraft.kbHeavy}">kg</label>
    <p class="wk-note">커틀벨이 하나면 두 칸에 같은 무게를 넣으세요.</p>` : ""}
    ${wkDraft.db ? `<label>덤벨 (한 개 무게) <input type="number" inputmode="decimal" class="wk-input wk-kg" data-w="dbKg" value="${wkDraft.dbKg}">kg</label>` : ""}
  </div>`;
}
function wkBindWeights(box) {
  box.querySelectorAll("[data-w]").forEach((inp) => inp.addEventListener("input", () => {
    const n = parseFloat(inp.value);
    if (n > 0) wkDraft[inp.dataset.w] = n;
  }));
}
function wkRaceExtra() {
  if (wkDraft.race === "none") return "";
  let html = `<label class="wk-date">대회 날짜 (있으면) <input type="date" id="wk-pf-race" class="wk-input" value="${wkDraft.raceDate || ""}"></label>`;
  if (wkDraft.race === "full" && (wkDraft.run === "beg" || wkDraft.run === "r30")) {
    html += `<p class="wk-note wk-safety">풀코스는 보통 1시간 이상 쉬지 않고 달릴 수 있을 때 시작해요. 처음엔 짧게 시작해서 점점 늘려 갈게요.</p>`;
  }
  return html;
}

// 답을 글로 ("하프마라톤", "커틀벨, 덤벨")
function wkAnswerText(pr, q) {
  const v = q.key === "equip" ? WK_EQUIP_KEYS.filter((k) => pr[k]) : q.key === "days" ? (Array.isArray(pr.days) ? pr.days : []).map((on, i) => (on ? i : -1)).filter((i) => i >= 0) : pr[q.key];
  const labels = (q.multi ? v : [v]).map((x) => (q.opts.find((o) => o[0] === x) || [, ""])[1]).filter(Boolean);
  if (q.key === "race" && pr.race !== "none" && pr.raceDate) labels.push(wkShortDate(pr.raceDate));
  return labels.join(q.key === "days" ? "·" : ", ") || "없음";
}
function wkAnswerRows(pr) {
  return `<div class="wk-list">` + (pr.name ? `<div class="wk-row"><span>이름</span><b>${pr.name}</b></div>` : "") +
    WK_PROFILE_Q.map((q) => `<div class="wk-row"><span>${q.title.replace(/\s*\(.*\)/, "")}</span><b>${wkAnswerText(pr, q)}</b></div>`).join("") + `</div>`;
}

// ---------- 설정 탭: 지금 설정 보기 / 바꾸기 ----------
let wkEditing = false;
function wkRenderSettings() {
  if (wkEditing) return wkRenderProfile();
  const box = document.getElementById("wk-profile");
  const pr = Object.assign({}, WK_PROFILE_DEFAULT, wkMigrateProfile(wkState.profile) || {});
  box.innerHTML = `<h2>내 설정</h2>${wkAnswerRows(pr)}
    <button type="button" class="wk-primary" id="wk-pf-edit">설정 바꾸기</button>`;
  document.getElementById("wk-pf-edit").addEventListener("click", () => {
    wkEditing = true;
    wkDraft = null;
    wkRenderProfile();
  });
}

function wkRenderProfile() {
  if (!wkDraft) wkDraft = JSON.parse(JSON.stringify(Object.assign({}, WK_PROFILE_DEFAULT, wkMigrateProfile(wkState.profile) || {})));
  const box = document.getElementById("wk-profile");
  let html = `<h2>설정 바꾸기</h2>
    <p class="wk-note">바꾸고 저장하면 다음 프로그램부터 반영돼요.</p>
    <h3>이름 (선택)</h3><input id="wk-pf-name" class="wk-input" maxlength="12" placeholder="예: 민수" value="${(wkDraft.name || "").replace(/"/g, "&quot;")}">`;
  WK_PROFILE_Q.forEach((q) => {
    const val = wkDraftValue(q.key);
    html += `<h3>${q.title}</h3><div class="wk-chips${q.key === "days" ? " wk-chips-days" : ""}">` + q.opts.map(([v, label]) => {
      const on = q.multi ? val.indexOf(v) >= 0 : val === v;
      return `<button type="button" class="wk-chip${on ? " on" : ""}" data-q="${q.key}" data-v="${v}">${label}</button>`;
    }).join("") + `</div>`;
    if (q.key === "race") html += wkRaceExtra();
    if (q.key === "equip") html += wkWeightInputs();
  });
  html += `<button type="button" class="wk-primary" id="wk-pf-save">저장</button>
    <button type="button" class="wk-ghost" id="wk-pf-cancel">취소</button>`;
  box.innerHTML = html;

  box.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
    wkKeepTyped();
    wkPickAnswer(b.dataset.q, b.dataset.v);
    const y = window.scrollY;
    wkRenderProfile();
    window.scrollTo(0, y);
  }));
  wkBindWeights(box);
  document.getElementById("wk-pf-save").addEventListener("click", () => {
    wkKeepTyped();
    if (wkDraft.race === "none") wkDraft.raceDate = "";
    if (!wkDraft.days.some((x) => x)) {
      alert("운동할 수 있는 요일을 하나 이상 골라 주세요.");
      return;
    }
    wkState.profile = wkDraft;
    wkDraft = null;
    wkEditing = false;
    wkApplyProfile(wkState.profile);
    // 이번 주 계획이 있으면: 새 설정으로 다시 짤지 묻기 (달력 기록은 그대로)
    if (wkState.weeks[wkWeekKey] && confirm("바뀐 설정으로 이번 주 프로그램을 다시 짤까요?\n(체크한 운동 기록은 달력에 남아요)")) {
      wkPick = wkState.weeks[wkWeekKey].days;
      delete wkState.weeks[wkWeekKey];
      wkTab = "week";
    }
    wkSave();
    wkRender();
    window.scrollTo(0, 0);
  });
  document.getElementById("wk-pf-cancel").addEventListener("click", () => {
    wkDraft = null;
    wkEditing = false;
    wkRenderSettings();
    window.scrollTo(0, 0);
  });
}

// ---------- 처음 한 번: 질문을 한 화면에 하나씩 ----------
let wkOnbStep = 0; // 0 = 환영, 1~질문 수 = 질문, 그다음 = 확인

function wkRenderOnboarding() {
  if (!wkDraft) wkDraft = JSON.parse(JSON.stringify(WK_PROFILE_DEFAULT));
  const box = document.getElementById("wk-onb");
  const Q = WK_PROFILE_Q;
  const n = Q.length;
  const top = (i) => `<div class="wk-onb-top"><button type="button" class="wk-onb-back" data-onb="back" aria-label="이전">‹</button>
    <div class="wk-onb-bar"><i style="width:${(i / (n + 1)) * 100}%"></i></div><span>${Math.min(i, n)}/${n}</span></div>`;
  let html;
  if (wkOnbStep === 0) {
    html = `<div class="wk-onb-hero" aria-hidden="true">
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="r1"/><circle cx="60" cy="60" r="36" class="r2"/><circle cx="60" cy="60" r="22" class="r3"/></svg>
      </div>
      <h2 class="wk-onb-q wk-onb-center">데일리 워크아웃</h2>
      <p class="wk-onb-help wk-onb-center">몇 가지만 물어볼게요. 1분이면 끝나요.<br>답에 맞춰 러닝·홈트·헬스장 루틴을 매주 짜 드려요.</p>
      <label class="wk-onb-name">이름 (선택)<input id="wk-pf-name" class="wk-input" maxlength="12" placeholder="예: 민수" value="${(wkDraft.name || "").replace(/"/g, "&quot;")}"></label>
      <button type="button" class="wk-primary" data-onb="next">시작하기</button>
      <label class="wk-ghost wk-onb-import">다른 폰에서 쓰던 기록 불러오기<input type="file" accept=".json,application/json" hidden id="wk-onb-file"></label>`;
  } else if (wkOnbStep <= n) {
    const q = Q[wkOnbStep - 1];
    const val = wkDraftValue(q.key);
    const isOn = (v) => (q.multi ? val.indexOf(v) >= 0 : val === v);
    html = top(wkOnbStep) + `<h2 class="wk-onb-q">${q.ask}</h2><p class="wk-onb-help">${q.help}</p>`;
    if (q.key === "days") {
      html += `<div class="wk-onb-days">` + q.opts.map(([v, label]) =>
        `<button type="button" class="${isOn(v) ? "on" : ""}" data-q="${q.key}" data-v="${v}" aria-pressed="${isOn(v)}">${label}</button>`).join("") + `</div>`;
    } else {
      html += `<div class="wk-opts">` + q.opts.map(([v, label]) =>
        `<button type="button" class="wk-opt${isOn(v) ? " on" : ""}${q.multi ? " multi" : ""}" data-q="${q.key}" data-v="${v}" aria-pressed="${isOn(v)}"><span>${label}</span><i></i></button>`).join("") + `</div>`;
    }
    if (q.key === "race") html += wkRaceExtra();
    if (q.key === "equip") html += wkWeightInputs();
    html += `<button type="button" class="wk-primary wk-onb-next" data-onb="next">다음</button>`;
  } else {
    html = top(n + 1) + `<h2 class="wk-onb-q">이대로 시작할까요?</h2>
      <p class="wk-onb-help">나중에 아래 '설정' 탭에서 언제든 바꿀 수 있어요.</p>
      ${wkAnswerRows(wkDraft)}
      <p class="wk-note wk-safety">⚠️ 이 앱의 프로그램은 일반적인 운동 안내예요. 통증·질환이 있으면 전문가와 먼저 상의하고, 운동 중 아프면 바로 멈추세요.</p>
      <button type="button" class="wk-primary" data-onb="finish">프로그램 만들기</button>`;
  }
  box.innerHTML = `<div class="wk-onb-step">${html}</div>`;

  const go = (step) => {
    wkKeepTyped();
    wkOnbStep = step;
    wkRenderOnboarding();
    window.scrollTo(0, 0);
  };
  box.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
    wkKeepTyped();
    const q = Q.find((x) => x.key === b.dataset.q);
    wkPickAnswer(q.key, b.dataset.v);
    // 하나만 고르는 질문은 고르면 바로 다음으로 (대회 날짜를 적어야 하면 그대로)
    if (!q.multi && !(q.key === "race" && wkDraft.race !== "none")) {
      wkRenderOnboarding();
      setTimeout(() => go(wkOnbStep + 1), 220);
      return;
    }
    wkRenderOnboarding();
  }));
  wkBindWeights(box);
  box.querySelectorAll("[data-onb]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.onb;
    if (k === "back") return go(Math.max(0, wkOnbStep - 1));
    if (k === "next") {
      if (Q[wkOnbStep - 1] && Q[wkOnbStep - 1].key === "days" && !wkDraft.days.some((x) => x)) {
        alert("운동할 수 있는 요일을 하나 이상 골라 주세요.");
        return;
      }
      return go(wkOnbStep + 1);
    }
    // 끝: 저장하고 이번 주 짜기로
    wkKeepTyped();
    if (wkDraft.race === "none") wkDraft.raceDate = "";
    wkState.profile = wkDraft;
    wkDraft = null;
    wkOnbStep = 0;
    wkApplyProfile(wkState.profile);
    wkSave();
    wkTab = "week";
    wkRender();
    window.scrollTo(0, 0);
  }));
  const file = document.getElementById("wk-onb-file");
  if (file) file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const obj = wkBkParse(String(reader.result || ""));
      if (!obj) {
        alert("워크아웃 백업 파일이 아니거나 망가진 파일이에요. 다른 파일을 골라 주세요.");
        return;
      }
      wkDraft = null;
      wkBkPending = obj;
      wkBkApply("replace");
      wkSetTab("today");
    };
    reader.readAsText(f);
  });
}

// ---------- 탭 ----------
let wkTab = "today";
const WK_TAB_TITLES = { today: "오늘", week: "이번 주", log: "기록", more: "설정" };

function wkApplyTab() {
  document.body.dataset.tab = wkTab;
  document.querySelectorAll("#wk-tabbar [data-tab]").forEach((b) => {
    b.classList.toggle("on", b.dataset.tab === wkTab);
    if (b.dataset.tab === wkTab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.getElementById("wk-title").textContent = WK_TAB_TITLES[wkTab];
  // 제목 위 작은 글씨
  const sun = wkAddDays(wkMon, 6);
  const week = wkState.weeks[wkWeekKey];
  const sub = {
    today: (wkProfile.name ? wkProfile.name + "님, " : "") + `${wkNow.getMonth() + 1}월 ${wkNow.getDate()}일 ${WK_DAY_NAMES[wkTodayIdx]}요일`,
    week: `${wkMon.getMonth() + 1}/${wkMon.getDate()} – ${sun.getMonth() + 1}/${sun.getDate()}` + (week ? " · " + WK_PHASES[week.p].name : ""),
    log: "운동한 날 · 무게 · 지난주들",
    more: "내 정보 · 백업",
  };
  document.getElementById("wk-week-label").textContent = sub[wkTab];
}
function wkSetTab(t) {
  wkTab = t;
  wkApplyTab();
  window.scrollTo(0, 0);
}
// 옆으로 밀어서 탭 넘기기: 손가락을 따라 화면이 움직이고, 충분히 밀면 옆 탭으로
const WK_TAB_ORDER = ["today", "week", "log", "more"];
let wkSwipe = null;
function wkSwipeBlocked(el) {
  return document.body.classList.contains("wk-first") || wkRunActive() || !document.getElementById("wk-sheet").hidden ||
    !!el.closest("input, textarea, select, canvas, .wk-chart, #wk-tabbar");
}
document.addEventListener("touchstart", (e) => {
  wkSwipe = null;
  if (e.touches.length !== 1 || wkSwipeBlocked(e.target)) return;
  const t = e.touches[0];
  wkSwipe = { x: t.clientX, y: t.clientY, t: Date.now(), dx: 0, on: false };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!wkSwipe) return;
  const t = e.touches[0];
  const dx = t.clientX - wkSwipe.x;
  const dy = t.clientY - wkSwipe.y;
  if (!wkSwipe.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return (wkSwipe = null); // 위아래 스크롤
    if (Math.abs(dx) < 12) return;
    wkSwipe.on = true;
  }
  const i = WK_TAB_ORDER.indexOf(wkTab);
  const edge = (dx > 0 && i === 0) || (dx < 0 && i === WK_TAB_ORDER.length - 1);
  wkSwipe.dx = dx;
  const main = document.querySelector("main");
  main.style.transition = "none";
  main.style.transform = `translateX(${edge ? dx * 0.25 : dx}px)`; // 끝 탭이면 살짝만
}, { passive: true });
document.addEventListener("touchend", () => {
  const sw = wkSwipe;
  wkSwipe = null;
  if (!sw || !sw.on) return;
  const main = document.querySelector("main");
  const i = WK_TAB_ORDER.indexOf(wkTab);
  const fast = Math.abs(sw.dx) / Math.max(1, Date.now() - sw.t) > 0.45;
  const j = Math.abs(sw.dx) > window.innerWidth * 0.28 || (fast && Math.abs(sw.dx) > 40) ? i + (sw.dx < 0 ? 1 : -1) : i;
  if (j === i || j < 0 || j >= WK_TAB_ORDER.length) {
    main.style.transition = "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)";
    main.style.transform = "";
    return;
  }
  // 밀던 쪽으로 빠져나가고, 새 탭은 반대쪽에서 들어옴
  const dir = sw.dx < 0 ? -1 : 1;
  main.style.transition = "transform 0.16s ease-in";
  main.style.transform = `translateX(${dir * window.innerWidth}px)`;
  setTimeout(() => {
    wkSetTab(WK_TAB_ORDER[j]);
    main.style.transition = "none";
    main.style.transform = `translateX(${-dir * window.innerWidth * 0.35}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      main.style.transition = "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)";
      main.style.transform = "";
    }));
  }, 160);
});
document.addEventListener("touchcancel", () => {
  if (wkSwipe && wkSwipe.on) document.querySelector("main").style.transform = "";
  wkSwipe = null;
});

document.querySelectorAll("#wk-tabbar [data-tab]").forEach((b) => b.addEventListener("click", () => {
  if (wkTab === b.dataset.tab) return window.scrollTo({ top: 0, behavior: "smooth" });
  wkSetTab(b.dataset.tab);
}));

// ---------- 오늘 탭 ----------
// 세션을 한 줄씩 (준비 운동, 동작 이름 + 세트×횟수)
function wkSessionRows(week, slot, ses) {
  const rows = [];
  ses.blocks.forEach((blk, bi) => {
    if (blk.text) rows.push({ text: true, name: blk.name, run: blk.run || blk.cardio });
    (blk.items || []).forEach((it, ii) => {
      const key = `${slot.day}-${bi}-${ii}`;
      const pool = wkPool(it.pool);
      const ex = pool[(it.idx + (week.swaps[key] || 0)) % pool.length];
      const reps = wkRepsText(ex, week.p);
      rows.push({ ex: ex, meta: blk.circuit || blk.emom ? reps : `${it.sets}×${reps}`, opt: blk.opt, group: blk.circuit ? "서킷" : blk.emom ? "EMOM" : "" });
    });
  });
  return rows;
}

function wkRenderToday() {
  const box = document.getElementById("wk-today");
  const week = wkState.weeks[wkWeekKey];
  const ringCard = document.getElementById("wk-progress-card");
  if (!week) {
    ringCard.hidden = true;
    box.innerHTML = `<div class="wk-card wk-hero"><span class="wk-eyebrow">이번 주</span><h2>아직 계획이 없어요</h2>
      <p class="wk-note">며칠 운동할지 고르면 이번 주 프로그램을 짜 드려요.</p>
      <button type="button" class="wk-primary" data-go="week">이번 주 프로그램 짜기</button></div>`;
    box.querySelector("[data-go]").addEventListener("click", () => wkSetTab("week"));
    return;
  }
  // 활동 링: 한 바퀴 = 이번 주 운동을 다 함
  ringCard.hidden = false;
  const ph = WK_PHASES[week.p];
  const doneCount = week.slots.filter((s) => week.done[s.day]).length;
  document.getElementById("wk-phase-name").textContent = ph.name;
  document.getElementById("wk-phase-tip").textContent = ph.tip;
  document.getElementById("wk-progress-text").innerHTML = `<b>${doneCount}</b><small>/${week.slots.length}</small>`;
  const ring = document.getElementById("wk-ring-fill");
  const pct = (doneCount / week.slots.length) * 100;
  const len = 2 * Math.PI * 33; // 링 둘레 (index.html의 r="33")
  ring.style.opacity = pct > 0 ? 1 : 0;
  requestAnimationFrame(() => (ring.style.strokeDasharray = (len * pct) / 100 + " " + len)); // 화면에 보인 뒤에 채워야 차오르는 효과가 남

  const slot = wkSlotOf(week, wkTodayIdx);
  let html = "";
  const title = (s) => (s.place === "gym" ? WK_GYM_TITLE[s.type].replace(" · 헬스장", "") : WK_TYPES[s.type].title);
  if (slot) {
    const ses = wkSessionFor(week, slot);
    const rows = wkSessionRows(week, slot, ses);
    const done = week.done[wkTodayIdx];
    const eqs = {};
    rows.forEach((r) => r.ex && r.ex.eq.forEach((e) => (eqs[e] = true)));
    if (rows.some((r) => r.run)) eqs.run = true;
    html += `<div class="wk-card wk-hero${done ? " is-done" : ""}">
      <span class="wk-eyebrow">오늘의 운동</span>
      <h2><span class="wk-dot" style="background:${WK_TYPES[slot.type].color}"></span>${ses.title}</h2>
      <p class="wk-hero-meta">약 ${ses.min}분 · 동작 ${rows.filter((r) => r.ex).length}개 ${wkPlaceTag(slot.place)}</p>
      <div class="wk-eq-row">${wkEqTags(Object.keys(WK_EQ).filter((e) => eqs[e]))}</div>
      ${done ? `<p class="wk-done-badge">✓ 오늘 운동 완료! 수고했어요</p>` : `<button type="button" class="wk-primary wk-start" data-run>▶ ${wkRunLabel(week, wkTodayIdx)}</button>`}
      <ul class="wk-ex-list">` + rows.map((r, i) => r.text
        ? `<li class="wk-ex-li is-text"><span class="wk-ex-ic">${r.run ? "🏃" : "🔥"}</span><span class="wk-ex-nm">${r.name}</span></li>`
        : `<li><button type="button" class="wk-ex-li" data-row="${i}"><span class="wk-ex-ic">▶</span><span class="wk-ex-nm">${r.ex.n}${r.opt ? " <small>선택</small>" : ""}</span><span class="wk-ex-mt">${r.meta}</span></button></li>`).join("") + `</ul>
      <button type="button" class="wk-link" data-go="day">자세히 보기 · 동작 바꾸기 ›</button>
    </div>`;
    box.innerHTML = html;
    box.querySelectorAll("[data-row]").forEach((b) => b.addEventListener("click", () => {
      const r = rows[Number(b.dataset.row)];
      wkOpenMotion(r.ex, r.meta);
    }));
    const run = box.querySelector("[data-run]");
    if (run) run.addEventListener("click", () => wkRunOpen(wkTodayIdx));
  } else {
    const next = week.slots.find((s) => s.day > wkTodayIdx && !week.done[s.day]);
    html += `<div class="wk-card wk-hero"><span class="wk-eyebrow">오늘</span><h2>쉬는 날 😌</h2>
      <p class="wk-note">가벼운 걷기나 스트레칭이면 충분해요. 근육은 쉬는 동안 자라요.</p>
      ${next ? `<p class="wk-next">다음 운동 · <b>${WK_DAY_NAMES[next.day]}요일 ${title(next)}</b></p>` : ""}
      <button type="button" class="wk-ghost" data-go="day">오늘 운동하고 싶어요</button></div>`;
    box.innerHTML = html;
  }
  // 이번 주 한눈에
  const list = document.createElement("div");
  list.className = "wk-card";
  list.innerHTML = `<h2>이번 주 운동</h2><ul class="wk-week-list">` + week.slots.map((s) => {
    const st = week.done[s.day] ? "done" : s.day < wkTodayIdx ? "missed" : s.day === wkTodayIdx ? "today" : "";
    return `<li><button type="button" class="wk-wl ${st}" data-day="${s.day}"><span class="wk-wl-d">${WK_DAY_NAMES[s.day]}</span>
      <span class="wk-dot" style="background:${WK_TYPES[s.type].color}"></span><span class="wk-wl-t">${title(s)}</span>
      <span class="wk-wl-s">${week.done[s.day] ? "✓" : st === "today" ? "오늘" : st === "missed" ? "못 함" : ""}</span></button></li>`;
  }).join("") + `</ul>`;
  box.appendChild(list);
  box.querySelectorAll("[data-day]").forEach((b) => b.addEventListener("click", () => {
    wkViewDay = Number(b.dataset.day);
    wkRenderPlan();
    wkSetTab("week");
  }));
  box.querySelectorAll('[data-go="day"]').forEach((b) => b.addEventListener("click", () => {
    wkViewDay = wkTodayIdx;
    wkRenderPlan();
    wkSetTab("week");
  }));
}

// ---------- 시작 ----------
function wkRender() {
  const first = !wkState.profile;
  document.body.classList.toggle("wk-first", first);
  document.getElementById("wk-onb").hidden = !first;
  if (first) {
    wkRenderOnboarding();
    return;
  }
  if (wkState.weeks[wkWeekKey]) wkRenderPlan();
  else {
    wkRenderSetup();
    wkRenderToday();
  }
  wkRenderCal();
  wkRenderHistory();
  wkRenderSettings();
  wkApplyTab();
}

document.querySelectorAll("#wk-lsd-seg button").forEach((b) => b.addEventListener("click", () => {
  wkState.lsdDay = Number(b.dataset.lsd);
  wkSave();
  wkRenderSetup();
}));
document.getElementById("wk-make").addEventListener("click", wkMakePlan);
document.querySelectorAll("#wk-mode-seg button").forEach((b) => b.addEventListener("click", () => {
  wkMode = b.dataset.mode;
  wkRenderSetup();
}));
document.getElementById("wk-reset").addEventListener("click", () => {
  if (!confirm("이번 주 계획과 체크 기록을 지우고 다시 짤까요?")) return;
  const week = wkState.weeks[wkWeekKey];
  wkPick = week.days;
  wkMode = week.mode || "auto";
  wkState.lsdDay = week.lsd;
  delete wkState.weeks[wkWeekKey];
  if (!Object.keys(wkState.weeks).length) wkState.firstWeek = null;
  wkSave();
  wkRender();
  window.scrollTo(0, 0);
});
document.getElementById("wk-timer-plus").addEventListener("click", () => {
  wkTimerEnd = Math.max(wkTimerEnd, Date.now()) + 30000;
  document.getElementById("wk-timer").classList.remove("ring");
  clearInterval(wkTimerId);
  wkTimerId = setInterval(wkTick, 250);
});
document.getElementById("wk-timer-stop").addEventListener("click", () => {
  clearInterval(wkTimerId);
  document.getElementById("wk-timer").hidden = true;
});

wkRender();

// 새 버전 알림 (version.json이 지금보다 높으면)
(async function wkCheckUpdate() {
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    const v = (await r.json()).version;
    if (v > Number(document.documentElement.dataset.version)) {
      document.getElementById("wk-update-banner").hidden = false;
      document.getElementById("wk-update-btn").addEventListener("click", () => {
        location.href = location.pathname + "?v=" + v;
      });
    }
  } catch (e) { /* 오프라인이면 무시 */ }
})();
