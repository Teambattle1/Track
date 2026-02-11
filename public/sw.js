/**
 * Service Worker for Offline Support
 *
 * Provides:
 * - Offline caching of static assets
 * - Network-first strategy for API calls
 * - Background sync with IndexedDB queue
 */

const STATIC_CACHE = 'static-v3';
const DYNAMIC_CACHE = 'dynamic-v3';
const DB_NAME = 'teamtrack-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-operations';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html'
];

// --- IndexedDB helpers for offline queue ---
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToQueue(operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ ...operation, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueuedOperations() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
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

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Intercept failed Supabase POST writes for offline queuing
  if (request.method === 'POST' && url.hostname.includes('supabase')) {
    event.respondWith(handleSupabaseWrite(request));
    return;
  }

  // Skip other cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Network-first for navigation requests (HTML pages)
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Cache-first for static assets
  event.respondWith(cacheFirstStrategy(request));
});

/**
 * Handle Supabase writes — queue on failure for background sync
 */
async function handleSupabaseWrite(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Network failed — queue the write for background sync
    try {
      const body = await request.clone().text();
      await addToQueue({
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: body
      });

      // Request background sync if available
      if (self.registration.sync) {
        await self.registration.sync.register('sync-game-data');
      }
    } catch (queueError) {
      // IndexedDB might not be available
    }

    // Return synthetic offline response
    return new Response(JSON.stringify({ error: 'Offline — queued for sync' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Cache-First Strategy
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    throw error;
  }
}

/**
 * Network-First Strategy
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    throw error;
  }
}

// Background Sync — flush queued operations from IndexedDB
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-game-data') {
    event.waitUntil(syncGameData());
  }
});

/**
 * Sync queued operations when connection restored
 */
async function syncGameData() {
  try {
    const queue = await getQueuedOperations();
    if (queue.length === 0) return;

    for (const op of queue) {
      try {
        const response = await fetch(op.url, {
          method: op.method,
          headers: op.headers,
          body: op.body
        });

        if (response.ok || (response.status >= 400 && response.status < 500)) {
          // Success or permanent client error — remove from queue
          await removeFromQueue(op.id);
        }
      } catch (fetchError) {
        // Still offline — stop processing, browser will retry sync later
        throw fetchError;
      }
    }

    // Notify all clients that sync is done
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', count: queue.length });
    });
  } catch (error) {
    throw error; // Tell browser to retry later
  }
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'QUEUE_OPERATION') {
    addToQueue(event.data.operation);
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192.png',
    badge: '/badge-72.png'
  };
  event.waitUntil(
    self.registration.showNotification('TeamTrack', options)
  );
});
