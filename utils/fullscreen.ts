/**
 * Fullscreen utilities for mobile and tablet devices
 * Supports both Chrome (requestFullscreen) and Safari (webkitRequestFullscreen)
 */

/**
 * Request fullscreen mode
 * Supports Chrome, Safari, and other browsers
 */
export const requestFullscreen = async (): Promise<boolean> => {
  try {
    const elem = document.documentElement;

    // Chrome, Edge, Opera
    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
      return true;
    }
    
    // Safari (iOS/macOS)
    // @ts-ignore - Safari specific API
    if (elem.webkitRequestFullscreen) {
      // @ts-ignore
      await elem.webkitRequestFullscreen();
      return true;
    }
    
    // Firefox
    // @ts-ignore - Firefox specific API
    if (elem.mozRequestFullScreen) {
      // @ts-ignore
      await elem.mozRequestFullScreen();
      return true;
    }
    
    // IE/Edge legacy
    // @ts-ignore - IE specific API
    if (elem.msRequestFullscreen) {
      // @ts-ignore
      await elem.msRequestFullscreen();
      return true;
    }

    console.warn('[Fullscreen] Fullscreen API not supported on this browser');
    return false;
  } catch (error) {
    console.error('[Fullscreen] Error requesting fullscreen:', error);
    return false;
  }
};

/**
 * Exit fullscreen mode
 */
export const exitFullscreen = async (): Promise<boolean> => {
  try {
    // Chrome, Edge, Opera
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    }
    
    // Safari
    // @ts-ignore - Safari specific API
    if (document.webkitExitFullscreen) {
      // @ts-ignore
      await document.webkitExitFullscreen();
      return true;
    }
    
    // Firefox
    // @ts-ignore - Firefox specific API
    if (document.mozCancelFullScreen) {
      // @ts-ignore
      await document.mozCancelFullScreen();
      return true;
    }
    
    // IE/Edge legacy
    // @ts-ignore - IE specific API
    if (document.msExitFullscreen) {
      // @ts-ignore
      await document.msExitFullscreen();
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Fullscreen] Error exiting fullscreen:', error);
    return false;
  }
};

/**
 * Check if currently in fullscreen mode
 */
export const isFullscreen = (): boolean => {
  return !!(
    document.fullscreenElement ||
    // @ts-ignore - Safari specific
    document.webkitFullscreenElement ||
    // @ts-ignore - Firefox specific
    document.mozFullScreenElement ||
    // @ts-ignore - IE specific
    document.msFullscreenElement
  );
};

/**
 * Request fullscreen on mobile/tablet devices
 * Returns true if fullscreen was requested (doesn't wait for completion)
 */
export const requestFullscreenOnMobile = (): boolean => {
  const isMobileOrTablet = /mobile|tablet|ipad|android|iphone|ipod/i.test(navigator.userAgent) ||
                           (window.innerWidth < 1280 && 'ontouchstart' in window);
  
  if (isMobileOrTablet && !isFullscreen()) {
    // Use setTimeout to allow user interaction to complete first
    setTimeout(() => {
      requestFullscreen().then((success) => {
        if (success) {
          console.log('[Fullscreen] Entered fullscreen mode on mobile/tablet');
        }
      });
    }, 100);
    return true;
  }
  
  return false;
};

/**
 * Add event listener to request fullscreen on first user interaction
 * This is required by browsers - fullscreen must be triggered by user action
 */
export const setupFullscreenOnInteraction = (): void => {
  const isMobileOrTablet = /mobile|tablet|ipad|android|iphone|ipod/i.test(navigator.userAgent) ||
                           (window.innerWidth < 1280 && 'ontouchstart' in window);
  
  if (!isMobileOrTablet) {
    return;
  }

  let fullscreenRequested = false;

  const tryFullscreen = () => {
    if (fullscreenRequested || isFullscreen()) {
      return;
    }
    
    fullscreenRequested = true;
    requestFullscreen().then((success) => {
      if (success) {
        console.log('[Fullscreen] Entered fullscreen mode after user interaction');
        // Remove listeners after successful fullscreen
        document.removeEventListener('click', tryFullscreen);
        document.removeEventListener('touchstart', tryFullscreen);
        document.removeEventListener('keydown', tryFullscreen);
      } else {
        fullscreenRequested = false;
      }
    });
  };

  // Listen for first user interaction
  document.addEventListener('click', tryFullscreen, { once: true });
  document.addEventListener('touchstart', tryFullscreen, { once: true });
  document.addEventListener('keydown', tryFullscreen, { once: true });

  console.log('[Fullscreen] Waiting for user interaction to request fullscreen...');
};
