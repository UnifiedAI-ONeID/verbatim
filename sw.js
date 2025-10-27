

const CACHE_NAME = 'verbatim-v15';
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
  '/icons/icon-1536x1536.jpg',
  '/icons/icon-192x192-maskable.png',
  '/icons/icon-512x512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/screenshots/screenshot-1-record-dark.png',
  '/screenshots/screenshot-2-recording-dark.png',
  '/screenshots/screenshot-3-sessions-dark.png',
  '/screenshots/screenshot-4-detail-dark.png',
  '/screenshots/screenshot-5-record-light.png',
  '/screenshots/screenshot-6-detail-light.png',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll with a catch to prevent install failure if one resource fails
        return cache.addAll(urlsToCache).catch(err => {
            console.error('Failed to cache initial assets:', err);
        });
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a stream and can only be consumed once.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response.
            // This logic is updated to cache cross-origin resources (like CDN scripts and fonts)
            // by allowing 'opaque' responses. This is crucial for offline functionality.
            if (!response || (response.status !== 200 && response.type !== 'opaque')) {
              return response;
            }

            // Clone the response because it's also a stream.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(err => {
            // Network request failed, but we didn't have it in cache.
            // This is expected for some dynamic requests.
            console.warn('Fetch failed; no cache available for', event.request.url, err);
            // Optionally, return a fallback page here.
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});