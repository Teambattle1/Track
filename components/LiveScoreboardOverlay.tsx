import React, { useState, useEffect } from 'react';
import { Team } from '../types';
import { Trophy, TrendingUp, TrendingDown, Minus, Medal, Award, Crown, ChevronUp, ChevronDown } from 'lucide-react';

interface LiveScoreboardOverlayProps {
  teams: Team[];
  showFullLeaderboard?: boolean;
  topCount?: number; // Number of top teams to show in compact mode
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onTeamClick?: (teamId: string) => void;
}

const LiveScoreboardOverlay: React.FC<LiveScoreboardOverlayProps> = ({ 
  teams, 
  showFullLeaderboard = false,
  topCount = 3,
  position = 'top-right',
  onTeamClick
}) => {
  const [isExpanded, setIsExpanded] = useState(showFullLeaderboard);
  const [previousRankings, setPreviousRankings] = useState<Record<string, number>>({});

  // Sort teams by score (descending)
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  // Track ranking changes
  useEffect(() => {
    const newRankings: Record<string, number> = {};
    sortedTeams.forEach((team, index) => {
      newRankings[team.id] = index + 1;
    });

    // Only update if there are actual changes
    const hasChanges = Object.keys(newRankings).some(
      teamId => newRankings[teamId] !== previousRankings[teamId]
    );

    if (hasChanges && Object.keys(previousRankings).length > 0) {
      setPreviousRankings(newRankings);
    } else if (Object.keys(previousRankings).length === 0) {
      setPreviousRankings(newRankings);
    }
  }, [sortedTeams, previousRankings]);

  const getRankChange = (teamId: string, currentRank: number): 'up' | 'down' | 'same' => {
    const previousRank = previousRankings[teamId];
    if (!previousRank || previousRank === currentRank) return 'same';
    if (currentRank < previousRank) return 'up'; // Lower rank number = better position
    return 'down';
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-orange-600" />;
      default:
        return <span className="text-xs font-black text-gray-500 w-5 text-center">#{rank}</span>;
    }
  };

  const getTeamColor = (teamName: string) => {
    let hash = 0;
    for (let i = 0; i < teamName.length; i++) {
      hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 right-4';
    }
  };

  const teamsToShow = isExpanded ? sortedTeams : sortedTeams.slice(0, topCount);

  if (teams.length === 0) {
    return null;
  }

  return (
    <div className={`absolute z-[1000] pointer-events-auto ${getPositionClasses()}`}>
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-orange-500 rounded-xl shadow-2xl overflow-hidden min-w-[280px] max-w-[320px]">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-white" />
            <h3 className="font-black text-sm text-white uppercase tracking-wider">Live Scoreboard</h3>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isExpanded ? 'Show top teams only' : 'Show all teams'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-white" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {/* Team List */}
        <div className="max-h-[400px] overflow-y-auto">
          {teamsToShow.map((team, index) => {
            const rank = index + 1;
            const rankChange = getRankChange(team.id, rank);
            const isTopThree = rank <= 3;

            return (
              <div
                key={team.id}
                onClick={() => onTeamClick?.(team.id)}
                className={`p-3 border-b border-slate-700 last:border-b-0 transition-all hover:bg-slate-700/50 ${
                  onTeamClick ? 'cursor-pointer' : ''
                } ${isTopThree ? 'bg-gradient-to-r from-yellow-900/10 to-transparent' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex flex-col items-center min-w-[24px]">
                    {getRankIcon(rank)}
                    {rankChange !== 'same' && (
                      <div className="mt-1">
                        {rankChange === 'up' ? (
                          <TrendingUp className="w-3 h-3 text-green-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Team Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getTeamColor(team.name) }}
                      />
                      <span className="font-bold text-sm text-white truncate">
                        {team.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        {team.members?.length || 0} members
                      </span>
                      {team.completedPointIds && team.completedPointIds.length > 0 && (
                        <>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-green-400">
                            {team.completedPointIds.length} completed
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex flex-col items-end">
                    <span className={`font-black text-lg ${
                      rank === 1 ? 'text-yellow-400' :
                      rank === 2 ? 'text-gray-300' :
                      rank === 3 ? 'text-orange-400' :
                      'text-white'
                    }`}>
                      {team.score}
                    </span>
                    <span className="text-[9px] text-gray-500 uppercase font-bold">points</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer - Show More */}
        {!isExpanded && sortedTeams.length > topCount && (
          <div className="p-2 bg-slate-800 border-t border-slate-700">
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full py-2 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors uppercase tracking-wider flex items-center justify-center gap-1"
            >
              Show All {sortedTeams.length} Teams
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Footer - Real-time indicator */}
        <div className="p-2 bg-slate-900 border-t border-slate-700 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">
            Live Updates
          </span>
        </div>
      </div>
    </div>
  );
};

export default LiveScoreboardOverlay;
