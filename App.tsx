
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import GameMap, { GameMapHandle } from './components/GameMap.tsx';
import TaskModal from './components/TaskModal.tsx';
import GameHUD from './components/GameHUD.tsx';
import GameStats from './components/GameStats.tsx';
import GameManager from './components/GameManager.tsx';
import GameChooser from './components/GameChooser.tsx';
import TaskMaster from './components/TaskMaster.tsx';
import WelcomeScreen from './components/WelcomeScreen.tsx';
import LandingPage from './components/LandingPage.tsx';
import TeamsModal from './components/TeamsModal.tsx';
import EditorDrawer from './components/EditorDrawer.tsx';
import AdminModal from './components/AdminModal.tsx'; 
import InstructorDashboard from './components/InstructorDashboard.tsx'; 
import MessagePopup from './components/MessagePopup.tsx'; 
import LocationSearch from './components/LocationSearch.tsx';
import TaskPreview from './components/TaskPreview.tsx';
import AiTaskGenerator from './components/AiTaskGenerator.tsx';
import { GamePoint, Coordinate, GameState, GameMode, Game, MapStyleId, Language, ChatMessage, TaskTemplate, Team } from './types.ts';
import { haversineMeters, isWithinRadius } from './utils/geo.ts';
import { X, Copy, ClipboardPaste, ChevronDown, AlertTriangle, Plus, Sparkles, Library, FilePlus, CheckCircle } from 'lucide-react';
import * as db from './services/db.ts';
import { teamSync } from './services/teamSync.ts';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    activeGameId: localStorage.getItem('teambattle_last_game_id'), 
    games: [], taskLibrary: [], taskLists: [], score: 0,
    userLocation: null, gpsAccuracy: null, deviceId: teamSync.getDeviceId(),
    teamId: localStorage.getItem('teambattle_last_team_id') || undefined
  });

  const [mode, setMode] = useState<GameMode>(GameMode.PLAY);
  const [mapStyle, setMapStyle] = useState<MapStyleId>('osm'); 
  const [appLanguage, setAppLanguage] = useState<Language>('English');
  const [selectedPoint, setSelectedPoint] = useState<GamePoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GamePoint | null>(null);
  const [markedPoints, setMarkedPoints] = useState<GamePoint[] | null>(null);
  const [originalCenter, setOriginalCenter] = useState<Coordinate | null>(null);
  const [sourceListId, setSourceListId] = useState('');
  
  const [showGameChooser, setShowGameChooser] = useState(false);
  const [showTaskMaster, setShowTaskMaster] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showGameManager, setShowGameManager] = useState(false); 
  const [showAdminModal, setShowAdminModal] = useState(false); 
  const [showInstructorDashboard, setShowInstructorDashboard] = useState(false); 
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isTaskSelectionMode, setIsTaskSelectionMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [forceExpandDrawer, setForceExpandDrawer] = useState(false);

  const [completedPointIds, setCompletedPointIds] = useState<string[]>([]);
  const [unlockedPointIds, setUnlockedPointIds] = useState<string[]>([]);

  const [instructorGame, setInstructorGame] = useState<Game | null>(null);
  const [currentChatMessage, setCurrentChatMessage] = useState<ChatMessage | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [bypassWelcome, setBypassWelcome] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<GameMapHandle>(null);
  const gameStateRef = useRef(gameState);
  const unlockedIdsRef = useRef(unlockedPointIds);

  useEffect(() => {
    gameStateRef.current = gameState;
    unlockedIdsRef.current = unlockedPointIds;
    if (gameState.activeGameId) {
        localStorage.setItem('teambattle_last_game_id', gameState.activeGameId);
    }
    if (gameState.teamId) {
        localStorage.setItem('teambattle_last_team_id', gameState.teamId);
    }
  }, [gameState, unlockedPointIds]);

  useEffect(() => {
      const unsubscribeChat = teamSync.subscribeToChat((msg) => setCurrentChatMessage(msg));
      return () => {
          unsubscribeChat();
      };
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
        const [games, library, lists] = await Promise.all([db.fetchGames(), db.fetchLibrary(), db.fetchTaskLists()]);
        
        let teamData: Team | null = null;
        if (gameStateRef.current.teamId) {
            teamData = await db.fetchTeam(gameStateRef.current.teamId);
        }

        setGameState(prev => {
            let activeGameId = prev.activeGameId;
            if (activeGameId && !games.find(g => g.id === activeGameId)) activeGameId = null;
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
        }
    } catch (err: any) {
        setError(err?.message || "Connection Error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newLoc = { lat: latitude, lng: longitude };
        setGameState(prev => ({ ...prev, userLocation: newLoc, gpsAccuracy: accuracy }));
        teamSync.updateLocation(newLoc);

        const activeGame = gameStateRef.current.games.find(g => g.id === gameStateRef.current.activeGameId);
        if (activeGame && mode === GameMode.PLAY) {
             activeGame.points.forEach(point => {
                 const isCompleted = completedPointIds.includes(point.id);
                 const isUnlocked = unlockedIdsRef.current.includes(point.id);
                 
                 if (!isUnlocked && !isCompleted && point.activationTypes.includes('radius')) {
                     if (isWithinRadius(newLoc, point.location, point.radiusMeters)) {
                         setUnlockedPointIds(prev => [...prev, point.id]);
                     }
                 }
             });
        }
      },
      (err) => { if (err.code !== 3) console.error("Geo Error:", err.message); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [mode, completedPointIds]); 

  const handlePointHover = useCallback((point: GamePoint | null) => {
    if (point) setHoveredPoint(point);
    else setHoveredPoint(null);
  }, []);

  const handleStartGame = (gameId: string, teamName: string, userName: string, style: MapStyleId) => {
      const teamId = `team-${teamName.replace(/\s+/g, '-').toLowerCase()}-${gameId}`;
      setGameState(prev => ({ ...prev, activeGameId: gameId, teamName, userName, teamId }));
      setMode(GameMode.PLAY); setMapStyle(style); setShowLanding(false); setBypassWelcome(true);
      teamSync.connect(gameId, teamName, userName);
      refreshData();
  };

  const handleFitBounds = () => {
      const activeGame = gameState.games.find(g => g.id === gameState.activeGameId);
      if (activeGame && activeGame.points.length > 0) mapRef.current?.fitBounds(activeGame.points);
  };

  const handleAddTaskAtCenter = (forceEmpty = false) => {
    if (!activeGame) {
        setShowAddMenu(false);
        setShowGameChooser(true);
        return;
    }
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    handleMapClick(center, forceEmpty);
    setShowAddMenu(false);
  };

  const handleMapClick = (coord: Coordinate, forceEmpty = false) => {
    if (mode === GameMode.EDIT && activeGame) {
      const activeList = !forceEmpty ? gameState.taskLists.find(l => l.id === sourceListId) : null;
      let newPoint: GamePoint;

      if (activeList) {
        const placedTitles = activeGame.points.map(p => p.title);
        const template = activeList.tasks.find(t => !placedTitles.includes(t.title)) || activeList.tasks[0];
        
        newPoint = {
            id: `pt-${Date.now()}`,
            title: template.title,
            location: coord,
            radiusMeters: 30,
            iconId: template.iconId,
            points: template.points || 100,
            isUnlocked: false,
            isCompleted: false,
            activationTypes: ['radius'],
            order: activeGame.points.length,
            task: { ...template.task },
            feedback: template.feedback,
            settings: template.settings,
            tags: template.tags
        };
      } else {
        newPoint = { 
            id: `pt-${Date.now()}`, 
            title: 'New Task', 
            location: coord, 
            radiusMeters: 30, 
            iconId: 'default', 
            points: 100, 
            isUnlocked: false, 
            isCompleted: false, 
            activationTypes: ['radius'], 
            order: activeGame.points.length, 
            task: { question: 'Task Question?', type: 'text' } 
        };
      }
      
      db.saveGame({...activeGame, points: [...activeGame.points, newPoint]}).then(refreshData);
    }
  };

  const handleSaveGame = () => {
    if (activeGame) {
      db.saveGame(activeGame).then(() => {
        setSaveStatus("GAME SAVED!");
        setTimeout(() => setSaveStatus(null), 3000);
      });
    }
  };

  const handleMarkAll = () => {
    if (!activeGame || activeGame.points.length === 0) return;
    const points = activeGame.points.filter(p => !p.isSectionHeader);
    const avgLat = points.reduce((sum, p) => sum + p.location.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.location.lng, 0) / points.length;
    setMarkedPoints(activeGame.points);
    setOriginalCenter({ lat: avgLat, lng: avgLng });
  };

  const handlePasteAll = () => {
    if (!activeGame || !markedPoints || !originalCenter || !mapRef.current) return;
    const newCenter = mapRef.current.getCenter();
    const latOffset = newCenter.lat - originalCenter.lat;
    const lngOffset = newCenter.lng - originalCenter.lng;
    const updatedPoints = activeGame.points.map(p => p.isSectionHeader ? p : { ...p, location: { lat: p.location.lat + latOffset, lng: p.location.lng + lngOffset } });
    db.saveGame({ ...activeGame, points: updatedPoints }).then(() => { refreshData(); setMarkedPoints(null); setOriginalCenter(null); });
  };

  const convertTemplateToPoint = (t: TaskTemplate, location: Coordinate, order: number): GamePoint => ({
    id: `pt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    title: t.title,
    task: { ...t.task },
    location: location,
    radiusMeters: 30,
    iconId: t.iconId,
    isUnlocked: false,
    isCompleted: false,
    order: order,
    tags: t.tags,
    activationTypes: ['radius'],
    points: t.points || 100,
    feedback: t.feedback,
    settings: t.settings
  });

  const handleAddTasksFromLibrary = (tasks: TaskTemplate[]) => {
    if (!activeGame) return;
    const center = mapRef.current?.getCenter() || { lat: 0, lng: 0 };
    const newPoints = tasks.map((t, i) => convertTemplateToPoint(t, center, activeGame.points.length + i));
    const updatedGame = { ...activeGame, points: [...activeGame.points, ...newPoints] };
    db.saveGame(updatedGame).then(refreshData);
    setIsTaskSelectionMode(false);
    setShowTaskMaster(false);
  };

  const handleAddAiTasks = (tasks: TaskTemplate[]) => {
    if (!activeGame) return;
    const center = mapRef.current?.getCenter() || { lat: 0, lng: 0 };
    const newPoints = tasks.map((t, i) => convertTemplateToPoint(t, center, activeGame.points.length + i));
    const updatedGame = { ...activeGame, points: [...activeGame.points, ...newPoints] };
    tasks.forEach(t => db.saveTemplate(t));
    db.saveGame(updatedGame).then(refreshData);
    setShowAiGenerator(false);
  };

  const activeGame = useMemo(() => {
      return gameState.games.find(g => g.id === gameState.activeGameId);
  }, [gameState.games, gameState.activeGameId]);

  const displayPoints = useMemo(() => {
      if (!activeGame) return [];
      return activeGame.points.map(p => ({
          ...p,
          isUnlocked: unlockedPointIds.includes(p.id) || mode !== GameMode.PLAY,
          isCompleted: completedPointIds.includes(p.id)
      }));
  }, [activeGame, completedPointIds, unlockedPointIds, mode]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[5000] w-full max-sm px-4">
              <div className="bg-red-600/95 backdrop-blur-sm text-white p-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-tight truncate flex-1">{error}</p>
                  <button onClick={() => { setError(null); refreshData(); }} className="p-1 hover:bg-white/20 rounded-full"><X className="w-4 h-4"/></button>
              </div>
          </div>
      )}

      {saveStatus && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[5000] animate-in slide-in-from-top-4 duration-300">
              <div className="bg-green-600/95 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-green-400/50">
                  <CheckCircle className="w-5 h-5" />
                  <p className="text-sm font-black uppercase tracking-widest">{saveStatus}</p>
              </div>
          </div>
      )}

      {showLanding && !bypassWelcome && (
          <LandingPage 
            activeGameName={activeGame?.name}
            onChooseGame={() => setShowGameChooser(true)}
            onAction={(action) => {
                  if (action === 'CREATE') {
                    const name = prompt("ENTER NAME FOR NEW GAME:", "NEW GAME");
                    if (name) {
                        const newGame: Game = { id: `game-${Date.now()}`, name, description: '', points: [], createdAt: Date.now() };
                        db.saveGame(newGame).then(() => { 
                            refreshData(); 
                            setGameState(prev => ({ ...prev, activeGameId: newGame.id }));
                            setMode(GameMode.EDIT); setShowLanding(false); setBypassWelcome(true); setForceExpandDrawer(true);
                        });
                    }
                    return;
                  }
                  setShowLanding(false);
                  if (action !== 'PLAY') setBypassWelcome(true);
                  if (action === 'EDIT') { setMode(GameMode.EDIT); setForceExpandDrawer(true); }
                  if (action === 'TEAM') { setMode(GameMode.INSTRUCTOR); setShowTeamsModal(true); }
                  if (action === 'TASKS') { setMode(GameMode.EDIT); setShowTaskMaster(true); }
                  if (action === 'ADMIN') { setShowAdminModal(true); }
              }} onHome={() => setShowLanding(true)} />
      )}

      {!showLanding && !bypassWelcome && (
          <WelcomeScreen games={gameState.games} userLocation={gameState.userLocation} onStartGame={handleStartGame} onSetMapStyle={setMapStyle} language={appLanguage} onSetLanguage={setAppLanguage} onOpenEditor={() => { setBypassWelcome(true); setMode(GameMode.EDIT); }} onBack={() => setShowLanding(true)} />
      )}

      {bypassWelcome && (
          <>
              <GameMap 
                ref={mapRef} 
                userLocation={gameState.userLocation} 
                points={displayPoints} 
                accuracy={gameState.gpsAccuracy} 
                mode={mode} 
                mapStyle={mapStyle} 
                selectedPointId={selectedPoint?.id} 
                onPointClick={(p) => setSelectedPoint(p)} 
                onPointHover={(p) => mode === GameMode.EDIT && handlePointHover(p)}
                onPointMove={(id, loc) => { if (!activeGame) return; const updatedPoints = activeGame.points.map(p => p.id === id ? { ...p, location: loc } : p); db.saveGame({ ...activeGame, points: updatedPoints }).then(refreshData); }} 
                onDeletePoint={(id) => { if (!activeGame) return; const updatedPoints = activeGame.points.filter(p => p.id !== id); db.saveGame({ ...activeGame, points: updatedPoints }).then(refreshData); }} 
                onMapClick={handleMapClick} 
              />
              <GameHUD accuracy={gameState.gpsAccuracy} mode={mode} toggleMode={() => setMode(mode === GameMode.PLAY ? GameMode.EDIT : mode === GameMode.EDIT ? GameMode.INSTRUCTOR : GameMode.PLAY)} onOpenGameManager={() => setShowGameManager(true)} onOpenTaskMaster={() => { setIsTaskSelectionMode(false); setShowTaskMaster(true); }} onOpenTeams={() => setShowTeamsModal(true)} mapStyle={mapStyle} onSetMapStyle={setMapStyle} language={appLanguage} onBackToHub={() => { setBypassWelcome(false); setShowLanding(true); }} activeGameName={activeGame?.name} onOpenInstructorDashboard={() => { if (activeGame) { setInstructorGame(activeGame); setShowInstructorDashboard(true); } }} />
              
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 h-12 pointer-events-auto">
                  {mode !== GameMode.EDIT && (
                    <button onClick={() => setShowGameChooser(true)} className="h-12 bg-orange-600 hover:bg-orange-700 text-white px-5 rounded-2xl shadow-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 border border-white/10 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest max-w-[80px] sm:max-w-[150px] truncate leading-none">{activeGame?.name || "SELECT"}</span>
                        <ChevronDown className="w-4 h-4 opacity-50" />
                    </button>
                  )}
                  <LocationSearch onSelectLocation={(coord) => mapRef.current?.jumpTo(coord)} onLocateMe={() => { if (gameState.userLocation) mapRef.current?.jumpTo(gameState.userLocation); else alert("Waiting for GPS..."); }} onFitBounds={handleFitBounds} />
              </div>

              {mode === GameMode.EDIT && (
                <>
                    <div className="absolute bottom-6 left-4 z-[2000] pointer-events-auto flex flex-col-reverse items-start gap-3">
                        <button onClick={() => setShowAddMenu(!showAddMenu)} className={`h-14 w-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-white/10 ${showAddMenu ? 'bg-slate-900 text-white' : 'bg-orange-600 text-white'}`}>{showAddMenu ? <X className="w-8 h-8" /> : <Plus className="w-8 h-8" />}</button>
                        {showAddMenu && (
                          <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300">
                             <button onClick={() => { if(!activeGame) { setShowGameChooser(true); setShowAddMenu(false); return; } setIsTaskSelectionMode(true); setShowTaskMaster(true); setShowAddMenu(false); }} className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-3 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors group"><div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Library className="w-5 h-5" /></div><span className="font-black text-[10px] uppercase tracking-widest">Add Task from Tasklist</span></button>
                             <button onClick={() => { if(!activeGame) { setShowGameChooser(true); setShowAddMenu(false); return; } setShowAiGenerator(true); setShowAddMenu(false); }} className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-3 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors group"><div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors"><Sparkles className="w-5 h-5" /></div><span className="font-black text-[10px] uppercase tracking-widest">Add AI Task</span></button>
                             <button onClick={() => handleAddTaskAtCenter(true)} className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-3 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors group"><div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><FilePlus className="w-5 h-5" /></div><span className="font-black text-[10px] uppercase tracking-widest">Add New Empty Task</span></button>
                          </div>
                        )}
                    </div>
                    {activeGame && activeGame.points.length > 0 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2000] flex gap-3 pointer-events-auto">
                            <button onClick={handleMarkAll} className={`h-12 px-6 rounded-2xl font-black uppercase tracking-widest transition-all border shadow-2xl ${markedPoints ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-indigo-100 dark:bg-gray-800 dark:text-indigo-400'}`}><Copy className="w-4 h-4 mr-2 inline" /> {markedPoints ? "MARKED" : "MARK ALL"}</button>
                            {markedPoints && <button onClick={handlePasteAll} className="h-12 px-8 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-green-700 shadow-2xl animate-pulse"><ClipboardPaste className="w-5 h-5 mr-2 inline" /> PASTE HERE</button>}
                        </div>
                    )}
                </>
              )}

              {mode === GameMode.EDIT && (
                <EditorDrawer 
                  onClose={() => setMode(GameMode.PLAY)} 
                  activeGame={activeGame}
                  activeGameName={activeGame?.name || "No game selected"} 
                  points={displayPoints} 
                  allPoints={displayPoints} 
                  taskLists={gameState.taskLists} 
                  games={gameState.games}
                  onSelectGame={(id) => setGameState(prev => ({ ...prev, activeGameId: id }))}
                  onOpenGameChooser={() => setShowGameChooser(true)}
                  sourceListId={sourceListId} 
                  onSetSourceListId={setSourceListId} 
                  onEditPoint={(p) => setSelectedPoint(p)} 
                  onSelectPoint={(p) => { setSelectedPoint(p); mapRef.current?.jumpTo(p.location); }} 
                  onDeletePoint={(id) => { if(!activeGame) return; const updated = activeGame.points.filter(p => p.id !== id); db.saveGame({...activeGame, points: updated}).then(refreshData); }} 
                  onReorderPoints={(pts) => { if(!activeGame) return; db.saveGame({...activeGame, points: pts}).then(refreshData) }} 
                  onClearMap={() => { if(!activeGame) return; db.saveGame({...activeGame, points: []}).then(refreshData) }} 
                  onSaveGame={handleSaveGame} 
                  onOpenTaskMaster={() => { setIsTaskSelectionMode(false); setShowTaskMaster(true); }} 
                  onFitBounds={handleFitBounds} 
                  onHoverPoint={handlePointHover}
                  initialExpanded={forceExpandDrawer}
                />
              )}
              {mode === GameMode.PLAY && activeGame && <GameStats score={gameState.score} pointsCount={{ total: displayPoints.filter(p => !p.isSectionHeader).length, completed: completedPointIds.length }} nearestPointDistance={null} language={appLanguage} />}
              {selectedPoint && (
                  <TaskModal 
                    point={displayPoints.find(p => p.id === selectedPoint.id) || selectedPoint} 
                    onClose={() => setSelectedPoint(null)} 
                    onComplete={(pointId) => { 
                        if (!activeGame || !gameState.teamId) return;
                        const newScore = gameState.score + (selectedPoint.points || 0);
                        setCompletedPointIds(prev => [...prev, pointId]);
                        setGameState(prev => ({ ...prev, score: newScore }));
                        db.updateTeamProgress(gameState.teamId, pointId, newScore);
                    }} 
                    distance={gameState.userLocation && selectedPoint ? haversineMeters(gameState.userLocation, selectedPoint.location) : 0} 
                    isInstructorMode={mode === GameMode.INSTRUCTOR} 
                  />
              )}
              {hoveredPoint && (
                <TaskPreview 
                  point={hoveredPoint} 
                  onEdit={() => { setSelectedPoint(hoveredPoint); setHoveredPoint(null); }} 
                  onDelete={() => { if (confirm('Delete task?')) { const updated = activeGame?.points.filter(p => p.id !== hoveredPoint.id) || []; if (activeGame) db.saveGame({...activeGame, points: updated}).then(refreshData); setHoveredPoint(null); } }} 
                  onClose={() => setHoveredPoint(null)}
                />
              )}
          </>
      )}

      {/* GLOBAL MODALS */}
      {showInstructorDashboard && instructorGame && <InstructorDashboard game={instructorGame} onClose={() => setShowInstructorDashboard(false)} />}
      {showGameChooser && <GameChooser games={gameState.games} taskLists={gameState.taskLists} onClose={() => setShowGameChooser(false)} onSelectGame={(id) => { setGameState(prev => ({ ...prev, activeGameId: id })); setShowGameChooser(false); }} onCreateGame={(name) => { const newGame: Game = { id: `game-${Date.now()}`, name, description: '', points: [], createdAt: Date.now() }; db.saveGame(newGame).then(() => { refreshData(); setGameState(prev => ({ ...prev, activeGameId: newGame.id })); setShowGameChooser(false); }); }} />}
      {showTaskMaster && <TaskMaster library={gameState.taskLibrary} lists={gameState.taskLists} onClose={() => { setShowTaskMaster(false); setIsTaskSelectionMode(false); }} onSaveTemplate={(t) => db.saveTemplate(t).then(refreshData)} onDeleteTemplate={(id) => db.deleteTemplate(id).then(refreshData)} onSaveList={(l) => db.saveTaskList(l).then(refreshData)} onDeleteList={(id) => db.deleteTaskList(id).then(refreshData)} onCreateGameFromList={() => {}} isSelectionMode={isTaskSelectionMode} onSelectTasksForGame={handleAddTasksFromLibrary} />}
      {showAiGenerator && <AiTaskGenerator onClose={() => setShowAiGenerator(false)} onAddTasks={handleAddAiTasks} />}
      {showTeamsModal && <TeamsModal gameId={gameState.activeGameId} games={gameState.games} onSelectGame={(id) => setGameState(prev => ({ ...prev, activeGameId: id }))} onClose={() => setShowTeamsModal(false)} />}
      {showAdminModal && <AdminModal games={gameState.games} onClose={() => setShowAdminModal(false)} onDeleteGame={(id) => db.deleteGame(id).then(refreshData)} />}
      {currentChatMessage && <MessagePopup message={currentChatMessage.message} sender={currentChatMessage.sender} onClose={() => setCurrentChatMessage(null)} />}
    </div>
  );
};

export default App;
