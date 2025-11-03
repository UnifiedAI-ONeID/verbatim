

const CACHE_NAME = 'verbatim-v30'; // Incremented version for the full rebuild
const urlsToCache = [
  // App Shell
  '/',
  '/index.html',
  '/pip.html',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png', // Added for iOS home screen
  '/icon-512x512.png',     // Added for PWA splash screen & manifest

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
  '/screenshots/screenshot-1-record-dark.svg',
  '/screenshots/screenshot-2-recording-dark.svg',
  '/screenshots/screenshot-3-sessions-dark.svg',
  '/screenshots/screenshot-4-detail-dark.svg',
  '/screenshots/screenshot-5-record-light.svg',
  '/screenshots/screenshot-6-detail-light.svg',
  
  // Only cache stable, non-version-ranged external assets
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap'
];

self.addEventListener('install', event => {
  console.log('[SW] Event: install');
  self.skipWaiting(); // Ensures the new SW activates immediately

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Caching app shell for cache: ${CACHE_NAME}`);
        const uniqueUrlsToCache = [...new Set(urlsToCache)];
        
        // Robust caching: fetch and validate before putting into cache
        const cachingPromises = uniqueUrlsToCache.map(urlToCache => {
          // Use 'reload' to bypass the HTTP cache and ensure we get a fresh response from the network
          return fetch(new Request(urlToCache, { cache: 'reload' }))
            .then(response => {
              if (!response.ok) {
                throw new Error(`[SW] Request for ${urlToCache} failed with status ${response.status}`);
              }

              // CRITICAL FIX: Prevent caching incorrect content types.
              // This stops the service worker from caching the index.html fallback for a script request.
              const isScript = /\.(tsx|ts|js)$/.test(urlToCache);
              const contentType = response.headers.get('content-type');
              if (isScript && contentType && contentType.includes('text/html')) {
                console.error(`[SW] Refusing to cache HTML response for script: ${urlToCache}`);
                // Skip caching this problematic file. The browser will fetch it from the network.
                return Promise.resolve();
              }

              console.log(`[SW] Caching valid response for: ${urlToCache}`);
              return cache.put(urlToCache, response);
            })
            .catch(error => {
              console.warn(`[SW] Failed to cache ${urlToCache}:`, error);
            });
        });

        return Promise.all(cachingPromises);
      })
      .then(() => {
        console.log('[SW] All app shell assets cached successfully (with validation).');
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
  
  // Only log GET requests to keep the console cleaner
  if (request.method === 'GET') {
    // console.log(`[SW] Intercepting fetch for: ${requestUrl.pathname}`);
  }

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