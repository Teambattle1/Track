import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertCircle } from 'lucide-react';

interface OfflineIndicatorProps {
  onOnline?: () => void;
  onOffline?: () => void;
}

/**
 * OfflineIndicator Component
 * 
 * Displays a persistent banner when the user loses internet connection.
 * Automatically detects when connection is restored.
 */
const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onOnline, onOffline }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);

      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }

      if (onOnline) onOnline();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      if (onOffline) onOffline();
    };

    // Listen for service worker sync completion
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [wasOffline, onOnline, onOffline]);

  // Don't show anything if we're online and haven't been offline
  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <>
      {!isOnline && (
        <div className="offline-banner offline-banner-error">
          <WifiOff size={20} />
          <div className="offline-content">
            <strong>No Internet Connection</strong>
            <span>Changes will be saved when you reconnect</span>
          </div>
        </div>
      )}

      {showReconnected && (
        <div className="offline-banner offline-banner-success">
          <Wifi size={20} />
          <div className="offline-content">
            <strong>Back Online</strong>
            <span>Syncing your changes...</span>
          </div>
        </div>
      )}

      <style>{`
        .offline-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          color: white;
          font-size: 0.875rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          animation: slideDown 0.3s ease-out;
        }

        .offline-banner-error {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }

        .offline-banner-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .offline-content {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .offline-content strong {
          font-weight: 700;
          font-size: 0.9375rem;
        }

        .offline-content span {
          opacity: 0.9;
          font-size: 0.8125rem;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 640px) {
          .offline-banner {
            padding: 0.875rem 1rem;
            font-size: 0.8125rem;
          }

          .offline-content strong {
            font-size: 0.875rem;
          }

          .offline-content span {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </>
  );
};

export default OfflineIndicator;

/**
 * useOfflineQueue Hook
 * 
 * Manages a queue of operations to execute when connection is restored
 * 
 * Usage:
 * const { addToQueue, processQueue } = useOfflineQueue();
 * 
 * if (!navigator.onLine) {
 *   addToQueue(() => saveGame(gameData));
 * }
 */
export const useOfflineQueue = () => {
  const [queue, setQueue] = useState<Array<() => Promise<void>>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addToQueue = (operation: () => Promise<void>) => {
    setQueue(prev => [...prev, operation]);
  };

  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;

    setIsProcessing(true);
    
    for (const operation of queue) {
      try {
        await operation();
      } catch (error) {
        console.error('[OfflineQueue] Failed to process queued operation:', error);
      }
    }

    setQueue([]);
    setIsProcessing(false);
  };

  useEffect(() => {
    const handleOnline = () => {
      processQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queue]);

  return {
    addToQueue,
    processQueue,
    queueLength: queue.length,
    isProcessing
  };
};
