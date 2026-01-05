import React, { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

interface InfoTooltipProps {
  title?: string;
  description: string;
  example?: string;
  className?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, description, example, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        buttonRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        title="Click for more info"
      >
        <Info className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className="absolute left-0 top-full mt-2 w-80 bg-gradient-to-br from-blue-900 to-blue-950 border-2 border-blue-500 rounded-xl p-4 shadow-2xl z-[1000] animate-in fade-in slide-in-from-top-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-blue-800 transition-colors"
          >
            <X className="w-3 h-3 text-blue-200" />
          </button>

          {/* Title */}
          {title && (
            <h4 className="text-sm font-black text-blue-200 uppercase tracking-wider mb-2 pr-6">
              {title}
            </h4>
          )}

          {/* Description */}
          <p className="text-xs text-blue-100 leading-relaxed mb-2">
            {description}
          </p>

          {/* Example */}
          {example && (
            <div className="mt-3 pt-3 border-t border-blue-700">
              <p className="text-[10px] font-bold text-blue-300 uppercase mb-1">Example:</p>
              <p className="text-xs text-blue-200 italic">"{example}"</p>
            </div>
          )}

          {/* Pointer arrow */}
          <div className="absolute -top-2 left-3 w-4 h-4 bg-blue-900 border-l-2 border-t-2 border-blue-500 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
