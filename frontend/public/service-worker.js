// Minimal service worker so Wisdom & Word qualifies as an installable PWA
// (required by PWABuilder / Bubblewrap / Amazon Appstore web-app wrappers).
// We keep it intentionally light — network-first for everything, no aggressive
// caching that could serve stale counsel or scripture.

const CACHE = "wisdom-word-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only GET requests are cached; never touch API calls, POSTs, or Stripe.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache same-origin static shell responses opportunistically
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});
