import React, { useState, useMemo } from 'react';
import { X, Clock, Plus, Minus, Loader2 } from 'lucide-react';
import { TimerConfig } from '../types';

interface AdjustGameTimeModalProps {
  onClose: () => void;
  timerConfig?: TimerConfig;
  onUpdateGameTime: (newEndTime: number) => Promise<void>;
}

const AdjustGameTimeModal: React.FC<AdjustGameTimeModalProps> = ({ onClose, timerConfig, onUpdateGameTime }) => {
  const [adjustmentMinutes, setAdjustmentMinutes] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Calculate original end time
  const originalEndTime = useMemo(() => {
    if (!timerConfig?.endTime) return null;
    return new Date(timerConfig.endTime);
  }, [timerConfig]);

  // Calculate adjusted end time
  const adjustedEndTime = useMemo(() => {
    if (!originalEndTime) return null;
    const adjusted = new Date(originalEndTime);
    adjusted.setMinutes(adjusted.getMinutes() + adjustmentMinutes);
    return adjusted;
  }, [originalEndTime, adjustmentMinutes]);

  // Calculate current playtime
  const currentPlaytime = useMemo(() => {
    if (!timerConfig?.startTime) return 'N/A';
    const start = new Date(timerConfig.startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }, [timerConfig]);

  const handleAddMinute = () => {
    setAdjustmentMinutes(prev => prev + 1);
  };

  const handleRemoveMinute = () => {
    setAdjustmentMinutes(prev => prev - 1);
  };

  const handleUpdate = async () => {
    if (!adjustedEndTime) return;
    
    setIsUpdating(true);
    setMessage(null);

    try {
      const newEndTime = adjustedEndTime.getTime();
      await onUpdateGameTime(newEndTime);
      
      setMessage({
        type: 'success',
        text: `Game time updated! New end time: ${adjustedEndTime.toLocaleTimeString()}`
      });

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error updating game time:', error);
      setMessage({
        type: 'error',
        text: 'Failed to update game time. Please try again.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-blue-900/30 to-cyan-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-black text-white uppercase tracking-wider">ADJUST GAME TIME</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Current Playtime */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 font-bold uppercase mb-2">Current Playtime</p>
            <p className="text-2xl font-black text-cyan-400">{currentPlaytime}</p>
          </div>

          {/* Original End Time */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 font-bold uppercase mb-2">Original End Time</p>
            <p className="text-lg font-black text-white">
              {originalEndTime?.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
              })}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              {originalEndTime?.toLocaleDateString()}
            </p>
          </div>

          {/* Time Adjustment */}
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-bold uppercase">Adjust Time (minutes)</p>
            <div className="flex items-center justify-center gap-4 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <button
                onClick={handleRemoveMinute}
                disabled={isUpdating}
                className="p-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Minus className="w-6 h-6" />
              </button>
              
              <div className="text-center">
                <p className="text-5xl font-black text-orange-400">{adjustmentMinutes.toString().padStart(3, ' ')}</p>
                <p className="text-xs text-gray-400 font-bold mt-2">MINUTES</p>
              </div>
              
              <button
                onClick={handleAddMinute}
                disabled={isUpdating}
                className="p-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Adjusted End Time */}
          <div className="bg-gradient-to-r from-green-900/20 to-cyan-900/20 rounded-lg p-4 border border-green-700/50">
            <p className="text-xs text-gray-400 font-bold uppercase mb-2">Adjusted End Time</p>
            <p className="text-lg font-black text-green-400">
              {adjustedEndTime?.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
              })}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              {adjustedEndTime?.toLocaleDateString()}
            </p>
            {adjustmentMinutes !== 0 && (
              <p className={`text-sm font-bold mt-2 ${adjustmentMinutes > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {adjustmentMinutes > 0 ? '+' : ''}{adjustmentMinutes} minutes
              </p>
            )}
          </div>

          {/* Status Message */}
          {message && (
            <div className={`p-3 rounded-lg text-sm font-bold text-center ${
              message.type === 'success' 
                ? 'bg-green-900/30 border border-green-600 text-green-300' 
                : 'bg-red-900/30 border border-red-600 text-red-300'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-800/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors uppercase tracking-wider text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={isUpdating || adjustmentMinutes === 0}
            className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors uppercase tracking-wider text-sm flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                UPDATING...
              </>
            ) : (
              'UPDATE'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdjustGameTimeModal;
