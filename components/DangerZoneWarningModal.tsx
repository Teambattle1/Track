import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { DangerZone } from '../types';

interface DangerZoneWarningModalProps {
  isVisible: boolean;
  zone: DangerZone | null;
  currentScore: number;
  scoreDeductedPerSecond: number;
  totalDeducted: number;
  elapsedSeconds: number;
  onClose: () => void;
}

export const DangerZoneWarningModal: React.FC<DangerZoneWarningModalProps> = ({
  isVisible,
  zone,
  currentScore,
  scoreDeductedPerSecond,
  totalDeducted,
  elapsedSeconds,
  onClose
}) => {
  const [isFlashing, setIsFlashing] = useState(true);

  useEffect(() => {
    if (!isVisible) return;
    
    // Flash animation effect
    const flashInterval = setInterval(() => {
      setIsFlashing(prev => !prev);
    }, 400); // Flash every 400ms

    return () => clearInterval(flashInterval);
  }, [isVisible]);

  if (!isVisible || !zone) return null;

  const penaltyInfo = zone.penaltyType === 'time_based' 
    ? `${scoreDeductedPerSecond} points/second`
    : `${zone.penalty} points total`;

  const graceSecondsLeft = Math.max(0, zone.duration - elapsedSeconds);
  const penaltyActive = zone.penaltyType === 'fixed' || elapsedSeconds >= zone.duration;

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-[9999] ${isFlashing ? 'bg-red-900/60' : 'bg-red-900/30'} transition-all duration-200`}>
      {/* Flashing warning overlay */}
      <div className={`absolute inset-0 animate-pulse ${isFlashing ? 'bg-red-600/40' : 'bg-transparent'}`} />

      {/* Warning Modal - Cannot be closed or dismissed */}
      <div className={`relative bg-black border-4 border-red-600 rounded-2xl p-8 max-w-md mx-4 shadow-2xl transform transition-all pointer-events-auto ${
        isFlashing ? 'scale-105 drop-shadow-2xl' : 'scale-100'
      }`}>

        {/* Alert Icon - Animated */}
        <div className="flex justify-center mb-6">
          <div className={`animate-bounce ${isFlashing ? 'text-red-600' : 'text-red-500'}`}>
            <AlertTriangle className="w-16 h-16" />
          </div>
        </div>

        {/* Main Warning Text */}
        <h1 className={`text-4xl font-black text-center mb-2 ${isFlashing ? 'text-red-600 drop-shadow-lg' : 'text-red-500'}`}>
          ⚠️ DANGER ZONE! ⚠️
        </h1>

        {/* Zone Name */}
        <p className="text-xl font-bold text-red-300 text-center mb-6">
          {zone.title || 'DANGER ZONE'}
        </p>

        {/* GET OUT Message */}
        <p className={`text-3xl font-black text-center mb-8 ${isFlashing ? 'text-yellow-400' : 'text-yellow-300'} animate-pulse`}>
          GET OUT NOW!
        </p>

        {/* Penalty Information Section */}
        <div className="bg-red-950/80 border-2 border-red-600 rounded-lg p-4 mb-6 space-y-3">
          {/* Grace Period / Active Status */}
          {zone.penaltyType === 'time_based' && (
            <div className="flex justify-between items-center">
              <span className="text-white font-bold">Grace Period:</span>
              <span className={`font-black text-lg ${graceSecondsLeft > 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                {graceSecondsLeft > 0 ? `${graceSecondsLeft}s` : '⚠️ PENALTY ACTIVE'}
              </span>
            </div>
          )}

          {/* Penalty Type */}
          <div className="flex justify-between items-center">
            <span className="text-white font-bold">Penalty:</span>
            <span className="text-red-300 font-mono">{penaltyInfo}</span>
          </div>

          {/* Time Based Deduction Details */}
          {zone.penaltyType === 'time_based' && penaltyActive && (
            <>
              <div className="flex justify-between items-center pt-2 border-t border-red-600">
                <span className="text-white font-bold">Time in Zone:</span>
                <span className="text-orange-400 font-mono font-black">{elapsedSeconds}s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">Points Lost:</span>
                <span className="text-red-500 font-mono font-black text-xl">{totalDeducted}</span>
              </div>
            </>
          )}

          {/* Current Score */}
          <div className="flex justify-between items-center pt-2 border-t border-red-600 bg-red-900/60 px-3 py-2 rounded">
            <span className="text-white font-bold">Current Score:</span>
            <span className={`font-mono font-black text-2xl ${currentScore >= 0 ? 'text-green-400' : 'text-red-500'}`}>
              {currentScore}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-center text-gray-400 text-sm">
          Move away from the red zone to escape danger
        </p>
      </div>
    </div>
  );
};

export default DangerZoneWarningModal;
