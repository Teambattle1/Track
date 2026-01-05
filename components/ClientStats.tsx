import React from 'react';
import { Game, Team } from '../types';
import { BarChart3, CheckCircle, XCircle, Image as ImageIcon, Video, Clock } from 'lucide-react';
import { getUniqueTaskKey } from '../utils/taskKeyUtils';

interface ClientStatsProps {
  game: Game;
  teams: Team[];
}

const ClientStats: React.FC<ClientStatsProps> = ({ game, teams }) => {
  const tasks = game.points.filter(p => !p.isSectionHeader && !p.playgroundId);

  const getTaskCompletionStatus = (taskId: string, teamId: string): 'correct' | 'incorrect' | 'media' | 'pending' => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return 'pending';

    const isCompleted = team.completedPointIds?.includes(taskId);
    if (!isCompleted) return 'pending';

    // Check if it's a media task (photo/video)
    const task = tasks.find(t => t.id === taskId);
    if (task?.task.type === 'photo' || task?.task.type === 'video') {
      return 'media';
    }

    // For now, assume completed = correct
    // In a real implementation, you'd track correct/incorrect answers
    return 'correct';
  };

  const getStatusIcon = (status: 'correct' | 'incorrect' | 'media' | 'pending') => {
    switch (status) {
      case 'correct':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'incorrect':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'media':
        return <ImageIcon className="w-5 h-5 text-blue-400" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBgColor = (status: 'correct' | 'incorrect' | 'media' | 'pending') => {
    switch (status) {
      case 'correct':
        return 'bg-green-500/20 border-green-500';
      case 'incorrect':
        return 'bg-red-500/20 border-red-500';
      case 'media':
        return 'bg-blue-500/20 border-blue-400';
      case 'pending':
        return 'bg-gray-700/20 border-gray-600';
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 font-bold">No tasks in this game</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-blue-400" />
          Task Statistics
        </h2>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 bg-black/30 rounded-lg p-4 border border-purple-500/20">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="text-sm text-white font-bold">Correct</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-white font-bold">Incorrect</span>
        </div>
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-blue-400" />
          <span className="text-sm text-white font-bold">Media Submission</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <span className="text-sm text-white font-bold">Not Attempted</span>
        </div>
      </div>

      {/* Task Grid */}
      <div className="space-y-4">
        {tasks.map((task, taskIndex) => {
          const completedCount = teams.filter(team => 
            team.completedPointIds?.includes(task.id)
          ).length;
          const completionRate = teams.length > 0 
            ? Math.round((completedCount / teams.length) * 100) 
            : 0;

          return (
            <div
              key={getUniqueTaskKey(task.id, taskIndex)}
              className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 hover:border-purple-500/50 transition-all"
            >
              {/* Task Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-purple-400 uppercase">
                      Task #{taskIndex + 1}
                    </span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-400">{task.points} points</span>
                  </div>
                  <h3 className="font-bold text-white text-lg">{task.title}</h3>
                  {task.shortIntro && (
                    <p className="text-sm text-gray-400 mt-1">{task.shortIntro}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white">{completionRate}%</p>
                  <p className="text-xs text-gray-500 uppercase">Completion</p>
                </div>
              </div>

              {/* Completion Bar */}
              <div className="mb-4">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>

              {/* Team Status Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {teams.map(team => {
                  const status = getTaskCompletionStatus(task.id, team.id);
                  return (
                    <div
                      key={team.id}
                      className={`p-3 rounded-lg border-2 ${getStatusBgColor(status)} transition-all hover:scale-105`}
                      title={`${team.name} - ${status}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate flex-1">
                          {team.name}
                        </span>
                        {getStatusIcon(status)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-3 pt-3 border-t border-purple-500/20 flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  {completedCount} of {teams.length} teams completed
                </span>
                <span className="text-gray-500">
                  {teams.length - completedCount} remaining
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClientStats;
