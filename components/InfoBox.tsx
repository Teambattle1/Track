import React, { useState } from 'react';
import { X, Info } from 'lucide-react';

interface InfoBoxProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

const InfoBox: React.FC<InfoBoxProps> = ({ title, children, className = '', iconClassName = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Info Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all ${iconClassName}`}
        title={title}
      >
        <Info className="w-3 h-3" />
      </button>

      {/* Info Popup */}
      {isOpen && (
        <div className={`absolute z-[99999] bg-slate-900 border border-blue-500/50 rounded-lg p-4 shadow-2xl max-w-xs ${className}`}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">{title}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoBox;
