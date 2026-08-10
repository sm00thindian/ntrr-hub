const CACHE_NAME = "ntrr-static-v4";

// Only cache stable public assets — never Next.js build chunks (they change every compile).
// Paths must match files in /public (png icons, not svg).
const STATIC_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

function isCacheableAsset(pathname) {
  if (pathname.startsWith("/_next/")) {
    return false;
  }
  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    return false;
  }
  return STATIC_ASSETS.includes(pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept navigations or HTML — auth and RSC depend on fresh responses.
  if (event.request.mode === "navigate" || event.request.headers.get("accept")?.includes("text/html")) {
    return;
  }

  if (!isCacheableAsset(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});