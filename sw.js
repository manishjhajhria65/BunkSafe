// BunkSafe service worker: open instantly from the saved copy, then check for a newer version.
const CACHE = "bunksafe-v7";
const CORE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's own cache so we always store the newest files
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => fetch(new Request(u, { cache: "reload" })).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchFresh(req, ms){
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  // no-cache = always ask GitHub whether the file changed (GitHub Pages otherwise lets phones reuse a copy for ~10 minutes)
  return fetch(req, { signal: ctl.signal, cache: "no-cache" }).finally(() => clearTimeout(t));
}

function tellPages(){
  return self.clients.matchAll({ includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage({ type: "bunksafe-updated" })));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== self.location.origin && !isFont) return;   // OCR downloads, libraries: leave to the browser
  const isPage = req.mode === "navigate" || /(^|\/)(index\.html)?$/.test(url.pathname);

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(cached => {
        const network = fetchFresh(req, 8000)
          .then(async res => {
            if (res && (res.ok || res.type === "opaque")){
              let changed = false;
              if (isPage && cached && res.ok){
                const [a, b] = await Promise.all([cached.clone().text(), res.clone().text()]);
                changed = a !== b;
              }
              await cache.put(req, res.clone());
              if (changed) await tellPages();
            }
            return res;
          })
          .catch(() => null);
        if (cached){ e.waitUntil(network); return cached; }   // instant answer from the saved copy
        return network.then(res => {
          if (res) return res;
          if (req.mode === "navigate") return cache.match("./index.html");
          return Response.error();
        });
      })
    )
  );
});
