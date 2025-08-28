// Service Worker pro PWA update detection - dle ZEN MCP doporučení

const CACHE_NAME = 'gate-control-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/build-info.json'
];

// Instalace service workeru
self.addEventListener('install', (event) => {
  console.log('🔧 SW: Installing service worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💾 SW: Caching files');
        return cache.addAll(urlsToCache);
      })
  );
  
  // Force nový service worker do waiting state
  self.skipWaiting();
});

// Aktivace service workeru
self.addEventListener('activate', (event) => {
  console.log('✅ SW: Activating service worker');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Převzít kontrolu nad všemi klienty
  return self.clients.claim();
});

// Fetch event handler
self.addEventListener('fetch', (event) => {
  // Speciální handling pro build-info.json - vždy fresh
  if (event.request.url.includes('build-info.json')) {
    event.respondWith(
      fetch(event.request, { 
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Standardní cache-first strategy pro ostatní soubory
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Message handler pro skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ SW: Skipping waiting, activating new version');
    self.skipWaiting();
  }
});