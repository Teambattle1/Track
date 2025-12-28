import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game, GamePoint, TaskList, TaskTemplate, AuthUser, GameMode, Coordinate, MapStyleId, DangerZone, GameRoute, Team, ChatMessage, GameChangeLogEntry, TeamMember, PlaygroundTemplate, ActionType } from '../types';
import * as db from '../services/db';
import { supabase } from '../lib/supabase';
import { authService } from '../services/auth';
import { teamSync } from '../services/teamSync';
import { LocationProvider, useLocation } from '../contexts/LocationContext';
import { haversineMeters, isWithinRadius } from '../utils/geo';
import GameMap, { GameMapHandle } from './GameMap';
import GameHUD from './components/GameHUD';
import GameManager from './components/GameManager';
import TaskMaster from './components/TaskMaster';
import TeamsModal from './components/TeamsModal';
import InstructorDashboard from './components/InstructorDashboard';
import TeamDashboard from './components/TeamDashboard';
import WelcomeScreen from './components/WelcomeScreen';
import InitialLanding from './components/InitialLanding';
import LoginPage from './components/LoginPage';
import EditorDrawer from './components/EditorDrawer';
import TaskModal from './components/TaskModal';
import DeleteGamesModal from './components/DeleteGamesModal';
import PlaygroundManager from './components/PlaygroundManager';
import AdminModal from './components/AdminModal';
import ChatDrawer from './components/ChatDrawer';
import TeamsHubModal from './components/TeamsHubModal';
import ClientSubmissionView from './components/ClientSubmissionView';
import GameCreator from './components/GameCreator';
import TaskActionModal from './components/TaskActionModal';
import PlaygroundEditor from './components/PlaygroundEditor';
import MessagePopup from './components/MessagePopup';
import Dashboard from './components/Dashboard';
import { PlayCircle } from 'lucide-react';

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
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showInstructorDashboard, setShowInstructorDashboard] = useState(false);
  const [showTeamDashboard, setShowTeamDashboard] = useState(false);
  const [showDeleteGames, setShowDeleteGames] = useState(false);
  const [showPlaygroundManager, setShowPlaygroundManager] = useState(false);
  const [showDatabaseTools, setShowDatabaseTools] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showTeamsHub, setShowTeamsHub] = useState(false);
  const [showGameCreator, setShowGameCreator] = useState(false);
  const [gameToEdit, setGameToEdit] = useState<Game | null>(null);
  
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
  const [showScores, setShowScores] = useState(false);
  const [currentDangerZone, setCurrentDangerZone] = useState<DangerZone | null>(null);
  const [activeDangerZone, setActiveDangerZone] = useState<DangerZone | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [latestMessage, setLatestMessage] = useState<ChatMessage | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<TeamMember[]>([]);
  const [otherTeamsLocations, setOtherTeamsLocations] = useState<any[]>([]);
  
  // --- MAP STATE ---
  const [localMapStyle, setLocalMapStyle] = useState<MapStyleId>('osm');
  const mapRef = useRef<GameMapHandle>(null);
  const geofenceCheckRunningRef = useRef(false);
  const [isRelocating, setIsRelocating] = useState(false);
  
  // --- MEASUREMENT ---
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePath, setMeasurePath] = useState<Coordinate[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState(0);
  const [measurePointsCount, setMeasurePointsCount] = useState(0);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      setShowLogin(false);
      const user = authService.getCurrentUser();
      if (user) {
        setAuthUser(user);
      }
      const loadedGames = await db.fetchGames();
      setGames(loadedGames);
      const loadedLists = await db.fetchTaskLists();
      setTaskLists(loadedLists);
      const loadedLib = await db.fetchLibrary();
      setTaskLibrary(loadedLib);
    };
    init();
  }, []);

  // Measurement logic updates
  useEffect(() => {
      if (isMeasuring && userLocation) {
          setMeasurePath(prev => {
              if (prev.length === 0) return [userLocation];
              return [...prev.slice(0, prev.length - 1), userLocation];
          });
      }
  }, [userLocation, isMeasuring]);

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
          if (geofenceCheckRunningRef.current) return;
          geofenceCheckRunningRef.current = true;

          const patches: { pointId: string; patch: any }[] = [];

          activeGame.points.forEach(p => {
              if (p.isUnlocked || p.isCompleted || p.isSectionHeader || p.playgroundId) return;
              if (p.activationTypes.includes('radius') && isWithinRadius(userLocation, p.location, p.radiusMeters)) {
                  patches.push({ pointId: p.id, patch: { isUnlocked: true } });
              }
          });

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

      const interval = setInterval(checkGeofences, 2000);
      return () => clearInterval(interval);
  }, [userLocation, activeGame, mode]);

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
      if (!currentGameObj) return;
      const updatedPoints = currentGameObj.points.filter(p => p.id !== pointId);
      const updatedZones = (currentGameObj.dangerZones || []).filter(z => z.id !== pointId);
      await updateActiveGame({ ...currentGameObj, points: updatedPoints, dangerZones: updatedZones }, "Deleted Task/Zone");
      if (activeTask?.id === pointId) setActiveTask(null);
  };

  const handlePointClick = (point: GamePoint) => {
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
      if (mode === GameMode.EDIT && isMeasuring) {
          setMeasurePath(prev => [...prev, coord]);
      }
  };

  const handleStartGame = async (gameId: string, teamName: string, userName: string, teamPhoto: string | null, style: MapStyleId) => {
      setActiveGameId(gameId);
      setLocalMapStyle(style);
      teamSync.connect(gameId, teamName, userName);
      setMode(GameMode.PLAY);
      setShowLanding(false);

      const teams = await db.fetchTeams(gameId);
      const myTeam = teams.find(t => t.name === teamName); 
      if (myTeam) {
          setCurrentTeam(myTeam);
      }
  };

  const handleRelocateGame = () => {
      setIsRelocating(!isRelocating);
  };

  const handleToggleMeasure = () => {
      setIsMeasuring(!isMeasuring);
      if (!isMeasuring) setMeasurePath(userLocation ? [userLocation] : []);
      else setMeasurePath([]);
  };

  const handleLocateMe = () => {
      if (userLocation && mapRef.current) {
          mapRef.current.jumpTo(userLocation);
      }
  };

  const handleAddDangerZone = () => {
      if (!currentGameObj || !mapRef.current) return;
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

  // ... (Tag handlers remain same) ...
  const handleRenameTagGlobally = async (oldTag: string, newTag: string) => {
      const renameInTasks = (tasks: TaskTemplate[]) => {
          return tasks.map(t => ({
              ...t,
              tags: t.tags?.map(tag => tag === oldTag ? newTag : tag) || []
          }));
      };

      const updatedLib = renameInTasks(taskLibrary);
      for (const t of updatedLib) {
          if (t.tags?.includes(newTag)) await db.saveTemplate(t);
      }
      setTaskLibrary(updatedLib);

      const updatedLists = taskLists.map(list => ({
          ...list,
          tasks: renameInTasks(list.tasks)
      }));
      for (const list of updatedLists) await db.saveTaskList(list);
      setTaskLists(updatedLists);

      const updatedGames = games.map(g => ({
          ...g,
          points: g.points.map(p => ({
              ...p,
              tags: p.tags?.map(tag => tag === oldTag ? newTag : tag) || []
          }))
      }));
      for (const g of updatedGames) await db.saveGame(g);
      setGames(updatedGames);
  };

  const handleDeleteTagGlobally = async (tagToDelete: string) => {
      const removeInTasks = (tasks: TaskTemplate[]) => {
          return tasks.map(t => ({
              ...t,
              tags: t.tags?.filter(tag => tag !== tagToDelete) || []
          }));
      };

      const updatedLib = removeInTasks(taskLibrary);
      for (const t of updatedLib) await db.saveTemplate(t);
      setTaskLibrary(updatedLib);

      const updatedLists = taskLists.map(list => ({
          ...list,
          tasks: removeInTasks(list.tasks)
      }));
      for (const list of updatedLists) await db.saveTaskList(list);
      setTaskLists(updatedLists);

      const updatedGames = games.map(g => ({
          ...g,
          points: g.points.map(p => ({
              ...p,
              tags: p.tags?.filter(tag => tag !== tagToDelete) || []
          }))
      }));
      for (const g of updatedGames) await db.saveGame(g);
      setGames(updatedGames);
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
                  onSelectGame={(id) => { setActiveGameId(id); setShowGameChooser(false); }}
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
                              id: `p-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                              location: mapRef.current?.getCenter() || { lat: 0, lng: 0 },
                              radiusMeters: 30,
                              activationTypes: ['radius'],
                              isUnlocked: true,
                              isCompleted: false,
                              order: currentGameObj.points.length
                          } as GamePoint));
                          await updateActiveGame({ ...currentGameObj, points: [...currentGameObj.points, ...newPoints] }, `Imported ${tasks.length} Tasks`);
                          setShowTaskMaster(false);
                      }
                  }}
                  taskLists={taskLists}
                  onUpdateTaskLists={setTaskLists}
                  games={games}
                  onDeleteTagGlobally={handleDeleteTagGlobally}
                  onRenameTagGlobally={handleRenameTagGlobally}
              />
          )}
          {/* ... Rest of modals ... */}
          {showGameCreator && (
              <GameCreator 
                  onClose={() => setShowGameCreator(false)}
                  onCreate={async (gameData) => {
                      if (gameToEdit && gameToEdit.id === gameData.id) {
                          await updateActiveGame({ ...gameToEdit, ...gameData }, "Updated Game Settings");
                      } else {
                          const newGame = { 
                              ...gameData, 
                              id: `game-${Date.now()}`, 
                              points: [], 
                              createdAt: Date.now(),
                              createdBy: authUser?.name,
                              changeLog: [{ timestamp: Date.now(), user: authUser?.name || 'Unknown', action: 'Created Game' }]
                          } as Game;
                          await db.saveGame(newGame);
                          setGames([...games, newGame]);
                          setActiveGameId(newGame.id);
                          setShowGameChooser(true); // Return to chooser after create
                      }
                      setShowGameCreator(false);
                      setGameToEdit(null);
                  }}
                  baseGame={gameToEdit || undefined}
                  onDelete={handleDeleteGame}
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
                          title: 'New Playground Template',
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
                  
                  onUpdateGame={(updatedGame) => {
                      if (playgroundTemplateToEdit) {
                          setPlaygroundTemplateToEdit({
                              ...playgroundTemplateToEdit,
                              title: updatedGame.name,
                              playgroundData: updatedGame.playgrounds?.[0]!,
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
      </>
  );

  if (showLanding) {
      return (
          <>
            <InitialLanding 
                version="3.1.0"
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
                    ensureSession(() => {
                        switch (action) {
                            case 'GAMES': setShowGameChooser(true); break;
                            case 'CREATE_GAME': setGameToEdit(null); setShowGameCreator(true); break;
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
          </>
      );
  }

  // Active Game View
  return (
    <div className={`fixed inset-0 w-full h-full overflow-hidden bg-slate-900 text-white ${mode === GameMode.SIMULATION ? 'border-4 border-orange-500 shadow-[inset_0_0_50px_rgba(249,115,22,0.5)]' : ''}`}>
        
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
                onPointMove={async (id, loc) => {
                    if (!currentGameObj) return;

                    if (mode === GameMode.SIMULATION) {
                        const updatedPoints = currentGameObj.points.map(p => p.id === id ? { ...p, location: loc } : p);
                        const updatedPlaygrounds = (currentGameObj.playgrounds || []).map(pg => pg.id === id ? { ...pg, location: loc } : pg);
                        const updatedZones = (currentGameObj.dangerZones || []).map(z => z.id === id ? { ...z, location: loc } : z);
                        setSimulatedGame({ ...currentGameObj, points: updatedPoints, playgrounds: updatedPlaygrounds, dangerZones: updatedZones });
                        return;
                    }

                    const plainLoc = { lat: loc.lat, lng: loc.lng };
                    const updated = await db.updateGameItemLocation(currentGameObj.id, id, plainLoc, {
                        user: authUser?.name,
                        action: 'Moved Item'
                    });
                    if (!updated) return;

                    setGames(prev => prev.map(g => g.id === updated.id ? updated : g));
                    setActiveGame(updated);
                }}
                accuracy={gpsAccuracy}
                isRelocating={isRelocating}
                showScores={showScores}
                teams={mapTeams}
                showUserLocation={currentGameObj?.showPlayerLocations ?? true}
            />
        </div>

        <GameHUD 
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
            onRelocateGame={handleRelocateGame}
            isRelocating={isRelocating}
            timerConfig={currentGameObj?.timerConfig}
            onFitBounds={(coords) => {
                if (coords && coords.length > 0) mapRef.current?.fitBounds(coords);
                else mapRef.current?.fitBounds(currentGameObj?.points || []);
            }}
            onLocateMe={handleLocateMe}
            onSearchLocation={(c) => mapRef.current?.jumpTo(c)}
            isDrawerExpanded={isEditorExpanded}
            showScores={showScores}
            onToggleScores={() => setShowScores(!showScores)}
            hiddenPlaygroundIds={[]}
            onToggleChat={() => setShowChatDrawer(!showChatDrawer)}
            unreadMessagesCount={0}
            onAddDangerZone={handleAddDangerZone}
            activeDangerZone={mode === GameMode.PLAY ? currentDangerZone : null}
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
                onSaveGame={() => updateActiveGame(activeGame!, "Saved via Editor")}
                onOpenTaskMaster={() => setShowTaskMaster(true)}
                onFitBounds={(coords) => {
                    if (coords && coords.length > 0) mapRef.current?.fitBounds(coords);
                    else mapRef.current?.fitBounds(activeGame?.points || []);
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
                    } else if (type === 'LIBRARY' || type === 'AI') {
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
    <LocationProvider>
      <GameApp />
    </LocationProvider>
  );
};

export default App;
