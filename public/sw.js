

const CACHE_NAME = 'verbatim-v1'; // START FRESH
const urlsToCache = [
  // App Shell
  '/',
  '/index.html',
  '/pip.html',
  '/manifest.json',
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
  '/ErrorBoundary.tsx',
  
  // Local assets (screenshots for PWA manifest)
  '/screenshots/screenshot-1-record-dark.svg',
  '/screenshots/screenshot-2-recording-dark.svg',
  '/screenshots/screenshot-3-sessions-dark.svg',
  '/screenshots/screenshot-4-detail-dark.svg',
  '/screenshots/screenshot-5-record-light.svg',
  '/screenshots/screenshot-6-detail-light.svg',
];

self.addEventListener('install', event => {
  console.log('[SW] Event: install');
  // Ensures the new SW activates immediately
  self.skipWaiting(); 

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Caching app shell for cache: ${CACHE_NAME}`);
        return cache.addAll(urlsToCache);
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
      // Take control of uncontrolled clients
      return self.clients.claim(); 
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  // Strategy: Network-only for API calls and external services
  const isApiCall = [
    'googleapis.com',
    'firebaseio.com',
    'openstreetmap.org',
    'cloudfunctions.net',
  ].some(host => requestUrl.hostname.includes(host));

  if (isApiCall) {
    event.respondWith(fetch(request));
    return;
  }
  
  // Strategy: Stale-While-Revalidate for all other assets
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            // If we get a valid response, update the cache
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(error => {
            console.warn(`[SW] Network request failed for ${requestUrl.href}. Serving from cache if available.`, error.message);
            if (!cachedResponse) {
                // If the fetch fails and we have nothing in cache, the promise rejection will bubble up,
                // resulting in a browser network error page, which is the desired behavior.
                throw error;
            }
          });

        // Return the cached response immediately if it exists,
        // while the network request runs in the background.
        // If not in cache, wait for the network response.
        return cachedResponse || fetchPromise;
      });
    })
  );
});