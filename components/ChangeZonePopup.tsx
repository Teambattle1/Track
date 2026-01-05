import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { AlertTriangle, Lock, Check, X } from 'lucide-react';

interface ChangeZonePopupProps {
  message: string; // HTML content
  imageUrl?: string;
  requireCode: boolean;
  onClose: () => void;
}

const ChangeZonePopup: React.FC<ChangeZonePopupProps> = ({ 
  message, 
  imageUrl, 
  requireCode, 
  onClose 
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleClose = () => {
    if (requireCode) {
      if (code === '4027') {
        onClose();
      } else {
        setError(true);
        setTimeout(() => setError(false), 2000);
      }
    } else {
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8 animate-in fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-4 border-red-600 animate-in zoom-in-95"
        style={{ maxHeight: '75vh' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 border-b-4 border-red-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-wider">
                ZONEÆNDRING
              </h2>
              <p className="text-xs font-bold text-red-200 uppercase tracking-widest">
                VIGTIG MEDDELELSE
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6" style={{ maxHeight: 'calc(75vh - 180px)' }}>
          {/* Image */}
          {imageUrl && (
            <div className="w-full rounded-2xl overflow-hidden border-4 border-red-500 shadow-lg">
              <img 
                src={imageUrl} 
                alt="Change Zone"
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Message */}
          <div 
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message) }}
            style={{
              fontSize: '1.125rem',
              lineHeight: '1.75rem',
              color: 'inherit'
            }}
          />
        </div>

        {/* Footer */}
        <div className="bg-slate-100 dark:bg-slate-800 border-t-4 border-red-600 p-6">
          {requireCode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <Lock className="w-4 h-4" />
                <span className="font-bold uppercase tracking-widest">
                  Instruktør kode påkrævet
                </span>
              </div>
              
              <div className="flex gap-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Indtast kode..."
                  className={`flex-1 px-4 py-3 bg-white dark:bg-slate-900 border-2 rounded-xl font-mono text-lg tracking-widest text-center uppercase focus:outline-none focus:ring-2 transition-all ${
                    error 
                      ? 'border-red-500 focus:ring-red-500 animate-shake' 
                      : 'border-slate-300 dark:border-slate-600 focus:ring-red-500'
                  }`}
                  maxLength={4}
                  autoFocus
                />
                <button
                  onClick={handleClose}
                  className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                >
                  <Check className="w-5 h-5" />
                  <span>LUK</span>
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold animate-in slide-in-from-bottom-2">
                  <X className="w-4 h-4" />
                  <span>Forkert kode. Prøv igen.</span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleClose}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-lg uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95"
            >
              <Check className="w-6 h-6" />
              <span>OK, FORSTÅET</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangeZonePopup;
