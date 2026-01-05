/**
 * Service Worker for Offline Support
 * 
 * Provides:
 * - Offline caching of static assets
 * - Network-first strategy for API calls
 * - Background sync for failed requests
 */

const CACHE_NAME = 'teamaction-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Cache-first for static assets
  event.respondWith(cacheFirstStrategy(request));
});

/**
 * Cache-First Strategy
 * Try cache first, fallback to network
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    
    throw error;
  }
}

/**
 * Network-First Strategy
 * Try network first, fallback to cache
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Network request failed, trying cache:', error);
    
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

// Background Sync for failed requests
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-game-data') {
    event.waitUntil(syncGameData());
  }
});

/**
 * Sync queued game data when connection restored
 */
async function syncGameData() {
  console.log('[ServiceWorker] Syncing queued game data...');
  
  // This is a placeholder - actual implementation would:
  // 1. Retrieve queued operations from IndexedDB
  // 2. Send them to server
  // 3. Clear queue on success
  
  try {
    // Example: const queue = await getQueuedOperations();
    // await Promise.all(queue.map(op => sendToServer(op)));
    console.log('[ServiceWorker] Sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
    throw error; // Retry later
  }
}

// Push notifications (future enhancement)
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192.png',
    badge: '/badge-72.png'
  };
  
  event.waitUntil(
    self.registration.showNotification('TeamAction', options)
  );
});
