import React from 'react';
import { Home, Map, ListChecks, Trophy, Users, Settings } from 'lucide-react';

interface MapDeviceFrameProps {
  device: 'mobile' | 'tablet' | 'desktop';
  orientation: 'portrait' | 'landscape';
  children: React.ReactNode;
}

// Button bar colors for 6 buttons
const BUTTON_BAR_ITEMS = [
  { icon: Home, label: 'Home', color: 'bg-red-500' },
  { icon: Map, label: 'Map', color: 'bg-orange-500' },
  { icon: ListChecks, label: 'Tasks', color: 'bg-yellow-500' },
  { icon: Trophy, label: 'Score', color: 'bg-green-500' },
  { icon: Users, label: 'Team', color: 'bg-blue-500' },
  { icon: Settings, label: 'Menu', color: 'bg-purple-500' },
];

const DEVICE_SPECS = {
  mobile: {
    screenWidth: 390,
    screenHeight: 844,
    bezel: 16,
    cornerRadius: 48,
  },
  tablet: {
    screenWidth: 1024,
    screenHeight: 768,
    bezel: 24,
    cornerRadius: 32,
  },
  desktop: {
    screenWidth: 1920,
    screenHeight: 1080,
    bezel: 8,
    cornerRadius: 12,
  },
};

const MapDeviceFrame: React.FC<MapDeviceFrameProps> = ({
  device,
  orientation,
  children,
}) => {
  const spec = DEVICE_SPECS[device];

  // Portrait = tall (swap width/height), Landscape = wide (use natural dimensions)
  const isPortrait = orientation === 'portrait';
  const screenWidth = isPortrait ? spec.screenHeight : spec.screenWidth;
  const screenHeight = isPortrait ? spec.screenWidth : spec.screenHeight;

  const frameWidth = screenWidth + spec.bezel * 2;
  const frameHeight = screenHeight + spec.bezel * 2;

  return (
    <div
      className="relative bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl flex-shrink-0"
      style={{
        width: `${frameWidth}px`,
        height: `${frameHeight}px`,
        borderRadius: `${spec.cornerRadius}px`,
        border: '3px solid #1e293b',
      }}
    >
      {/* Device bezel (frame) */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 pointer-events-none"
        style={{
          borderRadius: `${spec.cornerRadius}px`,
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)',
        }}
      />

      {/* Screen content area */}
      <div
        className="absolute bg-black overflow-hidden flex flex-col"
        style={{
          width: `${screenWidth}px`,
          height: `${screenHeight}px`,
          top: `${spec.bezel}px`,
          left: `${spec.bezel}px`,
          borderRadius: `${Math.max(4, spec.cornerRadius / 4)}px`,
        }}
      >
        {/* Main content - takes remaining space */}
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>

        {/* Button bar for tablet portrait mode */}
        {device === 'tablet' && isPortrait && (
          <div className="flex-shrink-0 bg-slate-900 border-t border-slate-700 px-4 py-3">
            <div className="flex justify-between items-center gap-2 max-w-lg mx-auto">
              {BUTTON_BAR_ITEMS.map((item, idx) => (
                <button
                  key={idx}
                  className={`${item.color} hover:opacity-90 flex flex-col items-center justify-center rounded-xl p-2 min-w-[60px] transition-all shadow-lg`}
                >
                  <item.icon className="w-5 h-5 text-white mb-0.5" />
                  <span className="text-[8px] font-black text-white uppercase tracking-wider">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Device label (bottom of frame) */}
      <div
        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap pointer-events-none z-10"
        style={{
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {device === 'mobile' ? '390x844' : '1024x768'} • {orientation}
      </div>
    </div>
  );
};

export default MapDeviceFrame;
