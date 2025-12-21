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
import { GamePoint, Coordinate, GameState, GameMode, Game, MapStyleId, Language, Team, TaskTemplate, GameAction, PlaygroundTemplate, Playground } from './types.ts';
import { haversineMeters, isWithinRadius, formatDistance } from './utils/geo.ts';
import { X, ChevronDown, AlertTriangle, CheckCircle, RefreshCw, Plus, Wand2, Library, MapPin, Ruler, RotateCcw, Check, PenTool, Move } from 'lucide-react';
import * as db from './services/db.ts';
import { teamSync } from './services/teamSync.ts';

const APP_VERSION = "1.0.1";
const STORAGE_KEY_GAME_ID = 'teambattle_last_game_id';
const STORAGE_KEY_TEAM_ID = 'teambattle_last_team_id';
const STORAGE_KEY_PLAYER_NAME = 'teambattle_player_name';

type AppView = 'LANDING' | 'CREATOR_HUB' | 'PLAYER_LOBBY' | 'MAP';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    activeGameId: localStorage.getItem(STORAGE_KEY_GAME_ID), 
    games: [], taskLibrary: [], taskLists: [], score: 0,
    userLocation: null, gpsAccuracy: null, deviceId: teamSync.getDeviceId(),
    teamId: localStorage.getItem(STORAGE_KEY_TEAM_ID) || undefined
  });

  const [currentView, setCurrentView] = useState<AppView>('LANDING');
  const [mode, setMode] = useState<GameMode>(GameMode.PLAY);
  const [mapStyle, setMapStyle] = useState<MapStyleId>('osm'); 
  const [appLanguage, setAppLanguage] = useState<Language>('English');
  const [selectedPoint, setSelectedPoint] = useState<GamePoint | null>(null);
  const [editingPoint, setEditingPoint] = useState<GamePoint | null>(null); // Separate state for editor
  
  const [showGameChooser, setShowGameChooser] = useState(false);
  const [showTaskMaster, setShowTaskMaster] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [taskMasterTab, setTaskMasterTab] = useState<'LISTS' | 'LIBRARY' | 'CREATE'>('LISTS');
  const [taskMasterSelectionMode, setTaskMasterSelectionMode] = useState(false);

  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [teamsModalTargetId, setTeamsModalTargetId] = useState<string | null>(null); // Target team to open directly

  const [showGameManager, setShowGameManager] = useState(false); 
  const [showAdminModal, setShowAdminModal] = useState(false); 
  const [showInstructorDashboard, setShowInstructorDashboard] = useState(false); 
  const [showPlaygroundEditor, setShowPlaygroundEditor] = useState(false);
  const [showPlaygroundLibrary, setShowPlaygroundLibrary] = useState(false);
  const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(null);
  const [showTeamDashboard, setShowTeamDashboard] = useState(false); // New State for Team Dashboard

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [forceExpandDrawer, setForceExpandDrawer] = useState(false);
  const [sourceListId, setSourceListId] = useState<string>('');
  const [editorFilter, setEditorFilter] = useState<{ mode: 'ALL' | 'TAG' | 'LIST'; value: string }>({ mode: 'ALL', value: '' });
  
  const [showAddMenu, setShowAddMenu] = useState(false); 
  const [pendingClickLocation, setPendingClickLocation] = useState<Coordinate | null>(null);
  const targetLocationRef = useRef<Coordinate | null>(null);
  const targetPlaygroundIdRef = useRef<string | null>(null);

  // Measuring Tool State
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePathIds, setMeasurePathIds] = useState<string[]>([]);

  // Action Logic State
  const [actionPoint, setActionPoint] = useState<GamePoint | null>(null);
  const [drawSourcePointId, setDrawSourcePointId] = useState<string | null>(null);
  const [drawTriggerType, setDrawTriggerType] = useState<'onOpen' | 'onCorrect' | 'onIncorrect'>('onCorrect');

  const [completedPointIds, setCompletedPointIds] = useState<string[]>([]);
  const [unlockedPointIds, setUnlockedPointIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<GameMapHandle>(null);
  const gameStateRef = useRef(gameState);
  const unlockedIdsRef = useRef(unlockedPointIds);
  
  // Ref for debouncing save
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
    unlockedIdsRef.current = unlockedPointIds;
    if (gameState.activeGameId) localStorage.setItem(STORAGE_KEY_GAME_ID, gameState.activeGameId);
    if (gameState.teamId) localStorage.setItem(STORAGE_KEY_TEAM_ID, gameState.teamId);
  }, [gameState, unlockedPointIds]);

  const refreshData = useCallback(async () => {
    // 1. Skip refresh if in EDIT mode to prevent overwriting work-in-progress or causing sync conflicts.
    // 2. Only show full loading screen on initial load
    if (mode === GameMode.EDIT) return; 

    if (gameState.games.length === 0) setLoading(true); 
    
    setError(null);
    try {
        const [games, library, lists] = await Promise.all([db.fetchGames(), db.fetchLibrary(), db.fetchTaskLists()]);
        
        let teamData: Team | null = null;
        const currentTeamId = localStorage.getItem(STORAGE_KEY_TEAM_ID);
        if (currentTeamId) {
            teamData = await db.fetchTeam(currentTeamId);
        }

        setGameState(prev => {
            let activeGameId = prev.activeGameId;
            // Only clear activeGameId if we fetched games successfully AND the ID is not in the list.
            // If games is empty (e.g. fetch error), keep the ID to be safe.
            if (activeGameId && games.length > 0 && !games.find(g => g.id === activeGameId)) {
                activeGameId = null;
            }
            return { ...prev, games, taskLibrary: library, taskLists: lists, activeGameId, score: teamData ? teamData.score : prev.score };
        });

        if (teamData) setCompletedPointIds(teamData.completedPointIds || []);
    } catch (err: any) {
        setError(err?.message || "Connection Error");
    } finally { setLoading(false); }
  }, [mode, gameState.games.length]); // Added dependency on mode

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  useEffect(() => {
    if (!navigator.geolocation) {
        console.error("Geolocation not supported by this browser.");
        return;
    }

    let watchId: number;
    let retryTimeout: any;

    const handlePosition = (pos: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newLoc = { lat: latitude, lng: longitude };
        setGameState(prev => ({ ...prev, userLocation: newLoc, gpsAccuracy: accuracy }));
        teamSync.updateLocation(newLoc);

        const activeGame = gameStateRef.current.games.find(g => g.id === gameStateRef.current.activeGameId);
        if (activeGame && mode === GameMode.PLAY) {
             activeGame.points.forEach(point => {
                 if (!unlockedIdsRef.current.includes(point.id) && !completedPointIds.includes(point.id) && point.activationTypes.includes('radius')) {
                     // Only check GPS unlock for non-playground points
                     if (!point.playgroundId && isWithinRadius(newLoc, point.location, point.radiusMeters)) {
                         setUnlockedPointIds(prev => [...prev, point.id]);
                     }
                 }
             });
        }
    };

    const handleError = (err: GeolocationPositionError) => {
        console.warn(`Geo Error (${err.code}): ${err.message}`);
        // Code 2: POSITION_UNAVAILABLE, Code 3: TIMEOUT
        if (err.code === 2 || err.code === 3) {
             console.log("Retrying location in 3 seconds...");
             retryTimeout = setTimeout(() => {
                 navigator.geolocation.getCurrentPosition(handlePosition, (e) => {
                     // If retry fails, try low accuracy as fallback
                     console.warn("High accuracy failed, falling back to low accuracy.");
                     navigator.geolocation.watchPosition(handlePosition, null, { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 });
                 }, { enableHighAccuracy: true, timeout: 10000 });
             }, 3000);
        }
    };

    watchId = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        { 
            enableHighAccuracy: true, 
            maximumAge: 5000, // Reduced from 10s to get fresher data
            timeout: 15000 
        }
    );

    return () => {
        navigator.geolocation.clearWatch(watchId);
        clearTimeout(retryTimeout);
    };
  }, [mode, completedPointIds]); 

  const handleStartGame = (gameId: string, teamName: string, userName: string, style: MapStyleId) => {
      const cleanTeamName = teamName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
      const teamId = `team-${cleanTeamName}-${gameId}`;
      
      setGameState(prev => ({ ...prev, activeGameId: gameId, teamName, userName, teamId }));
      localStorage.setItem(STORAGE_KEY_GAME_ID, gameId);
      localStorage.setItem(STORAGE_KEY_TEAM_ID, teamId);
      localStorage.setItem(STORAGE_KEY_PLAYER_NAME, userName);

      setMode(GameMode.PLAY); 
      setMapStyle(style); 
      setCurrentView('MAP');
      teamSync.connect(gameId, teamName, userName);
      refreshData();
  };

  const handleSaveGame = () => {
    if (activeGame) {
      // Clear any pending debounce save to avoid double write
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      db.saveGame(activeGame).then(() => {
        setSaveStatus("GAME SAVED!");
        setTimeout(() => setSaveStatus(null), 3000);
      });
    }
  };

  const updateActiveGame = (updatedGame: Game) => {
      // 1. Optimistic Update (Immediate UI response)
      setGameState(prev => ({
          ...prev,
          games: prev.games.map(g => g.id === updatedGame.id ? updatedGame : g)
      }));

      // 2. Debounced Database Save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
          console.log("[Auto-Save] Saving game to DB...");
          db.saveGame(updatedGame);
      }, 2000); // Wait 2 seconds of inactivity before saving to prevent timeout/flood
  };

  const handleUpdatePlayground = (updatedPlayground: Playground) => {
      if (!activeGame) return;
      const updatedPlaygrounds = activeGame.playgrounds?.map(pg => 
          pg.id === updatedPlayground.id ? updatedPlayground : pg
      ) || [];
      updateActiveGame({ ...activeGame, playgrounds: updatedPlaygrounds });
  };

  const handleAddManualTask = (overrideLoc?: Coordinate, targetPlaygroundId?: string) => {
      if (!activeGame) return;
      const center = overrideLoc || mapRef.current?.getCenter() || gameState.userLocation || { lat: 0, lng: 0 };
      
      const newPoint: GamePoint = { 
          id: `pt-${Date.now()}`, 
          title: 'New Task', 
          location: center, 
          radiusMeters: 30, 
          iconId: 'default', 
          points: 100, 
          isUnlocked: false, 
          isCompleted: false, 
          activationTypes: ['radius'], 
          order: activeGame.points.length, 
          task: { question: 'New Question?', type: 'text' },
          playgroundId: targetPlaygroundId,
          playgroundPosition: targetPlaygroundId ? { x: 50, y: 50 } : undefined
      }; 
      updateActiveGame({...activeGame, points: [...activeGame.points, newPoint]});
      if(targetPlaygroundId) {
          // If in playground, likely just show in list or select for editing
          setEditingPoint(newPoint);
      } else {
          setSelectedPoint(newPoint);
          setEditingPoint(newPoint);
      }
      setShowAddMenu(false);
      setPendingClickLocation(null);
      targetLocationRef.current = null;
      targetPlaygroundIdRef.current = null;
  };

  const handleAddPlaygroundTask = (type: 'MANUAL' | 'AI' | 'LIBRARY', playgroundId: string) => {
      if (type === 'MANUAL') {
          handleAddManualTask(undefined, playgroundId);
      } else if (type === 'AI') {
          targetPlaygroundIdRef.current = playgroundId;
          setShowAiGenerator(true);
      } else if (type === 'LIBRARY') {
          targetPlaygroundIdRef.current = playgroundId;
          // Force state update order to ensure TaskMaster sees new props
          setTaskMasterTab('LISTS'); 
          setTaskMasterSelectionMode(true);
          setTimeout(() => setShowTaskMaster(true), 0);
      }
  };

  const handleImportPlayground = (template: PlaygroundTemplate) => {
      if (!activeGame) return;
      
      // Deep Copy Logic
      const newPlaygroundId = `pg-${Date.now()}`;
      
      // 1. Clone Playground Metadata
      const newPlayground = {
          ...template.playgroundData,
          id: newPlaygroundId,
          title: `${template.title} (Copy)`
      };

      // 2. Clone Tasks & Remap IDs
      const newTasks = template.tasks.map((task, index) => {
          return {
              ...task,
              id: `pt-${Date.now()}-${index}`, // New ID
              playgroundId: newPlaygroundId, // Map to new playground
              playgroundPosition: task.playgroundPosition || { x: 50, y: 50 },
              location: { lat: 0, lng: 0 }, // Reset GPS location as it's virtual
              order: activeGame.points.length + index
          };
      });

      // 3. Update Game
      const updatedPlaygrounds = [...(activeGame.playgrounds || []), newPlayground];
      const updatedPoints = [...activeGame.points, ...newTasks];

      updateActiveGame({ 
          ...activeGame, 
          playgrounds: updatedPlaygrounds,
          points: updatedPoints 
      });

      setShowPlaygroundLibrary(false);
      alert("Playground imported successfully! It is now part of this game.");
  };

  const handleAddTasksFromLibrary = (tasks: TaskTemplate[]) => {
      // Use ref to get the absolute latest game state without relying on closure
      const currentActiveGame = gameStateRef.current.games.find(g => g.id === gameStateRef.current.activeGameId);
      if (!currentActiveGame) return;

      const baseLocation = targetLocationRef.current || mapRef.current?.getCenter() || { lat: 0, lng: 0 };
      const targetPlayground = targetPlaygroundIdRef.current;
      
      const newPoints = tasks.map((t, i) => ({
          id: `pt-${Date.now()}-${i}`,
          title: t.title,
          task: t.task,
          location: { 
              lat: baseLocation.lat + (Math.random() - 0.5) * 0.0005, 
              lng: baseLocation.lng + (Math.random() - 0.5) * 0.0005 
          },
          radiusMeters: 30,
          iconId: t.iconId,
          points: t.points || 100,
          isUnlocked: false,
          isCompleted: false,
          activationTypes: ['radius'],
          order: currentActiveGame.points.length + i,
          tags: t.tags,
          feedback: t.feedback,
          settings: t.settings,
          playgroundId: targetPlayground || undefined,
          playgroundPosition: targetPlayground ? { x: 50 + (i * 2), y: 50 + (i * 2) } : undefined
      }));
      
      updateActiveGame({ ...currentActiveGame, points: [...currentActiveGame.points, ...newPoints] });
      setShowTaskMaster(false);
      setTaskMasterSelectionMode(false);
      setShowAddMenu(false);
      setPendingClickLocation(null);
      targetLocationRef.current = null;
      targetPlaygroundIdRef.current = null;
  };

  // Relocate Game Function
  const handleRelocateGame = () => {
      if (!activeGame || !mapRef.current) return;
      
      const newCenter = mapRef.current.getCenter();
      const currentTasks = activeGame.points.filter(p => !p.playgroundId); // Only move map tasks
      
      if (currentTasks.length === 0) {
          alert("No map tasks to move.");
          return;
      }

      // Calculate centroid of current tasks
      let totalLat = 0;
      let totalLng = 0;
      currentTasks.forEach(p => {
          totalLat += p.location.lat;
          totalLng += p.location.lng;
      });
      const centroid = {
          lat: totalLat / currentTasks.length,
          lng: totalLng / currentTasks.length
      };

      // Calculate delta
      const deltaLat = newCenter.lat - centroid.lat;
      const deltaLng = newCenter.lng - centroid.lng;

      // Update points
      const updatedPoints = activeGame.points.map(p => {
          if (p.playgroundId) return p; // Don't move playground tasks (they don't have GPS coords)
          return {
              ...p,
              location: {
                  lat: p.location.lat + deltaLat,
                  lng: p.location.lng + deltaLng
              }
          };
      });

      if (confirm(`Move ${currentTasks.length} tasks to center of screen?`)) {
          updateActiveGame({ ...activeGame, points: updatedPoints });
      }
  };

  const activeGame = useMemo(() => {
      return gameState.games.find(g => g.id === gameState.activeGameId);
  }, [gameState.games, gameState.activeGameId]);

  // Calculate Total Tasks for Team Dashboard (On Map)
  const totalMapPoints = useMemo(() => {
      if (!activeGame) return 0;
      return activeGame.points.filter(p => !p.isSectionHeader && !p.playgroundId).length;
  }, [activeGame]);

  const displayPoints = useMemo(() => {
      if (!activeGame) return [];
      
      let filtered = activeGame.points;
      
      // Apply Editor Filter if in EDIT mode
      if (mode === GameMode.EDIT && editorFilter.mode !== 'ALL') {
          if (editorFilter.mode === 'TAG') {
              filtered = filtered.filter(p => p.tags?.includes(editorFilter.value));
          } else if (editorFilter.mode === 'LIST') {
              if (editorFilter.value === 'orphan') {
                   // Points not in any list
                   filtered = filtered.filter(p => !gameState.taskLists.some(list => list.tasks.some(t => t.title === p.title)));
              } else {
                   const list = gameState.taskLists.find(l => l.id === editorFilter.value);
                   if (list) {
                       filtered = filtered.filter(p => list.tasks.some(t => t.title === p.title));
                   }
              }
          }
      }

      return filtered.map(p => ({
          ...p,
          isUnlocked: unlockedPointIds.includes(p.id) || mode !== GameMode.PLAY,
          isCompleted: completedPointIds.includes(p.id)
      }));
  }, [activeGame, completedPointIds, unlockedPointIds, mode, editorFilter, gameState.taskLists]);

  const handleLandingAction = (action: 'PLAY' | 'CREATE' | 'EDIT') => {
      if (action === 'PLAY') {
          setCurrentView('PLAYER_LOBBY');
      } else {
          // If no active game, check if we have an ID in storage that matches a game in list
          if (!activeGame) {
              const storedId = localStorage.getItem(STORAGE_KEY_GAME_ID);
              const foundGame = gameState.games.find(g => g.id === storedId);
              
              if (foundGame) {
                  // Recovery: State might have drifted, but game exists. Set it and proceed.
                  setGameState(prev => ({ ...prev, activeGameId: storedId }));
                  if (action === 'CREATE') {
                      setCurrentView('CREATOR_HUB');
                  } else {
                      setMode(GameMode.EDIT);
                      setForceExpandDrawer(false);
                      setCurrentView('MAP');
                  }
              } else {
                  // Really no game active or found
                  setShowGameChooser(true);
                  (window as any)._afterChooseView = action === 'CREATE' ? 'CREATOR_HUB' : 'MAP_EDIT';
              }
          } else {
              if (action === 'CREATE') {
                  setCurrentView('CREATOR_HUB');
              } else {
                  setMode(GameMode.EDIT);
                  setForceExpandDrawer(false);
                  setCurrentView('MAP');
              }
          }
      }
  };

  // Measuring Calculation
  const measureDistance = useMemo(() => {
      if (measurePathIds.length < 2 || !activeGame) return 0;
      let total = 0;
      for (let i = 0; i < measurePathIds.length - 1; i++) {
          const p1 = activeGame.points.find(p => p.id === measurePathIds[i]);
          const p2 = activeGame.points.find(p => p.id === measurePathIds[i+1]);
          if (p1 && p2) total += haversineMeters(p1.location, p2.location);
      }
      return total;
  }, [measurePathIds, activeGame]);

  const measurePathCoords = useMemo(() => {
      if (!activeGame) return [];
      return measurePathIds.map(id => activeGame.points.find(p => p.id === id)?.location).filter(Boolean) as Coordinate[];
  }, [measurePathIds, activeGame]);

  // Logic Links Visualization
  const logicLinks = useMemo(() => {
      if (!activeGame || mode === GameMode.PLAY) return [];
      const links: { from: Coordinate; to: Coordinate; color?: string }[] = [];
      
      activeGame.points.forEach(p => {
          // On Correct Links (Green)
          if (p.logic?.onCorrect) {
              p.logic.onCorrect.forEach(action => {
                  if (action.type === 'unlock' && action.targetId) {
                      const target = activeGame.points.find(tp => tp.id === action.targetId);
                      if (target) {
                          links.push({ from: p.location, to: target.location, color: '#22c55e' }); // Green for Correct
                      }
                  }
              });
          }
          // On Incorrect Links (Red)
          if (p.logic?.onIncorrect) {
              p.logic.onIncorrect.forEach(action => {
                  if (action.type === 'unlock' && action.targetId) {
                      const target = activeGame.points.find(tp => tp.id === action.targetId);
                      if (target) {
                          links.push({ from: p.location, to: target.location, color: '#ef4444' }); // Red for Incorrect
                      }
                  }
              });
          }
          // On Open Links (Blue)
          if (p.logic?.onOpen) {
              p.logic.onOpen.forEach(action => {
                  if (action.type === 'unlock' && action.targetId) {
                      const target = activeGame.points.find(tp => tp.id === action.targetId);
                      if (target) {
                          links.push({ from: p.location, to: target.location, color: '#3b82f6' }); // Blue for On Open
                      }
                  }
              });
          }
      });
      return links;
  }, [activeGame, mode]);

  const handlePointClick = (p: GamePoint) => {
      if (isMeasuring) {
          setMeasurePathIds(prev => [...prev, p.id]);
          return;
      }

      if (drawSourcePointId && activeGame) {
          // Drawing logic mode
          if (p.id === drawSourcePointId) return; // Can't link to self

          const sourcePoint = activeGame.points.find(pt => pt.id === drawSourcePointId);
          if (!sourcePoint) return;

          let updatedPoints = [...activeGame.points];
          
          let newLogic = { ...(sourcePoint.logic || {}) };
          let targetTriggerArray = [...(newLogic[drawTriggerType] || [])];

          // Check if link exists in this specific trigger type
          const existingActionIndex = targetTriggerArray.findIndex(a => a.type === 'unlock' && a.targetId === p.id);

          if (existingActionIndex !== undefined && existingActionIndex >= 0) {
              // Remove link
              targetTriggerArray.splice(existingActionIndex, 1);
          } else {
              // Add link
              targetTriggerArray.push({
                  id: `act-${Date.now()}`,
                  type: 'unlock',
                  targetId: p.id
              });
              
              // Auto-lock the target point to make the flow meaningful
              updatedPoints = updatedPoints.map(pt => pt.id === p.id ? { ...pt, isUnlocked: false } : pt);
          }

          newLogic[drawTriggerType] = targetTriggerArray;
          
          updatedPoints = updatedPoints.map(pt => pt.id === sourcePoint.id ? { ...pt, logic: newLogic } : pt);
          updateActiveGame({ ...activeGame, points: updatedPoints });
          return;
      }

      if (mode === GameMode.EDIT) {
          setEditingPoint(p);
      } else {
          setSelectedPoint(p);
      }
  };

  const handleCompleteTask = (id: string, customScore?: number) => {
      if (!activeGame) return;
      const point = activeGame.points.find(p => p.id === id);
      if (!point) return;

      setCompletedPointIds(prev => [...prev, id]); 
      if (gameState.teamId) {
          const pointsToAdd = customScore !== undefined ? customScore : point.points;
          db.updateTeamProgress(gameState.teamId, id, gameState.score + pointsToAdd); 
      }
      setSelectedPoint(null);

      // Handle Logic (e.g., Open Playground)
      if (point.logic?.onCorrect) {
          point.logic.onCorrect.forEach(action => {
              if (action.type === 'open_playground' && action.targetId) {
                  setActivePlaygroundId(action.targetId);
              }
              if (action.type === 'unlock' && action.targetId) {
                  setUnlockedPointIds(prev => [...prev, action.targetId!]);
              }
          });
      }
  };

  const currentDrawSourcePoint = activeGame?.points.find(p => p.id === drawSourcePointId);
  const currentLinkedCount = currentDrawSourcePoint?.logic?.[drawTriggerType]?.filter(a => a.type === 'unlock').length || 0;

  // Calculate Nearest Point Distance
  const nearestPointDistance = useMemo(() => {
      if (!activeGame || !gameState.userLocation) return null;
      // Filter out completed, section headers, AND playground tasks (which don't have geo coords usually)
      const uncompletedPoints = activeGame.points.filter(p => 
          !completedPointIds.includes(p.id) && 
          !p.isSectionHeader && 
          !p.playgroundId
      );
      
      if (uncompletedPoints.length === 0) return null;
      
      const distances = uncompletedPoints.map(p => haversineMeters(gameState.userLocation!, p.location));
      return Math.min(...distances);
  }, [activeGame, completedPointIds, gameState.userLocation]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 font-sans">
      {loading && !gameState.games.length && (
          <div className="fixed inset-0 z-[6000] bg-slate-950 flex items-center justify-center flex-col gap-4">
              <RefreshCw className="w-12 h-12 text-orange-600 animate-spin" />
              <p className="text-white font-black uppercase tracking-widest text-sm">Initializing...</p>
          </div>
      )}

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
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[5000] animate-in slide-in-from-top-4">
              <div className="bg-green-600/95 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-green-400/50">
                  <CheckCircle className="w-5 h-5" />
                  <p className="text-sm font-black uppercase tracking-widest">{saveStatus}</p>
              </div>
          </div>
      )}

      {/* Main Routing Logic */}
      {currentView === 'LANDING' && <InitialLanding onAction={handleLandingAction} />}

      {currentView === 'CREATOR_HUB' && (
          <CreatorHub 
            activeGameName={activeGame?.name}
            version={APP_VERSION}
            onChooseGame={() => setShowGameChooser(true)}
            onBack={() => setCurrentView('LANDING')}
            onAction={(action) => {
                  if (action === 'CREATE') {
                    const name = prompt("ENTER NAME FOR NEW GAME:", "NEW GAME");
                    if (name) {
                        const newGame: Game = { id: `game-${Date.now()}`, name, description: '', points: [], createdAt: Date.now() };
                        db.saveGame(newGame).then(() => { 
                            setGameState(prev => ({ ...prev, activeGameId: newGame.id }));
                            localStorage.setItem(STORAGE_KEY_GAME_ID, newGame.id);
                            setMode(GameMode.EDIT); setForceExpandDrawer(false);
                            setCurrentView('MAP');
                            refreshData();
                        });
                    }
                    return;
                  }
                  if (action === 'PLAY') { setCurrentView('PLAYER_LOBBY'); }
                  if (action === 'EDIT') { setMode(GameMode.EDIT); setForceExpandDrawer(false); setCurrentView('MAP'); }
                  if (action === 'TEAM') { setMode(GameMode.INSTRUCTOR); setShowTeamsModal(true); setCurrentView('MAP'); }
                  if (action === 'TASKS') { setShowTaskMaster(true); }
                  if (action === 'ADMIN') { setShowAdminModal(true); }
              }} />
      )}

      {currentView === 'PLAYER_LOBBY' && (
          <WelcomeScreen 
            games={gameState.games} 
            userLocation={gameState.userLocation} 
            onStartGame={handleStartGame} 
            onSetMapStyle={setMapStyle} 
            language={appLanguage} 
            onSetLanguage={setAppLanguage} 
            onBack={() => setCurrentView('CREATOR_HUB')} 
            onInstructorLogin={() => {
                setMode(GameMode.INSTRUCTOR);
                setShowTeamsModal(true);
                setCurrentView('MAP');
            }}
          />
      )}

      {currentView === 'MAP' && (
          <>
              {isMeasuring && (
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[3000] bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-4 border-2 border-pink-500 animate-in slide-in-from-top-4 flex flex-col items-center gap-3 min-w-[280px]">
                      <div className="flex items-center gap-2 text-pink-600 font-black uppercase tracking-widest text-xs">
                          <Ruler className="w-4 h-4" /> Distance Measure
                      </div>
                      <div className="text-3xl font-black text-gray-800 dark:text-white">
                          {formatDistance(measureDistance)}
                      </div>
                      <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                          {measurePathIds.length} Points Selected
                      </div>
                      <div className="flex gap-2 w-full">
                          <button onClick={() => setMeasurePathIds(prev => prev.slice(0, -1))} disabled={measurePathIds.length === 0} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-xs font-bold uppercase hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"><RotateCcw className="w-3 h-3 mx-auto" /></button>
                          <button onClick={() => setMeasurePathIds([])} disabled={measurePathIds.length === 0} className="flex-1 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold uppercase hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50">Clear</button>
                          <button onClick={() => { setIsMeasuring(false); setMeasurePathIds([]); }} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-green-700 shadow-md">Done</button>
                      </div>
                  </div>
              )}

              {drawSourcePointId && activeGame && (
                  <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-[3000] ${drawTriggerType === 'onCorrect' ? 'bg-green-500 border-green-400' : 'bg-red-500 border-red-400'} text-white rounded-2xl shadow-2xl p-4 border-2 animate-in slide-in-from-top-4 flex flex-col items-center gap-2 min-w-[280px]`}>
                      <div className="flex items-center gap-2 font-black uppercase tracking-widest text-xs">
                          <PenTool className="w-4 h-4" /> Draw Connections
                      </div>
                      <div className="text-xs text-center font-bold">
                          Select tasks to UNLOCK for <br/>
                          <span className="text-black bg-white/30 px-2 py-0.5 rounded uppercase">{drawTriggerType === 'onCorrect' ? 'CORRECT ANSWER' : 'INCORRECT ANSWER'}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full mt-1">
                          <span className="text-[10px] font-black uppercase tracking-wider">{currentLinkedCount} TASKS LINKED</span>
                      </div>
                      <button 
                          onClick={() => setDrawSourcePointId(null)}
                          className={`mt-2 w-full py-2 bg-white ${drawTriggerType === 'onCorrect' ? 'text-green-600' : 'text-red-600'} rounded-lg text-xs font-black uppercase hover:bg-gray-100 shadow-md`}
                      >
                          DONE
                      </button>
                  </div>
              )}

              <GameMap 
                ref={mapRef} 
                userLocation={gameState.userLocation} 
                points={displayPoints} 
                measurePath={isMeasuring ? measurePathCoords : undefined}
                logicLinks={mode === GameMode.EDIT ? logicLinks : undefined}
                accuracy={gameState.gpsAccuracy} 
                mode={mode} 
                mapStyle={mapStyle} 
                selectedPointId={selectedPoint?.id} 
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
                onMapClick={(coord) => { 
                    if (mode === GameMode.EDIT && activeGame && !isMeasuring && !drawSourcePointId) { 
                        setPendingClickLocation(coord);
                        targetLocationRef.current = coord;
                    } 
                }} 
              />
              <GameHUD 
                accuracy={gameState.gpsAccuracy} 
                mode={mode} 
                toggleMode={() => setMode(mode === GameMode.PLAY ? GameMode.EDIT : mode === GameMode.EDIT ? GameMode.INSTRUCTOR : GameMode.PLAY)} 
                onOpenGameManager={() => setShowGameManager(true)} 
                onOpenTaskMaster={() => { setTaskMasterTab('LISTS'); setTaskMasterSelectionMode(false); setShowTaskMaster(true); targetLocationRef.current = null; }} 
                onOpenTeams={() => setShowTeamsModal(true)} 
                mapStyle={mapStyle} 
                onSetMapStyle={setMapStyle} 
                language={appLanguage} 
                onBackToHub={() => setCurrentView('CREATOR_HUB')} 
                activeGameName={activeGame?.name} 
                onOpenInstructorDashboard={() => setShowInstructorDashboard(true)} 
                isMeasuring={isMeasuring}
                onToggleMeasure={() => { setIsMeasuring(!isMeasuring); setMeasurePathIds([]); }}
                playgrounds={activeGame?.playgrounds}
                onOpenPlayground={(id) => setActivePlaygroundId(id)}
                onOpenTeamDashboard={() => setShowTeamDashboard(true)}
                onRelocateGame={handleRelocateGame}
              />
              
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 h-12 pointer-events-auto">
                  {mode === GameMode.INSTRUCTOR && (
                    <button onClick={() => setShowGameChooser(true)} className="h-12 bg-orange-600 hover:bg-orange-700 text-white px-5 rounded-2xl shadow-2xl flex items-center justify-center gap-2 border border-white/10 shrink-0"><span className="font-black text-xs uppercase tracking-widest truncate max-w-[150px]">{activeGame?.name || "SELECT"}</span><ChevronDown className="w-4 h-4 opacity-50" /></button>
                  )}
                  {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                      <LocationSearch 
                        onSelectLocation={(coord) => mapRef.current?.jumpTo(coord)} 
                        onLocateMe={() => { if (gameState.userLocation) mapRef.current?.jumpTo(gameState.userLocation); }} 
                        onFitBounds={() => { if (activeGame && activeGame.points.length) mapRef.current?.fitBounds(activeGame.points); }}
                        hideSearch={mode === GameMode.PLAY} 
                      />
                  )}
              </div>

              {/* Floating Add Menu for Editor Mode */}
              {mode === GameMode.EDIT && !isMeasuring && !drawSourcePointId && (
                  <div className="absolute bottom-6 left-6 z-[2000] flex flex-col-reverse gap-3 items-start pointer-events-auto">
                      <button 
                        onClick={() => setShowAddMenu(!showAddMenu)} 
                        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${showAddMenu ? 'bg-white text-orange-600 rotate-45' : 'bg-orange-600 text-white hover:scale-110'}`}
                      >
                          <Plus className="w-8 h-8" />
                      </button>
                      
                      {showAddMenu && (
                          <div className="flex flex-col-reverse gap-3 animate-in slide-in-from-bottom-2 duration-300 mb-2">
                              <button 
                                onClick={() => handleAddManualTask()}
                                className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-3 rounded-full shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group whitespace-nowrap"
                              >
                                  <span className="text-xs font-black uppercase tracking-widest">New Blank Task</span>
                                  <div className="bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-full"><Plus className="w-4 h-4 text-orange-600" /></div>
                              </button>
                              <button 
                                onClick={() => { setShowAiGenerator(true); setShowAddMenu(false); targetLocationRef.current = null; }}
                                className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-3 rounded-full shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group whitespace-nowrap"
                              >
                                  <span className="text-xs font-black uppercase tracking-widest">Generate AI Task</span>
                                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-full"><Wand2 className="w-4 h-4 text-purple-600" /></div>
                              </button>
                              <button 
                                onClick={() => { setTaskMasterTab('LIBRARY'); setTaskMasterSelectionMode(true); setShowTaskMaster(true); setShowAddMenu(false); targetLocationRef.current = null; }}
                                className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-3 rounded-full shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group whitespace-nowrap"
                              >
                                  <span className="text-xs font-black uppercase tracking-widest">From Library</span>
                                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-full"><Library className="w-4 h-4 text-blue-600" /></div>
                              </button>
                          </div>
                      )}
                  </div>
              )}

              {/* Map Click Choice Modal */}
              {pendingClickLocation && !isMeasuring && (
                  <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                      <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col gap-4 relative animate-in zoom-in-95">
                          <button onClick={() => { setPendingClickLocation(null); targetLocationRef.current = null; }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"><X className="w-5 h-5"/></button>
                          <h3 className="text-lg font-black uppercase tracking-widest text-center mb-2 text-gray-800 dark:text-white flex items-center justify-center gap-2"><MapPin className="w-5 h-5 text-orange-500" /> ADD TASK HERE</h3>
                          
                          <button onClick={() => handleAddManualTask(pendingClickLocation)} className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-100 dark:border-orange-900/50 hover:border-orange-500 transition-all flex items-center gap-4 group">
                              <div className="bg-orange-500 text-white p-3 rounded-full group-hover:scale-110 transition-transform"><Plus className="w-5 h-5"/></div>
                              <span className="font-bold text-sm uppercase text-gray-700 dark:text-gray-200">EMPTY TASK</span>
                          </button>

                          <button onClick={() => { setShowAiGenerator(true); setPendingClickLocation(null); }} className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-100 dark:border-purple-900/50 hover:border-purple-500 transition-all flex items-center gap-4 group">
                              <div className="bg-purple-600 text-white p-3 rounded-full group-hover:scale-110 transition-transform"><Wand2 className="w-5 h-5"/></div>
                              <span className="font-bold text-sm uppercase text-gray-700 dark:text-gray-200">AI GENERATOR</span>
                          </button>

                          <button onClick={() => { setTaskMasterTab('LIBRARY'); setTaskMasterSelectionMode(true); setShowTaskMaster(true); setPendingClickLocation(null); }} className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-900/50 hover:border-blue-500 transition-all flex items-center gap-4 group">
                              <div className="bg-blue-600 text-white p-3 rounded-full group-hover:scale-110 transition-transform"><Library className="w-5 h-5"/></div>
                              <span className="font-bold text-sm uppercase text-gray-700 dark:text-gray-200">FROM LIBRARY</span>
                          </button>
                      </div>
                  </div>
              )}

              {mode === GameMode.EDIT && (
                <EditorDrawer 
                  onClose={() => setMode(GameMode.PLAY)} 
                  activeGame={activeGame}
                  activeGameName={activeGame?.name || "No game selected"} 
                  points={displayPoints} 
                  allPoints={activeGame?.points} // Pass all including playground points to editor list
                  taskLists={gameState.taskLists} 
                  games={gameState.games}
                  onSelectGame={(id) => {
                      setGameState(prev => ({ ...prev, activeGameId: id }));
                      localStorage.setItem(STORAGE_KEY_GAME_ID, id);
                  }}
                  onOpenGameChooser={() => setShowGameChooser(true)}
                  sourceListId={sourceListId} 
                  onSetSourceListId={setSourceListId} 
                  onEditPoint={(p) => { setEditingPoint(p); }} 
                  onSelectPoint={(p) => { setSelectedPoint(p); mapRef.current?.jumpTo(p.location); }} 
                  onDeletePoint={(id) => { 
                      if(!activeGame) return; 
                      const updated = activeGame.points.filter(p => p.id !== id); 
                      updateActiveGame({...activeGame, points: updated});
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
                  onSaveGame={handleSaveGame} 
                  onOpenTaskMaster={() => { setTaskMasterTab('LISTS'); setTaskMasterSelectionMode(false); setShowTaskMaster(true); targetLocationRef.current = null; }} 
                  onFitBounds={() => activeGame && mapRef.current?.fitBounds(activeGame.points)} 
                  onOpenPlaygroundEditor={() => setShowPlaygroundEditor(true)}
                  initialExpanded={forceExpandDrawer}
                  filterState={editorFilter}
                  onSetFilter={setEditorFilter}
                />
              )}
              {mode === GameMode.PLAY && activeGame && <GameStats score={gameState.score} pointsCount={{ total: displayPoints.filter(p => !p.isSectionHeader).length, completed: completedPointIds.length }} nearestPointDistance={nearestPointDistance} language={appLanguage} />}
          </>
      )}

      {/* GLOBAL MODALS */}
      {showPlaygroundEditor && activeGame && (
          <PlaygroundEditor 
              game={activeGame} 
              onUpdateGame={updateActiveGame} 
              onClose={() => setShowPlaygroundEditor(false)}
              onEditPoint={setEditingPoint}
              onAddTask={handleAddPlaygroundTask}
              onOpenLibrary={() => setShowPlaygroundLibrary(true)}
          />
      )}

      {showPlaygroundLibrary && (
          <PlaygroundLibraryModal 
              onClose={() => setShowPlaygroundLibrary(false)}
              onImport={handleImportPlayground}
          />
      )}

      {activePlaygroundId && activeGame && (
          <PlaygroundModal 
              playground={activeGame.playgrounds?.find(p => p.id === activePlaygroundId)!}
              points={activeGame.points}
              onClose={() => setActivePlaygroundId(null)}
              onPointClick={setSelectedPoint}
              mode={mode}
              onUpdatePlayground={handleUpdatePlayground}
              onEditPlayground={() => {
                  setActivePlaygroundId(null);
                  setShowPlaygroundEditor(true);
              }}
          />
      )}

      {showTeamDashboard && gameState.activeGameId && (
          <TeamDashboard 
              teamId={gameState.teamId} 
              gameId={gameState.activeGameId}
              totalMapPoints={totalMapPoints}
              onOpenAgents={() => {
                  setTeamsModalTargetId(gameState.teamId || null);
                  setShowTeamDashboard(false);
                  setShowTeamsModal(true);
              }}
              onClose={() => setShowTeamDashboard(false)} 
          />
      )}

      {editingPoint && (
          <TaskEditor 
              point={editingPoint} 
              onSave={(updatedPoint) => {
                  if (!activeGame) return;
                  const updatedPoints = activeGame.points.map(p => p.id === updatedPoint.id ? updatedPoint : p);
                  updateActiveGame({ ...activeGame, points: updatedPoints });
                  setEditingPoint(null);
              }}
              onDelete={(id) => {
                  if (!activeGame) return;
                  const updatedPoints = activeGame.points.filter(p => p.id !== id);
                  updateActiveGame({ ...activeGame, points: updatedPoints });
                  setEditingPoint(null);
              }}
              onClose={() => setEditingPoint(null)}
              onClone={(p) => {
                  if (!activeGame) return;
                  const cloned = { ...p, id: `pt-clone-${Date.now()}`, title: `${p.title} (Copy)`, order: activeGame.points.length, location: { lat: p.location.lat + 0.0001, lng: p.location.lng + 0.0001 } };
                  updateActiveGame({ ...activeGame, points: [...activeGame.points, cloned] });
                  setEditingPoint(cloned);
              }}
          />
      )}

      {showGameChooser && (
          <GameChooser 
            games={gameState.games} 
            taskLists={gameState.taskLists} 
            onClose={() => setShowGameChooser(false)} 
            onSelectGame={(id) => { 
                setGameState(prev => ({ ...prev, activeGameId: id })); 
                localStorage.setItem(STORAGE_KEY_GAME_ID, id);
                setShowGameChooser(false); 
                
                const target = (window as any)._afterChooseView;
                if (target) {
                    if (target === 'CREATOR_HUB') setCurrentView('CREATOR_HUB');
                    else if (target === 'MAP_EDIT') { setMode(GameMode.EDIT); setForceExpandDrawer(false); setCurrentView('MAP'); }
                    (window as any)._afterChooseView = null;
                }
            }} 
            onCreateGame={(name, fromTaskListId) => { 
                let initialPoints: GamePoint[] = [];
                if (fromTaskListId) {
                    const list = gameState.taskLists.find(l => l.id === fromTaskListId);
                    if (list) {
                        initialPoints = list.tasks.map((t, i) => ({
                            id: `pt-${Date.now()}-${i}`,
                            title: t.title,
                            task: t.task,
                            location: { lat: 0, lng: 0 },
                            radiusMeters: 30,
                            iconId: t.iconId,
                            points: t.points || 100,
                            isUnlocked: false,
                            isCompleted: false,
                            activationTypes: ['radius'],
                            order: i,
                            tags: t.tags,
                            feedback: t.feedback,
                            settings: t.settings
                        }));
                    }
                }

                const newGame: Game = { id: `game-${Date.now()}`, name, description: '', points: initialPoints, createdAt: Date.now() }; 
                db.saveGame(newGame).then(() => { 
                    refreshData(); 
                    setGameState(prev => ({ ...prev, activeGameId: newGame.id })); 
                    localStorage.setItem(STORAGE_KEY_GAME_ID, newGame.id);
                    setShowGameChooser(false); 
                    setMode(GameMode.EDIT);
                    setForceExpandDrawer(false); 
                    setCurrentView('MAP');
                    (window as any)._afterChooseView = null;
                }); 
            }} 
          />
      )}
      {showTaskMaster && (
        <TaskMaster 
            library={gameState.taskLibrary} 
            lists={gameState.taskLists} 
            onClose={() => { 
                setShowTaskMaster(false); 
                // DO NOT clear refs here, as this might be called on unmount during the 'add' flow
                // Only clear if explicitly cancelling or when finished adding
            }} 
            onSaveTemplate={(t) => db.saveTemplate(t).then(refreshData)} 
            onDeleteTemplate={(id) => db.deleteTemplate(id).then(refreshData)} 
            onSaveList={(l) => db.saveTaskList(l).then(refreshData)} 
            onDeleteList={(id) => db.deleteTaskList(id).then(refreshData)} 
            onCreateGameFromList={() => {}} 
            initialTab={taskMasterTab}
            isSelectionMode={taskMasterSelectionMode}
            onSelectTasksForGame={handleAddTasksFromLibrary}
        />
      )}
      {showAiGenerator && (
          <AiTaskGenerator 
              onClose={() => setShowAiGenerator(false)} 
              onAddTasks={(tasks) => {
                  tasks.forEach(t => db.saveTemplate(t));
                  // refreshData(); // Don't refresh immediately to avoid overwriting active game state if in edit
                  handleAddTasksFromLibrary(tasks);
                  setShowAiGenerator(false);
              }} 
          />
      )}
      {showTeamsModal && (
          <TeamsModal 
            gameId={gameState.activeGameId} 
            games={gameState.games} 
            targetTeamId={teamsModalTargetId}
            onSelectGame={(id) => {
                setGameState(prev => ({ ...prev, activeGameId: id }));
                localStorage.setItem(STORAGE_KEY_GAME_ID, id);
            }} 
            onClose={() => {
                setShowTeamsModal(false);
                setTeamsModalTargetId(null);
            }} 
          />
      )}
      {showAdminModal && <AdminModal games={gameState.games} onClose={() => setShowAdminModal(false)} onDeleteGame={(id) => db.deleteGame(id).then(refreshData)} />}
      {showInstructorDashboard && activeGame && <InstructorDashboard game={activeGame} onClose={() => setShowInstructorDashboard(false)} />}
      {selectedPoint && (
        <TaskModal 
            point={selectedPoint} 
            onClose={() => setSelectedPoint(null)} 
            onComplete={handleCompleteTask} 
            onPenalty={(amount) => {
                if (gameState.teamId) {
                    db.updateTeamScore(gameState.teamId, -amount);
                }
            }}
            distance={gameState.userLocation ? haversineMeters(gameState.userLocation, selectedPoint.location) : 0} 
            mode={mode}
            onOpenActions={() => {
                setActionPoint(selectedPoint);
                setSelectedPoint(null);
            }}
        />
      )}
      {actionPoint && activeGame && (
          <TaskActionModal 
              point={actionPoint} 
              allPoints={activeGame.points}
              playgrounds={activeGame.playgrounds}
              onSave={(updatedPoint) => {
                  const updatedPoints = activeGame.points.map(p => p.id === updatedPoint.id ? updatedPoint : p);
                  updateActiveGame({ ...activeGame, points: updatedPoints });
              }}
              onClose={() => setActionPoint(null)}
              onStartDrawMode={(trigger) => {
                  setActionPoint(null);
                  setDrawSourcePointId(actionPoint.id);
                  setDrawTriggerType(trigger);
                  setMeasurePathIds([]); // Reset measurement tool if active
                  setIsMeasuring(false);
              }}
          />
      )}
    </div>
  );
};

export default App;