import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Game, GamePoint, Destination, TeamDestinationProgress, Team,
  Coordinate, AroundTheWorldConfig
} from '../types';
import WorldMapCanvas from './WorldMapCanvas';
import DestinationPanel from './DestinationPanel';
import TeamRaceOverlay from './TeamRaceOverlay';
import FieldMissionIndicator from './FieldMissionIndicator';
import TaskModal from './TaskModal';
import IntroMessageModal from './IntroMessageModal';
import FinishMessageModal from './FinishMessageModal';
import QRScannerModal from './QRScannerModal';
import {
  Trophy, Settings, Users, MessageSquare, Home, QrCode,
  Globe, Flag, MapPin, ChevronUp, ChevronDown, Clock,
  Star, Compass, X, Menu, Volume2, VolumeX
} from 'lucide-react';

interface AroundTheWorldGameViewProps {
  game: Game;
  teams: Team[];
  currentTeam?: Team;
  isInstructor: boolean;
  userLocation: Coordinate | null;
  onTaskComplete: (taskId: string, isCorrect: boolean, points: number) => void;
  onUpdateGame: (game: Game) => void;
  onClose: () => void;
  onOpenChat?: () => void;
  onOpenTeamLobby?: () => void;
  showScores: boolean;
  currentScore: number;
}

// Default Around the World config
const DEFAULT_CONFIG: AroundTheWorldConfig = {
  mapStyle: 'world',
  tasksRequiredToUnlock: 3,
  initialUnlockedCount: 1,
  firstArrivalBonus: 100,
  showTeamPositions: true,
  fieldMissionsEnabled: true,
  defaultFieldRadius: 50
};

/**
 * AroundTheWorldGameView - Main game view for Around the World mode
 * Features world map, destinations, progression, field missions, and competition
 */
const AroundTheWorldGameView: React.FC<AroundTheWorldGameViewProps> = ({
  game,
  teams,
  currentTeam,
  isInstructor,
  userLocation,
  onTaskComplete,
  onUpdateGame,
  onClose,
  onOpenChat,
  onOpenTeamLobby,
  showScores,
  currentScore
}) => {
  // Config
  const config = game.aroundTheWorldConfig || DEFAULT_CONFIG;
  const destinations = game.destinations || [];
  const teamProgress = game.teamDestinationProgress || [];

  // UI State
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [showRaceOverlay, setShowRaceOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsPasswordError, setSettingsPasswordError] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [introShown, setIntroShown] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishShown, setFinishShown] = useState(false);
  const [gameTime, setGameTime] = useState('00:00');
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Active field mission state
  const [activeFieldMission, setActiveFieldMission] = useState<GamePoint | null>(null);

  // Get current team's progress
  const currentTeamProgress = useMemo(() => {
    if (!currentTeam) return [];
    return teamProgress.filter(tp => tp.teamId === currentTeam.id);
  }, [currentTeam, teamProgress]);

  // Get tasks for a destination
  const getDestinationTasks = useCallback((destinationId: string): GamePoint[] => {
    return game.points.filter(p => p.destinationId === destinationId);
  }, [game.points]);

  // Get destination progress
  const getDestinationProgress = useCallback((destinationId: string): TeamDestinationProgress | null => {
    return currentTeamProgress.find(tp => tp.destinationId === destinationId) || null;
  }, [currentTeamProgress]);

  // Check if destination is unlocked
  const isDestinationUnlocked = useCallback((destination: Destination): boolean => {
    if (isInstructor) return true;

    // Initial destinations are always unlocked
    if (destination.unlockOrder < config.initialUnlockedCount) return true;

    const progress = getDestinationProgress(destination.id);
    return progress?.isUnlocked ?? false;
  }, [config.initialUnlockedCount, getDestinationProgress, isInstructor]);

  // Check if destination is completed
  const isDestinationCompleted = useCallback((destination: Destination): boolean => {
    const progress = getDestinationProgress(destination.id);
    return progress?.isCompleted ?? false;
  }, [getDestinationProgress]);

  // Check if team was first to arrive
  const isFirstArrival = useCallback((destinationId: string): boolean => {
    if (!currentTeam) return false;

    const allCompletions = teamProgress
      .filter(tp => tp.destinationId === destinationId && tp.isCompleted && tp.completedAt)
      .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

    return allCompletions[0]?.teamId === currentTeam.id;
  }, [currentTeam, teamProgress]);

  // Calculate total progress
  const totalProgress = useMemo(() => {
    const completed = currentTeamProgress.filter(tp => tp.isCompleted).length;
    return {
      completed,
      total: destinations.length,
      percent: destinations.length > 0 ? Math.round((completed / destinations.length) * 100) : 0
    };
  }, [currentTeamProgress, destinations]);

  // Handle destination click
  const handleDestinationClick = (destination: Destination) => {
    if (!isInstructor && !isDestinationUnlocked(destination)) return;
    setSelectedDestination(destination);
  };

  // Handle task selection
  const handleTaskSelect = (task: GamePoint) => {
    // If it's a field mission and we're not at the location, show the field mission indicator
    if (task.isFieldMission && task.fieldMissionLocation && !isInstructor) {
      setActiveFieldMission(task);
    } else {
      setActiveTaskId(task.id);
    }
    setSelectedDestination(null);
  };

  // Handle task completion
  const handleTaskComplete = async (taskId: string, isCorrect: boolean, points: number) => {
    const task = game.points.find(p => p.id === taskId);
    if (!task || !currentTeam || !task.destinationId) return;

    // Update team progress
    const destProgress = getDestinationProgress(task.destinationId);
    const completedTasks = destProgress?.completedTasks || [];

    if (!completedTasks.includes(taskId)) {
      completedTasks.push(taskId);
    }

    // Check if destination is now completed
    const destinationTasks = getDestinationTasks(task.destinationId);
    const destination = destinations.find(d => d.id === task.destinationId);
    const requiredTasks = destination?.requiredTasks || config.tasksRequiredToUnlock;
    const isNowCompleted = completedTasks.length >= requiredTasks;

    // Update progress
    const newProgress: TeamDestinationProgress = {
      teamId: currentTeam.id,
      destinationId: task.destinationId,
      completedTasks,
      isUnlocked: true,
      isCompleted: isNowCompleted,
      completedAt: isNowCompleted ? Date.now() : destProgress?.completedAt,
      arrivedAt: destProgress?.arrivedAt || Date.now()
    };

    // Update team progress in game
    const updatedProgress = teamProgress.filter(
      tp => !(tp.teamId === currentTeam.id && tp.destinationId === task.destinationId)
    );
    updatedProgress.push(newProgress);

    // If destination completed, unlock next destinations
    if (isNowCompleted) {
      const nextDestinations = destinations.filter(d => d.unlockOrder === destination!.unlockOrder + 1);
      nextDestinations.forEach(nextDest => {
        const existingProgress = updatedProgress.find(
          tp => tp.teamId === currentTeam.id && tp.destinationId === nextDest.id
        );
        if (!existingProgress) {
          updatedProgress.push({
            teamId: currentTeam.id,
            destinationId: nextDest.id,
            completedTasks: [],
            isUnlocked: true,
            isCompleted: false,
            arrivedAt: Date.now()
          });
        }
      });

      // Check for first arrival bonus
      const wasFirst = !teamProgress.some(
        tp => tp.destinationId === task.destinationId && tp.isCompleted && tp.teamId !== currentTeam.id
      );

      if (wasFirst && config.firstArrivalBonus > 0) {
        points += config.firstArrivalBonus;
      }
    }

    // Update game
    onUpdateGame({
      ...game,
      teamDestinationProgress: updatedProgress
    });

    // Call parent completion handler
    onTaskComplete(taskId, isCorrect, points);

    // Clear active field mission if applicable
    if (activeFieldMission?.id === taskId) {
      setActiveFieldMission(null);
    }

    setActiveTaskId(null);
  };

  // Handle field mission arrival
  const handleFieldMissionArrival = () => {
    if (activeFieldMission) {
      setActiveTaskId(activeFieldMission.id);
      setActiveFieldMission(null);
    }
  };

  // Timer effect
  useEffect(() => {
    if (isInstructor || !game.timerConfig || game.timerConfig.mode === 'none') return;

    const updateTimer = () => {
      let target: number | null = null;

      if (game.timerConfig?.mode === 'scheduled_end' && game.timerConfig?.endTime) {
        target = new Date(game.timerConfig.endTime).getTime();
      } else if (game.timerConfig?.mode === 'countdown' && game.timerConfig?.startTime && game.timerConfig?.durationMinutes) {
        const start = new Date(game.timerConfig.startTime).getTime();
        target = start + (game.timerConfig.durationMinutes * 60 * 1000);
      }

      if (target) {
        const now = Date.now();
        const diff = target - now;
        if (diff <= 0) {
          setGameTime('00:00');
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setGameTime(h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [game.timerConfig, isInstructor]);

  // Show intro modal on start
  useEffect(() => {
    if (!isInstructor && game.introMessageConfig?.enabled && !introShown) {
      setShowIntroModal(true);
      setIntroShown(true);
    }
  }, [game.introMessageConfig, introShown, isInstructor]);

  // Check for game completion
  useEffect(() => {
    if (!isInstructor && game.finishMessageConfig?.enabled && !finishShown) {
      // Check if all destinations completed
      if (totalProgress.completed === totalProgress.total && totalProgress.total > 0) {
        setShowFinishModal(true);
        setFinishShown(true);
      }
    }
  }, [game.finishMessageConfig, totalProgress, finishShown, isInstructor]);

  // Get active task for modal
  const activeTask = activeTaskId ? game.points.find(p => p.id === activeTaskId) : null;

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col overflow-hidden">
      {/* Header Bar */}
      <div className="relative z-50 h-14 bg-gradient-to-r from-cyan-900/90 via-blue-900/90 to-indigo-900/90 backdrop-blur-md border-b border-cyan-500/30 flex items-center justify-between px-4 shadow-lg">
        {/* Left: Menu/Settings */}
        <div className="flex items-center gap-2">
          {!isInstructor && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <Settings className="w-5 h-5 text-cyan-300" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <Home className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Center: Timer & Game Title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider">
              {game.name || 'Around the World'}
            </span>
          </div>
          {game.timerConfig && game.timerConfig.mode !== 'none' && (
            <div className="flex items-center gap-1 text-cyan-300">
              <Clock className="w-3 h-3" />
              <span className="text-sm font-mono font-bold">{gameTime}</span>
            </div>
          )}
        </div>

        {/* Right: Score & Actions */}
        <div className="flex items-center gap-2">
          {showScores && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-xl">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-black text-yellow-300">{currentScore}</span>
            </div>
          )}
          <button
            onClick={() => setShowRaceOverlay(!showRaceOverlay)}
            className={`p-2 rounded-xl transition-colors ${
              showRaceOverlay ? 'bg-yellow-500/30 text-yellow-300' : 'hover:bg-white/10 text-white'
            }`}
          >
            <Flag className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative z-40 h-8 bg-slate-800/90 border-b border-slate-700/50 flex items-center px-4 gap-4">
        {/* Progress */}
        <div className="flex-1 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Progress
            </span>
          </div>
          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden max-w-xs">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 transition-all duration-500"
              style={{ width: `${totalProgress.percent}%` }}
            />
          </div>
          <span className="text-xs font-bold text-cyan-400">
            {totalProgress.completed}/{totalProgress.total}
          </span>
        </div>

        {/* First Arrivals Count */}
        {currentTeam && (
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-300">
              {currentTeamProgress.filter(tp => {
                if (!tp.isCompleted) return false;
                const allCompletions = teamProgress
                  .filter(other => other.destinationId === tp.destinationId && other.isCompleted)
                  .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
                return allCompletions[0]?.teamId === currentTeam.id;
              }).length} First
            </span>
          </div>
        )}
      </div>

      {/* Main Content - World Map */}
      <div className="flex-1 relative">
        <WorldMapCanvas
          destinations={destinations}
          teamProgress={teamProgress}
          teams={teams}
          currentTeamId={currentTeam?.id}
          mapStyle={config.mapStyle}
          mapImageUrl={config.mapImageUrl}
          showTeamPositions={config.showTeamPositions}
          onDestinationClick={handleDestinationClick}
          selectedDestinationId={selectedDestination?.id}
          fieldMissionDestinationId={activeFieldMission?.destinationId}
        />

        {/* Field Mission Indicator */}
        {activeFieldMission && activeFieldMission.fieldMissionLocation && (
          <div className="absolute bottom-4 left-4 right-4 z-30 max-w-sm mx-auto">
            <FieldMissionIndicator
              userLocation={userLocation}
              targetLocation={activeFieldMission.fieldMissionLocation}
              radius={activeFieldMission.fieldMissionRadius || config.defaultFieldRadius}
              hint={activeFieldMission.fieldMissionHint}
              isActive={true}
              onArrived={handleFieldMissionArrival}
            />
            <button
              onClick={() => setActiveFieldMission(null)}
              className="absolute top-2 right-2 p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <div className="relative z-40 h-16 bg-slate-800/95 backdrop-blur-md border-t border-slate-700/50 flex items-center justify-around px-4">
        {onOpenTeamLobby && (
          <button
            onClick={onOpenTeamLobby}
            className="flex flex-col items-center gap-1 p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <Users className="w-5 h-5 text-cyan-400" />
            <span className="text-[9px] font-bold text-slate-400 uppercase">Teams</span>
          </button>
        )}

        <button
          onClick={() => setShowQRScanner(true)}
          className="flex flex-col items-center gap-1 p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <QrCode className="w-5 h-5 text-purple-400" />
          <span className="text-[9px] font-bold text-slate-400 uppercase">Scan</span>
        </button>

        <button
          onClick={() => setShowRaceOverlay(!showRaceOverlay)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
            showRaceOverlay ? 'bg-yellow-500/20' : 'hover:bg-white/10'
          }`}
        >
          <Trophy className={`w-5 h-5 ${showRaceOverlay ? 'text-yellow-400' : 'text-yellow-500'}`} />
          <span className="text-[9px] font-bold text-slate-400 uppercase">Race</span>
        </button>

        {onOpenChat && (
          <button
            onClick={onOpenChat}
            className="flex flex-col items-center gap-1 p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-green-400" />
            <span className="text-[9px] font-bold text-slate-400 uppercase">Chat</span>
          </button>
        )}

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="flex flex-col items-center gap-1 p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-slate-500" />
          ) : (
            <Volume2 className="w-5 h-5 text-slate-400" />
          )}
          <span className="text-[9px] font-bold text-slate-400 uppercase">Sound</span>
        </button>
      </div>

      {/* Destination Panel */}
      {selectedDestination && (
        <DestinationPanel
          destination={selectedDestination}
          tasks={getDestinationTasks(selectedDestination.id)}
          progress={getDestinationProgress(selectedDestination.id)}
          isUnlocked={isDestinationUnlocked(selectedDestination)}
          isCompleted={isDestinationCompleted(selectedDestination)}
          isFirstArrival={isFirstArrival(selectedDestination.id)}
          onClose={() => setSelectedDestination(null)}
          onTaskSelect={handleTaskSelect}
          firstArrivalBonus={config.firstArrivalBonus}
        />
      )}

      {/* Race Overlay */}
      <TeamRaceOverlay
        teams={teams}
        destinations={destinations}
        teamProgress={teamProgress}
        onClose={() => setShowRaceOverlay(false)}
        isVisible={showRaceOverlay}
        currentTeamId={currentTeam?.id}
      />

      {/* Task Modal */}
      {activeTask && (
        <TaskModal
          point={activeTask}
          onClose={() => setActiveTaskId(null)}
          onComplete={(pointId, customScore) => {
            const points = customScore ?? activeTask.points;
            handleTaskComplete(pointId, true, points);
          }}
          distance={0}
          isInstructorMode={isInstructor}
          game={game}
        />
      )}

      {/* QR Scanner */}
      {showQRScanner && (
        <QRScannerModal
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={(code) => {
            // Find task by QR code
            const task = game.points.find(p => p.qrCodeString === code);
            if (task) {
              setActiveTaskId(task.id);
            }
            setShowQRScanner(false);
          }}
        />
      )}

      {/* Intro Modal */}
      {showIntroModal && game.introMessageConfig && (
        <IntroMessageModal
          isOpen={showIntroModal}
          message={game.introMessageConfig}
          onClose={() => setShowIntroModal(false)}
        />
      )}

      {/* Finish Modal */}
      {showFinishModal && game.finishMessageConfig && (
        <FinishMessageModal
          isOpen={showFinishModal}
          message={game.finishMessageConfig}
          onClose={() => setShowFinishModal(false)}
        />
      )}

      {/* Settings Modal (Password Protected) */}
      {showSettings && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-4">Settings</h3>

            {!isInstructor && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Instructor Code
                </label>
                <input
                  type="password"
                  value={settingsPassword}
                  onChange={(e) => setSettingsPassword(e.target.value)}
                  placeholder="Enter code..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
                {settingsPasswordError && (
                  <p className="text-xs text-red-400 mt-1">{settingsPasswordError}</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (settingsPassword === '4027' || isInstructor) {
                    onClose();
                  } else {
                    setSettingsPasswordError('Incorrect code');
                  }
                }}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors uppercase text-sm"
              >
                Exit Game
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setSettingsPassword('');
                  setSettingsPasswordError('');
                }}
                className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors uppercase text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AroundTheWorldGameView;
