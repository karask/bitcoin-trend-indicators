const SHELL = "crypto-regime-shell-v6";
const ASSETS = ["/", "/stocks/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== SHELL).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  const fallback = url.pathname === "/stocks" || url.pathname.startsWith("/stocks/") ? "/stocks/" : "/";
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(response => response ?? caches.match(fallback))));
});
