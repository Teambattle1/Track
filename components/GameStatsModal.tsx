import React, { useMemo, useState } from 'react';
import { X, Users, Map, CheckCircle, TrendingUp, Save, Loader2 } from 'lucide-react';
import { Game, Team } from '../types';
import * as db from '../services/db';

interface GameStatsModalProps {
  onClose: () => void;
  game: Game | null;
  teams: { team: Team, location: any, memberCount?: number }[];
}

const GameStatsModal: React.FC<GameStatsModalProps> = ({ onClose, game, teams }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Calculate team stats
  const teamStats = useMemo(() => {
    if (!game || !teams) return [];

    return teams.map(({ team, location, memberCount = 1 }) => {
      // Count completed tasks for this team
      const completedTasks = team.score ? Math.floor(team.score / 10) : 0; // Rough estimate

      // Calculate distance walked (from team captain location to game center)
      const gameCenter = game.points && game.points.length > 0
        ? {
            lat: game.points.reduce((sum, p) => sum + (p.location?.lat || 0), 0) / game.points.length,
            lng: game.points.reduce((sum, p) => sum + (p.location?.lng || 0), 0) / game.points.length
          }
        : { lat: 0, lng: 0 };

      const captainDistanceKm = location && gameCenter
        ? haversineKm(location, gameCenter)
        : 0;

      // Total distance = captain distance × number of team members
      const totalDistanceKm = captainDistanceKm * memberCount;

      // Calculate TASK/KM ratio
      const taskPerKm = totalDistanceKm > 0 ? (completedTasks / totalDistanceKm).toFixed(2) : '0';

      return {
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
        completedTasks,
        captainDistanceKm: captainDistanceKm.toFixed(1),
        totalDistanceKm: totalDistanceKm.toFixed(1),
        taskPerKm,
        score: team.score || 0,
        memberCount
      };
    }).sort((a, b) => b.score - a.score); // Sort by score descending
  }, [game, teams]);

  const handleSaveStats = async () => {
    if (!game) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Prepare stats data for saving
      const statsData = {
        gameId: game.id,
        gameName: game.name,
        timestamp: new Date().toISOString(),
        teams: teamStats.map(stat => ({
          teamId: stat.teamId,
          teamName: stat.teamName,
          score: stat.score,
          completedTasks: stat.completedTasks,
          captainDistanceKm: parseFloat(stat.captainDistanceKm),
          totalDistanceKm: parseFloat(stat.totalDistanceKm),
          taskPerKmRatio: parseFloat(stat.taskPerKm),
          memberCount: stat.memberCount
        })),
        totalStats: {
          teamsCount: teamStats.length,
          totalTasksCompleted: teamStats.reduce((sum, t) => sum + t.completedTasks, 0),
          averageScore: teamStats.length > 0
            ? Math.round(teamStats.reduce((sum, t) => sum + t.score, 0) / teamStats.length)
            : 0,
          totalDistanceWalked: teamStats.reduce((sum, t) => sum + parseFloat(t.totalDistanceKm), 0)
        }
      };

      // Save to Supabase
      await db.saveGameStats(statsData);

      setSaveMessage({
        type: 'success',
        text: 'Game statistics saved successfully!'
      });

      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving game stats:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to save game statistics. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border border-gray-700">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-cyan-900/30 to-blue-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-black text-white uppercase tracking-wider">GAME STATISTICS</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {teamStats.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-bold">No teams in game yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header Row */}
              <div className="grid grid-cols-5 gap-3 mb-4 px-4 py-2 bg-gray-800/50 rounded-lg">
                <div className="text-xs font-black text-gray-400 uppercase tracking-wider">TEAM</div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-wider text-center">TASKS</div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-wider text-center">DISTANCE</div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-wider text-center">TASK/KM</div>
                <div className="text-xs font-black text-gray-400 uppercase tracking-wider text-right">SCORE</div>
              </div>

              {/* Team Rows */}
              {teamStats.map((stat, idx) => (
                <div
                  key={stat.teamId}
                  className="grid grid-cols-5 gap-3 p-4 rounded-xl border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  {/* Team Name */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stat.teamColor || '#3b82f6' }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{stat.teamName}</p>
                      <p className="text-[10px] text-gray-500">#{idx + 1}</p>
                    </div>
                  </div>

                  {/* Tasks Completed */}
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl font-black text-cyan-400">{stat.completedTasks}</p>
                      <p className="text-[9px] text-gray-500 font-bold">TASKS</p>
                    </div>
                  </div>

                  {/* Distance */}
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl font-black text-orange-400">{stat.distanceKm}</p>
                      <p className="text-[9px] text-gray-500 font-bold">KM</p>
                    </div>
                  </div>

                  {/* TASK/KM Ratio */}
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl font-black text-green-400">{stat.taskPerKm}</p>
                      <p className="text-[9px] text-gray-500 font-bold">RATIO</p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center justify-end">
                    <div className="text-center">
                      <p className="text-lg font-black text-white">{stat.score}</p>
                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto mt-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition-colors uppercase text-sm tracking-wider"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Haversine formula to calculate distance between two coordinates in km
function haversineKm(coord1: any, coord2: any): number {
  if (!coord1 || !coord2) return 0;
  
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default GameStatsModal;
