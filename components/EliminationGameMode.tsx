import React, { useState, useEffect, useRef } from 'react';
import { Game, GamePoint, Team, Coordinate } from '../types';
import { Bomb, MapPin, Trophy, Clock, AlertCircle, Users } from 'lucide-react';
import GameMap from './GameMap';

interface EliminationGameModeProps {
  game: Game;
  teams: Team[];
  userTeam: Team;
  userLocation?: Coordinate | null;
  onTaskCapture: (taskId: string) => void;
  onBombPlaced: (location: Coordinate, duration: 30 | 60 | 120) => void;
}

interface CooldownState {
  [taskId: string]: number; // Task ID -> remaining cooldown seconds
}

interface TeamColorAssignment {
  [teamId: string]: string;
}

// Predefined team colors for ELIMINATION mode
const TEAM_COLORS = ['#EF4444', '#F97316', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];

const EliminationGameMode: React.FC<EliminationGameModeProps> = ({
  game,
  teams,
  userTeam,
  userLocation,
  onTaskCapture,
  onBombPlaced,
}) => {
  const [teamColors, setTeamColors] = useState<TeamColorAssignment>({});
  const [cooldowns, setCooldowns] = useState<CooldownState>({});
  const [visiblePoints, setVisiblePoints] = useState<GamePoint[]>([]);
  const [bombCountdown, setBombCountdown] = useState<Record<string, number>>({});
  const [userBombsRemaining, setUserBombsRemaining] = useState(3);
  const gameMapRef = useRef<any>(null);

  // Initialize team colors
  useEffect(() => {
    const colors: TeamColorAssignment = {};
    teams.forEach((team, index) => {
      colors[team.id] = TEAM_COLORS[index % TEAM_COLORS.length];
    });
    setTeamColors(colors);
    
    // Initialize team colors in game if not already set
    if (!game.teamColors) {
      game.teamColors = colors;
    }
  }, [teams, game]);

  // Filter visible points - hide captured tasks
  useEffect(() => {
    const visible = game.points.filter(point => {
      // Show point if not captured or captured by own team
      if (!game.capturedTasks?.[point.id]) return true;
      return game.capturedTasks[point.id] === userTeam.id;
    });
    setVisiblePoints(visible);
  }, [game.points, game.capturedTasks, userTeam.id]);

  // Handle cooldown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(taskId => {
          updated[taskId] = Math.max(0, updated[taskId] - 1);
          if (updated[taskId] === 0) {
            delete updated[taskId];
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle bomb countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setBombCountdown(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(bombId => {
          updated[bombId] = Math.max(0, updated[bombId] - 1);
          if (updated[bombId] === 0) {
            delete updated[bombId];
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleTaskCapture = (taskId: string) => {
    // Check if task already captured by another team
    if (game.capturedTasks?.[taskId] && game.capturedTasks[taskId] !== userTeam.id) {
      alert('This task has already been captured by another team!');
      return;
    }

    // Check cooldown
    if (cooldowns[taskId]) {
      alert(`This task is on cooldown. Try again in ${cooldowns[taskId]} seconds.`);
      return;
    }

    onTaskCapture(taskId);
  };

  const handleWrongAttempt = (taskId: string) => {
    // Add 2-minute cooldown (120 seconds)
    setCooldowns(prev => ({
      ...prev,
      [taskId]: 120,
    }));
  };

  const handlePlaceBomb = (duration: 30 | 60 | 120) => {
    if (userBombsRemaining <= 0) {
      alert('No bombs remaining!');
      return;
    }

    if (!userLocation) {
      alert('Your location is not available. Make sure GPS is enabled.');
      return;
    }

    onBombPlaced(userLocation, duration);
    setUserBombsRemaining(prev => prev - 1);
    
    // Add countdown timer
    const bombId = `bomb-${Date.now()}`;
    setBombCountdown(prev => ({
      ...prev,
      [bombId]: duration,
    }));
  };

  const getCapturedTaskCount = (teamId: string) => {
    return Object.values(game.capturedTasks || {}).filter(id => id === teamId).length;
  };

  const getTeamDisplayInfo = (team: Team) => {
    const capturedCount = getCapturedTaskCount(team.id);
    const color = teamColors[team.id] || '#64748B';
    const isUserTeam = team.id === userTeam.id;

    return {
      capturedCount,
      color,
      isUserTeam,
    };
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map Container */}
      <div className="relative flex-1 z-0">
        <GameMap
          ref={gameMapRef}
          points={visiblePoints}
          teams={teams.map(team => ({
            team,
            location: team.members?.[0]?.location || { lat: 0, lng: 0 },
          }))}
          userLocation={userLocation}
          dangerZones={game.dangerZones}
        />
      </div>

      {/* Top HUD - Team Info & Bombs */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-3">
        {/* User Team Status */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex items-center gap-3 backdrop-blur-sm">
          <div
            className="w-8 h-8 rounded-full border-2 border-white"
            style={{ backgroundColor: teamColors[userTeam.id] }}
          />
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Your Team</div>
            <div className="text-sm font-bold text-white">{userTeam.name}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[11px] font-bold text-orange-400 uppercase">Captured</div>
            <div className="text-lg font-bold text-white">{getCapturedTaskCount(userTeam.id)}</div>
          </div>
        </div>

        {/* Bombs Remaining */}
        <div className="bg-slate-900 border border-red-700 rounded-lg p-3 flex items-center gap-2 backdrop-blur-sm">
          <Bomb className="w-5 h-5 text-red-400" />
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Bombs</div>
            <div className="text-sm font-bold text-white">{userBombsRemaining}/3</div>
          </div>
        </div>
      </div>

      {/* Bottom Leaderboard */}
      <div className="absolute bottom-4 left-4 right-4 z-10 max-h-32 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 backdrop-blur-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            Leaderboard
          </div>
          <div className="space-y-1">
            {teams
              .map(team => ({
                team,
                ...getTeamDisplayInfo(team),
              }))
              .sort((a, b) => b.capturedCount - a.capturedCount)
              .map(({ team, capturedCount, color, isUserTeam }) => (
                <div
                  key={team.id}
                  className={`flex items-center gap-2 p-2 rounded ${isUserTeam ? 'bg-slate-800 border border-orange-500' : 'bg-slate-800'}`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11px] font-bold text-white flex-1 truncate">{team.name}</span>
                  <span className="text-[11px] font-bold text-orange-400">{capturedCount}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Cooldown Alert */}
      {Object.keys(cooldowns).length > 0 && (
        <div className="absolute bottom-40 right-4 z-10 bg-red-900 border border-red-700 rounded-lg p-3 backdrop-blur-sm max-w-xs">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-red-300 uppercase">Cooldown Active</div>
              <div className="text-xs text-red-200 mt-1">
                Try a different task or wait {Math.max(...Object.values(cooldowns))} seconds
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bomb Placement Panel */}
      {userBombsRemaining > 0 && (
        <div className="absolute bottom-4 right-4 z-10 bg-slate-900 border border-red-700 rounded-lg p-3 backdrop-blur-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Place Bomb</div>
          <div className="space-y-2">
            <button
              onClick={() => handlePlaceBomb(30)}
              className="w-full px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-100 text-xs font-bold rounded transition-colors"
            >
              30s Bomb
            </button>
            <button
              onClick={() => handlePlaceBomb(60)}
              className="w-full px-3 py-1.5 bg-orange-900 hover:bg-orange-800 text-orange-100 text-xs font-bold rounded transition-colors"
            >
              1m Bomb
            </button>
            <button
              onClick={() => handlePlaceBomb(120)}
              className="w-full px-3 py-1.5 bg-yellow-900 hover:bg-yellow-800 text-yellow-100 text-xs font-bold rounded transition-colors"
            >
              2m Bomb
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EliminationGameMode;
