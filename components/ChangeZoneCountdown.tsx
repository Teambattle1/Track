import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface ChangeZoneCountdownProps {
  targetTime: number; // Unix timestamp
  variant: 'instructor' | 'team';
  onTrigger?: () => void; // Callback when countdown reaches 00:00
}

const ChangeZoneCountdown: React.FC<ChangeZoneCountdownProps> = ({ 
  targetTime, 
  variant,
  onTrigger 
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const remaining = Math.max(0, targetTime - now);
      setTimeLeft(remaining);

      // Trigger callback when countdown reaches 00:00
      if (remaining === 0 && !hasTriggered && onTrigger) {
        setHasTriggered(true);
        onTrigger();
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [targetTime, hasTriggered, onTrigger]);

  // Format time as HH:MM:SS or MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (variant === 'instructor') {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[3000] animate-in slide-in-from-top-4">
        <div className="bg-red-600 border-2 border-red-400 rounded-2xl px-6 py-3 shadow-2xl shadow-red-600/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-red-200 uppercase tracking-widest leading-none">
                COUNTDOWN TO CHANGE
              </span>
              <span className="text-2xl font-black text-white font-mono tabular-nums leading-none mt-1">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Team variant - compact topbar display
  return (
    <div className="flex items-center gap-2 bg-red-600/20 border border-red-500/50 rounded-lg px-3 py-1.5">
      <Clock className="w-4 h-4 text-red-500" />
      <span className="text-sm font-black text-red-500 font-mono tabular-nums">
        {formatTime(timeLeft)}
      </span>
    </div>
  );
};

export default ChangeZoneCountdown;
