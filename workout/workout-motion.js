// =============================================
// 동작 그림: 막대 사람이 운동 동작을 반복하는 애니메이션 (SVG, 라이브러리 없음)
// 자세(키프레임)마다 엉덩이 위치·몸통 방향·손발 위치만 적고,
// 팔꿈치·무릎은 길이가 변하지 않게 계산(IK)해서 그림
// 좌표: 가로 160 × 세로 120, 바닥 y=110, 옆모습은 오른쪽을 봄
// =============================================

const MO_LEN = { torso: 30, neck: 11, head: 7, upper: 16, fore: 15, thigh: 20, shin: 20 };
const MO_GROUND = 110;

// 키프레임 항목
//   h: 엉덩이 [x,y]   s: 몸통이 향하는 점 [x,y] (어깨는 엉덩이에서 30만큼)
//   hd/hd2: 손 [x,y]   hr/hr2: 어깨 기준 손 [dx,dy] (없으면 차렷 자세로 늘어뜨림)
//   ft/ft2: 발 [x,y]   ks/ks2: 무릎 꺾이는 쪽(-1 기본=앞)   es/es2: 팔꿈치 꺾이는 쪽(1 기본)
// 동작 옵션: d(한 구간 초), seq(true면 처음→끝→처음 순환, 아니면 왕복), view:"front"(앞모습),
//   bench:[x, 윗면y, 너비], bar: y, noGround, flip(3D에서 좌우 뒤집기: 등 대고 눕는 동작)
const WK_MOTIONS = {
  squat: { d: 1.1, f: [
    { h: [80, 70], s: [80, 0], hr: [11, 6], ft: [82, 110] },
    { h: [66, 92], s: [80, 60], hr: [11, 6], ft: [82, 110] },
  ] },
  thruster: { d: 0.9, f: [
    { h: [66, 92], s: [80, 60], hr: [8, 2], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hr: [2, -31], ft: [82, 110] },
  ] },
  jumpSquat: { d: 0.6, f: [
    { h: [66, 92], s: [82, 60], hr: [-6, 28], ft: [82, 110] },
    { h: [80, 58], s: [80, 0], hr: [8, -28], ft: [80, 98] },
  ] },
  pullup: { bar: 10, noGround: true, d: 1.2, f: [
    { h: [81, 73], s: [81, 0], hd: [82, 10], ft: [72, 108] },
    { h: [77, 54], s: [75, 0], hd: [82, 10], ft: [68, 90] },
  ] },
  hang: { bar: 10, noGround: true, d: 1.6, f: [
    { h: [81, 73], s: [81, 0], hd: [82, 10], ft: [79, 112] },
    { h: [80, 73], s: [80, 0], hd: [82, 10], ft: [81, 112] },
  ] },
  kneeRaise: { bar: 10, noGround: true, d: 1, f: [
    { h: [81, 73], s: [81, 0], hd: [82, 10], ft: [79, 112] },
    { h: [80, 72], s: [79, 0], hd: [82, 10], ft: [94, 84] },
  ] },
  legRaise: { bar: 10, noGround: true, d: 1.2, f: [
    { h: [81, 73], s: [81, 0], hd: [82, 10], ft: [79, 112] },
    { h: [78, 72], s: [77, 0], hd: [82, 10], ft: [117, 64] },
  ] },
  pushup: { d: 1, f: [
    { h: [76, 92], s: [103, 79], hd: [104, 110], ft: [40, 110] },
    { h: [79, 103], s: [109, 99], hd: [106, 110], ft: [40, 110] },
  ] },
  pushupDecline: { bench: [12, 80, 46], d: 1, f: [
    { h: [78, 79], s: [108, 79], hd: [108, 110], ft: [38, 78] },
    { h: [78, 89], s: [107, 98], hd: [107, 110], ft: [38, 78] },
  ] },
  pike: { d: 1.1, f: [
    { h: [62, 77], s: [89, 90], hd: [106, 110], ft: [40, 110] },
    { h: [62, 77], s: [81, 100], hd: [106, 110], ft: [40, 110] },
  ] },
  benchPress: { flip: true, bench: [38, 92, 76], d: 1.2, f: [
    { h: [70, 88], s: [100, 88], hd: [100, 57], ft: [48, 110], ks: 1 },
    { h: [70, 88], s: [100, 88], hd: [103, 78], ft: [48, 110], ks: 1 },
  ] },
  row: { bench: [86, 88, 40], d: 1, f: [
    { h: [60, 70], s: [96, 75], hd: [90, 104], hd2: [101, 88], ft: [70, 110], ft2: [45, 110] },
    { h: [60, 70], s: [96, 75], hd: [75, 84], hd2: [101, 88], ft: [70, 110], ft2: [45, 110] },
  ] },
  proneRow: { bench: [45, 80, 70], d: 1, f: [
    { h: [60, 73], s: [92, 73], hd: [90, 104], ft: [42, 108] },
    { h: [60, 73], s: [92, 73], hd: [79, 84], ft: [42, 108] },
  ] },
  press: { d: 1, f: [
    { h: [80, 70], s: [80, 0], hd: [87, 42], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hd: [81, 9], ft: [82, 110] },
  ] },
  seatedPress: { bench: [55, 86, 48], d: 1, f: [
    { h: [76, 82], s: [76, 0], hr: [6, 2], ft: [98, 110] },
    { h: [76, 82], s: [76, 0], hr: [1, -31], ft: [98, 110] },
  ] },
  curl: { d: 1, f: [
    { h: [80, 70], s: [80, 0], hr: [1, 30], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hr: [12, 7], ft: [82, 110] },
  ] },
  benchDip: { bench: [36, 80, 34], d: 1, f: [
    { h: [72, 79], s: [72, 0], hd: [67, 80], ft: [100, 110] },
    { h: [73, 94], s: [73, 0], hd: [67, 80], ft: [100, 110] },
  ] },
  lateral: { view: "front", d: 1.1, f: [
    { h: [80, 70], s: [80, 0], hd: [91, 70], hd2: [69, 70], ft: [85, 110], ft2: [75, 110] },
    { h: [80, 70], s: [80, 0], hd: [118, 45], hd2: [42, 45], ft: [85, 110], ft2: [75, 110] },
  ] },
  halo: { view: "front", seq: true, d: 0.6, f: [
    { h: [80, 70], s: [80, 0], hd: [80, 52], hd2: [80, 52], ft: [86, 110], ft2: [74, 110] },
    { h: [80, 70], s: [80, 0], hd: [96, 28], hd2: [96, 28], ft: [86, 110], ft2: [74, 110] },
    { h: [80, 70], s: [80, 0], hd: [80, 18], hd2: [80, 18], ft: [86, 110], ft2: [74, 110] },
    { h: [80, 70], s: [80, 0], hd: [64, 28], hd2: [64, 28], ft: [86, 110], ft2: [74, 110] },
  ] },
  cossack: { view: "front", seq: true, d: 1, f: [
    { h: [80, 80], s: [80, 0], hd: [80, 58], hd2: [80, 58], ft: [108, 110], ft2: [52, 110] },
    { h: [92, 90], s: [88, 0], hd: [90, 70], hd2: [90, 70], ft: [108, 110], ft2: [52, 110] },
    { h: [80, 80], s: [80, 0], hd: [80, 58], hd2: [80, 58], ft: [108, 110], ft2: [52, 110] },
    { h: [68, 90], s: [72, 0], hd: [70, 70], hd2: [70, 70], ft: [108, 110], ft2: [52, 110] },
  ] },
  splitSquat: { bench: [12, 86, 32], d: 1.1, f: [
    { h: [70, 72], s: [71, 0], ft: [86, 110], ft2: [38, 86] },
    { h: [65, 90], s: [70, 50], ft: [86, 110], ft2: [38, 86] },
  ] },
  lunge: { d: 1, f: [
    { h: [80, 70], s: [80, 0], ft: [84, 110], ft2: [80, 110] },
    { h: [70, 90], s: [71, 0], ft: [88, 110], ft2: [44, 110] },
  ] },
  splitJump: { seq: true, d: 0.5, f: [
    { h: [70, 90], s: [71, 0], ft: [88, 110], ft2: [44, 110] },
    { h: [68, 72], s: [68, 0], hr: [6, -10], hr2: [-6, 26], ft: [80, 100], ft2: [58, 100] },
    { h: [66, 90], s: [67, 0], ft: [44, 110], ft2: [88, 110] },
    { h: [68, 72], s: [68, 0], hr: [-6, 26], hr2: [6, -10], ft: [80, 100], ft2: [58, 100] },
  ] },
  stepUp: { bench: [88, 88, 40], seq: true, d: 0.8, f: [
    { h: [70, 70], s: [70, 0], ft: [72, 110], ft2: [70, 110] },
    { h: [80, 74], s: [82, 0], ft: [96, 88], ft2: [70, 110] },
    { h: [95, 48], s: [95, 0], ft: [97, 88], ft2: [95, 88] },
    { h: [80, 74], s: [82, 0], ft: [96, 88], ft2: [70, 110] },
  ] },
  rdl: { d: 1.2, f: [
    { h: [80, 70], s: [80, 0], hr: [2, 30], ft: [82, 110] },
    { h: [70, 72], s: [102, 76], hr: [0, 30], ft: [80, 110] },
  ] },
  slRdl: { d: 1.3, f: [
    { h: [82, 70], s: [82, 0], hr: [2, 30], ft: [82, 110], ft2: [80, 110] },
    { h: [76, 72], s: [110, 74], hr: [0, 30], ft: [82, 110], ft2: [36, 74] },
  ] },
  hipThrust: { bench: [14, 84, 40], d: 1.1, f: [
    { h: [66, 106], s: [47, 83], hd: [68, 101], ft: [100, 110] },
    { h: [78, 84], s: [48, 84], hd: [80, 79], ft: [100, 110] },
  ] },
  slHipThrust: { bench: [14, 84, 40], d: 1.1, f: [
    { h: [66, 106], s: [47, 83], hd: [52, 104], ft: [100, 110], ft2: [104, 86] },
    { h: [78, 84], s: [48, 84], hd: [56, 96], ft: [100, 110], ft2: [114, 62] },
  ] },
  swing: { d: 0.6, f: [
    { h: [70, 72], s: [104, 84], hd: [72, 98], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hd: [111, 44], ft: [82, 110] },
  ] },
  snatch: { d: 0.7, f: [
    { h: [70, 72], s: [104, 84], hd: [72, 98], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hd: [83, 9], ft: [82, 110] },
  ] },
  calf: { d: 0.9, f: [
    { h: [80, 70], s: [80, 0], hr: [1, 30], ft: [80, 110] },
    { h: [80, 63], s: [80, 0], hr: [1, 30], ft: [80, 103] },
  ] },
  sidePlank: { view: "front", d: 1.6, f: [
    { h: [62, 101], s: [100, 93], hd: [96, 109], hd2: [90, 52], ft: [24, 108], ft2: [24, 102] },
    { h: [62, 93], s: [100, 91], hd: [96, 109], hd2: [90, 50], ft: [24, 108], ft2: [24, 102] },
  ] },
  copenhagen: { view: "front", bench: [8, 90, 30], d: 1.6, f: [
    { h: [62, 101], s: [100, 93], hd: [96, 109], hd2: [72, 86], ft: [36, 108], ft2: [22, 89] },
    { h: [62, 94], s: [100, 91], hd: [96, 109], hd2: [72, 80], ft: [34, 104], ft2: [22, 89] },
  ] },
  plank: { d: 1.6, f: [
    { h: [68, 100], s: [100, 96], hd: [112, 109], ft: [29, 110] },
    { h: [68, 98], s: [100, 95], hd: [112, 109], ft: [29, 110] },
  ] },
  bridge: { d: 1, f: [
    { h: [72, 106], s: [40, 106], hd: [56, 109], ft: [98, 110] },
    { h: [74, 90], s: [40, 104], hd: [56, 109], ft: [98, 110] },
  ] },
  slBridge: { d: 1, f: [
    { h: [72, 106], s: [40, 106], hd: [56, 109], ft: [98, 110], ft2: [106, 84] },
    { h: [74, 90], s: [40, 104], hd: [56, 109], ft: [98, 110], ft2: [110, 68] },
  ] },
  abduction: { view: "front", d: 0.9, f: [
    { h: [80, 103], s: [40, 101], hd: [68, 96], hd2: [32, 92], ft: [120, 101], ft2: [120, 109] },
    { h: [80, 103], s: [40, 101], hd: [68, 96], hd2: [32, 92], ft: [116, 78], ft2: [120, 109] },
  ] },
  deadbug: { flip: true, seq: true, d: 0.9, f: [
    { h: [60, 104], s: [100, 104], hd: [90, 73], hd2: [90, 73], ft: [80, 84], ft2: [80, 84] },
    { h: [60, 104], s: [100, 104], hd: [119, 100], hd2: [90, 73], ft: [80, 84], ft2: [22, 101] },
    { h: [60, 104], s: [100, 104], hd: [90, 73], hd2: [90, 73], ft: [80, 84], ft2: [80, 84] },
    { h: [60, 104], s: [100, 104], hd: [90, 73], hd2: [119, 100], ft: [22, 101], ft2: [80, 84] },
  ] },
  hollow: { flip: true, d: 1.4, f: [
    { h: [70, 104], s: [100, 96], hd: [124, 90], ft: [32, 98] },
    { h: [70, 104], s: [100, 94], hd: [124, 87], ft: [32, 95] },
  ] },
  twist: { view: "front", d: 0.7, f: [
    { h: [80, 100], s: [77, 0], hd: [62, 90], hd2: [64, 88], ft: [104, 106], ft2: [56, 106] },
    { h: [80, 100], s: [83, 0], hd: [98, 88], hd2: [96, 90], ft: [104, 106], ft2: [56, 106] },
  ] },
  walk: { d: 0.6, f: [
    { h: [80, 71], s: [81, 0], hr: [1, 30], ft: [92, 110], ft2: [68, 110] },
    { h: [80, 71], s: [81, 0], hr: [1, 30], ft: [68, 110], ft2: [92, 110] },
  ] },
  rackWalk: { d: 0.6, f: [
    { h: [80, 71], s: [81, 0], hr: [8, 4], ft: [92, 110], ft2: [68, 110] },
    { h: [80, 71], s: [81, 0], hr: [8, 4], ft: [68, 110], ft2: [92, 110] },
  ] },
  getup: { d: 1, f: [
    { h: [72, 104], s: [30, 104], hr: [0, -31], hd2: [56, 108], ft: [92, 110], ft2: [104, 108] },
    { h: [72, 104], s: [40, 82], hr: [0, -31], hd2: [36, 107], ft: [92, 110], ft2: [104, 108] },
    { h: [72, 104], s: [58, 74], hr: [0, -31], hd2: [48, 108], ft: [92, 110], ft2: [104, 108] },
    { h: [75, 94], s: [52, 78], hr: [0, -31], hd2: [46, 108], ft: [96, 110], ft2: [100, 110] },
    { h: [68, 84], s: [68, 0], hr: [0, -31], ft: [90, 110], ft2: [44, 110] },
    { h: [70, 70], s: [70, 0], hr: [0, -31], ft: [72, 110], ft2: [68, 110] },
  ] },
  cleanPress: { seq: true, d: 0.8, f: [
    { h: [68, 82], s: [98, 74], hd: [84, 104], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hd: [87, 42], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hd: [81, 9], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hd: [87, 42], ft: [82, 110] },
  ] },
  burpee: { seq: true, d: 0.6, f: [
    { h: [80, 70], s: [80, 0], ft: [82, 110] },
    { h: [72, 96], s: [100, 76], hd: [100, 110], ft: [82, 110] },
    { h: [76, 92], s: [103, 79], hd: [104, 110], ft: [40, 110] },
    { h: [79, 103], s: [109, 99], hd: [106, 110], ft: [40, 110] },
    { h: [72, 96], s: [100, 76], hd: [100, 110], ft: [82, 110] },
    { h: [80, 58], s: [80, 0], hr: [6, -29], ft: [80, 98] },
  ] },
  manmaker: { seq: true, d: 0.7, f: [
    { h: [80, 70], s: [80, 0], ft: [82, 110] },
    { h: [72, 96], s: [100, 76], hd: [100, 110], ft: [82, 110] },
    { h: [76, 92], s: [103, 79], hd: [104, 110], ft: [40, 110] },
    { h: [76, 92], s: [103, 79], hd: [90, 92], hd2: [104, 110], ft: [40, 110] },
    { h: [76, 92], s: [103, 79], hd: [104, 110], ft: [40, 110] },
    { h: [66, 92], s: [80, 60], hr: [8, 2], ft: [82, 110] },
    { h: [80, 70], s: [80, 0], hr: [2, -31], ft: [82, 110] },
  ] },
};

// 운동 이름 → 동작 그림
const WK_MOTION_OF = {
  "턱걸이 (오버핸드)": "pullup", "친업 (언더핸드)": "pullup", "네거티브 턱걸이": "pullup", "와이드 턱걸이": "pullup", "턱걸이 + 위에서 2초 멈춤": "pullup",
  "커틀벨 원암 로우": "row", "체스트 서포티드 덤벨 로우": "proneRow", "덤벨 리어델트 플라이": "proneRow", "커틀벨 로우 + 3초 내리기": "row",
  "푸시업": "pushup", "디클라인 푸시업": "pushupDecline", "덤벨 벤치프레스 (3초 내리기)": "benchPress", "아처 푸시업": "pushup", "다이아몬드 푸시업": "pushup", "푸시업 + 아래서 2초 멈춤": "pushup",
  "커틀벨 원암 프레스": "press", "파이크 푸시업": "pike", "덤벨 숄더프레스 (앉아서)": "seatedPress", "커틀벨 바텀업 프레스": "press",
  "덤벨 해머 컬": "curl", "벤치 딥스": "benchDip", "덤벨 레터럴 레이즈": "lateral", "커틀벨 할로": "halo",
  "고블릿 스쿼트 (3초 내리기)": "squat", "불가리안 스플릿 스쿼트": "splitSquat", "덤벨 리버스 런지": "lunge", "코사크 스쿼트": "cossack", "벤치 스텝업": "stepUp",
  "덤벨 루마니안 데드리프트": "rdl", "싱글레그 루마니안 데드리프트": "slRdl", "커틀벨 힙 쓰러스트": "hipThrust", "싱글레그 힙 쓰러스트": "slHipThrust",
  "커틀벨 스윙": "swing", "커틀벨 원암 스윙": "swing", "점프 스쿼트": "jumpSquat", "스플릿 점프 런지": "splitJump", "덤벨 스러스터": "thruster",
  "싱글레그 카프 레이즈": "calf", "코펜하겐 플랭크": "copenhagen", "싱글레그 글루트 브릿지": "slBridge", "사이드 라잉 힙 어브덕션": "abduction", "벤치 스텝다운 (3초)": "stepUp",
  "행잉 니 레이즈": "kneeRaise", "행잉 레그 레이즈": "legRaise", "플랭크": "plank", "데드버그": "deadbug", "할로우 바디 홀드": "hollow", "사이드 플랭크": "sidePlank", "러시안 트위스트": "twist",
  "수트케이스 캐리": "walk", "터키쉬 겟업": "getup", "커틀벨 랙 캐리": "rackWalk", "데드 행": "hang",
  "커틀벨 클린 앤 프레스": "cleanPress", "버피": "burpee", "덤벨 맨메이커 (가볍게)": "manmaker", "커틀벨 스내치": "snatch",
};

// 동작별 쓰는 근육: p 주로(빨강), s 보조(주황), hot 힘이 가장 많이 드는 자세 번호("all"이면 계속)
const WK_MUSCLE_NAMES = {
  chest: "가슴", back: "등", shoulder: "어깨", biceps: "팔 앞(이두)", triceps: "팔 뒤(삼두)", forearm: "아래팔·악력",
  abs: "복근", obliques: "옆구리", lowback: "허리", glutes: "엉덩이", hipabd: "엉덩이 옆", quads: "허벅지 앞",
  hams: "허벅지 뒤", adductors: "허벅지 안쪽", calves: "종아리",
};
const WK_MUSCLES = {
  squat: { p: ["quads", "glutes"], s: ["adductors", "lowback", "abs"] },
  thruster: { p: ["quads", "glutes", "shoulder"], s: ["triceps", "abs"], hot: [0, 1] },
  jumpSquat: { p: ["quads", "glutes", "calves"], s: ["hams"], hot: [0] },
  pullup: { p: ["back", "biceps"], s: ["forearm", "shoulder", "abs"] },
  hang: { p: ["forearm"], s: ["back", "shoulder"], hot: "all" },
  kneeRaise: { p: ["abs"], s: ["forearm", "obliques"] },
  legRaise: { p: ["abs"], s: ["forearm", "obliques", "quads"] },
  pushup: { p: ["chest", "triceps"], s: ["shoulder", "abs"] },
  pushupDecline: { p: ["chest", "shoulder"], s: ["triceps", "abs"] },
  pike: { p: ["shoulder", "triceps"], s: ["chest", "abs"] },
  benchPress: { p: ["chest", "triceps"], s: ["shoulder"] },
  row: { p: ["back", "biceps"], s: ["forearm", "shoulder", "lowback"] },
  proneRow: { p: ["back"], s: ["biceps", "shoulder"] },
  press: { p: ["shoulder", "triceps"], s: ["abs", "obliques", "glutes"] },
  seatedPress: { p: ["shoulder", "triceps"], s: ["abs"] },
  curl: { p: ["biceps"], s: ["forearm"] },
  benchDip: { p: ["triceps"], s: ["chest", "shoulder"] },
  lateral: { p: ["shoulder"], s: ["back"] },
  halo: { p: ["shoulder"], s: ["abs", "obliques", "triceps"], hot: "all" },
  cossack: { p: ["adductors", "quads", "glutes"], s: ["hams", "abs"], hot: [1, 3] },
  splitSquat: { p: ["quads", "glutes"], s: ["adductors", "hams", "abs"] },
  lunge: { p: ["quads", "glutes"], s: ["adductors", "hams", "calves"] },
  splitJump: { p: ["quads", "glutes", "calves"], s: ["hams"], hot: "all" },
  stepUp: { p: ["quads", "glutes"], s: ["calves", "hipabd"], hot: [1, 2] },
  rdl: { p: ["hams", "glutes"], s: ["lowback", "forearm"] },
  slRdl: { p: ["hams", "glutes"], s: ["hipabd", "lowback", "calves"] },
  hipThrust: { p: ["glutes"], s: ["hams", "quads"] },
  slHipThrust: { p: ["glutes"], s: ["hams", "hipabd"] },
  swing: { p: ["glutes", "hams"], s: ["lowback", "abs", "forearm", "shoulder"] },
  snatch: { p: ["glutes", "hams", "shoulder"], s: ["back", "lowback", "forearm"] },
  calf: { p: ["calves"] },
  sidePlank: { p: ["obliques"], s: ["abs", "hipabd", "shoulder"], hot: "all" },
  copenhagen: { p: ["adductors", "obliques"], s: ["abs", "shoulder"], hot: "all" },
  plank: { p: ["abs"], s: ["shoulder", "glutes", "quads"], hot: "all" },
  bridge: { p: ["glutes"], s: ["hams"] },
  slBridge: { p: ["glutes", "hams"], s: ["hipabd", "abs"] },
  abduction: { p: ["hipabd"], s: ["glutes"] },
  deadbug: { p: ["abs"], s: ["obliques"], hot: "all" },
  hollow: { p: ["abs"], s: ["quads"], hot: "all" },
  twist: { p: ["obliques"], s: ["abs"], hot: "all" },
  walk: { p: ["obliques", "forearm"], s: ["abs", "hipabd", "shoulder"], hot: "all" },
  rackWalk: { p: ["abs", "forearm"], s: ["obliques", "biceps", "shoulder"], hot: "all" },
  getup: { p: ["shoulder", "abs"], s: ["glutes", "quads", "obliques", "triceps"], hot: "all" },
  cleanPress: { p: ["glutes", "shoulder"], s: ["hams", "triceps", "back", "abs"], hot: [1, 2] },
  burpee: { p: ["quads", "chest"], s: ["triceps", "shoulder", "abs", "glutes", "calves"], hot: "all" },
  manmaker: { p: ["chest", "back", "shoulder", "quads"], s: ["triceps", "biceps", "glutes", "abs"], hot: "all" },
};
// 같은 그림이라도 운동마다 근육이 다른 경우
const WK_MUSCLES_EX = {
  "친업 (언더핸드)": { p: ["biceps", "back"], s: ["forearm", "abs"] },
  "다이아몬드 푸시업": { p: ["triceps", "chest"], s: ["shoulder", "abs"] },
  "덤벨 리어델트 플라이": { p: ["shoulder", "back"], s: [] },
  "커틀벨 바텀업 프레스": { p: ["shoulder", "forearm"], s: ["triceps", "abs"] },
  "커틀벨 원암 스윙": { p: ["glutes", "hams", "obliques"], s: ["lowback", "forearm", "shoulder"] },
  "벤치 스텝다운 (3초)": { p: ["quads"], s: ["glutes", "hipabd"], hot: [1, 2] },
  "싱글레그 카프 레이즈": { p: ["calves"], s: [] },
};

// 동작별 "이렇게 하세요" (2~3줄)
const WK_HOW = {
  squat: ["발은 어깨너비, 발끝 살짝 바깥", "엉덩이를 뒤로·아래로, 허벅지가 바닥과 평행 이하까지", "발 전체로 바닥을 밀며 일어나기"],
  thruster: ["덤벨을 어깨에 올리고 스쿼트로 앉기", "일어나는 힘을 그대로 이용해 머리 위로 밀기", "내리면서 다시 앉기 — 쉬지 않고 이어서"],
  jumpSquat: ["반쯤 앉았다가 팔을 휘두르며 점프", "착지는 발 앞쪽부터 부드럽게", "착지하자마자 다음 점프 준비"],
  pullup: ["봉을 잡고 팔을 끝까지 펴서 매달리기", "날개뼈를 아래로 당긴 뒤 가슴을 봉 쪽으로", "턱이 봉을 넘으면 천천히 끝까지 내려오기"],
  hang: ["봉을 잡고 힘 빼고 매달리기", "어깨가 귀에 붙지 않게 살짝만 아래로", "숨은 천천히, 시간 채우기"],
  kneeRaise: ["매달려서 몸이 흔들리지 않게 멈추기", "배에 힘 주고 무릎을 가슴 쪽으로", "천천히 내리기 — 반동 쓰지 않기"],
  legRaise: ["매달려서 몸 고정", "다리를 편 채 골반을 말아 올리듯 들기", "천천히 내리며 흔들림 줄이기"],
  pushup: ["손은 어깨 아래, 몸은 머리부터 발까지 일자", "팔꿈치는 몸에서 45도, 가슴이 바닥 가까이", "바닥을 밀어내며 올라오기"],
  pushupDecline: ["발을 벤치에 올리고 손은 바닥", "엉덩이가 들리거나 처지지 않게 일자 유지", "가슴이 바닥 가까이 → 밀어 올리기"],
  pike: ["엉덩이를 높이 들어 몸을 ㅅ자로", "팔꿈치를 굽혀 정수리가 손 사이 바닥으로", "어깨로 밀어 올리기"],
  benchPress: ["벤치에 누워 발은 바닥, 날개뼈 모으기", "덤벨을 가슴 옆까지 천천히 내리기", "가슴 위로 밀어 올리기"],
  row: ["한 손은 벤치, 등은 평평하게", "팔꿈치를 엉덩이 쪽으로 끌어당기기", "위에서 1초 멈췄다 천천히 내리기"],
  proneRow: ["벤치에 엎드려 덤벨을 늘어뜨리기", "팔꿈치를 뒤로 당겨 날개뼈 모으기", "천천히 내리기"],
  press: ["커틀벨을 어깨 앞(랙)에 두고 서기", "엉덩이·배에 힘 주고 머리 위로 똑바로", "팔 펴고 1초, 천천히 어깨로 내리기"],
  seatedPress: ["벤치에 곧게 앉아 덤벨을 어깨 높이로", "허리 꺾지 말고 머리 위로 밀기", "천천히 어깨 높이로 내리기"],
  curl: ["팔꿈치를 옆구리에 고정", "팔꿈치만 접어 덤벨 올리기", "반동 없이 천천히 내리기"],
  benchDip: ["벤치 끝을 잡고 엉덩이를 앞으로 빼기", "팔꿈치를 뒤로 굽혀 몸을 내리기", "손바닥으로 밀어 올라오기"],
  lateral: ["덤벨을 옆에 두고 팔꿈치 살짝 굽히기", "팔을 옆으로 어깨높이까지 들기", "천천히 내리기 — 어깨 으쓱 금지"],
  halo: ["커틀벨 손잡이를 거꾸로 잡고 가슴 앞", "머리 둘레로 천천히 한 바퀴", "배에 힘 주고 몸통은 움직이지 않기"],
  cossack: ["다리를 아주 넓게 벌리기", "한쪽 무릎을 굽혀 그쪽으로 깊게 앉기, 반대 다리는 쭉", "가운데로 돌아와 반대쪽"],
  splitSquat: ["뒷발 등을 벤치에 올리고 앞발은 멀리", "뒷무릎이 바닥 쪽으로 똑바로 내려가게", "앞발 뒤꿈치로 밀어 올라오기"],
  lunge: ["바르게 서서 한 발을 뒤로 크게", "양 무릎이 90도가 되게 내려가기", "앞발로 밀어 제자리로"],
  splitJump: ["런지 자세에서 시작", "점프해서 공중에서 앞뒤 다리 바꾸기", "부드럽게 착지하고 바로 다음"],
  stepUp: ["한 발을 벤치에 올리기", "올린 발로만 밀어서 벤치 위에 서기", "천천히 같은 발로 내려오기"],
  rdl: ["무릎은 살짝만 굽히고 고정", "엉덩이를 뒤로 빼며 덤벨이 다리를 타고 내려가게", "허벅지 뒤가 당기면 엉덩이를 밀며 일어서기"],
  slRdl: ["한 다리로 서서 무릎 살짝 굽히기", "몸을 숙이며 뒷다리를 뒤로 뻗어 T자", "골반이 돌아가지 않게 일어서기"],
  hipThrust: ["등 위쪽을 벤치에 대고 발은 바닥", "엉덩이를 밀어 올려 몸이 일자가 되게", "위에서 2초 엉덩이 꽉 → 천천히 내리기"],
  slHipThrust: ["등 위쪽을 벤치에, 한 발만 바닥", "그 발로 엉덩이를 밀어 올리기", "골반이 기울지 않게 천천히 내리기"],
  swing: ["커틀벨을 다리 사이로 깊게 보내기 (엉덩이 뒤로)", "엉덩이를 앞으로 튕겨 가슴 높이까지", "팔은 줄일 뿐, 힘은 엉덩이에서"],
  snatch: ["스윙처럼 다리 사이로 보내기", "엉덩이 힘으로 끌어올려 머리 위에서 팔 펴기", "손목 아프면 4kg로 연습"],
  calf: ["발 앞쪽으로 서기 (벤치나 계단 끝이면 더 좋음)", "뒤꿈치를 최대한 높이 들기", "천천히 깊게 내리기"],
  sidePlank: ["옆으로 누워 팔꿈치를 어깨 바로 아래", "엉덩이를 들어 머리~발 일직선", "시간 동안 버티기"],
  copenhagen: ["위쪽 다리를 벤치에 걸치고 옆으로 누운 자세", "팔꿈치로 받치고 엉덩이 들기", "아래 다리는 힘 빼거나 같이 들기"],
  plank: ["팔꿈치는 어깨 아래, 몸은 일자", "배꼽을 당기고 엉덩이에 힘", "숨 참지 말고 버티기"],
  bridge: ["누워서 무릎 세우기", "엉덩이를 들어 어깨~무릎 일직선", "위에서 1초 멈췄다 내리기"],
  slBridge: ["누워서 한 발만 바닥, 다른 다리는 들기", "바닥 발로 엉덩이 밀어 올리기", "골반 수평 유지하며 내리기"],
  abduction: ["옆으로 누워 아래 팔로 머리 받치기", "위쪽 다리를 곧게 편 채 위로 들기", "발끝은 앞을 보게, 천천히 내리기"],
  deadbug: ["누워서 팔은 천장, 무릎은 90도로 들기", "한쪽 팔과 반대쪽 다리를 바닥 가까이 뻗기", "허리는 바닥에 붙인 채 번갈아"],
  hollow: ["누워서 허리를 바닥에 꾹 붙이기", "어깨와 다리를 살짝 띄워 바나나 모양", "허리가 뜨면 무릎을 굽혀 쉽게"],
  twist: ["앉아서 상체를 살짝 뒤로 기울이기", "커틀벨을 들고 좌우로 몸통 돌리기", "발은 바닥에 두거나 들어서 더 어렵게"],
  walk: ["한 손에 커틀벨, 어깨 수평 유지", "몸이 기울지 않게 똑바로 걷기", "반대 손으로 바꿔서 같은 거리"],
  rackWalk: ["커틀벨을 가슴 앞(랙)에 들기", "허리 꺾지 말고 배에 힘 주고 걷기", "반대 손으로 바꿔서 같은 거리"],
  getup: ["누워서 커틀벨을 천장으로 들고 끝까지 보기", "팔꿈치 → 손 → 엉덩이 들기 → 무릎 꿇기 → 일어서기", "같은 순서를 거꾸로 천천히 누워 돌아가기"],
  cleanPress: ["커틀벨을 다리 사이에서 시작", "엉덩이 힘으로 가슴 앞(랙)으로 끌어올리기", "머리 위로 밀고 → 랙 → 바닥 순서로 내리기"],
  burpee: ["서서 → 손 짚고 → 다리 뒤로 플랭크", "가슴 바닥까지 → 다리 당겨 앉기", "점프하며 손 위로"],
  manmaker: ["덤벨을 쥔 채 플랭크 → 푸시업", "좌우 한 번씩 로우", "다리 당겨 일어나며 머리 위로 밀기"],
};

// ---------- 계산 ----------
function moDir(a) {
  const r = (a * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
}
function moAngle(from, to) {
  return (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;
}
function moAdd(p, v, k) {
  return [p[0] + v[0] * k, p[1] + v[1] * k];
}
// 두 마디 팔다리: 시작점 P에서 목표점 T로, 꺾이는 쪽 s
function moIk(P, T, l1, l2, s) {
  let dx = T[0] - P[0];
  let dy = T[1] - P[1];
  let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.01;
  if (d > max) {
    dx = (dx / d) * max;
    dy = (dy / d) * max;
    d = max;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const bx = P[0] + (dx * a) / d;
  const by = P[1] + (dy * a) / d;
  const joint = [bx + (-dy / d) * h * s, by + (dx / d) * h * s];
  return [joint, [P[0] + dx, P[1] + dy]];
}

// 키프레임 → 실제 좌표(엉덩이, 몸통 각도, 손발)
function moResolve(f) {
  const t = moAngle(f.h, f.s);
  const S = moAdd(f.h, moDir(t), MO_LEN.torso);
  const hand = f.hd || (f.hr ? [S[0] + f.hr[0], S[1] + f.hr[1]] : [S[0] + 1, S[1] + 30]);
  const hand2 = f.hd2 || (f.hr2 ? [S[0] + f.hr2[0], S[1] + f.hr2[1]] : f.hd || f.hr ? hand : [S[0] + 1, S[1] + 30]);
  return {
    h: f.h, t: t, hand: hand, hand2: hand2, ft: f.ft, ft2: f.ft2 || f.ft,
    ks: f.ks || -1, ks2: f.ks2 || f.ks || -1, es: f.es || 1, es2: f.es2 || f.es || 1,
  };
}

function moLerp(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
function moMix(A, B, k) {
  let dt = B.t - A.t;
  while (dt > 180) dt -= 360;
  while (dt < -180) dt += 360;
  return {
    h: moLerp(A.h, B.h, k), t: A.t + dt * k,
    hand: moLerp(A.hand, B.hand, k), hand2: moLerp(A.hand2, B.hand2, k),
    ft: moLerp(A.ft, B.ft, k), ft2: moLerp(A.ft2, B.ft2, k),
    ks: k < 0.5 ? A.ks : B.ks, ks2: k < 0.5 ? A.ks2 : B.ks2, es: A.es, es2: A.es2,
  };
}

// 한 장면의 막대 사람 좌표
function moSkeleton(p, front) {
  const td = moDir(p.t);
  const S = moAdd(p.h, td, MO_LEN.torso);
  const head = moAdd(S, td, MO_LEN.neck);
  const side = [-td[1], td[0]]; // 몸통에 수직 (앞모습일 때 어깨·골반 폭)
  const S1 = front ? moAdd(S, side, 9) : S;
  const S2 = front ? moAdd(S, side, -9) : S;
  const H1 = front ? moAdd(p.h, side, 5) : p.h;
  const H2 = front ? moAdd(p.h, side, -5) : p.h;
  const m = front ? -1 : 1; // 앞모습은 반대쪽 팔다리를 거울처럼
  const arm = moIk(S1, p.hand, MO_LEN.upper, MO_LEN.fore, p.es);
  const arm2 = moIk(S2, p.hand2, MO_LEN.upper, MO_LEN.fore, p.es2 * m);
  const leg = moIk(H1, p.ft, MO_LEN.thigh, MO_LEN.shin, p.ks);
  const leg2 = moIk(H2, p.ft2, MO_LEN.thigh, MO_LEN.shin, p.ks2 * m);
  return { S: S, S1: S1, S2: S2, H: p.h, H1: H1, H2: H2, head: head, arm: arm, arm2: arm2, leg: leg, leg2: leg2 };
}

// ---------- 그리기 ----------
const MO_NS = "http://www.w3.org/2000/svg";

function moEl(tag, attrs, parent) {
  const e = document.createElementNS(MO_NS, tag);
  Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}
function moPts(list) {
  return list.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
}

// 동작 그림 시작: box(빈 div)에 그림을 넣고 멈추는 함수를 돌려줌
// weight: "kb"(한 손 커틀벨) | "db"(양손 덤벨) | null
function moPlay(box, key, weight) {
  const mo = WK_MOTIONS[key];
  box.innerHTML = "";
  if (!mo) return () => {};
  const svg = moEl("svg", { viewBox: "0 0 160 120", class: "mo-svg", role: "img" }, box);
  if (!mo.noGround) moEl("line", { x1: 4, y1: MO_GROUND + 1.5, x2: 156, y2: MO_GROUND + 1.5, class: "mo-ground" }, svg);
  if (mo.bench) {
    const [bx, by, bw] = mo.bench;
    moEl("rect", { x: bx, y: by, width: bw, height: 5, rx: 2, class: "mo-bench" }, svg);
    moEl("line", { x1: bx + 5, y1: by + 5, x2: bx + 5, y2: MO_GROUND, class: "mo-bench-leg" }, svg);
    moEl("line", { x1: bx + bw - 5, y1: by + 5, x2: bx + bw - 5, y2: MO_GROUND, class: "mo-bench-leg" }, svg);
  }
  if (mo.bar) {
    moEl("line", { x1: 40, y1: mo.bar, x2: 124, y2: mo.bar, class: "mo-bar" }, svg);
  }
  const far = moEl("g", { class: "mo-far" }, svg);
  const arm2 = moEl("polyline", {}, far);
  const leg2 = moEl("polyline", {}, far);
  const near = moEl("g", { class: "mo-near" }, svg);
  const torso = moEl("polyline", { class: "mo-torso" }, near);
  const leg = moEl("polyline", {}, near);
  const head = moEl("circle", { r: MO_LEN.head, class: "mo-head" }, near);
  const arm = moEl("polyline", {}, near);
  const wts = [];
  if (weight === "kb") wts.push(moEl("g", { class: "mo-kb" }, svg));
  if (weight === "db") wts.push(moEl("g", { class: "mo-db" }, svg), moEl("g", { class: "mo-db" }, svg));
  wts.forEach((g) => {
    if (g.getAttribute("class") === "mo-kb") {
      moEl("circle", { cx: 0, cy: 6, r: 5 }, g);
      moEl("path", { d: "M-3,2 Q0,-2 3,2", class: "mo-kb-handle" }, g);
    } else {
      moEl("rect", { x: -6, y: -2.5, width: 12, height: 5, rx: 1.5 }, g);
    }
  });

  const keys = mo.f.map(moResolve);
  // 재생 순서: 왕복(0→1→0) 또는 순환(0→1→…→0)
  const order = mo.seq || keys.length > 2 ? keys.map((_, i) => i).concat([0]) : [0, 1, 0];
  const segDur = (mo.d || 1) * 1000;
  const hold = 180;
  const total = (order.length - 1) * (segDur + hold);
  const front = mo.view === "front";
  const start = performance.now();
  let raf = 0;

  function frame(now) {
    const tt = (((now - start) % total) + total) % total; // rAF 시각이 시작보다 살짝 이를 수 있음
    const i = Math.floor(tt / (segDur + hold));
    const local = Math.min(1, (tt - i * (segDur + hold)) / segDur);
    const k = 0.5 - 0.5 * Math.cos(Math.PI * local); // 부드럽게
    const p = moMix(keys[order[i]], keys[order[i + 1]], k);
    const sk = moSkeleton(p, front);
    torso.setAttribute("points", moPts(front ? [sk.H1, sk.H2, sk.S2, sk.S1, sk.H1] : [sk.H, sk.S]));
    head.setAttribute("cx", sk.head[0].toFixed(1));
    head.setAttribute("cy", sk.head[1].toFixed(1));
    arm.setAttribute("points", moPts([sk.S1, sk.arm[0], sk.arm[1]]));
    arm2.setAttribute("points", moPts([sk.S2, sk.arm2[0], sk.arm2[1]]));
    // 발: 옆모습이면 앞쪽으로 짧은 선
    const foot = (lg) => (front ? [] : [[lg[1][0] + 6, lg[1][1]]]);
    leg.setAttribute("points", moPts([sk.H1, sk.leg[0], sk.leg[1]].concat(foot(sk.leg))));
    leg2.setAttribute("points", moPts([sk.H2, sk.leg2[0], sk.leg2[1]].concat(foot(sk.leg2))));
    if (weight === "kb") wts[0].setAttribute("transform", `translate(${sk.arm[1][0].toFixed(1)},${sk.arm[1][1].toFixed(1)})`);
    if (weight === "db") {
      wts[0].setAttribute("transform", `translate(${sk.arm[1][0].toFixed(1)},${sk.arm[1][1].toFixed(1)})`);
      wts[1].setAttribute("transform", `translate(${sk.arm2[1][0].toFixed(1)},${sk.arm2[1][1].toFixed(1)})`);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  frame(start);
  return () => cancelAnimationFrame(raf);
}
