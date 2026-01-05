import React, { useMemo } from 'react';
import { Game, Team, GamePoint } from '../types';
import { CheckCircle, Trophy, Users, MapPin, Clock } from 'lucide-react';
import { getTeamCapturedTasks } from '../utils/eliminationLogic';
import { formatDateTime } from '../utils/date';
import { getUniqueTaskKey } from '../utils/taskKeyUtils';

interface CapturedTasksPlaygroundProps {
  game: Game;
  teams: Team[];
  userTeamId?: string;
  className?: string;
}

/**
 * Displays all tasks captured by each team in elimination mode
 * Shows when each task was captured and by which team
 */
const CapturedTasksPlayground: React.FC<CapturedTasksPlaygroundProps> = ({
  game,
  teams,
  userTeamId,
  className = '',
}) => {
  const teamTasksMap = useMemo(() => {
    const map: Record<string, GamePoint[]> = {};
    teams.forEach(team => {
      map[team.id] = getTeamCapturedTasks(game, team.id);
    });
    return map;
  }, [game, teams]);

  const totalCaptured = Object.values(game.capturedTasks || {}).length;
  const totalTasks = game.points.length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h2 className="text-lg font-bold text-white">CAPTURED TASKS</h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400">Progress</div>
            <div className="text-2xl font-bold text-orange-400">
              {totalCaptured}/{totalTasks}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Tasks captured by each team in order of completion
        </p>
      </div>

      {/* Team Captures */}
      <div className="grid gap-4">
        {teams.map(team => {
          const capturedTasks = teamTasksMap[team.id];
          const color = game.teamColors?.[team.id] || '#64748B';
          const isUserTeam = team.id === userTeamId;

          return (
            <div
              key={team.id}
              className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${
                isUserTeam ? 'border-orange-500' : 'border-slate-700'
              }`}
            >
              {/* Team Header */}
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ backgroundColor: color + '20', borderBottom: `2px solid ${color}` }}
              >
                <div
                  className="w-10 h-10 rounded-lg border-2 border-white flex items-center justify-center font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {capturedTasks.length}
                </div>
                <div className="flex-1">
                  <div className={`font-bold ${isUserTeam ? 'text-orange-400' : 'text-white'}`}>
                    {team.name}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <Users className="w-3 h-3" />
                    {team.members?.length || 0} members
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-300">
                    {((capturedTasks.length / totalTasks) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Captured Tasks List */}
              <div className="p-4">
                {capturedTasks.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    No tasks captured yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {capturedTasks.map((task, index) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700"
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: color }}
                        >
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white truncate flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            {task.title}
                          </div>

                          {task.location && (
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {task.location.lat.toFixed(4)}, {task.location.lng.toFixed(4)}
                            </div>
                          )}

                          {task.task?.question && (
                            <div className="text-xs text-slate-400 mt-1 truncate">
                              {task.task.question}
                            </div>
                          )}
                        </div>

                        {/* Points */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-orange-400">
                            +{task.points || 0}
                          </div>
                          <div className="text-[10px] text-slate-400">pts</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {totalCaptured === totalTasks && (
        <div className="bg-gradient-to-r from-green-900 to-emerald-900 border-2 border-green-500 rounded-xl p-6 text-center space-y-2">
          <Trophy className="w-8 h-8 text-yellow-400 mx-auto" />
          <h3 className="text-xl font-bold text-white">GAME COMPLETE!</h3>
          <p className="text-sm text-green-200">
            All {totalTasks} tasks have been captured. Final results above.
          </p>
        </div>
      )}

      {/* Remaining Tasks */}
      {totalCaptured < totalTasks && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
          <div className="text-xs font-bold text-slate-400 uppercase mb-2">Remaining Tasks</div>
          <div className="flex flex-wrap gap-2">
            {game.points
              .filter(point => !game.capturedTasks?.[point.id])
              .map(point => (
                <div
                  key={point.id}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs font-bold text-slate-300 hover:border-slate-500 transition-colors"
                  title={point.title}
                >
                  {point.title.substring(0, 12)}...
                </div>
              ))}
          </div>
          <div className="text-[10px] text-slate-400 mt-2">
            {totalTasks - totalCaptured} of {totalTasks} tasks remaining
          </div>
        </div>
      )}
    </div>
  );
};

export default CapturedTasksPlayground;
