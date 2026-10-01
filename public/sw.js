/* BookNest Service Worker
 * キャッシュ戦略
 *  - /_next/static/*        : Cache First（ビルドごとにファイル名が変わるため安全）
 *  - /api/files/*           : Cache First（アップロード画像は不変）
 *  - 外部の書影画像          : Stale While Revalidate
 *  - OCR エンジン（CDN）     : Cache First（2回目以降はオフラインでも OCR 可能に）
 *  - ページ遷移・RSC        : Network First → キャッシュ → /offline
 *    （本棚・本詳細・読書記録・フレーズなど一度開いたページはオフラインでも閲覧可能）
 *  - POST（Server Actions） : キャッシュしない
 */
const VERSION = "v1";
const STATIC = `booknest-static-${VERSION}`;
const PAGES = `booknest-pages-${VERSION}`;
const IMAGES = `booknest-images-${VERSION}`;
const CDN = `booknest-cdn-${VERSION}`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];
const MAX_PAGES = 80;
const MAX_IMAGES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("booknest-") && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") {
    cache.put(request, res.clone());
    if (max) trim(cacheName, max);
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok || res.type === "opaque") {
        cache.put(request, res.clone());
        trim(cacheName, max);
      }
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") {
      cache.put(request, res.clone());
      trim(PAGES, MAX_PAGES);
    }
    return res;
  } catch {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    if (isNavigation) {
      const offline = await cache.match("/offline");
      if (offline) return offline;
    }
    return new Response("offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(request, STATIC));
      return;
    }
    if (url.pathname.startsWith("/api/files/")) {
      event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES));
      return;
    }
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/webpack-hmr")) return;
    if (request.mode === "navigate") {
      event.respondWith(networkFirst(request, true));
      return;
    }
    if (request.headers.get("RSC") === "1") {
      event.respondWith(networkFirst(request, false));
      return;
    }
    return;
  }

  // 外部：書影画像
  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGES, MAX_IMAGES));
    return;
  }
  // 外部：OCR エンジン（tesseract.js の worker / core / 言語データ）
  if (url.hostname === "cdn.jsdelivr.net" && /tesseract|@tesseract\.js-data/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, CDN));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
