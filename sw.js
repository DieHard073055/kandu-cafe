// Offline support. Network first so a new deploy shows up straight away; the cache answers when there is no signal.
const CACHE = 'kandu-v1';
const FILES = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/config.js', 'js/data.js', 'js/logic.js', 'js/history.js', 'js/store.js', 'js/ui.js', 'js/charts.js', 'js/customer.js', 'js/manager.js', 'js/insights.js',
  'quotes/quote-rasheed.pdf', 'quotes/quote-malefresh.pdf', 'quotes/quote-hulhu.pdf'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
