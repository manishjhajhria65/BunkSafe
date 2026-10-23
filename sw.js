// Bump this when you want to force-clear old caches
const CACHE = "bunksafe-v2";
const CORE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so your updates reach everyone), cache as offline fallback
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const host = new URL(req.url).hostname;
  if (host.indexOf("jsdelivr") !== -1 || host.indexOf("projectnaptha") !== -1) return; // OCR files: let the browser handle them
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
