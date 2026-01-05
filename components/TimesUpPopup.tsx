import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { playSound } from '../utils/sounds';

interface TimesUpPopupProps {
  onClose: () => void;
}

const TimesUpPopup: React.FC<TimesUpPopupProps> = ({ onClose }) => {
  useEffect(() => {
    // Vibrate pattern: long-short-long-short-long
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }
    
    // Play time up sound at 90% volume
    playSound('incorrect', 0.9); // Using incorrect sound for now - can add custom time_up.mp3
    
    // Auto-close after 3 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 animate-in fade-in backdrop-blur-sm">
      <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-12 max-w-md w-full mx-4 shadow-2xl border-4 border-red-400 animate-in zoom-in-95">
        <div className="text-center space-y-6">
          {/* Animated Icon */}
          <div className="w-24 h-24 bg-red-900 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-xl">
            <AlertCircle className="w-16 h-16 text-white" />
          </div>
          
          {/* Title */}
          <h2 className="text-5xl font-black text-white uppercase tracking-wider drop-shadow-lg">
            TIMES UP!
          </h2>
          
          {/* Message */}
          <div className="space-y-2">
            <p className="text-xl font-bold text-red-100 tracking-wide">
              SORRY YOU MISSED THE TIME...
            </p>
            <p className="text-2xl font-black text-white tracking-wider animate-pulse">
              KEEP FIGHTING!
            </p>
          </div>
          
          {/* Progress bar (auto-close indicator) */}
          <div className="w-full h-2 bg-red-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white animate-shrink-width"
              style={{
                animation: 'shrinkWidth 3s linear'
              }}
            />
          </div>
        </div>
      </div>
      
      {/* CSS Animation */}
      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default TimesUpPopup;
