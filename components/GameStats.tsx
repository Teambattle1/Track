
import React from 'react';
import { Target } from 'lucide-react';
import { t } from '../utils/i18n';
import { Language } from '../types';

interface GameStatsProps {
  score: number;
  pointsCount: { total: number; completed: number };
  nearestPointDistance: number | null;
  language: Language;
  className?: string; // Expects positioning classes like 'top-4 right-4' or 'top-4 left-1/2 -translate-x-1/2'
}

const GameStats: React.FC<GameStatsProps> = ({ 
  score, 
  pointsCount, 
  nearestPointDistance, 
  language,
  className = 'top-4 right-4 md:right-20' // Default right-aligned
}) => {
  return (
    <div className={`absolute z-[400] pointer-events-none flex gap-2 md:gap-3 justify-center ${className}`}>
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg rounded-2xl px-3 py-1.5 md:px-4 md:py-2 border border-gray-100 dark:border-gray-800 pointer-events-auto flex flex-col items-center min-w-[70px] md:min-w-[80px] h-12 justify-center">
        <span className="text-[8px] md:text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider leading-none mb-0.5">{t('score', language)}</span>
        <span className="text-lg md:text-xl font-black text-orange-600 dark:text-orange-500 leading-none">{score}</span>
      </div>

      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg rounded-2xl px-3 py-1.5 md:px-4 md:py-2 border border-gray-100 dark:border-gray-800 pointer-events-auto flex flex-col items-center min-w-[70px] md:min-w-[80px] h-12 justify-center">
        <span className="text-[8px] md:text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider leading-none mb-0.5">{t('progress', language)}</span>
        <span className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100 leading-none">{pointsCount.completed}/{pointsCount.total}</span>
      </div>
    </div>
  );
};

export default GameStats;
