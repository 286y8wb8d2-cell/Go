# 작업 안내 (새 채팅에서 이어서 작업할 때 먼저 읽기)

개인 자산 관리 웹앱 "나의 자산". 사용자는 코딩 초보이며 **한국어로, 쉬운 말로** 설명한다.
아이폰 홈 화면 앱으로 써서 확인하고 결과만 보고 피드백하는 방식이라, 맡긴 일은 처음부터 끝까지 스스로 판단해 진행한다.

## 기본
- 순수 HTML/CSS/JS, 서버 없음, 데이터는 localStorage. 빌드 도구 없음.
- 배포: `main`에 push하면 GitHub Pages(https://286y8wb8d2-cell.github.io/Go/)에 반영.
- 탭: 홈 · 가계부 · 금융자산 · 비트코인 · 시나리오. 기능 설명은 README.md, 기획은 APP_PLAN.md · BTC_PLAN.md.

## 꼭 지킬 것
- **개인 금융 정보(월급·대출·보유 수량·백업 파일)는 저장소에 절대 넣지 않는다.** 공개 저장소다.
  사용자 숫자가 필요하면 백업 형식 JSON을 임시 폴더에 만들어 파일로 전달하고, 앱의 "불러오기"로 넣게 한다.
  (형식: `{ "app": "household-ledger", "version": 1, "exportedAt": ..., "data": { "<localStorage 키>": ... } }` — 들어 있는 키만 덮어씀)
- **파일을 고치면 버전을 올린다:** index.html의 모든 `?v=N`, `<html data-version="N">`, 푸터 "앱 버전 vN", version.json. (휴대폰 캐시 때문에 필수 — 지금 v42)
- 모든 JS가 전역에서 이름을 같이 쓴다. 파일마다 접두어(asset~, crypto~, btc~, market~, budget~, dash~, history~, scenario~, sim~, backup~)를 지키고,
  커밋 전에 겹치는 이름이 없는지 확인한다:
  `for f in *.js; do grep -oE "^(function|const|let|var) [A-Za-z_$][A-Za-z0-9_$]*" "$f" | awk '{print $2}'; done | sort | uniq -d` (출력이 없어야 함)
- 새 localStorage 키를 백업에 넣으려면 backup.js의 `BACKUP_ITEMS`(목록) 또는 `BACKUP_SETTINGS_KEYS`(설정)에 추가.
- 색: 오르면 빨강(--up), 내리면 파랑(--down). 차트 범주 색은 #2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #6250d6 #e34948 순서로 고정.
- 차트는 라이브러리 없이 SVG로 직접 그린다 (`createSvg` in history.js).

## 구조 메모
- 작은 탭: `setupSubTabs(group, default)` (common.js) + `data-subtab="group:view"` / `data-subtab-panel="group:view"`. 비트코인 탭만 btc.js의 `data-btc-view`.
- 신호: `data-saved {key}`, `tab-shown`, `market-updated`, `btc-price-updated` 등 — 다른 탭이 듣고 다시 그림.
- 브라우저에서 못 부르는 시세(야후 등, CORS)는 GitHub Actions(`.github/workflows/btc-data.yml`, 6시간마다)가
  `scripts/*.mjs`로 받아 `data` 가지에 `btc-data.json`, `market-data.json`으로 올리고 앱이 raw.githubusercontent.com에서 읽음.
  개인정보 때문에 내 종목만이 아니라 넓은 종목 목록을 받는다 (목록: `scripts/market-symbols.mjs`).
- 빠른 시세: `.github/workflows/quotes.yml`이 평일 15분마다 시작해 2분마다 `scripts/fetch-quotes.mjs` → `quotes` 가지의 `quotes.json`. 앱(market.js)이 1분마다 확인해 합침.
- 실시간 비트코인 시세는 거래소 WebSocket(업비트·빗썸·바이낸스·코인베이스).
- 아이폰 홈 화면 앱은 사파리와 저장 공간이 따로다 (홈 화면에 다시 추가하면 데이터가 비어 보임 → 내보내기/불러오기).

## 확인 방법
- `python3 -m http.server 8765` 후 Playwright(크로미움 설치돼 있음, 375×812 화면)로 각 탭을 열어 콘솔 오류와 가로 넘침을 확인.
  외부 API는 `page.route`로 가짜 응답을 넣어 테스트한다.
