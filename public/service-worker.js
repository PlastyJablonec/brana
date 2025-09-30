// Service Worker pro PWA update detection - dle ZEN MCP doporučení

const CACHE_NAME = 'gate-control-v1';
const urlsToCache = [
  '/',
  '/build-info.json'
  // Statické soubory se načtou dynamicky když existují
];

// Instalace service workeru s error handling
self.addEventListener('install', (event) => {
  console.log('🔧 SW: Installing service worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💾 SW: Caching files');
        
        // KRITICKÁ OPRAVA: Cache files jednotlivě s error handling
        const cachePromises = urlsToCache.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              return cache.put(url, response);
            } else {
              console.warn(`⚠️ SW: Failed to cache ${url} - status ${response.status}`);
              return null;
            }
          } catch (error) {
            console.error(`❌ SW: Error caching ${url}:`, error);
            return null;
          }
        });
        
        // NOVÉ: Pokračuj i když některé soubory selžou
        return Promise.allSettled(cachePromises).then(results => {
          const failed = results.filter(r => r.status === 'rejected').length;
          const succeeded = results.filter(r => r.status === 'fulfilled').length;
          console.log(`💾 SW: Cache results: ${succeeded} succeeded, ${failed} failed`);
          
          // Instalace úspěšná i když některé soubory selhaly
          return Promise.resolve();
        });
      })
      .catch(error => {
        console.error('❌ SW: Cache installation failed:', error);
        // Pokračuj i při selhání cache - service worker funguje bez cache
        return Promise.resolve();
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
  // Síť → cache strategie pro navigace (HTML) kvůli čerstvému indexu
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-store'
          }
        });

        // Aktualizuj cache pro offline fallback, ale ignoruj chyby
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone()).catch(() => {});
        }).catch(() => {});

        return networkResponse;
      } catch (error) {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.match('/');
      }
    })());
    return;
  }

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

        // OPRAVA: Pro unknown routes (ty s ?t=timestamp), zkus fetch s graceful fallback
        return fetch(event.request).catch((error) => {
          console.log('⚠️ SW: Fetch failed for:', event.request.url);

          // Pro query stringy s cache busting (?t=timestamp), ignoruj chybu
          if (event.request.url.includes('?t=') || event.request.url.includes('cache=')) {
            console.log('🔄 SW: Cache busting request failed, ignoring');
            return new Response('{}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Pro ostatní routes, vyhoď error místo 503
          throw error;
        });
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
