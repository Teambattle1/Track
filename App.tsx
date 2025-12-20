
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import GameMap from './components/GameMap';
import TaskModal from './components/TaskModal';
import GameHUD from './components/GameHUD';
import GameStats from './components/GameStats';
import GameManager from './components/GameManager';
import TaskEditor from './components/TaskEditor';
import GameChooser from './components/GameChooser';
import TaskPreview from './components/TaskPreview';
import TaskMaster from './components/TaskMaster';
import TaskPlaylistModal from './components/TaskPlaylistModal';
import AiTaskGenerator from './components/AiTaskGenerator';
import WelcomeScreen from './components/WelcomeScreen';
import ResultsView from './components/ResultsView';
import LandingPage from './components/LandingPage';
import TeamsModal from './components/TeamsModal';
import CreatorDrawer from './components/CreatorDrawer';
import EditorDrawer from './components/EditorDrawer';
import AdminModal from './components/AdminModal'; 
import PointContextMenu from './components/PointContextMenu'; // NEW
import TaskActionModal from './components/TaskActionModal'; // NEW
import { GamePoint, Coordinate, GameState, GameMode, Game, TaskTemplate, TaskList, MapStyleId, Language } from './types';
import { haversineMeters, isWithinRadius } from './utils/geo';
import { Loader2 } from 'lucide-react';
import * as db from './services/db';
import { teamSync } from './services/teamSync';
import { seedTeams } from './utils/demoContent';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    activeGameId: null,
    games: [],
    taskLibrary: [],
    taskLists: [],
    score: 0,
    userLocation: null,
    gpsAccuracy: null,
    deviceId: teamSync.getDeviceId(),
  });

  const [mode, setMode] = useState<GameMode>(GameMode.PLAY);
  const [mapStyle, setMapStyle] = useState<MapStyleId>('osm'); 
  const [appLanguage, setAppLanguage] = useState<Language>('English');
  
  // Selection States
  const [selectedPoint, setSelectedPoint] = useState<GamePoint | null>(null);
  const [editingPoint, setEditingPoint] = useState<GamePoint | null>(null);
  const [selectedPointForMenu, setSelectedPointForMenu] = useState<GamePoint | null>(null); // NEW: For Context Menu
  const [pointForAction, setPointForAction] = useState<GamePoint | null>(null); // NEW: For Action Modal
  
  // Modal/Drawer States
  const [activeDrawer, setActiveDrawer] = useState<'CREATOR' | 'EDITOR' | 'NONE'>('NONE');
  const [showGameChooser, setShowGameChooser] = useState(false);
  const [showTaskMaster, setShowTaskMaster] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showGameManager, setShowGameManager] = useState(false); 
  const [showAdminModal, setShowAdminModal] = useState(false); 

  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  
  // New: Source List for Quick Placing
  const [placingSourceListId, setPlacingSourceListId] = useState<string>('');

  // Selection Mode State (Swap from Library)
  const [isSwapMode, setIsSwapMode] = useState(false); // New state to track if we are swapping
  
  // Nav State
  const [showLanding, setShowLanding] = useState(true);
  const [bypassWelcome, setBypassWelcome] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data Fetching Function
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
        const [games, library, lists] = await Promise.all([
            db.fetchGames(),
            db.fetchLibrary(),
            db.fetchTaskLists()
        ]);
        
        const totalScore = games.reduce((acc, game) => {
            const gameScore = game.points
                .filter(p => p.isCompleted)
                .reduce((sum, p) => sum + (p.points || 100), 0);
            return acc + gameScore;
        }, 0);

        // PERSISTENCE CHECK: Restore last active game if valid
        const lastGameId = localStorage.getItem('geohunt_last_game_id');
        let restoredActiveId = null;
        if (lastGameId && games.find(g => g.id === lastGameId)) {
            restoredActiveId = lastGameId;
        }

        setGameState(prev => ({ 
            ...prev, 
            activeGameId: prev.activeGameId || restoredActiveId, // Use existing if set, else restore
            games: games,
            taskLibrary: library,
            taskLists: lists,
            score: totalScore
        }));
        
        // If we restored a game, hide landing
        if (restoredActiveId && !gameState.activeGameId) {
            setShowLanding(false);
        }

    } catch (e) {
        console.error("Failed to load data", e);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // PERSISTENCE SAVE: Save game ID whenever it changes
  useEffect(() => {
      if (gameState.activeGameId) {
          localStorage.setItem('geohunt_last_game_id', gameState.activeGameId);
      }
  }, [gameState.activeGameId]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const userLoc: Coordinate = { lat: latitude, lng: longitude };

        setGameState(prev => {
          let currentGames = prev.games;
          const activeGameIndex = currentGames.findIndex(g => g.id === prev.activeGameId);
          let newGames = [...currentGames];
          let updated = false;

          if (activeGameIndex !== -1 && mode === GameMode.PLAY) {
             const activeGame = newGames[activeGameIndex];
             const updatedPoints = activeGame.points.map(p => {
                if (p.isUnlocked) return p;
                if (isWithinRadius(userLoc, p.location, p.radiusMeters)) {
                   updated = true;
                   return { ...p, isUnlocked: true };
                }
                return p;
             });
             
             if (updated) {
                 newGames[activeGameIndex] = { ...activeGame, points: updatedPoints };
                 db.saveGame(newGames[activeGameIndex]);
             }
          }

          return {
            ...prev,
            games: newGames,
            userLocation: userLoc,
            gpsAccuracy: accuracy,
          };
        });
        
        if(loading && gameState.games.length > 0) setLoading(false);
      },
      (err) => {
        console.error(err);
        if (gameState.userLocation) return;
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [mode, loading, gameState.games.length]); 

  // Derived State
  const activeGame = gameState.games.find(g => g.id === gameState.activeGameId);
  const activePoints = activeGame ? activeGame.points : [];

  const selectedDistance = useMemo(() => {
    if (!gameState.userLocation || !selectedPoint) return 0;
    return haversineMeters(gameState.userLocation, selectedPoint.location);
  }, [gameState.userLocation, selectedPoint]);

  const nearestPointDistance = useMemo(() => {
    if (!gameState.userLocation || activePoints.length === 0) return null;
    const incomplete = activePoints.filter(p => !p.isCompleted);
    if (incomplete.length === 0) return null;
    return Math.min(...incomplete.map(p => haversineMeters(gameState.userLocation!, p.location)));
  }, [gameState.userLocation, activePoints]);

  const activeGameScore = useMemo(() => {
      if(!activeGame) return 0;
      return activeGame.points.filter(p => p.isCompleted).reduce((sum, p) => sum + (p.points || 100), 0);
  }, [activeGame]);

  const pointsCount = useMemo(() => ({
      total: activePoints.filter(p => !p.isSectionHeader).length,
      completed: activePoints.filter(p => p.isCompleted).length
  }), [activePoints]);

  // --- ACTIONS ---

  const handleBackToHub = useCallback(() => {
      setGameState(prev => ({ ...prev, activeGameId: null }));
      localStorage.removeItem('geohunt_last_game_id'); // Clear persistence on explicit exit
      setShowLanding(true);
      setActiveDrawer('NONE');
      setShowGameChooser(false);
      setShowTaskMaster(false);
      setShowTeamsModal(false);
      setShowPlaylistModal(false);
      setShowAiGenerator(false);
      setShowAdminModal(false);
      setMode(GameMode.PLAY);
      setBypassWelcome(false); 
  }, []);

  const handleHomeFromHub = useCallback(() => {
      // Go back to "Player View" (Welcome Screen)
      setShowLanding(false);
      setBypassWelcome(false);
      setGameState(prev => ({ ...prev, activeGameId: null }));
      localStorage.removeItem('geohunt_last_game_id');
  }, []);

  // Landing Page Action Handler
  const handleLandingAction = (action: 'CREATE' | 'EDIT' | 'TEAM' | 'TASKS' | 'ADMIN') => {
      setShowLanding(false);
      setBypassWelcome(true);
      
      switch(action) {
          case 'CREATE':
              setActiveDrawer('CREATOR');
              setMode(GameMode.EDIT);
              break;
          case 'EDIT':
              // If we already have an active game from persistence, go straight to Editor
              if (gameState.activeGameId) {
                  setActiveDrawer('EDITOR');
              } else {
                  setShowGameChooser(true);
              }
              setMode(GameMode.EDIT);
              break;
          case 'TEAM':
              // Inject demo data if empty
              if (gameState.games.length > 0 && gameState.activeGameId) {
                  seedTeams(gameState.activeGameId);
              }
              setShowTeamsModal(true);
              setMode(GameMode.PLAY);
              break;
          case 'TASKS':
              setShowTaskMaster(true);
              break;
          case 'ADMIN':
              setShowAdminModal(true);
              break;
      }
  };

  const handleCreateGame = async (name: string, fromTaskListId?: string, description?: string, mapStyle?: MapStyleId) => {
     const newGame: Game = {
        id: `game-${Date.now()}`,
        name,
        description: description || '',
        points: [],
        createdAt: Date.now(),
        defaultMapStyle: mapStyle || 'osm'
     };
     
     if (fromTaskListId) {
         const list = gameState.taskLists.find(l => l.id === fromTaskListId);
         if (list) {
             newGame.points = list.tasks.map((t, i) => ({
                 id: `point-${Date.now()}-${i}`,
                 title: t.title,
                 task: t.task,
                 location: gameState.userLocation || { lat: 0, lng: 0 },
                 radiusMeters: 30,
                 activationTypes: ['radius'],
                 iconId: t.iconId,
                 points: t.points || 100,
                 isUnlocked: false,
                 isCompleted: false,
                 order: i,
                 tags: t.tags,
                 feedback: t.feedback,
                 settings: t.settings,
                 logic: t.logic // Preserve logic from templates
             }));
         }
     }
     await db.saveGame(newGame);
     await refreshData();
     setGameState(prev => ({ ...prev, activeGameId: newGame.id }));
     setMode(GameMode.EDIT);
     setActiveDrawer('EDITOR');
     setShowGameChooser(false);
  };

  const handleSelectGame = (id: string) => {
      setGameState(prev => ({ ...prev, activeGameId: id }));
      setShowGameChooser(false);
      setShowTeamsModal(false);
      // Determine if we should go to Editor or Play based on current context
      if (mode === GameMode.EDIT) {
          setActiveDrawer('EDITOR');
      }
  };

  const handleSwapTask = (templates: TaskTemplate[]) => {
      if (selectedPointForMenu && activeGame && templates.length > 0) {
          const t = templates[0]; // Take the first selection
          const updatedPoint = {
              ...selectedPointForMenu,
              title: t.title,
              task: t.task,
              iconId: t.iconId,
              tags: t.tags,
              feedback: t.feedback,
              settings: t.settings,
              logic: t.logic
          };
          
          const updatedPoints = activeGame.points.map(p => p.id === selectedPointForMenu.id ? updatedPoint : p);
          db.saveGame({ ...activeGame, points: updatedPoints });
          refreshData();
          setIsSwapMode(false);
          setSelectedPointForMenu(null); // Close menu
      }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 relative">
      {/* Logic to render correct screen */}
      {showLanding ? (
        <LandingPage onAction={handleLandingAction} onHome={handleHomeFromHub} />
      ) : (!gameState.activeGameId && !bypassWelcome && mode === GameMode.PLAY) ? (
        <WelcomeScreen 
            games={gameState.games}
            userLocation={gameState.userLocation}
            onStartGame={(gameId, team, user, style) => {
                setGameState(prev => ({ 
                    ...prev, 
                    activeGameId: gameId, 
                    teamName: team, 
                    userName: user,
                    score: 0 // Reset local score view, actual score syncs via DB/TeamSync
                }));
                setMapStyle(style);
                setBypassWelcome(true);
            }}
            onSetMapStyle={setMapStyle}
            language={appLanguage}
            onSetLanguage={setAppLanguage}
            onOpenEditor={() => {
                setMode(GameMode.EDIT);
                setBypassWelcome(true);
                handleLandingAction('EDIT');
            }}
            onBack={() => setShowLanding(true)}
        />
      ) : (
        <>
            <GameMap 
                userLocation={gameState.userLocation}
                points={activePoints}
                accuracy={gameState.gpsAccuracy}
                mode={mode}
                mapStyle={mapStyle}
                selectedPointId={selectedPoint?.id || selectedPointForMenu?.id || editingPoint?.id}
                onPointClick={(p) => {
                    if (mode === GameMode.EDIT) {
                        setSelectedPointForMenu(p);
                    } else {
                        setSelectedPoint(p);
                    }
                }}
                onMapClick={(coord) => {
                     if (mode === GameMode.EDIT) {
                        // Create point logic
                        const newPoint: GamePoint = {
                            id: `point-${Date.now()}`,
                            title: 'New Task',
                            task: { type: 'text', question: 'Edit this task...' },
                            location: coord,
                            radiusMeters: 30,
                            activationTypes: ['radius'],
                            iconId: 'default',
                            points: 100,
                            isUnlocked: false,
                            isCompleted: false,
                            order: activePoints.length,
                            tags: []
                        };
                        
                        // If using a source list, try to pop from it
                        if (placingSourceListId) {
                            const list = gameState.taskLists.find(l => l.id === placingSourceListId);
                            if (list) {
                                // Find first unused task
                                const usedTitles = activePoints.map(p => p.title);
                                const available = list.tasks.find(t => !usedTitles.includes(t.title));
                                if (available) {
                                    newPoint.title = available.title;
                                    newPoint.task = available.task;
                                    newPoint.iconId = available.iconId;
                                    newPoint.tags = available.tags;
                                    newPoint.feedback = available.feedback;
                                    newPoint.settings = available.settings;
                                    newPoint.logic = available.logic;
                                    newPoint.points = available.points || 100;
                                }
                            }
                        }

                        // Save
                        if (activeGame) {
                            const updatedGame = { ...activeGame, points: [...activeGame.points, newPoint] };
                            db.saveGame(updatedGame);
                            refreshData();
                        }
                     }
                }}
                onPointMove={(id, loc) => {
                    if (activeGame) {
                        const updated = activeGame.points.map(p => p.id === id ? { ...p, location: loc } : p);
                        db.saveGame({ ...activeGame, points: updated });
                        refreshData(); // Optimistic update ideally
                    }
                }}
                onDeletePoint={(id) => {
                    if (activeGame) {
                         const updated = activeGame.points.filter(p => p.id !== id);
                         db.saveGame({ ...activeGame, points: updated });
                         refreshData();
                    }
                }}
            />

            <GameHUD 
                accuracy={gameState.gpsAccuracy}
                mode={mode}
                toggleMode={() => setMode(prev => {
                     if (prev === GameMode.PLAY) return GameMode.INSTRUCTOR;
                     if (prev === GameMode.INSTRUCTOR) return GameMode.EDIT;
                     return GameMode.PLAY;
                })}
                onOpenGameChooser={() => setShowGameChooser(true)}
                onOpenGameManager={() => setShowGameManager(true)}
                onOpenTaskMaster={() => setShowTaskMaster(true)}
                onOpenTeams={() => setShowTeamsModal(true)}
                mapStyle={mapStyle}
                onSetMapStyle={setMapStyle}
                language={appLanguage}
                onBackToHub={handleBackToHub}
                activeGameName={activeGame?.name}
            />

            {activeGame && (
                <GameStats 
                    score={activeGameScore}
                    pointsCount={pointsCount}
                    nearestPointDistance={nearestPointDistance}
                    language={appLanguage}
                />
            )}

            {/* Modals & Drawers */}
            {selectedPoint && (
                <TaskModal 
                    point={selectedPoint}
                    onClose={() => setSelectedPoint(null)}
                    onComplete={(id, answer) => {
                        if (activeGame) {
                            // Update game state locally and DB
                            const updatedPoints = activeGame.points.map(p => p.id === id ? { ...p, isCompleted: true } : p);
                            const updatedGame = { ...activeGame, points: updatedPoints };
                            db.saveGame(updatedGame);
                            refreshData();
                            
                            // Check for game completion
                            if (updatedPoints.every(p => p.isCompleted || p.isSectionHeader)) {
                                setShowResults(true);
                            }
                        }
                    }}
                    distance={selectedDistance}
                    isInstructorMode={mode === GameMode.INSTRUCTOR}
                />
            )}

            {showGameChooser && (
                <GameChooser 
                    games={gameState.games}
                    taskLists={gameState.taskLists}
                    onSelectGame={handleSelectGame}
                    onCreateGame={handleCreateGame}
                    onClose={() => setShowGameChooser(false)}
                    onSaveAsTemplate={(id, name) => {
                         const g = gameState.games.find(g => g.id === id);
                         if(g) {
                             const newList: TaskList = {
                                 id: `list-${Date.now()}`,
                                 name: name,
                                 description: g.description,
                                 tasks: g.points.map(p => ({
                                     id: `tpl-${p.id}`,
                                     title: p.title,
                                     task: p.task,
                                     tags: p.tags || [],
                                     iconId: p.iconId,
                                     createdAt: Date.now(),
                                     points: p.points,
                                     feedback: p.feedback,
                                     settings: p.settings,
                                     logic: p.logic
                                 })),
                                 color: '#3b82f6',
                                 createdAt: Date.now()
                             };
                             db.saveTaskList(newList);
                             refreshData();
                         }
                    }}
                    onRefresh={refreshData}
                />
            )}

            {/* Task Master / Swap Modal */}
            {showTaskMaster && (
                <TaskMaster 
                    library={gameState.taskLibrary}
                    lists={gameState.taskLists}
                    onClose={() => { setShowTaskMaster(false); setIsSwapMode(false); }}
                    onSaveTemplate={(t) => { db.saveTemplate(t); refreshData(); }}
                    onDeleteTemplate={(id) => { db.deleteTemplate(id); refreshData(); }}
                    onSaveList={(l) => { db.saveTaskList(l); refreshData(); }}
                    onDeleteList={(id) => { db.deleteTaskList(id); refreshData(); }}
                    onCreateGameFromList={(listId) => {
                        const list = gameState.taskLists.find(l => l.id === listId);
                        if (list) handleCreateGame(list.name, listId);
                    }}
                    isSelectionMode={isSwapMode}
                    onSelectTasksForGame={(tasks) => {
                        if (isSwapMode) handleSwapTask(tasks);
                    }}
                />
            )}
            
            {showAdminModal && (
                <AdminModal 
                    games={gameState.games}
                    onClose={() => setShowAdminModal(false)}
                    onDeleteGame={(id) => { db.deleteGame(id); refreshData(); }}
                />
            )}

            {/* Point Context Menu (Edit Mode) */}
            {selectedPointForMenu && (
                <PointContextMenu 
                    point={selectedPointForMenu}
                    onEdit={() => {
                        setEditingPoint(selectedPointForMenu);
                        setSelectedPointForMenu(null);
                    }}
                    onSwap={() => {
                        setIsSwapMode(true);
                        setShowTaskMaster(true);
                        // Menu closes when TaskMaster opens/closes
                    }}
                    onAction={() => {
                        setPointForAction(selectedPointForMenu);
                        setSelectedPointForMenu(null);
                    }}
                    onClose={() => setSelectedPointForMenu(null)}
                />
            )}

            {/* Action Logic Editor */}
            {pointForAction && activeGame && (
                <TaskActionModal 
                    point={pointForAction}
                    allPoints={activeGame.points}
                    onSave={(updatedPoint) => {
                        const updated = activeGame.points.map(p => p.id === updatedPoint.id ? updatedPoint : p);
                        db.saveGame({ ...activeGame, points: updated });
                        refreshData();
                        setPointForAction(null);
                    }}
                    onClose={() => setPointForAction(null)}
                />
            )}

            {/* Editor Drawers */}
            {activeDrawer === 'CREATOR' && (
                <CreatorDrawer 
                    onClose={() => setActiveDrawer('NONE')}
                    onCreateGame={() => { setActiveDrawer('NONE'); setShowGameChooser(true); /* trigger create mode */ }}
                    onCreateTask={() => { setActiveDrawer('NONE'); setShowTaskMaster(true); }}
                    onCreateList={() => { setActiveDrawer('NONE'); setShowTaskMaster(true); }}
                />
            )}

            {activeDrawer === 'EDITOR' && activeGame && (
                <EditorDrawer 
                    onClose={() => setActiveDrawer('NONE')}
                    activeGameName={activeGame.name}
                    points={activePoints}
                    taskLists={gameState.taskLists}
                    sourceListId={placingSourceListId}
                    selectedPointId={editingPoint?.id}
                    onSetSourceListId={setPlacingSourceListId}
                    onEditPoint={(p) => setSelectedPointForMenu(p)} // Changed to open menu
                    onSelectPoint={(p) => { 
                         // Center map logic could go here
                         setSelectedPointForMenu(p); // Open menu instead of direct edit
                    }}
                    onDeletePoint={(id) => {
                         const updated = activeGame.points.filter(p => p.id !== id);
                         db.saveGame({ ...activeGame, points: updated });
                         refreshData();
                    }}
                    onReorderPoints={(pts) => {
                        db.saveGame({ ...activeGame, points: pts });
                        refreshData();
                    }}
                    onClearMap={() => {
                        if(confirm('Delete all points?')) {
                             db.saveGame({ ...activeGame, points: [] });
                             refreshData();
                        }
                    }}
                    onSaveGame={() => {
                        db.saveGame(activeGame);
                        alert('Game Saved');
                    }}
                    onOpenTaskMaster={() => setShowTaskMaster(true)}
                />
            )}
            
            {editingPoint && (
                <TaskEditor 
                    point={editingPoint}
                    onSave={(p) => {
                        if (activeGame) {
                            const updated = activeGame.points.map(pt => pt.id === p.id ? p : pt);
                            db.saveGame({ ...activeGame, points: updated });
                            refreshData();
                            setEditingPoint(null);
                        }
                    }}
                    onDelete={(id) => {
                        if (activeGame) {
                             const updated = activeGame.points.filter(pt => pt.id !== id);
                             db.saveGame({ ...activeGame, points: updated });
                             refreshData();
                             setEditingPoint(null);
                        }
                    }}
                    onClose={() => setEditingPoint(null)}
                    onClone={(p) => {
                         // Clone logic
                         if (activeGame) {
                             const newP = { ...p, id: `point-${Date.now()}`, title: `${p.title} (Copy)`, location: { ...p.location, lat: p.location.lat + 0.0001 } };
                             db.saveGame({ ...activeGame, points: [...activeGame.points, newP] });
                             refreshData();
                             setEditingPoint(null);
                         }
                    }}
                />
            )}

             {showTeamsModal && (
                 <TeamsModal 
                    gameId={gameState.activeGameId} 
                    games={gameState.games} 
                    onSelectGame={handleSelectGame}
                    onClose={() => setShowTeamsModal(false)} 
                 />
             )}
        </>
      )}
    </div>
  );
};

export default App;
