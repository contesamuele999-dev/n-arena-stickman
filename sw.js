const SCOPE_URL = new URL(self.registration.scope);
const CACHE_PREFIX = `n-arena:${SCOPE_URL.pathname}:`;
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const CORE_ASSETS = ['./', './index.html', './favicon.svg', './manifest.json'];
const CORE_URLS = new Set(CORE_ASSETS.map(path => new URL(path, SCOPE_URL).href));
const APP_SHELL = new URL('./index.html', SCOPE_URL).href;

self.addEventListener('install', event => {
  // A third-party font/CDN outage must not discard the entire offline shell.
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(CORE_ASSETS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key !== CACHE_NAME && (key.startsWith(CACHE_PREFIX) || key === 'n-arena-v1'))
    .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

function offlineResponse() {
  return new Response('Risorsa non disponibile offline.', {
    status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function fetchAndCache(request, navigation = false) {
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      if (navigation) await cache.put(APP_SHELL, response.clone());
    } catch (error) {
      console.warn('Cache update failed:', error);
    }
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;
  const sameScope = url.origin === SCOPE_URL.origin && url.pathname.startsWith(SCOPE_URL.pathname);
  const navigation = sameScope && request.mode === 'navigate';
  const optionalAsset = url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com' ||
    url.href === 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  if (!navigation && !CORE_URLS.has(url.href) && !optionalAsset) return;

  if (navigation) {
    // New deployments are visible on the first online navigation.
    event.respondWith(fetchAndCache(request, true).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(APP_SHELL)) || offlineResponse();
    }));
    return;
  }

  const fresh = fetchAndCache(request).catch(() => null);
  // Keep the worker alive until background refresh and cache writes finish.
  event.waitUntil(fresh);
  event.respondWith(caches.open(CACHE_NAME).then(async cache =>
    (await cache.match(request)) || (await fresh) || offlineResponse()));
});
