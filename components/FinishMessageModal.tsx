import React, { useState, useEffect } from 'react';
import { X, Flag, MapPin, Navigation } from 'lucide-react';
import DOMPurify from 'dompurify';
import { GameMessage, Coordinate } from '../types';

interface FinishMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: GameMessage;
  enableMeetingPoint?: boolean;
  meetingPoint?: Coordinate;
  onNavigateToMeetingPoint?: () => void;
}

const TEXT_SIZE_MAP = {
  small: 'text-lg',
  medium: 'text-2xl',
  large: 'text-3xl',
  xlarge: 'text-5xl'
};

const FinishMessageModal: React.FC<FinishMessageModalProps> = ({ 
  isOpen, 
  onClose, 
  message,
  enableMeetingPoint = false,
  meetingPoint,
  onNavigateToMeetingPoint
}) => {
  const [pulseAnimation, setPulseAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Trigger pulse animation for meeting point button
      setPulseAnimation(true);
      const timer = setTimeout(() => setPulseAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !message.enabled) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div 
        className="relative w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500"
        style={{ backgroundColor: message.backgroundColor }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 p-3 bg-black/30 hover:bg-black/50 rounded-full transition-all backdrop-blur-sm group"
          title="Close"
        >
          <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        </button>

        {/* Content */}
        <div className="p-12 md:p-16">
          {message.useImage && message.imageUrl ? (
            // Image Mode
            <div className="flex items-center justify-center">
              <img
                src={message.imageUrl}
                alt="Game Finished"
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          ) : (
            // Text Mode
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-8">
                <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-6 mx-auto animate-in zoom-in duration-700">
                  <Flag className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase mb-3 tracking-wider">GAME COMPLETE!</h2>
              </div>
              
              <div
                className={`${TEXT_SIZE_MAP[message.fontSize]} font-bold max-w-3xl leading-relaxed mb-8`}
                style={{ color: message.textColor }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-black/30 backdrop-blur-sm border-t border-white/10">
          <div className="flex flex-col gap-3 max-w-2xl mx-auto">
            {/* Meeting Point Navigation Button */}
            {enableMeetingPoint && meetingPoint && onNavigateToMeetingPoint && (
              <button
                onClick={() => {
                  onNavigateToMeetingPoint();
                  onClose();
                }}
                className={`w-full py-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl font-black uppercase text-lg tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 group ${
                  pulseAnimation ? 'animate-pulse' : ''
                }`}
              >
                <div className="relative">
                  <MapPin className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
                </div>
                NAVIGATE TO MEETING POINT
                <Navigation className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase text-base tracking-widest transition-all flex items-center justify-center gap-3 group"
            >
              <Flag className="w-5 h-5 group-hover:scale-110 transition-transform" />
              FINISH
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinishMessageModal;
