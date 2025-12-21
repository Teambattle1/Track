
import React from 'react';
import { Target } from 'lucide-react';
import { t } from '../utils/i18n';
import { Language } from '../types';

interface GameStatsProps {
  score: number;
  pointsCount: { total: number; completed: number };
  nearestPointDistance: number | null;
  language: Language;
  className?: string;
}

const GameStats: React.FC<GameStatsProps> = ({ 
  score, 
  pointsCount, 
  nearestPointDistance, 
  language,
  className = ''
}) => {
  return (
    <>
        {/* TOP CENTER: SCORE & PROGRESS */}
        <div className={`absolute top-20 left-0 right-0 z-[400] pointer-events-none flex justify-center gap-3 ${className}`}>
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg rounded-2xl px-4 py-2 border border-gray-100 dark:border-gray-800 pointer-events-auto flex flex-col items-center min-w-[80px]">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{t('score', language)}</span>
            <span className="text-xl font-black text-orange-600 dark:text-orange-500">{score}</span>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg rounded-2xl px-4 py-2 border border-gray-100 dark:border-gray-800 pointer-events-auto flex flex-col items-center min-w-[80px]">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{t('progress', language)}</span>
            <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{pointsCount.completed}/{pointsCount.total}</span>
          </div>
        </div>

        {/* BOTTOM: NEXT TARGET - Only show if valid distance exists */}
        {nearestPointDistance !== null && (
            <div className={`absolute bottom-6 left-0 right-0 px-4 z-[400] pointer-events-none ${className}`}>
                <div className="max-w-md mx-auto">
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-xl rounded-2xl p-3 border border-gray-100 dark:border-gray-800 flex items-center justify-between min-h-[60px] pointer-events-auto">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">{t('nextTarget', language)}</span>
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          {`${Math.round(nearestPointDistance)}m`}
                        </span>
                      </div>
                      <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center">
                        <Target className="w-5 h-5" />
                      </div>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default GameStats;
