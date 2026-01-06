import React, { useState, useMemo, useRef } from 'react';
import { X, Clock, Plus, Minus, Loader2, GripHorizontal } from 'lucide-react';
import { TimerConfig } from '../types';

interface AdjustGameTimeModalProps {
  onClose: () => void;
  timerConfig?: TimerConfig;
  onUpdateGameTime: (newEndTime: number) => Promise<void>;
}

const AdjustGameTimeModal: React.FC<AdjustGameTimeModalProps> = ({ onClose, timerConfig, onUpdateGameTime }) => {
  console.log('[AdjustGameTimeModal] Mounted/updated with timerConfig:', timerConfig);

  const [adjustmentMinutes, setAdjustmentMinutes] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Draggable state
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 175, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Calculate original end time
  const originalEndTime = useMemo(() => {
    if (!timerConfig?.endTime) {
      console.log('[AdjustGameTimeModal] No endTime in timerConfig');
      return null;
    }
    const endTime = new Date(timerConfig.endTime);
    console.log('[AdjustGameTimeModal] Calculated originalEndTime:', endTime);
    return endTime;
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

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') && !target?.closest('.drag-handle')) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    e.preventDefault();
    setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
  };

  const handleAddMinute = () => {
    setAdjustmentMinutes(prev => prev + 1);
  };

  const handleRemoveMinute = () => {
    setAdjustmentMinutes(prev => prev - 1);
  };

  const handleUpdate = async () => {
    console.log('[AdjustGameTimeModal] handleUpdate called');
    console.log('[AdjustGameTimeModal] adjustedEndTime:', adjustedEndTime);
    console.log('[AdjustGameTimeModal] adjustmentMinutes:', adjustmentMinutes);

    if (!adjustedEndTime) {
      console.warn('[AdjustGameTimeModal] No adjustedEndTime, returning');
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const newEndTime = adjustedEndTime.getTime();
      console.log('[AdjustGameTimeModal] Calling onUpdateGameTime with:', new Date(newEndTime).toISOString());
      await onUpdateGameTime(newEndTime);
      console.log('[AdjustGameTimeModal] onUpdateGameTime completed successfully');

      setMessage({
        type: 'success',
        text: `Game time updated!`
      });

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('[AdjustGameTimeModal] Error updating game time:', error);
      setMessage({
        type: 'error',
        text: 'Failed to update game time. ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className="absolute z-[1200] pointer-events-auto touch-none"
      style={{ left: position.x, top: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="bg-cyan-900 border-2 border-cyan-700 rounded-xl shadow-2xl cursor-move group relative w-[350px]">
        {/* Drag Handle */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-cyan-200 opacity-0 group-hover:opacity-100 transition-opacity bg-cyan-800 rounded-full px-2 border border-cyan-600 pointer-events-none drag-handle">
          <GripHorizontal className="w-3 h-3" />
        </div>

        {/* Header */}
        <div className="p-3 border-b border-cyan-700 bg-cyan-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-300" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-widest">ADJUST TIME</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-cyan-700 rounded-lg transition-colors pointer-events-auto">
            <X className="w-4 h-4 text-cyan-200" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          
          {/* Current Playtime */}
          <div className="bg-cyan-950/50 rounded-lg p-2 border border-cyan-700">
            <p className="text-[8px] text-cyan-300 font-bold uppercase mb-1">Current Playtime</p>
            <p className="text-lg font-black text-cyan-400">{currentPlaytime}</p>
          </div>

          {/* Original End Time */}
          <div className="bg-cyan-950/50 rounded-lg p-2 border border-cyan-700">
            <p className="text-[8px] text-cyan-300 font-bold uppercase mb-1">Original End</p>
            <p className="text-sm font-black text-white">
              {originalEndTime?.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })}
            </p>
          </div>

          {/* Time Adjustment */}
          <div className="space-y-2">
            <p className="text-[8px] text-cyan-300 font-bold uppercase">Adjust (minutes)</p>
            <div className="flex items-center justify-center gap-2 bg-cyan-950/50 rounded-lg p-2 border border-cyan-700">
              <button
                onClick={handleRemoveMinute}
                disabled={isUpdating}
                className="p-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors pointer-events-auto"
              >
                <Minus className="w-4 h-4" />
              </button>
              
              <div className="text-center min-w-[60px]">
                <p className="text-3xl font-black text-orange-400">{adjustmentMinutes > 0 ? '+' : ''}{adjustmentMinutes}</p>
                <p className="text-[8px] text-cyan-300 font-bold">MIN</p>
              </div>
              
              <button
                onClick={handleAddMinute}
                disabled={isUpdating}
                className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors pointer-events-auto"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Adjusted End Time */}
          <div className="bg-gradient-to-r from-green-900/30 to-cyan-900/30 rounded-lg p-2 border border-green-700/50">
            <p className="text-[8px] text-cyan-300 font-bold uppercase mb-1">New End Time</p>
            <p className="text-sm font-black text-green-400">
              {adjustedEndTime?.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })}
            </p>
          </div>

          {/* Status Message */}
          {message && (
            <div className={`p-2 rounded-lg text-[10px] font-bold text-center ${
              message.type === 'success' 
                ? 'bg-green-900/30 border border-green-600 text-green-300' 
                : 'bg-red-900/30 border border-red-600 text-red-300'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-cyan-700 bg-cyan-950/50 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-lg transition-colors uppercase tracking-wider text-[10px] pointer-events-auto"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={isUpdating || adjustmentMinutes === 0}
            className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors uppercase tracking-wider text-[10px] flex items-center justify-center gap-1 pointer-events-auto"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                ...
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
