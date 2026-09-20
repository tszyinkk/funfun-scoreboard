const CACHE_NAME = "funfun-scoreboard-v55";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=55",
  "./sports-rule-engine.js?v=55",
  "./mahjong-core.js?v=55",
  "./mahjong-hand-analyzer.js?v=55",
  "./big-two-core.js?v=55",
  "./app.js?v=55",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/icons/lucide/house.svg",
  "./assets/icons/lucide/undo-2.svg",
  "./assets/icons/lucide/sliders-horizontal.svg",
  "./assets/icons/lucide/play.svg",
  "./assets/icons/lucide/pause.svg",
  "./assets/icons/lucide/timer-reset.svg",
  "./assets/icons/lucide/refresh-cw.svg",
  "./assets/icons/lucide/trash.svg",
  "./assets/icons/lucide/trophy.svg",
  "./assets/icons/lucide/flag.svg",
  "./assets/icons/lucide/check.svg",
  "./assets/icons/lucide/skip-forward.svg",
  "./assets/icons/lucide/pencil.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    })),
  );
});
