import React from 'react';

interface MapDeviceFrameProps {
  device: 'mobile' | 'tablet';
  orientation: 'portrait' | 'landscape';
  children: React.ReactNode;
}

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
};

const MapDeviceFrame: React.FC<MapDeviceFrameProps> = ({
  device,
  orientation,
  children,
}) => {
  const spec = DEVICE_SPECS[device];

  // Swap dimensions for landscape
  const isLandscape = orientation === 'landscape';
  const screenWidth = isLandscape ? spec.screenHeight : spec.screenWidth;
  const screenHeight = isLandscape ? spec.screenWidth : spec.screenHeight;

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
        className="absolute bg-black overflow-hidden"
        style={{
          width: `${screenWidth}px`,
          height: `${screenHeight}px`,
          top: `${spec.bezel}px`,
          left: `${spec.bezel}px`,
          borderRadius: `${Math.max(4, spec.cornerRadius / 4)}px`,
        }}
      >
        {children}
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
