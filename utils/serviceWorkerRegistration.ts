/**
 * Service Worker Registration
 * 
 * Registers the service worker for offline support and handles updates
 */

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[SW] Service Worker registered successfully:', registration.scope);

      // Check for updates on page load
      registration.update();

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, prompt user to refresh
              console.log('[SW] New version available! Please refresh.');
              
              // Optional: Show update notification to user
              if (confirm('A new version is available. Refresh to update?')) {
                window.location.reload();
              }
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.error('[SW] Service Worker registration failed:', error);
      return undefined;
    }
  } else {
    console.warn('[SW] Service Workers are not supported in this browser');
    return undefined;
  }
};

export const unregisterServiceWorker = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    return registration.unregister();
  }
  return false;
};

/**
 * Request background sync permission (for queued operations)
 */
export const requestBackgroundSync = async (tag: string): Promise<void> => {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(tag);
      console.log('[SW] Background sync registered:', tag);
    } catch (error) {
      console.error('[SW] Background sync failed:', error);
    }
  }
};
