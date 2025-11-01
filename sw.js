

const CACHE_NAME = 'verbatim-v17'; // Incremented version to ensure SW update
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/pip.tsx',
  '/pip.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',
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
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(urlsToCache).catch(err => {
            console.error('Failed to cache initial assets:', err);
        });
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Strategy: Network-only for all API calls to ensure data freshness.
  // This prevents caching of Firestore data, auth tokens, etc.
  const isApiCall = [
    'googleapis.com',
    'firebaseio.com',
    'openstreetmap.org',
    'cloudfunctions.net', // Catches Firebase Functions calls
  ].some(host => requestUrl.hostname.includes(host));

  if (isApiCall) {
    // For API calls, always go to the network.
    event.respondWith(fetch(event.request));
    return;
  }

  // Strategy: Cache-first for all other assets (app shell, fonts, styles, scripts).
  // This makes the app load instantly and work offline.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return from cache if available.
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise, fetch from the network.
      return fetch(event.request).then(networkResponse => {
        // Check for a valid response to cache.
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }

        // Clone and cache the new response.
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});


self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
