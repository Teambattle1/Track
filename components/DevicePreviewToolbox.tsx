import React from 'react';
import { Smartphone, Tablet, Lock, Unlock } from 'lucide-react';

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
    <div className="fixed top-1/2 -translate-y-1/2 right-4 z-[2000] pointer-events-auto bg-gradient-to-br from-slate-800 to-slate-900 border border-blue-500 rounded-lg p-2.5 shadow-xl w-48">
      {/* Title */}
      <h3 className="text-white font-bold uppercase text-[8px] tracking-wider mb-2 pb-1.5 border-b border-blue-500">
        📱 Device Preview
      </h3>

      {/* DEVICE SELECTOR */}
      <div className="mb-2.5">
        <label className="text-blue-200 font-bold uppercase text-[7px] tracking-wider block mb-1">
          Device
        </label>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => onDeviceChange('mobile')}
            className={`py-1.5 px-1.5 rounded text-[7px] font-bold uppercase transition-all flex flex-col items-center gap-0.5 ${
              selectedDevice === 'mobile'
                ? 'bg-blue-600 text-white border border-blue-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            Mobile
          </button>
          <button
            onClick={() => onDeviceChange('tablet')}
            className={`py-1.5 px-1.5 rounded text-[7px] font-bold uppercase transition-all flex flex-col items-center gap-0.5 ${
              selectedDevice === 'tablet'
                ? 'bg-blue-600 text-white border border-blue-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
            }`}
          >
            <Tablet className="w-3 h-3" />
            Tablet
          </button>
        </div>
      </div>

      {/* ORIENTATION SELECTOR */}
      <div className="mb-2.5">
        <label className="text-blue-200 font-bold uppercase text-[7px] tracking-wider block mb-1">
          Orientation
        </label>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => onOrientationChange('portrait')}
            className={`py-1.5 px-1.5 rounded text-[7px] font-bold uppercase transition-all flex flex-col items-center gap-0.5 ${
              selectedOrientation === 'portrait'
                ? 'bg-green-600 text-white border border-green-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
            }`}
          >
            <span className="text-xs">⬜</span>
            Port
          </button>
          <button
            onClick={() => onOrientationChange('landscape')}
            className={`py-1.5 px-1.5 rounded text-[7px] font-bold uppercase transition-all flex flex-col items-center gap-0.5 ${
              selectedOrientation === 'landscape'
                ? 'bg-green-600 text-white border border-green-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
            }`}
          >
            <span className="text-xs">⬜</span>
            Land
          </button>
        </div>
      </div>

      {/* ORIENTATION LOCK */}
      <button
        onClick={() => onOrientationLockToggle(!isOrientationLocked)}
        className={`w-full py-1.5 px-1.5 rounded text-[7px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
          isOrientationLocked
            ? 'bg-orange-600 text-white border border-orange-400'
            : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
        }`}
      >
        {isOrientationLocked ? (
          <>
            <Lock className="w-2.5 h-2.5" />
            Locked
          </>
        ) : (
          <>
            <Unlock className="w-2.5 h-2.5" />
            Unlocked
          </>
        )}
      </button>

      {/* INFO */}
      <div className="mt-2 pt-1.5 border-t border-slate-700">
        <p className="text-[6px] text-slate-400 text-center">
          {selectedDevice.toUpperCase()} • {selectedOrientation.toUpperCase()}
        </p>
      </div>
    </div>
  );
};

export default DevicePreviewToolbox;
