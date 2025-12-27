import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Coordinate } from '../types';
import { teamSync } from '../services/teamSync';
import { haversineMeters } from '../utils/geo';

interface LocationContextType {
  userLocation: Coordinate | null;
  gpsAccuracy: number | null;
  error: string | null;
}

const LocationContext = createContext<LocationContextType>({
  userLocation: null,
  gpsAccuracy: null,
  error: null
});

export const useLocation = () => useContext(LocationContext);

// Buffer size for coordinate smoothing (higher = smoother but more lag)
const BUFFER_SIZE = 3;
// Max realistic speed in m/s (approx 180km/h to allow highway usage but block teleporting)
const MAX_SPEED_MPS = 50; 

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wakeLockRef = useRef<any>(null);
  const lastUpdateRef = useRef<number>(0);
  const locationBuffer = useRef<Coordinate[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const lastValidPosRef = useRef<{ lat: number, lng: number, time: number } | null>(null);

  // Helper: Wake Lock
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('[Location] Wake Lock active');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[Location] Wake Lock released');
        });
      }
    } catch (err: any) {
      // Quiet fail if not allowed/supported
    }
  };

  const startTracking = () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);

      if (!navigator.geolocation) {
        setError("Geolocation not supported");
        return;
      }

      // Immediate read on start (or resume)
      navigator.geolocation.getCurrentPosition(
          (pos) => processPosition(pos, true),
          (err) => console.warn("Single-shot GPS failed", err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => processPosition(pos),
        (err) => {
          console.warn("[Location] Error", err);
          setError(err.message);
        },
        { 
          enableHighAccuracy: true, 
          maximumAge: 0, 
          timeout: 10000 
        }
      );
  };

  const processPosition = (pos: GeolocationPosition, force: boolean = false) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const now = Date.now();

      // 1. Accuracy Filter: Ignore very bad signals (> 100m) unless we have nothing
      if (accuracy > 100 && userLocation) return;

      // 2. Throttle: Only update max once per second unless forced
      if (!force && now - lastUpdateRef.current < 1000) return;

      // 3. Teleport Check (Speed Limit)
      if (lastValidPosRef.current) {
          const dist = haversineMeters(lastValidPosRef.current, { lat: latitude, lng: longitude });
          const timeDiff = (now - lastValidPosRef.current.time) / 1000; // seconds
          if (timeDiff > 0) {
              const speed = dist / timeDiff;
              if (speed > MAX_SPEED_MPS && accuracy > 20) {
                  console.warn(`[Location] Rejected jump: ${speed.toFixed(1)} m/s (${dist.toFixed(0)}m in ${timeDiff.toFixed(1)}s)`);
                  return; // Reject outlier
              }
          }
      }

      lastUpdateRef.current = now;
      lastValidPosRef.current = { lat: latitude, lng: longitude, time: now };

      // 4. Coordinate Smoothing (Simple Moving Average)
      const rawCoords = { lat: latitude, lng: longitude };
      locationBuffer.current.push(rawCoords);
      if (locationBuffer.current.length > BUFFER_SIZE) {
          locationBuffer.current.shift();
      }

      // Calculate average
      const avgLat = locationBuffer.current.reduce((sum, c) => sum + c.lat, 0) / locationBuffer.current.length;
      const avgLng = locationBuffer.current.reduce((sum, c) => sum + c.lng, 0) / locationBuffer.current.length;

      const smoothedCoords = { lat: avgLat, lng: avgLng };
      
      setUserLocation(smoothedCoords);
      setGpsAccuracy(accuracy);
      
      // Update Sync Service
      teamSync.updateLocation(smoothedCoords);
  };

  // Setup Wake Lock & Visibility Listener
  useEffect(() => {
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-acquire lock and restart tracking to flush stale buffers
        requestWakeLock();
        startTracking(); 
        console.log("[Location] App resumed, forced GPS refresh");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  // Initialize Tracking
  useEffect(() => {
    startTracking();
    return () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return (
    <LocationContext.Provider value={{ userLocation, gpsAccuracy, error }}>
      {children}
    </LocationContext.Provider>
  );
};