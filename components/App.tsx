
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Game, GameState, GameMode, GamePoint, Coordinate, 
  MapStyleId, Language, Team, TaskTemplate, TaskList, TaskType, ChatMessage, DangerZone, PlaygroundTemplate, Playground
} from './types';
import * as db from './services/db';
import { teamSync } from './services/teamSync';
import { haversineMeters } from './utils/geo';
import { seedDatabase, seedTeams } from './utils/demoContent';

// Components
import GameMap, { GameMapHandle } from './components/GameMap';
import GameHUD from './components/GameHUD';
import TaskModal from './components/TaskModal';
import GameManager from './components/GameManager';
import GameChooser from './components/GameChooser';
import TaskMaster from './components/TaskMaster';
import EditorDrawer from './components/EditorDrawer';
import WelcomeScreen from './components/WelcomeScreen';
import ResultsView from './components/ResultsView';
import TaskPreview from './components/TaskPreview';
import PlaygroundEditor from './components/PlaygroundEditor';
import PlaygroundModal from './components/PlaygroundModal';
import PlaygroundLibraryModal from './components/PlaygroundLibraryModal';
import TeamDashboard from './components/TeamDashboard';
import TeamsModal from './components/TeamsModal';
import GameCreator from './components/GameCreator';
import InitialLanding from './components/InitialLanding';
import CreatorHub from './components/CreatorHub';
import TeamsHubModal from './components/TeamsHubModal';
import CreatorDrawer from './components/CreatorDrawer';
import PointContextMenu from './components/PointContextMenu';
import TaskActionModal from './components/TaskActionModal';
import TaskPlaylistModal from './components/TaskPlaylistModal';
import AiTaskGenerator from './components/AiTaskGenerator';
import ClientSubmissionView from './components/ClientSubmissionView';
import MessagePopup from './components/MessagePopup';
import InstructorDashboard from './components/InstructorDashboard';
import GameStats from './components/GameStats';
import Dashboard from './components/Dashboard';
import TaskEditor from './components/TaskEditor';
import ChatDrawer from './components/ChatDrawer'; 
import DangerZoneModal from './components/DangerZoneModal';
import PlaygroundManager from './components/PlaygroundManager';
import AdminModal from './components/AdminModal';

// Constants
const STORAGE_KEY_GAME_ID = 'geohunt_active_game_id';
const STORAGE_KEY_TEAM_NAME = 'geohunt_team_name';
const STORAGE_KEY_USER_NAME = 'geohunt_user_name';
const STORAGE_KEY_MODE = 'geohunt_mode';
const STORAGE_KEY_LAST_ACTIVE = 'geohunt_last_active';
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 Hours

type MeasureNode = { type: 'point', id: string } | { type: 'coord', loc: Coordinate };

const App: React.FC = () => {
  // --- STATE ---
  const [mode, setMode] = useState<GameMode>(() => {
      // Initial mode selection logic
      const storedMode = localStorage.getItem(STORAGE_KEY_MODE) as GameMode;
      // Force EDIT on Desktop unless explicitly stored otherwise (and even then, prefer EDIT on load)
      if (window.innerWidth > 1024) {
          return GameMode.EDIT;
      }
      if (storedMode && Object.values(GameMode).includes(storedMode)) {
          return storedMode;
      }
      return GameMode.PLAY;
  });

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

  // Instructor specific state
  const [instructorTeams, setInstructorTeams] = useState<Team[]>([]);

  const [mapStyle, setMapStyle] = useState<MapStyleId>('osm');
  const [language, setLanguage] = useState<Language>('English');
  const [loading, setLoading] = useState(true);
  const [showScores, setShowScores] = useState(localStorage.getItem('geohunt_show_scores') !== 'false');

  // Danger Zone Logic State
  const [activeDangerZone, setActiveDangerZone] = useState<{ id: string; enteredAt: number; timeRemaining: number } | null>(null);
  const [penalizedZones, setPenalizedZones] = useState<Set<string>>(new Set());
  const [editingDangerZoneId, setEditingDangerZoneId] = useState<string | null>(null);

  // UI Toggles & Modals
  const [showLanding, setShowLanding] = useState(true); 
  const [showWelcome, setShowWelcome] = useState(false); 
  const [showGameManager, setShowGameManager] = useState(false);
  const [showGameChooser, setShowGameChooser] = useState(false);
  const [showTaskMaster, setShowTaskMaster] = useState(false);
  const [showPlaygroundEditor, setShowPlaygroundEditor] = useState(false);
  const [viewingPlaygroundId, setViewingPlaygroundId] = useState<string | null>(null); 
  const [showTeamDashboard, setShowTeamDashboard] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showCreatorHub, setShowCreatorHub] = useState(false);
  const [showGameCreator, setShowGameCreator] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [showPlaygroundLibrary, setShowPlaygroundLibrary] = useState(false);
  const [showTeamsHub, setShowTeamsHub] = useState(false);
  const [showTaskPlaylist, setShowTaskPlaylist] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showPlaygroundManager, setShowPlaygroundManager] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  
  // Teams Modal Admin State
  const [teamsModalAdmin, setTeamsModalAdmin] = useState(false);
  
  // Editor Specific State
  const [selectedPoint, setSelectedPoint] = useState<GamePoint | null>(null);
  const [editingPoint, setEditingPoint] = useState<GamePoint | null>(null);
  const [sourceListId, setSourceListId] = useState<string>('');
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isRelocating, setIsRelocating] = useState(false); 
  const [measureNodes, setMeasureNodes] = useState<MeasureNode[]>([]);
  const [forceExpandDrawer, setForceExpandDrawer] = useState(false);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false); 
  const [taskMasterTab, setTaskMasterTab] = useState<'LISTS' | 'LIBRARY' | 'CREATE' | 'CLIENT' | 'QR'>('LIBRARY');
  const [taskMasterEditingListId, setTaskMasterEditingListId] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<'dashboard' | 'games' | 'templates' | 'tasks' | 'users' | 'tags' | 'client'>('dashboard');
  const [showActionModal, setShowActionModal] = useState(false);
  const [isDrawingLogic, setIsDrawingLogic] = useState<{ trigger: 'onOpen' | 'onCorrect' | 'onIncorrect', sourcePointId: string } | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<{ point: GamePoint } | null>(null);

  // Template Editing State
  const [activeTemplateGame, setActiveTemplateGame] = useState<Game | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingGameMetadataId, setEditingGameMetadataId] = useState<string | null>(null);

  // Client / External
  const [clientSubmissionToken, setClientSubmissionToken] = useState<string | null>(null);
  const [messagePopup, setMessagePopup] = useState<ChatMessage | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]); 
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0); 
  const [showInstructorDashboard, setShowInstructorDashboard] = useState(false);

  const mapRef = useRef<GameMapHandle>(null);
  const saveTimeoutRef = useRef<any>(null); 
  const dangerTimerRef = useRef<any>(null);

  // --- DERIVED STATE ---
  // Use activeTemplateGame if we are editing a template, otherwise standard activeGame
  const activeGame = useMemo(() => {
      if (editingTemplateId && activeTemplateGame) return activeTemplateGame;
      return gameState.games.find(g => g.id === gameState.activeGameId) || null;
  }, [gameState.games, gameState.activeGameId, activeTemplateGame, editingTemplateId]);

  const displayPoints = useMemo(() => {
      return activeGame ? activeGame.points : [];
  }, [activeGame]);

  const measurePath = useMemo(() => {
      return measureNodes
          .map(node => {
              if (node.type === 'point') {
                  const p = activeGame?.points.find(ap => ap.id === node.id);
                  return p ? p.location : null;
              }
              return node.loc;
          })
          .filter((l): l is Coordinate => !!l);
  }, [activeGame, measureNodes]);

  const measuredDistance = useMemo(() => {
      let dist = 0;
      for (let i = 0; i < measurePath.length - 1; i++) {
          dist += haversineMeters(measurePath[i], measurePath[i+1]);
      }
      return dist;
  }, [measurePath]);

  // Identify locked/dependent tasks
  const dependentPointIds = useMemo(() => {
      if (!activeGame) return [];
      const targets = new Set<string>();
      activeGame.points.forEach(p => {
          ['onOpen', 'onCorrect', 'onIncorrect'].forEach((trigger) => {
              const actions = p.logic?.[trigger as keyof typeof p.logic];
              actions?.forEach(action => {
                  if ((action.type === 'unlock' || action.type === 'reveal') && action.targetId) {
                      targets.add(action.targetId);
                  }
              });
          });
      });
      return Array.from(targets);
  }, [activeGame]);

  const hiddenPlaygroundIds = useMemo(() => {
      if (!activeGame) return [];
      const hidden = new Set<string>();
      activeGame.points.forEach(p => {
          ['onOpen', 'onCorrect', 'onIncorrect'].forEach((trigger) => {
              const actions = p.logic?.[trigger as keyof typeof p.logic];
              actions?.forEach(action => {
                  if (action.type === 'open_playground' && action.targetId) {
                      hidden.add(action.targetId);
                  }
              });
          });
      });
      return Array.from(hidden);
  }, [activeGame]);

  const logicInfo = useMemo(() => {
      if (!activeGame) return { links: [], playgroundMarkers: [] };
      const links: { from: Coordinate; to: Coordinate; color?: string; type?: 'onOpen' | 'onCorrect' | 'onIncorrect' | 'open_playground' }[] = [];
      
      // Calculate Playground Markers first (used for links)
      const playgroundMarkers: { id: string; location: Coordinate; title: string; iconId: string }[] = [];
      
      activeGame.playgrounds?.forEach(pg => {
          // Use stored location, or fallback to centroid of tasks, or fallback to (0,0)
          let loc = pg.location;
          if (!loc || (loc.lat === 0 && loc.lng === 0)) {
              const pgPoints = activeGame.points.filter(p => p.playgroundId === pg.id);
              if (pgPoints.length > 0) {
                  const avgLat = pgPoints.reduce((sum, p) => sum + p.location.lat, 0) / pgPoints.length;
                  const avgLng = pgPoints.reduce((sum, p) => sum + p.location.lng, 0) / pgPoints.length;
                  loc = { lat: avgLat, lng: avgLng };
              } else {
                  // Fallback for new playground without tasks - place near user or center map
                  loc = gameState.userLocation || { lat: 55.6761, lng: 12.5683 };
              }
          }
          playgroundMarkers.push({
              id: pg.id,
              location: loc,
              title: pg.title,
              iconId: pg.iconId || 'default'
          });
      });

      // Generate Links
      activeGame.points.forEach(p => {
          if (!p.location) return;
          
          // Logic Links
          ['onOpen', 'onCorrect', 'onIncorrect'].forEach((trigger) => {
              const actions = p.logic?.[trigger as any];
              actions?.forEach(action => {
                  // Standard Unlock/Reveal Links to other points
                  if ((action.type === 'unlock' || action.type === 'reveal') && action.targetId) {
                      const target = activeGame.points.find(tp => tp.id === action.targetId);
                      if (target && target.location && (target.location.lat !== 0 || target.location.lng !== 0)) {
                          const color = trigger === 'onOpen' ? '#eab308' : (trigger === 'onCorrect' ? '#22c55e' : '#ef4444');
                          links.push({ from: p.location, to: target.location, color, type: trigger as any });
                      }
                  }
              });
          });
      });

      return { links, playgroundMarkers };
  }, [activeGame, gameState.userLocation]);

  // Determine highlighted playground (if selected point activates it)
  const targetPlaygroundId = useMemo(() => {
      if (!selectedPoint && !editingPoint) return undefined;
      const pt = selectedPoint || editingPoint;
      if (!pt) return undefined;

      const actions = [
          ...(pt.logic?.onOpen || []),
          ...(pt.logic?.onCorrect || []),
          ...(pt.logic?.onIncorrect || [])
      ];
      
      const pgAction = actions.find(a => a.type === 'open_playground');
      return pgAction?.targetId;
  }, [selectedPoint, editingPoint]);

  /**
   * Helper: Enforce Desktop Mode logic
   * If screen > 1024px, switch to EDIT mode.
   */
  const ensureDesktopMode = () => {
      if (window.innerWidth > 1024) {
          setMode(GameMode.EDIT);
      }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const submitTo = params.get('submitTo');
    if (submitTo) {
        setClientSubmissionToken(submitTo);
        setLoading(false);
        return;
    }

    const init = async () => {
      const lastActive = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
      if (lastActive && Date.now() - parseInt(lastActive) > SESSION_TIMEOUT_MS) {
          localStorage.removeItem(STORAGE_KEY_GAME_ID);
          localStorage.removeItem(STORAGE_KEY_TEAM_NAME);
          localStorage.removeItem(STORAGE_KEY_USER_NAME);
      }
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, Date.now().toString());

      const [fetchedGames, fetchedLibrary, fetchedLists] = await Promise.all([
        db.fetchGames(),
        db.fetchLibrary(),
        db.fetchTaskLists()
      ]);

      if (fetchedGames.length === 0 && fetchedLibrary.length === 0) {
          await seedDatabase();
          const seededGames = await db.fetchGames();
          const seededLib = await db.fetchLibrary();
          const seededLists = await db.fetchTaskLists();
          setGameState(prev => ({ ...prev, games: seededGames, taskLibrary: seededLib, taskLists: seededLists }));
      } else {
          setGameState(prev => ({ ...prev, games: fetchedGames, taskLibrary: fetchedLibrary, taskLists: fetchedLists }));
      }

      const storedGameId = localStorage.getItem(STORAGE_KEY_GAME_ID);
      const storedTeamName = localStorage.getItem(STORAGE_KEY_TEAM_NAME);
      const storedUserName = localStorage.getItem(STORAGE_KEY_USER_NAME);
      // const storedMode = localStorage.getItem(STORAGE_KEY_MODE) as GameMode; // Handled by useState initializer

      if (storedGameId) {
          setGameState(prev => ({ ...prev, activeGameId: storedGameId, teamName: storedTeamName || undefined, userName: storedUserName || undefined }));
          if (storedTeamName && storedUserName) {
              teamSync.connect(storedGameId, storedTeamName, storedUserName);
              setShowLanding(false); 
              setShowWelcome(false);
          }
      }

      // Check if we should prompt for game chooser
      if ((mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && !storedGameId) {
          setShowGameChooser(true);
      }

      setLoading(false);
    };

    init();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGameState(prev => ({ ...prev, userLocation: coord, gpsAccuracy: pos.coords.accuracy }));
        teamSync.updateLocation(coord);
      },
      (err) => console.warn("GPS Error", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    const unsubscribeChat = teamSync.subscribeToChat((msg) => {
        if (msg.targetTeamId && msg.targetTeamId !== `team-${gameState.teamName?.replace(/\s+/g, '-').toLowerCase()}-${activeGame?.id}`) return;
        setMessagePopup(msg);
        setChatHistory(prev => [...prev, msg]);
        if (!showChatDrawer) {
            setUnreadMessagesCount(prev => prev + 1);
        }
    });

    const updateActivity = () => localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, Date.now().toString());
    window.addEventListener('click', updateActivity);
    window.addEventListener('keypress', updateActivity);

    // Initial check for desktop mode
    ensureDesktopMode();

    return () => {
        navigator.geolocation.clearWatch(watchId);
        unsubscribeChat();
        window.removeEventListener('click', updateActivity);
        window.removeEventListener('keypress', updateActivity);
    };
  }, [showChatDrawer]);

  // --- DANGER ZONE MONITORING ---
  useEffect(() => {
      // Only monitor in Play mode with location and active game
      if (mode !== GameMode.PLAY || !gameState.userLocation || !activeGame || !activeGame.dangerZones) {
          if (activeDangerZone) {
              setActiveDangerZone(null); // Clear if mode changes
          }
          return;
      }

      const foundZone = activeGame.dangerZones.find(z => 
          haversineMeters(gameState.userLocation, z.location) <= z.radius
      );

      if (foundZone) {
          // We are inside a danger zone
          if (!activeDangerZone || activeDangerZone.id !== foundZone.id) {
              // Newly entered or switched zone. Use zone-specific duration if available, else default 10s.
              setActiveDangerZone({
                  id: foundZone.id,
                  enteredAt: Date.now(),
                  timeRemaining: foundZone.duration || 10 
              });
          }
      } else {
          // We are outside all zones
          if (activeDangerZone) {
              setActiveDangerZone(null);
          }
      }
  }, [gameState.userLocation, activeGame, mode]);

  // --- DANGER ZONE TIMER LOGIC ---
  useEffect(() => {
      if (activeDangerZone) {
          // Timer tick
          dangerTimerRef.current = setInterval(() => {
              setActiveDangerZone(prev => {
                  if (!prev) return null;
                  const newTime = prev.timeRemaining - 1;
                  
                  // Check Penalty
                  if (newTime <= 0) {
                      if (!penalizedZones.has(prev.id)) {
                          // Look up specific penalty for this zone
                          const zoneConfig = activeGame?.dangerZones?.find(z => z.id === prev.id);
                          const penaltyAmount = zoneConfig ? (zoneConfig.penalty !== undefined ? zoneConfig.penalty : 500) : 500;

                          // Apply Penalty
                          setGameState(curr => ({ ...curr, score: Math.max(0, curr.score - penaltyAmount) }));
                          setPenalizedZones(prevSet => new Set(prevSet).add(prev.id));
                          
                          // Sync penalty to team score if playing in a team
                          if (gameState.teamName && activeGame) {
                              const teamId = `team-${gameState.teamName.replace(/\s+/g, '-').toLowerCase()}-${activeGame.id}`;
                              db.updateTeamScore(teamId, -penaltyAmount);
                          }
                      }
                      return { ...prev, timeRemaining: 0 };
                  }
                  return { ...prev, timeRemaining: newTime };
              });
          }, 1000);
      } else {
          clearInterval(dangerTimerRef.current);
      }

      return () => clearInterval(dangerTimerRef.current);
  }, [activeDangerZone?.id, activeGame]); 


  useEffect(() => {
      if (showChatDrawer) {
          setUnreadMessagesCount(0);
      }
  }, [showChatDrawer]);

  // Instructor Mode: Periodically fetch teams list for Chat Drawer targeting
  useEffect(() => {
      if ((mode === GameMode.INSTRUCTOR || showLanding) && activeGame) {
          const fetchTeams = async () => {
              const teams = await db.fetchTeams(activeGame.id);
              setInstructorTeams(teams);
          };
          fetchTeams();
          const interval = setInterval(fetchTeams, 15000);
          return () => clearInterval(interval);
      }
  }, [mode, activeGame, showLanding]);

  const updateActiveGame = (updatedGame: Game) => {
      // If editing a template, update local state only
      if (editingTemplateId) {
          setActiveTemplateGame(updatedGame);
          return;
      }

      setGameState(prev => ({
          ...prev,
          games: prev.games.map(g => g.id === updatedGame.id ? updatedGame : g)
      }));

      if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
          db.saveGame(updatedGame);
      }, 1000); 
  };

  const handleUpdateTaskList = async (list: TaskList) => {
      await db.saveTaskList(list);
      const lists = await db.fetchTaskLists();
      setGameState(prev => ({ ...prev, taskLists: lists }));
  };

  const handleToggleMode = () => {
      const nextMode = mode === GameMode.PLAY ? GameMode.EDIT : (mode === GameMode.EDIT ? GameMode.INSTRUCTOR : GameMode.PLAY);
      setMode(nextMode);
      localStorage.setItem(STORAGE_KEY_MODE, nextMode);

      if ((nextMode === GameMode.EDIT || nextMode === GameMode.INSTRUCTOR) && !gameState.activeGameId && !editingTemplateId) {
          setShowGameChooser(true);
      }
  };

  const handleToggleScores = () => {
      const newVal = !showScores;
      setShowScores(newVal);
      localStorage.setItem('geohunt_show_scores', String(newVal));
  };

  const handleCreateGame = async (gameData: Partial<Game>, fromListId?: string) => {
      const newGame: Game = {
          id: `game-${Date.now()}`,
          name: gameData.name || 'New Game',
          description: gameData.description || '',
          points: [],
          dangerZones: [],
          createdAt: Date.now(),
          client: gameData.client,
          timerConfig: gameData.timerConfig
      };

      if (fromListId) {
          const list = gameState.taskLists.find(l => l.id === fromListId);
          if (list) {
              newGame.points = list.tasks.map((t, i) => ({
                  ...t,
                  id: `p-${Date.now()}-${i}`,
                  location: { lat: 0, lng: 0 }, 
                  radiusMeters: 30,
                  activationTypes: ['radius'],
                  isUnlocked: true,
                  isCompleted: false,
                  order: i
              }));
          }
      }

      await db.saveGame(newGame);
      setGameState(prev => ({ ...prev, games: [...prev.games, newGame], activeGameId: newGame.id }));
      localStorage.setItem(STORAGE_KEY_GAME_ID, newGame.id);
      
      setShowGameCreator(false);
      setShowGameChooser(false);
      setMode(GameMode.EDIT);
      setShowLanding(false);
  };

  const handleUpdateGameMetadata = async (data: Partial<Game>) => {
      if (!editingGameMetadataId) return;
      const game = gameState.games.find(g => g.id === editingGameMetadataId);
      if (!game) return;

      const updatedGame = { ...game, ...data };
      await db.saveGame(updatedGame);
      setGameState(prev => ({
          ...prev,
          games: prev.games.map(g => g.id === editingGameMetadataId ? updatedGame : g)
      }));
      setShowGameCreator(false);
      setEditingGameMetadataId(null);
  };

  // Unified Game Selection Handler
  const handleSelectGame = (gameId: string) => {
      setGameState(prev => ({ ...prev, activeGameId: gameId }));
      localStorage.setItem(STORAGE_KEY_GAME_ID, gameId);
      
      setShowGameChooser(false);
      setShowDashboard(false);
      setShowLanding(false);
      
      // Force EDIT mode on desktop (large screens)
      ensureDesktopMode();
  };

  const handleStartGame = (gameId: string, teamName: string, userName: string) => {
      localStorage.setItem(STORAGE_KEY_GAME_ID, gameId);
      localStorage.setItem(STORAGE_KEY_TEAM_NAME, teamName);
      localStorage.setItem(STORAGE_KEY_USER_NAME, userName);
      
      setGameState(prev => ({ ...prev, activeGameId: gameId, teamName, userName }));
      
      const teamId = `team-${teamName.replace(/\s+/g, '-').toLowerCase()}-${gameId}`;
      const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      const newTeam: Team = {
          id: teamId,
          gameId,
          name: teamName,
          joinCode,
          score: 0,
          members: [{ name: userName, deviceId: teamSync.getDeviceId() }],
          updatedAt: new Date().toISOString(),
          captainDeviceId: teamSync.getDeviceId(),
          isStarted: true,
          completedPointIds: []
      };
      
      db.registerTeam(newTeam);
      teamSync.connect(gameId, teamName, userName);
      setShowWelcome(false);
      setShowLanding(false);
  };

  const handleAddTask = (type: 'MANUAL' | 'AI' | 'LIBRARY', playgroundId?: string) => {
      if (!activeGame) return;
      const center = mapRef.current?.getCenter() || gameState.userLocation || { lat: 0, lng: 0 };
      
      if (type === 'AI') {
          setShowAiGenerator(true);
      } else if (type === 'LIBRARY') {
          setTaskMasterTab('LIBRARY');
          setShowTaskMaster(true);
      } else {
          const newPoint: GamePoint = {
              id: `p-${Date.now()}`,
              title: 'New Task',
              iconId: 'default',
              location: center,
              radiusMeters: 30,
              activationTypes: ['radius'],
              isUnlocked: true,
              isCompleted: false,
              order: activeGame.points.length,
              points: 100,
              task: { type: 'text', question: 'Edit this question...' },
              playgroundId,
              playgroundPosition: playgroundId ? { x: 50, y: 50 } : undefined
          };
          updateActiveGame({ ...activeGame, points: [...activeGame.points, newPoint] });
          setEditingPoint(newPoint);
      }
  };

  const handleAddDangerZone = () => {
      if (!activeGame) return;
      const center = mapRef.current?.getCenter() || gameState.userLocation || { lat: 0, lng: 0 };
      const newZone: DangerZone = {
          id: `dz-${Date.now()}`,
          location: center,
          radius: 25, 
          penalty: 500,
          duration: 10 // Default duration
      };
      updateActiveGame({ ...activeGame, dangerZones: [...(activeGame.dangerZones || []), newZone] });
  };

  const handleUpdateDangerZone = (updatedZone: DangerZone) => {
      if (!activeGame) return;
      const updatedZones = (activeGame.dangerZones || []).map(z => z.id === updatedZone.id ? updatedZone : z);
      updateActiveGame({ ...activeGame, dangerZones: updatedZones });
  };

  const handleRelocateGame = () => {
      if (isRelocating) {
          if (!activeGame || activeGame.points.length === 0) {
              setIsRelocating(false);
              return;
          }
          const mapCenter = mapRef.current?.getCenter();
          if (!mapCenter) return;

          const mapPoints = activeGame.points.filter(p => !p.playgroundId && !p.isSectionHeader);
          
          if (mapPoints.length === 0) {
              setIsRelocating(false);
              return;
          }

          const lats = mapPoints.map(p => p.location.lat);
          const lngs = mapPoints.map(p => p.location.lng);
          const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
          const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

          const deltaLat = mapCenter.lat - avgLat;
          const deltaLng = mapCenter.lng - avgLng;

          const updatedPoints = activeGame.points.map(p => {
              if (p.playgroundId || p.isSectionHeader) return p;
              return {
                  ...p,
                  location: {
                      lat: p.location.lat + deltaLat,
                      lng: p.location.lng + deltaLng
                  }
              };
          });

          // Relocate Danger Zones too
          const updatedZones = (activeGame.dangerZones || []).map(z => ({
              ...z,
              location: {
                  lat: z.location.lat + deltaLat,
                  lng: z.location.lng + deltaLng
              }
          }));

          updateActiveGame({ ...activeGame, points: updatedPoints, dangerZones: updatedZones });
          setIsRelocating(false);
      } else {
          setIsRelocating(true);
      }
  };

  const handlePointClick = (point: GamePoint) => {
      if (isMeasuring) {
          setMeasureNodes(prev => [...prev, { type: 'point', id: point.id }]);
          return;
      }

      if (isDrawingLogic && activeGame) {
          const source = activeGame.points.find(p => p.id === isDrawingLogic.sourcePointId);
          if (source && source.id !== point.id) {
              const newAction = {
                  id: `act-${Date.now()}`,
                  type: 'unlock' as const, 
                  targetId: point.id
              };
              
              const updatedLogic = { ...source.logic };
              const trigger = isDrawingLogic.trigger;
              updatedLogic[trigger] = [...(updatedLogic[trigger] || []), newAction];
              
              const updatedPoints = activeGame.points.map(p => p.id === source.id ? { ...p, logic: updatedLogic } : p);
              updateActiveGame({ ...activeGame, points: updatedPoints });
              
              alert(`Logic Link Created: ${source.title} -> ${point.title}`);
          }
          setIsDrawingLogic(null);
          return;
      }

      if (mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR) {
          setSelectedPoint(point);
      } else if (mode === GameMode.EDIT) {
          setShowContextMenu({ point });
      }
  };

  const handleLandingAction = (action: 'USERS' | 'TEAMS' | 'GAMES' | 'TASKS' | 'TASKLIST' | 'TEAMZONE' | 'EDIT_GAME' | 'PLAY' | 'TEMPLATES' | 'PLAYGROUNDS' | 'DASHBOARD' | 'TAGS' | 'ADMIN' | 'CLIENT_PORTAL' | 'QR_CODES' | 'CHAT' | 'TEAM_LOBBY') => {
      switch(action) {
          case 'PLAY':
              setShowLanding(false);
              setShowWelcome(true);
              setMode(GameMode.PLAY);
              break;
          case 'EDIT_GAME':
              setShowLanding(false);
              setMode(GameMode.EDIT);
              if (!gameState.activeGameId) setShowGameChooser(true);
              break;
          case 'GAMES':
              setShowLanding(false);
              setShowGameChooser(true);
              break;
          case 'TEAMS':
              setShowLanding(false);
              setShowTeamsHub(true);
              break;
          case 'TEAMZONE':
              setShowLanding(false);
              setShowTeamDashboard(true);
              break;
          case 'DASHBOARD':
              setShowLanding(false);
              setShowDashboard(true);
              setDashboardTab('dashboard');
              break;
          case 'USERS':
              setShowLanding(false);
              setShowDashboard(true);
              setDashboardTab('users');
              break;
          case 'TAGS':
              setShowLanding(false);
              setShowDashboard(true);
              setDashboardTab('tags');
              break;
          case 'TASKS':
              setShowLanding(false);
              setShowTaskMaster(true);
              setTaskMasterTab('LIBRARY');
              break;
          case 'TASKLIST':
              setShowLanding(false);
              setShowTaskMaster(true);
              setTaskMasterTab('LISTS');
              break;
          case 'QR_CODES':
              setShowLanding(false);
              setShowTaskMaster(true);
              setTaskMasterTab('QR');
              break;
          case 'TEMPLATES':
              setShowLanding(false);
              setShowDashboard(true);
              setDashboardTab('templates');
              break;
          case 'PLAYGROUNDS':
              setShowLanding(false);
              setShowPlaygroundManager(true);
              break;
          case 'CLIENT_PORTAL':
              setShowLanding(false);
              setShowDashboard(true);
              setDashboardTab('client');
              break;
          case 'ADMIN':
              setShowAdminModal(true);
              break;
          case 'CHAT':
              if (!activeGame) {
                  alert("Please select a session first.");
                  return;
              }
              setShowChatDrawer(true);
              break;
          case 'TEAM_LOBBY':
              if (!activeGame) {
                  alert("Please select a session first.");
                  return;
              }
              // Admin mode for teams modal
              setTeamsModalAdmin(true);
              setShowTeamsModal(true);
              break;
      }
  };

  const handleFitBounds = () => {
      if (activeGame?.points.length) mapRef.current?.fitBounds(activeGame.points);
  };

  const handleLocateMe = () => {
      if (gameState.userLocation) mapRef.current?.jumpTo(gameState.userLocation);
  };

  const handlePointMove = (id: string, loc: Coordinate) => {
      if (!activeGame) return;
      
      // Check if it's a playground drag (playground ids usually start with 'pg-')
      const pgIndex = activeGame.playgrounds?.findIndex(p => p.id === id);
      if (pgIndex !== undefined && pgIndex !== -1 && activeGame.playgrounds) {
          const updatedPlaygrounds = [...activeGame.playgrounds];
          updatedPlaygrounds[pgIndex] = { ...updatedPlaygrounds[pgIndex], location: loc };
          updateActiveGame({ ...activeGame, playgrounds: updatedPlaygrounds });
          return;
      }

      // Check if it's a Danger Zone
      const dzIndex = activeGame.dangerZones?.findIndex(z => z.id === id);
      if (dzIndex !== undefined && dzIndex !== -1 && activeGame.dangerZones) {
          const updatedZones = [...activeGame.dangerZones];
          updatedZones[dzIndex] = { ...updatedZones[dzIndex], location: loc };
          updateActiveGame({ ...activeGame, dangerZones: updatedZones });
          return;
      }

      // Normal point drag
      const updatedPoints = activeGame.points.map(p => p.id === id ? { ...p, location: loc } : p);
      updateActiveGame({ ...activeGame, points: updatedPoints });
  };

  const handleDeleteDangerZone = (id: string) => {
      if (!activeGame) return;
      const updatedZones = (activeGame.dangerZones || []).filter(z => z.id !== id);
      updateActiveGame({ ...activeGame, dangerZones: updatedZones });
  };

  // --- TEMPLATE EDITING FUNCTIONS ---
  const createPlaygroundTemplate = () => {
      const newPlayground: Playground = {
          id: `pg-${Date.now()}`,
          title: 'New Template Zone',
          buttonVisible: true,
          backgroundStyle: 'contain',
          iconId: 'default',
          buttonSize: 80
      };
      
      // Create a MOCK Game to hold this single template for editing
      const templateGame: Game = {
          id: `tpl-game-${Date.now()}`, 
          name: 'Template Editor',
          description: 'Temporary game for editing playground template',
          points: [],
          playgrounds: [newPlayground],
          createdAt: Date.now()
      };

      setActiveTemplateGame(templateGame);
      setEditingTemplateId('new'); // Marker for new template
      setShowPlaygroundManager(false);
      setShowLanding(false);
      setMode(GameMode.EDIT);
      setShowPlaygroundEditor(true);
  };

  const editPlaygroundTemplate = (tpl: PlaygroundTemplate) => {
      // Reconstruct a MOCK Game from the template data
      const templateGame: Game = {
          id: `tpl-game-${tpl.id}`,
          name: tpl.title,
          description: 'Editing Template',
          points: tpl.tasks,
          playgrounds: [tpl.playgroundData],
          createdAt: tpl.createdAt
      };

      setActiveTemplateGame(templateGame);
      setEditingTemplateId(tpl.id);
      setShowPlaygroundManager(false);
      setShowLanding(false);
      setMode(GameMode.EDIT);
      setShowPlaygroundEditor(true);
  };

  const savePlaygroundTemplate = async (templateName: string) => {
      if (!activeTemplateGame || !activeTemplateGame.playgrounds || activeTemplateGame.playgrounds.length === 0) return;
      
      const pgData = activeTemplateGame.playgrounds[0];
      const template: PlaygroundTemplate = {
          id: editingTemplateId === 'new' ? `pg-tpl-${Date.now()}` : editingTemplateId!,
          title: templateName,
          playgroundData: { ...pgData, title: templateName },
          tasks: activeTemplateGame.points,
          createdAt: Date.now(),
          isGlobal: true // Force global when saved from manager
      };

      await db.savePlaygroundTemplate(template);
      
      // Exit editor and return to manager
      setEditingTemplateId(null);
      setActiveTemplateGame(null);
      setShowPlaygroundEditor(false);
      setShowPlaygroundManager(true); 
  };

  if (clientSubmissionToken) {
      return <ClientSubmissionView token={clientSubmissionToken} />;
  }

  // Find the DangerZone being edited
  const editingDangerZone = activeGame?.dangerZones?.find(z => z.id === editingDangerZoneId);

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-900 text-white font-sans">
      {/* MAP LAYER */}
      <div className="absolute inset-0 z-0">
          {activeGame && (
              <GameMap 
                  ref={mapRef}
                  userLocation={gameState.userLocation}
                  points={displayPoints}
                  mode={mode}
                  mapStyle={mapStyle}
                  selectedPointId={selectedPoint?.id}
                  isRelocating={isRelocating}
                  measurePath={measurePath}
                  logicLinks={logicInfo.links}
                  playgroundMarkers={logicInfo.playgroundMarkers} 
                  dangerZones={activeGame.dangerZones} 
                  dependentPointIds={dependentPointIds}
                  onPointClick={handlePointClick}
                  showScores={showScores}
                  onMapClick={(coord) => {
                      if (mode === GameMode.EDIT && isMeasuring) {
                          setMeasureNodes(prev => [...prev, { type: 'coord', loc: coord }]);
                      }
                  }}
                  onPointMove={handlePointMove}
                  onDeletePoint={(id) => {
                      if (!activeGame) return;
                      // Determine if removing point or zone
                      if (id.startsWith('dz-')) {
                          handleDeleteDangerZone(id);
                      } else {
                          updateActiveGame({ ...activeGame, points: activeGame.points.filter(p => p.id !== id) });
                      }
                  }}
                  accuracy={gameState.gpsAccuracy}
                  onZoneClick={(zone) => setEditingDangerZoneId(zone.id)} // Trigger modal
              />
          )}
      </div>

      {/* HUD LAYER */}
      {!showLanding && !showWelcome && !showPlaygroundManager && (
          <GameHUD 
              accuracy={gameState.gpsAccuracy}
              mode={mode}
              toggleMode={handleToggleMode}
              onSetMode={setMode} // New prop
              onOpenGameManager={() => setShowGameManager(true)}
              onOpenTaskMaster={() => { setTaskMasterTab('LIBRARY'); setShowTaskMaster(true); }}
              onOpenTeams={() => setShowTeamsHub(true)}
              mapStyle={mapStyle}
              onSetMapStyle={setMapStyle}
              language={language}
              onBackToHub={() => {
                  if (editingTemplateId) {
                      // If editing template, go back to manager
                      setEditingTemplateId(null);
                      setActiveTemplateGame(null);
                      setShowPlaygroundManager(true);
                  } else {
                      setShowLanding(true);
                  }
                  ensureDesktopMode(); // Force Edit Mode on Hub return
              }}
              activeGameName={activeGame?.name}
              onOpenInstructorDashboard={() => setShowInstructorDashboard(true)}
              isMeasuring={isMeasuring}
              onToggleMeasure={() => { setIsMeasuring(!isMeasuring); setMeasureNodes([]); }}
              measuredDistance={measuredDistance}
              playgrounds={activeGame?.playgrounds}
              onOpenPlayground={(id) => {
                  if (mode === GameMode.EDIT) {
                      setShowPlaygroundEditor(true);
                  } else {
                      setViewingPlaygroundId(id);
                  }
              }} 
              onOpenTeamDashboard={() => setShowTeamDashboard(true)}
              onRelocateGame={handleRelocateGame}
              isRelocating={isRelocating}
              timerConfig={activeGame?.timerConfig}
              onFitBounds={handleFitBounds}
              onLocateMe={handleLocateMe}
              onSearchLocation={(coord) => mapRef.current?.jumpTo(coord)}
              isDrawerExpanded={isDrawerExpanded}
              showScores={showScores}
              onToggleScores={handleToggleScores}
              hiddenPlaygroundIds={mode === GameMode.PLAY ? hiddenPlaygroundIds : []}
              onToggleChat={() => setShowChatDrawer(prev => !prev)}
              unreadMessagesCount={unreadMessagesCount}
              targetPlaygroundId={targetPlaygroundId}
              onAddDangerZone={handleAddDangerZone} 
              activeDangerZone={activeDangerZone} 
          />
      )}

      {/* OVERLAYS & MODALS */}
      
      {showLanding && (
          <InitialLanding 
              onAction={handleLandingAction}
              version="2.0.0"
              games={gameState.games}
              activeGameId={gameState.activeGameId}
              onSelectGame={handleSelectGame}
          />
      )}

      {showPlaygroundManager && (
          <PlaygroundManager 
              onClose={() => { 
                  setShowPlaygroundManager(false); 
                  setShowLanding(true);
                  ensureDesktopMode();
              }}
              onEdit={editPlaygroundTemplate}
              onCreate={createPlaygroundTemplate}
          />
      )}

      {showWelcome && (
          <WelcomeScreen 
              games={gameState.games}
              userLocation={gameState.userLocation}
              onStartGame={handleStartGame}
              onSetMapStyle={setMapStyle}
              language={language}
              onSetLanguage={setLanguage}
              onBack={() => {
                  setShowWelcome(false);
                  setShowLanding(true);
                  ensureDesktopMode();
              }}
              onInstructorLogin={() => {
                  setMode(GameMode.INSTRUCTOR);
                  setShowWelcome(false);
                  setShowLanding(false);
              }}
          />
      )}

      {/* DANGER ZONE EDITOR MODAL */}
      {editingDangerZone && mode === GameMode.EDIT && (
          <DangerZoneModal 
              zone={editingDangerZone}
              onSave={handleUpdateDangerZone}
              onDelete={() => { handleDeleteDangerZone(editingDangerZone.id); setEditingDangerZoneId(null); }}
              onClose={() => setEditingDangerZoneId(null)}
          />
      )}

      {mode === GameMode.EDIT && !showLanding && !showPlaygroundManager && (
        <EditorDrawer 
          onClose={() => setMode(GameMode.PLAY)} 
          activeGame={activeGame}
          activeGameName={activeGame?.name || "No game selected"} 
          points={displayPoints} 
          allPoints={activeGame?.points}
          taskLists={Array.isArray(gameState.taskLists) ? gameState.taskLists : []} 
          games={Array.isArray(gameState.games) ? gameState.games : []}
          onSelectGame={handleSelectGame}
          onOpenGameChooser={() => setShowGameChooser(true)}
          sourceListId={sourceListId} 
          onSetSourceListId={setSourceListId} 
          onEditPoint={(p) => setEditingPoint(p)} 
          onSelectPoint={(p) => { 
              if (isMeasuring) {
                  setMeasureNodes(prev => [...prev, { type: 'point', id: p.id }]);
              } else {
                  setSelectedPoint(p); 
                  mapRef.current?.jumpTo(p.location); 
              }
          }} 
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
          onSaveGame={() => activeGame && db.saveGame(activeGame)} 
          onOpenTaskMaster={() => { setTaskMasterTab('LISTS'); setTaskMasterEditingListId(null); setShowTaskMaster(true); }} 
          onFitBounds={() => {
              if (activeGame?.points.length) mapRef.current?.fitBounds(activeGame.points);
          }} 
          onOpenPlaygroundEditor={() => setShowPlaygroundEditor(true)}
          initialExpanded={forceExpandDrawer}
          onAddTask={handleAddTask} 
          userLocation={gameState.userLocation}
          onSearchLocation={(coord) => mapRef.current?.jumpTo(coord)}
          onExpandChange={setIsDrawerExpanded}
        />
      )}

      {selectedPoint && (mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR) && (
          <TaskModal 
              point={selectedPoint}
              onClose={() => setSelectedPoint(null)}
              onComplete={(id, score) => {
                  if (activeGame) {
                      const updatedPoints = activeGame.points.map(p => p.id === id ? { ...p, isCompleted: true } : p);
                      updateActiveGame({ ...activeGame, points: updatedPoints });
                      setGameState(prev => ({ ...prev, score: prev.score + (score || 0) }));
                      if (gameState.teamName && activeGame) {
                          const teamId = `team-${gameState.teamName.replace(/\s+/g, '-').toLowerCase()}-${activeGame.id}`;
                          db.updateTeamProgress(teamId, id, gameState.score + (score || 0));
                      }
                  }
              }}
              onPenalty={(amt) => setGameState(prev => ({ ...prev, score: Math.max(0, prev.score - amt) }))}
              distance={haversineMeters(gameState.userLocation, selectedPoint.location)}
              onUnlock={(id) => {
                  if (activeGame) {
                      const updated = activeGame.points.map(p => p.id === id ? { ...p, isUnlocked: true } : p);
                      updateActiveGame({ ...activeGame, points: updated });
                  }
              }}
              mode={mode}
              isInstructorMode={mode === GameMode.INSTRUCTOR}
          />
      )}

      {editingPoint && mode === GameMode.EDIT && (
          <TaskEditor 
              point={editingPoint}
              onSave={(updated) => {
                  if (activeGame) {
                      const updatedPoints = activeGame.points.map(p => p.id === updated.id ? updated : p);
                      updateActiveGame({ ...activeGame, points: updatedPoints });
                  }
                  setEditingPoint(null);
              }}
              onDelete={(id) => {
                  if (activeGame) {
                      updateActiveGame({ ...activeGame, points: activeGame.points.filter(p => p.id !== id) });
                  }
                  setEditingPoint(null);
              }}
              onClose={() => setEditingPoint(null)}
              onClone={(p) => {
                  if (activeGame) {
                      const clone = { ...p, id: `p-${Date.now()}`, location: { lat: p.location.lat + 0.0001, lng: p.location.lng + 0.0001 }, title: `${p.title} (Copy)` };
                      updateActiveGame({ ...activeGame, points: [...activeGame.points, clone] });
                  }
              }}
          />
      )}

      {showContextMenu && (
          <PointContextMenu 
              point={showContextMenu.point}
              onClose={() => setShowContextMenu(null)}
              onEdit={() => {
                  setEditingPoint(showContextMenu.point);
                  setShowContextMenu(null);
              }}
              onSwap={() => {
                  setEditingPoint(showContextMenu.point);
                  setShowContextMenu(null);
              }}
              onAction={() => {
                  setShowActionModal(true);
                  setEditingPoint(showContextMenu.point);
                  setShowContextMenu(null);
              }}
          />
      )}

      {showActionModal && editingPoint && activeGame && (
          <TaskActionModal 
              point={editingPoint}
              allPoints={activeGame.points}
              playgrounds={activeGame.playgrounds}
              onClose={() => {
                  setShowActionModal(false);
                  setEditingPoint(null); 
              }}
              onSave={(updatedPoint) => {
                  const updatedPoints = activeGame.points.map(p => p.id === updatedPoint.id ? updatedPoint : p);
                  updateActiveGame({ ...activeGame, points: updatedPoints });
              }}
              onStartDrawMode={(trigger) => {
                  setIsDrawingLogic({ trigger, sourcePointId: editingPoint.id });
                  setShowActionModal(false);
                  setEditingPoint(null);
                  alert(`Drawing Mode: Click target task to link ${trigger}`);
              }}
          />
      )}

      {showPlaygroundEditor && activeGame && (
          <PlaygroundEditor 
              game={activeGame}
              onUpdateGame={updateActiveGame}
              onClose={() => {
                  setShowPlaygroundEditor(false);
                  // FORCE EDIT MODE ON DESKTOP WHEN CLOSING EDITOR
                  ensureDesktopMode();
              }}
              onEditPoint={setEditingPoint}
              onPointClick={handlePointClick} 
              onAddTask={handleAddTask}
              onOpenLibrary={() => setShowPlaygroundLibrary(true)}
              showScores={showScores}
              onToggleScores={handleToggleScores}
              onHome={() => {
                  setShowPlaygroundEditor(false);
                  if (editingTemplateId) {
                      setEditingTemplateId(null);
                      setActiveTemplateGame(null);
                      setShowPlaygroundManager(true);
                  } else {
                      setShowLanding(true);
                  }
                  ensureDesktopMode();
              }}
              onSaveTemplate={editingTemplateId ? savePlaygroundTemplate : undefined} // Only pass if in template mode
          />
      )}

      {viewingPlaygroundId && activeGame && (
          <PlaygroundModal 
              playground={activeGame.playgrounds?.find(p => p.id === viewingPlaygroundId)!}
              points={activeGame.points}
              onClose={() => setViewingPlaygroundId(null)}
              onPointClick={(p) => {
                  if (mode === GameMode.INSTRUCTOR) {
                      setSelectedPoint(p);
                  } else {
                      setSelectedPoint(p);
                  }
              }}
              mode={mode}
          />
      )}

      {showDashboard && (
          <Dashboard 
              games={gameState.games}
              taskLists={gameState.taskLists}
              taskLibrary={gameState.taskLibrary}
              onBack={() => {
                  setShowDashboard(false);
                  setShowLanding(true);
                  ensureDesktopMode();
              }}
              onAction={(action) => {
                  if (action === 'CREATE') { setShowGameCreator(true); }
                  if (action === 'EDIT_GAME') { setShowDashboard(false); setMode(GameMode.EDIT); if(!gameState.activeGameId) setShowGameChooser(true); }
                  if (action === 'VIEW_TEMPLATES') { setTaskMasterTab('LISTS'); setShowTaskMaster(true); }
                  if (action === 'VIEW_TASKS') { setTaskMasterTab('LIBRARY'); setShowTaskMaster(true); }
              }}
              userName={gameState.userName || 'Guest'}
              initialTab={dashboardTab}
              onDeleteTagGlobally={async (tag) => { await db.purgeTagGlobally(tag); }}
              onRenameTagGlobally={async (oldT, newT) => { await db.renameTagGlobally(oldT, newT); }}
              onSelectGame={handleSelectGame} // NEW PROP
          />
      )}

      {showAdminModal && (
          <AdminModal 
              games={gameState.games} 
              onClose={() => setShowAdminModal(false)}
              onDeleteGame={async (id) => {
                   await db.deleteGame(id);
                   const games = await db.fetchGames();
                   setGameState(prev => ({ ...prev, games }));
              }}
          />
      )}

      {showTaskMaster && (
          <TaskMaster 
              library={gameState.taskLibrary}
              lists={gameState.taskLists}
              initialTab={taskMasterTab}
              onClose={() => {
                  setShowTaskMaster(false);
                  if (!activeGame && !showDashboard && !editingTemplateId) setShowLanding(true);
                  ensureDesktopMode();
              }}
              onSaveTemplate={async (t) => {
                  await db.saveTemplate(t);
                  const lib = await db.fetchLibrary();
                  setGameState(prev => ({ ...prev, taskLibrary: lib }));
              }}
              onDeleteTemplate={async (id) => {
                  await db.deleteTemplate(id);
                  const lib = await db.fetchLibrary();
                  setGameState(prev => ({ ...prev, taskLibrary: lib }));
              }}
              onSaveList={async (l) => {
                  await db.saveTaskList(l);
                  const lists = await db.fetchTaskLists();
                  setGameState(prev => ({ ...prev, taskLists: lists }));
              }}
              onDeleteList={async (id) => {
                  await db.deleteTaskList(id);
                  const lists = await db.fetchTaskLists();
                  setGameState(prev => ({ ...prev, taskLists: lists }));
              }}
              onCreateGameFromList={(id) => {
                  handleCreateGame({ name: 'From Template' }, id);
                  setShowTaskMaster(false);
              }}
              games={gameState.games}
              activeGameId={activeGame?.id}
              onAddTasksToGame={(gid, tasks) => {
                  const targetGame = gameState.games.find(g => g.id === gid);
                  if (targetGame) {
                      const newPoints = tasks.map((t, i) => ({
                          ...t,
                          id: `p-${Date.now()}-${i}`,
                          location: { lat: 0, lng: 0 },
                          radiusMeters: 30,
                          activationTypes: ['radius'],
                          isUnlocked: true,
                          isCompleted: false,
                          order: targetGame.points.length + i
                      } as GamePoint));
                      updateActiveGame({ ...targetGame, points: [...targetGame.points, ...newPoints] });
                  }
              }}
              initialEditingListId={taskMasterEditingListId}
          />
      )}

      {showGameChooser && (
          <GameChooser 
              games={gameState.games}
              taskLists={gameState.taskLists}
              onSelectGame={handleSelectGame}
              onCreateGame={(name, fromId) => handleCreateGame({ name }, fromId)}
              onClose={() => {
                  setShowGameChooser(false);
                  if (!activeGame) setShowLanding(true);
                  ensureDesktopMode();
              }}
              onSaveAsTemplate={async (gid, name) => {
                  const g = gameState.games.find(x => x.id === gid);
                  if (g) {
                      const newList: TaskList = {
                          id: `list-${Date.now()}`,
                          name,
                          description: g.description,
                          tasks: g.points.map(p => ({ ...p, id: `tpl-${Date.now()}-${p.id}` })),
                          color: '#3b82f6',
                          createdAt: Date.now()
                      };
                      await db.saveTaskList(newList);
                      const lists = await db.fetchTaskLists();
                      setGameState(prev => ({ ...prev, taskLists: lists }));
                  }
              }}
              onOpenGameCreator={() => setShowGameCreator(true)}
              onRefresh={async () => {
                  const [g, l, t] = await Promise.all([db.fetchGames(), db.fetchTaskLists(), db.fetchLibrary()]);
                  setGameState(prev => ({ ...prev, games: g, taskLists: l, taskLibrary: t }));
              }}
              onUpdateList={handleUpdateTaskList}
              onEditGame={(id) => {
                  setEditingGameMetadataId(id);
                  setShowGameCreator(true);
              }}
          />
      )}

      {showGameCreator && (
          <GameCreator 
              onClose={() => {
                  setShowGameCreator(false);
                  setEditingGameMetadataId(null);
              }}
              onCreate={(data) => {
                  if (editingGameMetadataId) {
                      handleUpdateGameMetadata(data);
                  } else {
                      handleCreateGame(data);
                  }
              }}
              baseGame={editingGameMetadataId ? gameState.games.find(g => g.id === editingGameMetadataId) : undefined}
          />
      )}

      {showAiGenerator && activeGame && (
          <AiTaskGenerator 
              onClose={() => setShowAiGenerator(false)}
              onAddTasks={(tasks) => {
                  const newPoints = tasks.map((t, i) => ({
                      ...t,
                      id: `p-${Date.now()}-${i}`,
                      location: mapRef.current?.getCenter() || { lat: 0, lng: 0 },
                      radiusMeters: 30,
                      activationTypes: ['radius'],
                      isUnlocked: true,
                      isCompleted: false,
                      order: activeGame.points.length + i,
                      points: 100
                  } as GamePoint));
                  updateActiveGame({ ...activeGame, points: [...activeGame.points, ...newPoints] });
              }}
          />
      )}

      {showInstructorDashboard && activeGame && (
          <InstructorDashboard 
              game={activeGame}
              onClose={() => setShowInstructorDashboard(false)}
          />
      )}

      {showTeamDashboard && activeGame && (
          <TeamDashboard 
              gameId={activeGame.id}
              teamId={`team-${gameState.teamName?.replace(/\s+/g, '-').toLowerCase()}-${activeGame.id}`}
              totalMapPoints={activeGame.points.length}
              onOpenAgents={() => setShowTeamsModal(true)}
              onClose={() => setShowTeamDashboard(false)}
              chatHistory={chatHistory} 
          />
      )}

      {showTeamsHub && (
          <TeamsHubModal 
              onClose={() => {
                  setShowTeamsHub(false);
                  if(!activeGame) setShowLanding(true);
                  ensureDesktopMode();
              }}
              onAction={(action) => {
                  setShowTeamsHub(false);
                  if (action === 'JOIN') setShowWelcome(true);
                  if (action === 'COMMAND') setShowTeamsModal(true);
              }}
          />
      )}

      {showTeamsModal && (
          <TeamsModal 
              gameId={activeGame?.id || null}
              games={gameState.games}
              onClose={() => { setShowTeamsModal(false); setTeamsModalAdmin(false); }}
              onSelectGame={handleSelectGame} // Updated to use common handler
              isAdmin={teamsModalAdmin}
          />
      )}

      {showPlaygroundLibrary && activeGame && (
          <PlaygroundLibraryModal 
              onClose={() => setShowPlaygroundLibrary(false)}
              onImport={(tpl) => {
                  const newPG = { ...tpl.playgroundData, id: `pg-${Date.now()}` };
                  const newTasks = tpl.tasks.map(t => ({ 
                      ...t, 
                      id: `p-${Date.now()}-${Math.random()}`, 
                      playgroundId: newPG.id 
                  }));
                  updateActiveGame({ 
                      ...activeGame, 
                      playgrounds: [...(activeGame.playgrounds || []), newPG],
                      points: [...activeGame.points, ...newTasks]
                  });
                  setShowPlaygroundLibrary(false);
              }}
          />
      )}

      {messagePopup && (
          <MessagePopup 
              message={messagePopup.message} 
              sender={messagePopup.sender} 
              isUrgent={messagePopup.isUrgent}
              onClose={() => setMessagePopup(null)} 
          />
      )}

      {/* Global Chat Drawer */}
      <ChatDrawer 
          isOpen={showChatDrawer} 
          onClose={() => setShowChatDrawer(false)}
          messages={chatHistory}
          gameId={activeGame?.id || ''}
          mode={mode}
          userName={gameState.userName || 'Anonymous'}
          teamId={gameState.teamId}
          teams={instructorTeams} // Pass fetched teams to Chat Drawer
      />

      {activeGame && mode === GameMode.PLAY && !showLanding && !showWelcome && (
          <GameStats 
              score={gameState.score} 
              pointsCount={{ 
                  total: activeGame.points.filter(p => !p.isSectionHeader).length, 
                  completed: activeGame.points.filter(p => p.isCompleted).length 
              }}
              nearestPointDistance={0} 
              language={language}
          />
      )}

    </div>
  );
};

export default App;
