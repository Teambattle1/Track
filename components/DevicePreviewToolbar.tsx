import React from 'react';
import { Smartphone, Tablet, Lock, Unlock } from 'lucide-react';

interface DevicePreviewToolbarProps {
  selectedDevice: 'mobile' | 'tablet' | 'desktop';
  selectedOrientation: 'portrait' | 'landscape';
  isOrientationLocked: boolean;
  onDeviceChange: (device: 'mobile' | 'tablet' | 'desktop') => void;
  onOrientationChange: (orientation: 'portrait' | 'landscape') => void;
  onOrientationLockToggle: (locked: boolean) => void;
}

const DevicePreviewToolbar: React.FC<DevicePreviewToolbarProps> = ({
  selectedDevice,
  selectedOrientation,
  isOrientationLocked,
  onDeviceChange,
  onOrientationChange,
  onOrientationLockToggle,
}) => {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-b border-blue-500 shadow-lg flex items-center justify-center gap-6 px-8 py-3">
      {/* DEVICE SELECTOR */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase text-blue-300 tracking-wider">Device:</span>
        <div className="flex gap-2">
          <button
            onClick={() => onDeviceChange('mobile')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded text-xs font-bold uppercase transition-all ${
              selectedDevice === 'mobile'
                ? 'bg-blue-600 text-white border border-blue-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Mobile
          </button>
          <button
            onClick={() => onDeviceChange('tablet')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded text-xs font-bold uppercase transition-all ${
              selectedDevice === 'tablet'
                ? 'bg-blue-600 text-white border border-blue-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            Tablet
          </button>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="h-6 w-px bg-slate-600"></div>

      {/* ORIENTATION SELECTOR */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase text-green-300 tracking-wider">Orient:</span>
        <div className="flex gap-2">
          <button
            onClick={() => onOrientationChange('portrait')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded text-xs font-bold uppercase transition-all ${
              selectedOrientation === 'portrait'
                ? 'bg-green-600 text-white border border-green-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
            }`}
          >
            <span className="text-xs">⬜</span>
            Portrait
          </button>
          <button
            onClick={() => onOrientationChange('landscape')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded text-xs font-bold uppercase transition-all ${
              selectedOrientation === 'landscape'
                ? 'bg-green-600 text-white border border-green-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
            }`}
          >
            <span className="text-xs">⬛</span>
            Landscape
          </button>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="h-6 w-px bg-slate-600"></div>

      {/* ORIENTATION LOCK */}
      <button
        onClick={() => onOrientationLockToggle(!isOrientationLocked)}
        className={`flex items-center gap-2 py-1.5 px-3 rounded text-xs font-bold uppercase transition-all ${
          isOrientationLocked
            ? 'bg-orange-600 text-white border border-orange-400'
            : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
        }`}
      >
        {isOrientationLocked ? (
          <>
            <Lock className="w-3.5 h-3.5" />
            Locked
          </>
        ) : (
          <>
            <Unlock className="w-3.5 h-3.5" />
            Unlocked
          </>
        )}
      </button>

      {/* INFO - Right side */}
      <div className="ml-auto text-xs text-slate-400 font-mono">
        {selectedDevice.toUpperCase()} • {selectedOrientation.toUpperCase()}
      </div>
    </div>
  );
};

export default DevicePreviewToolbar;
