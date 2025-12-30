import React, { useState } from 'react';
import { Game } from '../types';
import { getFormattedLogs, getGameLogStats, exportGameLog } from '../utils/gameLog';
import { Download, AlertCircle, Clock, User, History } from 'lucide-react';
import { formatDateTime, formatDateShort } from '../utils/date';

interface GameLogViewerProps {
  game: Game | null | undefined;
}

const GameLogViewer: React.FC<GameLogViewerProps> = ({ game }) => {
  // Defensive input validation
  if (!game) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-slate-400 uppercase text-sm font-bold">No game data available</p>
        </div>
      </div>
    );
  }

  // Safely get formatted logs
  const logs = getFormattedLogs(game);
  const stats = getGameLogStats(game);
  const [showExport, setShowExport] = useState(false);

  // Handle export
  const handleExport = () => {
    const json = exportGameLog(game);
    if (!json) {
      alert('Failed to export log');
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.name || 'game'}-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-2">
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Total Changes</p>
          <p className="text-2xl font-black text-white">{stats.totalChanges || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Contributors</p>
          <p className="text-2xl font-black text-white">{stats.uniqueUsers || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Latest Change</p>
          <p className="text-sm font-bold text-orange-400">
            {stats.latestChange ? formatDateTime(stats.latestChange, game.language || 'English', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }) : '—'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Earliest Change</p>
          <p className="text-sm font-bold text-slate-400">
            {stats.earliestChange ? formatDateShort(stats.earliestChange, game.language || 'English') : '—'}
          </p>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold uppercase text-xs tracking-widest shadow-lg flex items-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export as JSON
        </button>
      </div>

      {/* Logs List */}
      {logs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl flex flex-col items-center justify-center text-center">
          <History className="w-16 h-16 text-slate-700 mb-4" />
          <h3 className="text-lg font-black text-white uppercase mb-2">No Changes Yet</h3>
          <p className="text-slate-400 text-sm max-w-xs">
            Changes made to this game will appear here. Start editing to begin tracking!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, idx) => (
            <div
              key={`${log.timestamp}-${idx}`}
              className="bg-slate-900 border border-slate-800 p-4 rounded-xl hover:border-slate-700 hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Action */}
                  <p className="text-sm font-bold text-white mb-2 break-words">
                    {log.action}
                  </p>

                  {/* User and Date/Time */}
                  <div className="flex flex-wrap gap-4 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="font-bold uppercase">{log.user || 'Unknown User'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="font-bold uppercase">{log.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="font-mono">{log.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-950/30 border border-blue-800/50 p-4 rounded-xl">
        <p className="text-[9px] text-blue-300 uppercase font-bold leading-relaxed">
          📝 Game Change Log: This log tracks all major modifications made to your game, including who made changes, when they were made, and what was modified. Use this for audit trails and understanding game evolution.
        </p>
      </div>
    </div>
  );
};

export default GameLogViewer;
