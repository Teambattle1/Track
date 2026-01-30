import React, { useState, useEffect, useRef, useMemo } from 'react';
import { migrateAllTasksInSystem } from '../utils/languageMigration';
import { Game, GamePoint, TaskList, TaskTemplate, AuthUser, GameMode, Coordinate, MapStyleId, DangerZone, GameRoute, Team, ChatMessage, GameChangeLogEntry, TeamMember, PlaygroundTemplate, ActionType } from '../types';
import { APP_VERSION } from '../utils/version';
import * as db from '../services/db';
import { logGameChange } from '../utils/gameLog';
import { supabase } from '../lib/supabase';
import { authService } from '../services/auth';
import { teamSync } from '../services/teamSync';
import { LocationProvider, useLocation } from '../contexts/LocationContext';
import { haversineMeters, isWithinRadius, isValidCoordinate } from '../utils/geo';
import { validatePlayzoneGame, cleanPlayzoneGame } from '../utils/playzoneValidation';
import GameMap, { GameMapHandle } from './GameMap';
import GameHUD, { type GameHUDHandle } from './GameHUD';
import GameManager from './GameManager';
import TaskMaster from './TaskMaster';
import TeamsModal from './TeamsModal';
import InstructorDashboard from './InstructorDashboard';
import TeamDashboard from './TeamDashboard';
import WelcomeScreen from './WelcomeScreen';
import InitialLanding from './InitialLanding';
import LoginPage from './LoginPage';
import EditorDrawer from './EditorDrawer';
import TaskModal from './TaskModal';
import DeleteGamesModal from './DeleteGamesModal';
import PlaygroundManager from './PlaygroundManager';
import AdminModal from './AdminModal';
import ChatDrawer from './ChatDrawer';
import TeamsHubModal from './TeamsHubModal';
import ClientSubmissionView from './ClientSubmissionView';
import GameCreator from './GameCreator';
import TaskActionModal from './TaskActionModal';
import PlaygroundEditor from './PlaygroundEditor';
import MessagePopup from './MessagePopup';
import Dashboard from './Dashboard';
import DangerZoneModal from './DangerZoneModal';
import TeamLobbyPanel from './TeamLobbyPanel';
import PlayzoneGameEntry from './PlayzoneGameEntry';
import AroundTheWorldGameView from './AroundTheWorldGameView';
import { AroundTheWorldDashboard } from './aroundtheworld';
import { getTaskById } from '../utils/aroundtheworld/defaultTasks';
import ErrorBoundary from './ErrorBoundary';
import OfflineIndicator from './OfflineIndicator';
import ConnectionStatus from './ConnectionStatus';
import { PlayCircle, Ruler } from 'lucide-react';
import { setGlobalVolume } from '../utils/sounds';

// Inner App Component that consumes LocationContext
const GameApp: React.FC = () => {
  // --- AUTH & USER STATE ---
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // --- DATA STATE ---
  const [games, setGames] = useState<Game[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [taskLibrary, setTaskLibrary] = useState<TaskTemplate[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);

  // --- SIMULATION STATE ---
  // We keep a clean separation. When in Simulation Mode, 'activeGame' points to this object.
  const [simulatedGame, setSimulatedGame] = useState<Game | null>(null);
  const [originalMode, setOriginalMode] = useState<GameMode>(GameMode.EDIT);

  // --- UI STATE ---
  const [mode, setMode] = useState<GameMode>(GameMode.PLAY);
  const [showLanding, setShowLanding] = useState(true);
  const [showGameChooser, setShowGameChooser] = useState(false);
  const [showTaskMaster, setShowTaskMaster] = useState(false);
  const [taskMasterInitialTab, setTaskMasterInitialTab] = useState<'LIBRARY' | 'LISTS' | 'TAGS' | 'CLIENT'>('LIBRARY');
  const [pendingImport, setPendingImport] = useState<{ type: 'tasks' | 'list'; data: any } | null>(null);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showInstructorDashboard, setShowInstructorDashboard] = useState(false);
  const [showTeamDashboard, setShowTeamDashboard] = useState(false);
  const [showDeleteGames, setShowDeleteGames] = useState(false);
  const [showPlaygroundManager, setShowPlaygroundManager] = useState(false);
  const [showDatabaseTools, setShowDatabaseTools] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showTeamsHub, setShowTeamsHub] = useState(false);
  const [showGameCreator, setShowGameCreator] = useState(false);
  const [showTeamLobby, setShowTeamLobby] = useState(false);
  const [showAroundTheWorldDashboard, setShowAroundTheWorldDashboard] = useState(false);
  const [gameToEdit, setGameToEdit] = useState<Game | null>(null);
  const [initialGameMode, setInitialGameMode] = useState<'standard' | 'playzone' | 'elimination' | 'aroundtheworld' | null>(null);

  // --- DASHBOARD STATE ---
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'dashboard' | 'games' | 'templates' | 'tasks' | 'users' | 'tags' | 'client'>('dashboard');

  // --- EDITOR STATE ---
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [activeTask, setActiveTask] = useState<GamePoint | null>(null);
  const [viewingPlaygroundId, setViewingPlaygroundId] = useState<string | null>(null);
  const [playgroundTemplateToEdit, setPlaygroundTemplateToEdit] = useState<PlaygroundTemplate | null>(null);
  const [activeTaskActionPoint, setActiveTaskActionPoint] = useState<GamePoint | null>(null);
  
  // --- PLAY STATE (Location from Context) ---
  const { userLocation, gpsAccuracy } = useLocation();
  const [activeTaskModalId, setActiveTaskModalId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showScores, setShowScores] = useState(true);
  const [showTaskId, setShowTaskId] = useState(true); // Task order (001, 002, etc.)
  const [showTaskTitle, setShowTaskTitle] = useState(true); // Task name/title
  const [showTaskActions, setShowTaskActions] = useState(true); // Task action indicators

  // --- COOLDOWN STATE ---
  // Map of taskId -> timestamp when cooldown expires
  const [taskCooldowns, setTaskCooldowns] = useState<Map<string, number>>(new Map());

  // Update showScores when game changes based on designConfig.hideScore
  useEffect(() => {
    const currentGame = games.find(g => g.id === activeGameId);
    if (currentGame?.designConfig?.hideScore !== undefined) {
      setShowScores(!currentGame.designConfig.hideScore);
    }
  }, [activeGameId, games]);
  const [currentDangerZone, setCurrentDangerZone] = useState<DangerZone | null>(null);
  const [activeDangerZone, setActiveDangerZone] = useState<DangerZone | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [latestMessage, setLatestMessage] = useState<ChatMessage | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<TeamMember[]>([]);
  const [otherTeamsLocations, setOtherTeamsLocations] = useState<any[]>([]);
  
  // --- MAP STATE ---
  const [localMapStyle, setLocalMapStyle] = useState<MapStyleId>('osm');
  const mapRef = useRef<GameMapHandle>(null);
  const gameHudRef = useRef<GameHUDHandle>(null);
  const geofenceCheckRunningRef = useRef(false);
  const [isRelocating, setIsRelocating] = useState(false);
  const [relocateScopeCenter, setRelocateScopeCenter] = useState<Coordinate | null>(null);

  // --- MEASUREMENT ---
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePath, setMeasurePath] = useState<Coordinate[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState(0);
  const [measurePointsCount, setMeasurePointsCount] = useState(0);
  const [selectedMeasurePointIds, setSelectedMeasurePointIds] = useState<string[]>([]);
  const [showMeasureResult, setShowMeasureResult] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      setShowLogin(false);
      const user = authService.getCurrentUser();
      if (user) {
        setAuthUser(user);
      }
      const loadedGames = await db.fetchGames();
      const loadedLists = await db.fetchTaskLists();
      const loadedLib = await db.fetchLibrary();

      // Migrate all tasks to have proper language detection
      const { games: migratedGames, library: migratedLibrary } = await migrateAllTasksInSystem(loadedGames, loadedLib);

      setGames(migratedGames);
      setTaskLists(loadedLists);
      setTaskLibrary(migratedLibrary);

      // Save migrated data back to database
      for (const game of migratedGames) {
        await db.saveGame(game);
      }
      const { ok: migratedOk } = await db.saveTemplates(migratedLibrary);
      if (!migratedOk) console.error('[App] Failed to persist migrated library templates');
    };
    init();
  }, []);

  // --- REALTIME: Games/Templates list updates across editors ---
  useEffect(() => {
      const channel = supabase.channel('games_list_changes');

      const rowToGame = (row: any): Game => ({
          ...(row.data as Game),
          id: row.id,
          dbUpdatedAt: row.updated_at
      });

      const applyIncomingGame = (incoming: Game) => {
          setGames(prev => {
              const exists = prev.some(g => g.id === incoming.id);
              const next = exists ? prev.map(g => (g.id === incoming.id ? incoming : g)) : [incoming, ...prev];
              return next;
          });

          if (activeGameId === incoming.id) {
              if ((mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && activeTask) return;
              setActiveGame(incoming);
          }
      };

      channel
          .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'games' },
              (payload: any) => {
                  if (payload.eventType === 'DELETE') {
                      const id = payload.old?.id;
                      if (!id) return;
                      setGames(prev => prev.filter(g => g.id !== id));
                      if (activeGameId === id) setActiveGame(null);
                      return;
                  }

                  const row = payload.new;
                  if (!row) return;
                  applyIncomingGame(rowToGame(row));
              }
          )
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [activeGameId, mode, activeTask]);

  // Measurement logic: no auto-update with user location, only manual task clicks

  useEffect(() => {
      if (activeGameId) {
          const game = games.find(g => g.id === activeGameId) || null;
          setActiveGame(game);
          if (game?.defaultMapStyle) setLocalMapStyle(game.defaultMapStyle);
      }
  }, [activeGameId, games]);

  // --- MULTI-USER EDIT SYNC (realtime with safe fallback) ---
  useEffect(() => {
      if (!activeGameId) return;
      if (mode !== GameMode.EDIT && mode !== GameMode.INSTRUCTOR) return;
      // Avoid overwriting local, unsaved edits while a point is open in the editor.
      if (activeTask) return;

      let isSubscribed = false;
      let pollingId: number | null = null;
      const channel = supabase.channel(`game_changes_${activeGameId}`);

      const applyRemoteGame = (remote: Game) => {
          if (remote.dbUpdatedAt && remote.dbUpdatedAt === activeGame?.dbUpdatedAt) return;
          setGames(prev => prev.map(g => (g.id === remote.id ? remote : g)));
          setActiveGame(remote);
      };

      channel
          .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${activeGameId}` },
              (payload: any) => {
                  const row = payload?.new;
                  if (!row) return;
                  const remote: Game = { ...(row.data as Game), id: row.id, dbUpdatedAt: row.updated_at };
                  applyRemoteGame(remote);
              }
          )
          .subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                  isSubscribed = true;
              }
          });

      // Fallback polling: only if realtime doesn't subscribe within 7s.
      const fallbackTimer = window.setTimeout(() => {
          if (isSubscribed) return;
          pollingId = window.setInterval(async () => {
              const remote = await db.fetchGame(activeGameId);
              if (!remote) return;
              applyRemoteGame(remote);
          }, 20000);
      }, 7000);

      return () => {
          window.clearTimeout(fallbackTimer);
          if (pollingId) window.clearInterval(pollingId);
          supabase.removeChannel(channel);
      };
  }, [activeGameId, mode, activeTask, activeGame?.dbUpdatedAt]);

  // Subscribe to Team Members if Playing
  useEffect(() => {
      if (mode === GameMode.PLAY && currentTeam) {
          const unsubscribeMembers = teamSync.subscribeToMembers((members) => {
              const myDeviceId = teamSync.getDeviceId();
              const teammates = members.filter(m => m.deviceId !== myDeviceId);
              setOnlineMembers(teammates);
          });

          let unsubscribeGlobal: (() => void) | undefined;
          if (activeGame?.showOtherTeams) {
              unsubscribeGlobal = teamSync.subscribeToGlobalLocations((locations) => {
                  const others = locations.filter(l => l.teamId !== currentTeam.id);
                  setOtherTeamsLocations(others);
              });
          } else {
              setOtherTeamsLocations([]);
          }

          return () => {
              unsubscribeMembers();
              if (unsubscribeGlobal) unsubscribeGlobal();
          };
      }
  }, [mode, currentTeam, activeGame?.showOtherTeams]);

  // Captain Broadcasting Logic
  useEffect(() => {
      if (mode === GameMode.PLAY && currentTeam && activeGame?.showOtherTeams && userLocation) {
          const myDeviceId = teamSync.getDeviceId();
          if (currentTeam.captainDeviceId === myDeviceId) {
              const interval = setInterval(() => {
                  teamSync.broadcastGlobalLocation(
                      activeGame.id, 
                      currentTeam.id, 
                      currentTeam.name, 
                      userLocation, 
                      currentTeam.photoUrl
                  );
              }, 10000); 
              return () => clearInterval(interval);
          }
      }
  }, [mode, currentTeam, activeGame?.showOtherTeams, userLocation]);

  // --- GEOFENCING ENGINE ---
  useEffect(() => {
      // In Simulation Mode, geofencing is manual (clicking). 
      // We disable auto-unlock by distance to prevent confusion, unless we want to simulate user movement? 
      // For now, let's keep radius checks active ONLY in real PLAY mode.
      if (!activeGame || mode !== GameMode.PLAY || !userLocation) return;

      const checkGeofences = async () => {
          // Prevent overlapping checks
          if (geofenceCheckRunningRef.current) return;
          geofenceCheckRunningRef.current = true;

          const patches: { pointId: string; patch: any }[] = [];

          // OPTIMIZATION: Filter once instead of checking each iteration
          const radiusActivatedPoints = (activeGame?.points || []).filter(
              p => !p.isUnlocked && !p.isCompleted && !p.isSectionHeader && !p.playgroundId && p.activationTypes.includes('radius')
          );

          // Early exit if no radius-activated tasks
          if (radiusActivatedPoints.length === 0) {
              geofenceCheckRunningRef.current = false;
              return;
          }

          // Check only relevant points
          for (const p of radiusActivatedPoints) {
              if (isWithinRadius(userLocation, p.location, p.radiusMeters)) {
                  patches.push({ pointId: p.id, patch: { isUnlocked: true } });
              }
          }

          try {
              if (patches.length > 0) {
                  if (navigator.vibrate) navigator.vibrate(200);

                  const remote = await db.patchGamePoints(activeGame.id, patches, {
                      user: authUser?.name,
                      action: 'Geofence Unlock'
                  });

                  if (remote) {
                      setActiveGame(remote);
                      setGames(prev => prev.map(g => (g.id === remote.id ? remote : g)));
                  }
              }
          } finally {
              geofenceCheckRunningRef.current = false;
          }
      };

      // PERFORMANCE: Reduced from 2s to 5s to minimize main thread blocking
      const interval = setInterval(checkGeofences, 5000);
      return () => clearInterval(interval);
  }, [userLocation, activeGame, mode]);

  // --- COOLDOWN TIMER ---
  useEffect(() => {
      if (taskCooldowns.size === 0) return;

      const interval = setInterval(() => {
          const now = Date.now();
          const newCooldowns = new Map(taskCooldowns);
          let hasExpiredCooldowns = false;

          // Check for expired cooldowns
          taskCooldowns.forEach((endTime, taskId) => {
              if (now >= endTime) {
                  newCooldowns.delete(taskId);
                  hasExpiredCooldowns = true;
                  // Vibrate when cooldown expires
                  if (navigator.vibrate) {
                      navigator.vibrate(200);
                  }
              }
          });

          // Update state if any cooldowns expired
          if (hasExpiredCooldowns) {
              setTaskCooldowns(newCooldowns);
          }
      }, 1000); // Check every second

      return () => clearInterval(interval);
  }, [taskCooldowns]);

  // --- MEMOIZED DATA ---
  const currentGameObj = mode === GameMode.SIMULATION ? simulatedGame : activeGame;

  const logicLinks = useMemo(() => {
      if (!currentGameObj || mode === GameMode.PLAY) return [];
      const links: any[] = [];
      currentGameObj.points.forEach(p => {
          if (!p.location) return;
          const addLinks = (trigger: 'onOpen' | 'onCorrect' | 'onIncorrect', color: string) => {
              const actions = p.logic?.[trigger];
              actions?.forEach(action => {
                  if ((action.type === 'unlock' || action.type === 'reveal') && action.targetId) {
                      const target = currentGameObj.points.find(tp => tp.id === action.targetId);
                      if (target && target.location) {
                          links.push({ from: p.location, to: target.location, color, type: trigger });
                      }
                  }
              });
          };
          addLinks('onOpen', '#eab308');
          addLinks('onCorrect', '#22c55e');
          addLinks('onIncorrect', '#ef4444');
      });
      return links;
  }, [currentGameObj, mode]);

  const liveTaskModalPoint = useMemo(() => {
      if (!activeTaskModalId || !currentGameObj) return null;
      return currentGameObj.points.find(p => p.id === activeTaskModalId) || null;
  }, [activeTaskModalId, currentGameObj]);

  const ensureSession = (callback: () => void) => {
      if (!authUser) {
          setShowLogin(true);
      } else {
          callback();
      }
  };

  const updateActiveGame = async (updatedGame: Game, changeDescription: string = "Modified Game") => {
      // If we are in Simulation Mode, we ONLY update the local state, NOT the DB.
      if (mode === GameMode.SIMULATION) {
          setSimulatedGame(updatedGame);
          return;
      }

      const updatedAt = new Date().toISOString();

      const changeEntry: GameChangeLogEntry = {
          timestamp: Date.now(),
          user: authUser?.name || 'Unknown',
          action: changeDescription
      };

      const gameToSave = {
          ...updatedGame,
          dbUpdatedAt: updatedAt,
          lastModifiedBy: authUser?.name || 'Unknown',
          changeLog: [...(updatedGame.changeLog || []), changeEntry]
      };

      await db.saveGame(gameToSave);
      setGames(prev => prev.map(g => g.id === gameToSave.id ? gameToSave : g));
      if (activeGameId === gameToSave.id) {
          setActiveGame(gameToSave);
      }
  };

  // --- SIMULATION LOGIC ---
  const handleStartSimulation = (game: Game) => {
      // 1. Create Deep Clone for isolation
      const simGame: Game = JSON.parse(JSON.stringify(game));
      
      // 2. Create Dummy Team
      const simTeam: Team = {
          id: 'sim-team-001',
          gameId: game.id,
          name: 'SIMULATION AGENT',
          joinCode: 'SIM000',
          score: 0,
          members: [{ name: 'Simulator', deviceId: 'sim-device', photo: '' }],
          updatedAt: new Date().toISOString(),
          isStarted: true,
          completedPointIds: []
      };

      // 3. Set State
      setOriginalMode(mode);
      setSimulatedGame(simGame);
      setCurrentTeam(simTeam);
      setMode(GameMode.SIMULATION);
      setShowLanding(false);
      setShowGameChooser(false);
      setScore(0);
  };

  const handleStopSimulation = () => {
      setSimulatedGame(null);
      setCurrentTeam(null);
      setMode(originalMode);
      
      // If we were editing, ensure activeGame is fresh from state (it should be)
      // No DB rollback needed because we didn't touch it.
  };

  const handleDeleteGame = async (id: string) => {
      await db.deleteGame(id);
      setGames(prev => prev.filter(g => g.id !== id));
      if (activeGameId === id) {
          setActiveGameId(null);
          setActiveGame(null);
      }
  };

  const handleDeleteItem = async (pointId: string) => {
      if (!currentGameObj || !pointId) return;
      console.log('[Delete] Deleting point:', pointId);

      const updatedPoints = currentGameObj.points.filter(p => p.id !== pointId);
      const updatedZones = (currentGameObj.dangerZones || []).filter(z => z.id !== pointId);

      console.log('[Delete] Updated points count:', updatedPoints.length, 'Total before:', currentGameObj.points.length);

      await updateActiveGame({ ...currentGameObj, points: updatedPoints, dangerZones: updatedZones }, "Deleted Task/Zone");
      if (activeTask?.id === pointId) setActiveTask(null);
  };

  const handlePointClick = (point: GamePoint) => {
      // CRITICAL: When measuring mode is active, ONLY add to measurement path
      // Do NOT open any modals or task views
      if (isMeasuring) {
          if (!point.location || !isValidCoordinate(point.location)) {
              console.warn('[Measure] Cannot measure task without valid location:', point.id);
              return;
          }

          console.log('[Measure] Task clicked in measure mode:', point.id, 'Location:', point.location);

          // Calculate distance BEFORE updating state
          const distanceToAdd = measurePath.length > 0
              ? haversineMeters(measurePath[measurePath.length - 1], point.location)
              : 0;

          console.log('[Measure] Distance calculation:', {
              previousPoint: measurePath[measurePath.length - 1],
              currentPoint: point.location,
              distanceToAdd: distanceToAdd.toFixed(2) + 'm'
          });

          // Add task ID to selected list (for visual feedback)
          setSelectedMeasurePointIds(prev => [...prev, point.id]);

          // Add task location to measurement path
          setMeasurePath(prev => [...prev, point.location]);

          // Update distance with the calculated value
          setMeasuredDistance(prev => {
              const newDistance = prev + distanceToAdd;
              console.log('[Measure] Distance update:', prev.toFixed(2) + 'm', '+', distanceToAdd.toFixed(2) + 'm', '=', newDistance.toFixed(2) + 'm');
              return newDistance;
          });

          // Update point count
          setMeasurePointsCount(prev => prev + 1);

          console.log('[Measure] ✓ Added task to path. Total distance:', (measuredDistance + distanceToAdd).toFixed(2) + 'm');

          // CRITICAL: Stop execution here - do NOT open task modal
          return;
      }

      // Normal mode: Open task modal/editor
      if (mode === GameMode.EDIT) {
          setActiveTask(point);
      } else if (mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR || mode === GameMode.SIMULATION) {
          // Logic Execution: On Open
          if (point.logic?.onOpen) {
              executeGameLogic(point.logic.onOpen);
          }
          setActiveTaskModalId(point.id);
      }
  };

  const executeGameLogic = (actions: any[]) => {
      if (!currentGameObj || !actions) return;
      
      let updatedGame = { ...currentGameObj };
      let hasChanges = false;
      let scoreDelta = 0;

      actions.forEach(action => {
          if (action.type === 'unlock' && action.targetId) {
              updatedGame.points = updatedGame.points.map(p => p.id === action.targetId ? { ...p, isUnlocked: true } : p);
              hasChanges = true;
          }
          if (action.type === 'reveal' && action.targetId) {
              updatedGame.points = updatedGame.points.map(p => p.id === action.targetId ? { ...p, isHiddenBeforeScan: false, isUnlocked: true } : p);
              hasChanges = true;
          }
          if (action.type === 'lock' && action.targetId) {
              updatedGame.points = updatedGame.points.map(p => p.id === action.targetId ? { ...p, isUnlocked: false } : p);
              hasChanges = true;
          }
          if (action.type === 'score' && action.value) {
              scoreDelta += action.value;
          }
          if (action.type === 'open_playground' && action.targetId) {
              setViewingPlaygroundId(action.targetId);
          }
          if (action.type === 'cooldown' && activeTaskModalId && action.cooldownSeconds) {
              // Add cooldown for the current task (the one that triggered this action)
              const cooldownEndTime = Date.now() + (action.cooldownSeconds * 1000);
              setTaskCooldowns(prev => new Map(prev).set(activeTaskModalId, cooldownEndTime));
          }
      });

      if (hasChanges) {
          updateActiveGame(updatedGame, "Logic Execution");
      }
      if (scoreDelta !== 0) {
          setScore(prev => prev + scoreDelta);
          // In simulation, we update the local dummy team score
          if (currentTeam) {
              setCurrentTeam({ ...currentTeam, score: currentTeam.score + scoreDelta });
          }
      }
  };

  const handleMapClick = (coord: Coordinate) => {
      // DISABLED: Measure tool should ONLY work with tasks, not random map points
      // Users should click tasks to measure between them
      if (mode === GameMode.EDIT && isMeasuring) {
          console.log('[Measure] Map click ignored - please click tasks to measure between them');
          return;
      }

      if (mode === GameMode.EDIT && isRelocating && currentGameObj) {
          // Calculate offset from current center to new location
          const points = currentGameObj.points;
          if (points.length === 0) return;

          // Calculate center of all points
          const centerLat = points.reduce((sum, p) => sum + p.location.lat, 0) / points.length;
          const centerLng = points.reduce((sum, p) => sum + p.location.lng, 0) / points.length;
          const currentCenter = { lat: centerLat, lng: centerLng };

          // Calculate offset
          const latOffset = coord.lat - currentCenter.lat;
          const lngOffset = coord.lng - currentCenter.lng;

          // Apply offset to all points
          const relocatedPoints = points.map(p => ({
              ...p,
              location: {
                  lat: p.location.lat + latOffset,
                  lng: p.location.lng + lngOffset
              }
          }));

          updateActiveGame({ ...currentGameObj, points: relocatedPoints }, "Relocated All Tasks");
          // Keep scope active for multiple relocations - user must click button again to exit
          console.log('[Relocate] Moved all tasks by offset:', { latOffset, lngOffset });
      }
  };

  const handleStartGame = async (gameId: string, teamName: string, userName: string, teamPhoto: string | null, style: MapStyleId) => {
      setActiveGameId(gameId);
      setLocalMapStyle(style);
      teamSync.connect(gameId, teamName, userName);
      setMode(GameMode.PLAY);
      setShowLanding(false);

      // Set volume to 80% on game load (as requested)
      setGlobalVolume(80);

      const teams = await db.fetchTeams(gameId);
      const myTeam = teams.find(t => t.name === teamName);
      if (myTeam) {
          setCurrentTeam(myTeam);
      }
  };

  const handleRelocateGame = () => {
      if (!isRelocating && currentGameObj && currentGameObj.points.length > 0) {
          // Entering relocation mode - calculate scope center
          const points = currentGameObj.points;
          const centerLat = points.reduce((sum, p) => sum + p.location.lat, 0) / points.length;
          const centerLng = points.reduce((sum, p) => sum + p.location.lng, 0) / points.length;
          setRelocateScopeCenter({ lat: centerLat, lng: centerLng });
          setIsRelocating(true);
          console.log('[Relocate] Entered scope mode, center at:', { lat: centerLat, lng: centerLng });
      } else {
          // Exiting relocation mode
          setIsRelocating(false);
          setRelocateScopeCenter(null);
      }
  };

  const handleToggleMeasure = () => {
      if (isMeasuring) {
          // Exit measuring mode - clear all measurement data
          console.log('[Measure] Exiting measure mode');
          setIsMeasuring(false);
          setMeasurePath([]);
          setMeasuredDistance(0);
          setMeasurePointsCount(0);
          setSelectedMeasurePointIds([]);
      } else {
          // Enter measuring mode - start fresh
          console.log('[Measure] Entering measure mode - Click tasks to measure distances');
          setIsMeasuring(true);
          setMeasurePath([]);
          setMeasuredDistance(0);
          setMeasurePointsCount(0);
          setSelectedMeasurePointIds([]);
      }
  };


  const handleLocateMe = () => {
      if (userLocation && mapRef.current) {
          mapRef.current.jumpTo(userLocation);
      }
  };

  const handleAddDangerZone = () => {
      try {
          if (!currentGameObj || !mapRef.current) {
              console.warn('[Danger Zone] Missing game object or map ref');
              return;
          }
          const center = mapRef.current.getCenter();
          const newZone: DangerZone = {
              id: `dz-${Date.now()}`,
              location: center,
              radius: 50,
              penalty: 50,
              duration: 10,
              title: 'NEW ZONE',
              penaltyType: 'fixed'
          };
          updateActiveGame({ ...currentGameObj, dangerZones: [...(currentGameObj.dangerZones || []), newZone] }, "Added Danger Zone");
          setActiveDangerZone(newZone);
          console.log('[Danger Zone] Zone added at:', center);
      } catch (error) {
          console.error('[Danger Zone] Error adding danger zone:', error);
      }
  };

  const handleSaveDangerZone = async (updatedZone: DangerZone) => {
      if (!currentGameObj) return;
      const updatedZones = (currentGameObj.dangerZones || []).map(z => z.id === updatedZone.id ? updatedZone : z);
      await updateActiveGame({ ...currentGameObj, dangerZones: updatedZones }, "Updated Danger Zone");
      setActiveDangerZone(null);
  };

  const handleDeleteDangerZone = async () => {
      if (!currentGameObj || !activeDangerZone) return;
      const updatedZones = (currentGameObj.dangerZones || []).filter(z => z.id !== activeDangerZone.id);
      await updateActiveGame({ ...currentGameObj, dangerZones: updatedZones }, "Deleted Danger Zone");
      setActiveDangerZone(null);
  };

  const handleUpdateRoute = (id: string, updates: Partial<GameRoute>) => {
      if (!currentGameObj) return;
      const updatedRoutes = (currentGameObj.routes || []).map(r => r.id === id ? { ...r, ...updates } : r);
      updateActiveGame({ ...currentGameObj, routes: updatedRoutes }, "Updated Route");
  };

  const handleManualUnlock = async (pointId: string) => {
      if (!currentGameObj) return;

      if (mode === GameMode.SIMULATION) {
          const updatedPoints = currentGameObj.points.map(p => (p.id === pointId ? { ...p, isUnlocked: true } : p));
          await updateActiveGame({ ...currentGameObj, points: updatedPoints }, "Manual Unlock");
          return;
      }

      const remote = await db.patchGamePoints(
          currentGameObj.id,
          [{ pointId, patch: { isUnlocked: true } }],
          { user: authUser?.name, action: 'Manual Unlock' }
      );

      if (remote) {
          setGames(prev => prev.map(g => (g.id === remote.id ? remote : g)));
          setActiveGame(remote);
      } else {
          const updatedPoints = currentGameObj.points.map(p => (p.id === pointId ? { ...p, isUnlocked: true } : p));
          await updateActiveGame({ ...currentGameObj, points: updatedPoints }, "Manual Unlock");
      }
  };

  const handleTaskComplete = async (id: string, pts?: number) => {
      const pointsToAdd = pts || 0;
      setScore(s => s + pointsToAdd);
      
      const point = currentGameObj?.points.find(p => p.id === id);
      
      // Update Team State (Local or DB)
      if (currentTeam) {
          const newScore = currentTeam.score + pointsToAdd;
          const newCompleted = [...(currentTeam.completedPointIds || []), id];
          
          if (mode === GameMode.SIMULATION) {
              // Local update only
              setCurrentTeam({
                  ...currentTeam,
                  score: newScore,
                  completedPointIds: newCompleted
              });
          } else {
              // DB update (Real Play) - handled implicitly via updateActiveGame usually for points, but explicit team update here:
              // Note: Ideally team update logic is in updateTeamProgress, but here we sync UI state
          }
      }

      // Execute Logic: On Correct
      if (point?.logic?.onCorrect) {
          executeGameLogic(point.logic.onCorrect);
      }

      const updatedPoints = currentGameObj?.points.map(p => p.id === id ? { ...p, isCompleted: true } : p) || [];

      if (currentGameObj) {
          if (mode === GameMode.SIMULATION) {
              updateActiveGame({ ...currentGameObj, points: updatedPoints }, "Task Completed");
          } else {
              const remote = await db.patchGamePoints(
                  currentGameObj.id,
                  [{ pointId: id, patch: { isCompleted: true } }],
                  { user: authUser?.name, action: 'Task Completed' }
              );

              if (remote) {
                  setGames(prev => prev.map(g => (g.id === remote.id ? remote : g)));
                  setActiveGame(remote);
              } else {
                  updateActiveGame({ ...currentGameObj, points: updatedPoints }, "Task Completed");
              }
          }
      }

      setActiveTaskModalId(null);
  };

  const handleTaskIncorrect = () => {
      if (activeTaskModalId && currentGameObj) {
          const point = currentGameObj.points.find(p => p.id === activeTaskModalId);
          if (point?.logic?.onIncorrect) {
              executeGameLogic(point.logic.onIncorrect);
          }
      }
  };

  // --- TAG MANAGEMENT ---
  const handleRenameTagGlobally = async (
      oldTag: string,
      newTag: string,
      onProgress?: (progress: number, label: string) => void
  ) => {
      const oldLower = oldTag.toLowerCase();
      const newLower = newTag.toLowerCase();

      const replaceTag = (tags: string[] | undefined): { next: string[]; changed: boolean } => {
          const current = tags || [];
          let changed = false;
          const next = current.map(t => {
              if (t.toLowerCase() === oldLower) {
                  changed = true;
                  return newLower;
              }
              return t;
          });
          return { next, changed };
      };

      onProgress?.(0, 'Scanning items...');

      const updatedLib: TaskTemplate[] = [];
      const changedTemplates: TaskTemplate[] = [];
      for (const t of taskLibrary) {
          const { next, changed } = replaceTag(t.tags);
          const updated = { ...t, tags: next };
          updatedLib.push(updated);
          if (changed) changedTemplates.push(updated);
      }

      const updatedLists = taskLists.map(list => {
          let listChanged = false;
          const updatedTasks = (list.tasks || []).map(task => {
              const { next, changed } = replaceTag(task.tags);
              if (changed) listChanged = true;
              return { ...task, tags: next };
          });
          const updated = { ...list, tasks: updatedTasks };
          return { updated, listChanged };
      });

      const updatedGames = games.map(g => {
          let gameChanged = false;
          const updatedPoints = (g.points || []).map(p => {
              const { next, changed } = replaceTag(p.tags as any);
              if (changed) gameChanged = true;
              return { ...p, tags: next };
          });
          const updated = { ...g, points: updatedPoints };
          return { updated, gameChanged };
      });

      if (changedTemplates.length > 0) {
          const { ok } = await db.saveTemplates(changedTemplates, {
              onProgress: ({ completed, total }) => {
                  const pct = total ? completed / total : 1;
                  onProgress?.(pct * 0.6, `Updating tasks (${Math.min(total, completed + 1)}/${total})`);
              }
          });
          if (!ok) console.error('[App] Failed to persist library tag rename');
      }

      const listChanges = updatedLists.filter(x => x.listChanged).map(x => x.updated);
      if (listChanges.length > 0) {
          for (let i = 0; i < listChanges.length; i++) {
              onProgress?.(0.6 + (i / listChanges.length) * 0.2, `Updating lists (${i + 1}/${listChanges.length})`);
              await db.saveTaskList(listChanges[i]);
          }
      }

      const gameChanges = updatedGames.filter(x => x.gameChanged).map(x => x.updated);
      if (gameChanges.length > 0) {
          await db.saveGames(gameChanges, {
              chunkSize: 2,
              onProgress: ({ completed, total }) => {
                  const pct = total ? completed / total : 1;
                  onProgress?.(0.8 + pct * 0.2, `Updating games (${Math.min(total, completed + 1)}/${total})`);
              }
          });
      }

      onProgress?.(1, 'Done');
      setTaskLibrary(updatedLib);
      setTaskLists(updatedLists.map(x => x.updated));
      setGames(updatedGames.map(x => x.updated));
  };

  const handleDeleteTagGlobally = async (
      tagToDelete: string,
      onProgress?: (progress: number, label: string) => void
  ) => {
      const tagToDeleteLower = tagToDelete.toLowerCase();

      const stripTag = (tags: string[] | undefined): { next: string[]; changed: boolean } => {
          const current = tags || [];
          const next = current.filter(tag => tag.toLowerCase() !== tagToDeleteLower);
          return { next, changed: next.length !== current.length };
      };

      onProgress?.(0, 'Scanning items...');

      const updatedLib: TaskTemplate[] = [];
      const changedTemplates: TaskTemplate[] = [];
      for (const t of taskLibrary) {
          const { next, changed } = stripTag(t.tags);
          const updated = { ...t, tags: next };
          updatedLib.push(updated);
          if (changed) changedTemplates.push(updated);
      }

      const updatedLists = taskLists.map(list => {
          let listChanged = false;
          const updatedTasks = (list.tasks || []).map(task => {
              const { next, changed } = stripTag(task.tags);
              if (changed) listChanged = true;
              return { ...task, tags: next };
          });
          const updated = { ...list, tasks: updatedTasks };
          return { updated, listChanged };
      });

      const updatedGames = games.map(g => {
          let gameChanged = false;
          const updatedPoints = (g.points || []).map(p => {
              const { next, changed } = stripTag(p.tags as any);
              if (changed) gameChanged = true;
              return { ...p, tags: next };
          });
          const updated = { ...g, points: updatedPoints };
          return { updated, gameChanged };
      });

      if (changedTemplates.length > 0) {
          const { ok } = await db.saveTemplates(changedTemplates, {
              onProgress: ({ completed, total }) => {
                  const pct = total ? completed / total : 1;
                  onProgress?.(pct * 0.6, `Updating tasks (${Math.min(total, completed + 1)}/${total})`);
              }
          });
          if (!ok) console.error('[App] Failed to persist library tag delete');
      }

      const listChanges = updatedLists.filter(x => x.listChanged).map(x => x.updated);
      if (listChanges.length > 0) {
          for (let i = 0; i < listChanges.length; i++) {
              onProgress?.(0.6 + (i / listChanges.length) * 0.2, `Updating lists (${i + 1}/${listChanges.length})`);
              await db.saveTaskList(listChanges[i]);
          }
      }

      const gameChanges = updatedGames.filter(x => x.gameChanged).map(x => x.updated);
      if (gameChanges.length > 0) {
          await db.saveGames(gameChanges, {
              chunkSize: 2,
              onProgress: ({ completed, total }) => {
                  const pct = total ? completed / total : 1;
                  onProgress?.(0.8 + pct * 0.2, `Updating games (${Math.min(total, completed + 1)}/${total})`);
              }
          });
      }

      onProgress?.(1, 'Done');
      setTaskLibrary(updatedLib);
      setTaskLists(updatedLists.map(x => x.updated));
      setGames(updatedGames.map(x => x.updated));
  };

  const isCaptain = currentTeam?.captainDeviceId === teamSync.getDeviceId() || mode === GameMode.SIMULATION;

  const mapTeams = useMemo(() => {
      const list = [];
      if (isCaptain && onlineMembers.length > 0) {
          list.push(...onlineMembers.map(m => ({
              team: { id: 'teammates', gameId: activeGameId || '', name: m.userName, score: 0, members: [], updatedAt: '', isStarted: true }, 
              location: m.location!, 
              status: m.isSolving ? 'solving' as const : 'moving' as const
          })));
      }
      if (activeGame?.showOtherTeams) {
          list.push(...otherTeamsLocations.map(l => ({
              team: { id: l.teamId, gameId: activeGameId || '', name: l.name, photoUrl: l.photoUrl, score: 0, members: [], updatedAt: '', isStarted: true },
              location: l.location,
              status: 'moving' as const
          })));
      }
      return list;
  }, [isCaptain, onlineMembers, otherTeamsLocations, activeGame?.showOtherTeams, activeGameId]);

  // Export template tasks to global library
  const handleExportTemplateToLibrary = async () => {
      if (!playgroundTemplateToEdit || !playgroundTemplateToEdit.tasks || playgroundTemplateToEdit.tasks.length === 0) {
          alert('No tasks to export');
          return;
      }

      try {
          const taskTemplates = playgroundTemplateToEdit.tasks.map(point => {
              // Get existing tags and ensure 'playzone' tag is added
              const existingTags = Array.isArray(point.tags) ? point.tags : [];
              const tags = [...new Set([...existingTags, 'playzone'])]; // Add 'playzone' tag and remove duplicates

              return {
                  id: point.id,
                  title: point.title,
                  task: point.task,
                  feedback: point.feedback,
                  points: point.points,
                  tags: tags,
                  iconId: point.iconId,
                  iconUrl: point.iconUrl,
                  completedIconId: (point as any).completedIconId,
                  completedIconUrl: (point as any).completedIconUrl,
                  settings: point.settings,
                  logic: point.logic,
                  activationTypes: point.activationTypes,
                  qrCodeString: point.qrCodeString,
                  nfcTagId: point.nfcTagId,
                  ibeaconUUID: point.ibeaconUUID,
                  colorScheme: point.colorScheme,
                  isColorSchemeLocked: point.isColorSchemeLocked,
                  createdAt: Date.now(),
                  intro: point.shortIntro
              } as TaskTemplate;
          });

          const { ok } = await db.saveTemplates(taskTemplates);

          if (ok) {
              // Reload the global library to show newly exported tasks
              const updatedLib = await db.fetchLibrary();
              setTaskLibrary(updatedLib);

              const playzoneCount = taskTemplates.filter(t => t.tags.includes('playzone')).length;
              alert(`✅ Exported ${taskTemplates.length} tasks to Global Library and synced to Supabase!\n${playzoneCount > 0 ? `(${playzoneCount} tagged as PLAYZONE)` : ''}`);
              console.log('[Export Template] Tasks exported to library:', taskTemplates.length, 'Playzone tasks:', playzoneCount);
          } else {
              alert('❌ Failed to export tasks to library');
          }
      } catch (error) {
          console.error('[Export Template] Error exporting tasks:', error);
          alert('Error exporting tasks to library');
      }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const submissionToken = urlParams.get('submitTo');
  if (submissionToken) {
      return <ClientSubmissionView token={submissionToken} />;
  }

  if (showLogin) {
      return (
          <LoginPage 
              onLoginSuccess={(user) => { setAuthUser(user); setShowLogin(false); }}
              onPlayAsGuest={() => { setAuthUser({ id: 'guest', name: 'Guest', email: '', role: 'Editor' }); setShowLogin(false); }}
              onBack={() => setShowLogin(false)}
          />
      );
  }

  const renderModals = () => (
      <>
          {showDashboard && (
              <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md animate-in fade-in">
                  <Dashboard 
                      games={games}
                      taskLists={taskLists}
                      taskLibrary={taskLibrary}
                      onBack={() => setShowDashboard(false)}
                      onAction={(action) => {
                          if (action === 'CREATE') {
                              setShowDashboard(false);
                              setGameToEdit(null);
                              setShowGameCreator(true);
                          }
                          if (action === 'EDIT_GAME') {
                              if (activeGameId && activeGame) {
                                  setGameToEdit(activeGame);
                                  setShowGameCreator(true);
                                  setShowDashboard(false); 
                              } else {
                                  setShowGameChooser(true);
                              }
                          }
                      }}
                      onSelectGame={(id) => {
                          const game = games.find(g => g.id === id);
                          if (game) {
                              setActiveGameId(id);
                              setActiveGame(game);
                              setGameToEdit(game);
                              setShowGameCreator(true);
                              setShowDashboard(false);
                          }
                      }}
                      userName={authUser?.name || 'Admin'}
                      initialTab={dashboardTab}
                      onDeleteTagGlobally={handleDeleteTagGlobally}
                      onRenameTagGlobally={handleRenameTagGlobally}
                  />
              </div>
          )}

          {showGameChooser && (
              <GameManager 
                  games={games}
                  taskLists={taskLists}
                  activeGameId={activeGameId}
                  activeGamePoints={activeGame?.points || []}
                  onCreateGame={async (name, listId, desc, style) => {
                      const newGame: Game = {
                          id: `game-${Date.now()}`,
                          name,
                          description: desc || '',
                          createdAt: Date.now(),
                          points: [],
                          defaultMapStyle: style,
                          createdBy: authUser?.name,
                          changeLog: [{ timestamp: Date.now(), user: authUser?.name || 'Unknown', action: 'Created Game' }]
                      };
                      await db.saveGame(newGame);
                      setGames([...games, newGame]);
                      setActiveGameId(newGame.id);
                      setMode(GameMode.EDIT);
                      setShowGameChooser(false);
                      setShowLanding(false);
                  }}
                  onSelectGame={async (id) => {
                      setActiveGameId(id);
                      setShowGameChooser(false);

                      // Handle pending import
                      if (pendingImport) {
                          const selectedGame = games.find(g => g.id === id);
                          if (selectedGame) {
                              if (pendingImport.type === 'tasks') {
                                  const newPoints = pendingImport.data.map((t: any) => ({
                                      ...t,
                                      id: `p-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                                      location: mapRef.current?.getCenter() || { lat: 0, lng: 0 },
                                      radiusMeters: 30,
                                      activationTypes: ['radius'],
                                      isUnlocked: true,
                                      isCompleted: false,
                                      order: selectedGame.points.length
                                  } as GamePoint));
                                  await updateActiveGame({ ...selectedGame, points: [...selectedGame.points, ...newPoints] }, `Imported ${pendingImport.data.length} Tasks`);
                              } else if (pendingImport.type === 'list') {
                                  const list = pendingImport.data;
                                  const newPoints = list.tasks.map((t: any, idx: number) => ({
                                      ...t,
                                      id: `p-${Date.now()}-${idx}-${Math.random().toString(36).substr(2,9)}`,
                                      location: mapRef.current?.getCenter() || { lat: 0, lng: 0 },
                                      radiusMeters: 30,
                                      activationTypes: ['radius'],
                                      isUnlocked: true,
                                      isCompleted: false,
                                      order: selectedGame.points.length + idx
                                  } as GamePoint));
                                  await updateActiveGame({ ...selectedGame, points: [...selectedGame.points, ...newPoints] }, `Imported TaskList "${list.name}" (${list.tasks.length} Tasks)`);
                              }
                              setPendingImport(null);
                          }
                      }
                  }}
                  onDeleteGame={handleDeleteGame}
                  onClose={() => setShowGameChooser(false)}
                  onEditGame={(id) => {
                      const game = games.find(g => g.id === id);
                      if (game) {
                          setGameToEdit(game);
                          setActiveGameId(id);
                          setShowGameCreator(true);
                          setShowGameChooser(false);
                      }
                  }}
                  onEditGameSetup={(id) => {
                      const game = games.find(g => g.id === id);
                      if (game) {
                          setGameToEdit(game);
                          setActiveGameId(id);
                          setShowGameCreator(true);
                          setShowGameChooser(false);
                      }
                  }}
                  onEditPoint={setActiveTask}
                  onReorderPoints={() => {}}
                  onCreateTestGame={() => {}}
                  onOpenTaskMaster={() => setShowTaskMaster(true)}
                  onClearMap={() => updateActiveGame({ ...currentGameObj!, points: [] }, "Cleared Map")}
                  mode={mode}
                  onSetMode={setMode}
                  onStartSimulation={(game) => handleStartSimulation(game)} // Passing simulation handler
              />
          )}

          {activeTask && (
              <TaskModal 
                  point={activeTask}
                  distance={0}
                  onClose={() => setActiveTask(null)}
                  onComplete={() => {}}
                  mode={mode}
                  isInstructorMode={mode === GameMode.INSTRUCTOR}
                  onOpenActions={() => setActiveTaskActionPoint(activeTask)}
              />
          )}
          {liveTaskModalPoint && (
              <TaskModal
                  point={liveTaskModalPoint}
                  distance={mode === GameMode.SIMULATION ? 0 : (liveTaskModalPoint.playgroundId ? 0 : haversineMeters(userLocation, liveTaskModalPoint.location))}
                  onClose={() => setActiveTaskModalId(null)}
                  onComplete={handleTaskComplete}
                  onTaskIncorrect={handleTaskIncorrect}
                  onUnlock={handleManualUnlock}
                  mode={mode}
                  isInstructorMode={mode === GameMode.INSTRUCTOR}
                  game={activeGame}
                  isCaptain={currentTeam?.captainDeviceId === teamSync.getDeviceId() || mode === GameMode.SIMULATION}
              />
          )}
          {showTaskMaster && (
              <TaskMaster
                  initialTab={taskMasterInitialTab}
                  onClose={() => setShowTaskMaster(false)}
                  onImportTasks={async (tasks) => {
                      if (currentGameObj) {
                          const newPoints = tasks.map(t => ({
                              ...t,
                              id: t.id || `p-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                              location: mapRef.current?.getCenter() || { lat: 0, lng: 0 },
                              radiusMeters: 30,
                              activationTypes: ['radius'],
                              isUnlocked: true,
                              isCompleted: false,
                              order: currentGameObj.points.length
                          } as GamePoint));
                          await updateActiveGame({ ...currentGameObj, points: [...currentGameObj.points, ...newPoints] }, `Imported ${tasks.length} Tasks`);
                          setShowTaskMaster(false);
                      } else {
                          setPendingImport({ type: 'tasks', data: tasks });
                          setShowGameChooser(true);
                          setShowTaskMaster(false);
                      }
                  }}
                  onImportTaskList={async (list) => {
                      if (currentGameObj) {
                          const newPoints = list.tasks.map((t, idx) => ({
                              ...t,
                              id: t.id || `p-${Date.now()}-${idx}-${Math.random().toString(36).substr(2,9)}`,
                              location: mapRef.current?.getCenter() || { lat: 0, lng: 0 },
                              radiusMeters: 30,
                              activationTypes: ['radius'],
                              isUnlocked: true,
                              isCompleted: false,
                              order: currentGameObj.points.length + idx
                          } as GamePoint));
                          await updateActiveGame({ ...currentGameObj, points: [...currentGameObj.points, ...newPoints] }, `Imported TaskList "${list.name}" (${list.tasks.length} Tasks)`);
                          setShowTaskMaster(false);
                      } else {
                          setPendingImport({ type: 'list', data: list });
                          setShowGameChooser(true);
                          setShowTaskMaster(false);
                      }
                  }}
                  taskLists={taskLists}
                  onUpdateTaskLists={setTaskLists}
                  taskLibrary={taskLibrary}
                  onUpdateTaskLibrary={setTaskLibrary}
                  games={games}
                  onDeleteTagGlobally={handleDeleteTagGlobally}
                  onRenameTagGlobally={handleRenameTagGlobally}
              />
          )}
          {/* ... Rest of modals ... */}
          {showGameCreator && (
              <GameCreator
                  onClose={() => { setShowGameCreator(false); setInitialGameMode(null); }}
                  onCreate={async (gameData) => {
                      if (gameToEdit && gameToEdit.id === gameData.id) {
                          // Validate playzone game before updating
                          const gameWithMode = { ...gameToEdit, ...gameData, gameMode: gameToEdit.gameMode || gameData.gameMode };
                          if (gameWithMode.gameMode === 'playzone') {
                              const validation = validatePlayzoneGame(gameWithMode);
                              if (!validation.valid) {
                                  alert(`⚠️ Playzone Game Validation Failed:\n\n${validation.errors.join('\n')}`);
                                  return;
                              }
                              if (validation.warnings.length > 0) {
                                  console.warn('Playzone Game Warnings:', validation.warnings);
                              }
                              // Clean the game data (remove GPS activations, etc.)
                              const cleanedGame = cleanPlayzoneGame(gameWithMode);
                              await updateActiveGame(cleanedGame, "Updated Playzone Game Settings");
                          } else {
                              await updateActiveGame(gameWithMode, "Updated Game Settings");
                          }
                      } else {
                          let newGame = {
                              ...gameData,
                              id: `game-${Date.now()}`,
                              points: [],
                              createdAt: Date.now(),
                              createdBy: authUser?.name,
                              changeLog: [{ timestamp: Date.now(), user: authUser?.name || 'Unknown', action: 'Created Game' }],
                              gameMode: initialGameMode || 'standard'
                          } as Game;

                          // Validate and clean playzone games
                          if (newGame.gameMode === 'playzone') {
                              const validation = validatePlayzoneGame(newGame);
                              if (validation.warnings.length > 0) {
                                  console.warn('✓ Playzone Game created with warnings:', validation.warnings);
                              }
                              newGame = cleanPlayzoneGame(newGame);
                          }

                          await db.saveGame(newGame);
                          setGames([...games, newGame]);
                          setActiveGameId(newGame.id);
                          setShowGameChooser(true); // Return to chooser after create
                      }
                      setShowGameCreator(false);
                      setGameToEdit(null);
                      setInitialGameMode(null);
                  }}
                  baseGame={gameToEdit || undefined}
                  onDelete={handleDeleteGame}
                  initialGameMode={initialGameMode}
                  onOpenPlaygroundEditor={(playgroundId) => {
                      setShowGameCreator(false);
                      setViewingPlaygroundId(playgroundId || null);
                  }}
              />
          )}
          {showTeamsHub && (
              <TeamsHubModal 
                  onClose={() => setShowTeamsHub(false)}
                  onAction={(action) => {
                      if (action === 'JOIN') {
                          setMode(GameMode.PLAY);
                          setShowLanding(false);
                          setShowTeamsHub(false);
                      } else {
                          setShowTeamsModal(true);
                          setShowTeamsHub(false);
                      }
                  }}
              />
          )}
          {showTeamsModal && (
              <TeamsModal 
                  gameId={activeGameId}
                  games={games}
                  onSelectGame={setActiveGameId}
                  onClose={() => setShowTeamsModal(false)}
                  isAdmin={true}
              />
          )}
          {showInstructorDashboard && activeGame && (
              <InstructorDashboard 
                  game={activeGame}
                  onClose={() => setShowInstructorDashboard(false)}
                  onSetMode={setMode}
                  mode={mode}
              />
          )}
          {showTeamDashboard && activeGameId && (
              <TeamDashboard
                  gameId={activeGameId}
                  totalMapPoints={currentGameObj?.points.length || 0}
                  onOpenAgents={() => {}}
                  onClose={() => setShowTeamDashboard(false)}
                  chatHistory={chatHistory}
              />
          )}
          {showTeamLobby && currentTeam && activeGame?.gameMode === 'playzone' && (
              <PlayzoneGameEntry
                  isOpen={showTeamLobby}
                  onClose={() => setShowTeamLobby(false)}
                  onTeamJoin={(name) => {
                      // For playzone games, set team name and start game
                      setCurrentTeam({...currentTeam, name});
                      setShowTeamLobby(false);
                  }}
                  gameName={activeGame?.name}
              />
          )}
          {showTeamLobby && currentTeam && activeGame?.gameMode !== 'playzone' && (
              <TeamLobbyPanel
                  isOpen={showTeamLobby}
                  onClose={() => setShowTeamLobby(false)}
                  isCaptain={currentTeam.captainDeviceId === teamSync.getDeviceId() || mode === GameMode.SIMULATION}
              />
          )}
          {showDeleteGames && (
              <DeleteGamesModal 
                  games={games}
                  onClose={() => setShowDeleteGames(false)}
                  onDeleteGame={handleDeleteGame}
              />
          )}
          {showPlaygroundManager && (
              <PlaygroundManager 
                  onClose={() => setShowPlaygroundManager(false)}
                  onEdit={(template) => {
                      setPlaygroundTemplateToEdit(template);
                      setShowPlaygroundManager(false);
                  }}
                  onCreate={() => {
                      const newTemplate: PlaygroundTemplate = {
                          id: `tpl-${Date.now()}`,
                          title: 'New Playzone Template',
                          isGlobal: true,
                          createdAt: Date.now(),
                          playgroundData: {
                              id: `pg-tpl-${Date.now()}`,
                              title: 'New Zone',
                              buttonVisible: true,
                              iconId: 'default',
                              location: { lat: 0, lng: 0 }
                          },
                          tasks: []
                      };
                      setPlaygroundTemplateToEdit(newTemplate);
                      setShowPlaygroundManager(false);
                  }}
              />
          )}
          {(viewingPlaygroundId || playgroundTemplateToEdit) && (
              <PlaygroundEditor
                  game={playgroundTemplateToEdit ? {
                      id: 'template-edit',
                      name: playgroundTemplateToEdit.title,
                      description: '',
                      createdAt: Date.now(),
                      points: playgroundTemplateToEdit.tasks,
                      playgrounds: [playgroundTemplateToEdit.playgroundData]
                  } as Game : (currentGameObj || { id: 'temp', name: 'Temp', points: [], createdAt: 0 } as any)}
                  initialPlaygroundId={viewingPlaygroundId || undefined}
                  onUpdateGame={(updatedGame) => {
                      if (playgroundTemplateToEdit && updatedGame.playgrounds?.[0]) {
                          setPlaygroundTemplateToEdit({
                              ...playgroundTemplateToEdit,
                              title: updatedGame.name,
                              playgroundData: updatedGame.playgrounds[0],
                              tasks: updatedGame.points
                          });
                      } else if (currentGameObj) {
                          updateActiveGame(updatedGame, "Updated Playground");
                      }
                  }}
                  onClose={() => {
                      const wasEditingTemplate = !!playgroundTemplateToEdit;
                      setViewingPlaygroundId(null);
                      setPlaygroundTemplateToEdit(null);
                      if (wasEditingTemplate) {
                          setShowPlaygroundManager(true);
                      }
                  }}
                  onEditPoint={(p) => setActiveTask(p)}
                  onPointClick={(p) => handlePointClick(p)}
                  onAddTask={async (type, playgroundId) => {
                      if (playgroundTemplateToEdit) {
                          // Template logic handled by editor
                      } else if (currentGameObj) {
                          // ...
                      }
                  }}
                  onOpenLibrary={() => {}}
                  showScores={showScores}
                  onToggleScores={() => setShowScores(!showScores)}
                  onHome={() => {
                      setViewingPlaygroundId(null);
                      setPlaygroundTemplateToEdit(null);
                  }}
                  isTemplateMode={!!playgroundTemplateToEdit}
                  onSaveTemplate={async (name) => {
                      if (playgroundTemplateToEdit) {
                          const updatedTemplate = { ...playgroundTemplateToEdit, title: name };
                          await db.savePlaygroundTemplate(updatedTemplate);
                          setPlaygroundTemplateToEdit(null);
                          setShowPlaygroundManager(true);
                      }
                  }}
                  onAddZoneFromLibrary={() => {}}
                  onStartSimulation={!playgroundTemplateToEdit && currentGameObj ? () => handleStartSimulation(currentGameObj) : undefined}
                  onOpenGameSettings={() => {
                      if (!playgroundTemplateToEdit && currentGameObj) {
                          setGameToEdit(currentGameObj);
                          setShowGameCreator(true);
                      }
                  }}
                  taskLists={taskLists}
                  onUpdateTaskLists={setTaskLists}
                  taskLibrary={taskLibrary}
                  onUpdateTaskLibrary={setTaskLibrary}
              />
          )}
          {showChatDrawer && activeGameId && (
              <ChatDrawer 
                  isOpen={showChatDrawer}
                  onClose={() => setShowChatDrawer(false)}
                  messages={chatHistory}
                  gameId={activeGameId}
                  mode={mode}
                  userName={authUser?.name || "Player"}
                  isInstructor={mode === GameMode.INSTRUCTOR}
              />
          )}
          {activeTaskActionPoint && currentGameObj && (
              <TaskActionModal 
                  point={activeTaskActionPoint}
                  allPoints={currentGameObj.points}
                  playgrounds={currentGameObj.playgrounds}
                  onClose={() => setActiveTaskActionPoint(null)}
                  onSave={(updatedPoint) => {
                      if (currentGameObj) {
                          const updatedPoints = currentGameObj.points.map(p => p.id === updatedPoint.id ? updatedPoint : p);
                          updateActiveGame({ ...currentGameObj, points: updatedPoints }, "Updated Task Logic");
                      }
                  }}
                  onStartDrawMode={() => {}}
              />
          )}
          {latestMessage && (
              <MessagePopup
                  message={latestMessage.message}
                  sender={latestMessage.sender}
                  onClose={() => setLatestMessage(null)}
                  isUrgent={latestMessage.isUrgent}
              />
          )}
          {activeDangerZone && (
              <DangerZoneModal
                  zone={activeDangerZone}
                  onSave={handleSaveDangerZone}
                  onDelete={handleDeleteDangerZone}
                  onClose={() => setActiveDangerZone(null)}
              />
          )}
          {showMeasureResult && (
              <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                  <div className="bg-slate-900 border-2 border-orange-500 rounded-2xl shadow-[0_0_50px_rgba(249,115,22,0.5)] overflow-hidden flex flex-col max-w-sm w-full">
                      <div className="p-6 bg-orange-950/50 border-b border-orange-900/50 flex items-center gap-3">
                          <div className="p-2 bg-orange-600 rounded-lg">
                              <Ruler className="w-5 h-5 text-white" />
                          </div>
                          <div>
                              <h2 className="text-lg font-black text-white uppercase tracking-widest">MEASUREMENT RESULT</h2>
                              <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wide">Task Distance Analysis</p>
                          </div>
                      </div>
                      <div className="p-6 space-y-6">
                          <div className="space-y-2">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TASKS SELECTED</div>
                              <div className="text-4xl font-black text-orange-500">{measurePointsCount}</div>
                              <p className="text-[10px] text-slate-400 mt-2">point{measurePointsCount !== 1 ? 's' : ''} in measurement line</p>
                          </div>
                          <div className="space-y-2">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL DISTANCE</div>
                              <div className="text-3xl font-black text-green-500">{measuredDistance.toFixed(0)}<span className="text-lg ml-2">M</span></div>
                              <p className="text-[10px] text-slate-400 mt-2">between selected tasks</p>
                          </div>
                      </div>
                      <div className="p-4 bg-slate-800/50 border-t border-slate-700 flex gap-3">
                          <button
                              onClick={() => {
                                  setShowMeasureResult(false);
                                  setSelectedMeasurePointIds([]);
                              }}
                              className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors text-sm uppercase"
                          >
                              Clear Selection
                          </button>
                          <button
                              onClick={() => setShowMeasureResult(false)}
                              className="flex-1 py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition-colors text-sm uppercase shadow-lg"
                          >
                              Close
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </>
  );

  if (showLanding) {
      return (
          <>
            <InitialLanding
                version={APP_VERSION}
                games={games}
                activeGameId={activeGameId}
                onSelectGame={setActiveGameId}
                authUser={authUser}
                onLogout={() => {
                    authService.logout();
                    setAuthUser(null);
                }}
                onAction={(action) => {
                    if (action === 'PLAY') {
                        if (activeGameId) {
                            setMode(GameMode.PLAY);
                            setShowLanding(false);
                        } else {
                            setShowGameChooser(true);
                        }
                        return;
                    }
                    if (action === 'PREVIEW_TEAM') {
                        setShowLanding(false);
                        setMode(GameMode.PLAY);
                        return;
                    }
                    // Around The World opens directly without login requirement
                    if (action === 'CREATE_AROUNDTHEWORLD_GAME') {
                        setShowAroundTheWorldDashboard(true);
                        return;
                    }
                    ensureSession(() => {
                        switch (action) {
                            case 'GAMES': setShowGameChooser(true); break;
                            case 'CREATE_GAME':
                                setGameToEdit(null);
                                setInitialGameMode('standard');
                                setShowGameCreator(true);
                                break;
                            case 'CREATE_PLAYZONE_GAME':
                                setGameToEdit(null);
                                setInitialGameMode('playzone');
                                setShowGameCreator(true);
                                break;
                            case 'CREATE_ELIMINATION_GAME':
                                setGameToEdit(null);
                                setInitialGameMode('elimination');
                                setShowGameCreator(true);
                                break;
                            case 'EDIT_GAME': 
                                if (activeGameId && activeGame) {
                                    setGameToEdit(activeGame);
                                    setShowGameCreator(true);
                                } else {
                                    setShowGameChooser(true);
                                }
                                break;
                            case 'USERS': setDashboardTab('users'); setShowDashboard(true); break;
                            case 'TASKS': setTaskMasterInitialTab('LIBRARY'); setShowTaskMaster(true); break;
                            case 'TASKLIST': setTaskMasterInitialTab('LISTS'); setShowTaskMaster(true); break;
                            case 'TEAM_LOBBY': setShowTeamsHub(true); break;
                            case 'MANAGE_TEAMS': setShowTeamsModal(true); break;
                            case 'DELETE_GAMES': setShowDeleteGames(true); break;
                            case 'PLAYGROUNDS': setShowPlaygroundManager(true); break;
                            case 'DATABASE': setShowDatabaseTools(true); break;
                            case 'CLIENT_PORTAL': setDashboardTab('client'); setShowDashboard(true); break;
                        }
                    });
                }}
            />
            {showDatabaseTools && (
                <AdminModal 
                    games={games}
                    onClose={() => setShowDatabaseTools(false)}
                    onDeleteGame={handleDeleteGame}
                    initialShowSql={true}
                />
            )}
            {renderModals()}

            {/* Around The World Dashboard */}
            {showAroundTheWorldDashboard && (
                <AroundTheWorldDashboard
                    game={activeGame?.gameMode === 'aroundtheworld' ? activeGame : undefined}
                    teams={mapTeams.map(t => t.team)}
                    onCreateSession={async (name, config) => {
                        const newGame: Game = {
                            id: `atw-${Date.now()}`,
                            name: name.toUpperCase(),
                            description: 'Around The World - Victorian Expedition',
                            createdAt: Date.now(),
                            points: [],
                            gameMode: 'aroundtheworld',
                            aroundTheWorldConfig: {
                                mapStyle: 'europe',
                                tasksRequiredToUnlock: 3,
                                initialUnlockedCount: 1,
                                firstArrivalBonus: 200,
                                showTeamPositions: true,
                                fieldMissionsEnabled: false,
                                defaultFieldRadius: 50,
                                theme: 'victorian',
                                enableDaysTracking: true,
                                daysLimit: 80,
                                enableBranchingRoutes: true
                            }
                        };
                        await db.saveGame(newGame);
                        setGames([...games, newGame]);
                        setActiveGameId(newGame.id);
                    }}
                    onStartGame={() => {
                        if (activeGame) {
                            updateActiveGame({ ...activeGame, state: 'active' }, 'Start game');
                        }
                    }}
                    onPauseGame={() => {
                        if (activeGame) {
                            updateActiveGame({ ...activeGame, state: 'draft' }, 'Pause game');
                        }
                    }}
                    onSendChat={(message, teamId) => {
                        // TODO: Implement chat send
                        console.log('Send chat:', message, teamId);
                    }}
                    onUpdateGame={(game) => updateActiveGame(game, 'ATW Update')}
                    onClose={() => setShowAroundTheWorldDashboard(false)}
                    chatMessages={[]}
                    taskLibrary={activeGame?.points || []}
                    onAddTaskToCity={(cityId, taskId) => {
                        if (!activeGame) return;
                        const taskTemplate = getTaskById(taskId);
                        if (!taskTemplate) {
                            console.warn('Task not found:', taskId);
                            return;
                        }
                        // Create a GamePoint from the TaskTemplate
                        const newPoint: GamePoint = {
                            id: `${cityId}-${taskId}-${Date.now()}`,
                            title: taskTemplate.title,
                            destinationId: cityId,
                            task: taskTemplate.task,
                            points: taskTemplate.points,
                            tags: taskTemplate.tags,
                            iconId: taskTemplate.iconId || 'question',
                            jorden80TaskType: taskTemplate.tags?.includes('by') ? 'by' : taskTemplate.tags?.includes('land') ? 'land' : 'creative',
                            // Required GamePoint fields
                            location: null, // No physical location for ATW tasks
                            radiusMeters: 50,
                            activationTypes: ['click'],
                            isUnlocked: true,
                            isCompleted: false,
                            order: (activeGame.points || []).length
                        };
                        const updatedGame = {
                            ...activeGame,
                            points: [...(activeGame.points || []), newPoint]
                        };
                        updateActiveGame(updatedGame, `Add task ${taskTemplate.title} to ${cityId}`);
                    }}
                    onRemoveTaskFromCity={(cityId, taskId) => {
                        if (!activeGame) return;
                        const updatedGame = {
                            ...activeGame,
                            points: (activeGame.points || []).filter(p => p.id !== taskId)
                        };
                        updateActiveGame(updatedGame, `Remove task from ${cityId}`);
                    }}
                />
            )}
          </>
      );
  }

  // Active Game View
  return (
    <div className={`fixed inset-0 w-full h-full overflow-hidden bg-slate-900 text-white ${mode === GameMode.SIMULATION ? 'border-4 border-orange-500 shadow-[inset_0_0_50px_rgba(249,115,22,0.5)]' : ''}`}>

        {/* CONNECTION STATUS BANNER */}
        <ConnectionStatus />

        {/* SIMULATION BANNER */}
        {mode === GameMode.SIMULATION && (
            <div className="absolute top-0 left-0 right-0 h-12 bg-orange-600/90 backdrop-blur-md flex items-center justify-between px-6 z-[6000] shadow-xl border-b border-orange-400">
                <div className="flex items-center gap-3">
                    <PlayCircle className="w-6 h-6 text-white animate-pulse" />
                    <span className="text-sm font-black uppercase tracking-widest text-white">SIMULATION MODE ACTIVE</span>
                </div>
                <button 
                    onClick={handleStopSimulation}
                    className="px-6 py-1.5 bg-white text-orange-600 font-black uppercase text-xs rounded-full hover:bg-gray-100 transition-colors shadow-lg"
                >
                    EXIT SIMULATION
                </button>
            </div>
        )}

        {/* AROUND THE WORLD GAME VIEW */}
        {activeGame?.gameMode === 'aroundtheworld' && (mode === GameMode.PLAY || mode === GameMode.SIMULATION) && (
            <AroundTheWorldGameView
                game={currentGameObj!}
                teams={mapTeams.map(t => t.team)}
                currentTeam={currentTeam || undefined}
                isInstructor={false}
                userLocation={userLocation}
                onTaskComplete={(taskId, isCorrect, points) => {
                    if (isCorrect) {
                        handleTaskComplete(taskId, points);
                    } else {
                        handleTaskIncorrect();
                    }
                }}
                onUpdateGame={(updatedGame) => updateActiveGame(updatedGame, "Around the World Progress")}
                onClose={() => setShowLanding(true)}
                onOpenChat={() => setShowChatDrawer(true)}
                onOpenTeamLobby={() => setShowTeamLobby(true)}
                showScores={showScores}
                currentScore={score}
            />
        )}

        {/* GAME MAP - Hidden for Playzone and Around the World Games */}
        {activeGame?.gameMode !== 'playzone' && activeGame?.gameMode !== 'aroundtheworld' && (
        <div className="absolute inset-0 z-0">
            <GameMap
                ref={mapRef}
                points={currentGameObj?.points || []}
                routes={currentGameObj?.routes || []}
                dangerZones={currentGameObj?.dangerZones || []}
                logicLinks={logicLinks}
                measurePath={measurePath}
                mode={mode}
                mapStyle={localMapStyle || 'osm'}
                onPointClick={handlePointClick}
                onZoneClick={(z) => setActiveDangerZone(z)}
                onMapClick={handleMapClick}
                onDeletePoint={handleDeleteItem}
                onDragStart={(pointId: string) => {
                    if (!currentGameObj) return;
                    const point = currentGameObj.points.find(p => p.id === pointId);
                    if (point) setActiveTask(point);
                }}
                onPointMove={async (id, loc) => {
                    console.log('[App] onPointMove called:', { id, loc, hasCurrentGame: !!currentGameObj, mode });
                    if (!currentGameObj) {
                        console.warn('[App] onPointMove: No currentGameObj');
                        return;
                    }

                    if (mode === GameMode.SIMULATION) {
                        console.log('[App] Simulation mode - updating local state');
                        const updatedPoints = currentGameObj.points.map(p => p.id === id ? { ...p, location: loc } : p);
                        const updatedPlaygrounds = (currentGameObj.playgrounds || []).map(pg => pg.id === id ? { ...pg, location: loc } : pg);
                        const updatedZones = (currentGameObj.dangerZones || []).map(z => z.id === id ? { ...z, location: loc } : z);
                        setSimulatedGame({ ...currentGameObj, points: updatedPoints, playgrounds: updatedPlaygrounds, dangerZones: updatedZones });
                        return;
                    }

                    console.log('[App] Saving to database...');
                    const plainLoc = { lat: loc.lat, lng: loc.lng };
                    const updated = await db.updateGameItemLocation(currentGameObj.id, id, plainLoc, {
                        user: authUser?.name,
                        action: 'Moved Item'
                    });
                    console.log('[App] Database update result:', !!updated);
                    if (!updated) {
                        console.error('[App] Failed to save point location');
                        return;
                    }

                    setGames(prev => prev.map(g => g.id === updated.id ? updated : g));
                    setActiveGame(updated);
                    console.log('[App] State updated with new location');
                }}
                accuracy={gpsAccuracy}
                isRelocating={isRelocating}
                relocateScopeCenter={relocateScopeCenter}
                showScores={showScores}
                showTaskId={showTaskId}
                showTaskTitle={showTaskTitle}
                teams={mapTeams}
                showUserLocation={currentGameObj?.showPlayerLocations ?? true}
                showMapLayer={true}
                showZoneLayer={true}
                showTaskLayer={true}
                showLiveLayer={true}
            />
        </div>
        )}

        {/* MEASURE MODE BANNER */}
        {isMeasuring && (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] pointer-events-none animate-in fade-in slide-in-from-top">
                <div className="bg-orange-600 text-white px-6 py-3 rounded-full shadow-2xl border-2 border-orange-400 flex items-center gap-3">
                    <Ruler className="w-5 h-5 animate-pulse" />
                    <div className="font-black uppercase tracking-wider text-sm">
                        MEASURE MODE: Click tasks to calculate distance
                    </div>
                    <div className="bg-orange-800 px-3 py-1 rounded-full text-xs font-bold">
                        {measurePointsCount} tasks • {Math.round(measuredDistance)}m
                    </div>
                </div>
            </div>
        )}

        <GameHUD
            ref={gameHudRef}
            accuracy={gpsAccuracy}
            mode={mode}
            toggleMode={() => {}}
            onSetMode={setMode}
            onOpenGameManager={() => setShowGameChooser(true)}
            onOpenTaskMaster={() => setShowTaskMaster(true)}
            onOpenTeams={() => setShowTeamsHub(true)}
            mapStyle={localMapStyle || 'osm'}
            onSetMapStyle={(s) => setLocalMapStyle(s)}
            language={currentGameObj?.language || 'English'}
            onBackToHub={() => setShowLanding(true)}
            activeGameName={currentGameObj?.name}
            onOpenInstructorDashboard={() => setShowInstructorDashboard(true)}
            isMeasuring={isMeasuring}
            onToggleMeasure={handleToggleMeasure}
            measuredDistance={measuredDistance}
            measurePointsCount={measurePointsCount}
            playgrounds={currentGameObj?.playgrounds}
            onOpenPlayground={(id) => setViewingPlaygroundId(id)}
            onOpenTeamDashboard={() => setShowTeamDashboard(true)}
            onOpenTeamLobby={() => setShowTeamLobby(true)}
            onRelocateGame={handleRelocateGame}
            isRelocating={isRelocating}
            timerConfig={currentGameObj?.timerConfig}
            onFitBounds={(coords) => {
                try {
                    const pointsToFit = (coords && Array.isArray(coords) && coords.length > 0) ? coords : (currentGameObj?.points || []);

                    if (!pointsToFit || pointsToFit.length === 0) {
                        console.warn('[FitBounds] No points available to fit', { currentGameObj, coords });
                        return;
                    }

                    // Log detailed info about points
                    console.log('[FitBounds] Fitting bounds:', {
                        pointCount: pointsToFit.length,
                        points: pointsToFit.slice(0, 3).map((p: any) => ({
                            id: p.id,
                            location: p.location,
                            lat: p.location?.lat,
                            lng: p.location?.lng
                        }))
                    });

                    mapRef.current?.fitBounds(pointsToFit);
                } catch (error) {
                    console.error('[FitBounds] Error fitting bounds:', error);
                }
            }}
            onLocateMe={handleLocateMe}
            onSearchLocation={(c) => mapRef.current?.jumpTo(c)}
            isDrawerExpanded={isEditorExpanded}
            showScores={showScores}
            onToggleScores={() => setShowScores(!showScores)}
            showTaskId={showTaskId}
            onToggleTaskId={() => setShowTaskId(!showTaskId)}
            showTaskTitle={showTaskTitle}
            onToggleTaskTitle={() => setShowTaskTitle(!showTaskTitle)}
            showTaskActions={showTaskActions}
            onToggleTaskActions={() => setShowTaskActions(!showTaskActions)}
            hiddenPlaygroundIds={[]}
            onToggleChat={() => setShowChatDrawer(!showChatDrawer)}
            unreadMessagesCount={0}
            onAddDangerZone={handleAddDangerZone}
            activeDangerZone={activeDangerZone}
            onEditGameSettings={() => { setGameToEdit(activeGame || null); setShowGameCreator(true); }}
            onOpenGameChooser={() => setShowGameChooser(true)}
            routes={currentGameObj?.routes}
            onAddRoute={(route) => currentGameObj && updateActiveGame({ ...currentGameObj, routes: [...(currentGameObj.routes || []), route] }, "Added Route")}
            onToggleRoute={(id) => {
                if (!currentGameObj) return;
                const updated = (currentGameObj.routes || []).map(r => r.id === id ? { ...r, isVisible: !r.isVisible } : r);
                updateActiveGame({ ...currentGameObj, routes: updated }, "Toggled Route");
            }}
            allowChatting={currentGameObj?.allowChatting ?? true}
            authUser={authUser}
            activeGame={activeGame}
            onUpdateGame={(game) => updateActiveGame(game, "Updated Toolbar Positions")}
            onToggleSnapToRoad={() => { /* TODO: Wire to snap to road handler */ }}
            snapToRoadMode={false}
            onStartSimulation={() => activeGame && handleStartSimulation(activeGame)}
        />

        {(mode === GameMode.EDIT || playgroundTemplateToEdit) && (
            <EditorDrawer 
                onClose={() => setMode(GameMode.PLAY)}
                activeGame={activeGame}
                activeGameName={activeGame?.name || "No Game"}
                points={activeGame?.points || []}
                allPoints={activeGame?.points || []}
                games={games}
                onSelectGame={setActiveGameId}
                onOpenGameChooser={() => setShowGameChooser(true)}
                taskLists={taskLists}
                sourceListId=""
                onSetSourceListId={() => {}}
                onEditPoint={(p) => setActiveTask(p)}
                onSelectPoint={(p) => { setActiveTask(p); mapRef.current?.jumpTo(p.location); }}
                onDeletePoint={handleDeleteItem}
                onReorderPoints={async (pts) => { if (activeGame) await updateActiveGame({ ...activeGame, points: pts }, "Reordered Points"); }}
                onClearMap={() => { if (activeGame && confirm("Clear all points?")) updateActiveGame({ ...activeGame, points: [] }, "Cleared Map"); }}
                onSaveGame={() => {
                    if (!activeGame) return;
                    // Get current toolbar positions from GameHUD
                    const toolbarPositions = gameHudRef.current?.getToolbarPositions();
                    const gameToSave = toolbarPositions
                        ? { ...activeGame, toolbarPositions }
                        : activeGame;
                    updateActiveGame(gameToSave, "Saved via Editor");
                }}
                onOpenTaskMaster={() => setShowTaskMaster(true)}
                onFitBounds={(coords) => {
                    try {
                        const pointsToFit = (coords && Array.isArray(coords) && coords.length > 0) ? coords : (activeGame?.points || []);

                        if (!pointsToFit || pointsToFit.length === 0) {
                            console.warn('[FitBounds] No points available to fit', { activeGame, coords });
                            return;
                        }

                        console.log('[FitBounds] Fitting bounds:', {
                            pointCount: pointsToFit.length,
                            points: pointsToFit.slice(0, 3).map((p: any) => ({
                                id: p.id,
                                location: p.location,
                                lat: p.location?.lat,
                                lng: p.location?.lng
                            }))
                        });

                        mapRef.current?.fitBounds(pointsToFit);
                    } catch (error) {
                        console.error('[FitBounds] Error fitting bounds:', error);
                    }
                }}
                onOpenPlaygroundEditor={() => setViewingPlaygroundId(activeGame?.playgrounds?.[0]?.id || null)}
                initialExpanded={true}
                onExpandChange={setIsEditorExpanded}
                routes={activeGame?.routes}
                onAddRoute={(route) => activeGame && updateActiveGame({ ...activeGame, routes: [...(activeGame.routes || []), route] }, "Added Route")}
                onDeleteRoute={(id) => activeGame && updateActiveGame({ ...activeGame, routes: (activeGame.routes || []).filter(r => r.id !== id) }, "Deleted Route")}
                onUpdateRoute={handleUpdateRoute}
                onToggleRoute={(id) => { if (activeGame) { const updated = (activeGame.routes || []).map(r => r.id === id ? { ...r, isVisible: !r.isVisible } : r); updateActiveGame({ ...activeGame, routes: updated }, "Toggled Route"); }}}
                showScores={showScores}
                onToggleScores={() => setShowScores(!showScores)}
                isGameTemplateMode={false}
                onAddTask={async (type, playgroundId) => {
                    if (!activeGame) return;
                    const center = mapRef.current?.getCenter() || { lat: 0, lng: 0 };
                    if (type === 'MANUAL') {
                        const newPoint: GamePoint = {
                            id: `p-${Date.now()}`,
                            title: 'New Task',
                            location: playgroundId ? { lat: 0, lng: 0 } : center,
                            playgroundId: playgroundId,
                            iconId: 'default',
                            points: 100,
                            radiusMeters: 30,
                            activationTypes: ['radius'],
                            isUnlocked: true,
                            isCompleted: false,
                            order: activeGame.points.length,
                            task: { type: 'text', question: 'New Task Question' }
                        };
                        await updateActiveGame({ ...activeGame, points: [...activeGame.points, newPoint] }, "Added Manual Task");
                        setActiveTask(newPoint);
                    } else if (type === 'LIBRARY') {
                        setTaskMasterInitialTab('LISTS');
                        setShowTaskMaster(true);
                    } else if (type === 'AI') {
                        setTaskMasterInitialTab('LIBRARY');
                        setShowTaskMaster(true);
                    }
                }}
                onStartSimulation={() => activeGame && handleStartSimulation(activeGame)} // Added simulation trigger
            />
        )}

        {!activeGameId && mode === GameMode.PLAY && !showLanding && !playgroundTemplateToEdit && (
            <WelcomeScreen 
                games={games}
                userLocation={userLocation}
                onStartGame={handleStartGame}
                onSetMapStyle={(s) => setLocalMapStyle(s)}
                language="English"
                onSetLanguage={() => {}}
                onBack={() => setShowLanding(true)}
            />
        )}

        {renderModals()}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary componentName="TeamAction App">
      <OfflineIndicator />
      <LocationProvider>
        <GameApp />
      </LocationProvider>
    </ErrorBoundary>
  );
};

export default App;
