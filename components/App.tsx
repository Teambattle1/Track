
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game, GamePoint, TaskList, TaskTemplate, AuthUser, GameMode, Coordinate, MapStyleId, DangerZone, GameRoute, Team, ChatMessage, GameChangeLogEntry, TeamMember } from './types';
import * as db from './services/db';
import { authService } from './services/auth';
import { teamSync } from './services/teamSync';
import { LocationProvider, useLocation } from './contexts/LocationContext';
import { haversineMeters, isWithinRadius } from './utils/geo';
import GameMap, { GameMapHandle } from './components/GameMap';
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
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null); // New state to track current team

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
  const [playgroundTemplateToEdit, setPlaygroundTemplateToEdit] = useState<any>(null);
  const [activeTaskActionPoint, setActiveTaskActionPoint] = useState<GamePoint | null>(null);
  
  // --- PLAY STATE (Location from Context) ---
  const { userLocation, gpsAccuracy } = useLocation();
  const [activeTaskModalId, setActiveTaskModalId] = useState<string | null>(null); // Storing ID instead of Object to prevent stale state
  const [score, setScore] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [currentDangerZone, setCurrentDangerZone] = useState<DangerZone | null>(null);
  const [activeDangerZone, setActiveDangerZone] = useState<DangerZone | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [latestMessage, setLatestMessage] = useState<ChatMessage | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<TeamMember[]>([]);
  const [otherTeamsLocations, setOtherTeamsLocations] = useState<any[]>([]); // For "Show Other Teams"
  
  // --- MAP STATE ---
  const [localMapStyle, setLocalMapStyle] = useState<MapStyleId>('osm');
  const mapRef = useRef<GameMapHandle>(null);
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

  // Subscribe to Team Members if Playing
  useEffect(() => {
      if (mode === GameMode.PLAY && currentTeam) {
          const unsubscribeMembers = teamSync.subscribeToMembers((members) => {
              // Filter out self so we don't duplicate markers
              const myDeviceId = teamSync.getDeviceId();
              const teammates = members.filter(m => m.deviceId !== myDeviceId);
              setOnlineMembers(teammates);
          });

          // Global Teams Subscription (if enabled)
          let unsubscribeGlobal: (() => void) | undefined;
          if (activeGame?.showOtherTeams) {
              unsubscribeGlobal = teamSync.subscribeToGlobalLocations((locations) => {
                  // Filter out my own team
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
          // Check if I am captain
          if (currentTeam.captainDeviceId === myDeviceId) {
              const interval = setInterval(() => {
                  teamSync.broadcastGlobalLocation(
                      activeGame.id, 
                      currentTeam.id, 
                      currentTeam.name, 
                      userLocation, 
                      currentTeam.photoUrl
                  );
              }, 10000); // Broadcast every 10s to reduce traffic
              return () => clearInterval(interval);
          }
      }
  }, [mode, currentTeam, activeGame?.showOtherTeams, userLocation]);

  // --- GEOFENCING ENGINE ---
  useEffect(() => {
      if (!activeGame || mode !== GameMode.PLAY || !userLocation) return;

      const checkGeofences = async () => {
          let hasUpdates = false;
          const updatedPoints = activeGame.points.map(p => {
              // Skip if already unlocked or completed, or if it's a zone/header
              if (p.isUnlocked || p.isCompleted || p.isSectionHeader || p.playgroundId) return p;

              // Check Radius
              if (p.activationTypes.includes('radius') && isWithinRadius(userLocation, p.location, p.radiusMeters)) {
                  hasUpdates = true;
                  // Optional: Trigger sound or vibration here
                  if (navigator.vibrate) navigator.vibrate(200);
                  return { ...p, isUnlocked: true };
              }
              return p;
          });

          if (hasUpdates) {
              const updatedGame = { ...activeGame, points: updatedPoints };
              await db.saveGame(updatedGame); // Persist unlock state
              setActiveGame(updatedGame);
              setGames(prev => prev.map(g => g.id === updatedGame.id ? updatedGame : g));
          }
      };

      const interval = setInterval(checkGeofences, 2000); // Check every 2 seconds
      return () => clearInterval(interval);
  }, [userLocation, activeGame, mode]);

  // --- MEMOIZED DATA ---
  
  // Calculate Logic Links for Map Visualization (Edit/Instructor Mode)
  const logicLinks = useMemo(() => {
      if (!activeGame || mode === GameMode.PLAY) return [];
      const links: any[] = [];
      activeGame.points.forEach(p => {
          if (!p.location) return;
          const addLinks = (trigger: 'onOpen' | 'onCorrect' | 'onIncorrect', color: string) => {
              const actions = p.logic?.[trigger];
              actions?.forEach(action => {
                  if ((action.type === 'unlock' || action.type === 'reveal') && action.targetId) {
                      const target = activeGame.points.find(tp => tp.id === action.targetId);
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
  }, [activeGame, mode]);

  // Derived Active Modal Point (Live Data)
  const liveTaskModalPoint = useMemo(() => {
      if (!activeTaskModalId || !activeGame) return null;
      return activeGame.points.find(p => p.id === activeTaskModalId) || null;
  }, [activeTaskModalId, activeGame]);


  const ensureSession = (callback: () => void) => {
      if (!authUser) {
          setShowLogin(true);
      } else {
          callback();
      }
  };

  const updateActiveGame = async (updatedGame: Game, changeDescription: string = "Modified Game") => {
      // Add Audit Info
      const changeEntry: GameChangeLogEntry = {
          timestamp: Date.now(),
          user: authUser?.name || 'Unknown',
          action: changeDescription
      };
      
      const gameToSave = {
          ...updatedGame,
          lastModifiedBy: authUser?.name || 'Unknown',
          changeLog: [...(updatedGame.changeLog || []), changeEntry]
      };

      await db.saveGame(gameToSave);
      setGames(prev => prev.map(g => g.id === gameToSave.id ? gameToSave : g));
      if (activeGameId === gameToSave.id) {
          setActiveGame(gameToSave);
      }
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
      if (!activeGame) return;
      const updatedPoints = activeGame.points.filter(p => p.id !== pointId);
      const updatedZones = (activeGame.dangerZones || []).filter(z => z.id !== pointId);
      await updateActiveGame({ ...activeGame, points: updatedPoints, dangerZones: updatedZones }, "Deleted Task/Zone");
      if (activeTask?.id === pointId) setActiveTask(null);
  };

  const handlePointClick = (point: GamePoint) => {
      if (mode === GameMode.EDIT) {
          setActiveTask(point);
      } else if (mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR) {
          setActiveTaskModalId(point.id);
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

      // Fetch team to determine captaincy
      const teams = await db.fetchTeams(gameId);
      const myTeam = teams.find(t => t.name === teamName); // Or by ID if available from context
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
      if (!activeGame || !mapRef.current) return;
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
      updateActiveGame({ ...activeGame, dangerZones: [...(activeGame.dangerZones || []), newZone] }, "Added Danger Zone");
  };

  const handleUpdateRoute = (id: string, updates: Partial<GameRoute>) => {
      if (!activeGame) return;
      const updatedRoutes = (activeGame.routes || []).map(r => r.id === id ? { ...r, ...updates } : r);
      updateActiveGame({ ...activeGame, routes: updatedRoutes }, "Updated Route");
  };

  const handleManualUnlock = async (pointId: string) => {
      if (!activeGame) return;
      const updatedPoints = activeGame.points.map(p => p.id === pointId ? { ...p, isUnlocked: true } : p);
      await updateActiveGame({ ...activeGame, points: updatedPoints }, "Manual Unlock");
  };

  // --- TAG MANAGEMENT ---
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

  // Determine if current user is captain
  const isCaptain = currentTeam?.captainDeviceId === teamSync.getDeviceId();

  // Prepare combined teams list for Map (Teammates + Global Captains)
  const mapTeams = useMemo(() => {
      const list = [];
      
      // 1. My Teammates
      if (isCaptain) {
          list.push(...onlineMembers.map(m => ({
              team: { 
                  id: 'teammates', 
                  gameId: activeGameId || '', 
                  name: m.userName, 
                  score: 0, 
                  members: [], 
                  updatedAt: '', 
                  isStarted: true 
              }, 
              location: m.location!, 
              status: m.isSolving ? 'solving' as const : 'moving' as const
          })));
      }

      // 2. Other Team Captains (if enabled)
      if (activeGame?.showOtherTeams) {
          list.push(...otherTeamsLocations.map(l => ({
              team: {
                  id: l.teamId,
                  gameId: activeGameId || '',
                  name: l.name,
                  photoUrl: l.photoUrl,
                  score: 0,
                  members: [],
                  updatedAt: '',
                  isStarted: true
              },
              location: l.location,
              status: 'moving' as const
          })));
      }

      return list;
  }, [isCaptain, onlineMembers, otherTeamsLocations, activeGame?.showOtherTeams, activeGameId]);

  // Check for Client Submission URL
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
                          // Reuse EDIT_GAME logic for dashboard actions
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
                          // When selecting a game in dashboard, we want to EDIT SETTINGS (per user request)
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
                  onSelectGame={(id) => { 
                      setActiveGameId(id); 
                      // Selecting a game in the list just activates it.
                      // If user wants to edit settings, they click the gear icon.
                      // If they want to play/map edit, they might need to use other buttons or just close chooser.
                      setShowGameChooser(false); 
                  }}
                  onDeleteGame={handleDeleteGame}
                  onClose={() => setShowGameChooser(false)}
                  onEditGame={(id) => { 
                      // UPDATED: Open GameCreator (Settings) instead of Map Editor
                      const game = games.find(g => g.id === id);
                      if (game) {
                          setGameToEdit(game);
                          setActiveGameId(id); // Set as active too
                          setShowGameCreator(true);
                          setShowGameChooser(false);
                      }
                  }}
                  onEditPoint={setActiveTask}
                  onReorderPoints={() => {}}
                  onCreateTestGame={() => {}}
                  onOpenTaskMaster={() => setShowTaskMaster(true)}
                  onClearMap={() => updateActiveGame({ ...activeGame!, points: [] }, "Cleared Map")}
                  mode={mode}
                  onSetMode={setMode}
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
                  point={liveTaskModalPoint} // Pass Live Point here!
                  distance={liveTaskModalPoint.playgroundId ? 0 : haversineMeters(userLocation, liveTaskModalPoint.location)}
                  onClose={() => setActiveTaskModalId(null)}
                  onComplete={(id, pts) => { 
                      setScore(s => s + (pts || 0)); 
                      const updatedPoints = activeGame?.points.map(p => p.id === id ? { ...p, isCompleted: true } : p) || [];
                      if (activeGame) updateActiveGame({ ...activeGame, points: updatedPoints }, "Task Completed (Live)");
                      setActiveTaskModalId(null); 
                  }}
                  onUnlock={handleManualUnlock} // Pass the unlock handler!
                  mode={mode}
                  isInstructorMode={mode === GameMode.INSTRUCTOR}
              />
          )}
          {showTaskMaster && (
              <TaskMaster 
                  initialTab={taskMasterInitialTab}
                  onClose={() => setShowTaskMaster(false)}
                  onImportTasks={async (tasks) => {
                      if (activeGame) {
                          const newPoints = tasks.map(t => ({
                              ...t,
                              id: `p-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                              location: mapRef.current?.getCenter() || { lat: 0, lng: 0 },
                              radiusMeters: 30,
                              activationTypes: ['radius'],
                              isUnlocked: true,
                              isCompleted: false,
                              order: activeGame.points.length
                          } as GamePoint));
                          await updateActiveGame({ ...activeGame, points: [...activeGame.points, ...newPoints] }, `Imported ${tasks.length} Tasks`);
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
                          // UPDATE Existing Game
                          await updateActiveGame({ ...gameToEdit, ...gameData }, "Updated Game Settings");
                      } else {
                          // CREATE New Game
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
                          setShowGameChooser(true);
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
                  totalMapPoints={activeGame?.points.length || 0}
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
                      // Logic to create new template
                  }}
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
          {activeTaskActionPoint && activeGame && (
              <TaskActionModal 
                  point={activeTaskActionPoint}
                  allPoints={activeGame.points}
                  playgrounds={activeGame.playgrounds}
                  onClose={() => setActiveTaskActionPoint(null)}
                  onSave={(updatedPoint) => {
                      if (activeGame) {
                          const updatedPoints = activeGame.points.map(p => p.id === updatedPoint.id ? updatedPoint : p);
                          updateActiveGame({ ...activeGame, points: updatedPoints }, "Updated Task Logic");
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
                                // UPDATED: Open GameCreator (Settings) if game active, else show chooser
                                if (activeGameId && activeGame) {
                                    setGameToEdit(activeGame);
                                    setShowGameCreator(true);
                                } else {
                                    setShowGameChooser(true);
                                }
                                break;
                            case 'USERS': 
                                setDashboardTab('users'); 
                                setShowDashboard(true); 
                                break;
                            case 'TASKS': setTaskMasterInitialTab('LIBRARY'); setShowTaskMaster(true); break;
                            case 'TASKLIST': setTaskMasterInitialTab('LISTS'); setShowTaskMaster(true); break;
                            case 'TEAM_LOBBY': setShowTeamsHub(true); break;
                            case 'MANAGE_TEAMS': setShowTeamsModal(true); break;
                            case 'DELETE_GAMES': setShowDeleteGames(true); break;
                            case 'PLAYGROUNDS': setShowPlaygroundManager(true); break;
                            case 'DATABASE': setShowDatabaseTools(true); break;
                            case 'CLIENT_PORTAL':
                                setDashboardTab('client');
                                setShowDashboard(true);
                                break;
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

  // Active Game View (Map & HUD)
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 z-0">
            <GameMap 
                ref={mapRef}
                points={activeGame?.points || []}
                routes={activeGame?.routes || []}
                dangerZones={activeGame?.dangerZones || []}
                logicLinks={logicLinks} // Pass Logic Links!
                measurePath={measurePath}
                mode={mode}
                mapStyle={localMapStyle || 'osm'} 
                onPointClick={handlePointClick}
                onZoneClick={(z) => setActiveDangerZone(z)}
                onMapClick={handleMapClick}
                onDeletePoint={handleDeleteItem}
                onPointMove={async (id, loc) => {
                    if (!activeGame) return;
                    const updatedPoints = activeGame.points.map(p => p.id === id ? { ...p, location: loc } : p);
                    const updatedPlaygrounds = (activeGame.playgrounds || []).map(pg => pg.id === id ? { ...pg, location: loc } : pg);
                    const updatedZones = (activeGame.dangerZones || []).map(z => z.id === id ? { ...z, location: loc } : z);
                    await updateActiveGame({ ...activeGame, points: updatedPoints, playgrounds: updatedPlaygrounds, dangerZones: updatedZones }, "Moved Item");
                }}
                accuracy={gpsAccuracy}
                isRelocating={isRelocating}
                showScores={showScores}
                // Combined Teams (Teammates + Other Captains)
                teams={mapTeams}
                showUserLocation={activeGame?.showPlayerLocations ?? true} // Controlled by game settings
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
            language={activeGame?.language || 'English'}
            onBackToHub={() => setShowLanding(true)}
            activeGameName={activeGame?.name}
            onOpenInstructorDashboard={() => setShowInstructorDashboard(true)}
            isMeasuring={isMeasuring}
            onToggleMeasure={handleToggleMeasure}
            measuredDistance={measuredDistance}
            measurePointsCount={measurePointsCount}
            playgrounds={activeGame?.playgrounds}
            onOpenPlayground={(id) => setViewingPlaygroundId(id)}
            onOpenTeamDashboard={() => setShowTeamDashboard(true)}
            onRelocateGame={handleRelocateGame}
            isRelocating={isRelocating}
            timerConfig={activeGame?.timerConfig}
            onFitBounds={(coords) => {
                if (coords && coords.length > 0) {
                    mapRef.current?.fitBounds(coords);
                } else {
                    mapRef.current?.fitBounds(activeGame?.points || []);
                }
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
            routes={activeGame?.routes}
            onAddRoute={(route) => activeGame && updateActiveGame({ ...activeGame, routes: [...(activeGame.routes || []), route] }, "Added Route")}
            onToggleRoute={(id) => {
                if (!activeGame) return;
                const updated = (activeGame.routes || []).map(r => r.id === id ? { ...r, isVisible: !r.isVisible } : r);
                updateActiveGame({ ...activeGame, routes: updated }, "Toggled Route Visibility");
            }}
            allowChatting={activeGame?.allowChatting ?? true} // Controlled by game settings
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
                onClearMap={() => { if (activeGame && confirm("Clear all points?")) updateActiveGame({ ...activeGame, points: [] }, "Cleared Map Points"); }}
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
