// =============================================
// 인터넷이 없어도 열리게: 앱 파일을 폰에 저장해 두고 씀 (서비스 워커)
// - 화면(index.html): 인터넷 먼저, 안 되면 저장해 둔 것
// - 나머지 파일: 저장해 둔 것 먼저 (주소의 ?v=N이 바뀌면 새로 받고 예전 것은 지움)
// - version.json: 항상 인터넷으로 (새 버전 알림용)
// vendor/ 파일(3D 라이브러리·사람 모형)을 바꾸면 SW_CACHE 이름을 올림
// =============================================

const SW_CACHE = "workout-v1";
const SW_PRE = ["./", "manifest.json", "icons/apple-touch-icon.png", "icons/icon-192.png",
  "vendor/three.min.js", "vendor/GLTFLoader.js", "vendor/human.glb"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SW_CACHE).then((c) => c.addAll(SW_PRE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    // 지난 운동 앱 저장분만 지움 (같은 주소의 자산 앱 저장분 household-*은 건드리지 않음)
    .then((keys) => Promise.all(keys.filter((k) => k.indexOf("workout-") === 0 && k !== SW_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 같은 파일의 예전 버전(?v=N)은 지우고 새로 저장
async function swPut(req, res) {
  const c = await caches.open(SW_CACHE);
  const path = new URL(req.url).pathname;
  const keys = await c.keys();
  await Promise.all(keys.filter((k) => new URL(k.url).pathname === path && k.url !== req.url).map((k) => c.delete(k)));
  await c.put(req, res);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith("version.json")) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(SW_CACHE).then((c) => c.put("./", copy));
      }
      return res;
    }).catch(() => caches.match("./")));
    return;
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) swPut(req, res.clone());
    return res;
  })));
});

// 앱이 처음 열릴 때 이미 받은 파일들(서비스 워커가 생기기 전)도 저장해 달라고 보냄
self.addEventListener("message", (e) => {
  const urls = (e.data && e.data.cache) || [];
  e.waitUntil(Promise.all(urls.map((u) => caches.match(u).then((hit) => hit || fetch(u).then((res) => {
    if (res.ok) return swPut(new Request(u), res);
  }).catch(() => {})))));
});
