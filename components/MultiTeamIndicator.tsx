import React from 'react';
import { Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Team } from '../types';

interface MultiTeamIndicatorProps {
  requiredCount: number; // Number of teams needed
  activeTeams: Team[]; // Teams currently in proximity
  allTeams: Team[]; // All teams in the game
  mode?: 'compact' | 'detailed';
}

const MultiTeamIndicator: React.FC<MultiTeamIndicatorProps> = ({ 
  requiredCount, 
  activeTeams, 
  allTeams,
  mode = 'detailed'
}) => {
  const currentCount = activeTeams.length;
  const isReady = currentCount >= requiredCount;
  const progress = (currentCount / requiredCount) * 100;

  const getTeamColor = (teamName: string) => {
    let hash = 0;
    for (let i = 0; i < teamName.length; i++) {
      hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  };

  if (mode === 'compact') {
    return (
      <div className={`px-3 py-2 rounded-lg border-2 flex items-center gap-2 ${
        isReady 
          ? 'bg-green-500/20 border-green-500' 
          : 'bg-orange-500/20 border-orange-500 animate-pulse'
      }`}>
        <Users className={`w-4 h-4 ${isReady ? 'text-green-500' : 'text-orange-500'}`} />
        <span className={`text-xs font-bold ${isReady ? 'text-green-400' : 'text-orange-400'}`}>
          {currentCount}/{requiredCount} TEAMS
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-2 border-purple-600 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <h3 className="font-black text-sm text-white uppercase tracking-wider">Multi-Team Challenge</h3>
        </div>
        {isReady ? (
          <div className="flex items-center gap-1 bg-green-500/20 border border-green-500 rounded-full px-2 py-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs font-bold text-green-400">READY</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500 rounded-full px-2 py-1 animate-pulse">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold text-orange-400">WAITING</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 mb-3">
        {requiredCount} teams must be in proximity to activate this challenge
      </p>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-bold mb-2">
          <span className="text-gray-400">TEAMS IN RANGE</span>
          <span className={isReady ? 'text-green-400' : 'text-orange-400'}>
            {currentCount} / {requiredCount}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              isReady ? 'bg-green-500' : 'bg-orange-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Active Teams */}
      {activeTeams.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Teams in Range ({activeTeams.length})
          </p>
          <div className="space-y-1">
            {activeTeams.map(team => (
              <div 
                key={team.id} 
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5"
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getTeamColor(team.name) }}
                />
                <span className="text-xs font-bold text-white">{team.name}</span>
                <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting for More Teams */}
      {!isReady && (
        <div className="mt-3 pt-3 border-t border-purple-600/30">
          <p className="text-xs text-purple-300 font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 animate-pulse" />
            Waiting for {requiredCount - currentCount} more team{requiredCount - currentCount !== 1 ? 's' : ''}...
          </p>
        </div>
      )}

      {/* Success Message */}
      {isReady && (
        <div className="mt-3 pt-3 border-t border-green-600/30">
          <p className="text-xs text-green-300 font-bold flex items-center gap-2 animate-pulse">
            <CheckCircle className="w-4 h-4" />
            All teams assembled! Challenge can begin.
          </p>
        </div>
      )}
    </div>
  );
};

export default MultiTeamIndicator;
