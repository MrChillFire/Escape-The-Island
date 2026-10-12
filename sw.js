/* Escape The Island service worker.
   Network-first: online you always get the newest index.html; offline you get the last cached copy.
   Changing ANYTHING in this file (e.g. bump CACHE_NAME) is what makes browsers install a new worker,
   so bump it whenever you want to be sure every device refreshes. */
const CACHE_NAME = "escape-island-v3";

/* Built from the worker's own scope, so it works under /Escape-The-Island/ or anywhere else */
const SCOPE = self.registration.scope;
const FILES_TO_CACHE = ["", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"]
  .map((f) => new URL(f, SCOPE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      /* Add files one by one: a missing icon/manifest must NOT make the whole install fail
         (cache.addAll rejects if any file 404s, which leaves the OLD worker stuck in control forever) */
      Promise.all(
        FILES_TO_CACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.headers.has("range")) return; /* audio/video range requests: let the browser handle them */

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request, { cache: "no-cache" });
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {}));
        }
        return response;
      } catch (err) {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === "navigate") {
          const fallback = await caches.match(new URL("index.html", SCOPE).href);
          if (fallback) return fallback;
        }
        return Response.error();
      }
    })()
  );
});
