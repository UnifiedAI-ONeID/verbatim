

const CACHE_NAME = 'verbatim-v19'; // Incremented version to ensure SW update
const urlsToCache = [
  // App Shell
  '/',
  '/index.html',
  '/index.tsx',
  '/pip.tsx',
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

  // Strategy: Stale-While-Revalidate for all other assets.
  // This provides the speed of cache-first while keeping assets up-to-date.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If the fetch is successful, update the cache.
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          // The network request failed, possibly because the user is offline.
          // The cachedResponse will be used in this case (if it exists).
          console.warn('Network request failed, serving from cache if available.', event.request.url);
        });

        // Return the cached response immediately if it exists,
        // otherwise, wait for the network response.
        // This makes the app load instantly from cache while updating in the background.
        return cachedResponse || fetchPromise;
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
