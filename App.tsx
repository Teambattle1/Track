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
import { GamePoint, Coordinate, GameState, GameMode, Game, TaskTemplate, TaskList, MapStyleId, Language } from './types';
import { haversineMeters, isWithinRadius } from './utils/geo';
import { Loader2 } from 'lucide-react';
import * as db from './services/db';
import { teamSync } from './services/teamSync'; // Import sync service

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    activeGameId: null,
    games: [],
    taskLibrary: [],
    taskLists: [],
    score: 0,
    userLocation: null,
    gpsAccuracy: null,
    deviceId: teamSync.getDeviceId(), // Initialize ID
  });

  const [mode, setMode] = useState<GameMode>(GameMode.PLAY);
  // Map Style State
  const [mapStyle, setMapStyle] = useState<MapStyleId>('osm'); 
  const [appLanguage, setAppLanguage] = useState<Language>('English');
  
  // Selection States
  const [selectedPoint, setSelectedPoint] = useState<GamePoint | null>(null);
  const [editingPoint, setEditingPoint] = useState<GamePoint | null>(null);
  const [showGameManager, setShowGameManager] = useState(false);
  const [showGameChooser, setShowGameChooser] = useState(false);
  const [showTaskMaster, setShowTaskMaster] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  
  // New States for Advanced Features
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  // New: Source List for Quick Placing
  const [placingSourceListId, setPlacingSourceListId] = useState<string>('');

  // Selection Mode State (Add from Library to Game)
  const [isTaskMasterSelectionMode, setIsTaskMasterSelectionMode] = useState(false);

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
        
        // Recalculate Score from completed tasks in all games
        const totalScore = games.reduce((acc, game) => {
            const gameScore = game.points
                .filter(p => p.isCompleted)
                .reduce((sum, p) => sum + (p.points || 100), 0);
            return acc + gameScore;
        }, 0);

        setGameState(prev => ({ 
            ...prev, 
            games: games,
            taskLibrary: library,
            taskLists: lists,
            score: totalScore
        }));
    } catch (e) {
        console.error("Failed to load data", e);
    } finally {
        setLoading(false);
    }
  }, []);

  // Initialization Effect
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // GPS Tracking
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

          // Check unlocks
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
                 // IMPORTANT: We only update the local state for responsiveness.
                 // We should persist this unlock to the DB.
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
        
        // Ensure loading is off after first position if data is loaded
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
    
    return Math.min(...incomplete.map(p => 
      haversineMeters(gameState.userLocation!, p.location)
    ));
  }, [gameState.userLocation, activePoints]);

  const activeGameScore = useMemo(() => {
      if(!activeGame) return 0;
      return activeGame.points.filter(p => p.isCompleted).reduce((sum, p) => sum + (p.points || 100), 0);
  }, [activeGame]);

  const activeGameTotalPossible = useMemo(() => {
      if(!activeGame) return 0;
      return activeGame.points.filter(p => !p.isSectionHeader).reduce((sum, p) => sum + (p.points || 100), 0);
  }, [activeGame]);

  const pointsCount = useMemo(() => ({
      total: activePoints.filter(p => !p.isSectionHeader).length,
      completed: activePoints.filter(p => p.isCompleted).length
  }), [activePoints]);

  // Handlers

  // Landing Page Handlers
  const handleLandingPlay = () => {
      setShowLanding(false);
      setBypassWelcome(false); 
      setMode(GameMode.PLAY);
  };

  const handleLandingCreate = () => {
      setShowLanding(false);
      setBypassWelcome(true);
      setMode(GameMode.EDIT);
      setShowGameManager(true);
      // Optional: Could trigger create modal directly here if GameManager supported a prop for it
  };

  const handleLandingEdit = () => {
      setShowLanding(false);
      setBypassWelcome(true);
      setMode(GameMode.EDIT);
      setShowGameManager(true);
  };

  const handleStartGame = (gameId: string, teamName: string, userName: string, _ignoredMapStyle: MapStyleId) => {
      const game = gameState.games.find(g => g.id === gameId);
      const styleToUse = game?.defaultMapStyle || 'osm';
      
      setGameState(prev => ({ ...prev, activeGameId: gameId, teamName, userName }));
      setMapStyle(styleToUse);
      setMode(GameMode.PLAY);
      
      // Initialize Sync with Player Name
      teamSync.connect(gameId, teamName, userName);
  };

  const handleCreateGame = (name: string, fromTaskListId?: string, description?: string, mapStyle: MapStyleId = 'osm') => {
    let initialPoints: GamePoint[] = [];

    // If creating from a TaskList, generate points around the user
    if (fromTaskListId) {
        const list = gameState.taskLists.find(l => l.id === fromTaskListId);
        if (list && list.tasks.length > 0) {
             const center = gameState.userLocation || { lat: 55.6761, lng: 12.5683 };
             initialPoints = list.tasks.map((tpl, i) => {
                 const r = 500 * Math.sqrt(Math.random()); 
                 const theta = Math.random() * 2 * Math.PI;
                 const dLat = (r * Math.cos(theta)) / 111320;
                 const dLng = (r * Math.sin(theta)) / (111320 * Math.cos(center.lat * Math.PI / 180));

                 return {
                     id: `${Date.now()}-pt-${i}`,
                     title: tpl.title,
                     task: tpl.task,
                     location: { lat: center.lat + dLat, lng: center.lng + dLng },
                     radiusMeters: 30,
                     iconId: tpl.iconId,
                     isUnlocked: false,
                     isCompleted: false,
                     order: i,
                     tags: tpl.tags,
                     activationTypes: ['radius'],
                     points: tpl.points || 100,
                 };
             });
        }
    }

    const newGame: Game = {
      id: `game-${Date.now()}`,
      name,
      description: description || '',
      points: initialPoints,
      createdAt: Date.now(),
      defaultMapStyle: mapStyle
    };
    
    db.saveGame(newGame); // Persist

    setGameState(prev => ({
      ...prev,
      games: [...prev.games, newGame],
      activeGameId: newGame.id
    }));
    
    // Set map style for editing immediately
    setMapStyle(mapStyle);
    
    // CRITICAL FIX: If created from a list, set that list as the placing source
    // This restricts accidental "New Task" creation and encourages placing from the list.
    if (fromTaskListId) {
        setPlacingSourceListId(fromTaskListId);
    } else {
        setPlacingSourceListId('');
    }
    
    setMode(GameMode.EDIT);
    setShowGameManager(true);
    setShowGameChooser(false); 
  };
  
  const handleEditGameMetadata = (id: string, name: string, description: string) => {
      const gameIdx = gameState.games.findIndex(g => g.id === id);
      if(gameIdx === -1) return;
      
      const updatedGame = {
          ...gameState.games[gameIdx],
          name,
          description
      };
      
      db.saveGame(updatedGame);
      setGameState(prev => {
          const newGames = [...prev.games];
          newGames[gameIdx] = updatedGame;
          return { ...prev, games: newGames };
      });
  };

  const handleExplicitSaveGame = async () => {
      if(!gameState.activeGameId) return;
      const game = gameState.games.find(g => g.id === gameState.activeGameId);
      if(game) {
          await db.saveGame(game);
          alert(`Game "${game.name}" saved successfully!`);
      }
  };

  const handleSaveGameAsTemplate = (gameId: string, name: string, description?: string) => {
      const game = gameState.games.find(g => g.id === gameId);
      if(!game) return;

      const newTasks: TaskTemplate[] = game.points.filter(p => !p.isSectionHeader).map((p, index) => ({
          id: `tpl-${Date.now()}-${index}`,
          title: p.title,
          task: p.task,
          tags: p.tags || [],
          iconId: p.iconId,
          createdAt: Date.now(),
          points: p.points,
          feedback: p.feedback,
          settings: p.settings
      }));

      const newList: TaskList = {
          id: `list-${Date.now()}`,
          name: name,
          description: description || `Created from game: ${game.name}`,
          tasks: newTasks,
          color: '#6366f1', 
          createdAt: Date.now()
      };

      db.saveTaskList(newList); // Persist

      setGameState(prev => ({
          ...prev,
          taskLists: [...prev.taskLists, newList]
      }));
      
      alert(`Template "${name}" saved successfully!`);
  };

  const handleCreateTestGame = () => {
     // No op
  };

  const handleSelectGame = (id: string) => {
    const game = gameState.games.find(g => g.id === id);
    if(game && game.defaultMapStyle) setMapStyle(game.defaultMapStyle);
    
    setGameState(prev => ({ ...prev, activeGameId: id }));
    setShowGameChooser(false);
    setShowGameManager(false);
    setPlacingSourceListId(''); // Reset placing mode on game switch
  };

  const handleEditGame = (id: string) => {
    const game = gameState.games.find(g => g.id === id);
    if(game && game.defaultMapStyle) setMapStyle(game.defaultMapStyle);

    setGameState(prev => ({ ...prev, activeGameId: id }));
    setMode(GameMode.EDIT);
    // Keep GameManager open to show details
  };

  const handleDeleteGame = (id: string) => {
    if(confirm('Are you sure you want to delete this game?')) {
        db.deleteGame(id); // Persist
        setGameState(prev => ({
            ...prev,
            games: prev.games.filter(g => g.id !== id),
            activeGameId: prev.activeGameId === id ? null : prev.activeGameId
        }));
    }
  };

  const handleReorderPoints = (reorderedPoints: GamePoint[]) => {
    if (!gameState.activeGameId) return;

    const updatedPoints = reorderedPoints.map((p, index) => ({
      ...p,
      order: index
    }));

    // Optimistic update
    const gameIdx = gameState.games.findIndex(g => g.id === gameState.activeGameId);
    if(gameIdx === -1) return;
    const updatedGame = { ...gameState.games[gameIdx], points: updatedPoints };
    db.saveGame(updatedGame); // Persist

    setGameState(prev => {
        const newGames = [...prev.games];
        newGames[gameIdx] = updatedGame;
        return { ...prev, games: newGames };
    });
  };

  const handleMapClick = (coord: Coordinate) => {
    if (mode === GameMode.EDIT && gameState.activeGameId) {
      
      let nextTemplate: TaskTemplate | undefined;
      let newPointId = `pt-${Date.now()}`;
      
      if (placingSourceListId) {
          const list = gameState.taskLists.find(l => l.id === placingSourceListId);
          if (list) {
              const existingTitles = activePoints.map(p => p.title);
              // Find the first task in the list that isn't on the map yet
              nextTemplate = list.tasks.find(t => !existingTitles.includes(t.title));
              
              if (!nextTemplate) {
                  // Strict check: if list is active but exhausted, DO NOT create generic point
                  alert(`All tasks from "${list.name}" have already been placed on the map.`);
                  return;
              }
          } else {
              // List ID exists but list not found (deleted?) - Fallback to default
              setPlacingSourceListId('');
          }
      }

      let newPoint: GamePoint;

      if (nextTemplate) {
           newPoint = {
            id: newPointId,
            title: nextTemplate.title,
            task: nextTemplate.task,
            location: coord,
            radiusMeters: 30,
            iconId: nextTemplate.iconId,
            isUnlocked: false,
            isCompleted: false,
            order: activePoints.length,
            tags: nextTemplate.tags,
            points: nextTemplate.points || 100,
            feedback: nextTemplate.feedback,
            settings: nextTemplate.settings,
            activationTypes: ['radius']
          };
      } else {
          // Default generic point creation
          newPoint = {
            id: newPointId,
            title: "New Task",
            task: { type: 'text', question: "<b>Edit this task...</b>" },
            location: coord,
            radiusMeters: 30,
            iconId: 'default',
            isUnlocked: false,
            isCompleted: false,
            order: activePoints.length,
            tags: ['new'],
            activationTypes: ['radius'],
            points: 100,
            feedback: { correctMessage: 'Correct!', showCorrectMessage: true, incorrectMessage: 'Try again', showIncorrectMessage: true, hint: '', hintCost: 10 },
            completionLogic: 'remove_any'
          };
      }
      
      const gameIdx = gameState.games.findIndex(g => g.id === gameState.activeGameId);
      if(gameIdx !== -1) {
          const updatedGame = {
              ...gameState.games[gameIdx],
              points: [...gameState.games[gameIdx].points, newPoint]
          };
          db.saveGame(updatedGame); // Persist

          setGameState(prev => {
            const newGames = [...prev.games];
            newGames[gameIdx] = updatedGame;
            return { ...prev, games: newGames };
          });
      }

      setSelectedPoint(newPoint);
    }
  };

  const handlePointClick = (point: GamePoint) => {
    if (mode === GameMode.EDIT) {
      setSelectedPoint(point);
    } else {
      setSelectedPoint(point);
    }
  };

  const handlePointMove = (pointId: string, newLoc: Coordinate) => {
    if ((mode !== GameMode.EDIT && mode !== GameMode.INSTRUCTOR) || !gameState.activeGameId) return;
    
    if (selectedPoint && selectedPoint.id === pointId) {
        setSelectedPoint({ ...selectedPoint, location: newLoc });
    }

    setGameState(prev => {
        const gameIdx = prev.games.findIndex(g => g.id === prev.activeGameId);
        if (gameIdx === -1) return prev;
        
        const newGames = [...prev.games];
        const points = newGames[gameIdx].points.map(p => 
            p.id === pointId ? { ...p, location: newLoc } : p
        );
        const updatedGame = { ...newGames[gameIdx], points };
        
        // Important: Save to DB
        db.saveGame(updatedGame);

        newGames[gameIdx] = updatedGame;
        return { ...prev, games: newGames };
    });
  };

  const handleSavePoint = (updatedPoint: GamePoint) => {
    if (!gameState.activeGameId) return;

    setGameState(prev => {
        const gameIdx = prev.games.findIndex(g => g.id === prev.activeGameId);
        if (gameIdx === -1) return prev;
        
        const newGames = [...prev.games];
        const points = newGames[gameIdx].points.map(p => 
            p.id === updatedPoint.id ? updatedPoint : p
        );
        const updatedGame = { ...newGames[gameIdx], points };
        db.saveGame(updatedGame); // Persist

        newGames[gameIdx] = updatedGame;
        return { ...prev, games: newGames };
    });
    setEditingPoint(null);
    setSelectedPoint(null); 
  };

  const handleDeletePoint = (pointId: string) => {
    if (!gameState.activeGameId) return;
    
    setGameState(prev => {
        const gameIdx = prev.games.findIndex(g => g.id === prev.activeGameId);
        if (gameIdx === -1) return prev;
        
        const newGames = [...prev.games];
        const points = newGames[gameIdx].points.filter(p => p.id !== pointId);
        const updatedGame = { ...newGames[gameIdx], points };
        db.saveGame(updatedGame); // Persist

        newGames[gameIdx] = updatedGame;
        return { ...prev, games: newGames };
    });
    setEditingPoint(null);
    setSelectedPoint(null);
  };

  const handleClearGamePoints = () => {
    if (!gameState.activeGameId || activePoints.length === 0) return;

    const confirmed = window.confirm(`WARNING: You are about to remove ALL ${activePoints.length} tasks from this map.\n\nThis action cannot be undone. Are you sure?`);
    if (!confirmed) return;

    setGameState(prev => {
        const gameIdx = prev.games.findIndex(g => g.id === prev.activeGameId);
        if (gameIdx === -1) return prev;
        
        const newGames = [...prev.games];
        const updatedGame = { ...newGames[gameIdx], points: [] }; 
        db.saveGame(updatedGame); // Persist

        newGames[gameIdx] = updatedGame;
        return { ...prev, games: newGames };
    });
  };

  const handleTaskComplete = (pointId: string, answer?: string) => {
    if (!gameState.activeGameId) return;

    setGameState(prev => {
        const gameIdx = prev.games.findIndex(g => g.id === prev.activeGameId);
        if (gameIdx === -1) return prev;
        
        const newGames = [...prev.games];
        const currentPoint = newGames[gameIdx].points.find(p => p.id === pointId);
        const pointsEarned = currentPoint ? (currentPoint.points || 100) : 100;

        const points = newGames[gameIdx].points.map(p => 
            p.id === pointId ? { ...p, isCompleted: true } : p
        );
        const updatedGame = { ...newGames[gameIdx], points };
        db.saveGame(updatedGame); // Persist

        newGames[gameIdx] = updatedGame;
        return { ...prev, games: newGames, score: prev.score + pointsEarned };
    });
  };

  const handlePointUnlock = (pointId: string) => {
    if (!gameState.activeGameId) return;

    setGameState(prev => {
        const gameIdx = prev.games.findIndex(g => g.id === prev.activeGameId);
        if (gameIdx === -1) return prev;
        
        const newGames = [...prev.games];
        const points = newGames[gameIdx].points.map(p => 
            p.id === pointId ? { ...p, isUnlocked: true } : p
        );
        const updatedGame = { ...newGames[gameIdx], points };
        db.saveGame(updatedGame); // Persist

        newGames[gameIdx] = updatedGame;
        return { ...prev, games: newGames };
    });
  };

  const toggleMode = () => {
      if (mode === GameMode.PLAY) {
          setMode(GameMode.INSTRUCTOR);
          setShowGameManager(false);
          setSelectedPoint(null);
      } else if (mode === GameMode.INSTRUCTOR) {
          setMode(GameMode.EDIT);
          setShowGameManager(true);
          setSelectedPoint(null);
      } else {
          setMode(GameMode.PLAY);
          setShowGameManager(false);
          setSelectedPoint(null);
      }
  };
  
  // --- Insert at Index logic ---
  const handleTriggerInsert = (index: number) => {
      setInsertionIndex(index);
      setShowAiGenerator(true); // Open AI, can also offer Library selection in future
  };

  const handleAddDivider = (index: number) => {
      if (!gameState.activeGameId) return;
      
      const divider: GamePoint = {
          id: `div-${Date.now()}`,
          title: 'Section Header',
          task: { type: 'text', question: '' },
          location: { lat: 0, lng: 0 },
          radiusMeters: 0,
          iconId: 'default',
          isUnlocked: true,
          isCompleted: false,
          order: index,
          points: 0,
          activationTypes: [],
          isSectionHeader: true
      };
      
      const newPoints = [...activePoints];
      newPoints.splice(index, 0, divider);
      // Re-index
      const reIndexed = newPoints.map((p, i) => ({ ...p, order: i }));
      handleReorderPoints(reIndexed);
  };
  
  // --- AI Generated Tasks Insertion ---
  const handleAiTasksGenerated = (tasks: TaskTemplate[]) => {
      if (!gameState.activeGameId) return;
      
      const center = gameState.userLocation || { lat: 55.6761, lng: 12.5683 };
      
      const newPoints: GamePoint[] = tasks.map((tpl, i) => {
         const r = 300 * Math.sqrt(Math.random()); 
         const theta = Math.random() * 2 * Math.PI;
         const dLat = (r * Math.cos(theta)) / 111320;
         const dLng = (r * Math.sin(theta)) / (111320 * Math.cos(center.lat * Math.PI / 180));
         
         return {
             id: `${Date.now()}-pt-${i}-${Math.floor(Math.random()*1000)}`,
             title: tpl.title,
             task: tpl.task,
             location: { lat: center.lat + dLat, lng: center.lng + dLng },
             radiusMeters: 30,
             iconId: tpl.iconId,
             isUnlocked: false,
             isCompleted: false,
             order: 0, // Set later
             tags: tpl.tags,
             points: tpl.points || 100,
             activationTypes: ['radius'],
             feedback: tpl.feedback,
             settings: tpl.settings
         };
      });
      
      const currentPoints = [...activePoints];
      const idx = insertionIndex !== null ? insertionIndex : currentPoints.length;
      
      currentPoints.splice(idx, 0, ...newPoints);
      
      const reIndexed = currentPoints.map((p, i) => ({ ...p, order: i }));
      handleReorderPoints(reIndexed);
      
      setInsertionIndex(null);
      // Close AI Generator handled by props
  };


  // --- Library & List Handlers ---

  const handleSaveTemplate = (template: TaskTemplate) => {
      db.saveTemplate(template);
      setGameState(prev => {
          const exists = prev.taskLibrary.some(t => t.id === template.id);
          let newLibrary;
          if (exists) {
              newLibrary = prev.taskLibrary.map(t => t.id === template.id ? template : t);
          } else {
              newLibrary = [...prev.taskLibrary, template];
          }
          return { ...prev, taskLibrary: newLibrary };
      });
  };

  const handleDeleteTemplate = (id: string) => {
      db.deleteTemplate(id);
      setGameState(prev => ({
          ...prev,
          taskLibrary: prev.taskLibrary.filter(t => t.id !== id)
      }));
  };

  const handleSaveList = (list: TaskList) => {
      db.saveTaskList(list);
      setGameState(prev => {
          const exists = prev.taskLists.some(l => l.id === list.id);
          let newLists;
          if (exists) {
              newLists = prev.taskLists.map(l => l.id === list.id ? list : l);
          } else {
              newLists = [...prev.taskLists, list];
          }
          return { ...prev, taskLists: newLists };
      });
  };

  const handleDeleteList = (id: string) => {
      db.deleteTaskList(id);
      setGameState(prev => ({
          ...prev,
          taskLists: prev.taskLists.filter(l => l.id !== id)
      }));
  };

  const handleCreateGameFromList = (listId: string) => {
      const list = gameState.taskLists.find(l => l.id === listId);
      if (list) {
          handleCreateGame(list.name + ' (Game)', listId);
          setShowTaskMaster(false);
      }
  };

  const handleSelectTasksForGame = (tasks: TaskTemplate[]) => {
      // Re-use logic for inserting at end if from Library directly
      if (!gameState.activeGameId) return;
      setInsertionIndex(activePoints.length);
      handleAiTasksGenerated(tasks);
  };

  if (loading && gameState.games.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-950 text-blue-500 gap-4">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-gray-400 font-medium">Acquiring GPS Signal & Loading Data...</p>
      </div>
    );
  }

  if (error && gameState.games.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 px-6 text-center">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-xl border border-red-900/50 max-w-sm">
          <p className="text-red-500 font-bold text-lg mb-2">GPS Error</p>
          <p className="text-gray-400">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Retry</button>
        </div>
      </div>
    );
  }

  // --- INITIAL LANDING PAGE ---
  if (showLanding && !gameState.activeGameId) {
      return (
          <LandingPage 
              onPlay={handleLandingPlay}
              onCreate={handleLandingCreate}
              onEdit={handleLandingEdit}
          />
      );
  }

  // SHOW WELCOME SCREEN IF NO ACTIVE GAME AND NOT BYPASSED
  if (!gameState.activeGameId && !bypassWelcome) {
      return (
          <WelcomeScreen 
              games={gameState.games}
              userLocation={gameState.userLocation}
              onStartGame={handleStartGame}
              onSetMapStyle={setMapStyle}
              language={appLanguage}
              onSetLanguage={setAppLanguage}
              onOpenEditor={() => {
                  setBypassWelcome(true);
                  setMode(GameMode.EDIT);
                  setShowGameManager(true);
              }}
              onBack={() => {
                  setShowLanding(true);
                  setBypassWelcome(false);
              }}
          />
      );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900 text-gray-100">
      
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <GameMap 
          userLocation={gameState.userLocation}
          points={activePoints}
          accuracy={gameState.gpsAccuracy}
          mode={mode}
          mapStyle={mapStyle}
          selectedPointId={selectedPoint?.id}
          onPointClick={handlePointClick}
          onMapClick={handleMapClick}
          onPointMove={handlePointMove}
        />
      </div>

      {/* INDEPENDENT GAME STATS (Always visible in PLAY Mode if active game) */}
      {mode === GameMode.PLAY && gameState.activeGameId && !showResults && (
          <GameStats 
              score={gameState.score}
              pointsCount={pointsCount}
              nearestPointDistance={nearestPointDistance}
              language={appLanguage}
              className={showGameManager ? 'z-[1200] md:pl-[400px]' : ''} // Push right if sidebar open on desktop
          />
      )}

      {/* HUD Layer (Menu & Toggles) */}
      {!showGameManager && !showGameChooser && !showTaskMaster && !showPlaylistModal && !showResults && !showTeamsModal && (
          <GameHUD 
            accuracy={gameState.gpsAccuracy}
            mode={mode}
            toggleMode={toggleMode}
            onOpenGameChooser={() => { refreshData(); setShowGameChooser(true); }}
            onOpenGameManager={() => {
                setMode(GameMode.EDIT);
                setShowGameManager(true);
            }}
            onOpenTaskMaster={() => {
                setIsTaskMasterSelectionMode(false);
                setShowTaskMaster(true);
            }}
            onOpenTeams={() => {
                setShowTeamsModal(true);
            }}
            mapStyle={mapStyle}
            onSetMapStyle={setMapStyle}
            language={appLanguage}
          />
      )}

      {/* Game Chooser Modal */}
      {showGameChooser && (
          <GameChooser 
            games={gameState.games}
            taskLists={gameState.taskLists}
            onSelectGame={handleSelectGame}
            onCreateGame={(name, listId) => handleCreateGame(name, listId, undefined, 'osm')}
            onClose={() => setShowGameChooser(false)}
            onSaveAsTemplate={handleSaveGameAsTemplate}
            onRefresh={refreshData}
          />
      )}

      {/* Game Manager Drawer */}
      {showGameManager && (
          <GameManager 
            games={gameState.games}
            taskLists={gameState.taskLists}
            activeGameId={gameState.activeGameId}
            activeGamePoints={activePoints}
            onCreateGame={handleCreateGame}
            onSelectGame={handleSelectGame}
            onEditGame={handleEditGame}
            onDeleteGame={handleDeleteGame}
            onEditPoint={(point) => {
               setEditingPoint(point);
            }}
            onReorderPoints={handleReorderPoints}
            onCreateTestGame={handleCreateTestGame}
            onOpenTaskMaster={() => { setIsTaskMasterSelectionMode(false); setShowTaskMaster(true); }}
            onClose={() => {
                // If closing manager and no game is active, return to landing if we want, or just hide
                // For now, simple hide.
                setShowGameManager(false);
            }}
            onAddFromLibrary={() => { setIsTaskMasterSelectionMode(true); setShowTaskMaster(true); }}
            onClearMap={handleClearGamePoints}
            sourceListId={placingSourceListId}
            onSetSourceListId={setPlacingSourceListId}
            onExplicitSaveGame={handleExplicitSaveGame}
            onSaveAsTemplate={handleSaveGameAsTemplate}
            onOpenPlaylist={() => setShowPlaylistModal(true)}
            onEditGameMetadata={handleEditGameMetadata}
            onShowResults={() => setShowResults(true)}
            mode={mode} // Pass current mode
            onSetMode={setMode} // Allow switching mode
            onOpenAiGenerator={() => {
                setInsertionIndex(null); // Append to end for whole game generation
                setShowAiGenerator(true);
            }}
          />
      )}

      {/* Playlist Modal */}
      {showPlaylistModal && (
          <TaskPlaylistModal 
              points={activePoints}
              onReorder={handleReorderPoints}
              onClose={() => setShowPlaylistModal(false)}
              onEditTask={(p) => setEditingPoint(p)}
              onDeleteTask={handleDeletePoint}
              onInsertTask={handleTriggerInsert}
              onAddDivider={handleAddDivider}
          />
      )}

      {/* Results View */}
      {showResults && (
          <ResultsView 
              points={activePoints}
              score={activeGameScore}
              totalPossibleScore={activeGameTotalPossible}
              onClose={() => setShowResults(false)}
              language={appLanguage}
          />
      )}

      {/* AI Task Generator (Can be called from Playlist or TaskMaster) */}
      {showAiGenerator && (
          <AiTaskGenerator 
              onClose={() => setShowAiGenerator(false)}
              onAddTasks={handleAiTasksGenerated}
          />
      )}

      {/* Task Master (Library) */}
      {showTaskMaster && (
          <TaskMaster 
              library={gameState.taskLibrary}
              lists={gameState.taskLists}
              onClose={() => setShowTaskMaster(false)}
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onSaveList={handleSaveList}
              onDeleteList={handleDeleteList}
              onCreateGameFromList={handleCreateGameFromList}
              isSelectionMode={isTaskMasterSelectionMode}
              onSelectTasksForGame={handleSelectTasksForGame}
          />
      )}
      
      {/* Teams Modal */}
      {showTeamsModal && (
          <TeamsModal 
              gameId={gameState.activeGameId}
              games={gameState.games}
              onSelectGame={handleSelectGame}
              onClose={() => setShowTeamsModal(false)}
          />
      )}

      {/* Interactive Elements based on Mode */}

      {/* PLAY / INSTRUCTOR MODE: Task Modal */}
      {selectedPoint && mode !== GameMode.EDIT && (
        <TaskModal 
          point={selectedPoint} 
          distance={selectedDistance}
          onClose={() => setSelectedPoint(null)}
          onComplete={handleTaskComplete}
          onUnlock={handlePointUnlock} 
          isInstructorMode={mode === GameMode.INSTRUCTOR}
        />
      )}

      {/* EDIT MODE: Task Preview (Bottom Sheet) */}
      {selectedPoint && mode === GameMode.EDIT && !editingPoint && !showPlaylistModal && (
          <TaskPreview 
             point={selectedPoint}
             onEdit={() => setEditingPoint(selectedPoint)}
             onDelete={() => handleDeletePoint(selectedPoint.id)}
             onClose={() => setSelectedPoint(null)}
          />
      )}

      {/* EDIT MODE: Full Task Editor (Modal) */}
      {editingPoint && (
          <TaskEditor 
            point={editingPoint}
            onSave={handleSavePoint}
            onClone={(point) => {
                const tpl: TaskTemplate = {
                    id: `tpl-${Date.now()}`,
                    title: point.title,
                    task: point.task,
                    tags: point.tags || [],
                    iconId: point.iconId,
                    createdAt: Date.now(),
                    points: point.points,
                    feedback: point.feedback,
                    settings: point.settings
                };
                handleSaveTemplate(tpl); // Save to DB
                alert("Task copied to Library!");
            }}
            onDelete={handleDeletePoint}
            onClose={() => setEditingPoint(null)}
          />
      )}
    </div>
  );
};

export default App;