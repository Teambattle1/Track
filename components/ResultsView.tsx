import React from 'react';
import { GamePoint, Language } from '../types';
import { t } from '../utils/i18n';
import { Trophy, Clock, CheckCircle, XCircle, Home } from 'lucide-react';

interface ResultsViewProps {
  points: GamePoint[];
  score: number;
  totalPossibleScore: number;
  onClose: () => void;
  language: Language;
}

const ResultsView: React.FC<ResultsViewProps> = ({ points, score, totalPossibleScore, onClose, language }) => {
  const completed = points.filter(p => p.isCompleted);
  const total = points.filter(p => !p.isSectionHeader).length;
  
  const percentage = totalPossibleScore > 0 ? Math.round((score / totalPossibleScore) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[1600] bg-slate-900 text-white overflow-y-auto animate-in slide-in-from-bottom duration-300">
      <div className="max-w-md mx-auto min-h-full flex flex-col p-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white">
                <Home className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-400">{t('missionReport', language)}</h2>
            <div className="w-10"></div> {/* Spacer */}
        </div>

        {/* Score Card */}
        <div className="bg-gradient-to-br from-orange-600 to-red-700 rounded-3xl p-8 text-center shadow-2xl mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-300" />
            <div className="text-6xl font-black mb-2 tracking-tighter">{score}</div>
            <div className="text-orange-200 text-sm font-bold uppercase tracking-wider">{t('totalScore', language)}</div>
            <div className="mt-4 inline-block bg-white/20 rounded-full px-4 py-1 text-sm font-bold">
                {percentage}% {t('successRate', language)}
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-800 rounded-2xl p-4 flex flex-col items-center">
                <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                <span className="text-2xl font-bold">{completed.length}</span>
                <span className="text-xs text-slate-400 uppercase">{t('tasksDone', language)}</span>
            </div>
            <div className="bg-slate-800 rounded-2xl p-4 flex flex-col items-center">
                <Clock className="w-8 h-8 text-blue-500 mb-2" />
                <span className="text-2xl font-bold">{total}</span>
                <span className="text-xs text-slate-400 uppercase">{t('totalTasks', language)}</span>
            </div>
        </div>

        {/* Task List */}
        <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 ml-2">{t('taskBreakdown', language)}</h3>
            <div className="space-y-3">
                {points.filter(p => !p.isSectionHeader).map((point) => (
                    <div key={point.id} className="bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-slate-700">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {point.isCompleted ? (
                                <div className="bg-green-500/20 p-2 rounded-full"><CheckCircle className="w-4 h-4 text-green-500" /></div>
                            ) : (
                                <div className="bg-slate-700 p-2 rounded-full"><XCircle className="w-4 h-4 text-slate-500" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className={`font-bold truncate ${point.isCompleted ? 'text-white' : 'text-slate-500'}`}>{point.title}</p>
                            </div>
                        </div>
                        <span className={`font-bold ${point.isCompleted ? 'text-orange-400' : 'text-slate-600'}`}>
                            {point.isCompleted ? `+${point.points}` : '0'}
                        </span>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default ResultsView;