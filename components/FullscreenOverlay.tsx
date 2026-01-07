import React, { useEffect, useState } from 'react';

const FullscreenOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios-safari' | 'ios-other' | 'android' | null>(null);

  useEffect(() => {
    // Detect device and browser
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;

    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isAndroid = /android/i.test(ua);

    const isMobileOrTablet =
      isIOS ||
      isAndroid ||
      /webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua) ||
      (window.matchMedia && window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches);

    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

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

      // iOS Safari - show Add to Home Screen instructions
      if (isIOS && isSafari) {
        setPlatform('ios-safari');
        setIsVisible(true);
      }
      // iOS Chrome/other browsers - limited options
      else if (isIOS && !isSafari) {
        setPlatform('ios-other');
        setIsVisible(true);
      }
      // Android/Chrome with Fullscreen API support
      else if (fullscreenEnabled) {
        setPlatform('android');
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

    // Try to lock orientation to portrait
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

      {/* iOS Safari - Add to Home Screen */}
      {platform === 'ios-safari' && (
        <>
          <div className="text-2xl font-bold mb-2.5">Add to Home Screen</div>
          <div className="text-base opacity-80 max-w-xs mb-5">
            Install this app for the best fullscreen experience
          </div>

          <div className="bg-white/10 rounded-xl p-5 mb-5 max-w-80">
            <div className="flex items-center mb-3 text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">📤</span>
              <span>Tap the Share button below</span>
            </div>
            <div className="flex items-center mb-3 text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">➕</span>
              <span>Tap "Add to Home Screen"</span>
            </div>
            <div className="flex items-center text-left text-sm">
              <span className="text-2xl mr-3 min-w-8">🚀</span>
              <span>Open from your home screen</span>
            </div>
          </div>
        </>
      )}

      {/* iOS Chrome/Other - Suggest Safari */}
      {platform === 'ios-other' && (
        <>
          <div className="text-2xl font-bold mb-2.5">Open in Safari</div>
          <div className="text-base opacity-80 max-w-xs">
            For the best experience, open this app in Safari and add it to your Home Screen
          </div>
        </>
      )}

      {/* Android - Fullscreen button */}
      {platform === 'android' && (
        <>
          <div className="text-2xl font-bold mb-2.5">Enter Fullscreen</div>
          <div className="text-base opacity-80 max-w-xs mb-5">
            Tap below for an immersive fullscreen experience
          </div>

          <button
            onClick={requestFullscreen}
            className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-10 py-4 font-bold text-lg rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            ⛶ Go Fullscreen
          </button>
        </>
      )}

      {/* Dismiss button */}
      <button
        onClick={hideOverlay}
        className="mt-5 bg-transparent border border-white/30 text-white/70 px-6 py-2 text-sm font-semibold rounded-full hover:border-white/50 hover:text-white/80 transition-colors"
      >
        Continue in browser
      </button>
    </div>
  );
};

export default FullscreenOverlay;
