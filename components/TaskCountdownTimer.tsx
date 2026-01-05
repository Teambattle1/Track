import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { TaskSettings } from '../types';
import { playSound } from '../utils/sounds';

interface TaskCountdownTimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  settings?: TaskSettings;
  showScoreReduction?: boolean;
  basePoints?: number;
}

const TaskCountdownTimer: React.FC<TaskCountdownTimerProps> = ({
  totalSeconds,
  onTimeUp,
  settings,
  showScoreReduction = false,
  basePoints = 100
}) => {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isWarningPhase, setIsWarningPhase] = useState(false);
  const [flash, setFlash] = useState(false);
  const [currentScore, setCurrentScore] = useState(basePoints);
  
  const warningThreshold = settings?.countdownWarningSeconds || 20;
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Check if entering warning phase
        if (newTime === warningThreshold && settings?.countdownWarningEnabled) {
          setIsWarningPhase(true);
          startWarnings();
        }
        
        // Update score if score reduction is enabled
        if (showScoreReduction && settings?.scoreDependsOnSpeed) {
          const mode = settings.scoreReductionMode || 'linear';
          const newScore = calculateScore(basePoints, totalSeconds - newTime, totalSeconds, mode);
          setCurrentScore(newScore);
        }
        
        // Time up
        if (newTime <= 0) {
          clearInterval(interval);
          stopWarnings();
          onTimeUp();
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
    
    return () => {
      clearInterval(interval);
      stopWarnings();
    };
  }, [totalSeconds, warningThreshold, settings, basePoints, showScoreReduction, onTimeUp]);
  
  const calculateScore = (
    base: number,
    timeSpent: number,
    timeLimit: number,
    mode: 'none' | 'linear' | 'exponential' | undefined
  ): number => {
    if (!mode || mode === 'none') return base;
    if (timeSpent >= timeLimit) return 0;
    
    const timeRatio = timeSpent / timeLimit;
    
    if (mode === 'linear') {
      // Linear reduction: 100% → 0% evenly
      return Math.round(base * (1 - timeRatio));
    } else {
      // Exponential reduction: Faster drop near end
      return Math.round(base * Math.pow(1 - timeRatio, 2));
    }
  };
  
  const startWarnings = () => {
    // Vibration pattern (every 2 seconds)
    if (settings?.countdownVibrateEnabled && 'vibrate' in navigator) {
      const vibratePattern = () => {
        navigator.vibrate([200, 100, 200]); // Short vibration burst
      };
      
      vibratePattern(); // Immediate first vibration
      vibrationIntervalRef.current = setInterval(vibratePattern, 2000);
    }
    
    // Countdown beep sound (every second)
    if (settings?.countdownSoundEnabled) {
      const volume = (settings.countdownSoundVolume || 80) / 100;
      const playBeep = () => {
        // Using a short beep sound - in production, use custom countdown_beep.mp3
        playSound('correct', volume * 0.5); // Quieter beep
      };
      
      soundIntervalRef.current = setInterval(playBeep, 1000);
    }
    
    // Flash effect (every 500ms)
    if (settings?.countdownFlashEnabled) {
      flashIntervalRef.current = setInterval(() => {
        setFlash(prev => !prev);
      }, 500);
    }
  };
  
  const stopWarnings = () => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getProgressPercentage = (): number => {
    return (timeLeft / totalSeconds) * 100;
  };
  
  return (
    <div 
      className={`relative rounded-2xl p-4 transition-all duration-300 ${
        isWarningPhase 
          ? 'bg-red-900/30 border-4 border-red-500 shadow-lg shadow-red-500/50' 
          : 'bg-slate-800/50 border-2 border-slate-700'
      } ${flash ? 'animate-pulse' : ''}`}
    >
      {/* Warning Icon */}
      {isWarningPhase && (
        <div className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center animate-bounce shadow-lg border-2 border-white">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
      )}
      
      <div className="flex items-center justify-between gap-4">
        {/* Timer Display */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isWarningPhase ? 'bg-red-600' : 'bg-slate-700'}`}>
            <Clock className={`w-5 h-5 ${isWarningPhase ? 'text-white' : 'text-slate-400'}`} />
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {isWarningPhase ? '⚠️ HURRY UP!' : 'TIME LIMIT'}
            </span>
            <span className={`text-4xl font-mono font-black tabular-nums ${
              isWarningPhase ? 'text-red-500' : 'text-white'
            }`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
        
        {/* Score Display (if enabled) */}
        {showScoreReduction && settings?.scoreDependsOnSpeed && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              CURRENT SCORE
            </span>
            <span className={`text-3xl font-black ${
              currentScore < basePoints * 0.3 ? 'text-red-500' : 'text-green-500'
            }`}>
              {currentScore}
            </span>
            <span className="text-xs text-slate-500 font-bold">
              / {basePoints} pts
            </span>
          </div>
        )}
      </div>
      
      {/* Progress Bar */}
      <div className="mt-3 w-full h-2 bg-slate-900 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ease-linear ${
            isWarningPhase ? 'bg-red-500' : 'bg-green-500'
          }`}
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>
      
      {/* Score Reduction Info */}
      {showScoreReduction && settings?.scoreDependsOnSpeed && (
        <div className="mt-2 text-center">
          <span className="text-xs text-slate-400 font-bold">
            Mode: {settings.scoreReductionMode === 'exponential' ? 'Exponential' : 'Linear'} Reduction
          </span>
        </div>
      )}
    </div>
  );
};

export default TaskCountdownTimer;
