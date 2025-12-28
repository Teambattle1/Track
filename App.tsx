import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game, GamePoint, TaskList, TaskTemplate, AuthUser, GameMode, Coordinate, MapStyleId, DangerZone, GameRoute, Team, ChatMessage } from './types';
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

  const playableGames = useMemo(() => games.filter(g => !g.isGameTemplate), [games]);
  const gameTemplates = useMemo(() => games.filter(g => g.isGameTemplate), [games]);
  
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

  // --- MULTI-USER EDIT SYNC (lightweight polling) ---
  useEffect(() => {
      if (!activeGameId) return;
      if (mode !== GameMode.EDIT && mode !== GameMode.INSTRUCTOR) return;
      // Avoid overwriting local, unsaved edits while a point is open in the editor.
      if (activeTask) return;

      const interval = window.setInterval(async () => {
          const remote = await db.fetchGame(activeGameId);
          if (!remote) return;

          if (remote.dbUpdatedAt && remote.dbUpdatedAt === activeGame?.dbUpdatedAt) return;

          setGames(prev => prev.map(g => g.id === remote.id ? remote : g));
          setActiveGame(remote);
      }, 5000);

      return () => window.clearInterval(interval);
  }, [activeGameId, mode, activeTask, activeGame?.dbUpdatedAt]);

  // --- GEOFENCING ENGINE ---
  useEffect(() => {
      if (!activeGame || mode !== GameMode.PLAY || !userLocation) return;

      const checkGeofences = async () => {
          if (geofenceCheckRunningRef.current) return;
          geofenceCheckRunningRef.current = true;

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

          try {
              if (hasUpdates) {
                  const updatedGame = { ...activeGame, points: updatedPoints };
                  await db.saveGame(updatedGame); // Persist unlock state
                  setActiveGame(updatedGame);
                  setGames(prev => prev.map(g => g.id === updatedGame.id ? updatedGame : g));
              }
          } finally {
              geofenceCheckRunningRef.current = false;
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

  const updateActiveGame = async (updatedGame: Game) => {
      const updatedAt = new Date().toISOString();
      const gameToSave = { ...updatedGame, dbUpdatedAt: updatedAt };

      await db.saveGame(gameToSave);
      setGames(prev => prev.map(g => g.id === gameToSave.id ? gameToSave : g));
      if (activeGameId === gameToSave.id) {
          setActiveGame(gameToSave);
      }
  };

  const handleSaveGameTemplate = async () => {
      if (!activeGame) return;

      // If we're currently editing a template, "save" means update the template.
      if (activeGame.isGameTemplate) {
          await updateActiveGame(activeGame);
          return;
      }

      const templateName = window.prompt('Template name', `${activeGame.name} TEMPLATE`);
      if (!templateName) return;

      const now = Date.now();
      const templateId = `tmpl-${now}`;

      const templateGame: Game = {
          ...activeGame,
          id: templateId,
          name: templateName,
          createdAt: now,
          isGameTemplate: true,
          state: undefined,
          endingAt: undefined,
          dbUpdatedAt: new Date().toISOString(),
          points: (activeGame.points || []).map(p => ({
              ...p,
              isCompleted: false,
              isUnlocked: true
          }))
      };

      await db.saveGame(templateGame);
      setGames(prev => [templateGame, ...prev]);
      alert('Game Template saved!');
  };

  const handleCreateGameFromTemplate = async (templateId: string) => {
      const template = games.find(g => g.id === templateId);
      if (!template) return;

      const now = Date.now();
      const newGameId = `game-${now}`;

      const baseName = template.name.replace(/\s*TEMPLATE\s*$/i, '').trim();

      const newGame: Game = {
          ...template,
          id: newGameId,
          createdAt: now,
          isGameTemplate: false,
          name: baseName || `${template.name} (Copy)`,
          dbUpdatedAt: new Date().toISOString(),
          points: (template.points || []).map(p => ({
              ...p,
              isCompleted: false,
              isUnlocked: true
          }))
      };

      await db.saveGame(newGame);
      setGames(prev => [newGame, ...prev]);
      setActiveGameId(newGame.id);
      setMode(GameMode.EDIT);
      setShowGameChooser(false);
      setShowLanding(false);
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
      await updateActiveGame({ ...activeGame, points: updatedPoints, dangerZones: updatedZones });
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

  const handleStartGame = (gameId: string, teamName: string, userName: string, teamPhoto: string | null, style: MapStyleId) => {
      setActiveGameId(gameId);
      setLocalMapStyle(style);
      teamSync.connect(gameId, teamName, userName);
      setMode(GameMode.PLAY);
      setShowLanding(false);
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
      updateActiveGame({ ...activeGame, dangerZones: [...(activeGame.dangerZones || []), newZone] });
  };

  const handleUpdateRoute = (id: string, updates: Partial<GameRoute>) => {
      if (!activeGame) return;
      const updatedRoutes = (activeGame.routes || []).map(r => r.id === id ? { ...r, ...updates } : r);
      updateActiveGame({ ...activeGame, routes: updatedRoutes });
  };

  const handleManualUnlock = async (pointId: string) => {
      if (!activeGame) return;
      const updatedPoints = activeGame.points.map(p => p.id === pointId ? { ...p, isUnlocked: true } : p);
      await updateActiveGame({ ...activeGame, points: updatedPoints });
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
                      }}
                      onSelectGame={(id) => {
                          setActiveGameId(id);
                          setShowDashboard(false);
                          setShowLanding(false);
                          setMode(GameMode.EDIT);
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
                          dbUpdatedAt: new Date().toISOString(),
                          isGameTemplate: false
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
                  onEditGame={(id) => { setActiveGameId(id); setMode(GameMode.EDIT); setShowGameChooser(false); setShowLanding(false); }}
                  onEditPoint={setActiveTask}
                  onReorderPoints={() => {}}
                  onCreateTestGame={() => {}}
                  onOpenTaskMaster={() => setShowTaskMaster(true)}
                  onClearMap={() => updateActiveGame({ ...activeGame!, points: [] })}
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
                      if (activeGame) updateActiveGame({ ...activeGame, points: updatedPoints });
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
                          await updateActiveGame({ ...activeGame, points: [...activeGame.points, ...newPoints] });
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
                          await updateActiveGame({ ...gameToEdit, ...gameData });
                      } else {
                          const newGame = { ...gameData, id: `game-${Date.now()}`, points: [], createdAt: Date.now() } as Game;
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
                          updateActiveGame({ ...activeGame, points: updatedPoints });
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
                games={playableGames}
                activeGameId={activeGameId}
                onSelectGame={setActiveGameId}
                authUser={authUser}
                onLogout={() => { authService.logout(); setAuthUser(null); }}
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
                                if (activeGameId) {
                                    setMode(GameMode.EDIT);
                                    setShowLanding(false);
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

                    // Location updates are the most common multi-user edit. We re-fetch latest game
                    // before saving to reduce the chance of overwriting another editor's recent change.
                    const plainLoc = { lat: loc.lat, lng: loc.lng };
                    const updated = await db.updateGameItemLocation(activeGame.id, id, plainLoc, {
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
            onAddRoute={(route) => activeGame && updateActiveGame({ ...activeGame, routes: [...(activeGame.routes || []), route] })}
            onToggleRoute={(id) => {
                if (!activeGame) return;
                const updated = (activeGame.routes || []).map(r => r.id === id ? { ...r, isVisible: !r.isVisible } : r);
                updateActiveGame({ ...activeGame, routes: updated });
            }}
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
                onReorderPoints={async (pts) => { if (activeGame) await updateActiveGame({ ...activeGame, points: pts }); }}
                onClearMap={() => { if (activeGame && confirm("Clear all points?")) updateActiveGame({ ...activeGame, points: [] }); }}
                onSaveGame={() => updateActiveGame(activeGame!)}
                onOpenTaskMaster={() => setShowTaskMaster(true)}
                onFitBounds={(coords) => {
                    if (coords && coords.length > 0) mapRef.current?.fitBounds(coords);
                    else mapRef.current?.fitBounds(activeGame?.points || []);
                }}
                onOpenPlaygroundEditor={() => setViewingPlaygroundId(activeGame?.playgrounds?.[0]?.id || null)}
                initialExpanded={true}
                onExpandChange={setIsEditorExpanded}
                routes={activeGame?.routes}
                onAddRoute={(route) => activeGame && updateActiveGame({ ...activeGame, routes: [...(activeGame.routes || []), route] })}
                onDeleteRoute={(id) => activeGame && updateActiveGame({ ...activeGame, routes: (activeGame.routes || []).filter(r => r.id !== id) })}
                onUpdateRoute={handleUpdateRoute}
                onToggleRoute={(id) => { if (activeGame) { const updated = (activeGame.routes || []).map(r => r.id === id ? { ...r, isVisible: !r.isVisible } : r); updateActiveGame({ ...activeGame, routes: updated }); }}}
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
                        await updateActiveGame({ ...activeGame, points: [...activeGame.points, newPoint] });
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
