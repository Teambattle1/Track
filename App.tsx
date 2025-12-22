
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import GameMap, { GameMapHandle } from './components/GameMap.tsx';
import TaskModal from './components/TaskModal.tsx';
import GameHUD from './components/GameHUD.tsx';
import GameStats from './components/GameStats.tsx';
import GameManager from './components/GameManager.tsx';
import GameChooser from './components/GameChooser.tsx';
import TaskMaster from './components/TaskMaster.tsx';
import WelcomeScreen from './components/WelcomeScreen.tsx';
import InitialLanding from './components/InitialLanding.tsx';
import CreatorHub from './components/CreatorHub.tsx';
import Dashboard from './components/Dashboard.tsx'; 
import TeamsModal from './components/TeamsModal.tsx';
import EditorDrawer from './components/EditorDrawer.tsx';
import AdminModal from './components/AdminModal.tsx'; 
import InstructorDashboard from './components/InstructorDashboard.tsx'; 
import TaskActionModal from './components/TaskActionModal.tsx';
import LocationSearch from './components/LocationSearch.tsx';
import AiTaskGenerator from './components/AiTaskGenerator.tsx';
import PlaygroundModal from './components/PlaygroundModal.tsx';
import PlaygroundEditor from './components/PlaygroundEditor.tsx';
import PlaygroundLibraryModal from './components/PlaygroundLibraryModal.tsx';
import TaskEditor from './components/TaskEditor.tsx';
import TeamDashboard from './components/TeamDashboard.tsx'; 
import GameCreator from './components/GameCreator.tsx'; 
import ClientSubmissionView from './components/ClientSubmissionView.tsx'; 
import TeamsHubModal from './components/TeamsHubModal.tsx';
import { GamePoint, Coordinate, GameState, GameMode, Game, MapStyleId, Language, Team, TaskTemplate, GameAction, PlaygroundTemplate, Playground, PointActivationType } from './types.ts';
import { haversineMeters, isWithinRadius, formatDistance } from './utils/geo.ts';
import { X, ChevronDown, AlertTriangle, CheckCircle, RefreshCw, Plus, Wand2, Library, MapPin, Ruler, RotateCcw, Check, PenTool, Move } from 'lucide-react';
import * as db from './services/db.ts';
import { teamSync } from './services/teamSync.ts';

const APP_VERSION = "1.0.14";
const STORAGE_KEY_GAME_ID = 'teambattle_last_game_id';
const STORAGE_KEY_TEAM_ID = 'teambattle_last_team_id';
const STORAGE_KEY_PLAYER_NAME = 'teambattle_player_name';

type AppView = 'LANDING' | 'CREATOR_HUB' | 'DASHBOARD' | 'PLAYER_LOBBY' | 'MAP';

const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const submitToken = params.get('submitTo');

  const [gameState, setGameState] = useState<GameState>({
    activeGameId: localStorage.getItem(STORAGE_KEY_GAME_ID), 
    games: [], taskLibrary: [], taskLists: [], score: 0,
    userLocation: null, gpsAccuracy: null, deviceId: teamSync.getDeviceId(),
    teamId: localStorage.getItem(STORAGE_KEY_TEAM_ID) || undefined
  });

  const [currentView, setCurrentView] = useState<AppView>('LANDING');
  const [dashboardInitialTab, setDashboardInitialTab] = useState<string>('dashboard');
  const [mode, setMode] = useState<GameMode>(GameMode.PLAY);
  const [mapStyle, setMapStyle] = useState<MapStyleId>('osm'); 
  const [appLanguage, setAppLanguage] = useState<Language>('English');
  const [selectedPoint, setSelectedPoint] = useState<GamePoint | null>(null);
  const [editingPoint, setEditingPoint] = useState<GamePoint | null>(null); 
  
  const [showGameChooser, setShowGameChooser] = useState(false);
  const [showTaskMaster, setShowTaskMaster] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [showGameCreator, setShowGameCreator] = useState(false);
  const [gameToEdit, setGameToEdit] = useState<Game | null>(null); 
  const [taskMasterTab, setTaskMasterTab] = useState<'LISTS' | 'LIBRARY' | 'CREATE' | 'CLIENT'>('LISTS');
  const [taskMasterSelectionMode, setTaskMasterSelectionMode] = useState(false);

  const [showTeamsHub, setShowTeamsHub] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [teamsModalTargetId, setTeamsModalTargetId] = useState<string | null>(null);

  const [showGameManager, setShowGameManager] = useState(false); 
  const [showAdminModal, setShowAdminModal] = useState(false); 
  const [showInstructorDashboard, setShowInstructorDashboard] = useState(false); 
  const [showPlaygroundEditor, setShowPlaygroundEditor] = useState(false);
  const [showPlaygroundLibrary, setShowPlaygroundLibrary] = useState(false);
  const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(null);
  const [showTeamDashboard, setShowTeamDashboard] = useState(false); 

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [forceExpandDrawer, setForceExpandDrawer] = useState(false);
  const [sourceListId, setSourceListId] = useState<string>('');
  const [editorFilter, setEditorFilter] = useState<{ mode: 'ALL' | 'TAG' | 'LIST'; value: string }>({ mode: 'ALL', value: '' });
  
  const [showAddMenu, setShowAddMenu] = useState(false); 
  const targetLocationRef = useRef<Coordinate | null>(null);
  const targetPlaygroundIdRef = useRef<string | null>(null);

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePathIds, setMeasurePathIds] = useState<string[]>([]);
  const [isRelocating, setIsRelocating] = useState(false);
  const [actionPoint, setActionPoint] = useState<GamePoint | null>(null);

  const [completedPointIds, setCompletedPointIds] = useState<string[]>([]);
  const [unlockedPointIds, setUnlockedPointIds] = useState<string[]>([]);
  const [lockedPointIds, setLockedPointIds] = useState<string[]>([]);
  const [teamStartTime, setTeamStartTime] = useState<number | undefined>(undefined);

  // Loading Logic: Prevent infinite hanging
  const [loading, setLoading] = useState(true);
  const hasLoadedInitialRef = useRef(false);

  useEffect(() => {
    // Safety cutoff for splash screen: 5 seconds max
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const refreshData = useCallback(async (isPolling: boolean = false) => {
    // If in edit mode, stop polling to prevent overwrites
    if (mode === GameMode.EDIT && isPolling) return; 

    try {
        const [rawGames, rawLibrary, rawLists] = await Promise.all([
            db.fetchGames(), 
            db.fetchLibrary(), 
            db.fetchTaskLists()
        ]);

        const games = Array.isArray(rawGames) ? rawGames : [];
        const library = Array.isArray(rawLibrary) ? rawLibrary : [];
        const lists = Array.isArray(rawLists) ? rawLists : [];

        let teamData: Team | null = null;
        const currentTeamId = localStorage.getItem(STORAGE_KEY_TEAM_ID);
        if (currentTeamId) {
            teamData = await db.fetchTeam(currentTeamId);
        }

        setGameState(prev => {
            let activeGameId = prev.activeGameId;
            if (activeGameId && games.length > 0 && !games.find(g => g.id === activeGameId)) {
                activeGameId = null;
            }
            return { 
                ...prev, 
                games, 
                taskLibrary: library, 
                taskLists: lists, 
                activeGameId, 
                score: teamData ? teamData.score : prev.score 
            };
        });

        if (teamData) {
            setCompletedPointIds(teamData.completedPointIds || []);
            if (teamData.isStarted && teamData.updatedAt) {
                setTeamStartTime(new Date(teamData.updatedAt).getTime());
            }
        }
    } catch (err: any) {
        console.warn("Refresh Data Error:", err);
    } finally { 
        setLoading(false); 
        hasLoadedInitialRef.current = true;
    }
  }, [mode]); 

  // Initial load
  useEffect(() => {
    refreshData();
  }, []); // Only on mount

  // Periodic Refresh
  useEffect(() => {
    const interval = setInterval(() => refreshData(true), 20000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  // Handle GPS
  const [gpsActive, setGpsActive] = useState(false);
  useEffect(() => {
    if (!navigator.geolocation || !gpsActive) return;
    
    let watchId: number = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const newLoc = { lat: latitude, lng: longitude };
            setGameState(prev => {
                if (!prev.userLocation || haversineMeters(prev.userLocation, newLoc) > 1) {
                    teamSync.updateLocation(newLoc);
                    return { ...prev, userLocation: newLoc, gpsAccuracy: accuracy };
                }
                return prev;
            });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsActive]);

  const activeGame = useMemo(() => {
      return (Array.isArray(gameState.games) ? gameState.games : []).find(g => g.id === gameState.activeGameId);
  }, [gameState.games, gameState.activeGameId]);

  const activePlayground = useMemo(() => {
      if (!activeGame?.playgrounds || !activePlaygroundId) return null;
      return activeGame.playgrounds.find(p => p.id === activePlaygroundId) || null;
  }, [activeGame, activePlaygroundId]);

  const updateActiveGame = (updatedGame: Game) => {
      setGameState(prev => ({
          ...prev,
          games: (Array.isArray(prev.games) ? prev.games : []).map(g => g.id === updatedGame.id ? updatedGame : g)
      }));
      db.saveGame(updatedGame);
  };

  const handleDeleteTagGlobally = async (tagName: string) => {
      const lowerTag = tagName.toLowerCase();
      try {
          await db.purgeTagGlobally(lowerTag);
          await refreshData();
      } catch (err: any) {
          console.error("Failed to delete tag globally:", err);
          if (err.code === 'PGRST202' || (err.message && (err.message.includes('does not exist') || err.message.includes('Could not find the function')))) {
              setShowAdminModal(true);
          } else {
              alert("Database update failed. Check connection.");
          }
          throw err;
      }
  };

  const handleRenameTagGlobally = async (oldTag: string, newTag: string) => {
      try {
          await db.renameTagGlobally(oldTag, newTag);
          await refreshData();
      } catch (err: any) {
          console.error("Failed to rename tag globally:", err);
          if (err.code === 'PGRST202' || (err.message && (err.message.includes('does not exist') || err.message.includes('Could not find the function')))) {
              setShowAdminModal(true);
          } else {
              alert("Database update failed. Check connection.");
          }
          throw err;
      }
  };

  const handleStartGame = (gameId: string, teamName: string, userName: string, style: MapStyleId) => {
      const teamId = `team-${teamName.replace(/\s+/g, '-').toLowerCase()}-${gameId}`;
      setGameState(prev => ({ ...prev, activeGameId: gameId, teamName, userName, teamId }));
      localStorage.setItem(STORAGE_KEY_GAME_ID, gameId);
      localStorage.setItem(STORAGE_KEY_TEAM_ID, teamId);
      localStorage.setItem(STORAGE_KEY_PLAYER_NAME, userName);
      setMode(GameMode.PLAY); 
      setMapStyle(style); 
      setCurrentView('MAP');
      setTeamStartTime(Date.now());
      teamSync.connect(gameId, teamName, userName);
      refreshData();
  };

  const handleDashboardAction = (action: string) => {
      setGpsActive(true);
      // Force refresh data when entering dashboard to ensure tags/users are fresh
      refreshData(); 
      
      switch(action) {
          case 'DASHBOARD':
              setDashboardInitialTab('dashboard');
              setCurrentView('DASHBOARD');
              break;
          case 'USERS':
              setDashboardInitialTab('users');
              setCurrentView('DASHBOARD');
              break;
          case 'TAGS':
              setDashboardInitialTab('tags');
              setCurrentView('DASHBOARD');
              break;
          case 'TEAMS':
              setShowTeamsHub(true);
              break;
          case 'GAMES':
              setShowGameChooser(true);
              break;
          case 'TASKS':
              setTaskMasterTab('LIBRARY');
              setTaskMasterSelectionMode(false);
              setShowTaskMaster(true);
              break;
          case 'TASKLIST':
              setTaskMasterTab('LISTS');
              setTaskMasterSelectionMode(false);
              setShowTaskMaster(true);
              break;
          case 'TEMPLATES':
              setTaskMasterTab('LISTS');
              setTaskMasterSelectionMode(false);
              setShowTaskMaster(true);
              break;
          case 'PLAYGROUNDS':
              if (activeGame) {
                setMode(GameMode.EDIT);
                setShowPlaygroundEditor(true);
                setCurrentView('MAP');
              } else {
                setShowGameChooser(true);
                (window as any)._afterChooseView = 'MAP_PLAYGROUNDS';
              }
              break;
          case 'TEAMZONE':
              setShowTeamDashboard(true);
              break;
          case 'EDIT_GAME':
              if (activeGame) {
                  setMode(GameMode.EDIT);
                  setForceExpandDrawer(false);
                  setCurrentView('MAP');
              } else {
                  setShowGameChooser(true);
                  (window as any)._afterChooseView = 'MAP_EDIT';
              }
              break;
          case 'PLAY':
              setCurrentView('PLAYER_LOBBY');
              break;
          case 'ADMIN':
              setShowAdminModal(true);
              break;
          case 'REFRESH_DATA':
              refreshData();
              break;
      }
  };

  const handleAddTasksFromLibrary = (tasks: TaskTemplate[], explicitPlaygroundId?: string) => {
      const currentActiveGame = activeGame;
      if (!currentActiveGame) return;
      const baseLocation = targetLocationRef.current || mapRef.current?.getCenter() || { lat: 0, lng: 0 };
      const targetPlayground = explicitPlaygroundId || targetPlaygroundIdRef.current;
      const newPoints = tasks.map((t, i) => ({ 
          id: `pt-${Date.now()}-${i}`, 
          title: t.title, 
          task: t.task, 
          location: { lat: baseLocation.lat + (Math.random() - 0.5) * 0.0005, lng: baseLocation.lng + (Math.random() - 0.5) * 0.0005 }, 
          radiusMeters: 30, 
          iconId: t.iconId, 
          points: t.points || 100, 
          isUnlocked: false, 
          isCompleted: false, 
          activationTypes: (targetPlayground ? ['click'] : ['radius']) as PointActivationType[], 
          order: currentActiveGame.points.length + i, 
          tags: t.tags, 
          feedback: t.feedback, 
          settings: t.settings, 
          playgroundId: targetPlayground || undefined, 
          playgroundPosition: targetPlayground ? { x: 50 + (i * 2), y: 50 + (i * 2) } : undefined,
          playgroundScale: targetPlayground ? 1 : undefined
      }));
      updateActiveGame({ ...currentActiveGame, points: [...currentActiveGame.points, ...newPoints] });
      setShowTaskMaster(false);
      setTaskMasterSelectionMode(false);
      setShowAddMenu(false);
      targetLocationRef.current = null;
      targetPlaygroundIdRef.current = null;
  };

  const executeActions = useCallback((actions: GameAction[]) => {
      actions.forEach(action => {
          switch (action.type) {
              case 'unlock':
                  if (action.targetId) setUnlockedPointIds(prev => [...new Set([...prev, action.targetId!])]);
                  break;
              case 'lock':
                  if (action.targetId) setLockedPointIds(prev => [...new Set([...prev, action.targetId!])]);
                  break;
              case 'score':
                  const val = typeof action.value === 'number' ? action.value : parseInt(String(action.value) || '0');
                  setGameState(prev => ({ ...prev, score: prev.score + val }));
                  if (gameState.teamId) db.updateTeamScore(gameState.teamId, val);
                  break;
              case 'message':
                  alert(action.value || "Mission Status Updated");
                  break;
              case 'open_playground':
                  if (action.targetId) setActivePlaygroundId(action.targetId);
                  break;
          }
      });
  }, [gameState.teamId]);

  const handleCompleteTask = useCallback(async (pointId: string, customScore?: number) => {
      if (!gameState.teamId) return;
      
      const pt = activeGame?.points.find(p => p.id === pointId);
      if (!pt) return;
      
      const addedPoints = customScore !== undefined ? customScore : pt.points;
      const newScore = gameState.score + addedPoints;
      
      setCompletedPointIds(prev => [...new Set([...prev, pointId])]);
      setGameState(prev => ({ ...prev, score: newScore }));
      
      await db.updateTeamProgress(gameState.teamId, pointId, newScore);

      if (pt.logic?.onCorrect) {
          executeActions(pt.logic.onCorrect);
      }
  }, [activeGame, gameState.teamId, gameState.score, executeActions]);

  const handleUnlockPoint = useCallback((pointId: string) => {
      setUnlockedPointIds(prev => [...new Set([...prev, pointId])]);
  }, []);

  const handlePenalty = useCallback((amount: number) => {
      if (!gameState.teamId) return;
      const newScore = Math.max(0, gameState.score - amount);
      setGameState(prev => ({ ...prev, score: newScore }));
      db.updateTeamScore(gameState.teamId, -amount);
  }, [gameState.teamId, gameState.score]);

  const handleAddTask = useCallback((type: 'MANUAL' | 'AI' | 'LIBRARY', playgroundId?: string) => {
      targetPlaygroundIdRef.current = playgroundId || null;
      if (type === 'AI') setShowAiGenerator(true);
      else if (type === 'LIBRARY') {
          setTaskMasterTab('LIBRARY');
          setTaskMasterSelectionMode(true);
          setShowTaskMaster(true);
      } else {
          const currentActiveGame = activeGame;
          if (!currentActiveGame) return;
          const baseLocation = mapRef.current?.getCenter() || { lat: 0, lng: 0 };
          const newPoint: GamePoint = {
              id: `pt-${Date.now()}`,
              title: "New Task",
              task: { question: "Enter question here...", type: "text" },
              location: baseLocation,
              radiusMeters: 30,
              iconId: "default",
              points: 100,
              isUnlocked: false,
              isCompleted: false,
              activationTypes: playgroundId ? ['click'] : ['radius'],
              order: currentActiveGame.points.length,
              playgroundId: playgroundId
          };
          updateActiveGame({ ...currentActiveGame, points: [...currentActiveGame.points, newPoint] });
          setEditingPoint(newPoint);
      }
  }, [activeGame]);

  const handleRelocateToggle = () => {
      if (isRelocating) {
          // Confirm Relocation: Shift all points to center around the current map view
          if (!activeGame || !mapRef.current) { setIsRelocating(false); return; }
          
          const newCenter = mapRef.current.getCenter();
          const mapPoints = activeGame.points.filter(p => !p.playgroundId);
          
          if (mapPoints.length > 0) {
              const sumLat = mapPoints.reduce((s, p) => s + p.location.lat, 0);
              const sumLng = mapPoints.reduce((s, p) => s + p.location.lng, 0);
              const centroid = { lat: sumLat / mapPoints.length, lng: sumLng / mapPoints.length };
              
              const dLat = newCenter.lat - centroid.lat;
              const dLng = newCenter.lng - centroid.lng;
              
              const updatedPoints = activeGame.points.map(p => {
                  if (p.playgroundId) return p;
                  return {
                      ...p,
                      location: { lat: p.location.lat + dLat, lng: p.location.lng + dLng }
                  };
              });
              
              updateActiveGame({ ...activeGame, points: updatedPoints });
          }
          setIsRelocating(false);
      } else {
          // Enter Relocation Mode
          setIsRelocating(true);
      }
  };

  const displayPoints = useMemo(() => {
      if (!activeGame) return [];
      return activeGame.points.map(p => ({ 
          ...p, 
          isUnlocked: (unlockedPointIds.includes(p.id) || mode !== GameMode.PLAY) && !lockedPointIds.includes(p.id), 
          isCompleted: completedPointIds.includes(p.id) 
      }));
  }, [activeGame, completedPointIds, unlockedPointIds, lockedPointIds, mode]);

  const handlePointClick = (p: GamePoint) => {
      if (isMeasuring) { setMeasurePathIds(prev => [...prev, p.id]); return; }
      if (mode === GameMode.EDIT) { setEditingPoint(p); } else { setSelectedPoint(p); }
  };

  const nearestPointDistance = useMemo(() => {
      if (!activeGame || !gameState.userLocation) return null;
      const uncompletedPoints = activeGame.points.filter(p => !completedPointIds.includes(p.id) && !p.isSectionHeader && !p.playgroundId);
      if (uncompletedPoints.length === 0) return null;
      const distances = uncompletedPoints.map(p => haversineMeters(gameState.userLocation!, p.location));
      return Math.min(...distances);
  }, [activeGame, completedPointIds, gameState.userLocation]);

  const mapRef = useRef<GameMapHandle>(null);

  if (submitToken) {
      return <ClientSubmissionView token={submitToken} />;
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 font-sans">
      {loading && !hasLoadedInitialRef.current && (
          <div className="fixed inset-0 z-[6000] bg-slate-950 flex items-center justify-center flex-col gap-4">
              <RefreshCw className="w-12 h-12 text-orange-600 animate-spin" />
              <p className="text-white font-black uppercase tracking-widest text-sm">Initializing...</p>
          </div>
      )}

      {currentView === 'LANDING' && (
          <InitialLanding 
              onAction={handleDashboardAction} 
              version={APP_VERSION} 
              games={Array.isArray(gameState.games) ? gameState.games : []}
              activeGameId={gameState.activeGameId}
              onSelectGame={(id) => {
                  setGameState(prev => ({ ...prev, activeGameId: id }));
                  localStorage.setItem(STORAGE_KEY_GAME_ID, id);
              }}
          />
      )}

      {currentView === 'DASHBOARD' && (
          <Dashboard 
              games={Array.isArray(gameState.games) ? gameState.games : []}
              taskLists={Array.isArray(gameState.taskLists) ? gameState.taskLists : []}
              taskLibrary={Array.isArray(gameState.taskLibrary) ? gameState.taskLibrary : []}
              userName={gameState.userName || 'Creator'}
              initialTab={dashboardInitialTab as any}
              onBack={() => setCurrentView('LANDING')}
              onAction={(action) => {
                  if (action === 'CREATE') setShowGameCreator(true);
                  if (action === 'VIEW_TEMPLATES') { setTaskMasterTab('LISTS'); setShowTaskMaster(true); }
                  if (action === 'VIEW_TASKS') { setTaskMasterTab('LIBRARY'); setShowTaskMaster(true); }
                  if (action === 'EDIT_GAME') setShowGameChooser(true);
                  if (action === 'REFRESH_DATA') refreshData();
              }}
              onDeleteTagGlobally={handleDeleteTagGlobally}
              onRenameTagGlobally={handleRenameTagGlobally}
          />
      )}

      {/* Rest of the component (PLAYER_LOBBY, MAP, Modals) remains the same */}
      {currentView === 'PLAYER_LOBBY' && (
          <WelcomeScreen 
            games={Array.isArray(gameState.games) ? gameState.games : []} 
            userLocation={gameState.userLocation} 
            onStartGame={handleStartGame} 
            onSetMapStyle={setMapStyle} 
            language={appLanguage} 
            onSetLanguage={setAppLanguage} 
            onBack={() => setCurrentView('LANDING')} 
          />
      )}

      {currentView === 'MAP' && (
          <>
              <GameMap 
                ref={mapRef} 
                userLocation={gameState.userLocation} 
                points={displayPoints} 
                accuracy={gameState.gpsAccuracy} 
                mode={mode} 
                mapStyle={mapStyle} 
                selectedPointId={selectedPoint?.id} 
                isRelocating={isRelocating}
                onPointClick={handlePointClick} 
                onPointMove={(id, loc) => { 
                    if (!activeGame) return; 
                    const updatedPoints = activeGame.points.map(p => p.id === id ? { ...p, location: loc } : p); 
                    updateActiveGame({ ...activeGame, points: updatedPoints });
                }} 
                onDeletePoint={(id) => { 
                    if (!activeGame) return; 
                    const updatedPoints = activeGame.points.filter(p => p.id !== id); 
                    updateActiveGame({ ...activeGame, points: updatedPoints });
                }} 
              />
              <GameHUD 
                accuracy={gameState.gpsAccuracy} 
                mode={mode} 
                toggleMode={() => setMode(mode === GameMode.PLAY ? GameMode.EDIT : mode === GameMode.EDIT ? GameMode.INSTRUCTOR : GameMode.PLAY)} 
                onOpenGameManager={() => setShowGameManager(true)} 
                onOpenTaskMaster={() => { setTaskMasterTab('LISTS'); setShowTaskMaster(true); }} 
                onOpenTeams={() => setShowTeamsModal(true)} 
                mapStyle={mapStyle} 
                onSetMapStyle={setMapStyle} 
                language={appLanguage} 
                onBackToHub={() => setCurrentView('LANDING')} 
                activeGameName={activeGame?.name} 
                onOpenInstructorDashboard={() => setShowInstructorDashboard(true)} 
                isMeasuring={isMeasuring}
                onToggleMeasure={() => { setIsMeasuring(!isMeasuring); setMeasurePathIds([]); }}
                playgrounds={activeGame?.playgrounds}
                onOpenPlayground={(id) => setActivePlaygroundId(id)}
                onOpenTeamDashboard={() => setShowTeamDashboard(true)}
                timerConfig={activeGame?.timerConfig}
                gameStartedAt={teamStartTime}
                onRelocateGame={handleRelocateToggle}
                isRelocating={isRelocating}
              />
              
              {mode === GameMode.EDIT && (
                <EditorDrawer 
                  onClose={() => setMode(GameMode.PLAY)} 
                  activeGame={activeGame}
                  activeGameName={activeGame?.name || "No game selected"} 
                  points={displayPoints} 
                  allPoints={activeGame?.points}
                  taskLists={Array.isArray(gameState.taskLists) ? gameState.taskLists : []} 
                  games={Array.isArray(gameState.games) ? gameState.games : []}
                  onSelectGame={(id) => {
                      setGameState(prev => ({ ...prev, activeGameId: id }));
                      localStorage.setItem(STORAGE_KEY_GAME_ID, id);
                  }}
                  onOpenGameChooser={() => setShowGameChooser(true)}
                  sourceListId={sourceListId} 
                  onSetSourceListId={setSourceListId} 
                  onEditPoint={(p) => setEditingPoint(p)} 
                  onSelectPoint={(p) => { setSelectedPoint(p); mapRef.current?.jumpTo(p.location); }} 
                  onDeletePoint={(id) => { 
                      if(!activeGame) return; 
                      updateActiveGame({...activeGame, points: activeGame.points.filter(p => p.id !== id)});
                  }} 
                  onReorderPoints={(pts) => { 
                      if(!activeGame) return; 
                      updateActiveGame({...activeGame, points: pts});
                  }} 
                  onClearMap={(ids) => { 
                      if(!activeGame) return; 
                      const updated = ids ? activeGame.points.filter(p => !ids.includes(p.id)) : [];
                      updateActiveGame({...activeGame, points: updated});
                  }} 
                  onSaveGame={() => db.saveGame(activeGame!)} 
                  onOpenTaskMaster={() => { setTaskMasterTab('LISTS'); setShowTaskMaster(true); }} 
                  onFitBounds={() => {}} 
                  onOpenPlaygroundEditor={() => setShowPlaygroundEditor(true)}
                  initialExpanded={forceExpandDrawer}
                  onAddTask={handleAddTask} 
                  userLocation={gameState.userLocation}
                />
              )}
              {mode === GameMode.PLAY && activeGame && <GameStats score={gameState.score} pointsCount={{ total: displayPoints.filter(p => !p.isSectionHeader).length, completed: completedPointIds.length }} nearestPointDistance={nearestPointDistance} language={appLanguage} />}
          </>
      )}

      {showGameCreator && (
          <GameCreator 
              baseGame={gameToEdit || undefined}
              onClose={() => { setShowGameCreator(false); setGameToEdit(null); }}
              onCreate={async (gameData) => {
                  if (gameToEdit) {
                      // UPDATE EXISTING GAME
                      const updatedGame = { 
                          ...gameToEdit, 
                          ...gameData,
                          client: { ...gameToEdit.client, ...gameData.client },
                          timerConfig: gameData.timerConfig
                      } as Game;
                      
                      // 1. Optimistic Update
                      setGameState(prev => ({
                          ...prev,
                          games: (Array.isArray(prev.games) ? prev.games : []).map(g => g.id === updatedGame.id ? updatedGame : g)
                      }));
                      setShowGameCreator(false);
                      setGameToEdit(null);

                      // 2. Persist & Refresh
                      await db.saveGame(updatedGame);
                      await refreshData();
                  } else {
                      // CREATE NEW GAME
                      const newGame: Game = { 
                          id: `game-${Date.now()}`, 
                          name: gameData.name || "New Game", 
                          description: gameData.description || "", 
                          points: [], 
                          createdAt: Date.now(), 
                          client: gameData.client, 
                          timerConfig: gameData.timerConfig 
                      };
                      
                      // 1. Optimistic Add
                      setGameState(prev => ({
                          ...prev,
                          games: [...(Array.isArray(prev.games) ? prev.games : []), newGame],
                          activeGameId: newGame.id
                      }));
                      setShowGameCreator(false);
                      setMode(GameMode.EDIT);
                      setCurrentView('MAP');

                      // 2. Persist & Refresh
                      await db.saveGame(newGame);
                      await refreshData();
                  }
              }}
          />
      )}

      {showGameChooser && (
          <GameChooser 
            games={Array.isArray(gameState.games) ? gameState.games : []} 
            taskLists={Array.isArray(gameState.taskLists) ? gameState.taskLists : []} 
            onClose={() => setShowGameChooser(false)} 
            onSelectGame={(id) => { 
                setGameState(prev => ({ ...prev, activeGameId: id })); 
                setShowGameChooser(false); 
                const target = (window as any)._afterChooseView;
                if (target === 'MAP_PLAYGROUNDS') { 
                    setMode(GameMode.EDIT); 
                    setShowPlaygroundEditor(true); 
                    setCurrentView('MAP'); 
                } else {
                    // Default to Map Editor for standard selection
                    setMode(GameMode.EDIT); 
                    setCurrentView('MAP'); 
                }
                (window as any)._afterChooseView = null;
            }} 
            onCreateGame={(name) => {
                const newGame: Game = { id: `game-${Date.now()}`, name, description: '', points: [], createdAt: Date.now() }; 
                db.saveGame(newGame).then(() => { 
                    setGameState(prev => ({ ...prev, activeGameId: newGame.id })); 
                    setShowGameChooser(false); 
                    setMode(GameMode.EDIT); 
                    setCurrentView('MAP');
                }); 
            }}
            onEditGame={(id) => {
                const g = (Array.isArray(gameState.games) ? gameState.games : []).find(x => x.id === id);
                if(g) {
                    setGameToEdit(g);
                    setShowGameCreator(true);
                }
            }}
          />
      )}

      {showTaskMaster && (
        <TaskMaster 
            library={Array.isArray(gameState.taskLibrary) ? gameState.taskLibrary : []} 
            lists={Array.isArray(gameState.taskLists) ? gameState.taskLists : []} 
            onClose={() => setShowTaskMaster(false)} 
            onSaveTemplate={(t) => db.saveTemplate(t).then(() => refreshData())} 
            onDeleteTemplate={(id) => db.deleteTemplate(id).then(() => refreshData())} 
            onSaveList={(l) => db.saveTaskList(l).then(() => refreshData())} 
            onDeleteList={(id) => db.deleteTaskList(id).then(() => refreshData())} 
            onCreateGameFromList={() => {}} 
            initialTab={taskMasterTab}
            isSelectionMode={taskMasterSelectionMode}
            onSelectTasksForGame={(tasks) => handleAddTasksFromLibrary(tasks)}
        />
      )}

      {showTeamsHub && (
          <TeamsHubModal 
              onClose={() => setShowTeamsHub(false)}
              onAction={(action) => {
                  setShowTeamsHub(false);
                  if (action === 'JOIN') setCurrentView('PLAYER_LOBBY');
                  if (action === 'COMMAND') { setMode(GameMode.INSTRUCTOR); setShowTeamsModal(true); setCurrentView('MAP'); }
              }}
          />
      )}

      {showTeamsModal && (
          <TeamsModal 
            gameId={gameState.activeGameId} 
            games={Array.isArray(gameState.games) ? gameState.games : []} 
            targetTeamId={teamsModalTargetId}
            onSelectGame={(id) => setGameState(prev => ({ ...prev, activeGameId: id }))} 
            onClose={() => setShowTeamsModal(false)} 
          />
      )}

      {showTeamDashboard && gameState.activeGameId && (
          <TeamDashboard 
              teamId={gameState.teamId} 
              gameId={gameState.activeGameId}
              totalMapPoints={activeGame?.points.filter(p => !p.playgroundId).length || 0}
              onOpenAgents={() => setShowTeamsModal(true)}
              onClose={() => setShowTeamDashboard(false)} 
          />
      )}

      {editingPoint && (
          <TaskEditor 
              point={editingPoint} 
              onSave={(updatedPoint) => {
                  const updatedPoints = activeGame!.points.map(p => p.id === updatedPoint.id ? updatedPoint : p);
                  updateActiveGame({ ...activeGame!, points: updatedPoints });
                  setEditingPoint(null);
              }}
              onDelete={(id) => {
                  updateActiveGame({ ...activeGame!, points: activeGame!.points.filter(p => p.id !== id) });
                  setEditingPoint(null);
              }}
              onClose={() => setEditingPoint(null)}
          />
      )}

      {selectedPoint && (
        <TaskModal 
            point={selectedPoint} 
            onClose={() => setSelectedPoint(null)} 
            onComplete={handleCompleteTask} 
            onUnlock={handleUnlockPoint}
            onPenalty={handlePenalty}
            onTaskOpen={() => selectedPoint.logic?.onOpen && executeActions(selectedPoint.logic.onOpen)}
            onTaskIncorrect={() => selectedPoint.logic?.onIncorrect && executeActions(selectedPoint.logic.onIncorrect)}
            onOpenActions={() => mode === GameMode.EDIT && setActionPoint(selectedPoint)}
            distance={gameState.userLocation ? haversineMeters(gameState.userLocation, selectedPoint.location) : 0} 
            mode={mode}
        />
      )}

      {/* Logic Editor Modal */}
      {actionPoint && (
          <TaskActionModal 
              point={actionPoint} 
              allPoints={activeGame?.points || []} 
              playgrounds={activeGame?.playgrounds}
              onSave={(updated) => {
                  const updatedPoints = activeGame!.points.map(p => p.id === updated.id ? updated : p);
                  updateActiveGame({ ...activeGame!, points: updatedPoints });
                  setActionPoint(null);
              }}
              onClose={() => setActionPoint(null)}
              onStartDrawMode={() => {}} 
          />
      )}

      {/* Playground Viewer Modal */}
      {activePlaygroundId && activePlayground && (
          <PlaygroundModal 
              playground={activePlayground}
              points={displayPoints}
              onClose={() => setActivePlaygroundId(null)}
              onPointClick={handlePointClick}
              mode={mode}
              onUpdatePlayground={(updated) => {
                  const updatedPGs = activeGame!.playgrounds!.map(pg => pg.id === updated.id ? updated : pg);
                  updateActiveGame({ ...activeGame, playgrounds: updatedPGs });
              }}
              onEditPlayground={() => setShowPlaygroundEditor(true)}
          />
      )}
      
      {/* Playground Design Editor */}
      {showPlaygroundEditor && activeGame && (
          <PlaygroundEditor 
              game={activeGame}
              onUpdateGame={updateActiveGame}
              onClose={() => setShowPlaygroundEditor(false)}
              onEditPoint={setEditingPoint}
              onAddTask={handleAddTask}
              onOpenLibrary={() => setShowPlaygroundLibrary(true)}
          />
      )}

      {/* Playground Template Library */}
      {showPlaygroundLibrary && (
          <PlaygroundLibraryModal 
              onClose={() => setShowPlaygroundLibrary(false)}
              onImport={(tpl) => {
                  const newPlayground = { ...tpl.playgroundData, id: `pg-${Date.now()}` };
                  const newTasks = tpl.tasks.map((t, i) => ({ ...t, id: `pt-${Date.now()}-${i}`, playgroundId: newPlayground.id }));
                  updateActiveGame({ 
                      ...activeGame!, 
                      playgrounds: [...(activeGame!.playgrounds || []), newPlayground],
                      points: [...activeGame!.points, ...newTasks]
                  });
                  setShowPlaygroundLibrary(false);
              }}
          />
      )}

      {/* AI Task Generator */}
      {showAiGenerator && (
          <AiTaskGenerator 
              onClose={() => setShowAiGenerator(false)} 
              onAddTasks={(tasks) => handleAddTasksFromLibrary(tasks, targetPlaygroundIdRef.current || undefined)} 
          />
      )}

      {showInstructorDashboard && activeGame && (
          <InstructorDashboard 
              game={activeGame}
              onClose={() => setShowInstructorDashboard(false)}
          />
      )}

      {showAdminModal && (
          <AdminModal 
              games={Array.isArray(gameState.games) ? gameState.games : []}
              onClose={() => setShowAdminModal(false)}
              onDeleteGame={async (id) => {
                  if (confirm('Are you sure you want to permanently delete this game and all its data?')) {
                      await db.deleteGame(id);
                      await refreshData();
                      if (gameState.activeGameId === id) {
                          setGameState(prev => ({ ...prev, activeGameId: null }));
                          localStorage.removeItem(STORAGE_KEY_GAME_ID);
                      }
                  }
              }}
          />
      )}
    </div>
  );
};

export default App;
