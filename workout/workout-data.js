// =============================================
// 운동 동작 모음과 하루 운동(세션) 만드는 규칙
// 장비: 맨몸, 커틀벨 4kg·12kg, 덤벨 6kg 2개, 평벤치, 턱걸이 기구, 러닝
// =============================================

const WK_EQ = {
  bw: "맨몸",
  kb4: "커틀벨 4kg",
  kb12: "커틀벨 12kg",
  db: "덤벨 6kg×2",
  bench: "벤치",
  bar: "턱걸이",
  run: "러닝",
};

// 동작 묶음(같은 역할끼리). 주마다, 또는 "바꾸기" 버튼으로 돌아가며 나옴
// r: 횟수 [최소, 최대] 또는 글자, u: 단위, tip: 한 줄 요령
const WK_POOLS = {
  // 위로 당기기 (턱걸이)
  pullV: [
    { n: "턱걸이 (오버핸드)", eq: ["bar"], r: "최대에서 1~2회 남기기", tip: "가슴을 봉 쪽으로, 내려올 때 팔을 끝까지 펴기" },
    { n: "친업 (언더핸드)", eq: ["bar"], r: "최대에서 1~2회 남기기", tip: "손바닥이 나를 보게. 이두와 등을 같이 씀" },
    { n: "네거티브 턱걸이", eq: ["bar"], r: [4, 6], u: "회", tip: "점프로 올라가서 5초 동안 천천히 내려오기" },
    { n: "와이드 턱걸이", eq: ["bar"], r: "최대에서 2회 남기기", tip: "어깨너비보다 넓게. 날개뼈를 먼저 모으고 당기기" },
    { n: "턱걸이 + 위에서 2초 멈춤", eq: ["bar"], r: [3, 6], u: "회", tip: "턱이 봉 위에서 2초 버티고 천천히 내려오기" },
  ],
  // 앞으로 당기기 (로우)
  pullH: [
    { n: "커틀벨 원암 로우", eq: ["kb12", "bench"], r: [10, 12], u: "회(한쪽)", tip: "한 손·한 무릎을 벤치에. 팔꿈치를 엉덩이 쪽으로" },
    { n: "체스트 서포티드 덤벨 로우", eq: ["db", "bench"], r: [12, 15], u: "회", tip: "벤치에 엎드려 양손 당기기, 위에서 1초 쥐어짜기" },
    { n: "덤벨 리어델트 플라이", eq: ["db", "bench"], r: [12, 15], u: "회", tip: "벤치에 엎드려 팔을 옆으로 벌리기. 어깨 뒤쪽" },
    { n: "커틀벨 로우 + 3초 내리기", eq: ["kb12", "bench"], r: [8, 10], u: "회(한쪽)", tip: "당긴 뒤 3초 동안 천천히 내리기" },
  ],
  // 앞으로 밀기 (푸시업·벤치프레스)
  pushH: [
    { n: "푸시업", eq: ["bw"], r: [12, 20], u: "회", tip: "몸을 일자로, 가슴이 바닥 가까이" },
    { n: "디클라인 푸시업", eq: ["bw", "bench"], r: [8, 12], u: "회", tip: "발을 벤치에 올리고. 윗가슴·어깨" },
    { n: "덤벨 벤치프레스 (3초 내리기)", eq: ["db", "bench"], r: [12, 15], u: "회", tip: "가벼우니 3초 동안 내리고 아래에서 1초 멈춤" },
    { n: "아처 푸시업", eq: ["bw"], r: [5, 8], u: "회(한쪽)", tip: "한쪽 팔은 펴고 다른 팔에 체중을 싣기" },
    { n: "다이아몬드 푸시업", eq: ["bw"], r: [8, 12], u: "회", tip: "손을 모아 삼각형. 삼두 집중" },
    { n: "푸시업 + 아래서 2초 멈춤", eq: ["bw"], r: [8, 12], u: "회", tip: "가슴이 바닥 가까이에서 2초 버티기" },
  ],
  // 위로 밀기 (어깨)
  pushV: [
    { n: "커틀벨 원암 프레스", eq: ["kb12"], r: [6, 8], u: "회(한쪽)", tip: "엉덩이·배에 힘 주고 허리 꺾지 않기" },
    { n: "파이크 푸시업", eq: ["bw", "bench"], r: [8, 12], u: "회", tip: "엉덩이를 높이 들고 머리를 손 사이로" },
    { n: "덤벨 숄더프레스 (앉아서)", eq: ["db", "bench"], r: [12, 15], u: "회", tip: "벤치에 앉아서, 끝에서 팔 쭉 펴기" },
    { n: "커틀벨 바텀업 프레스", eq: ["kb4"], r: [8, 10], u: "회(한쪽)", tip: "커틀벨을 거꾸로 세워 들고 흔들리지 않게" },
  ],
  // 팔·어깨 마무리
  arms: [
    { n: "덤벨 해머 컬", eq: ["db"], r: [12, 15], u: "회", tip: "엄지가 위로 가게, 반동 없이" },
    { n: "벤치 딥스", eq: ["bw", "bench"], r: [12, 15], u: "회", tip: "벤치 끝을 잡고, 팔꿈치는 뒤로" },
    { n: "덤벨 레터럴 레이즈", eq: ["db"], r: [12, 15], u: "회", tip: "어깨높이까지만, 천천히 내리기" },
    { n: "커틀벨 할로", eq: ["kb4"], r: [8, 8], u: "바퀴(양방향)", tip: "머리 둘레로 돌리기. 배에 힘" },
  ],
  // 스쿼트 계열
  squat: [
    { n: "고블릿 스쿼트 (3초 내리기)", eq: ["kb12"], r: [10, 12], u: "회", tip: "가슴 앞에 커틀벨, 3초 내려가 아래에서 1초 멈춤" },
    { n: "불가리안 스플릿 스쿼트", eq: ["db", "bench"], r: [8, 10], u: "회(한쪽)", tip: "뒷발을 벤치에. 앞무릎이 안으로 모이지 않게" },
    { n: "덤벨 리버스 런지", eq: ["db"], r: [10, 12], u: "회(한쪽)", tip: "뒤로 크게 딛고 앞발 뒤꿈치로 밀어 올라오기" },
    { n: "코사크 스쿼트", eq: ["kb12"], r: [6, 8], u: "회(한쪽)", tip: "다리를 넓게, 한쪽으로 깊게 앉기. 고관절 가동성" },
    { n: "벤치 스텝업", eq: ["db", "bench"], r: [10, 12], u: "회(한쪽)", tip: "올라간 발로만 밀기, 뒷발 반동 쓰지 않기" },
  ],
  // 엉덩이 접기(힌지) 계열
  hinge: [
    { n: "덤벨 루마니안 데드리프트", eq: ["db"], r: [12, 15], u: "회", tip: "엉덩이를 뒤로 빼며 허벅지 뒤가 당길 때까지" },
    { n: "싱글레그 루마니안 데드리프트", eq: ["kb12"], r: [8, 10], u: "회(한쪽)", tip: "한 다리로 서서 몸을 T자로. 균형·햄스트링" },
    { n: "커틀벨 힙 쓰러스트", eq: ["kb12", "bench"], r: [12, 15], u: "회", tip: "등 위쪽을 벤치에 기대고 위에서 2초 엉덩이 쥐기" },
    { n: "싱글레그 힙 쓰러스트", eq: ["bw", "bench"], r: [10, 12], u: "회(한쪽)", tip: "한 발로. 러닝할 때 엉덩이 힘이 좋아짐" },
  ],
  // 폭발력·심폐 (스윙 등)
  power: [
    { n: "커틀벨 스윙", eq: ["kb12"], r: [15, 20], u: "회", tip: "팔이 아니라 엉덩이를 튕겨서. 위에서 엉덩이 꽉" },
    { n: "커틀벨 원암 스윙", eq: ["kb12"], r: [10, 12], u: "회(한쪽)", tip: "몸이 돌아가지 않게 버티기" },
    { n: "점프 스쿼트", eq: ["bw"], r: [10, 12], u: "회", tip: "착지는 조용히, 무릎이 안으로 모이지 않게" },
    { n: "스플릿 점프 런지", eq: ["bw"], r: [8, 10], u: "회(한쪽)", tip: "공중에서 다리 바꾸기. 러닝 탄력" },
    { n: "덤벨 스러스터", eq: ["db"], r: [12, 15], u: "회", tip: "스쿼트에서 일어나는 힘으로 머리 위로 밀기" },
  ],
  // 러너 보강 (종아리·고관절·발목)
  runner: [
    { n: "싱글레그 카프 레이즈", eq: ["db", "bench"], r: [15, 20], u: "회(한쪽)", tip: "벤치나 계단 끝에서 뒤꿈치를 깊게 내렸다 올리기" },
    { n: "코펜하겐 플랭크", eq: ["bw", "bench"], r: [20, 30], u: "초(한쪽)", tip: "위쪽 다리를 벤치에 올리고 옆으로 버티기. 안쪽 허벅지" },
    { n: "싱글레그 글루트 브릿지", eq: ["bw"], r: [12, 15], u: "회(한쪽)", tip: "한 발로 엉덩이 들고 1초 멈춤" },
    { n: "사이드 라잉 힙 어브덕션", eq: ["bw"], r: [15, 20], u: "회(한쪽)", tip: "옆으로 누워 다리 들기. 무릎 통증 예방" },
    { n: "벤치 스텝다운 (3초)", eq: ["bw", "bench"], r: [8, 10], u: "회(한쪽)", tip: "벤치에서 한 발로 3초 동안 천천히 내려오기" },
  ],
  // 코어
  core: [
    { n: "행잉 니 레이즈", eq: ["bar"], r: [10, 15], u: "회", tip: "매달려서 무릎을 가슴으로. 몸이 흔들리지 않게" },
    { n: "행잉 레그 레이즈", eq: ["bar"], r: [6, 10], u: "회", tip: "다리를 펴고 들기. 힘들면 니 레이즈로" },
    { n: "플랭크", eq: ["bw"], r: [40, 60], u: "초", tip: "엉덩이 처지지 않게, 배꼽 당기기" },
    { n: "데드버그", eq: ["kb4"], r: [8, 10], u: "회(한쪽)", tip: "허리를 바닥에 붙인 채 팔다리 반대로 뻗기" },
    { n: "할로우 바디 홀드", eq: ["bw"], r: [20, 40], u: "초", tip: "허리를 바닥에 붙이고 팔다리 띄워 버티기" },
    { n: "사이드 플랭크", eq: ["bw"], r: [30, 45], u: "초(한쪽)", tip: "옆구리 일자. 러닝할 때 골반 흔들림 줄여 줌" },
    { n: "러시안 트위스트", eq: ["kb4"], r: [16, 20], u: "회", tip: "커틀벨 4kg 들고 좌우로. 천천히" },
  ],
  // 들고 걷기·전신 안정
  carry: [
    { n: "수트케이스 캐리", eq: ["kb12"], r: [30, 40], u: "m(한쪽)", tip: "한 손에 들고 몸이 기울지 않게 걷기" },
    { n: "터키쉬 겟업", eq: ["kb4"], r: [2, 3], u: "회(한쪽)", tip: "4kg로 천천히. 누웠다 일어서기 전신 안정" },
    { n: "커틀벨 랙 캐리", eq: ["kb12"], r: [30, 40], u: "m(한쪽)", tip: "가슴 앞에 들고(랙) 걷기. 코어" },
    { n: "데드 행", eq: ["bar"], r: [30, 45], u: "초", tip: "매달려 버티기. 악력·어깨 풀기" },
  ],
  // 당기기+밀기 전신 동작
  combo: [
    { n: "커틀벨 클린 앤 프레스", eq: ["kb12"], r: [5, 6], u: "회(한쪽)", tip: "바닥에서 가슴(랙)으로, 그대로 머리 위로" },
    { n: "버피", eq: ["bw"], r: [8, 10], u: "회", tip: "가슴 바닥, 점프. 숨이 차게" },
    { n: "덤벨 맨메이커 (가볍게)", eq: ["db"], r: [5, 6], u: "회", tip: "푸시업 → 좌우 로우 → 일어나 머리 위로" },
    { n: "커틀벨 스내치", eq: ["kb12"], r: [6, 8], u: "회(한쪽)", tip: "스윙에서 바로 머리 위로. 처음엔 4kg로 연습" },
  ],
};

// 4주 흐름: 1기본 → 2횟수↑ → 3세트·난이도↑ → 4회복
const WK_PHASES = [
  { name: "1주차 · 기본", tip: "모든 세트에서 2~3회는 더 할 수 있을 만큼만. 자세 익히기", sets: 3, add: 0 },
  { name: "2주차 · 횟수 늘리기", tip: "지난주보다 세트마다 2회씩(버티기는 10초) 더", sets: 3, add: 2 },
  { name: "3주차 · 세게", tip: "세트를 4개로. 가장 힘든 주예요. 잠 충분히", sets: 4, add: 2 },
  { name: "4주차 · 회복", tip: "세트를 줄이고 가볍게. 몸이 적응하는 주예요", sets: 2, add: 0 },
];

// 세션 종류 (이름·대략 시간·한 줄 설명)
const WK_TYPES = {
  upper: { title: "상체 근력", short: "상체", min: 40, color: "#2a78d6" },
  upperB: { title: "당기기 + 전신 서킷", short: "당기기", min: 35, color: "#6250d6" },
  lower: { title: "하체 + 러너 보강", short: "하체", min: 40, color: "#eb6834" },
  full: { title: "전신 근력", short: "전신", min: 40, color: "#e87ba4" },
  runQ: { title: "포인트 러닝 + 코어", short: "스피드", min: 45, color: "#e34948" },
  easy: { title: "이지런 + 러너 보강", short: "이지런", min: 45, color: "#1baf7a" },
  lsd: { title: "LSD (긴 러닝)", short: "LSD", min: 75, color: "#008300" },
  combo: { title: "이지런 + 전신 서킷", short: "런+근력", min: 45, color: "#eda100" },
  recovery: { title: "회복 · 가동성", short: "회복", min: 25, color: "#777777" },
  indoor: { title: "실내 근력 (러닝 대신)", short: "실내", min: 40, color: "#8a5f00" },
};

// 비 오는 날 "실내 근력으로 바꾸기"를 보여 줄 러닝 세션
const WK_RUN_TYPES = ["runQ", "easy", "lsd", "combo"];

// 며칠 하느냐에 따라 어떤 세션을 할지 (LSD는 따로 주말에 놓음)
const WK_TEMPLATES = {
  1: ["combo"],
  2: ["full", "lsd"],
  3: ["full", "runQ", "lsd"],
  // 하체 날은 LSD에서 멀리 두려고 앞쪽에
  4: ["lower", "runQ", "upper", "lsd"],
  5: ["runQ", "lower", "upper", "easy", "lsd"],
  6: ["runQ", "lower", "upper", "easy", "upperB", "lsd"],
  7: ["runQ", "lower", "upper", "easy", "upperB", "lsd", "recovery"],
};

// 주마다 바뀌는 포인트 러닝 (p: 4주 흐름 단계 0~3)
const WK_RUNQ = [
  (p) => ({
    name: "인터벌",
    steps: ["워밍업 조깅 8분", `1분 빠르게(5km 페이스) + 2분 조깅 × ${[6, 8, 8, 5][p]}회`, "쿨다운 조깅 5분"],
    tip: "빠른 1분은 '숨이 차지만 자세 유지'가 기준",
  }),
  (p) => ({
    name: "템포런",
    steps: ["워밍업 조깅 10분", `템포 ${[15, 18, 20, 10][p]}분 (하프 페이스보다 살짝 빠르게)`, "쿨다운 조깅 5분"],
    tip: "짧은 문장 정도는 말할 수 있는 '편하게 힘든' 속도",
  }),
  (p) => ({
    name: "언덕 반복",
    steps: ["워밍업 조깅 10분", `오르막 40초 힘차게 + 내려오며 걷기·조깅 × ${[6, 8, 10, 5][p]}회`, "쿨다운 조깅 5분"],
    tip: "언덕이 없으면 계단이나 트레드밀 경사 6~8%. 팔을 크게",
  }),
  (p) => ({
    name: "크루즈 인터벌",
    steps: ["워밍업 조깅 8분", `하프 목표 페이스 ${["5분 × 3", "6분 × 3", "6분 × 4", "5분 × 2"][p]} (사이 2분 조깅)`, "쿨다운 조깅 5분"],
    tip: "하프 대회 페이스를 몸에 익히는 훈련",
  }),
  (p) => ({
    name: "파틀렉",
    steps: [`총 ${[30, 35, 40, 30][p]}분 달리며`, "기분 따라 1~3분 빠르게 → 같은 시간 편하게, 자유롭게 반복", "처음 10분과 마지막 5분은 편하게"],
    tip: "시계 보지 말고 느낌으로. 지루하지 않게 하는 날",
  }),
];

// ---------- 세션 만들기 ----------
// 각 운동 줄: { pool, idx(기본 선택), sets, kind } → 화면에서 실제 동작으로 바꿈
// w: 절대 주 번호(동작이 주마다 돌아가게), p: 4주 흐름 단계

function wkItem(pool, w, offset, sets) {
  return { pool: pool, idx: w + offset, sets: sets };
}

// 겹치지 않는 동작 고르기: used(이름→점수, 이번 주 2·지난주 1)가 가장 낮은 것을
// start 자리부터 차례로 찾음. picked는 이 세션에서 이미 고른 이름
function wkFresh(pool, start, used, picked, sets) {
  const list = WK_POOLS[pool];
  let best = -1;
  let bestScore = Infinity;
  for (let k = 0; k < list.length; k++) {
    const i = (start + k) % list.length;
    const score = (used[list[i].n] || 0) + (picked[list[i].n] ? 10 : 0);
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  }
  picked[list[best].n] = true;
  return { pool: pool, idx: best, sets: sets };
}

function wkBuildSession(type, w, p, dayNo, used) {
  const ph = WK_PHASES[p];
  const s = ph.sets;
  const t = WK_TYPES[type];
  const base = { type: type, title: t.title, min: t.min, blocks: [] };
  const warm = {
    name: "준비 운동 5분",
    text: ["팔·어깨 돌리기, 고관절 돌리기 각 10회", "데드 행 20초 + 스캐풀라 풀업(어깨만 들기) 8회", "맨몸 스쿼트 10회 · 인치웜 5회"],
  };
  const o = dayNo * 3; // 같은 주 다른 날엔 다른 동작이 나오게

  if (type === "upper") {
    base.blocks = [
      warm,
      { name: "A. 슈퍼세트 (번갈아)", rest: 90, items: [wkItem("pullV", w, o, s), wkItem("pushH", w, o, s)] },
      { name: "B. 슈퍼세트 (번갈아)", rest: 75, items: [wkItem("pullH", w, o, s), wkItem("pushV", w, o, s)] },
      { name: "C. 팔·어깨 마무리", rest: 45, items: [wkItem("arms", w, o, Math.max(2, s - 1)), wkItem("arms", w, o + 1, Math.max(2, s - 1))] },
      { name: "D. 코어", rest: 45, items: [wkItem("core", w, o, Math.max(2, s - 1))] },
    ];
  } else if (type === "upperB") {
    const rounds = [3, 4, 4, 2][p];
    base.blocks = [
      warm,
      { name: "A. 턱걸이 집중", rest: 120, items: [wkItem("pullV", w, o + 2, s + 1)] },
      { name: `B. 서킷 ${rounds}라운드 (동작 사이 쉬지 않고, 라운드 끝에 휴식)`, rest: 90, circuit: rounds,
        items: [wkItem("combo", w, o, 1), wkItem("pullH", w, o + 1, 1), wkItem("pushH", w, o + 2, 1), wkItem("carry", w, o, 1)] },
      { name: "C. 코어", rest: 45, items: [wkItem("core", w, o + 2, Math.max(2, s - 1))] },
    ];
  } else if (type === "lower") {
    base.blocks = [
      warm,
      { name: "A. 스쿼트", rest: 90, items: [wkItem("squat", w, o, s)] },
      { name: "B. 힌지 (엉덩이·햄스트링)", rest: 90, items: [wkItem("hinge", w, o, s)] },
      { name: "C. 폭발력", rest: 60, items: [wkItem("power", w, o, s)] },
      { name: "D. 러너 보강 (번갈아)", rest: 45, items: [wkItem("runner", w, o, Math.max(2, s - 1)), wkItem("core", w, o + 3, Math.max(2, s - 1))] },
    ];
  } else if (type === "full") {
    // 주마다 서킷 / EMOM 번갈아
    if (w % 2 === 0) {
      const rounds = [3, 4, 4, 2][p];
      base.blocks = [
        warm,
        { name: `서킷 ${rounds}라운드 (동작 사이 20초, 라운드 끝 90초 휴식)`, rest: 90, circuit: rounds,
          items: [wkItem("squat", w, o, 1), wkItem("pullV", w, o, 1), wkItem("hinge", w, o, 1), wkItem("pushH", w, o, 1), wkItem("power", w, o, 1), wkItem("core", w, o, 1)] },
        { name: "마무리", rest: 45, items: [wkItem("carry", w, o, 2)] },
      ];
    } else {
      const mins = [12, 16, 16, 8][p];
      base.blocks = [
        warm,
        { name: `EMOM ${mins}분 — 매 분 시작할 때 아래 동작을 순서대로, 남는 시간은 휴식`, emom: mins, rest: 60,
          items: [wkItem("squat", w, o + 1, 1), wkItem("pullV", w, o + 1, 1), wkItem("pushH", w, o + 1, 1), wkItem("power", w, o + 1, 1)] },
        { name: "코어", rest: 45, items: [wkItem("core", w, o + 1, 2), wkItem("runner", w, o + 1, 2)] },
      ];
    }
  } else if (type === "runQ") {
    const r = WK_RUNQ[(w + dayNo) % WK_RUNQ.length](p);
    base.title = "포인트 러닝: " + r.name;
    base.blocks = [
      { name: "러닝 (" + r.name + ")", run: true, text: r.steps, tip: r.tip },
      { name: "러닝 후 코어 10분", rest: 30, items: [wkItem("core", w, o, 2), wkItem("runner", w, o + 2, 2)] },
    ];
  } else if (type === "easy") {
    const mins = [30, 35, 40, 30][p];
    const strides = [4, 6, 6, 0][p];
    const text = [`이지런 ${mins}분 — 대화가 가능한 편한 속도 (심박 존2)`];
    if (strides) text.push(`마지막에 20초 가볍게 빠르게(스트라이드) × ${strides}회, 사이 걷기 40초`);
    base.blocks = [
      { name: "러닝", run: true, text: text, tip: "느리다 싶을 만큼 천천히. 이게 지구력의 바탕" },
      { name: "러너 보강 10분 (번갈아)", rest: 30, items: [wkItem("runner", w, o + 1, 2), wkItem("runner", w, o + 3, 2), wkItem("core", w, o + 4, 2)] },
    ];
  } else if (type === "lsd") {
    const mins = [60, 75, 90, 50][p];
    const text = [`${mins}분 천천히 오래 — 이지런보다도 편하게`];
    if (p === 2) text.push("마지막 15분만 하프 목표 페이스로 올려 보기");
    if (mins >= 75) text.push("60분 넘으면 물 + 에너지젤(또는 사탕) 챙기기");
    base.min = mins + 10;
    base.blocks = [
      { name: "LSD", run: true, text: text, tip: "하프를 생각한다면 4주 흐름에 맞춰 60 → 75 → 90분으로 늘려 가요" },
      { name: "끝나고 스트레칭 5분", text: ["종아리 · 허벅지 앞뒤 · 엉덩이 각 30초", "데드 행 30초 (허리 풀기)"] },
    ];
  } else if (type === "combo") {
    const rounds = [3, 4, 4, 2][p];
    base.blocks = [
      { name: "이지런 20분", run: true, text: ["편한 속도로 20분 — 이게 워밍업 겸 유산소"], tip: "끝나고 바로 근력으로" },
      { name: `전신 서킷 ${rounds}라운드 (라운드 끝 90초 휴식)`, rest: 90, circuit: rounds,
        items: [wkItem("power", w, o, 1), wkItem("pullV", w, o, 1), wkItem("pushH", w, o, 1), wkItem("squat", w, o, 1), wkItem("core", w, o, 1)] },
    ];
  } else if (type === "indoor") {
    // 러닝 대신 실내에서: 심박을 올리는 서킷 + EMOM, 이번 주·지난주에 한 동작은 피함
    const u = used || {};
    const pk = {};
    const rounds = [3, 4, 4, 2][p];
    const mins = [8, 10, 10, 6][p];
    const st = w + dayNo;
    base.note = "비 오는 날 러닝 대신이에요. 이번 주와 지난주에 한 동작은 빼고 골랐어요.";
    base.blocks = [
      warm,
      { name: `A. 서킷 ${rounds}라운드 (동작 사이 20초, 라운드 끝 90초 휴식)`, rest: 90, circuit: rounds,
        items: [wkFresh("squat", st, u, pk, 1), wkFresh("pullV", st, u, pk, 1), wkFresh("pushV", st, u, pk, 1), wkFresh("hinge", st, u, pk, 1)] },
      { name: `B. EMOM ${mins}분 — 홀수 분엔 첫 동작, 짝수 분엔 둘째 동작 (러닝처럼 숨차게)`, emom: mins, rest: 60,
        items: [wkFresh("power", st, u, pk, 1), wkFresh("combo", st, u, pk, 1)] },
      { name: "C. 러너 보강 + 코어 (번갈아)", rest: 45,
        items: [wkFresh("runner", st, u, pk, Math.max(2, ph.sets - 1)), wkFresh("core", st, u, pk, Math.max(2, ph.sets - 1)), wkFresh("carry", st, u, pk, 2)] },
    ];
  } else if (type === "recovery") {
    base.blocks = [
      { name: "가볍게 움직이기", run: true, text: ["걷기 20~30분 또는 아주 느린 조깅 15분"], tip: "LSD 다음 날 피로 풀기" },
      { name: "가동성 10분", text: [
        "월드 그레이티스트 스트레칭 좌우 5회",
        "90/90 고관절 스트레칭 좌우 30초",
        "벽 종아리 스트레칭 좌우 30초",
        "데드 행 30초 × 2",
        "커틀벨 4kg 할로 좌우 5바퀴",
      ] },
    ];
  }
  return base;
}

// 단계에 맞춰 횟수 글자 만들기 ("10~12회")
function wkRepsText(ex, p) {
  if (typeof ex.r === "string") return ex.r;
  const add = WK_PHASES[p].add;
  const isSec = ex.u.indexOf("초") === 0;
  const isDist = ex.u.indexOf("m") === 0;
  const plus = isSec || isDist ? add * 5 : add;
  const lo = ex.r[0] + plus;
  const hi = ex.r[1] + plus;
  return (lo === hi ? lo : lo + "~" + hi) + ex.u;
}
