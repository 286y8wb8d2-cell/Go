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
  band: "저항 밴드",
  rope: "줄넘기",
  gym: "헬스장",
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
    { n: "스캐풀라 풀업", eq: ["bar"], r: [8, 12], u: "회", tip: "매달려 팔은 편 채 어깨만 아래로 당겼다 풀기. 턱걸이 첫걸음" },
    { n: "엎드려 W 당기기", eq: ["bw"], r: [12, 15], u: "회", tip: "엎드려 팔을 앞으로 뻗었다가 팔꿈치를 옆구리로 당기며 등 쥐기" },
  ],
  // 앞으로 당기기 (로우)
  pullH: [
    { n: "커틀벨 원암 로우", eq: ["kb12", "bench"], r: [10, 12], u: "회(한쪽)", tip: "한 손·한 무릎을 벤치에. 팔꿈치를 엉덩이 쪽으로" },
    { n: "체스트 서포티드 덤벨 로우", eq: ["db", "bench"], r: [12, 15], u: "회", tip: "벤치에 엎드려 양손 당기기, 위에서 1초 쥐어짜기" },
    { n: "덤벨 리어델트 플라이", eq: ["db", "bench"], r: [12, 15], u: "회", tip: "벤치에 엎드려 팔을 옆으로 벌리기. 어깨 뒤쪽" },
    { n: "커틀벨 로우 + 3초 내리기", eq: ["kb12", "bench"], r: [8, 10], u: "회(한쪽)", tip: "당긴 뒤 3초 동안 천천히 내리기" },
    { n: "엎드려 Y-T 레이즈", eq: ["bw"], r: [10, 12], u: "회", tip: "엎드려 팔을 Y, T 모양으로 번갈아 들어 1초 버티기" },
    { n: "밴드 로우", eq: ["band"], r: [12, 15], u: "회", tip: "밴드를 기둥·문에 걸고 팔꿈치를 뒤로 당겨 날개뼈 모으기" },
    { n: "밴드 풀 어파트", eq: ["band"], r: [15, 20], u: "회", tip: "팔을 앞으로 뻗고 밴드를 양옆으로 벌려 가슴에 닿게" },
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
    { n: "파이크 푸시업", eq: ["bw"], r: [8, 12], u: "회", tip: "엉덩이를 높이 들고 머리를 손 사이로" },
    { n: "덤벨 숄더프레스 (앉아서)", eq: ["db", "bench"], r: [12, 15], u: "회", tip: "벤치에 앉아서, 끝에서 팔 쭉 펴기" },
    { n: "커틀벨 바텀업 프레스", eq: ["kb4"], r: [8, 10], u: "회(한쪽)", tip: "커틀벨을 거꾸로 세워 들고 흔들리지 않게" },
    { n: "밴드 숄더 프레스", eq: ["band"], r: [12, 15], u: "회", tip: "밴드를 발로 밟고 머리 위로 밀기" },
  ],
  // 팔·어깨 마무리
  arms: [
    { n: "덤벨 해머 컬", eq: ["db"], r: [12, 15], u: "회", tip: "엄지가 위로 가게, 반동 없이" },
    { n: "벤치 딥스", eq: ["bw", "bench"], r: [12, 15], u: "회", tip: "벤치 끝을 잡고, 팔꿈치는 뒤로" },
    { n: "덤벨 레터럴 레이즈", eq: ["db"], r: [12, 15], u: "회", tip: "어깨높이까지만, 천천히 내리기" },
    { n: "커틀벨 할로", eq: ["kb4"], r: [8, 8], u: "바퀴(양방향)", tip: "머리 둘레로 돌리기. 배에 힘" },
    { n: "밴드 컬", eq: ["band"], r: [15, 20], u: "회", tip: "밴드를 발로 밟고 팔꿈치 고정한 채 접기" },
  ],
  // 스쿼트 계열
  squat: [
    { n: "고블릿 스쿼트 (3초 내리기)", eq: ["kb12"], r: [10, 12], u: "회", tip: "가슴 앞에 커틀벨, 3초 내려가 아래에서 1초 멈춤" },
    { n: "불가리안 스플릿 스쿼트", eq: ["db", "bench"], r: [8, 10], u: "회(한쪽)", tip: "뒷발을 벤치에. 앞무릎이 안으로 모이지 않게" },
    { n: "덤벨 리버스 런지", eq: ["db"], r: [10, 12], u: "회(한쪽)", tip: "뒤로 크게 딛고 앞발 뒤꿈치로 밀어 올라오기" },
    { n: "코사크 스쿼트", eq: ["kb12"], r: [6, 8], u: "회(한쪽)", tip: "다리를 넓게, 한쪽으로 깊게 앉기. 고관절 가동성" },
    { n: "벤치 스텝업", eq: ["db", "bench"], r: [10, 12], u: "회(한쪽)", tip: "올라간 발로만 밀기, 뒷발 반동 쓰지 않기" },
    { n: "맨몸 스쿼트 (3초 내리기)", eq: ["bw"], r: [15, 20], u: "회", tip: "3초 내려가 아래에서 1초 멈춤. 무게 대신 천천히" },
    { n: "맨몸 리버스 런지", eq: ["bw"], r: [10, 12], u: "회(한쪽)", tip: "뒤로 크게 딛고 앞발 뒤꿈치로 밀어 올라오기" },
  ],
  // 엉덩이 접기(힌지) 계열
  hinge: [
    { n: "덤벨 루마니안 데드리프트", eq: ["db"], r: [12, 15], u: "회", tip: "엉덩이를 뒤로 빼며 허벅지 뒤가 당길 때까지" },
    { n: "싱글레그 루마니안 데드리프트", eq: ["kb12"], r: [8, 10], u: "회(한쪽)", tip: "한 다리로 서서 몸을 T자로. 균형·햄스트링" },
    { n: "커틀벨 힙 쓰러스트", eq: ["kb12", "bench"], r: [12, 15], u: "회", tip: "등 위쪽을 벤치에 기대고 위에서 2초 엉덩이 쥐기" },
    { n: "싱글레그 힙 쓰러스트", eq: ["bw", "bench"], r: [10, 12], u: "회(한쪽)", tip: "한 발로. 러닝할 때 엉덩이 힘이 좋아짐" },
    { n: "글루트 브릿지", eq: ["bw"], r: [15, 20], u: "회", tip: "누워서 엉덩이를 들고 위에서 2초 쥐기" },
    { n: "맨몸 싱글레그 데드리프트", eq: ["bw"], r: [10, 12], u: "회(한쪽)", tip: "한 다리로 서서 몸을 T자로. 균형 잡기" },
  ],
  // 폭발력·심폐 (스윙 등)
  power: [
    { n: "커틀벨 스윙", eq: ["kb12"], r: [15, 20], u: "회", tip: "팔이 아니라 엉덩이를 튕겨서. 위에서 엉덩이 꽉" },
    { n: "커틀벨 원암 스윙", eq: ["kb12"], r: [10, 12], u: "회(한쪽)", tip: "몸이 돌아가지 않게 버티기" },
    { n: "점프 스쿼트", eq: ["bw"], r: [10, 12], u: "회", tip: "착지는 조용히, 무릎이 안으로 모이지 않게" },
    { n: "스플릿 점프 런지", eq: ["bw"], r: [8, 10], u: "회(한쪽)", tip: "공중에서 다리 바꾸기. 러닝 탄력" },
    { n: "덤벨 스러스터", eq: ["db"], r: [12, 15], u: "회", tip: "스쿼트에서 일어나는 힘으로 머리 위로 밀기" },
    { n: "줄넘기", eq: ["rope"], r: [60, 90], u: "초", tip: "발 앞쪽으로 가볍게 뛰고, 팔이 아니라 손목으로 돌리기" },
  ],
  // 러너 보강 (종아리·고관절·발목)
  runner: [
    { n: "싱글레그 카프 레이즈", eq: ["db", "bench"], r: [15, 20], u: "회(한쪽)", tip: "벤치나 계단 끝에서 뒤꿈치를 깊게 내렸다 올리기" },
    { n: "코펜하겐 플랭크", eq: ["bw", "bench"], r: [20, 30], u: "초(한쪽)", tip: "위쪽 다리를 벤치에 올리고 옆으로 버티기. 안쪽 허벅지" },
    { n: "싱글레그 글루트 브릿지", eq: ["bw"], r: [12, 15], u: "회(한쪽)", tip: "한 발로 엉덩이 들고 1초 멈춤" },
    { n: "사이드 라잉 힙 어브덕션", eq: ["bw"], r: [15, 20], u: "회(한쪽)", tip: "옆으로 누워 다리 들기. 무릎 통증 예방" },
    { n: "벤치 스텝다운 (3초)", eq: ["bw", "bench"], r: [8, 10], u: "회(한쪽)", tip: "벤치에서 한 발로 3초 동안 천천히 내려오기" },
    { n: "밴드 몬스터 워크", eq: ["band"], r: [10, 15], u: "걸음(한쪽)", tip: "무릎 위에 밴드, 반쯤 앉은 채 옆으로 걷기" },
    { n: "밴드 클램쉘", eq: ["band"], r: [15, 20], u: "회(한쪽)", tip: "옆으로 누워 무릎을 조개처럼 벌리기. 엉덩이 옆" },
  ],
  // 코어
  core: [
    { n: "행잉 니 레이즈", eq: ["bar"], r: [10, 15], u: "회", tip: "매달려서 무릎을 가슴으로. 몸이 흔들리지 않게" },
    { n: "행잉 레그 레이즈", eq: ["bar"], r: [6, 10], u: "회", tip: "다리를 펴고 들기. 힘들면 니 레이즈로" },
    { n: "플랭크", eq: ["bw"], r: [40, 60], u: "초", tip: "엉덩이 처지지 않게, 배꼽 당기기" },
    { n: "데드버그", eq: ["bw"], r: [8, 10], u: "회(한쪽)", tip: "허리를 바닥에 붙인 채 팔다리 반대로 뻗기" },
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
    { n: "줄넘기 빠르게", eq: ["rope"], r: [30, 40], u: "초", tip: "최대한 빠르게. 숨이 차오르게" },
  ],
  // ---------- 헬스장 (바벨·머신·케이블). wt: 3D 그림에서 손에 드는 것 ----------
  gSquat: [
    { n: "바벨 백스쿼트", eq: ["gym"], wt: "bb", r: [5, 8], u: "회", tip: "봉을 등 위쪽에 얹고 엉덩이를 뒤로 빼며 허벅지가 평행 아래까지" },
    { n: "레그 프레스", eq: ["gym"], r: [10, 12], u: "회", tip: "허리가 등받이에서 뜨지 않을 만큼만 내리기. 무릎 끝까지 펴서 잠그지 않기" },
    { n: "스미스 머신 스쿼트", eq: ["gym"], wt: "bb", r: [8, 10], u: "회", tip: "발을 살짝 앞에 두고, 3초 내려가기" },
  ],
  gHinge: [
    { n: "데드리프트", eq: ["gym"], wt: "bb", r: [4, 6], u: "회", tip: "봉을 정강이에 붙이고 등은 곧게, 바닥을 밀며 일어서기" },
    { n: "바벨 루마니안 데드리프트", eq: ["gym"], wt: "bb", r: [8, 10], u: "회", tip: "무릎 살짝 굽히고 엉덩이를 뒤로, 봉이 허벅지를 타고 내려가게" },
    { n: "바벨 힙 쓰러스트", eq: ["gym", "bench"], wt: "bb", r: [8, 12], u: "회", tip: "등 위쪽을 벤치에, 봉은 골반 위(패드). 위에서 2초 쥐기" },
  ],
  gLegAcc: [
    { n: "레그 익스텐션", eq: ["gym"], r: [12, 15], u: "회", tip: "위에서 1초 멈추고 천천히 내리기" },
    { n: "라잉 레그 컬", eq: ["gym"], r: [10, 12], u: "회", tip: "엉덩이가 들리지 않게, 발뒤꿈치를 엉덩이 쪽으로" },
    { n: "머신 카프 레이즈", eq: ["gym"], r: [12, 15], u: "회", tip: "끝까지 내렸다가 최대한 높이" },
    { n: "덤벨 워킹 런지", eq: ["gym"], wt: "db", r: [10, 12], u: "걸음(한쪽)", tip: "덤벨 들고 앞으로 걸어가며 런지" },
  ],
  gPushH: [
    { n: "바벨 벤치프레스", eq: ["gym", "bench"], wt: "bb", r: [5, 8], u: "회", tip: "날개뼈 모으고 발은 바닥에, 봉을 가슴 아래쪽까지 내렸다 밀기" },
    { n: "덤벨 인클라인 프레스", eq: ["gym", "bench"], wt: "db", r: [8, 10], u: "회", tip: "벤치를 30도로 세우고 윗가슴으로 밀기" },
    { n: "체스트 프레스 머신", eq: ["gym"], r: [10, 12], u: "회", tip: "손잡이를 가슴 높이에 맞추고 팔을 끝까지 밀기" },
    { n: "케이블 플라이", eq: ["gym"], r: [12, 15], u: "회", tip: "팔꿈치 살짝 굽힌 채 큰 원을 그리며 가슴 앞에서 모으기" },
  ],
  gPushV: [
    { n: "바벨 오버헤드 프레스", eq: ["gym"], wt: "bb", r: [5, 8], u: "회", tip: "서서 엉덩이·배에 힘, 봉을 얼굴 앞으로 지나 머리 위로" },
    { n: "덤벨 숄더 프레스", eq: ["gym", "bench"], wt: "db", r: [8, 10], u: "회", tip: "등받이에 기대 앉아 귀 옆에서 머리 위로" },
    { n: "머신 숄더 프레스", eq: ["gym"], r: [10, 12], u: "회", tip: "허리를 등받이에 붙이고 밀기" },
  ],
  gPullV: [
    { n: "랫 풀다운", eq: ["gym"], wt: "bb", r: [8, 12], u: "회", tip: "봉을 쇄골 쪽으로, 팔꿈치를 옆구리로 끌어내리기" },
    { n: "어시스트 턱걸이 머신", eq: ["gym"], r: [6, 10], u: "회", tip: "도움 무게를 조금씩 줄여 가기. 가슴을 봉 쪽으로" },
  ],
  gPullH: [
    { n: "바벨 로우", eq: ["gym"], wt: "bb", r: [6, 8], u: "회", tip: "상체를 45도로 숙이고 봉을 배꼽 쪽으로 당기기" },
    { n: "시티드 케이블 로우", eq: ["gym"], r: [10, 12], u: "회", tip: "가슴을 펴고 손잡이를 배 쪽으로, 날개뼈 모으기" },
    { n: "원암 덤벨 로우", eq: ["gym", "bench"], wt: "db", r: [8, 10], u: "회(한쪽)", tip: "한 손·한 무릎을 벤치에. 무겁게" },
    { n: "페이스 풀", eq: ["gym"], r: [12, 15], u: "회", tip: "로프를 얼굴 쪽으로 당기며 팔꿈치를 높게. 어깨 뒤쪽" },
  ],
  gArms: [
    { n: "바벨 컬", eq: ["gym"], wt: "bb", r: [8, 10], u: "회", tip: "팔꿈치를 옆구리에 고정하고 반동 없이" },
    { n: "케이블 푸시다운", eq: ["gym"], r: [10, 12], u: "회", tip: "팔꿈치를 옆구리에 붙이고 아래로 쭉 펴기" },
    { n: "케이블 레터럴 레이즈", eq: ["gym"], r: [12, 15], u: "회(한쪽)", tip: "어깨높이까지만, 천천히 내리기" },
  ],
  gCore: [
    { n: "행잉 니 레이즈", eq: ["gym"], r: [10, 15], u: "회", tip: "매달려서 무릎을 가슴으로. 몸이 흔들리지 않게" },
    { n: "케이블 우드찹", eq: ["gym"], r: [10, 12], u: "회(한쪽)", tip: "케이블을 위에서 대각선 아래로 당기며 몸통 돌리기" },
    { n: "플랭크", eq: ["bw"], r: [40, 60], u: "초", tip: "엉덩이 처지지 않게, 배꼽 당기기" },
  ],
};

// ---------- 사용자 설정(프로필)에 맞추기 ----------
// race: none | 5k | 10k | half | full (달리기 목표, 하나)
// goals: strength | fatloss | cardio | mobility | health (그 밖의 목표, 여러 개)
// run: none | beg(걷기 섞어서) | r30 | r60 | r120 (쉬지 않고 달릴 수 있는 시간)
// exp: beg | mid | adv   age: 20 | 30 | 40 | 50 | 60   intensity: easy | mid | hard
// where: home | gym | both (근력 운동 장소)   pullups: 0 | 1 | 5 | 10   minutes: 20 | 30 | 45 | 60 | 90   raceDate: "YYYY-MM-DD" 또는 ""
// limits: knee | back | shoulder | wrist | ankle   days: 요일별 가능 여부(월~일)
const WK_PROFILE_DEFAULT = {
  name: "", race: "half", goals: [], run: "r60", raceDate: "", exp: "mid", age: 30, intensity: "mid", pullups: 5,
  where: "home", kb: true, kbLight: 4, kbHeavy: 12, db: true, dbKg: 6, bench: true, bar: true, band: false, rope: false, treadmill: false,
  days: [true, true, true, true, true, true, true], minutes: 45, limits: [],
};
let wkProfile = Object.assign({}, WK_PROFILE_DEFAULT);

// 조심할 부위(·나이)별로 빼는 동작
const WK_JUMPS = ["점프 스쿼트", "스플릿 점프 런지", "버피", "줄넘기", "줄넘기 빠르게"];
const WK_AVOID = {
  knee: ["레그 익스텐션", "바벨 백스쿼트", "덤벨 워킹 런지", "점프 스쿼트", "스플릿 점프 런지", "코사크 스쿼트", "버피", "덤벨 맨메이커 (가볍게)", "줄넘기"],
  back: ["데드리프트", "바벨 로우", "바벨 백스쿼트", "커틀벨 스윙", "커틀벨 원암 스윙", "커틀벨 스내치", "덤벨 맨메이커 (가볍게)", "행잉 레그 레이즈", "러시안 트위스트", "덤벨 루마니안 데드리프트"],
  shoulder: ["바벨 오버헤드 프레스", "바벨 벤치프레스", "덤벨 숄더 프레스", "머신 숄더 프레스", "케이블 레터럴 레이즈", "커틀벨 원암 프레스", "덤벨 숄더프레스 (앉아서)", "파이크 푸시업", "커틀벨 스내치", "덤벨 스러스터", "벤치 딥스",
    "커틀벨 클린 앤 프레스", "덤벨 레터럴 레이즈", "커틀벨 할로", "터키쉬 겟업", "디클라인 푸시업", "커틀벨 바텀업 프레스", "밴드 숄더 프레스"],
  wrist: ["아처 푸시업", "다이아몬드 푸시업", "디클라인 푸시업", "파이크 푸시업", "버피", "덤벨 맨메이커 (가볍게)", "벤치 딥스", "커틀벨 스내치"],
  ankle: WK_JUMPS.concat(["코사크 스쿼트", "싱글레그 카프 레이즈"]),
  age: WK_JUMPS.concat(["커틀벨 스내치", "덤벨 맨메이커 (가볍게)"]), // 50대 이상
};
// 처음 하는 사람에게는 아직 이른 동작
const WK_HARD = ["데드리프트", "바벨 로우", "아처 푸시업", "커틀벨 스내치", "덤벨 맨메이커 (가볍게)", "터키쉬 겟업", "코펜하겐 플랭크", "스플릿 점프 런지", "행잉 레그 레이즈", "디클라인 푸시업"];
// 턱걸이 개수에 따라
const WK_PULL_ZERO = ["스캐풀라 풀업", "네거티브 턱걸이", "엎드려 W 당기기", "밴드 로우"];
const WK_PULL_FEW_NOT = ["와이드 턱걸이", "턱걸이 + 위에서 2초 멈춤", "행잉 레그 레이즈"];

// 예전(v8) 설정 → 지금 형식
function wkMigrateProfile(pr) {
  if (!pr || typeof pr.goal !== "string") return pr;
  const out = Object.assign({}, pr);
  out.race = pr.goal === "half" || pr.goal === "10k" ? pr.goal : "none";
  out.goals = pr.goal === "strength" ? ["strength"] : pr.goal === "health" ? ["health"] : [];
  if (pr.run === "mid") out.run = "r60";
  delete out.goal;
  return out;
}

function wkApplyProfile(pr) {
  wkProfile = Object.assign({}, WK_PROFILE_DEFAULT, wkMigrateProfile(pr) || {});
  const light = wkProfile.kbLight || wkProfile.kbHeavy;
  const heavy = wkProfile.kbHeavy || wkProfile.kbLight;
  WK_EQ.kb4 = "커틀벨 " + light + "kg";
  WK_EQ.kb12 = "커틀벨 " + heavy + "kg";
  WK_EQ.db = "덤벨 " + wkProfile.dbKg + "kg×2";
  wkPoolCache = {};
}
const wkHasGoal = (g) => wkProfile.goals.indexOf(g) >= 0;

// 설정에 맞는 동작만 남긴 묶음 (없는 장비·조심할 부위·실력 고려)
let wkPoolCache = {};
function wkPool(name) {
  if (wkPoolCache[name]) return wkPoolCache[name];
  const pr = wkProfile;
  const gymPool = name.charAt(0) === "g" && name !== "gym";
  const has = gymPool ? { bw: true, gym: true, bench: true }
    : { bw: true, kb4: pr.kb, kb12: pr.kb, db: pr.db, bench: pr.bench, bar: pr.bar, band: pr.band, rope: pr.rope, run: true };
  const avoid = {};
  const limits = (pr.limits || []).concat(pr.age >= 50 ? ["age"] : []);
  limits.forEach((l) => (WK_AVOID[l] || []).forEach((n) => (avoid[n] = true)));
  if (pr.exp === "beg") WK_HARD.forEach((n) => (avoid[n] = true));
  if (pr.pullups < 5) WK_PULL_FEW_NOT.forEach((n) => (avoid[n] = true));
  const list = WK_POOLS[name].filter((ex) => {
    if (!ex.eq.every((e) => has[e]) || avoid[ex.n]) return false;
    if (name === "pullV" && pr.pullups === 0) return WK_PULL_ZERO.indexOf(ex.n) >= 0;
    return true;
  });
  wkPoolCache[name] = list;
  return list;
}

// 며칠 하느냐 + 목표 조합에 따라 세션 고르기
// 러닝 비율: 달리기 목표가 길수록 ↑, 근력 목표가 있으면 ↓. 러닝을 안 하면 근력·컨디셔닝만
const WK_RUN_SHARE = { full: 0.6, half: 0.5, "10k": 0.45, "5k": 0.4, none: 0.3 };
function wkTemplateFor(n) {
  const pr = wkProfile;
  const running = pr.run !== "none";
  let runN = 0;
  if (running) {
    let share = WK_RUN_SHARE[pr.race] - (wkHasGoal("strength") ? 0.1 : 0) + (wkHasGoal("cardio") || wkHasGoal("fatloss") ? 0.05 : 0);
    if (pr.race === "none" && !wkHasGoal("cardio") && !wkHasGoal("fatloss") && wkHasGoal("strength")) share = 0.25;
    runN = Math.max(1, Math.round(n * share));
    if (n >= 2) runN = Math.min(runN, n - 1); // 근력 하루는 남기기
  }
  if (n === 1) return [running && (pr.race !== "none" || wkHasGoal("cardio")) ? "combo" : "full"];
  // 러닝 순서: 긴 러닝 → 포인트 → 이지 → ...
  const runList = pr.race === "full" ? ["lsd", "easy", "runQ", "easy", "runQ", "easy"] : ["lsd", "runQ", "easy", "easy", "runQ", "easy"];
  const out = runList.slice(0, runN).concat(wkStrengthList(n - runN, runN));
  // 7일이거나, 유연성 목표로 6일 이상이면 하루는 회복·가동성 (그보다 적으면 세션 끝 가동성으로)
  if ((wkHasGoal("mobility") && n >= 6) || n === 7) out[out.length - 1] = "recovery";
  // 하체·포인트처럼 힘든 날을 앞쪽에 (LSD에서 멀리)
  const ord = { lower: 0, runQ: 1, full: 2, upper: 3, indoor: 4, upperB: 5, easy: 6, combo: 2, lsd: 9, recovery: 9 };
  return out.sort((a, b) => ord[a] - ord[b]);
}

// 근력 날 k개를 무엇으로: 목표에 따라 순서가 다름 (하나뿐이면 전신)
function wkStrengthList(k, runN) {
  if (k === 1) return ["full"];
  let list = ["lower", "upper", "full", "indoor", "upperB", "full"];
  if (wkHasGoal("strength")) list = ["lower", "upper", "upperB", "full", "lower", "indoor"];
  if (wkHasGoal("fatloss") || wkHasGoal("cardio")) list = ["full", "indoor", "lower", "upper", "upperB", "indoor"];
  if (runN === 0 && !wkHasGoal("fatloss") && !wkHasGoal("cardio")) list = ["lower", "upper", "full", "indoor", "upperB", "indoor"];
  while (list.length < k) list = list.concat(["upper", "lower"]);
  return list.slice(0, k);
}

// 대회까지 남은 주 (대회 날짜가 있을 때). w = 이번 주 번호(1970년부터)
function wkWeeksToRace(w) {
  const d = wkProfile.raceDate;
  if (!d || wkProfile.race === "none") return null;
  const [y, m, dd] = d.split("-").map(Number);
  const day = new Date(y, m - 1, dd);
  const mon = new Date(day);
  mon.setDate(mon.getDate() - ((day.getDay() + 6) % 7));
  return Math.round(Date.UTC(mon.getFullYear(), mon.getMonth(), mon.getDate()) / 864e5 / 7) - w;
}

// 러닝 수준별 이지런 시간, 목표·수준별 LSD 최대
const WK_EASY_MIN = { r30: [30, 35, 40, 30], r60: [35, 40, 50, 35], r120: [45, 50, 60, 40] };
const WK_LSD_MIN = { full: [90, 110, 130, 80], half: [60, 75, 90, 50], "10k": [45, 55, 65, 40], "5k": [35, 40, 45, 30], none: [35, 40, 45, 30] };
const WK_LSD_CAP = { beg: 45, r30: 75, r60: 120, r120: 180 };

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
  indoor: { title: "실내 서킷", short: "실내", min: 40, color: "#8a5f00" },
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

// 풀코스 준비: 마라톤 페이스 런
const WK_RUNQ_MP = (p) => ({
  name: "마라톤 페이스 런",
  steps: ["이지 조깅 10분", `풀코스 목표 페이스로 ${[20, 30, 40, 15][p]}분`, "쿨다운 조깅 5분"],
  tip: "대회 날 달릴 속도를 몸에 새기는 훈련. 숨이 편해야 해요",
});

// ---------- 세션 만들기 ----------
// 각 운동 줄: { pool, idx(기본 선택), sets, kind } → 화면에서 실제 동작으로 바꿈
// w: 절대 주 번호(동작이 주마다 돌아가게), p: 4주 흐름 단계

function wkItem(pool, w, offset, sets) {
  return { pool: pool, idx: w + offset, sets: sets };
}

// 겹치지 않는 동작 고르기: used(이름→점수, 이번 주 2·지난주 1)가 가장 낮은 것을
// start 자리부터 차례로 찾음. picked는 이 세션에서 이미 고른 이름
function wkFresh(pool, start, used, picked, sets) {
  const list = wkPool(pool);
  if (!list.length) return { pool: pool, idx: 0, sets: sets };
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

// 헬스장 근력 세션: 메인(무겁게) → 보조 → 팔·코어. 메인 동작은 매주 같아서 무게를 늘려 가기 좋음
const WK_GYM_TITLE = { upper: "상체 (가슴·등) · 헬스장", lower: "하체 · 헬스장", upperB: "상체 (등·어깨) · 헬스장", full: "전신 · 헬스장", indoor: "유산소 + 서킷 · 헬스장" };
const WK_MAIN_TIP = "마지막 1~2회가 힘든 무게로. 모든 세트를 해내면 다음에 2.5kg(하체는 5kg) 올리기";
function wkBuildGym(type, w, p, dayNo) {
  const s = WK_PHASES[p].sets;
  const o = dayNo * 3;
  const t = WK_TYPES[type];
  const base = { type: type, title: WK_GYM_TITLE[type] || t.title, min: t.min, blocks: [] };
  const warm = { name: "준비 운동 7분", text: ["러닝머신 빠르게 걷기 또는 실내 자전거 5분", "팔·어깨·고관절 돌리기 각 10회", "메인 동작을 빈 봉(가벼운 무게)으로 1~2세트"] };
  const it = wkItem;
  if (type === "upper") {
    base.blocks = [warm,
      { name: "A. 메인: 가슴 밀기", rest: 150, tip: WK_MAIN_TIP, items: [it("gPushH", 0, 0, s + 1)] },
      { name: "B. 메인: 등 당기기", rest: 120, items: [it("gPullH", 0, 0, s)] },
      { name: "C. 슈퍼세트 (번갈아)", rest: 75, items: [it("gPullV", w, o, s), it("gPushV", w, o + 1, s)] },
      { name: "D. 팔 (번갈아)", opt: true, rest: 60, items: [it("gArms", w, o, Math.max(2, s - 1)), it("gArms", w, o + 1, Math.max(2, s - 1))] },
      { name: "E. 코어", opt: true, rest: 45, items: [it("gCore", w, o, Math.max(2, s - 1))] }];
  } else if (type === "lower") {
    base.blocks = [warm,
      { name: "A. 메인: 스쿼트", rest: 180, tip: WK_MAIN_TIP, items: [it("gSquat", 0, 0, s + 1)] },
      { name: "B. 힌지 (엉덩이·햄스트링)", rest: 150, items: [it("gHinge", w % 2, 0, s)] },
      { name: "C. 하체 보조 (번갈아)", rest: 75, items: [it("gLegAcc", w, o, s), it("gLegAcc", w, o + 1, s)] },
      { name: "D. 코어", opt: true, rest: 45, items: [it("gCore", w, o + 1, Math.max(2, s - 1))] }];
  } else if (type === "upperB") {
    base.blocks = [warm,
      { name: "A. 메인: 위로 당기기", rest: 120, tip: WK_MAIN_TIP, items: [it("gPullV", 0, 0, s + 1)] },
      { name: "B. 메인: 머리 위로 밀기", rest: 150, items: [it("gPushV", 0, 0, s)] },
      { name: "C. 슈퍼세트 (번갈아)", rest: 75, items: [it("gPullH", w, o + 1, s), it("gPushH", w, o + 1, s)] },
      { name: "D. 팔·어깨", opt: true, rest: 60, items: [it("gArms", w, o + 2, Math.max(2, s - 1)), it("gCore", w, o + 2, Math.max(2, s - 1))] }];
  } else if (type === "indoor") {
    const rounds = [3, 4, 4, 2][p];
    base.title = "유산소 + 서킷 · 헬스장";
    base.blocks = [
      { name: "A. 유산소 인터벌", cardio: true, text: [`로잉머신 또는 실내 자전거: 1분 세게 + 1분 천천히 × ${[8, 10, 10, 6][p]}회`], tip: "말하기 힘들 정도로 세게, 쉬는 1분은 아주 천천히" },
      { name: `B. 서킷 ${rounds}라운드 (라운드 끝 90초 휴식)`, rest: 90, circuit: rounds,
        items: [it("gSquat", w, o + 1, 1), it("gPullV", w, o, 1), it("gPushH", w, o + 2, 1), it("gCore", w, o, 1)] }];
  } else {
    // full (전신)
    base.blocks = [warm,
      { name: "A. 스쿼트", rest: 150, tip: WK_MAIN_TIP, items: [it("gSquat", w, o, s)] },
      { name: "B. 가슴 밀기", rest: 120, items: [it("gPushH", w, o, s)] },
      { name: "C. 당기기 슈퍼세트 (번갈아)", rest: 75, items: [it("gPullV", w, o, s), it("gPullH", w, o + 1, s)] },
      { name: "D. 힌지", rest: 120, items: [it("gHinge", w, o + 2, s)] },
      { name: "E. 코어", opt: true, rest: 45, items: [it("gCore", w, o + 2, Math.max(2, s - 1))] }];
  }
  return base;
}
const WK_STRENGTH_TYPES = ["upper", "lower", "upperB", "full", "indoor"];

function wkBuildSession(type, w, p, dayNo, used, fromRun, place) {
  if (place === "gym" && WK_STRENGTH_TYPES.indexOf(type) >= 0 && !fromRun) return wkAdapt(wkBuildGym(type, w, p, dayNo), p, w);
  const ph = WK_PHASES[p];
  const s = ph.sets;
  const t = WK_TYPES[type];
  const base = { type: type, title: t.title, min: t.min, blocks: [] };
  const warm = {
    name: "준비 운동 5분",
    text: ["팔·어깨 돌리기, 고관절 돌리기 각 10회",
      wkProfile.bar ? "데드 행 20초 + 스캐풀라 풀업(어깨만 들기) 8회" : "팔 벌려 뛰기 30초 + 고양이·소 자세 8회",
      "맨몸 스쿼트 10회 · 인치웜 5회"],
  };
  const o = dayNo * 3; // 같은 주 다른 날엔 다른 동작이 나오게

  if (type === "upper") {
    base.blocks = [
      warm,
      { name: "A. 슈퍼세트 (번갈아)", rest: 90, items: [wkItem("pullV", w, o, s), wkItem("pushH", w, o, s)] },
      { name: "B. 슈퍼세트 (번갈아)", rest: 75, items: [wkItem("pullH", w, o, s), wkItem("pushV", w, o, s)] },
      { name: "C. 팔·어깨 마무리", opt: true, rest: 45, items: [wkItem("arms", w, o, Math.max(2, s - 1)), wkItem("arms", w, o + 1, Math.max(2, s - 1))] },
      { name: "D. 코어", opt: true, rest: 45, items: [wkItem("core", w, o, Math.max(2, s - 1))] },
    ];
  } else if (type === "upperB") {
    const rounds = [3, 4, 4, 2][p];
    base.blocks = [
      warm,
      { name: "A. 턱걸이 집중", rest: 120, items: [wkItem("pullV", w, o + 2, s + 1)] },
      { name: `B. 서킷 ${rounds}라운드 (동작 사이 쉬지 않고, 라운드 끝에 휴식)`, rest: 90, circuit: rounds,
        items: [wkItem("combo", w, o, 1), wkItem("pullH", w, o + 1, 1), wkItem("pushH", w, o + 2, 1), wkItem("carry", w, o, 1)] },
      { name: "C. 코어", opt: true, rest: 45, items: [wkItem("core", w, o + 2, Math.max(2, s - 1))] },
    ];
  } else if (type === "lower") {
    base.blocks = [
      warm,
      { name: "A. 스쿼트", rest: 90, items: [wkItem("squat", w, o, s)] },
      { name: "B. 힌지 (엉덩이·햄스트링)", rest: 90, items: [wkItem("hinge", w, o, s)] },
      { name: "C. 폭발력", legs: true, rest: 60, items: [wkItem("power", w, o, s)] },
      { name: "D. 러너 보강 (번갈아)", opt: true, rest: 45, items: [wkItem("runner", w, o, Math.max(2, s - 1)), wkItem("core", w, o + 3, Math.max(2, s - 1))] },
    ];
  } else if (type === "full") {
    // 주마다 서킷 / EMOM 번갈아
    if (w % 2 === 0) {
      const rounds = [3, 4, 4, 2][p];
      base.blocks = [
        warm,
        { name: `서킷 ${rounds}라운드 (동작 사이 20초, 라운드 끝 90초 휴식)`, rest: 90, circuit: rounds,
          items: [wkItem("squat", w, o, 1), wkItem("pullV", w, o, 1), wkItem("hinge", w, o, 1), wkItem("pushH", w, o, 1), wkItem("power", w, o, 1), wkItem("core", w, o, 1)] },
        { name: "마무리", opt: true, rest: 45, items: [wkItem("carry", w, o, 2)] },
      ];
    } else {
      const mins = [12, 16, 16, 8][p];
      base.blocks = [
        warm,
        { name: `EMOM ${mins}분 — 매 분 시작할 때 아래 동작을 순서대로, 남는 시간은 휴식`, emom: mins, rest: 60,
          items: [wkItem("squat", w, o + 1, 1), wkItem("pullV", w, o + 1, 1), wkItem("pushH", w, o + 1, 1), wkItem("power", w, o + 1, 1)] },
        { name: "코어", opt: true, rest: 45, items: [wkItem("core", w, o + 1, 2), wkItem("runner", w, o + 1, 2)] },
      ];
    }
  } else if (type === "runQ" || type === "easy") {
    const tr = wkWeeksToRace(w);
    if (tr === 0 || tr === 1) p = 3; // 대회 주·직전 주는 회복 주 분량
  }
  if (type === "runQ") {
    const r = wkProfile.run === "beg"
      ? { name: "달리기·걷기 인터벌", steps: ["걷기 5분", `2분 달리기 + 1분 걷기 × ${[6, 7, 8, 5][p]}회 (마지막 2회는 조금 빠르게)`, "걷기 5분"], tip: "숨이 너무 차면 걷는 시간을 늘려도 괜찮아요" }
      : wkProfile.race === "full" && (w + dayNo) % 2 === 0 ? WK_RUNQ_MP(p)
      : WK_RUNQ[(w + dayNo) % WK_RUNQ.length](p);
    base.title = "포인트 러닝: " + r.name;
    base.blocks = [
      { name: "러닝 (" + r.name + ")", run: true, text: r.steps, tip: r.tip },
      { name: "러닝 후 코어 10분", rest: 30, items: [wkItem("core", w, o, 2), wkItem("runner", w, o + 2, 2)] },
    ];
  } else if (type === "easy") {
    let mins = (WK_EASY_MIN[wkProfile.run] || WK_EASY_MIN.r30)[p] + (wkProfile.race === "full" && wkProfile.run !== "r30" ? 10 : 0);
    const tr = wkWeeksToRace(w);
    if (tr === 0 || tr === 1) mins = Math.round((mins * 0.6) / 5) * 5; // 대회 주·직전 주는 짧게
    const strides = [4, 6, 6, 0][p];
    const text = wkProfile.run === "beg"
      ? [`1분 달리기 + 1분 걷기 × ${[10, 12, 14, 8][p]}회 — 대화가 가능한 속도`]
      : [`이지런 ${mins}분 — 대화가 가능한 편한 속도 (심박 존2)`];
    if (strides && wkProfile.run !== "beg") text.push(`마지막에 20초 가볍게 빠르게(스트라이드) × ${strides}회, 사이 걷기 40초`);
    base.blocks = [
      { name: "러닝", run: true, text: text, tip: "느리다 싶을 만큼 천천히. 이게 지구력의 바탕" },
      { name: "러너 보강 10분 (번갈아)", rest: 30, items: [wkItem("runner", w, o + 1, 2), wkItem("runner", w, o + 3, 2), wkItem("core", w, o + 4, 2)] },
    ];
  } else if (type === "lsd") {
    const pr = wkProfile;
    const beg = pr.run === "beg";
    const toRace = wkWeeksToRace(w);
    // 대회까지: 3주 전에 가장 길게, 2주 전부터 줄이기
    let scale = 1;
    let ph2 = p;
    if (toRace != null) {
      if (toRace > 12) scale = 0.85;
      else if (toRace === 3) ph2 = 2;
      else if (toRace === 2) scale = 0.65;
      else if (toRace === 1) scale = 0.45;
    }
    let mins = beg ? [30, 35, 40, 25][p] : Math.round(((WK_LSD_MIN[pr.race] || WK_LSD_MIN.none)[ph2] * scale) / 5) * 5;
    mins = Math.min(mins, WK_LSD_CAP[pr.run] || 60);
    const raceName = { full: "풀코스", half: "하프", "10k": "10km", "5k": "5km" }[pr.race];
    const text = beg
      ? [`${mins}분 동안 3분 달리기 + 1분 걷기 반복 — 아주 편하게`]
      : [`${mins}분 천천히 오래 — 이지런보다도 편하게`];
    if (!beg && ph2 === 2 && raceName && toRace !== 2 && toRace !== 1) text.push(`마지막 15분만 ${raceName} 목표 페이스로 올려 보기`);
    if (mins >= 75) text.push("60분 넘으면 물 + 에너지젤(또는 사탕) 챙기기");
    if (toRace === 2 || toRace === 1) text.push("대회가 다가와서 양을 줄이는 주예요 (테이퍼). 다리를 아껴요");
    if (toRace === 0) {
      base.title = "대회 주 🏁";
      mins = 20;
      text.length = 0;
      text.push(`이번 주는 대회 주! 🏁 ${raceName} 완주를 응원해요`, "대회 전날은 20분 조깅 + 스트라이드 4회만", "익숙한 신발·옷·보급, 새것은 쓰지 않기");
    }
    base.min = mins + 10;
    const lsdTip = toRace != null && toRace >= 0
      ? `대회까지 ${toRace}주 남았어요`
      : beg ? "쉬지 않고 30분 달리기가 첫 목표예요. 걷는 시간을 조금씩 줄여 가요"
        : raceName ? `${raceName}를 위해 4주 흐름에 맞춰 조금씩 늘려 가요` : "주말엔 길게, 편하게. 체력의 바탕이 돼요";
    base.blocks = [
      { name: "LSD", run: true, text: text, tip: lsdTip },
      { name: "끝나고 스트레칭 5분", text: ["종아리 · 허벅지 앞뒤 · 엉덩이 각 30초", "데드 행 30초 (허리 풀기)"] },
    ];
  } else if (type === "combo") {
    const rounds = [3, 4, 4, 2][p];
    base.blocks = [
      { name: "이지런 20분", run: true, text: [wkProfile.run === "beg" ? "1분 달리기 + 1분 걷기 × 10회" : "편한 속도로 20분 — 이게 워밍업 겸 유산소"], tip: "끝나고 바로 근력으로" },
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
    // 러닝 날을 바꾼 것(비 오는 날)인지, 원래 계획된 실내 컨디셔닝인지
    base.note = fromRun ? "비 오는 날 러닝 대신이에요. 이번 주와 지난주에 한 동작은 빼고 골랐어요."
      : "숨이 차게 하는 실내 서킷이에요. 이번 주와 지난주에 한 동작은 빼고 골랐어요.";
    base.title = fromRun ? "실내 근력 (러닝 대신)" : "실내 컨디셔닝 서킷";
    base.blocks = [
      warm,
      { name: `A. 서킷 ${rounds}라운드 (동작 사이 20초, 라운드 끝 90초 휴식)`, rest: 90, circuit: rounds,
        items: [wkFresh("squat", st, u, pk, 1), wkFresh("pullV", st, u, pk, 1), wkFresh("pushV", st, u, pk, 1), wkFresh("hinge", st, u, pk, 1)] },
      { name: `B. EMOM ${mins}분 — 홀수 분엔 첫 동작, 짝수 분엔 둘째 동작 (러닝처럼 숨차게)`, emom: mins, rest: 60,
        items: [wkFresh("power", st, u, pk, 1), wkFresh("combo", st, u, pk, 1)] },
      { name: "C. 러너 보강 + 코어 (번갈아)", opt: true, rest: 45,
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
        wkProfile.kb ? "가벼운 커틀벨로 할로 좌우 5바퀴" : "팔 크게 돌리기 앞뒤 10회",
      ] },
    ];
  }
  return wkAdapt(base, p, w);
}

// 유연성 목표일 때 끝에 붙이는 가동성 (돌아가며)
const WK_MOBILITY = [
  ["90/90 고관절 스트레칭 좌우 40초", "흉추 회전(옆으로 누워 책 펴기) 좌우 8회", "종아리 벽 스트레칭 좌우 30초"],
  ["월드 그레이티스트 스트레칭 좌우 5회", "고양이·소 자세 10회", "햄스트링 스트레칭 좌우 40초"],
  ["비둘기 자세 좌우 40초", "가슴 열기(문틀 스트레칭) 30초 × 2", "발목 돌리기·무릎 벽 대기 좌우 10회"],
];

// 할 수 있는 동작이 하나도 없을 때 대신 쓸 묶음
const WK_FALLBACK = { power: "runner", carry: "core", arms: "core", combo: "squat", pushV: "pushH", pullH: "pullV", pullV: "pullH" };

// 설정에 맞게 다듬기: 할 수 없는 동작은 대신하거나 빼기, 실력·운동 시간에 맞춰 세트·라운드 조절
function wkAdapt(base, p, w) {
  const pr = wkProfile;
  const toRace = wkWeeksToRace(w);
  const taper = toRace === 0 || toRace === 1; // 대회 주·직전 주는 가볍게
  const min = pr.minutes;
  const strength = !base.blocks.some((b) => b.run);
  const seen = {}; // 세션 전체에서 같은 동작은 한 번만
  base.blocks.forEach((b) => {
    if (!b.items) return;
    // 할 수 있는 동작이 없으면 비슷한 묶음으로, 이미 나온 동작이면 같은 묶음의 다음 동작으로
    if (taper && b.legs) b.items = [];
    b.items = b.items.filter((it) => {
      if (!wkPool(it.pool).length && WK_FALLBACK[it.pool]) it.pool = WK_FALLBACK[it.pool];
      const list = wkPool(it.pool);
      for (let k = 0; k < list.length; k++) {
        const i = (it.idx + k) % list.length;
        if (!seen[list[i].n]) {
          seen[list[i].n] = true;
          it.idx = i;
          return true;
        }
      }
      return false;
    });
    const long = min >= 90 ? 2 : min >= 60 ? 1 : 0; // 긴 운동이면 더
    const notRecov = p !== 3;
    const fat = wkHasGoal("fatloss") || wkHasGoal("cardio");
    if (b.rest) b.rest = Math.max(30, b.rest + (fat ? -15 : 0) + (pr.intensity === "hard" ? -10 : pr.intensity === "easy" ? 15 : 0));
    if (b.circuit) {
      b.circuit = Math.max(2, b.circuit + (min <= 20 ? -1 : 0) + (notRecov ? long : 0) + (pr.exp === "beg" ? -1 : 0)
        + (fat && notRecov ? 1 : 0) + (pr.intensity === "easy" ? -1 : 0));
      if (taper) b.circuit = 2;
      b.name = b.name.replace(/\d+라운드/, b.circuit + "라운드");
    } else if (b.emom) {
      b.emom = Math.max(6, Math.min(b.emom, min <= 20 ? 8 : min <= 30 ? 10 : b.emom) + (notRecov ? long * 4 : 0) + (fat && notRecov ? 2 : 0));
      b.name = b.name.replace(/EMOM \d+분/, "EMOM " + b.emom + "분");
    } else {
      b.items.forEach((it) => {
        let sets = it.sets;
        if (pr.exp === "beg") sets -= 1;
        if (pr.exp === "adv" && notRecov) sets += 1;
        if (pr.intensity === "hard" && notRecov) sets += 1;
        if (pr.intensity === "easy") sets -= 1;
        if (wkHasGoal("strength") && notRecov) sets += 1;
        if (min <= 20) sets = Math.min(sets, 2);
        if (notRecov) sets += long;
        it.sets = taper ? 2 : Math.min(6, Math.max(2, sets));
      });
    }
  });
  // 짧은 운동이면 덜 중요한 블록을 빼되, 남는 동작이 너무 적으면 둠
  if (min <= 30) {
    const core = base.blocks.filter((b) => !b.opt).reduce((n, b) => n + (b.items ? b.items.length : 0), 0);
    if (core >= 4 || !strength) base.blocks = base.blocks.filter((b) => !b.opt);
  }
  base.blocks = base.blocks.filter((b) => b.text || (b.items && b.items.length));
  // 유연성 목표: 끝에 가동성 5분 (회복일은 이미 가동성)
  if (wkHasGoal("mobility") && base.type !== "recovery" && base.type !== "lsd") {
    base.blocks.push({ name: "마무리 가동성 5분", text: WK_MOBILITY[(base.blocks.length + p) % WK_MOBILITY.length] });
  }
  if (strength && base.type !== "recovery") base.min = min;
  return base;
}

// 단계에 맞춰 횟수 글자 만들기 ("10~12회")
function wkRepsText(ex, p) {
  if (typeof ex.r === "string") return ex.r;
  const add = WK_PHASES[p].add + (wkProfile.exp === "beg" ? -2 : wkProfile.exp === "adv" ? 2 : 0);
  const isSec = ex.u.indexOf("초") === 0;
  const isDist = ex.u.indexOf("m") === 0;
  const plus = isSec || isDist ? add * 5 : add;
  const lo = Math.max(isSec || isDist ? 10 : 2, ex.r[0] + plus);
  const hi = Math.max(lo, ex.r[1] + plus);
  return (lo === hi ? lo : lo + "~" + hi) + ex.u;
}
