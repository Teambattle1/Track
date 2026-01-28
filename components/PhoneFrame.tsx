import React, { useState } from 'react';
import { RotateCcw, Smartphone, ArrowLeft } from 'lucide-react';

interface PhoneFrameProps {
  children: React.ReactNode;
  onClose?: () => void;
  onBackToEditor?: () => void;
  showEditorControls?: boolean;
}

/**
 * PhoneFrame - Displays content within an iPhone-style border
 *
 * This component creates a realistic phone frame with:
 * - Portrait/Landscape orientation toggle (editor only)
 * - iPhone 14 Pro dimensions (393x852 portrait)
 * - Dynamic Island notch
 * - Proper scaling to fit screens
 * - Back to Editor button (editor only)
 */
const PhoneFrame: React.FC<PhoneFrameProps> = ({
  children,
  onClose,
  onBackToEditor,
  showEditorControls = false
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // iPhone 14 Pro dimensions
  const PHONE_WIDTH_PORTRAIT = 393;
  const PHONE_HEIGHT_PORTRAIT = 852;
  const BEZEL_SIZE = 12;
  const CORNER_RADIUS = 48;

  // Calculate dimensions based on orientation
  const phoneWidth = orientation === 'portrait' ? PHONE_WIDTH_PORTRAIT : PHONE_HEIGHT_PORTRAIT;
  const phoneHeight = orientation === 'portrait' ? PHONE_HEIGHT_PORTRAIT : PHONE_WIDTH_PORTRAIT;

  // Scale factor to fit in viewport
  const maxViewportWidth = typeof window !== 'undefined' ? window.innerWidth * 0.85 : 800;
  const maxViewportHeight = typeof window !== 'undefined' ? window.innerHeight * 0.75 : 600;

  const scaleX = maxViewportWidth / (phoneWidth + BEZEL_SIZE * 2);
  const scaleY = maxViewportHeight / (phoneHeight + BEZEL_SIZE * 2);
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

  return (
    <div className="fixed inset-0 z-[2500] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in">
      {/* Editor Controls - Only visible in editor mode */}
      {showEditorControls && (
        <div className="flex items-center gap-4 mb-6">
          {/* Back to Editor Button */}
          {onBackToEditor && (
            <button
              onClick={onBackToEditor}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider transition-all border border-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Editor
            </button>
          )}

          {/* Orientation Toggle */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-600">
            <button
              onClick={() => setOrientation('portrait')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold uppercase text-xs tracking-wider transition-all ${
                orientation === 'portrait'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Vertical
            </button>
            <button
              onClick={() => setOrientation('landscape')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold uppercase text-xs tracking-wider transition-all ${
                orientation === 'landscape'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Horizontal
            </button>
          </div>
        </div>
      )}

      {/* Device Label */}
      <div className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        TEAM VIEW - iPhone {orientation === 'portrait' ? 'Portrait' : 'Landscape'} ({phoneWidth}×{phoneHeight})
      </div>

      {/* Phone Device Frame */}
      <div
        className="relative bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 shadow-2xl transition-all duration-500"
        style={{
          width: `${phoneWidth + (BEZEL_SIZE * 2)}px`,
          height: `${phoneHeight + (BEZEL_SIZE * 2)}px`,
          borderRadius: `${CORNER_RADIUS}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Dynamic Island (top center) */}
        <div
          className="absolute bg-black rounded-full z-10"
          style={{
            top: `${BEZEL_SIZE + 12}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: orientation === 'portrait' ? '126px' : '90px',
            height: orientation === 'portrait' ? '37px' : '30px',
          }}
        >
          {/* Camera dot */}
          <div
            className="absolute bg-slate-800 rounded-full"
            style={{
              top: '50%',
              right: orientation === 'portrait' ? '12px' : '8px',
              transform: 'translateY(-50%)',
              width: orientation === 'portrait' ? '12px' : '10px',
              height: orientation === 'portrait' ? '12px' : '10px',
            }}
          />
        </div>

        {/* Power Button (right edge) */}
        <div
          className="absolute bg-slate-600 rounded-r"
          style={{
            right: '-2px',
            top: orientation === 'portrait' ? '180px' : '120px',
            width: '3px',
            height: orientation === 'portrait' ? '80px' : '60px',
          }}
        />

        {/* Volume Buttons (left edge) */}
        <div
          className="absolute bg-slate-600 rounded-l"
          style={{
            left: '-2px',
            top: orientation === 'portrait' ? '140px' : '90px',
            width: '3px',
            height: '30px',
          }}
        />
        <div
          className="absolute bg-slate-600 rounded-l"
          style={{
            left: '-2px',
            top: orientation === 'portrait' ? '180px' : '130px',
            width: '3px',
            height: '60px',
          }}
        />
        <div
          className="absolute bg-slate-600 rounded-l"
          style={{
            left: '-2px',
            top: orientation === 'portrait' ? '250px' : '200px',
            width: '3px',
            height: '60px',
          }}
        />

        {/* Screen Area */}
        <div
          className="absolute bg-black overflow-hidden"
          style={{
            inset: `${BEZEL_SIZE}px`,
            borderRadius: `${CORNER_RADIUS - BEZEL_SIZE}px`,
          }}
        >
          {/* Screen Content with proper scaling */}
          <div
            className="w-full h-full overflow-hidden"
            style={{
              // Content fills the screen area
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {children}
          </div>
        </div>

        {/* Home Indicator (bottom) */}
        <div
          className="absolute bg-white/30 rounded-full"
          style={{
            bottom: `${BEZEL_SIZE + 8}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: orientation === 'portrait' ? '134px' : '100px',
            height: '5px',
          }}
        />

        {/* Corner Highlights for 3D effect */}
        <div
          className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"
          style={{ borderTopLeftRadius: `${CORNER_RADIUS}px` }}
        />
        <div
          className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-black/30 to-transparent pointer-events-none"
          style={{ borderBottomRightRadius: `${CORNER_RADIUS}px` }}
        />
      </div>

      {/* Close Button (outside frame) */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all border border-white/20 hover:border-white/40 group"
          title="Close phone view"
        >
          <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Info Label (bottom) */}
      <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-4">
        {showEditorControls ? 'Editor Preview Mode • ' : ''}
        {orientation === 'portrait' ? 'Portrait' : 'Landscape'} Mode
      </div>
    </div>
  );
};

export default PhoneFrame;
