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
const wkNow = wkToday();
const wkMon = wkMonday(wkNow);
const wkWeekKey = wkDateKey(wkMon);
const wkTodayIdx = wkDayIndex(wkNow);
let wkPick = null;        // 설정 화면에서 고른 일수
let wkViewDay = wkTodayIdx; // 계획 화면에서 보고 있는 요일

// ---------- 요일에 세션 놓기 ----------
// 오늘부터 일요일까지 남은 날 중에 고르게 펼치고, LSD는 고른 주말 요일에
function wkPlace(n, lsdDay, fromDay) {
  const types = WK_TEMPLATES[n].slice();
  const avail = [];
  for (let d = fromDay; d < 7; d++) avail.push(d);
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
  return slots.sort((a, b) => a.day - b.day);
}

function wkPhaseOf(absWeek) {
  const first = wkState.firstWeek == null ? absWeek : wkState.firstWeek;
  return (((absWeek - first) % 4) + 4) % 4;
}

// ---------- 설정 화면 ----------
function wkRenderSetup() {
  document.getElementById("wk-setup").hidden = false;
  document.getElementById("wk-plan").hidden = true;
  const left = 7 - wkTodayIdx;
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
  document.getElementById("wk-day-note").textContent =
    wkTodayIdx > 0 ? `오늘(${WK_DAY_NAMES[wkTodayIdx]})부터 일요일까지 ${left}일 남아서 최대 ${left}일까지 고를 수 있어요.` : "월요일이에요. 한 주 전체로 짤게요.";

  document.querySelectorAll("#wk-lsd-seg button").forEach((b) => {
    b.classList.toggle("on", Number(b.dataset.lsd) === wkState.lsdDay);
  });

  const prev = document.getElementById("wk-preview");
  prev.innerHTML = "";
  const make = document.getElementById("wk-make");
  make.disabled = !wkPick;
  if (!wkPick) {
    prev.innerHTML = "<li class='wk-note'>위에서 일수를 골라 주세요.</li>";
    return;
  }
  wkPlace(wkPick, wkState.lsdDay, wkTodayIdx).forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${WK_DAY_NAMES[s.day]}</b><span class="wk-dot" style="background:${WK_TYPES[s.type].color}"></span>${WK_TYPES[s.type].title}`;
    prev.appendChild(li);
  });
}

function wkMakePlan() {
  if (!wkPick) return;
  const abs = wkAbsWeek(wkMon);
  if (wkState.firstWeek == null) wkState.firstWeek = abs;
  wkState.weeks[wkWeekKey] = {
    days: wkPick,
    lsd: wkState.lsdDay,
    w: abs,
    p: wkPhaseOf(abs),
    slots: wkPlace(wkPick, wkState.lsdDay, wkTodayIdx),
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

  const ph = WK_PHASES[week.p];
  const doneCount = week.slots.filter((s) => week.done[s.day]).length;
  document.getElementById("wk-phase-name").textContent = ph.name;
  document.getElementById("wk-progress-text").textContent = `${doneCount} / ${week.slots.length} 완료`;
  document.getElementById("wk-bar-fill").style.width = (doneCount / week.slots.length) * 100 + "%";
  document.getElementById("wk-phase-tip").textContent = ph.tip;

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
      (s ? `<span class="wk-sd-tag" style="background:${WK_TYPES[s.type].color}">${week.done[d] ? "✓" : WK_TYPES[s.type].short}</span>` : `<span class="wk-sd-rest">휴식</span>`);
    b.addEventListener("click", () => {
      wkViewDay = d;
      wkRenderPlan();
    });
    strip.appendChild(b);
  }

  wkRenderSession(week);
  wkRenderHistory();
}

function wkEqTags(eqs) {
  return eqs.map((e) => `<span class="wk-eq wk-eq-${e}">${WK_EQ[e]}</span>`).join("");
}

// 한 요일 세션에서 실제로 하는 동작들 (바꾸기 반영)
function wkExercisesOf(week, slot, ses) {
  const out = [];
  ses.blocks.forEach((blk, bi) => (blk.items || []).forEach((it, ii) => {
    const pool = WK_POOLS[it.pool];
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
      wkExercisesOf(wk, s, wkBuildSession(s.type, wk.w, wk.p, i)).forEach((ex) => {
        used[ex.n] = Math.max(used[ex.n] || 0, score);
      });
    });
  });
  return used;
}

function wkSessionFor(week, slot) {
  const dayNo = week.slots.indexOf(slot);
  const used = slot.type === "indoor" ? wkUsedMap(week, slot.day) : null;
  return wkBuildSession(slot.type, week.w, week.p, dayNo, used);
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

  if (!slot) {
    const todaySlot = wkSlotOf(week, wkTodayIdx);
    box.innerHTML = `<div class="wk-card"><p class="wk-day-label">${dayLabel}</p><h2>쉬는 날</h2>
      <p class="wk-note">가벼운 걷기나 스트레칭 정도면 충분해요. 근육은 쉬는 동안 자라요.</p>
      ${d === wkTodayIdx && !todaySlot ? "<p class='wk-note'>오늘 운동하고 싶으면 위에서 다른 요일 운동을 눌러 '오늘로 옮기기'를 하세요.</p>" : ""}</div>`;
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
    <p class="wk-note">약 ${ses.min}분</p><div class="wk-eq-row" data-eq-row></div>`;
  if (WK_RUN_TYPES.indexOf(slot.type) >= 0 && !week.done[d]) {
    html += `<button type="button" class="wk-rain" data-indoor>🌧 비 와요 · 실내 근력으로 바꾸기</button>`;
  }
  if (slot.type === "indoor") {
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
      if (blk.run) {
        allEq.run = true;
        html += `<button type="button" class="wk-check ${ok}" data-check="${key}">${ok ? "✓ 했어요" : "다 했으면 누르기"}</button>`;
      }
    }
    if (blk.circuit || blk.emom) {
      const key = `${d}-${bi}-r`;
      const n = blk.circuit || 1;
      const got = week.checks[key] || 0;
      html += `<div class="wk-rounds">${blk.circuit ? "라운드" : "완료"} ` +
        Array.from({ length: n }, (_, i) => `<button type="button" class="wk-set ${i < got ? "on" : ""}" data-set="${key}" data-n="${i + 1}">${i + 1}</button>`).join("") + `</div>`;
    }
    (blk.items || []).forEach((it, ii) => {
      const key = `${d}-${bi}-${ii}`;
      const pool = WK_POOLS[it.pool];
      const ex = pool[(it.idx + (week.swaps[key] || 0)) % pool.length];
      exByKey[key] = ex;
      ex.eq.forEach((e) => (allEq[e] = true));
      const reps = wkRepsText(ex, week.p);
      const got = week.checks[key] || 0;
      html += `<div class="wk-ex"><div class="wk-ex-top"><div><button type="button" class="wk-ex-name" data-show="${key}" data-reps="${blk.circuit || blk.emom ? reps : `${it.sets}세트 × ${reps}`}"><span class="wk-play">▶</span>${ex.n}</button>
        <div class="wk-ex-meta">${blk.circuit || blk.emom ? reps : `${it.sets}세트 × ${reps}`}</div></div>
        <button type="button" class="wk-swap" data-swap="${key}" aria-label="다른 동작으로 바꾸기">↻ 바꾸기</button></div>
        <p class="wk-tip">${ex.tip}</p><div class="wk-ex-bottom"><span>${wkEqTags(ex.eq)}</span>`;
      if (!blk.circuit && !blk.emom) {
        html += `<span class="wk-sets">` + Array.from({ length: it.sets }, (_, i) =>
          `<button type="button" class="wk-set ${i < got ? "on" : ""}" data-set="${key}" data-n="${i + 1}">${i + 1}</button>`).join("") + `</span>`;
      }
      html += `</div></div>`;
    });
    html += `</div>`;
  });

  html += `<button type="button" class="wk-primary" data-finish>${week.done[d] ? "✓ 완료한 운동 (다시 누르면 취소)" : "운동 완료!"}</button>`;
  if (d !== wkTodayIdx && !wkSlotOf(week, wkTodayIdx) && !week.done[d]) {
    html += `<button type="button" class="wk-ghost" data-move>오늘로 옮기기</button>`;
  }
  card.innerHTML = html;
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
  card.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => {
    wkOpenMotion(exByKey[b.dataset.show], b.dataset.reps);
  }));
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

function wkOpenMotion(ex, reps) {
  const key = WK_MOTION_OF[ex.n];
  const weight = ex.eq.indexOf("db") >= 0 ? "db" : ex.eq.indexOf("kb4") >= 0 || ex.eq.indexOf("kb12") >= 0 ? "kb" : null;
  document.getElementById("wk-sheet-title").textContent = ex.n;
  document.getElementById("wk-sheet-reps").textContent = reps;
  document.getElementById("wk-sheet-how").innerHTML = (WK_HOW[key] || []).map((t) => `<li>${t}</li>`).join("");
  document.getElementById("wk-sheet-tip").textContent = "💡 " + ex.tip;
  document.getElementById("wk-sheet-eq").innerHTML = wkEqTags(ex.eq);
  document.getElementById("wk-sheet").hidden = false;
  document.body.classList.add("wk-noscroll");
  if (wkStopMotion) wkStopMotion();
  wkStopMotion = moPlay(document.getElementById("wk-sheet-anim"), key, weight);
}
function wkCloseMotion() {
  if (wkStopMotion) wkStopMotion();
  wkStopMotion = null;
  document.getElementById("wk-sheet").hidden = true;
  document.body.classList.remove("wk-noscroll");
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

// ---------- 시작 ----------
function wkRender() {
  const sun = wkAddDays(wkMon, 6);
  document.getElementById("wk-week-label").textContent =
    `${wkMon.getMonth() + 1}/${wkMon.getDate()} – ${sun.getMonth() + 1}/${sun.getDate()} 이번 주`;
  if (wkState.weeks[wkWeekKey]) wkRenderPlan();
  else wkRenderSetup();
  wkRenderCal();
}

document.querySelectorAll("#wk-lsd-seg button").forEach((b) => b.addEventListener("click", () => {
  wkState.lsdDay = Number(b.dataset.lsd);
  wkSave();
  wkRenderSetup();
}));
document.getElementById("wk-make").addEventListener("click", wkMakePlan);
document.getElementById("wk-reset").addEventListener("click", () => {
  if (!confirm("이번 주 계획과 체크 기록을 지우고 다시 짤까요?")) return;
  const week = wkState.weeks[wkWeekKey];
  wkPick = week.days;
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
