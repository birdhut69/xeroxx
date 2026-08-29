const CACHE_NAME = 'cipherprint-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) return;
  
  // Never intercept or cache API or WebSocket requests
  if (request.url.includes('/api/') || request.url.includes('/ws')) return;

  // Network-First for Navigation (HTML pages) to ensure users always receive the latest deployment
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Cache-First for static assets (fonts, icons, images)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Avoid caching text/html when JS/CSS was requested
        const contentType = response.headers.get('content-type') || '';
        if (request.url.endsWith('.js') && !contentType.includes('javascript')) {
          return response;
        }
        if (request.url.endsWith('.css') && !contentType.includes('css')) {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          try {
            cache.put(request, copy);
          } catch (e) {
            // Ignore quota or scheme errors
          }
        });

        return response;
      });
    })
  );
});
