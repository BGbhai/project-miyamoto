const CACHE_NAME = 'miyamoto-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './miyamoto.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

async function cacheIfValid(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

function isSameOriginGet(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

function isNavigationRequest(request) {
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    await cacheIfValid(request, response);
    return response;
  } catch (err) {
    const cache = await caches.open(CACHE_NAME);
    const fallback =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match('./')) ||
      (await cache.match('./index.html')) ||
      (await cache.match('./miyamoto.html'));
    return fallback || Response.error();
  }
}

async function handleAssetRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  const networkPromise = fetch(request)
    .then(async (response) => {
      await cacheIfValid(request, response);
      return response;
    })
    .catch(() => null);
  return cached || networkPromise || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!isSameOriginGet(request)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});
