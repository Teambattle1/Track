import React from 'react';
import { Destination, TeamDestinationProgress, Team } from '../types';
import { Trophy, Flag, MapPin, Star, Crown, ChevronRight, X } from 'lucide-react';

interface TeamProgress {
  team: Team;
  currentDestination?: Destination;
  completedDestinations: number;
  totalTasks: number;
  completedTasks: number;
  hasFirstArrivals: number;
}

interface TeamRaceOverlayProps {
  teams: Team[];
  destinations: Destination[];
  teamProgress: TeamDestinationProgress[];
  onClose: () => void;
  isVisible: boolean;
  currentTeamId?: string;
}

/**
 * TeamRaceOverlay - Competition leaderboard overlay for Around the World mode
 * Shows all teams' progress, current positions, and first arrivals
 */
const TeamRaceOverlay: React.FC<TeamRaceOverlayProps> = ({
  teams,
  destinations,
  teamProgress,
  onClose,
  isVisible,
  currentTeamId
}) => {
  // Calculate progress for each team
  const teamProgressData: TeamProgress[] = React.useMemo(() => {
    return teams.map(team => {
      const progress = teamProgress.filter(tp => tp.teamId === team.id);
      const completedDestinations = progress.filter(tp => tp.isCompleted).length;
      const totalTasks = progress.reduce((sum, tp) => sum + tp.completedTasks.length, 0);

      // Find current destination (last unlocked but not completed)
      const unlockedNotCompleted = progress.filter(tp => tp.isUnlocked && !tp.isCompleted);
      const currentDestinationProgress = unlockedNotCompleted[unlockedNotCompleted.length - 1];
      const currentDestination = currentDestinationProgress
        ? destinations.find(d => d.id === currentDestinationProgress.destinationId)
        : undefined;

      // Count first arrivals (completed with arrivedAt matching first timestamp)
      const hasFirstArrivals = progress.filter(tp => {
        if (!tp.isCompleted || !tp.completedAt) return false;
        // Check if this team was first to complete this destination
        const allCompletions = teamProgress
          .filter(other => other.destinationId === tp.destinationId && other.isCompleted && other.completedAt)
          .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
        return allCompletions[0]?.teamId === team.id;
      }).length;

      return {
        team,
        currentDestination,
        completedDestinations,
        totalTasks,
        completedTasks: totalTasks,
        hasFirstArrivals
      };
    }).sort((a, b) => {
      // Sort by completed destinations, then by total tasks, then by first arrivals
      if (b.completedDestinations !== a.completedDestinations) {
        return b.completedDestinations - a.completedDestinations;
      }
      if (b.totalTasks !== a.totalTasks) {
        return b.totalTasks - a.totalTasks;
      }
      return b.hasFirstArrivals - a.hasFirstArrivals;
    });
  }, [teams, destinations, teamProgress]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-start justify-end p-4 pointer-events-none">
      <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border-2 border-yellow-500/60 rounded-2xl shadow-2xl w-full max-w-sm animate-in slide-in-from-right-4 fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-gradient-to-r from-yellow-900/30 to-orange-900/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-yellow-600/30 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Race Standings</h3>
              <p className="text-[9px] text-yellow-400/80 uppercase tracking-wide">
                {destinations.length} Destinations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Team List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {teamProgressData.length === 0 ? (
            <div className="p-6 text-center">
              <Flag className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No teams yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {teamProgressData.map((data, index) => {
                const isCurrentTeam = data.team.id === currentTeamId;
                const isLeader = index === 0;

                return (
                  <div
                    key={data.team.id}
                    className={`p-3 transition-colors ${
                      isCurrentTeam
                        ? 'bg-cyan-900/20 border-l-4 border-cyan-500'
                        : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                        index === 0 ? 'bg-yellow-500 text-yellow-900' :
                        index === 1 ? 'bg-slate-300 text-slate-700' :
                        index === 2 ? 'bg-orange-600 text-orange-100' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {isLeader ? (
                          <Crown className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>

                      {/* Team Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold truncate ${
                            isCurrentTeam ? 'text-cyan-300' : 'text-white'
                          }`}>
                            {data.team.name}
                          </span>
                          {isCurrentTeam && (
                            <span className="text-[8px] bg-cyan-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase">
                              You
                            </span>
                          )}
                        </div>

                        {/* Current Destination */}
                        <div className="flex items-center gap-1 mt-0.5">
                          {data.currentDestination ? (
                            <>
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span className="text-[10px] text-slate-400 truncate">
                                {data.currentDestination.flagEmoji} {data.currentDestination.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              {data.completedDestinations === destinations.length ? 'Finished!' : 'Starting...'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-col items-end gap-1">
                        {/* Destinations Progress */}
                        <div className="flex items-center gap-1">
                          <Flag className="w-3 h-3 text-green-400" />
                          <span className="text-xs font-bold text-green-400">
                            {data.completedDestinations}/{destinations.length}
                          </span>
                        </div>

                        {/* First Arrivals */}
                        {data.hasFirstArrivals > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400" />
                            <span className="text-[10px] font-bold text-yellow-400">
                              {data.hasFirstArrivals} first{data.hasFirstArrivals > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isCurrentTeam
                            ? 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                        }`}
                        style={{
                          width: `${destinations.length > 0
                            ? (data.completedDestinations / destinations.length) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - First Arrival Info */}
        <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <Star className="w-3 h-3 text-yellow-400" />
            <span>First team to reach a destination earns bonus points!</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamRaceOverlay;
