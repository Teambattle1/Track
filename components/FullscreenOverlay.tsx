import React, { useEffect, useState } from 'react';

const FullscreenOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [deviceType, setDeviceType] = useState<'iphone' | 'ipad' | 'android' | null>(null);
  const [browser, setBrowser] = useState<'safari' | 'chrome' | 'other'>('other');

  useEffect(() => {
    // Detect device and browser
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;

    // Detect iOS
    const isIPhone = /iPhone|iPod/.test(ua);
    const isIPad =
      /iPad/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOS = isIPhone || isIPad;

    // Detect Android
    const isAndroid = /android/i.test(ua);

    const isMobileOrTablet =
      isIOS ||
      isAndroid ||
      /webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua) ||
      (window.matchMedia && window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches);

    // Detect browser
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isChrome = /Chrome|CriOS/.test(ua);

    // Check if already in fullscreen or standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    const isFullscreen = () => {
      return !!(
        (document as any).fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
    };

    const fullscreenEnabled =
      (document as any).fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled;

    // Determine what to show
    const init = () => {
      // Skip if not mobile/tablet
      if (!isMobileOrTablet) {
        return;
      }

      // Skip if already in standalone/fullscreen mode
      if (isStandalone || isFullscreen()) {
        return;
      }

      // Skip if user already dismissed this session
      if (sessionStorage.getItem('fullscreenDismissed') === 'true') {
        return;
      }

      // Determine browser type
      let detectedBrowser: 'safari' | 'chrome' | 'other' = 'other';
      if (isSafari) detectedBrowser = 'safari';
      else if (isChrome) detectedBrowser = 'chrome';
      setBrowser(detectedBrowser);

      // iOS devices - Show Add to Home Screen (works best in Safari)
      if (isIPhone) {
        setDeviceType('iphone');
        setIsVisible(true);
      } else if (isIPad) {
        setDeviceType('ipad');
        setIsVisible(true);
      }
      // Android with Fullscreen API support
      else if (isAndroid && fullscreenEnabled) {
        setDeviceType('android');
        setIsVisible(true);
      }
    };

    const timer = setTimeout(init, 100);
    return () => clearTimeout(timer);
  }, []);

  const requestFullscreen = () => {
    const elem = document.documentElement;

    if (elem.requestFullscreen) {
      elem.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).mozRequestFullScreen) {
      (elem as any).mozRequestFullScreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }

    // Try to lock orientation
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait-primary').catch(() => {
        // Orientation lock not supported or failed
      });
    }

    hideOverlay();
  };

  const hideOverlay = () => {
    setIsVisible(false);
    sessionStorage.setItem('fullscreenDismissed', 'true');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col justify-center items-center z-[99999] text-white text-center p-5">
      <div className="text-6xl mb-5">📱</div>

      {/* iPhone - Add to Home Screen */}
      {deviceType === 'iphone' && (
        <>
          <div className="text-2xl font-bold mb-2.5">Add to Home Screen</div>
          <div className="text-base opacity-80 max-w-xs mb-5">
            Install for the best fullscreen experience
          </div>

          <div className="bg-white/10 rounded-xl p-5 mb-5 max-w-80">
            <div className="flex items-center mb-3 text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">📤</span>
              <span className="font-semibold">Tap Share button</span>
            </div>
            <div className="text-left text-xs opacity-70 mb-3">
              (Bottom center or top right depending on iPhone model)
            </div>
            <div className="flex items-center mb-3 text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">➕</span>
              <span>Tap "Add to Home Screen"</span>
            </div>
            <div className="flex items-center text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">🚀</span>
              <span>Open from Home Screen</span>
            </div>
          </div>
        </>
      )}

      {/* iPad - Add to Home Screen */}
      {deviceType === 'ipad' && (
        <>
          <div className="text-2xl font-bold mb-2.5">Add to Home Screen</div>
          <div className="text-base opacity-80 max-w-xs mb-5">
            Install for the best fullscreen experience
          </div>

          <div className="bg-white/10 rounded-xl p-5 mb-5 max-w-80">
            <div className="flex items-center mb-3 text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">📤</span>
              <span className="font-semibold">Tap Share button</span>
            </div>
            <div className="text-left text-xs opacity-70 mb-3">
              (Top right corner - looks like a box with an arrow)
            </div>
            <div className="flex items-center mb-3 text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">➕</span>
              <span>Tap "Add to Home Screen"</span>
            </div>
            <div className="flex items-center mb-3 text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">💾</span>
              <span>Tap "Add" to confirm</span>
            </div>
            <div className="flex items-center text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">🚀</span>
              <span>Open from Home Screen</span>
            </div>
          </div>
        </>
      )}

      {/* Android - Fullscreen button or Chrome Install */}
      {deviceType === 'android' && (
        <>
          <div className="text-2xl font-bold mb-2.5">Fullscreen Experience</div>
          <div className="text-base opacity-80 max-w-xs mb-5">
            Tap below for immersive gameplay
          </div>

          <div className="bg-white/10 rounded-xl p-5 mb-5 max-w-80">
            <div className="flex items-center text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">⛶</span>
              <span>Android: Tap "Go Fullscreen" or use menu to Install App</span>
            </div>
          </div>

          <button
            onClick={requestFullscreen}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 font-bold text-lg rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform mb-3"
          >
            ⛶ Go Fullscreen
          </button>
        </>
      )}

      {/* Dismiss button */}
      <button
        onClick={hideOverlay}
        className="mt-4 bg-transparent border border-white/30 text-white/70 px-6 py-2 text-sm font-semibold rounded-full hover:border-white/50 hover:text-white/80 transition-colors"
      >
        Continue in browser
      </button>
    </div>
  );
};

export default FullscreenOverlay;
