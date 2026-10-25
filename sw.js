// =============================================
// 인터넷 없이도 열리게 (서비스 워커)
// - 앱 파일(index.html, style.css, *.js, 아이콘)을 휴대폰에 저장해 두고 신호가 없어도 바로 열림
// - 화면(index.html)은 인터넷이 되면 늘 새로 받고(새 버전 반영), 안 되면 저장해 둔 것
// - ?v=숫자가 붙은 파일은 버전마다 이름이 달라서 저장해 둔 것을 그대로 씀 (빠름)
// - 시세 예비 데이터(raw.githubusercontent.com의 JSON)는 인터넷이 되면 새로, 안 되면 마지막 것
// - 거래소 실시간 시세 같은 다른 주소는 건드리지 않음
// - 같은 저장소의 운동 앱(workout/)은 자기 서비스 워커가 따로 있어서 건드리지 않음
// 등록: common.js (sw.js?v=앱 버전 → 버전이 바뀌면 새로 설치되고 지난 저장분은 지움)
// =============================================

const SW_VERSION = new URL(self.location.href).searchParams.get("v") || "0";
const SW_CACHE = "household-app-v" + SW_VERSION;
const SW_DATA_CACHE = "household-data"; // 시세 예비 데이터 (버전과 상관없이 마지막 것)
const SW_PAGE_TIMEOUT_MS = 4000; // 화면을 새로 받는 데 이보다 오래 걸리면 저장해 둔 것으로

// 설치: index.html을 받아서 거기 적힌 ?v= 파일들을 모두 저장
self.addEventListener("install", function (event) {
  event.waitUntil(
    (async function () {
      const cache = await caches.open(SW_CACHE);
      const response = await fetch("./", { cache: "no-store" });
      const html = await response.clone().text();
      await cache.put("./", response);
      const files = new Set(["manifest.json", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png"]);
      html.replace(/(?:src|href)="([^"]+\?v=\d+)"/g, function (match, url) {
        if (!/^https?:/.test(url)) files.add(url);
        return match;
      });
      // 하나가 실패해도 나머지는 저장
      await Promise.all(
        Array.from(files).map(function (url) {
          return cache.add(url).catch(function () {});
        })
      );
      self.skipWaiting();
    })()
  );
});

// 새 버전이 켜지면 지난 버전 저장분 지우기
self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(function (name) {
            return name.indexOf("household-app-v") === 0 && name !== SW_CACHE;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
      await self.clients.claim();
    })()
  );
});

// 시간 안에 못 받으면 실패로
function swFetchWithTimeout(request, ms) {
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error("timeout"));
    }, ms);
    fetch(request).then(
      function (response) {
        clearTimeout(timer);
        resolve(response);
      },
      function (error) {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // 운동 앱은 건드리지 않음
  if (url.origin === self.location.origin && url.pathname.indexOf("/workout/") !== -1) return;

  // ① 화면: 인터넷 먼저 → 안 되면 저장해 둔 것
  if (request.mode === "navigate") {
    event.respondWith(
      (async function () {
        const cache = await caches.open(SW_CACHE);
        try {
          const response = await swFetchWithTimeout(request, SW_PAGE_TIMEOUT_MS);
          if (response.ok) cache.put("./", response.clone());
          return response;
        } catch (error) {
          return (await cache.match("./")) || Response.error();
        }
      })()
    );
    return;
  }

  // ② 같은 주소의 앱 파일
  if (url.origin === self.location.origin) {
    // 새 버전 확인 파일은 늘 인터넷으로 (저장하지 않음)
    if (url.pathname.endsWith("version.json")) return;
    event.respondWith(
      (async function () {
        const cache = await caches.open(SW_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && url.search.indexOf("v=") !== -1) cache.put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  // ③ 시세 예비 데이터 (data·quotes 가지의 JSON): 인터넷 먼저 → 안 되면 마지막에 받은 것
  if (url.hostname === "raw.githubusercontent.com" && url.pathname.endsWith(".json")) {
    // ?t=… 는 새로 받으려고 붙인 것이라 저장할 때는 뺀 주소로
    const key = url.origin + url.pathname;
    event.respondWith(
      (async function () {
        const cache = await caches.open(SW_DATA_CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(key, response.clone());
          return response;
        } catch (error) {
          return (await cache.match(key)) || Response.error();
        }
      })()
    );
  }
  // ④ 나머지(거래소 시세 등)는 그대로 인터넷으로
});
