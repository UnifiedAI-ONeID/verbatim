

const CACHE_NAME = 'verbatim-v24'; // Incremented version to ensure SW update
const urlsToCache = [
  // App Shell
  '/',
  '/index.html',
  // '/index.tsx', // Removed: This needs to be fetched from network to be transpiled
  // '/pip.tsx',   // Removed: This needs to be fetched from network to be transpiled
  '/pip.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',
  
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
  
  // External Dependencies
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap',
  'https://esm.sh/react@19.0.0-rc.0',
  'https://esm.sh/react-dom@19.0.0-rc.0/client',
  'https://esm.sh/@google/genai@1.28.0',
  'https://esm.sh/firebase@12.5.0/app',
  'https://esm.sh/firebase@12.5.0/auth',
  'https://esm.sh/firebase@12.5.0/firestore',
  'https://esm.sh/firebase@12.5.0/storage',
  'https://esm.sh/firebase@12.5.0/functions',
  'https://esm.sh/firebase@12.5.0/analytics',
  'https://esm.sh/marked@16.4.1'
];

self.addEventListener('install', event => {
  console.log('[SW] Event: install');
  self.skipWaiting(); // Ensures the new SW activates immediately

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Caching app shell for cache: ${CACHE_NAME}`);
        return cache.addAll(urlsToCache);
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
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  // Strategy: Network-only for API calls and dynamic scripts
  const isApiCall = [
    'googleapis.com',
    'firebaseio.com',
    'openstreetmap.org',
    'cloudfunctions.net',
  ].some(host => requestUrl.hostname.includes(host));

  const isDynamicScript = requestUrl.pathname === '/index.tsx' || requestUrl.pathname === '/pip.tsx';

  if (isApiCall || isDynamicScript) {
    // console.log(`[SW] Network-only strategy for: ${requestUrl.href}`);
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

  // Strategy: Stale-While-Revalidate for all other assets
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
