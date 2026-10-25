// =============================================
// 앱 잠금(비밀번호 4자리) · 금액 숨기기
// - 비밀번호를 정해 두면 앱을 열 때, 1분 넘게 다른 앱에 있다가 돌아올 때 잠금 화면
//   (비밀번호는 그대로 저장하지 않고 SHA-256으로 바꾼 값만 저장. 이 기기에서만 쓰고 백업하지 않음)
// - 남이 잠깐 보는 것을 막는 가벼운 잠금 (휴대폰 자체 잠금을 대신하지는 못함)
// - 눈 모양 버튼: 내 금액을 흐리게 (시세 같은 공개 정보는 그대로)
// ※ 이름은 모두 lock~ / LOCK~ 으로 시작
// common.js 바로 뒤에 불러옴 (index.html <head>의 짧은 코드가 잠겨 있으면 화면을 먼저 가려 둠)
// =============================================

const LOCK_KEY = "household-lock"; // { salt, hash }
const LOCK_PRIVACY_KEY = "household-privacy"; // "1"이면 금액 숨김
const LOCK_AWAY_MS = 60 * 1000; // 이보다 오래 다른 앱에 있다 오면 다시 잠금
const LOCK_MAX_TRIES = 5; // 연달아 틀리면
const LOCK_WAIT_MS = 30 * 1000; // 이만큼 기다리게

const lockScreen = document.getElementById("lock-screen");
const lockTitle = document.getElementById("lock-title");
const lockDots = document.getElementById("lock-dots");
const lockMessage = document.getElementById("lock-message");
const lockCancel = document.getElementById("lock-cancel");
const lockForgot = document.getElementById("lock-forgot");
const lockStatus = document.getElementById("lock-status");
const lockSetBtn = document.getElementById("lock-set-btn");
const lockOffBtn = document.getElementById("lock-off-btn");
const lockPrivacyBtn = document.getElementById("privacy-btn");

let lockMode = null; // "unlock" | "set1" | "set2" | "off"
let lockInput = "";
let lockFirstPin = "";
let lockFails = 0;
let lockWaitUntil = 0;
let lockHiddenAt = 0;

function loadLock() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCK_KEY));
    if (saved && typeof saved.salt === "string" && typeof saved.hash === "string") return saved;
  } catch (error) {
    // 깨져 있으면 잠금 없음
  }
  return null;
}

// 비밀번호 + 소금(무작위 글자) → SHA-256 글자
async function hashLockPin(pin, salt) {
  const bytes = new TextEncoder().encode(salt + ":" + pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

// =============================================
// 잠금 화면
// =============================================

const LOCK_TITLES = {
  unlock: "비밀번호를 눌러 주세요",
  set1: "새 비밀번호 4자리를 눌러 주세요",
  set2: "한 번 더 눌러 주세요",
  off: "지금 비밀번호를 눌러 주세요",
};

function showLockScreen(mode) {
  lockMode = mode;
  lockInput = "";
  lockTitle.textContent = LOCK_TITLES[mode];
  lockMessage.textContent = "";
  lockCancel.style.visibility = mode === "unlock" ? "hidden" : "visible";
  lockForgot.hidden = mode !== "unlock";
  renderLockDots();
  lockScreen.hidden = false;
  document.documentElement.classList.add("app-locked");
}

function hideLockScreen() {
  lockScreen.hidden = true;
  lockMode = null;
  document.documentElement.classList.remove("app-locked");
}

function renderLockDots() {
  Array.from(lockDots.children).forEach(function (dot, index) {
    dot.classList.toggle("filled", index < lockInput.length);
  });
}

function shakeLockDots(message) {
  lockMessage.textContent = message;
  lockDots.classList.remove("lock-shake");
  void lockDots.offsetWidth; // 다시 흔들리게
  lockDots.classList.add("lock-shake");
  lockInput = "";
  renderLockDots();
}

async function pressLockKey(key) {
  if (!lockMode) return;
  if (Date.now() < lockWaitUntil) {
    lockMessage.textContent = Math.ceil((lockWaitUntil - Date.now()) / 1000) + "초 뒤에 다시 눌러 주세요.";
    return;
  }
  if (key === "back") {
    lockInput = lockInput.slice(0, -1);
    renderLockDots();
    return;
  }
  if (lockInput.length >= 4) return;
  lockInput += key;
  renderLockDots();
  if (lockInput.length < 4) return;

  const pin = lockInput;
  if (lockMode === "set1") {
    lockFirstPin = pin;
    showLockScreen("set2");
    return;
  }
  if (lockMode === "set2") {
    if (pin !== lockFirstPin) {
      lockFirstPin = "";
      lockMode = "set1";
      lockTitle.textContent = LOCK_TITLES.set1;
      shakeLockDots("두 번 누른 비밀번호가 달라요. 처음부터 다시 눌러 주세요.");
      return;
    }
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
    try {
      localStorage.setItem(LOCK_KEY, JSON.stringify({ salt: salt, hash: await hashLockPin(pin, salt) }));
    } catch (error) {
      alert("저장하지 못했어요.");
    }
    hideLockScreen();
    renderLockSettings();
    alert("앱 잠금을 켰어요. 다음부터 앱을 열 때 비밀번호를 물어요.");
    return;
  }
  // 잠금 풀기 / 끄기: 저장된 값과 비교
  const saved = loadLock();
  const ok = saved && (await hashLockPin(pin, saved.salt)) === saved.hash;
  if (!ok) {
    lockFails += 1;
    if (lockFails >= LOCK_MAX_TRIES) {
      lockFails = 0;
      lockWaitUntil = Date.now() + LOCK_WAIT_MS;
      shakeLockDots(LOCK_MAX_TRIES + "번 틀렸어요. 30초 뒤에 다시 눌러 주세요.");
    } else {
      shakeLockDots("비밀번호가 달라요. (" + lockFails + "/" + LOCK_MAX_TRIES + ")");
    }
    return;
  }
  lockFails = 0;
  if (lockMode === "off") {
    localStorage.removeItem(LOCK_KEY);
    hideLockScreen();
    renderLockSettings();
    alert("앱 잠금을 껐어요.");
    return;
  }
  hideLockScreen();
}

// =============================================
// 설정 창의 "앱 잠금"
// =============================================

function renderLockSettings() {
  const on = Boolean(loadLock());
  lockStatus.textContent = on ? "잠금이 켜져 있어요." : "잠금이 꺼져 있어요.";
  lockSetBtn.textContent = on ? "비밀번호 바꾸기" : "비밀번호 정하기";
  lockOffBtn.hidden = !on;
}

// 설정 창(모달)은 맨 위에 떠서 잠금 화면을 가리므로 먼저 닫음
function closeLockSettingsDialog() {
  const dialog = document.getElementById("settings-dialog");
  if (dialog && dialog.open) dialog.close();
}

// =============================================
// 금액 숨기기
// =============================================

function applyLockPrivacy(on) {
  document.documentElement.classList.toggle("privacy-on", on);
  lockPrivacyBtn.setAttribute("aria-pressed", String(on));
  lockPrivacyBtn.setAttribute("aria-label", on ? "금액 보이기" : "금액 숨기기");
}

// =============================================
// 이벤트 처리
// =============================================

document.querySelectorAll("[data-lock-key]").forEach(function (button) {
  button.addEventListener("click", function () {
    pressLockKey(button.dataset.lockKey);
  });
});

// 키보드(숫자·지우기)로도
document.addEventListener("keydown", function (event) {
  if (!lockMode) return;
  if (/^\d$/.test(event.key)) pressLockKey(event.key);
  else if (event.key === "Backspace") pressLockKey("back");
});

lockCancel.addEventListener("click", function () {
  if (lockMode !== "unlock") hideLockScreen();
});

lockForgot.addEventListener("click", function () {
  if (!confirm("비밀번호를 지우려면 이 기기의 앱 데이터를 모두 지워야 해요.\n지운 뒤 백업 파일(⚙ 설정 → 불러오기)로 되살릴 수 있어요.\n계속할까요?")) return;
  if (!confirm("정말 모든 데이터를 지울까요? 되돌릴 수 없어요.")) return;
  Object.keys(localStorage)
    .filter(function (key) {
      return key.indexOf("household-") === 0;
    })
    .forEach(function (key) {
      localStorage.removeItem(key);
    });
  location.reload();
});

lockSetBtn.addEventListener("click", function () {
  closeLockSettingsDialog();
  lockFirstPin = "";
  showLockScreen("set1");
});

lockOffBtn.addEventListener("click", function () {
  closeLockSettingsDialog();
  showLockScreen("off");
});

lockPrivacyBtn.addEventListener("click", function () {
  const on = !document.documentElement.classList.contains("privacy-on");
  applyLockPrivacy(on);
  try {
    localStorage.setItem(LOCK_PRIVACY_KEY, on ? "1" : "0");
  } catch (error) {
    // 저장이 막혀도 이번에는 적용
  }
});

// 다른 앱에 1분 넘게 있다가 돌아오면 다시 잠금
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    lockHiddenAt = Date.now();
  } else if (loadLock() && !lockMode && lockHiddenAt && Date.now() - lockHiddenAt > LOCK_AWAY_MS) {
    showLockScreen("unlock");
  }
});

// 시작: 잠금이 켜져 있으면 바로 잠금 화면, 금액 숨기기 상태 되살리기
let lockPrivacySaved = false;
try {
  lockPrivacySaved = localStorage.getItem(LOCK_PRIVACY_KEY) === "1";
} catch (error) {
  // 무시
}
applyLockPrivacy(lockPrivacySaved);
renderLockSettings();
if (loadLock()) showLockScreen("unlock");
