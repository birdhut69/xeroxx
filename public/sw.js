const CACHE_NAME = 'cipherprint-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

const DB_NAME = 'cipherprint_shared_db';
const STORE_NAME = 'shared_files';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedFiles(files) {
  if (!files || files.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  for (const file of files) {
    if (!file || typeof file.arrayBuffer !== 'function') continue;
    const buffer = await file.arrayBuffer();
    const entry = {
      id: `SHARED-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: file.name || 'Shared_Document.pdf',
      type: file.type || 'application/pdf',
      size: file.size || buffer.byteLength,
      buffer,
      timestamp: Date.now(),
    };
    store.put(entry);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

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
  const url = new URL(request.url);

  // ── 1. Web Share Target API Interceptor (WhatsApp / Android Direct Share) ──
  if (request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await request.formData();
          const files = formData.getAll('documents');
          await saveSharedFiles(files);
          return Response.redirect('/?shared=true', 303);
        } catch (err) {
          console.error('[SW Share Target] Error receiving shared files:', err);
          return Response.redirect('/', 303);
        }
      })()
    );
    return;
  }

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
