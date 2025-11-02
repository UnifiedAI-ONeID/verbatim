

const CACHE_NAME = 'verbatim-v25'; // Incremented version to ensure SW update
const urlsToCache = [
  // App Shell
  '/',
  '/index.html',
  '/pip.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',

  // Local TS/TSX source files for offline functionality
  '/index.tsx',
  '/pip.tsx',
  '/components.tsx',
  '/config.ts',
  '/contexts.tsx',
  '/hooks.ts',
  '/services.ts',
  '/styles.ts',
  '/types.ts',
  
  // Local assets
  '/icons/icon-16x16.png',
  '/icons/icon-32x32.png',
  '/icons/icon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/icon-192x192-maskable.png',
  '/icons/icon-512x512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/screenshots/screenshot-1-record-dark.svg',
  '/screenshots/screenshot-2-recording-dark.svg',
  '/screenshots/screenshot-3-sessions-dark.svg',
  '/screenshots/screenshot-4-detail-dark.svg',
  '/screenshots/screenshot-5-record-light.svg',
  '/screenshots/screenshot-6-detail-light.svg',
  
  // External Dependencies from CDN
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/client',
  'https://aistudiocdn.com/@google/genai@^1.28.0',
  'https://aistudiocdn.com/firebase@^12.5.0/app',
  'https://aistudiocdn.com/firebase@^12.5.0/auth',
  'https://aistudiocdn.com/firebase@^12.5.0/firestore',
  'https://aistudiocdn.com/firebase@^12.5.0/storage',
  'https://aistudiocdn.com/firebase@^12.5.0/functions',
  'https://aistudiocdn.com/firebase@^12.5.0/analytics',
  'https://aistudiocdn.com/marked@^16.4.1'
];

self.addEventListener('install', event => {
  console.log('[SW] Event: install');
  self.skipWaiting(); // Ensures the new SW activates immediately

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Caching app shell for cache: ${CACHE_NAME}`);
        // Use a Set to prevent duplicates and addAll
        const uniqueUrlsToCache = [...new Set(urlsToCache)];
        return Promise.all(
          uniqueUrlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`[SW] Failed to cache ${url}:`, error);
            });
          })
        );
      })
      .then(() => {
        console.log('[SW] All app shell assets cached successfully.');
      })
      .catch(error => {
        console.error('[SW] App shell caching failed:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Event: activate');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Old caches cleared. Now ready to handle fetches.');
      return self.clients.claim(); // Take control of uncontrolled clients
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  console.log(`[SW] Intercepting fetch for: ${requestUrl.pathname}`);

  if (request.method !== 'GET') {
    return;
  }

  // Strategy: Network-only for API calls
  const isApiCall = [
    'googleapis.com',
    'firebaseio.com',
    'openstreetmap.org',
    'cloudfunctions.net',
  ].some(host => requestUrl.hostname.includes(host));

  if (isApiCall) {
    event.respondWith(
      fetch(request)
        .catch(error => {
          console.error(`[SW] Network fetch failed for (Network-only): ${requestUrl.href}`, error);
          return new Response(JSON.stringify({ error: 'offline' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
    return;
  }

  // Strategy: Stale-While-Revalidate for all other assets (including TSX/TS files)
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(error => {
            console.warn(`[SW] Network request failed for ${requestUrl.href}. Serving from cache if available.`, error.message);
            // If the fetch fails and we don't have a cached response, the promise rejection will bubble up 
            // and result in a browser network error, which is the desired behavior.
            if (!cachedResponse) {
                throw error;
            }
          });

        // Return the cached response immediately if it exists,
        // otherwise, wait for the network response.
        return cachedResponse || fetchPromise;
      });
    })
  );
});
