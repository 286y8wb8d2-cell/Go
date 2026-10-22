// =============================================
// 운동 모드: "운동 시작"을 누르면 동작을 하나씩 전체 화면으로
// 세트 완료 → 휴식 타이머가 저절로 → 다음 동작. 다 하면 완료 화면
// 하던 자리는 week.checks["요일-pos"]에 저장 (나갔다 와도 이어서)
// workout.js보다 먼저 불러옴 (여기 함수들은 누를 때만 쓰임)
// =============================================

let wkRun = null;      // { d, week, slot, ses, moves, i, phase: "go" | "rest" | "done", ... }
let wkRunTimer = null; // 휴식·EMOM 시계
let wkRunLock = null;  // 화면 꺼짐 막기
let wkRunAnimEx = null; // 지금 그리고 있는 동작 (같으면 다시 안 그림)

function wkRunActive() {
  return !!wkRun;
}

function wkRunLabel(week, d) {
  return week.checks[d + "-pos"] > 0 ? "이어서 하기" : "운동 시작";
}

// 세션을 "할 일" 한 줄로 펼치기
// text: 준비 운동·러닝처럼 글로 된 것 / set: 동작 한 세트 / circ: 서킷 한 동작 / emom: 분마다 하는 블록
// 번갈아 하는 블록은 A 1세트 → B 1세트 → 휴식 → A 2세트 … 순서
function wkRunMoves(week, slot, ses) {
  const d = slot.day;
  const moves = [];
  ses.blocks.forEach((blk, bi) => {
    const items = (blk.items || []).map((it, ii) => {
      const key = `${d}-${bi}-${ii}`;
      const pool = wkPool(it.pool);
      const ex = pool[(it.idx + (week.swaps[key] || 0)) % pool.length];
      return { it: it, key: key, ex: ex, reps: wkRepsText(ex, week.p) };
    });
    if (blk.text) moves.push({ t: "text", blk: blk, bi: bi, key: blk.run || blk.cardio ? `${d}-${bi}-t` : null });
    if (!items.length) return;
    if (blk.emom) {
      moves.push({ t: "emom", blk: blk, bi: bi, key: `${d}-${bi}-r`, items: items });
      return;
    }
    if (blk.circuit) {
      for (let r = 1; r <= blk.circuit; r++) {
        items.forEach((x, k) => moves.push({ t: "circ", blk: blk, bi: bi, key: `${d}-${bi}-r`, x: x, round: r, of: blk.circuit,
          k: k, n: items.length, rest: k === items.length - 1 ? blk.rest || 90 : 0 }));
      }
      return;
    }
    const most = Math.max.apply(null, items.map((x) => x.it.sets));
    for (let s = 1; s <= most; s++) {
      const these = items.filter((x) => x.it.sets >= s);
      these.forEach((x, k) => moves.push({ t: "set", blk: blk, bi: bi, key: x.key, x: x, set: s, of: x.it.sets,
        pair: these.length > 1 ? these[(k + 1) % these.length].ex.n : "", rest: k === these.length - 1 ? blk.rest || 60 : 0 }));
    }
  });
  return moves;
}

function wkRunOpen(d) {
  const week = wkState.weeks[wkWeekKey];
  const slot = week && wkSlotOf(week, d);
  if (!slot) return;
  const ses = wkSessionFor(week, slot);
  const moves = wkRunMoves(week, slot, ses);
  if (!moves.length) return;
  try {
    wkAudio = wkAudio || new (window.AudioContext || window.webkitAudioContext)();
    if (wkAudio.state === "suspended") wkAudio.resume();
  } catch (e) { /* 소리 없이 */ }
  wkRun = { d: d, week: week, slot: slot, ses: ses, moves: moves, i: Math.min(week.checks[d + "-pos"] || 0, moves.length - 1),
    phase: "go", started: Date.now(), sets: 0 };
  wkRunAnimEx = null;
  document.getElementById("wk-timer").hidden = true;
  clearInterval(wkTimerId);
  const box = document.getElementById("wk-run");
  box.innerHTML = `<div class="wk-run-top">
      <button type="button" class="wk-run-x" data-run="close" aria-label="나가기">✕</button>
      <div class="wk-run-bar"><i></i></div><span class="wk-run-count"></span>
    </div>
    <div class="wk-run-anim" id="wk-run-anim"></div>
    <div class="wk-run-body" id="wk-run-body"></div>`;
  box.hidden = false;
  box.scrollTop = 0;
  document.body.classList.add("wk-noscroll");
  wkRunWake(true);
  wkRunRender();
}

function wkRunClose() {
  clearInterval(wkRunTimer);
  wkRunTimer = null;
  wkStopAnyMotion();
  wkRunWake(false);
  wkRun = null;
  wkRunAnimEx = null;
  const box = document.getElementById("wk-run");
  box.hidden = true;
  box.innerHTML = "";
  document.body.classList.remove("wk-noscroll");
  wkRenderPlan(); // 체크한 세트·완료를 다른 화면에도
  wkRenderCal();
}

// 운동하는 동안 화면이 꺼지지 않게 (되는 브라우저만)
async function wkRunWake(on) {
  try {
    if (on && "wakeLock" in navigator) wkRunLock = await navigator.wakeLock.request("screen");
    else if (!on && wkRunLock) {
      await wkRunLock.release();
      wkRunLock = null;
    }
  } catch (e) { /* 안 되면 그냥 */ }
}
document.addEventListener("visibilitychange", () => {
  if (wkRun && document.visibilityState === "visible") {
    wkRunWake(true);
    wkRunTick();
  }
});

function wkRunVibe(p) {
  try {
    if (navigator.vibrate) navigator.vibrate(p);
  } catch (e) { /* 진동 없는 기기 */ }
}

// ---------- 진행 ----------
function wkRunSavePos() {
  wkRun.week.checks[wkRun.d + "-pos"] = wkRun.i;
  wkSave();
}

// "세트 완료" · "완료" 눌렀을 때
function wkRunComplete() {
  const m = wkRun.moves[wkRun.i];
  const ch = wkRun.week.checks;
  if (m.t === "set") {
    ch[m.key] = Math.max(ch[m.key] || 0, m.set);
    wkRun.sets++;
    wkRunSaveLift(m);
  }
  if (m.t === "circ") {
    if (m.k === m.n - 1) ch[m.key] = Math.max(ch[m.key] || 0, m.round);
    wkRun.sets++;
  }
  if (m.t === "emom") ch[m.key] = 1;
  if (m.t === "text" && m.key) ch[m.key] = true;
  wkRunVibe(30);
  wkRunGo(wkRun.i + 1, m.rest || 0);
}

// i번째 할 일로 (rest초만큼 쉬고)
function wkRunGo(i, rest) {
  clearInterval(wkRunTimer);
  wkRunTimer = null;
  wkRun.i = Math.max(0, i);
  wkRun.emomStart = 0;
  if (wkRun.i >= wkRun.moves.length) return wkRunFinish();
  wkRunSavePos();
  if (rest > 0) {
    wkRun.phase = "rest";
    wkRun.restEnd = Date.now() + rest * 1000;
    wkRun.restTotal = rest;
    wkRunTimer = setInterval(wkRunTick, 250);
  } else {
    wkRun.phase = "go";
  }
  wkRunRender();
  document.getElementById("wk-run").scrollTop = 0;
}

// 선택 블록 통째로 건너뛰기
function wkRunSkipBlock() {
  const bi = wkRun.moves[wkRun.i].bi;
  let j = wkRun.i;
  while (j < wkRun.moves.length && wkRun.moves[j].bi === bi) j++;
  wkRunGo(j, 0);
}

function wkRunFinish() {
  const r = wkRun;
  delete r.week.checks[r.d + "-pos"];
  r.week.done[r.d] = true;
  wkLogSet(wkDateKey(wkAddDays(wkMon, r.d)), true, r.slot.type);
  wkSave();
  r.phase = "done";
  clearInterval(wkRunTimer);
  wkRunTimer = null;
  wkStopAnyMotion();
  wkRunAnimEx = null;
  wkBeep();
  wkRunVibe([80, 60, 160]);
  wkRunRender();
}

// 헬스장 동작: 세트를 끝낼 때마다 무게·횟수 저장 (마지막 세트 값이 남음)
function wkRunSaveLift(m) {
  if (!wkTracksWeight(m.x.ex)) return;
  const kgIn = document.getElementById("wk-run-kg");
  const repIn = document.getElementById("wk-run-reps");
  if (!kgIn) return;
  const kg = parseFloat(kgIn.value) || parseFloat(kgIn.placeholder) || 0;
  if (kg > 0) wkLiftSave(m.x.ex.n, wkDateKey(wkAddDays(wkMon, wkRun.d)), kg, parseInt(repIn.value, 10) || 0);
}

// 휴식·EMOM 시계
function wkRunTick() {
  if (!wkRun) return;
  if (wkRun.phase === "rest") {
    const left = Math.max(0, Math.ceil((wkRun.restEnd - Date.now()) / 1000));
    const clock = document.getElementById("wk-run-clock");
    if (clock) clock.textContent = wkRunMmss(left);
    const ring = document.getElementById("wk-run-ring");
    if (ring) {
      const len = 2 * Math.PI * 54;
      ring.style.strokeDasharray = (len * Math.min(1, (wkRun.restEnd - Date.now()) / 1000 / wkRun.restTotal)) + " " + len;
    }
    if (left === 0) {
      wkBeep();
      wkRunVibe([200, 100, 200]);
      clearInterval(wkRunTimer);
      wkRunTimer = null;
      wkRun.phase = "go";
      wkRunRender();
    }
  } else if (wkRun.phase === "go" && wkRun.emomStart) {
    const m = wkRun.moves[wkRun.i];
    const total = m.blk.emom * 60;
    const gone = Math.floor((Date.now() - wkRun.emomStart) / 1000);
    if (gone >= total) {
      wkBeep();
      wkRunComplete();
      return;
    }
    const min = Math.floor(gone / 60);
    if (min !== wkRun.emomMin) {
      if (wkRun.emomMin != null) {
        wkBeep();
        wkRunVibe(150);
      }
      wkRun.emomMin = min;
    }
    const cur = m.items[min % m.items.length];
    const el = document.getElementById("wk-run-emom");
    if (el) el.innerHTML = `<b>${min + 1}</b><small>/${m.blk.emom}분</small>`;
    const now = document.getElementById("wk-run-emom-now");
    if (now) now.innerHTML = `지금: <b>${cur.ex.n}</b> ${cur.reps}<br><span>이번 분 남은 시간 ${60 - (gone % 60)}초</span>`;
  }
}
function wkRunMmss(sec) {
  return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
}

// ---------- 화면 ----------
function wkRunExOf(m) {
  return m && (m.t === "set" || m.t === "circ") ? m.x.ex : null;
}

// 동작 그림: 바뀔 때만 다시 그림 (force면 무조건)
function wkRunShowAnim(ex, force) {
  const anim = document.getElementById("wk-run-anim");
  if (!ex) {
    if (wkRunAnimEx) wkStopAnyMotion();
    wkRunAnimEx = null;
    anim.hidden = true;
    anim.innerHTML = "";
    return;
  }
  anim.hidden = false;
  if (!force && wkRunAnimEx === ex.n) return;
  wkRunAnimEx = ex.n;
  wkPlayMotion(anim, ex);
}

function wkRunRender(force) {
  if (!wkRun) return;
  const r = wkRun;
  const box = document.getElementById("wk-run");
  const body = document.getElementById("wk-run-body");
  box.classList.toggle("is-done", r.phase === "done");
  box.querySelector(".wk-run-bar i").style.width = (r.phase === "done" ? 100 : (r.i / r.moves.length) * 100) + "%";
  box.querySelector(".wk-run-count").textContent = r.phase === "done" ? "" : `${r.i + 1}/${r.moves.length}`;

  if (r.phase === "done") {
    wkRunShowAnim(null);
    const doneN = r.week.slots.filter((s) => r.week.done[s.day]).length;
    const mins = Math.max(1, Math.round((Date.now() - r.started) / 60000));
    body.innerHTML = `<div class="wk-run-done">
        <svg class="wk-run-done-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="bg"/><circle cx="60" cy="60" r="50" class="fg"/></svg>
        <h2>운동 완료! 🎉</h2>
        <p class="wk-note">${r.ses.title}</p>
        <div class="wk-run-stats">
          <div><b>${mins}분</b><span>이번 운동</span></div>
          <div><b>${r.sets}</b><span>끝낸 세트</span></div>
          <div><b>${doneN}/${r.week.slots.length}</b><span>이번 주</span></div>
        </div>
        <button type="button" class="wk-primary" data-run="close">닫기</button>
      </div>`;
    return;
  }

  const m = r.moves[r.i];
  wkRunShowAnim(wkRunExOf(m), force);
  const blkName = m.blk.name.split(" — ")[0];
  const opt = m.blk.opt ? `<span class="wk-run-opt">선택</span>` : "";
  const nav = `<div class="wk-run-nav">${r.i > 0 ? `<button type="button" data-run="prev">‹ 이전</button>` : "<span></span>"}
    ${m.blk.opt ? `<button type="button" data-run="skip">이 블록 건너뛰기 ›</button>` : ""}</div>`;
  let html = "";

  if (r.phase === "rest") {
    const ex = wkRunExOf(m);
    const nextText = ex ? `<b>${ex.n}</b> · ${m.t === "set" ? `${m.set}/${m.of}세트 · ${m.x.reps}` : `${m.round}라운드 · ${m.x.reps}`}` : `<b>${blkName}</b>`;
    html = `<div class="wk-run-rest">
        <div class="wk-run-clockwrap">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="bg"/><circle id="wk-run-ring" cx="60" cy="60" r="54" class="fg"/></svg>
          <div><span>휴식</span><b id="wk-run-clock">${wkRunMmss(Math.ceil((r.restEnd - Date.now()) / 1000))}</b></div>
        </div>
        <div class="wk-run-btns"><button type="button" data-run="plus">+30초</button><button type="button" data-run="skiprest">건너뛰기</button></div>
        <p class="wk-run-next">다음 · ${nextText}</p>
      </div>`;
  } else if (m.t === "set" || m.t === "circ") {
    const ex = m.x.ex;
    const meta = m.t === "set" ? `${m.of}세트 × ${m.x.reps}` : m.x.reps;
    html = `<p class="wk-run-blk">${blkName}${opt}</p>
      <button type="button" class="wk-run-name" data-run="how">${ex.n}<span aria-hidden="true">ⓘ</span></button>
      <div class="wk-run-stat">
        ${m.t === "set"
          ? `<div><span>세트</span><b>${m.set}<small>/${m.of}</small></b></div>`
          : `<div><span>라운드</span><b>${m.round}<small>/${m.of}</small></b></div><div><span>동작</span><b>${m.k + 1}<small>/${m.n}</small></b></div>`}
        <div><span>목표</span><b class="wk-run-reps">${m.x.reps}</b></div>
      </div>
      ${m.t === "set" ? `<div class="wk-run-dots">${Array.from({ length: m.of }, (_, i) => `<i class="${i < m.set - 1 ? "on" : i === m.set - 1 ? "now" : ""}"></i>`).join("")}</div>` : ""}
      ${m.t === "set" ? wkRunLiftBox(m) : ""}
      ${m.pair ? `<p class="wk-note wk-run-pair">번갈아 하기 · 다음은 <b>${m.pair}</b></p>` : ""}
      <button type="button" class="wk-primary wk-run-go" data-run="done" data-meta="${meta}">${m.t === "set" ? "세트 완료" : m.k === m.n - 1 ? "라운드 완료" : "완료 · 다음 동작"}</button>${nav}`;
  } else if (m.t === "text") {
    html = `<div class="wk-run-text"><p class="wk-run-blk">${m.blk.run ? "🏃 러닝" : m.blk.cardio ? "🔥 유산소" : "준비·정리"}${opt}</p>
        <h2>${m.blk.name}</h2>
        <ul>${m.blk.text.map((t) => `<li>${t}</li>`).join("")}</ul>
        ${m.blk.tip ? `<p class="wk-tip">💡 ${m.blk.tip}</p>` : ""}
      </div>
      <button type="button" class="wk-primary wk-run-go" data-run="done">${m.blk.run ? "러닝 다 했어요 ✓" : "다 했어요 · 다음"}</button>${nav}`;
  } else if (m.t === "emom") {
    const parts = m.blk.name.split(" — ");
    html = `<div class="wk-run-text"><p class="wk-run-blk">⏱ EMOM${opt}</p>
        <h2>${parts[0]}</h2>${parts[1] ? `<p class="wk-note">${parts[1]}</p>` : ""}
        <ul class="wk-run-emom-list">${m.items.map((x, i) => `<li><button type="button" data-run="howi" data-i="${i}">${x.ex.n}</button><span>${x.reps}</span></li>`).join("")}</ul>
      </div>
      ${r.emomStart
        ? `<div class="wk-run-emom"><div id="wk-run-emom" class="wk-run-emom-min"></div><p id="wk-run-emom-now"></p></div>
           <button type="button" class="wk-primary wk-run-go" data-run="done">끝내기</button>`
        : `<button type="button" class="wk-primary wk-run-go" data-run="emom">⏱ EMOM 시작 (${m.blk.emom}분)</button>
           <button type="button" class="wk-ghost" data-run="done">타이머 없이 했어요</button>`}${nav}`;
  }
  body.innerHTML = html;
  if (r.phase === "rest") wkRunTick();
  if (r.emomStart) wkRunTick();
}

// 무게 입력 (헬스장 동작)
function wkRunLiftBox(m) {
  const ex = m.x.ex;
  if (!wkTracksWeight(ex)) return "";
  const date = wkDateKey(wkAddDays(wkMon, wkRun.d));
  const today = wkLiftHistory(ex.n).find((x) => x.d === date);
  const goal = wkLiftGoal(m.x.it.pool, ex, date, wkRun.week.p);
  return `<div class="wk-run-lift">
      <p>${goal ? `오늘 목표 <b>${goal.kg}kg</b> · 지난번 ${goal.prev.kg}kg${goal.prev.reps ? "×" + goal.prev.reps : ""}` : "처음이면 가벼운 무게로 시작해 적어 두세요"}</p>
      <div><input type="number" inputmode="decimal" step="0.5" min="0" class="wk-input" id="wk-run-kg" placeholder="${goal ? goal.kg : "kg"}" value="${today ? today.kg : ""}"> kg ×
        <input type="number" inputmode="numeric" min="0" class="wk-input" id="wk-run-reps" placeholder="횟수" value="${today && today.reps ? today.reps : ""}"> 회</div>
    </div>`;
}

document.getElementById("wk-run").addEventListener("click", (e) => {
  const b = e.target.closest("[data-run]");
  if (!b || !wkRun) return;
  const k = b.dataset.run;
  const m = wkRun.moves[wkRun.i];
  if (k === "close") return wkRunClose();
  if (k === "done") return wkRunComplete();
  if (k === "prev") return wkRunGo(wkRun.i - 1, 0);
  if (k === "skip") return wkRunSkipBlock();
  if (k === "skiprest") return wkRunGo(wkRun.i, 0);
  if (k === "plus") {
    wkRun.restEnd += 30000;
    wkRun.restTotal += 30;
    return wkRunTick();
  }
  if (k === "how") return wkOpenMotion(m.x.ex, b.closest(".wk-run-body").querySelector("[data-meta]").dataset.meta);
  if (k === "howi") {
    const x = m.items[Number(b.dataset.i)];
    return wkOpenMotion(x.ex, x.reps);
  }
  if (k === "emom") {
    wkRun.emomStart = Date.now();
    wkRun.emomMin = null;
    wkRunTimer = setInterval(wkRunTick, 250);
    wkRunRender();
  }
});
