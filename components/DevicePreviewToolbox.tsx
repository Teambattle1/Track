import React from 'react';
import { Smartphone, Tablet, Smartphone as Landscape, Lock, Unlock } from 'lucide-react';

interface DevicePreviewToolboxProps {
  selectedDevice: 'mobile' | 'tablet';
  selectedOrientation: 'portrait' | 'landscape';
  isOrientationLocked: boolean;
  onDeviceChange: (device: 'mobile' | 'tablet') => void;
  onOrientationChange: (orientation: 'portrait' | 'landscape') => void;
  onOrientationLockToggle: (locked: boolean) => void;
}

const DevicePreviewToolbox: React.FC<DevicePreviewToolboxProps> = ({
  selectedDevice,
  selectedOrientation,
  isOrientationLocked,
  onDeviceChange,
  onOrientationChange,
  onOrientationLockToggle,
}) => {
  return (
    <div className="fixed top-4 right-4 z-40 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-blue-500 rounded-xl p-4 shadow-2xl max-w-xs">
      {/* Title */}
      <h3 className="text-white font-bold uppercase text-xs tracking-wider mb-3 pb-2 border-b border-blue-500">
        📱 Device Preview
      </h3>

      {/* DEVICE SELECTOR */}
      <div className="space-y-2 mb-4">
        <label className="text-blue-200 font-bold uppercase text-[9px] tracking-wider block">
          Device
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onDeviceChange('mobile')}
            className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${
              selectedDevice === 'mobile'
                ? 'bg-blue-700 text-white border-2 border-blue-400'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-2 border-transparent'
            }`}
            title="Mobile (390x844)"
          >
            <Smartphone className="w-4 h-4" />
            MOBILE
          </button>
          <button
            onClick={() => onDeviceChange('tablet')}
            className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${
              selectedDevice === 'tablet'
                ? 'bg-blue-700 text-white border-2 border-blue-400'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-2 border-transparent'
            }`}
            title="Tablet (1024x768)"
          >
            <Tablet className="w-4 h-4" />
            TABLET
          </button>
        </div>
      </div>

      {/* ORIENTATION SELECTOR */}
      <div className="space-y-2 mb-4">
        <label className="text-blue-200 font-bold uppercase text-[9px] tracking-wider block">
          Orientation
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onOrientationChange('portrait')}
            className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${
              selectedOrientation === 'portrait'
                ? 'bg-green-700 text-white border-2 border-green-400'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-2 border-transparent'
            }`}
            title="Portrait (9:16)"
          >
            <span className="text-lg">▭</span>
            PORT.
          </button>
          <button
            onClick={() => onOrientationChange('landscape')}
            className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${
              selectedOrientation === 'landscape'
                ? 'bg-green-700 text-white border-2 border-green-400'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-2 border-transparent'
            }`}
            title="Landscape (16:9)"
          >
            <span className="text-lg">▬</span>
            LAND.
          </button>
        </div>
      </div>

      {/* ORIENTATION LOCK */}
      <div className="space-y-2">
        <button
          onClick={() => onOrientationLockToggle(!isOrientationLocked)}
          className={`w-full py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            isOrientationLocked
              ? 'bg-orange-700 text-white border-2 border-orange-400'
              : 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-2 border-transparent'
          }`}
          title={isOrientationLocked ? 'Orientation is locked' : 'Lock orientation'}
        >
          {isOrientationLocked ? (
            <>
              <Lock className="w-3 h-3" />
              LOCKED
            </>
          ) : (
            <>
              <Unlock className="w-3 h-3" />
              UNLOCKED
            </>
          )}
        </button>
        <p className="text-[8px] text-slate-400 text-center">
          {isOrientationLocked
            ? 'Players cannot rotate device'
            : 'Players can rotate device'}
        </p>
      </div>

      {/* INFO */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <p className="text-[8px] text-slate-400 text-center">
          {selectedDevice.toUpperCase()} • {selectedOrientation.toUpperCase()}
        </p>
      </div>
    </div>
  );
};

export default DevicePreviewToolbox;
