// =============================================
// 데이터 백업 — 페이지 맨 아래 (모든 탭에서 보임)
// 내보내기: 모든 데이터를 .json 파일 하나로 저장
// 불러오기: 그 파일을 골라 데이터를 되살림
// ※ 이름은 모두 backup~ / BACKUP~ 으로 시작
// =============================================

// =============================================
// 1. 상수
// =============================================

// 백업 파일임을 알아보기 위한 표시와 형식 번호 (나중에 형식이 바뀌면 번호를 올림)
const BACKUP_APP_NAME = "household-ledger"; // 예전 백업 파일도 불러올 수 있게 이름은 그대로 둠
const BACKUP_VERSION = 1;

// 마지막으로 내보낸 날짜를 기억해 두는 이름
const BACKUP_LAST_KEY = "household-last-backup";

// 백업할 항목: localStorage 이름, 화면 이름, 단위, 데이터 모양 검사 함수
const BACKUP_ITEMS = [
  { key: "household-assets", label: "금융자산", unit: "종목", check: isValidAsset },
  { key: "household-crypto", label: "비트코인", unit: "개", check: isValidCrypto },
  { key: "household-scenarios", label: "시나리오", unit: "개", check: isValidScenario },
  { key: "household-history", label: "자산 기록", unit: "개월", check: isValidHistory },
];

// 목록이 아닌 설정값 (시뮬레이션 입력값, 비트코인 설정: 거래소·스택 목표)
const BACKUP_SETTINGS_KEYS = ["household-sim-settings", "household-btc-settings"];

// =============================================
// 2. 데이터 모양 검사
// (다른 파일이나 고장 난 파일을 불러와서 앱이 멈추는 것을 막음)
// =============================================

function isText(value) {
  return typeof value === "string";
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidAsset(item) {
  return (
    isText(item.id) && isText(item.name) && isText(item.kind) &&
    isNumber(item.quantity) && isNumber(item.avgPrice) &&
    isNumber(item.currentPrice) && isNumber(item.dividendPerShare) &&
    isText(item.memo) &&
    // 지급월은 예전 백업에는 없을 수 있음. 있으면 1~12 숫자 목록이어야 함
    (item.payMonths === undefined ||
      (Array.isArray(item.payMonths) &&
        item.payMonths.every(function (month) {
          return Number.isInteger(month) && month >= 1 && month <= 12;
        })))
  );
}

function isValidCrypto(item) {
  return (
    isText(item.id) && isText(item.name) &&
    isNumber(item.quantity) && isNumber(item.avgPrice) && isNumber(item.currentPrice) &&
    isText(item.place) && isText(item.memo) &&
    // 심볼은 예전 백업에는 없을 수 있음
    (item.symbol === undefined || isText(item.symbol))
  );
}

function isValidScenario(item) {
  if (!isText(item.id) || !isText(item.name)) return false;
  if (typeof item.changes !== "object" || item.changes === null) return false;
  // 변동률은 모두 숫자여야 함. 단, items(종목별 변동률)는 { 이름표: 숫자 } 묶음
  return Object.keys(item.changes).every(function (key) {
    const value = item.changes[key];
    if (key === "items") {
      return typeof value === "object" && value !== null && Object.values(value).every(isNumber);
    }
    return isNumber(value);
  });
}

function isValidHistory(item) {
  return (
    isText(item.month) && /^\d{4}-\d{2}$/.test(item.month) &&
    isNumber(item.total) && isNumber(item.assets) && isNumber(item.crypto) &&
    (item.manual === undefined || typeof item.manual === "boolean")
  );
}

// =============================================
// 화면 요소 찾기
// =============================================

const backupExportBtn = document.getElementById("backup-export-btn");
const backupImportBtn = document.getElementById("backup-import-btn");
const backupFileInput = document.getElementById("backup-file-input");
const backupStatusText = document.getElementById("backup-status");

// =============================================
// 3. 내보내기
// =============================================

// 저장된 데이터를 모아 백업용 묶음을 만듦
function collectBackupData() {
  const data = {};
  BACKUP_ITEMS.forEach(function (item) {
    data[item.key] = loadList(item.key);
  });
  BACKUP_SETTINGS_KEYS.forEach(function (key) {
    try {
      const settings = JSON.parse(localStorage.getItem(key));
      if (settings && typeof settings === "object") {
        data[key] = settings;
      }
    } catch (error) {
      // 설정이 깨져 있으면 빼고 백업
    }
  });
  return {
    app: BACKUP_APP_NAME,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: data,
  };
}

// 글자를 파일로 내려받게 함
function downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob); // 파일을 가리키는 임시 주소
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName; // 이 이름으로 저장됨
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 잠시 뒤 임시 주소를 정리 (바로 지우면 일부 브라우저에서 저장이 안 될 수 있음)
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

backupExportBtn.addEventListener("click", function () {
  const backup = collectBackupData();
  // JSON.stringify의 세 번째 값 2: 사람이 읽기 좋게 줄바꿈과 들여쓰기
  // 파일 이름은 영어로: 한글 이름은 일부 브라우저에서 "download" 같은 이름으로 바뀌어 버림
  downloadTextFile("household-backup-" + getToday() + ".json", JSON.stringify(backup, null, 2));

  try {
    localStorage.setItem(BACKUP_LAST_KEY, getToday());
  } catch (error) {
    // 무시
  }
  renderBackupStatus();
});

// =============================================
// 4. 불러오기
// =============================================

// 파일 내용을 검사해서 문제가 있으면 안내 문구를, 괜찮으면 빈 글자("")를 돌려줌
function validateBackup(backup) {
  if (typeof backup !== "object" || backup === null || backup.app !== BACKUP_APP_NAME) {
    return "이 앱에서 내보낸 백업 파일이 아니에요.";
  }
  if (backup.version > BACKUP_VERSION) {
    return "더 새로운 버전의 앱에서 만든 백업이에요. 페이지를 새로고침한 뒤 다시 시도해 주세요.";
  }
  if (typeof backup.data !== "object" || backup.data === null) {
    return "백업 파일에 데이터가 없어요.";
  }
  for (const item of BACKUP_ITEMS) {
    const list = backup.data[item.key];
    if (list === undefined) {
      continue; // 없는 항목은 건너뜀 (지금 데이터 유지)
    }
    if (!Array.isArray(list)) {
      return item.label + " 데이터 형식이 올바르지 않아요.";
    }
    const badIndex = list.findIndex(function (entry) {
      return typeof entry !== "object" || entry === null || !item.check(entry);
    });
    if (badIndex !== -1) {
      return item.label + " " + (badIndex + 1) + "번째 항목이 올바르지 않아요.";
    }
  }
  return "";
}

// 확인 창에 보여 줄 요약 (예: "금융자산 5종목 · 비트코인 2개 ...")
function describeBackup(backup) {
  const parts = [];
  BACKUP_ITEMS.forEach(function (item) {
    const list = backup.data[item.key];
    if (Array.isArray(list)) {
      parts.push(item.label + " " + list.length + item.unit);
    }
  });
  return parts.join(" · ");
}

// "불러오기" 버튼 → 숨겨 둔 파일 선택 칸을 대신 눌러 줌
backupImportBtn.addEventListener("click", function () {
  backupFileInput.click();
});

// 파일을 고르면 실행
backupFileInput.addEventListener("change", async function () {
  const file = backupFileInput.files[0];
  // 같은 파일을 다시 골라도 change가 일어나도록 선택을 비워 둠
  backupFileInput.value = "";
  if (!file) {
    return;
  }

  let backup;
  try {
    const text = await file.text(); // 파일 내용을 글자로 읽음 (다 읽을 때까지 기다림)
    backup = JSON.parse(text);
  } catch (error) {
    alert("파일을 읽을 수 없어요. 백업 파일(.json)이 맞는지 확인해 주세요.");
    return;
  }

  const error = validateBackup(backup);
  if (error !== "") {
    alert(error);
    return;
  }

  const date = isText(backup.exportedAt) ? backup.exportedAt.slice(0, 10) : "날짜 모름";
  const ok = confirm(
    date + "에 만든 백업을 불러올까요?\n\n" +
    describeBackup(backup) + "\n\n" +
    "⚠️ 지금 이 기기에 있는 데이터는 백업 내용으로 바뀌어요.\n" +
    "(불안하면 취소하고 먼저 '내보내기'로 지금 데이터를 저장해 두세요.)"
  );
  if (!ok) {
    return;
  }

  // 백업에 있는 항목만 덮어씀
  BACKUP_ITEMS.forEach(function (item) {
    const list = backup.data[item.key];
    if (Array.isArray(list)) {
      localStorage.setItem(item.key, JSON.stringify(list));
    }
  });
  BACKUP_SETTINGS_KEYS.forEach(function (key) {
    const settings = backup.data[key];
    if (settings && typeof settings === "object" && !Array.isArray(settings)) {
      localStorage.setItem(key, JSON.stringify(settings));
    }
  });

  alert("불러왔어요. 화면을 새로 고칠게요.");
  // 모든 탭이 새 데이터로 처음부터 다시 그려지도록 페이지를 새로고침
  location.reload();
});

// =============================================
// 5. 화면 그리기
// =============================================

// "마지막 내보내기: 2026-10-18 (3일 전)" 같은 안내
function renderBackupStatus() {
  let last = null;
  try {
    last = localStorage.getItem(BACKUP_LAST_KEY);
  } catch (error) {
    // 무시
  }
  if (!last) {
    backupStatusText.textContent = "아직 백업한 적이 없어요. 데이터를 지키려면 가끔 내보내기를 해 두세요.";
    backupStatusText.className = "backup-status backup-warning";
    return;
  }
  // 오늘과 며칠 차이인지 (날짜 글자를 그날 0시로 바꿔서 뺌)
  const days = Math.round((new Date(getToday()) - new Date(last)) / (24 * 60 * 60 * 1000));
  const ago = days <= 0 ? "오늘" : days + "일 전";
  backupStatusText.textContent = "마지막 내보내기: " + last + " (" + ago + ")";
  // 30일 넘게 백업하지 않았으면 눈에 띄게
  backupStatusText.className = "backup-status" + (days > 30 ? " backup-warning" : "");
}

// =============================================
// 시작
// =============================================

renderBackupStatus();
