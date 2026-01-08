import React from 'react';
import { X, Play } from 'lucide-react';
import DOMPurify from 'dompurify';
import { GameMessage } from '../types';

interface IntroMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: GameMessage;
}

const TEXT_SIZE_MAP = {
  small: 'text-base',
  medium: 'text-lg',
  large: 'text-2xl',
  xlarge: 'text-4xl'
};

const IntroMessageModal: React.FC<IntroMessageModalProps> = ({ isOpen, onClose, message }) => {
  if (!isOpen || !message.enabled) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div 
        className="relative w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95"
        style={{ backgroundColor: message.backgroundColor }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 rounded-full transition-all backdrop-blur-sm"
          title="Close"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Content */}
        <div className="p-8 md:p-12">
          {message.useImage && message.imageUrl ? (
            // Image Mode
            <div className="flex items-center justify-center">
              <img
                src={message.imageUrl}
                alt="Game Intro"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          ) : (
            // Text Mode
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-8">
                <div className="w-16 h-16 bg-orange-600/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Play className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase mb-2">GAME STARTING</h2>
              </div>
              
              <div
                className={`${TEXT_SIZE_MAP[message.fontSize]} font-bold max-w-2xl leading-relaxed`}
                style={{ color: message.textColor }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }}
              />
            </div>
          )}
        </div>

        {/* Start Button */}
        <div className="p-6 bg-black/20 backdrop-blur-sm border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl font-black uppercase text-lg tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 group"
          >
            <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
            START PLAYING
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroMessageModal;
