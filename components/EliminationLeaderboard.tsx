import React, { useMemo } from 'react';
import { Game, Team } from '../types';
import { Trophy, Target, Medal } from 'lucide-react';
import { getTeamCaptureCount, getEliminationLeaderboard } from '../utils/eliminationLogic';

interface EliminationLeaderboardProps {
  game: Game;
  teams: Team[];
  userTeamId: string;
  className?: string;
  compact?: boolean;
}

/**
 * Real-time leaderboard showing team rankings based on captured tasks
 * Displays team colors, names, and capture counts
 * Highlights user's team
 */
const EliminationLeaderboard: React.FC<EliminationLeaderboardProps> = ({
  game,
  teams,
  userTeamId,
  className = '',
  compact = false,
}) => {
  const leaderboard = useMemo(() => {
    return getEliminationLeaderboard(game, teams);
  }, [game, teams]);

  const totalTasks = game.points.length;
  const capturedCount = Object.keys(game.capturedTasks || {}).length;

  if (compact) {
    return (
      <div className={`bg-slate-900 border border-slate-700 rounded-lg p-3 backdrop-blur-sm ${className}`}>
        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5" />
          Leaderboard
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {leaderboard.map(({ team, captureCount }, index) => {
            const color = game.teamColors?.[team.id] || '#64748B';
            const isUserTeam = team.id === userTeamId;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

            return (
              <div
                key={team.id}
                className={`flex items-center gap-2 p-2 rounded text-[11px] ${
                  isUserTeam ? 'bg-slate-800 border border-orange-500' : 'bg-slate-800'
                }`}
              >
                {medal && <span className="w-4">{medal}</span>}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-bold text-white flex-1 truncate">{team.name}</span>
                <span className="font-bold text-orange-400">{captureCount}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h2 className="text-lg font-bold text-white">ELIMINATION LEADERBOARD</h2>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-slate-400">Tasks Captured</div>
          <div className="text-2xl font-bold text-orange-400">{capturedCount}/{totalTasks}</div>
        </div>
      </div>

      {/* Leaderboard Entries */}
      <div className="space-y-2">
        {leaderboard.map(({ team, captureCount }, index) => {
          const color = game.teamColors?.[team.id] || '#64748B';
          const isUserTeam = team.id === userTeamId;
          const medals = ['🥇', '🥈', '🥉'];
          const medal = index < 3 ? medals[index] : `${index + 1}.`;
          const percentage = (captureCount / totalTasks) * 100;

          return (
            <div
              key={team.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                isUserTeam
                  ? 'bg-slate-800 border-orange-500'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-xl font-black text-slate-400 w-8 text-center">{medal}</div>
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-white"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1">
                    <div className={`font-bold ${isUserTeam ? 'text-orange-400' : 'text-white'}`}>
                      {team.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {team.members?.length || 0} members
                    </div>
                  </div>
                </div>

                {/* Capture Count */}
                <div className="text-right">
                  <div className="text-3xl font-black text-orange-400">{captureCount}</div>
                  <div className="text-[10px] text-slate-400">
                    {percentage > 0 ? `${percentage.toFixed(0)}%` : '0%'}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r transition-all"
                  style={{
                    backgroundColor: color,
                    width: `${percentage}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats Footer */}
      <div className="pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">Total Tasks</div>
          <div className="text-2xl font-bold text-white">{totalTasks}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">Captured</div>
          <div className="text-2xl font-bold text-orange-400">{capturedCount}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">Remaining</div>
          <div className="text-2xl font-bold text-slate-400">{totalTasks - capturedCount}</div>
        </div>
      </div>
    </div>
  );
};

export default EliminationLeaderboard;
