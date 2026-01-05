import React from 'react';

interface TabletFrameProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * TabletFrame - Displays content within a tablet border in landscape mode
 * 
 * This component creates a realistic tablet frame with:
 * - Landscape orientation (1024x768 tablet dimensions)
 * - Bezel/border around the screen
 * - Proper scaling to fit desktop screens
 * - Maintains correct aspect ratio for team gameplay view
 */
const TabletFrame: React.FC<TabletFrameProps> = ({ children, onClose }) => {
  // Tablet landscape dimensions (iPad-like 4:3 ratio)
  const TABLET_WIDTH = 1024;
  const TABLET_HEIGHT = 768;
  const BEZEL_SIZE = 24; // Bezel thickness in pixels
  
  return (
    <div className="fixed inset-0 z-[2500] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in">
      {/* Tablet Device Frame */}
      <div 
        className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-[32px] shadow-2xl"
        style={{
          width: `${TABLET_WIDTH + (BEZEL_SIZE * 2)}px`,
          height: `${TABLET_HEIGHT + (BEZEL_SIZE * 2)}px`,
          maxWidth: '95vw',
          maxHeight: '90vh',
        }}
      >
        {/* Device Label */}
        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          TEAM VIEW - TABLET LANDSCAPE (1024×768)
        </div>

        {/* Camera/Sensor Bar (top center) */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
          <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
        </div>

        {/* Power Button (top right edge) */}
        <div className="absolute -right-1 top-24 w-1 h-12 bg-slate-700 rounded-r"></div>

        {/* Volume Buttons (right edge) */}
        <div className="absolute -right-1 top-48 w-1 h-8 bg-slate-700 rounded-r"></div>
        <div className="absolute -right-1 top-60 w-1 h-8 bg-slate-700 rounded-r"></div>

        {/* Screen Area (with bezel) */}
        <div 
          className="absolute inset-0 m-[24px] bg-black rounded-[16px] overflow-hidden shadow-inner"
          style={{
            width: `${TABLET_WIDTH}px`,
            height: `${TABLET_HEIGHT}px`,
          }}
        >
          {/* Actual Content */}
          <div className="w-full h-full overflow-hidden">
            {children}
          </div>
        </div>

        {/* Home Button Indicator (bottom center) */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-slate-700 rounded-full"></div>

        {/* Corner Highlights for 3D effect */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-tl-[32px] pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-black/20 to-transparent rounded-br-[32px] pointer-events-none"></div>
      </div>

      {/* Close Button (outside frame) */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all border border-white/20 hover:border-white/40 group"
          title="Close tablet view"
        >
          <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Info Label (bottom) */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-slate-500 text-xs font-bold uppercase tracking-wider">
        Displaying at correct tablet dimensions • Landscape Mode
      </div>
    </div>
  );
};

export default TabletFrame;
