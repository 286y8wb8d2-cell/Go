// =============================================
// 비트코인 탭 — 거래소 사고 연표 (고정 데이터 + 그리기)
// 널리 알려진 거래소 해킹·파산 사례를 연도순으로 정리
// "거래소에 맡긴 코인은 내 코인이 아니다(Not your keys, not your coins)"를 기억하자는 뜻
// 금액은 사고 당시 보도 기준의 대략적인 값
// ※ 이름은 모두 btc~ / BTC~ 로 시작
// =============================================

// kind: "hack"(해킹) · "collapse"(파산·사기)
const BTC_INCIDENTS = [
  { date: "2014-02", name: "마운트곡스 (Mt. Gox)", country: "일본", kind: "collapse", loss: "약 85만 BTC", note: "당시 세계 최대 거래소. 오랫동안 코인이 새고 있었던 사실이 드러나 파산. 고객 상환은 10년 뒤에야 시작됨." },
  { date: "2015-01", name: "비트스탬프 (Bitstamp)", country: "유럽", kind: "hack", loss: "약 1.9만 BTC", note: "핫월렛(인터넷에 연결된 지갑) 해킹. 회사가 손실을 메움." },
  { date: "2016-08", name: "비트파이넥스 (Bitfinex)", country: "홍콩", kind: "hack", loss: "약 12만 BTC", note: "멀티시그 지갑 해킹. 2022년 미국 당국이 대부분을 찾아냄." },
  { date: "2017-04", name: "야피존", country: "한국", kind: "hack", loss: "약 3,800 BTC", note: "핫월렛 해킹으로 고객 자산의 약 37% 손실. 유빗으로 이름을 바꿈." },
  { date: "2017-12", name: "유빗", country: "한국", kind: "collapse", loss: "자산의 약 17%", note: "두 번째 해킹 뒤 파산 신청." },
  { date: "2018-01", name: "코인체크 (Coincheck)", country: "일본", kind: "hack", loss: "약 5억 3천만 달러 (NEM)", note: "당시 사상 최대 해킹. 일본 거래소 규제가 강화되는 계기." },
  { date: "2018-06", name: "코인레일", country: "한국", kind: "hack", loss: "약 400억 원 (알트코인)", note: "소형 거래소 해킹." },
  { date: "2018-06", name: "빗썸", country: "한국", kind: "hack", loss: "약 350억 원", note: "핫월렛 해킹. 고객 피해는 회사 자산으로 보상." },
  { date: "2018-09", name: "자이프 (Zaif)", country: "일본", kind: "hack", loss: "약 6천만 달러", note: "핫월렛 해킹." },
  { date: "2019-01", name: "쿼드리가CX (QuadrigaCX)", country: "캐나다", kind: "collapse", loss: "약 1억 9천만 캐나다달러", note: "대표가 갑자기 숨진 뒤 고객 자산을 꺼낼 수 없게 됨. 조사 결과 대표의 사기로 드러남." },
  { date: "2019-03", name: "빗썸", country: "한국", kind: "hack", loss: "약 140억 원 (EOS·XRP)", note: "내부자 연루 의심 사고." },
  { date: "2019-05", name: "바이낸스 (Binance)", country: "글로벌", kind: "hack", loss: "7,000 BTC", note: "비상 기금(SAFU)으로 고객 손실을 메움." },
  { date: "2019-11", name: "업비트", country: "한국", kind: "hack", loss: "이더리움 약 34만 개 (약 580억 원)", note: "핫월렛 해킹. 회사 자산으로 보상. 이후 북한 해킹 조직 소행으로 조사됨." },
  { date: "2020-09", name: "쿠코인 (KuCoin)", country: "글로벌", kind: "hack", loss: "약 2억 8천만 달러", note: "핫월렛 해킹. 상당 부분을 되찾음." },
  { date: "2022-11", name: "FTX", country: "바하마·미국", kind: "collapse", loss: "고객 자산 약 80억 달러 부족", note: "고객 돈을 계열사가 몰래 쓴 사실이 드러나 며칠 만에 파산. 대표는 사기죄로 실형." },
  { date: "2023-04", name: "지닥 (GDAC)", country: "한국", kind: "hack", loss: "약 180억 원", note: "핫월렛 해킹." },
  { date: "2024-05", name: "DMM 비트코인", country: "일본", kind: "hack", loss: "약 4,500 BTC", note: "해킹 뒤 결국 영업을 접음." },
  { date: "2024-07", name: "와지르엑스 (WazirX)", country: "인도", kind: "hack", loss: "약 2억 3천만 달러", note: "멀티시그 지갑 해킹. 1년 넘게 거래 중단." },
  { date: "2025-02", name: "바이비트 (Bybit)", country: "글로벌", kind: "hack", loss: "약 15억 달러 (이더리움)", note: "사상 최대 규모 해킹. 미국 FBI가 북한 해킹 조직 소행으로 발표." },
];

const btcIncidentList = document.getElementById("btc-incident-list");
const btcIncidentFilters = document.querySelectorAll("[data-btc-incident]");
let btcIncidentFilter = "all";

function renderBtcIncidents() {
  btcIncidentFilters.forEach(function (button) {
    button.setAttribute("aria-pressed", button.dataset.btcIncident === btcIncidentFilter ? "true" : "false");
  });
  btcIncidentList.innerHTML = "";
  let lastYear = null;
  // 최근 사고가 위로
  BTC_INCIDENTS.slice()
    .reverse()
    .filter(function (item) {
      if (btcIncidentFilter === "korea") return item.country === "한국";
      if (btcIncidentFilter === "hack" || btcIncidentFilter === "collapse") return item.kind === btcIncidentFilter;
      return true;
    })
    .forEach(function (item) {
      const year = item.date.slice(0, 4);
      if (year !== lastYear) {
        const yearLi = document.createElement("li");
        yearLi.className = "btc-incident-year";
        yearLi.textContent = year;
        btcIncidentList.appendChild(yearLi);
        lastYear = year;
      }
      const li = document.createElement("li");
      li.className = "btc-incident " + item.kind;
      const head = document.createElement("p");
      head.className = "btc-incident-head";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const badge = document.createElement("span");
      badge.className = "btc-incident-badge " + item.kind;
      badge.textContent = item.kind === "hack" ? "해킹" : "파산·사기";
      head.append(name, " ", badge);
      const meta = document.createElement("p");
      meta.className = "btc-incident-meta";
      meta.textContent = Number(item.date.slice(5, 7)) + "월 · " + item.country + " · 피해 " + item.loss;
      const note = document.createElement("p");
      note.className = "btc-incident-note";
      note.textContent = item.note;
      li.append(head, meta, note);
      btcIncidentList.appendChild(li);
    });
}

btcIncidentFilters.forEach(function (button) {
  button.addEventListener("click", function () {
    btcIncidentFilter = button.dataset.btcIncident;
    renderBtcIncidents();
  });
});

renderBtcIncidents();
