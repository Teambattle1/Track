/**
 * Jorden80GameView - Main game view for "Jorden Rundt på 80 Dage"
 * Jules Verne inspired European journey game mode
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Game, GamePoint, Team, Coordinate, Jorden80Config, Jorden80City,
  Jorden80TeamProgress, Jorden80CityProgress, Jorden80TaskType
} from '../../types';
import {
  JORDEN80_CITIES, getCity, getStartCity, getGoalCity, VEHICLES
} from '../../utils/jorden80/europeData';
import {
  getNextDestinations, hasReachedGoal
} from '../../utils/jorden80/routeNetwork';
import {
  calculateDaysForTask, createInitialProgress, createEmptyCityProgress,
  isCityCompleted, DEFAULT_JORDEN80_CONFIG, calculateTravelDays, countCorrectAnswersInCity
} from '../../utils/jorden80/dayCalculation';
import EuropeMapCanvas from './EuropeMapCanvas';
import CityTaskPanel from './CityTaskPanel';
import DestinationSelector from './DestinationSelector';
import DayCounter from './DayCounter';
import ReformClubLobby from './ReformClubLobby';
import TaskModal from '../TaskModal';
import './styles/victorian.css';
import { X, Menu, Trophy, Users, MessageSquare, Settings, Map } from 'lucide-react';

interface Jorden80GameViewProps {
  game: Game;
  teams: Team[];
  currentTeam?: Team;
  isInstructor: boolean;
  userLocation: Coordinate | null;
  onTaskComplete: (taskId: string, isCorrect: boolean, points: number) => void;
  onUpdateGame: (game: Game) => void;
  onUpdateTeam: (team: Team) => void;
  onClose: () => void;
  onOpenChat?: () => void;
  onOpenTeamLobby?: () => void;
  showScores: boolean;
  currentScore: number;
}

const Jorden80GameView: React.FC<Jorden80GameViewProps> = ({
  game,
  teams,
  currentTeam,
  isInstructor,
  userLocation,
  onTaskComplete,
  onUpdateGame,
  onUpdateTeam,
  onClose,
  onOpenChat,
  onOpenTeamLobby,
  showScores,
  currentScore
}) => {
  // Config
  const config: Jorden80Config = game.jorden80Config || DEFAULT_JORDEN80_CONFIG;
  const teamProgress = game.jorden80TeamProgress || {};

  // UI State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showDestinationSelector, setShowDestinationSelector] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [view, setView] = useState<'map' | 'tasks'>('tasks');

  // Get current team's progress
  const currentProgress = useMemo((): Jorden80TeamProgress | undefined => {
    if (!currentTeam) return undefined;
    return teamProgress[currentTeam.id] || createInitialProgress(currentTeam.id, config);
  }, [currentTeam, teamProgress, config]);

  // Get current city
  const currentCity = useMemo(() => {
    if (!currentProgress) return getStartCity();
    return getCity(currentProgress.currentCity) || getStartCity();
  }, [currentProgress]);

  // Get tasks for current city
  const currentCityTasks = useMemo(() => {
    return game.points.filter(p => p.jorden80CityId === currentCity.id);
  }, [game.points, currentCity]);

  // Get current city progress
  const currentCityProgress = useMemo(() => {
    return currentProgress?.cityProgress[currentCity.id];
  }, [currentProgress, currentCity]);

  // Count correct answers in current city
  const correctAnswersInCity = useMemo(() => {
    if (!currentCityProgress) return 0;
    return countCorrectAnswersInCity(currentCityProgress);
  }, [currentCityProgress]);

  // Check if team has reached goal
  const hasReachedGoalCity = useMemo(() => {
    if (!currentProgress) return false;
    return hasReachedGoal(currentProgress.currentCity, config.goalCity);
  }, [currentProgress, config.goalCity]);

  // Show lobby if team not started
  useEffect(() => {
    if (!currentTeam?.isStarted && !isInstructor) {
      setShowLobby(true);
    }
  }, [currentTeam?.isStarted, isInstructor]);

  // Handle task completion
  const handleTaskComplete = useCallback(async (
    taskId: string,
    isCorrect: boolean,
    points: number
  ) => {
    if (!currentTeam || !currentProgress) return;

    const task = game.points.find(p => p.id === taskId);
    if (!task || !task.jorden80TaskType) return;

    // Calculate days for this task
    const daysUsed = calculateDaysForTask(task.jorden80TaskType, isCorrect, config);

    // Update city progress
    const cityProgress = currentProgress.cityProgress[currentCity.id] || createEmptyCityProgress();
    const taskType = task.jorden80TaskType;

    if (taskType === 'by') {
      cityProgress.byTask = { completed: true, correct: isCorrect, points: isCorrect ? points : 0 };
    } else if (taskType === 'land') {
      cityProgress.landTask = { completed: true, correct: isCorrect, points: isCorrect ? points : 0 };
    } else if (taskType === 'creative') {
      // Creative tasks need instructor approval, so mark as completed but not approved yet
      cityProgress.creativeTask = {
        completed: true,
        score: 0, // Will be set by instructor
        approved: false
      };
    }

    // Update team progress
    const updatedProgress: Jorden80TeamProgress = {
      ...currentProgress,
      daysUsed: currentProgress.daysUsed + daysUsed,
      correctAnswers: countCorrectAnswersInCity(cityProgress),
      totalCorrectAnswers: currentProgress.totalCorrectAnswers + (isCorrect ? 1 : 0),
      cityProgress: {
        ...currentProgress.cityProgress,
        [currentCity.id]: cityProgress
      }
    };

    // Update game with new progress
    const updatedTeamProgress = {
      ...teamProgress,
      [currentTeam.id]: updatedProgress
    };

    onUpdateGame({
      ...game,
      jorden80TeamProgress: updatedTeamProgress
    });

    // Call parent callback
    onTaskComplete(taskId, isCorrect, points);

    // Close task modal
    setActiveTaskId(null);
  }, [currentTeam, currentProgress, currentCity, game, teamProgress, config, onUpdateGame, onTaskComplete]);

  // Handle destination selection
  const handleSelectDestination = useCallback((cityId: string) => {
    if (!currentTeam || !currentProgress) return;

    const travelDays = calculateTravelDays();

    // Update progress with new city
    const updatedProgress: Jorden80TeamProgress = {
      ...currentProgress,
      currentCity: cityId,
      visitedCities: [...currentProgress.visitedCities, cityId],
      route: [...currentProgress.route, cityId],
      daysUsed: currentProgress.daysUsed + travelDays,
      correctAnswers: 0, // Reset for new city
      cityProgress: {
        ...currentProgress.cityProgress,
        [cityId]: createEmptyCityProgress()
      },
      hasFinished: cityId === config.goalCity,
      finishedAt: cityId === config.goalCity ? Date.now() : undefined
    };

    // Update game
    const updatedTeamProgress = {
      ...teamProgress,
      [currentTeam.id]: updatedProgress
    };

    onUpdateGame({
      ...game,
      jorden80TeamProgress: updatedTeamProgress
    });

    setShowDestinationSelector(false);
  }, [currentTeam, currentProgress, teamProgress, config.goalCity, game, onUpdateGame]);

  // Handle team creation (from lobby)
  const handleCreateTeam = useCallback((name: string, color: string, vehicle: any) => {
    // This would typically be handled by the parent component
    // For now, just close the lobby
    setShowLobby(false);
  }, []);

  // Handle start game
  const handleStartGame = useCallback((teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    onUpdateTeam({
      ...team,
      isStarted: true,
      startedAt: Date.now()
    });

    // Initialize progress if not exists
    if (!teamProgress[teamId]) {
      const initialProgress = createInitialProgress(teamId, config);
      onUpdateGame({
        ...game,
        jorden80TeamProgress: {
          ...teamProgress,
          [teamId]: initialProgress
        }
      });
    }

    setShowLobby(false);
  }, [teams, teamProgress, config, game, onUpdateGame, onUpdateTeam]);

  // Get vehicle emoji for header
  const vehicleEmoji = useMemo(() => {
    const vehicle = VEHICLES.find(v => v.id === currentTeam?.vehicle);
    return vehicle?.emoji || '🚂';
  }, [currentTeam?.vehicle]);

  // Render lobby
  if (showLobby && !isInstructor) {
    return (
      <ReformClubLobby
        game={game}
        teams={teams}
        currentTeam={currentTeam}
        isInstructor={isInstructor}
        onCreateTeam={handleCreateTeam}
        onJoinTeam={() => {}}
        onStartGame={handleStartGame}
        onClose={() => setShowLobby(false)}
      />
    );
  }

  // Active task
  const activeTask = activeTaskId ? game.points.find(p => p.id === activeTaskId) : null;

  return (
    <div className="j80-container flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b-2"
        style={{
          backgroundColor: 'var(--j80-parchment-dark)',
          borderColor: 'var(--j80-sepia)'
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg hover:bg-black/10 transition-colors"
          >
            <Menu className="w-6 h-6" style={{ color: 'var(--j80-ink-brown)' }} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">{vehicleEmoji}</span>
            <div>
              <h1 className="j80-font-heading text-lg" style={{ color: 'var(--j80-ink-brown)' }}>
                {currentTeam?.name || 'Jorden Rundt på 80 Dage'}
              </h1>
              <p className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
                {currentCity.name}, {currentCity.country}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Day Counter (compact) */}
          {currentProgress && (
            <DayCounter progress={currentProgress} config={config} compact />
          )}

          {/* Score */}
          {showScores && (
            <div
              className="px-4 py-2 rounded-full j80-font-heading"
              style={{
                backgroundColor: 'var(--j80-gold)',
                color: 'var(--j80-ink-black)'
              }}
            >
              {currentScore} pt
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/10 transition-colors"
          >
            <X className="w-6 h-6" style={{ color: 'var(--j80-ink-brown)' }} />
          </button>
        </div>
      </div>

      {/* Menu Dropdown */}
      {showMenu && (
        <div
          className="absolute top-16 left-4 z-50 j80-card p-2 w-48"
          style={{ boxShadow: 'var(--j80-shadow-lg)' }}
        >
          <button
            onClick={() => { setView('map'); setShowMenu(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--j80-parchment)] transition-colors"
          >
            <Map className="w-5 h-5" style={{ color: 'var(--j80-sepia)' }} />
            <span className="j80-font-body">Kort</span>
          </button>
          <button
            onClick={() => { setView('tasks'); setShowMenu(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--j80-parchment)] transition-colors"
          >
            <Trophy className="w-5 h-5" style={{ color: 'var(--j80-sepia)' }} />
            <span className="j80-font-body">Opgaver</span>
          </button>
          {onOpenTeamLobby && (
            <button
              onClick={() => { onOpenTeamLobby(); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--j80-parchment)] transition-colors"
            >
              <Users className="w-5 h-5" style={{ color: 'var(--j80-sepia)' }} />
              <span className="j80-font-body">Hold</span>
            </button>
          )}
          {onOpenChat && (
            <button
              onClick={() => { onOpenChat(); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--j80-parchment)] transition-colors"
            >
              <MessageSquare className="w-5 h-5" style={{ color: 'var(--j80-sepia)' }} />
              <span className="j80-font-body">Chat</span>
            </button>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {view === 'map' ? (
          /* Map View */
          <div className="flex flex-col items-center gap-4">
            <EuropeMapCanvas
              teams={teams}
              currentTeamId={currentTeam?.id}
              teamProgress={teamProgress}
              showAllTeams={game.showOtherTeams}
              onCityClick={(city) => {
                if (city.id === currentCity.id) {
                  setView('tasks');
                }
              }}
            />

            {/* Day Counter (full) */}
            {currentProgress && (
              <DayCounter progress={currentProgress} config={config} />
            )}

            {/* View Tasks Button */}
            <button
              onClick={() => setView('tasks')}
              className="j80-btn j80-btn-primary"
            >
              Se Opgaver i {currentCity.name}
            </button>
          </div>
        ) : (
          /* Tasks View */
          <div className="max-w-lg mx-auto space-y-4">
            {/* City Task Panel */}
            <CityTaskPanel
              city={currentCity}
              tasks={currentCityTasks}
              cityProgress={currentCityProgress}
              onSelectTask={(task) => setActiveTaskId(task.id)}
              onChooseDestination={() => setShowDestinationSelector(true)}
              isInstructor={isInstructor}
            />

            {/* Day Counter (full) */}
            {currentProgress && (
              <DayCounter progress={currentProgress} config={config} />
            )}

            {/* View Map Button */}
            <button
              onClick={() => setView('map')}
              className="w-full j80-btn j80-btn-secondary flex items-center justify-center gap-2"
            >
              <Map className="w-5 h-5" />
              Se Kort
            </button>
          </div>
        )}
      </div>

      {/* Destination Selector Modal */}
      {showDestinationSelector && currentProgress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full">
            <DestinationSelector
              currentCity={currentCity.id}
              correctAnswers={correctAnswersInCity}
              progress={currentProgress}
              config={config}
              onSelectDestination={handleSelectDestination}
              onCancel={() => setShowDestinationSelector(false)}
            />
          </div>
        </div>
      )}

      {/* Task Modal */}
      {activeTask && (
        <TaskModal
          point={activeTask}
          onClose={() => setActiveTaskId(null)}
          onComplete={(pointId, customScore) => {
            const task = game.points.find(p => p.id === pointId);
            const isCorrect = customScore !== undefined && customScore > 0;
            const points = customScore ?? (task?.points || 0);
            handleTaskComplete(pointId, isCorrect, points);
          }}
          onTaskIncorrect={() => {
            if (activeTaskId) {
              handleTaskComplete(activeTaskId, false, 0);
            }
          }}
          distance={0}
          isInstructorMode={isInstructor}
          game={game}
        />
      )}

      {/* Goal Reached Celebration */}
      {hasReachedGoalCity && currentProgress?.hasFinished && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="j80-card max-w-md w-full p-8 text-center j80-animate-in">
            <div className="text-6xl mb-4">🎉</div>
            <h2
              className="j80-font-heading text-3xl mb-2"
              style={{ color: 'var(--j80-gold)' }}
            >
              Istanbul!
            </h2>
            <p className="j80-font-body text-xl mb-4" style={{ color: 'var(--j80-ink-brown)' }}>
              I har gennemført rejsen!
            </p>
            <div
              className="p-4 rounded-lg mb-6"
              style={{ backgroundColor: 'var(--j80-parchment)' }}
            >
              <div className="j80-font-body" style={{ color: 'var(--j80-sepia)' }}>
                Rejsetid
              </div>
              <div className="j80-font-heading text-4xl" style={{ color: 'var(--j80-ink-brown)' }}>
                {currentProgress.daysUsed} dage
              </div>
              <div className="j80-font-body text-sm mt-1" style={{ color: 'var(--j80-sepia)' }}>
                {currentProgress.daysUsed <= config.daysLimit
                  ? `${config.daysLimit - currentProgress.daysUsed} dage under grænsen!`
                  : `${currentProgress.daysUsed - config.daysLimit} dage over grænsen`}
              </div>
            </div>
            <button onClick={onClose} className="j80-btn j80-btn-primary">
              Se Resultater
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jorden80GameView;
