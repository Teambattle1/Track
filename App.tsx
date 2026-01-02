import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Ruler, Crosshair, Navigation, Plus, Library } from 'lucide-react';
import { Game, GamePoint, TaskList, TaskTemplate, AuthUser, GameMode, Coordinate, MapStyleId, DangerZone, GameRoute, Team, ChatMessage, PlaygroundTemplate } from './types';
import { APP_VERSION } from './utils/version';
import * as db from './services/db';
import { supabase } from './lib/supabase';
import { authService } from './services/auth';
import { teamSync } from './services/teamSync';
import { LocationProvider, useLocation } from './contexts/LocationContext';
import { TagColorsProvider } from './contexts/TagColorsContext';
import { haversineMeters, isWithinRadius, isValidCoordinate } from './utils/geo';
import { snapPointsToRoad, isPointInBox } from './utils/mapbox';
import { generateDemoTeamHistory } from './services/teamHistoryDemo';
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
import GameStatsModal from './components/GameStatsModal';
import MapStyleLibrary from './components/MapStyleLibrary';
import QRCodesTool from './components/QRCodesTool';
import GameStatsTool from './components/GameStatsTool';
import MessagePopup from './components/MessagePopup';
import Dashboard from './components/Dashboard';
import DangerZoneModal from './components/DangerZoneModal';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import MeasureBox from './components/MeasureBox';
import SupabaseDiagnostic from './components/SupabaseDiagnostic';
import SupabaseToolsModal from './components/SupabaseToolsModal';
import ImpossibleTravelWarnings from './components/ImpossibleTravelWarnings';
import RemoteOverrideModal from './components/RemoteOverrideModal';
import ClientLobby from './components/ClientLobby';
import ClientGameChooser from './components/ClientGameChooser';
import Access from './components/Access';
import PlayzoneSelector from './components/PlayzoneSelector';
import TranslationsManager from './components/TranslationsManager';
import MediaManager from './components/MediaManager';
import MediaApprovalNotification from './components/MediaApprovalNotification';
import { approveMediaSubmission, rejectMediaSubmission } from './services/mediaUpload';
import { getConfiguredLanguagesForGame, validateTaskTranslations } from './utils/translationValidation';

// Inner App Component that consumes LocationContext
const GameApp: React.FC = () => {
  // --- AUTH & USER STATE ---
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  // --- SUPABASE DIAGNOSTIC ---
  const [showSupabaseDiagnostic, setShowSupabaseDiagnostic] = useState(false);
  const [showTranslationsManager, setShowTranslationsManager] = useState(false);

  // CRITICAL NULL CHECK: Validate props before rendering
  // This prevents crashes from undefined game/playground states
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
  const [taskMasterInitialModal, setTaskMasterInitialModal] = useState<'AI' | 'LOQUIZ' | null>(null);
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
  const [initialGameMode, setInitialGameMode] = useState<'standard' | 'playzone' | 'elimination' | null>(null);
  const [showGameStats, setShowGameStats] = useState(false);
  const [showMapStyleLibrary, setShowMapStyleLibrary] = useState(false);
  const [showQRCodesTool, setShowQRCodesTool] = useState(false);
  const [gameStatsTeams, setGameStatsTeams] = useState<Team[]>([]);
  const [showClientLobby, setShowClientLobby] = useState(false);
  const [showClientGameChooser, setShowClientGameChooser] = useState(false);
  const [clientGameId, setClientGameId] = useState<string | null>(null);
  const [showMediaManager, setShowMediaManager] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [showPlayzoneChoiceModal, setShowPlayzoneChoiceModal] = useState(false);
  const [showPlayzoneSelector, setShowPlayzoneSelector] = useState(false);

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
  const { userLocation, gpsAccuracy, error: locationError } = useLocation();
  const [locateAttempt, setLocateAttempt] = useState(false);
  const [locateFeedback, setLocateFeedback] = useState<string | null>(null);
  const [activeTaskModalId, setActiveTaskModalId] = useState<string | null>(null); // Storing ID instead of Object to prevent stale state
  const [score, setScore] = useState(0);
  const [showScores, setShowScores] = useState(true);
  const [showTaskId, setShowTaskId] = useState(true);
  const [showTaskTitle, setShowTaskTitle] = useState(true);
  const [showTaskActions, setShowTaskActions] = useState(true);
  const [showTeamPaths, setShowTeamPaths] = useState(false);
  const [showTeamPathSelector, setShowTeamPathSelector] = useState(false);
  const [selectedTeamPaths, setSelectedTeamPaths] = useState<string[]>([]); // Array of team IDs to show paths for
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [selectedTeamForFogOfWar, setSelectedTeamForFogOfWar] = useState<string | null>(null);
  const [teamsForFogOfWar, setTeamsForFogOfWar] = useState<Team[]>([]);
  const [showRemoteOverride, setShowRemoteOverride] = useState(false);
  const [hoveredPlaygroundId, setHoveredPlaygroundId] = useState<string | null>(null);

  // Layer toggles (all default to true/visible)
  const [showMapLayer, setShowMapLayer] = useState(true);
  const [showZoneLayer, setShowZoneLayer] = useState(true);
  const [showTaskLayer, setShowTaskLayer] = useState(true);
  const [showLiveLayer, setShowLiveLayer] = useState(true);

  const [currentDangerZone, setCurrentDangerZone] = useState<DangerZone | null>(null);
  const [activeDangerZone, setActiveDangerZone] = useState<DangerZone | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [latestMessage, setLatestMessage] = useState<ChatMessage | null>(null);
  
  // --- MAP STATE ---
  const [localMapStyle, setLocalMapStyle] = useState<MapStyleId>('osm');
  const mapRef = useRef<GameMapHandle>(null);
  const geofenceCheckRunningRef = useRef(false);
  const [isRelocating, setIsRelocating] = useState(false);
  const [relocateScopeCenter, setRelocateScopeCenter] = useState<Coordinate | null>(null);
  const [relocateAllTaskIds, setRelocateAllTaskIds] = useState<string[]>([]);

  // --- MEASUREMENT ---
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePath, setMeasurePath] = useState<Coordinate[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState(0);
  const [measurePointsCount, setMeasurePointsCount] = useState(0);
  const [selectedMeasurePointIds, setSelectedMeasurePointIds] = useState<string[]>([]);

  // --- SNAP TO ROAD ---
  const [snapToRoadMode, setSnapToRoadMode] = useState(false);
  const [snapSelectionStart, setSnapSelectionStart] = useState<Coordinate | null>(null);
  const [snapSelectionEnd, setSnapSelectionEnd] = useState<Coordinate | null>(null);
  const [selectedSnapTaskIds, setSelectedSnapTaskIds] = useState<string[]>([]);

  // --- HOVER STATE ---
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null); // List → Map
  const [hoveredDangerZoneId, setHoveredDangerZoneId] = useState<string | null>(null); // List → Map
  const [mapHoveredPointId, setMapHoveredPointId] = useState<string | null>(null); // Map → List (reverse)

  // --- DRAWER & TOOLBAR STATE ---
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    mapmode: true,
    layers: true,
    location: true,
    pins: true,
    show: true,
    tools: true,
  });
  const [collapsedZones, setCollapsedZones] = useState<Record<string, boolean>>({ 'map': false });

  // --- LOAD DRAWER STATES FROM ACTIVE GAME ---
  useEffect(() => {
    if (activeGame?.drawerStates) {
      if (activeGame.drawerStates.settingsCollapsedSections) {
        setCollapsedSections(activeGame.drawerStates.settingsCollapsedSections);
      }
    }
  }, [activeGame?.id]);

  // --- SUPABASE ERROR DETECTION ---
  useEffect(() => {
    const handleSupabaseError = (event: CustomEvent) => {
      console.error('[App] Supabase connection error detected:', event.detail);
      setShowSupabaseDiagnostic(true);
    };

    window.addEventListener('supabase-connection-error' as any, handleSupabaseError);
    return () => {
      window.removeEventListener('supabase-connection-error' as any, handleSupabaseError);
    };
  }, []);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      setShowLogin(false);
      const user = authService.getCurrentUser();
      if (user) {
        setAuthUser(user);
      }

      try {
        // Test database connection first
        const connectionTest = await db.testDatabaseConnection();
        if (!connectionTest.success) {
          console.error('[App] Database connection test failed on startup');
          setShowSupabaseDiagnostic(true);
          // Use demo data if connection fails
          setGames([]);
          setTaskLists([]);
          setTaskLibrary([]);
          return;
        }

        const loadedGames = await db.fetchGames();
        setGames(loadedGames);
        const loadedLists = await db.fetchTaskLists();
        setTaskLists(loadedLists);
        const loadedLib = await db.fetchLibrary();
        setTaskLibrary(loadedLib);

        // Restore last selected game from localStorage
        const savedGameId = localStorage.getItem('activeGameId');
        if (savedGameId && loadedGames.some(g => g.id === savedGameId)) {
          setActiveGameId(savedGameId);
        }
      } catch (error: any) {
        console.error('[App] Initialization error:', error);
        // Show diagnostic modal on initialization failure
        setShowSupabaseDiagnostic(true);
        setGames([]);
        setTaskLists([]);
        setTaskLibrary([]);
      }
    };
    init();
  }, []);

  // --- PERSIST ACTIVE GAME TO LOCALSTORAGE ---
  useEffect(() => {
    if (activeGameId) {
      localStorage.setItem('activeGameId', activeGameId);
    } else {
      localStorage.removeItem('activeGameId');
    }
  }, [activeGameId]);

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

          // Avoid overwriting local editor state while editing a point.
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


  useEffect(() => {
      if (activeGameId) {
          const game = games.find(g => g.id === activeGameId) || null;
          setActiveGame(game);
          if (game?.defaultMapStyle) setLocalMapStyle(game.defaultMapStyle);

          // For PLAYZONE games, go directly to playground editor, skip map view
          if (game?.gameMode === 'playzone') {
              setMode(GameMode.EDIT);
              // Open the first playground if available
              if (game?.playgrounds && game.playgrounds.length > 0) {
                  setViewingPlaygroundId(game.playgrounds[0].id);
              }
          }
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

  // --- GEOFENCING ENGINE ---
  useEffect(() => {
      if (!activeGame || mode !== GameMode.PLAY || !userLocation) return;

      const checkGeofences = async () => {
          if (geofenceCheckRunningRef.current) return;
          geofenceCheckRunningRef.current = true;

          const patches: { pointId: string; patch: any }[] = [];

          (activeGame?.points || []).forEach(p => {
              // Skip if already unlocked or completed, or if it's a zone/header
              if (p.isUnlocked || p.isCompleted || p.isSectionHeader || p.playgroundId) return;

              // Check Radius
              if (p.activationTypes.includes('radius') && isWithinRadius(userLocation, p.location, p.radiusMeters)) {
                  patches.push({ pointId: p.id, patch: { isUnlocked: true } });
              }
          });

          try {
              if (patches.length > 0) {
                  // Optional: Trigger sound or vibration here
                  if (navigator.vibrate) navigator.vibrate(200);

                  const remote = await db.patchGamePoints(activeGame.id, patches, {
                      user: authUser?.username,
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

      const interval = setInterval(checkGeofences, 2000); // Check every 2 seconds
      return () => clearInterval(interval);
  }, [userLocation, activeGame, mode]);

  // --- FOG OF WAR TEAMS DATA FETCHING ---
  useEffect(() => {
      if (!fogOfWarEnabled || !activeGameId) {
          setTeamsForFogOfWar([]);
          return;
      }

      const loadTeams = async () => {
          try {
              const teams = await db.fetchTeams(activeGameId);
              setTeamsForFogOfWar(teams);
          } catch (error) {
              console.error('Error loading teams for fog of war:', error);
              setTeamsForFogOfWar([]);
          }
      };

      loadTeams();
  }, [fogOfWarEnabled, activeGameId]);

  // --- GAME STATS DATA FETCHING ---
  useEffect(() => {
      if (!showGameStats || !activeGameId) return;

      const loadTeams = async () => {
          try {
              const teams = await db.fetchTeams(activeGameId);
              setGameStatsTeams(teams);
          } catch (error) {
              console.error('Error loading teams for stats:', error);
              setGameStatsTeams([]);
          }
      };

      loadTeams();
  }, [showGameStats, activeGameId]);

  // --- MEMOIZED DATA ---
  
  // Calculate Logic Links for Map Visualization (Edit/Instructor Mode)
  const logicLinks = useMemo(() => {
      if (!activeGame || mode === GameMode.PLAY) return [];
      const links: any[] = [];
      (activeGame?.points || []).forEach(p => {
          if (!p.location) return;
          const addLinks = (trigger: 'onOpen' | 'onCorrect' | 'onIncorrect', color: string) => {
              const actions = p.logic?.[trigger];
              actions?.forEach(action => {
                  if ((action.type === 'unlock' || action.type === 'reveal') && action.targetId) {
                      const target = activeGame?.points?.find(tp => tp.id === action.targetId);
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
      return activeGame?.points?.find(p => p.id === activeTaskModalId) || null;
  }, [activeTaskModalId, activeGame]);

  // Generate demo team history data (for testing/demo purposes)
  // TODO: Replace with actual team history from database
  const demoTeamHistory = useMemo(() => {
      if (!activeGame || selectedTeamPaths.length === 0) return [];

      // Use first point as center, or default to Copenhagen
      const gameCenter = activeGame.points?.[0]?.location || { lat: 55.6761, lng: 12.5683 };

      // Generate history for all teams, then filter by selected
      const allHistory = generateDemoTeamHistory(gameCenter, Math.max(teamsForFogOfWar.length, 3));

      // Filter to only show selected team paths
      return allHistory.filter(history => selectedTeamPaths.includes(history.teamId));
  }, [activeGame, selectedTeamPaths, teamsForFogOfWar]);


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

  // Export all game tasks to library and sync to Supabase
  const handleExportGameToLibrary = async () => {
      if (!activeGame || !activeGame.points || activeGame.points.length === 0) {
          alert('No tasks to export');
          return;
      }

      try {
          const taskTemplates = activeGame.points.map(point => ({
              id: `template-${point.id}`,
              title: point.title,
              task: point.task,
              feedback: point.feedback,
              points: point.points,
              tags: Array.isArray(point.tags) ? point.tags : [],
              iconId: point.iconId,
              iconUrl: point.iconUrl,
              completedIconId: (point as any).completedIconId,
              completedIconUrl: (point as any).completedIconUrl,
              settings: point.settings,
              logic: point.logic
          }));

          const { ok } = await db.saveTemplates(taskTemplates);

          if (ok) {
              // Reload the global library to show newly exported tasks
              const updatedLib = await db.fetchLibrary();
              setTaskLibrary(updatedLib);

              alert(`✅ Exported ${taskTemplates.length} tasks to Global Library and synced to Supabase!`);
              console.log('[Export] Tasks exported to library:', taskTemplates.length);
          } else {
              alert('❌ Failed to export tasks to library');
          }
      } catch (error) {
          console.error('[Export] Error exporting tasks:', error);
          alert('Error exporting tasks to library');
      }
  };

  const handleDeleteItem = async (pointId: string) => {
      if (!activeGame) return;
      if (!pointId) {
          console.warn('[Delete] Ignored delete request with empty pointId');
          return;
      }
      const updatedPoints = (activeGame?.points || []).filter(p => p.id !== pointId);
      const updatedZones = (activeGame.dangerZones || []).filter(z => z.id !== pointId);
      await updateActiveGame({ ...activeGame, points: updatedPoints, dangerZones: updatedZones });
      if (activeTask?.id === pointId) setActiveTask(null);
  };

  const handlePointClick = (point: GamePoint) => {
      console.log('[handlePointClick] ENTRY:', {
          pointId: point.id,
          isMeasuring,
          isRelocating,
          mode,
          timestamp: Date.now()
      });

      // CRITICAL: When measuring mode is active, ONLY add to measurement path
      // Do NOT open any modals or task views
      if (isMeasuring) {
          console.log('[handlePointClick] ✓ MEASURE MODE DETECTED - Entering measurement logic');

          if (!point.location || !isValidCoordinate(point.location)) {
              console.warn('[Measure] Cannot measure task without valid location:', point.id);
              return;
          }

          console.log('[Measure] Task clicked in measure mode:', point.id, 'Location:', point.location);

          // CRITICAL FIX: Use state callback to avoid stale closure
          // We need to calculate distance based on the CURRENT state, not the closed-over value
          setMeasurePath(prev => {
              const newPath = [...prev, point.location];

              // Calculate distance from previous point (if exists)
              const distanceToAdd = prev.length > 0
                  ? haversineMeters(prev[prev.length - 1], point.location)
                  : 0;

              console.log('[Measure] Distance calculation:', {
                  previousPoint: prev[prev.length - 1],
                  currentPoint: point.location,
                  distanceToAdd: distanceToAdd.toFixed(2) + 'm',
                  pathLength: prev.length
              });

              // Update distance
              setMeasuredDistance(prevDist => {
                  const newDistance = prevDist + distanceToAdd;
                  console.log('[Measure] Distance update:', prevDist.toFixed(2) + 'm', '+', distanceToAdd.toFixed(2) + 'm', '=', newDistance.toFixed(2) + 'm');
                  return newDistance;
              });

              return newPath;
          });

          // Add task ID to selected list (for visual feedback)
          setSelectedMeasurePointIds(prev => [...prev, point.id]);

          // Update point count
          setMeasurePointsCount(prev => prev + 1);

          console.log('[Measure] ✓ Added task to path.');

          // CRITICAL: Stop execution here - do NOT open task modal
          console.log('[handlePointClick] ✓ EXITING - Measure mode complete, returning early');
          return;
      }

      // CRITICAL: When relocating mode is active, ignore point clicks (users should click map to place)
      if (isRelocating) {
          console.log('[Relocate] Point click ignored - click map to relocate tasks');
          console.log('[handlePointClick] ✓ EXITING - Relocate mode, returning early');
          return;
      }

      // Normal mode: Open task modal/editor OR action editor
      console.log('[handlePointClick] ⚠️ NORMAL MODE - Opening task modal/editor');
      if (mode === GameMode.EDIT) {
          // If ACTIONS button is active, show action editor instead of full task editor
          if (showTaskActions) {
              console.log('[handlePointClick] ACTIONS mode active - Opening action editor:', point.id);
              setActiveTaskActionPoint(point);
          } else {
              console.log('[handlePointClick] Setting activeTask:', point.id);
              setActiveTask(point);
          }
      } else if (mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR) {
          console.log('[handlePointClick] Setting activeTaskModalId:', point.id);
          setActiveTaskModalId(point.id);
      }
  };

  const handleAreaColorClick = (point: GamePoint) => {
      console.log('[handleAreaColorClick] Area color circle clicked:', {
          pointId: point.id,
          mode,
          isMeasuring,
          isRelocating
      });

      // Skip if in measurement or relocation modes
      if (isMeasuring || isRelocating) {
          console.log('[handleAreaColorClick] Ignoring - measure or relocate mode active');
          return;
      }

      // Always open task view (not action editor) when clicking area color circle
      if (mode === GameMode.EDIT) {
          console.log('[handleAreaColorClick] EDIT mode - Opening task editor:', point.id);
          setActiveTask(point);
      } else if (mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR) {
          console.log('[handleAreaColorClick] PLAY/INSTRUCTOR mode - Opening task modal:', point.id);
          setActiveTaskModalId(point.id);
      }
  };

  const handleMapClick = async (coord: Coordinate) => {
      // DISABLED: Measure tool should ONLY work with tasks, not random map points
      // Users should click tasks to measure between them
      if (mode === GameMode.EDIT && isMeasuring) {
          console.log('[Measure] Map click ignored - please click tasks to measure between them');
          return;
      }

      // Snap to Road - Rectangle selection
      if (mode === GameMode.EDIT && snapToRoadMode) {
          if (!snapSelectionStart) {
              // First click - set start point
              console.log('[Snap to Road] Setting selection start:', coord);
              setSnapSelectionStart(coord);
          } else {
              // Second click - set end point and select tasks
              console.log('[Snap to Road] Setting selection end:', coord);
              setSnapSelectionEnd(coord);

              // Find all tasks within the rectangle
              if (activeGame) {
                  const tasksInBox = activeGame.points.filter(p => {
                      if (!p.location || p.playgroundId) return false;
                      return isPointInBox(p.location, snapSelectionStart, coord);
                  });

                  const taskIds = tasksInBox.map(t => t.id);
                  setSelectedSnapTaskIds(taskIds);
                  console.log('[Snap to Road] Selected', taskIds.length, 'tasks in rectangle');
              }
          }
          return;
      }

      // Relocate tool - move all tasks
      if (mode === GameMode.EDIT && isRelocating && relocateScopeCenter && activeGame) {
          console.log('[Relocate] Executing relocation to:', coord);
          const offsetLat = coord.lat - relocateScopeCenter.lat;
          const offsetLng = coord.lng - relocateScopeCenter.lng;

          const updatedPoints = activeGame.points.map(p => {
              if (!p.location || p.playgroundId) return p; // Skip playground-only points
              return {
                  ...p,
                  location: {
                      lat: p.location.lat + offsetLat,
                      lng: p.location.lng + offsetLng
                  }
              };
          });

          const updatedZones = (activeGame.dangerZones || []).map(z => ({
              ...z,
              location: {
                  lat: z.location.lat + offsetLat,
                  lng: z.location.lng + offsetLng
              }
          }));

          await updateActiveGame({ ...activeGame, points: updatedPoints, dangerZones: updatedZones });

          // Update the scope center to the new location
          setRelocateScopeCenter(coord);
          console.log('[Relocate] Relocation complete. New center:', coord);
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
      if (!isRelocating && activeGame) {
          // Calculate center of all tasks
          const validPoints = activeGame.points.filter(p => p.location && !p.playgroundId && isValidCoordinate(p.location));

          if (validPoints.length > 0) {
              const avgLat = validPoints.reduce((sum, p) => sum + p.location.lat, 0) / validPoints.length;
              const avgLng = validPoints.reduce((sum, p) => sum + p.location.lng, 0) / validPoints.length;
              setRelocateScopeCenter({ lat: avgLat, lng: avgLng });
              // Mark ALL valid points for relocation
              setRelocateAllTaskIds(validPoints.map(p => p.id));
          } else if (mapRef.current) {
              // If no valid points, use map center
              setRelocateScopeCenter(mapRef.current.getCenter());
          }
      } else {
          // Exit relocate mode - clear selections
          setRelocateScopeCenter(null);
          setRelocateAllTaskIds([]);
      }
      setIsRelocating(!isRelocating);
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

  const handleToggleTeamPathSelector = () => {
      setShowTeamPathSelector(!showTeamPathSelector);
  };

  const handleSelectTeamPath = (teamId: string) => {
      setSelectedTeamPaths(prev => {
          if (prev.includes(teamId)) {
              // Deselect team
              const newPaths = prev.filter(id => id !== teamId);
              // Hide paths if no teams selected
              if (newPaths.length === 0) {
                  setShowTeamPaths(false);
              }
              return newPaths;
          } else {
              // Select team and show paths
              setShowTeamPaths(true);
              return [...prev, teamId];
          }
      });
  };

  const handleUpdateGameTime = async (newEndTime: number) => {
      if (!activeGame) return;

      // Update the game with the new end time
      const updatedGame = {
          ...activeGame,
          timerConfig: {
              ...activeGame.timerConfig,
              endTime: new Date(newEndTime).toISOString()
          }
      };

      await updateActiveGame(updatedGame);
  };

  const handleLocateMe = () => {
      if (!mapRef.current) return;

      setLocateAttempt(true);
      setLocateFeedback(null);

      // If we have a location, jump to it
      if (userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng)) {
          mapRef.current.jumpTo(userLocation);
          setLocateFeedback('Located!');
          setTimeout(() => setLocateFeedback(null), 2000);
          return;
      }

      // Handle various error states
      if (locationError) {
          setLocateFeedback(`GPS Error: ${locationError}`);
          return;
      }

      // Still waiting for location
      setLocateFeedback('Getting your location...');

      // Retry after 3 seconds if location still not available
      const timeout = setTimeout(() => {
          if (!userLocation) {
              setLocateFeedback('Location unavailable. Check GPS permissions and try again.');
          }
      }, 3000);

      return () => clearTimeout(timeout);
  };

  const handleStartSimulation = () => {
      // TODO: Implement simulation mode
      console.log('[Simulation] Starting simulation mode');
      // For now, just switch to PLAY mode to simulate
      setMode(GameMode.PLAY);
  };

  const handleToggleSnapToRoad = async () => {
      if (snapToRoadMode) {
          // Deactivating - perform the snap
          console.log('[Snap to Road] Deactivating - performing snap');

          if (!activeGame || selectedSnapTaskIds.length === 0) {
              console.log('[Snap to Road] No tasks selected or no active game');
              setSnapToRoadMode(false);
              setSnapSelectionStart(null);
              setSnapSelectionEnd(null);
              setSelectedSnapTaskIds([]);
              return;
          }

          // Get coordinates of selected tasks
          const tasksToSnap = activeGame.points.filter(p => selectedSnapTaskIds.includes(p.id) && p.location);
          const coordinates = tasksToSnap.map(p => p.location!);

          console.log('[Snap to Road] Snapping', tasksToSnap.length, 'tasks to roads');

          // Call Mapbox API to snap to roads
          const snappedCoordinates = await snapPointsToRoad(coordinates);

          // Update tasks with snapped coordinates
          const updatedPoints = activeGame.points.map(p => {
              const taskIndex = tasksToSnap.findIndex(t => t.id === p.id);
              if (taskIndex !== -1 && snappedCoordinates[taskIndex]) {
                  return { ...p, location: snappedCoordinates[taskIndex] };
              }
              return p;
          });

          await updateActiveGame({ ...activeGame, points: updatedPoints });

          console.log('[Snap to Road] Successfully snapped', tasksToSnap.length, 'tasks');

          // Clear selection
          setSnapToRoadMode(false);
          setSnapSelectionStart(null);
          setSnapSelectionEnd(null);
          setSelectedSnapTaskIds([]);
      } else {
          // Activating - enter selection mode
          console.log('[Snap to Road] Activating - draw rectangle to select tasks');
          setSnapToRoadMode(true);
          setSnapSelectionStart(null);
          setSnapSelectionEnd(null);
          setSelectedSnapTaskIds([]);
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
      // Add to game and immediately open editor
      updateActiveGame({ ...activeGame, dangerZones: [...(activeGame.dangerZones || []), newZone] });
      setActiveDangerZone(newZone);
  };

  const handleUpdateRoute = (id: string, updates: Partial<GameRoute>) => {
      if (!activeGame) return;
      const updatedRoutes = (activeGame.routes || []).map(r => r.id === id ? { ...r, ...updates } : r);
      updateActiveGame({ ...activeGame, routes: updatedRoutes });
  };

  const handleManualUnlock = async (pointId: string) => {
      if (!activeGame) return;

      const remote = await db.patchGamePoints(
          activeGame.id,
          [{ pointId, patch: { isUnlocked: true } }],
          { user: authUser?.username, action: 'Manual Unlock' }
      );

      if (remote) {
          setGames(prev => prev.map(g => (g.id === remote.id ? remote : g)));
          setActiveGame(remote);
      } else {
          const updatedPoints = activeGame.points.map(p => (p.id === pointId ? { ...p, isUnlocked: true } : p));
          await updateActiveGame({ ...activeGame, points: updatedPoints });
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

      // Persist only what actually changed (this is the biggest speedup)
      onProgress?.(0.05, 'Updating task library...');

      if (changedTemplates.length > 0) {
          const { ok } = await db.saveTemplates(changedTemplates, {
              onProgress: ({ completed, total }) => {
                  const pct = total ? completed / total : 1;
                  onProgress?.(0.05 + pct * 0.55, `Updating tasks (${Math.min(total, completed + 1)}/${total})`);
              }
          });
          if (!ok) console.error('Error saving templates: saveTemplates failed');
      }

      const listChanges = updatedLists.filter(x => x.listChanged).map(x => x.updated);
      if (listChanges.length > 0) {
          const { ok } = await db.saveTaskLists(listChanges, {
              chunkSize: 10,
              onProgress: ({ completed, total }) => {
                  const pct = total ? completed / total : 1;
                  onProgress?.(0.65 + pct * 0.15, `Updating lists (${Math.min(total, completed)}/${total})`);
              }
          });
          if (!ok) console.error('Error saving task lists: saveTaskLists failed');
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

      onProgress?.(0.05, 'Updating task library...');

      if (changedTemplates.length > 0) {
          const { ok } = await db.saveTemplates(changedTemplates, {
              onProgress: ({ completed, total }) => {
                  const pct = total ? completed / total : 1;
                  onProgress?.(0.05 + pct * 0.55, `Updating tasks (${Math.min(total, completed + 1)}/${total})`);
              }
          });
          if (!ok) console.error('Error saving templates: saveTemplates failed');
      }

      const listChanges = updatedLists.filter(x => x.listChanged).map(x => x.updated);
      if (listChanges.length > 0) {
          const { ok } = await db.saveTaskLists(listChanges, {
              chunkSize: 10,
              onProgress: ({ completed, total }) => {
                  const pct = total ? completed / total : 1;
                  onProgress?.(0.65 + pct * 0.15, `Updating lists (${Math.min(total, completed)}/${total})`);
              }
          });
          if (!ok) console.error('Error saving task lists: saveTaskLists failed');
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
                  onEditGameSetup={(id) => {
                      const game = games.find(g => g.id === id);
                      if (game) {
                          setGameToEdit(game);
                          setActiveGameId(id);
                          setShowGameCreator(true);
                          setShowGameChooser(false);
                      }
                  }}
                  onCreateFromTemplate={handleCreateGameFromTemplate}
                  onEditPoint={setActiveTask}
                  onReorderPoints={() => {}}
                  onCreateTestGame={() => {}}
                  onOpenTaskMaster={() => setShowTaskMaster(true)}
                  onClearMap={() => updateActiveGame({ ...activeGame!, points: [] })}
                  mode={mode}
                  onSetMode={setMode}
                  onOpenGameCreator={() => {
                      setGameToEdit(null);
                      setShowGameCreator(true);
                      setShowGameChooser(false);
                  }}
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
                  onComplete={async (id, pts) => {
                      setScore(s => s + (pts || 0));

                      if (activeGame) {
                          const remote = await db.patchGamePoints(
                              activeGame.id,
                              [{ pointId: id, patch: { isCompleted: true } }],
                              { user: authUser?.username, action: 'Task Completed' }
                          );

                          if (remote) {
                              setGames(prev => prev.map(g => (g.id === remote.id ? remote : g)));
                              setActiveGame(remote);
                          } else {
                              const updatedPoints = activeGame.points.map(p => (p.id === id ? { ...p, isCompleted: true } : p));
                              await updateActiveGame({ ...activeGame, points: updatedPoints });
                          }
                      }

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
                  initialModal={taskMasterInitialModal}
                  taskLibrary={taskLibrary}
                  onUpdateTaskLibrary={setTaskLibrary}
                  onClose={() => {
                      setShowTaskMaster(false);
                      setTaskMasterInitialModal(null);
                  }}
                  onImportTasks={async (tasks, gameId) => {
                      // Find the target game by ID or use activeGame
                      const targetGame = gameId ? games.find(g => g.id === gameId) : activeGame;

                      if (targetGame) {
                          // Check if game has multiple languages configured
                          const configuredLanguages = getConfiguredLanguagesForGame(targetGame);

                          if (configuredLanguages.length > 1) {
                              // Validate each task has all required translations
                              const invalidTasks: Array<{ task: any; missingLanguages: string[] }> = [];

                              tasks.forEach(task => {
                                  const validation = validateTaskTranslations(task.task, configuredLanguages);
                                  if (!validation.valid) {
                                      invalidTasks.push({
                                          task,
                                          missingLanguages: validation.missingLanguages,
                                      });
                                  }
                              });

                              if (invalidTasks.length > 0) {
                                  // Show error message with details
                                  const taskNames = invalidTasks.map(item => `• ${item.task.title}`).join('\n');
                                  const languageList = configuredLanguages.filter(l => l !== 'English').join(', ');

                                  alert(
                                      `⚠️ Translation Required\n\n` +
                                      `This game uses multiple languages: ${languageList}\n\n` +
                                      `The following tasks are missing approved translations:\n${taskNames}\n\n` +
                                      `Please add and approve translations for all tasks before adding them to this game.\n\n` +
                                      `💡 Tip: Open each task in the Task Editor and go to the "Languages" tab to add translations.`
                                  );
                                  return; // Don't add tasks
                              }
                          }

                          const mapCenter = mapRef.current?.getCenter();
                          const newPoints = tasks.map((t, idx) => ({
                              ...t,
                              id: `p-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                              location: mapCenter || null,
                              radiusMeters: 30,
                              activationTypes: ['radius'],
                              isUnlocked: true,
                              isCompleted: false,
                              order: targetGame.points.length + idx
                          } as GamePoint));

                          // Update the target game
                          const updatedGame = { ...targetGame, points: [...targetGame.points, ...newPoints] };

                          // If it's not the active game, update games list only
                          // If it's the active game, update both
                          if (targetGame.id === activeGame?.id) {
                              await updateActiveGame(updatedGame);
                          } else {
                              await db.saveGame(updatedGame);
                              setGames(games.map(g => g.id === updatedGame.id ? updatedGame : g));
                          }

                          setShowTaskMaster(false);
                      }
                  }}
                  onImportTaskList={async (list, gameId) => {
                      // Find the target game by ID or use activeGame
                      const targetGame = gameId ? games.find(g => g.id === gameId) : activeGame;

                      if (targetGame) {
                          // Check if game has multiple languages configured
                          const configuredLanguages = getConfiguredLanguagesForGame(targetGame);

                          if (configuredLanguages.length > 1) {
                              // Validate each task has all required translations
                              const invalidTasks: Array<{ task: any; missingLanguages: string[] }> = [];

                              list.tasks.forEach(task => {
                                  const validation = validateTaskTranslations(task.task, configuredLanguages);
                                  if (!validation.valid) {
                                      invalidTasks.push({
                                          task,
                                          missingLanguages: validation.missingLanguages,
                                      });
                                  }
                              });

                              if (invalidTasks.length > 0) {
                                  // Show error message with details
                                  const taskNames = invalidTasks.map(item => `• ${item.task.title}`).join('\n');
                                  const languageList = configuredLanguages.filter(l => l !== 'English').join(', ');

                                  alert(
                                      `⚠️ Translation Required\n\n` +
                                      `This game uses multiple languages: ${languageList}\n\n` +
                                      `The following tasks from "${list.name}" are missing approved translations:\n${taskNames}\n\n` +
                                      `Please add and approve translations for all tasks before adding them to this game.\n\n` +
                                      `💡 Tip: Open each task in the Task Editor and go to the "Languages" tab to add translations.`
                                  );
                                  return; // Don't add tasks
                              }
                          }

                          const mapCenter = mapRef.current?.getCenter();
                          const newPoints = list.tasks.map((t, idx) => ({
                              ...t,
                              id: `p-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                              location: mapCenter || null,
                              radiusMeters: 30,
                              activationTypes: ['radius'],
                              isUnlocked: true,
                              isCompleted: false,
                              order: targetGame.points.length + idx
                          } as GamePoint));

                          // Update the target game
                          const updatedGame = { ...targetGame, points: [...targetGame.points, ...newPoints] };

                          // If it's not the active game, update games list only
                          // If it's the active game, update both
                          if (targetGame.id === activeGame?.id) {
                              await updateActiveGame(updatedGame);
                          } else {
                              await db.saveGame(updatedGame);
                              setGames(games.map(g => g.id === updatedGame.id ? updatedGame : g));
                          }

                          setShowTaskMaster(false);
                      }
                  }}
                  taskLists={taskLists}
                  onUpdateTaskLists={setTaskLists}
                  games={games}
                  activeGame={activeGame}
                  onDeleteTagGlobally={handleDeleteTagGlobally}
                  onRenameTagGlobally={handleRenameTagGlobally}
              />
          )}
          {/* ... Rest of modals ... */}
          {showGameCreator && (
              <GameCreator
                  onClose={() => {
                      setShowGameCreator(false);
                      setInitialGameMode(null);
                  }}
                  onCreate={async (gameData) => {
                      if (gameToEdit && gameToEdit.id === gameData.id) {
                          await updateActiveGame({ ...gameToEdit, ...gameData });
                      } else {
                          // PLAYZONE GAME: Auto-create empty playground and set to 'no map'
                          const isPlayzone = gameData.gameMode === 'playzone';
                          const playgroundId = `pg-${Date.now()}`;

                          const newGame = {
                              ...gameData,
                              id: `game-${Date.now()}`,
                              points: [],
                              createdAt: Date.now(),
                              // Force 'no map' for Playzone games
                              defaultMapStyle: isPlayzone ? 'none' : gameData.defaultMapStyle,
                              // Create initial empty playground for Playzone games
                              playgrounds: isPlayzone ? [{
                                  id: playgroundId,
                                  title: 'New Playground',
                                  buttonVisible: true,
                                  iconId: 'default',
                                  location: { lat: 0, lng: 0 }
                              }] : (gameData.playgrounds || [])
                          } as Game;

                          await db.saveGame(newGame);
                        setGames([...games, newGame]);
                        setActiveGameId(newGame.id);

                        // PLAYZONE: Open playground editor directly, skip GameChooser
                        if (isPlayzone) {
                            setMode(GameMode.EDIT);
                            setViewingPlaygroundId(playgroundId);
                            setShowLanding(false);
                        } else if (gameData.gameMode === 'elimination') {
                            // ELIMINATION: Navigate directly to elimination game view
                            setMode(GameMode.EDIT);
                            setShowLanding(false);
                            setShowGameChooser(false);
                        } else {
                            // STANDARD: Navigate directly to game edit view
                            setMode(GameMode.EDIT);
                            setShowLanding(false);
                            setShowGameChooser(false);
                        }
                      }
                      setShowGameCreator(false);
                      setGameToEdit(null);
                      setInitialGameMode(null);
                  }}
                  baseGame={gameToEdit || undefined}
                  onDelete={handleDeleteGame}
                  initialGameMode={initialGameMode}
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
          {playgroundTemplateToEdit && (
              <PlaygroundEditor
                  game={{
                      id: 'template-edit',
                      name: playgroundTemplateToEdit.title,
                      description: '',
                      createdAt: Date.now(),
                      points: playgroundTemplateToEdit.tasks,
                      playgrounds: [playgroundTemplateToEdit.playgroundData],
                      isGameTemplate: false,
                      teams: [],
                      state: 'draft'
                  } as Game}

                  onUpdateGame={(updatedGame) => {
                      if (playgroundTemplateToEdit) {
                          setPlaygroundTemplateToEdit({
                              ...playgroundTemplateToEdit,
                              title: updatedGame.name,
                              playgroundData: updatedGame.playgrounds?.[0]!,
                              tasks: updatedGame.points
                          });
                      }
                  }}
                  onSaveTemplate={async (name) => {
                      if (playgroundTemplateToEdit) {
                          const updated = {
                              ...playgroundTemplateToEdit,
                              title: name
                          };
                          await db.savePlaygroundTemplate(updated);
                          setPlaygroundTemplateToEdit(updated);
                      }
                  }}
                  onClose={() => {
                      const wasEditingTemplate = !!playgroundTemplateToEdit;
                      if (wasEditingTemplate && playgroundTemplateToEdit) {
                          // Save the template to database
                          db.savePlaygroundTemplate(playgroundTemplateToEdit);
                      }
                      setPlaygroundTemplateToEdit(null);
                      if (wasEditingTemplate) {
                          setShowPlaygroundManager(true);
                      }
                  }}
                  onEditPoint={(p) => setActiveTask(p)}
                  onPointClick={(p) => {}}
                  onAddTask={async (type, playgroundId) => {
                      if (!playgroundTemplateToEdit) return;

                      if (type === 'MANUAL') {
                          const newPoint: GamePoint = {
                              id: `p-${Date.now()}`,
                              title: 'New Task',
                              location: { lat: 0, lng: 0 },
                              playgroundId: playgroundId,
                              iconId: 'default',
                              points: 100,
                              radiusMeters: 30,
                              activationTypes: ['radius'],
                              isUnlocked: true,
                              isCompleted: false,
                              order: (playgroundTemplateToEdit.tasks?.length || 0),
                              task: { type: 'text', question: 'New Task Question' }
                          };
                          setPlaygroundTemplateToEdit({
                              ...playgroundTemplateToEdit,
                              tasks: [...(playgroundTemplateToEdit.tasks || []), newPoint]
                          });
                      } else if (type === 'AI') {
                          setTaskMasterInitialTab('LIBRARY');
                          setTaskMasterInitialModal('AI');
                          setShowTaskMaster(true);
                      } else if (type === 'TASKLIST') {
                          setTaskMasterInitialTab('LISTS');
                          setTaskMasterInitialModal(null);
                          setShowTaskMaster(true);
                      } else if (type === 'LIBRARY') {
                          setTaskMasterInitialTab('LIBRARY');
                          setTaskMasterInitialModal(null);
                          setShowTaskMaster(true);
                      }
                  }}
                  onOpenLibrary={() => {}}
                  showScores={showScores}
                  onToggleScores={() => setShowScores(!showScores)}
                  onHome={() => {
                      setPlaygroundTemplateToEdit(null);
                      setShowPlaygroundManager(true);
                  }}
                  isTemplateMode={true}
                  onAddZoneFromLibrary={() => {}}
                  isAdmin={authUser?.role === 'Owner' || authUser?.role === 'Admin'}
                  taskLists={taskLists}
                  onUpdateTaskLists={setTaskLists}
                  taskLibrary={taskLibrary}
                  onUpdateTaskLibrary={setTaskLibrary}
                  onOpenGameSettings={() => {
                      // For template mode, show playground manager instead
                      setPlaygroundTemplateToEdit(null);
                      setShowPlaygroundManager(true);
                  }}
              />
          )}
          {viewingPlaygroundId && activeGame && (
              <PlaygroundEditor
                  game={activeGame}
                  onUpdateGame={(updatedGame) => {
                      updateActiveGame(updatedGame);
                  }}
                  onClose={() => {
                      setViewingPlaygroundId(null);
                  }}
                  onEditPoint={(p) => setActiveTask(p)}
                  onPointClick={(p) => {
                      mapRef.current?.jumpTo(p.location);
                  }}
                  onAddTask={async (type, playgroundId) => {
                      if (!activeGame) return;

                      if (type === 'MANUAL') {
                          const center = mapRef.current?.getCenter() || { lat: 0, lng: 0 };
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
                      } else if (type === 'AI') {
                          setTaskMasterInitialTab('LIBRARY');
                          setTaskMasterInitialModal('AI');
                          setShowTaskMaster(true);
                      } else if (type === 'TASKLIST') {
                          setTaskMasterInitialTab('LISTS');
                          setTaskMasterInitialModal(null);
                          setShowTaskMaster(true);
                      } else if (type === 'LIBRARY') {
                          setTaskMasterInitialTab('LIBRARY');
                          setTaskMasterInitialModal(null);
                          setShowTaskMaster(true);
                      }
                  }}
                  onOpenLibrary={() => setShowTaskMaster(true)}
                  showScores={showScores}
                  onToggleScores={() => setShowScores(!showScores)}
                  onHome={() => {
                      setViewingPlaygroundId(null);
                      // For PLAYZONE games, return to landing page instead of map view
                      if (activeGame?.gameMode === 'playzone') {
                          setShowLanding(true);
                          setActiveGameId(null);
                      }
                  }}
                  isTemplateMode={false}
                  onAddZoneFromLibrary={() => setShowTaskMaster(true)}
                  isAdmin={authUser?.role === 'Owner' || authUser?.role === 'Admin'}
                  taskLists={taskLists}
                  onUpdateTaskLists={setTaskLists}
                  taskLibrary={taskLibrary}
                  onUpdateTaskLibrary={setTaskLibrary}
                  onOpenGameSettings={() => {
                      if (activeGame) {
                          setGameToEdit(activeGame);
                          setShowGameCreator(true);
                      }
                  }}
                  onExportGameToLibrary={handleExportGameToLibrary}
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
          {activeDangerZone && (
              <DangerZoneModal
                  zone={activeDangerZone}
                  onSave={(updatedZone) => {
                      if (!activeGame) return;
                      const updatedZones = (activeGame.dangerZones || []).map(z =>
                          z.id === updatedZone.id ? updatedZone : z
                      );
                      updateActiveGame({ ...activeGame, dangerZones: updatedZones });
                      setActiveDangerZone(null);
                  }}
                  onDelete={() => {
                      if (!activeGame) return;
                      const updatedZones = (activeGame.dangerZones || []).filter(z =>
                          z.id !== activeDangerZone.id
                      );
                      updateActiveGame({ ...activeGame, dangerZones: updatedZones });
                      setActiveDangerZone(null);
                  }}
                  onClose={() => setActiveDangerZone(null)}
              />
          )}
      </>
  );

  if (showLanding) {
      return (
          <>
            <InitialLanding
                version={APP_VERSION}
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
                    if (action === 'ACCESS') {
                        setShowAccess(true);
                        // Keep showLanding true so Access renders on top of landing page
                        return;
                    }
                    ensureSession(() => {
                        switch (action) {
                            case 'GAMES': setShowGameChooser(true); break;
                            case 'CREATE_GAME': setGameToEdit(null); setShowGameCreator(true); break;
                            case 'CREATE_MAP_GAME':
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
                            case 'DIAGNOSTICS': setShowSupabaseDiagnostic(true); break;
                            case 'TRANSLATIONS': setShowTranslationsManager(true); break;
                            case 'MEDIA': setShowMediaManager(true); break;
                            case 'GAMESTATS':
                                setShowGameStats(true);
                                break;
                            case 'MAP_STYLES':
                                setShowMapStyleLibrary(true);
                                break;
                            case 'QR_CODES':
                                setShowQRCodesTool(true);
                                break;
                            case 'CLIENT_PORTAL':
                                setDashboardTab('client');
                                setShowDashboard(true);
                                break;
                            case 'CLIENT':
                                setShowClientGameChooser(true);
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
                    onLibraryUpdated={async () => {
                        const updatedLib = await db.fetchLibrary();
                        setTaskLibrary(updatedLib);
                    }}
                />
            )}
            {showGameStats && (
                <GameStatsTool
                    games={playableGames}
                    activeGameId={activeGameId}
                    onSelectGame={setActiveGameId}
                    onClose={() => setShowGameStats(false)}
                />
            )}
            {showMediaManager && (
                <MediaManager
                    onClose={() => setShowMediaManager(false)}
                    games={games}
                />
            )}
            {showMapStyleLibrary && (
                <MapStyleLibrary
                    onClose={() => setShowMapStyleLibrary(false)}
                />
            )}

            {showQRCodesTool && (
                <QRCodesTool
                    games={playableGames}
                    activeGameId={activeGameId}
                    onSelectGame={setActiveGameId}
                    onClose={() => setShowQRCodesTool(false)}
                />
            )}

            {showSupabaseDiagnostic && (
                <SupabaseToolsModal
                    onClose={() => setShowSupabaseDiagnostic(false)}
                />
            )}

            {showTranslationsManager && (
                <TranslationsManager
                    onClose={() => setShowTranslationsManager(false)}
                    onEditTask={(gameId, pointId) => {
                        // Close translations manager
                        setShowTranslationsManager(false);

                        // Load the game and open the task editor
                        const game = games.find(g => g.id === gameId);
                        if (game) {
                            setActiveGameId(gameId);
                            setActiveGame(game);
                            setMode(GameMode.EDIT);
                            setShowLanding(false);

                            // Note: The task editor will need to be opened from GameHUD
                            // For now, we just navigate to the game in edit mode
                            // The user can then find and edit the task
                        }
                    }}
                />
            )}

            {/* CLIENT ZONE */}
            {showClientGameChooser && (
                <ClientGameChooser
                    onClose={() => setShowClientGameChooser(false)}
                    onSelectGame={(gameId) => {
                        setClientGameId(gameId);
                        setShowClientGameChooser(false);
                        setShowClientLobby(true);
                    }}
                />
            )}

            {showClientLobby && clientGameId && (
                <div className="fixed inset-0 z-[9998]">
                    <ClientLobby
                        gameId={clientGameId}
                        onBack={() => {
                            setShowClientLobby(false);
                            setClientGameId(null);
                        }}
                    />
                </div>
            )}

            {/* ACCESS SCREEN - Player game code entry */}
            {showAccess && (
                <Access
                    onGameSelected={(gameId) => {
                        setActiveGameId(gameId);
                        setShowAccess(false);
                        setMode(GameMode.PLAY);
                        setShowLanding(false);
                    }}
                    onBack={() => {
                        setShowAccess(false);
                    }}
                />
            )}

            {renderModals()}
          </>
      );
  }

  // Active Game View (Map & HUD)
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-900 text-white">
        {/* Hide map for PLAYZONE games - they use playground editor only */}
        {activeGame?.gameMode !== 'playzone' && (
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
                onAreaColorClick={handleAreaColorClick}
                onZoneClick={(z) => setActiveDangerZone(z)}
                onZoneMove={async (zoneId, newLoc) => {
                    if (!activeGame) return;
                    const updatedZones = (activeGame.dangerZones || []).map(z =>
                        z.id === zoneId ? { ...z, location: newLoc } : z
                    );
                    await updateActiveGame({ ...activeGame, dangerZones: updatedZones });
                }}
                onMapClick={handleMapClick}
                onDeletePoint={handleDeleteItem}
                onPointMove={isRelocating ? undefined : async (id, loc) => {
                    if (!activeGame) return;

                    // If in measure mode, update measurePath to reflect new location
                    if (isMeasuring) {
                        const point = activeGame.points.find(p => p.id === id);
                        if (point && point.location) {
                            const oldLocation = point.location;
                            setMeasurePath(prev =>
                                prev.map(coord =>
                                    (coord.lat === oldLocation.lat && coord.lng === oldLocation.lng)
                                        ? { lat: loc.lat, lng: loc.lng }
                                        : coord
                                )
                            );
                        }
                    }

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
                onDragStart={isRelocating ? undefined : (pointId) => {
                    // Don't open task editor when dragging in measure mode
                    if (!isMeasuring) {
                        const point = activeGame?.points.find(p => p.id === pointId);
                        if (point) setActiveTask(point);
                    }
                }}
                accuracy={gpsAccuracy}
                isRelocating={isRelocating}
                isMeasuring={isMeasuring}
                snapToRoadMode={snapToRoadMode}
                snapSelectionStart={snapSelectionStart}
                snapSelectionEnd={snapSelectionEnd}
                selectedSnapTaskIds={selectedSnapTaskIds}
                relocateScopeCenter={relocateScopeCenter}
                relocateAllTaskIds={relocateAllTaskIds}
                showScores={showScores}
                showTaskId={showTaskId}
                showTaskTitle={showTaskTitle}
                showTaskActions={showTaskActions}
                measuredDistance={measuredDistance}
                hoveredPointId={hoveredPointId}
                hoveredDangerZoneId={hoveredDangerZoneId}
                onPointHover={(point) => setMapHoveredPointId(point?.id || null)}
                teamHistory={demoTeamHistory}
                showTeamPaths={showTeamPaths}
                gameStartTime={teamsForFogOfWar.length > 0 && teamsForFogOfWar[0]?.startedAt ? teamsForFogOfWar[0].startedAt : activeGame?.createdAt}
                fogOfWarEnabled={fogOfWarEnabled}
                selectedTeamId={selectedTeamForFogOfWar}
                selectedTeamCompletedPointIds={
                    fogOfWarEnabled && selectedTeamForFogOfWar
                        ? teamsForFogOfWar.find(t => t.id === selectedTeamForFogOfWar)?.completedPointIds || []
                        : []
                }
                showZoneLayer={showZoneLayer}
                showTaskLayer={showTaskLayer}
                showLiveLayer={showLiveLayer}
            />
            </div>
        )}

        {/* DRAGGABLE MEASURE BOX */}
        {isMeasuring && (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
            <MeasureBox
                taskCount={measurePointsCount}
                distance={measuredDistance}
                onClose={handleToggleMeasure}
            />
        )}

        {/* RELOCATE MODE BANNER */}
        {isRelocating && (mode === GameMode.EDIT) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] pointer-events-none animate-in fade-in slide-in-from-top">
                <div className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl border-2 border-green-400 flex items-center gap-3">
                    <Crosshair className="w-5 h-5 animate-spin-slow" />
                    <div className="font-black uppercase tracking-wider text-sm">
                        RELOCATE MODE: Click MAP to move all tasks
                    </div>
                </div>
            </div>
        )}

        {/* SNAP TO ROAD MODE BANNER */}
        {snapToRoadMode && (mode === GameMode.EDIT) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] pointer-events-none animate-in fade-in slide-in-from-top">
                <div className="bg-cyan-600 text-white px-6 py-3 rounded-full shadow-2xl border-2 border-cyan-400 flex items-center gap-3">
                    <Navigation className="w-5 h-5" />
                    <div className="font-black uppercase tracking-wider text-sm">
                        {!snapSelectionStart && 'SNAP MODE: Click MAP to start rectangle selection'}
                        {snapSelectionStart && !snapSelectionEnd && 'SNAP MODE: Click MAP again to finish selection'}
                        {snapSelectionStart && snapSelectionEnd && `SNAP MODE: ${selectedSnapTaskIds.length} tasks selected - Click SNAP button to snap to roads`}
                    </div>
                </div>
            </div>
        )}

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
            hoveredPlaygroundId={hoveredPlaygroundId}
            onHoverPlayground={setHoveredPlaygroundId}
            onOpenTeamDashboard={() => setShowTeamDashboard(true)}
            onRelocateGame={handleRelocateGame}
            isRelocating={isRelocating}
            onUpdateGameTime={handleUpdateGameTime}
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
            locateFeedback={locateFeedback}
            authUser={authUser}
            activeGame={activeGame}
            onUpdateGame={updateActiveGame}
            onStartSimulation={handleStartSimulation}
            onToggleSnapToRoad={handleToggleSnapToRoad}
            snapToRoadMode={snapToRoadMode}
            showTeamPaths={showTeamPaths}
            onToggleTeamPaths={() => setShowTeamPaths(!showTeamPaths)}
            showTeamPathSelector={showTeamPathSelector}
            selectedTeamPaths={selectedTeamPaths}
            onToggleTeamPathSelector={handleToggleTeamPathSelector}
            onSelectTeamPath={handleSelectTeamPath}
            fogOfWarEnabled={fogOfWarEnabled}
            selectedTeamForFogOfWar={selectedTeamForFogOfWar}
            onToggleFogOfWar={() => setFogOfWarEnabled(!fogOfWarEnabled)}
            onSelectTeamForFogOfWar={setSelectedTeamForFogOfWar}
            teams={teamsForFogOfWar}
            onOpenRemoteOverride={() => setShowRemoteOverride(true)}
            showMapLayer={showMapLayer}
            showZoneLayer={showZoneLayer}
            showTaskLayer={showTaskLayer}
            showLiveLayer={showLiveLayer}
            onToggleMapLayer={() => setShowMapLayer(!showMapLayer)}
            onToggleZoneLayer={() => setShowZoneLayer(!showZoneLayer)}
            onToggleTaskLayer={() => setShowTaskLayer(!showTaskLayer)}
            onToggleLiveLayer={() => setShowLiveLayer(!showLiveLayer)}
            collapsedSections={collapsedSections}
            onCollapsedSectionsChange={setCollapsedSections}
        />

        {/* Impossible Travel Warnings - EDIT and INSTRUCTOR modes only */}
        {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && activeGame && (
            <ImpossibleTravelWarnings
                gameId={activeGame.id}
                onJumpToLocation={(loc) => mapRef.current?.jumpTo(loc)}
            />
        )}

        {/* Remote Override Modal - Emergency controls for Game Master */}
        {showRemoteOverride && activeGame && (
            <RemoteOverrideModal
                isOpen={showRemoteOverride}
                onClose={() => setShowRemoteOverride(false)}
                gameId={activeGame.id}
                teams={teamsForFogOfWar}
                tasks={activeGame.points || []}
                onJumpToLocation={(loc) => mapRef.current?.jumpTo(loc)}
                onTaskForceComplete={async (teamId, taskId) => {
                    // Update team's completed points
                    const team = teamsForFogOfWar.find(t => t.id === teamId);
                    if (team) {
                        const updatedCompletedIds = [...(team.completedPointIds || []), taskId];
                        await db.updateTeam(teamId, {
                            ...team,
                            completedPointIds: updatedCompletedIds,
                        });

                        // Refresh teams list
                        const updatedTeams = await db.fetchTeams(activeGame.id);
                        setTeamsForFogOfWar(updatedTeams);
                    }
                }}
            />
        )}

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
                onSaveGame={() => {
                    if (activeGame) {
                        updateActiveGame({
                            ...activeGame,
                            drawerStates: {
                                settingsCollapsedSections: collapsedSections,
                                visibleToolbars: activeGame.drawerStates?.visibleToolbars || {}
                            }
                        });
                    }
                }}
                onOpenTaskMaster={() => setShowTaskMaster(true)}
                onFitBounds={(coords) => {
                    if (coords && coords.length > 0) mapRef.current?.fitBounds(coords);
                    else mapRef.current?.fitBounds(activeGame?.points || []);
                }}
                onHoverPoint={(point) => setHoveredPointId(point?.id || null)}
                onHoverDangerZone={(zoneId) => setHoveredDangerZoneId(zoneId)}
                mapHoveredPointId={mapHoveredPointId}
                onOpenPlaygroundEditor={async (playgroundId?: string) => {
                    if (playgroundId) {
                        setViewingPlaygroundId(playgroundId);
                    } else {
                        // If no playground exists, create one first
                        if (!activeGame?.playgrounds || activeGame.playgrounds.length === 0) {
                            if (!activeGame) return;

                            const newPlaygroundId = `pg-${Date.now()}`;
                            const center = mapRef.current?.getCenter() || { lat: 55.6761, lng: 12.5683 };

                            const newPlayground = {
                                id: newPlaygroundId,
                                title: 'New Playzone',
                                buttonVisible: true,
                                iconId: 'default',
                                location: center
                            };

                            await updateActiveGame({
                                ...activeGame,
                                playgrounds: [newPlayground]
                            });

                            setViewingPlaygroundId(newPlaygroundId);
                        } else {
                            setViewingPlaygroundId(activeGame.playgrounds[0].id);
                        }
                    }
                }}
                initialExpanded={true}
                onExpandChange={setIsEditorExpanded}
                routes={activeGame?.routes}
                onAddRoute={(route) => activeGame && updateActiveGame({ ...activeGame, routes: [...(activeGame.routes || []), route] })}
                onDeleteRoute={(id) => activeGame && updateActiveGame({ ...activeGame, routes: (activeGame.routes || []).filter(r => r.id !== id) })}
                onUpdateRoute={handleUpdateRoute}
                onToggleRoute={(id) => { if (activeGame) { const updated = (activeGame.routes || []).map(r => r.id === id ? { ...r, isVisible: !r.isVisible } : r); updateActiveGame({ ...activeGame, routes: updated }); }}}
                showScores={showScores}
                onToggleScores={() => setShowScores(!showScores)}
                isGameTemplateMode={!!activeGame?.isGameTemplate}
                onSaveGameTemplate={handleSaveGameTemplate}
                onAddTask={async (type, playgroundId) => {
                    if (!activeGame) return;
                    const center = mapRef.current?.getCenter();
                    if (type === 'MANUAL') {
                        // For playground points, don't set a map location
                        const pointLocation = playgroundId ? null : (center || { lat: 55.676111, lng: 12.568333 }); // Default to Copenhagen if no center
                        const newPoint: GamePoint = {
                            id: `p-${Date.now()}`,
                            title: 'New Task',
                            location: pointLocation,
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
                    } else if (type === 'AI') {
                        setTaskMasterInitialTab('LIBRARY');
                        setTaskMasterInitialModal('AI');
                        setShowTaskMaster(true);
                    } else if (type === 'TASKLIST') {
                        setTaskMasterInitialTab('LISTS');
                        setTaskMasterInitialModal(null);
                        setShowTaskMaster(true);
                    } else if (type === 'LIBRARY') {
                        setTaskMasterInitialTab('LIBRARY');
                        setTaskMasterInitialModal(null);
                        setShowTaskMaster(true);
                    }
                }}
                onShowPlayzoneChoice={() => setShowPlayzoneChoiceModal(true)}
                hoveredPlaygroundId={hoveredPlaygroundId}
                onHoverPlayground={setHoveredPlaygroundId}
                collapsedZones={collapsedZones}
                onCollapsedZonesChange={setCollapsedZones}
            />
        )}

        {/* Playzone Choice Modal */}
        {showPlayzoneChoiceModal && (
            <div className="fixed inset-0 z-[5000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-emerald-600 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95">
                    <h2 className="text-2xl font-black text-white mb-2">ADD PLAYZONE</h2>
                    <p className="text-sm text-slate-400 mb-6">Choose how you want to create your playzone</p>

                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                setShowPlayzoneChoiceModal(false);
                                // Create new playzone
                                if (!activeGame) return;
                                const newPlaygroundId = `pg-${Date.now()}`;
                                const center = mapRef.current?.getCenter() || { lat: 55.6761, lng: 12.5683 };
                                const newPlayground = {
                                    id: newPlaygroundId,
                                    title: 'New Playzone',
                                    buttonVisible: true,
                                    iconId: 'default',
                                    location: center
                                };
                                updateActiveGame({
                                    ...activeGame,
                                    playgrounds: [...(activeGame.playgrounds || []), newPlayground]
                                }).then(() => {
                                    setViewingPlaygroundId(newPlaygroundId);
                                });
                            }}
                            className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
                        >
                            <Plus className="w-5 h-5" />
                            CREATE NEW
                        </button>

                        <button
                            onClick={() => {
                                setShowPlayzoneChoiceModal(false);
                                setShowPlayzoneSelector(true);
                            }}
                            className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
                        >
                            <Library className="w-5 h-5" />
                            ADD EXISTING PLAYZONE(S)
                        </button>
                    </div>

                    <button
                        onClick={() => setShowPlayzoneChoiceModal(false)}
                        className="w-full mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-widest rounded-lg transition-all duration-200"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}

        {showPlayzoneSelector && (
            <PlayzoneSelector
                onClose={() => setShowPlayzoneSelector(false)}
                onBack={() => {
                    setShowPlayzoneSelector(false);
                    setShowPlayzoneChoiceModal(true);
                }}
                onAddToGame={async (templates) => {
                    if (!activeGame) return;

                    // Copy playzones from templates into the active game
                    const newPlaygrounds = templates.map(tpl => ({
                        id: `pg-${Date.now()}-${Math.random()}`,
                        ...tpl.playgroundData,
                        title: tpl.title,
                        buttonVisible: true
                    }));

                    await updateActiveGame({
                        ...activeGame,
                        playgrounds: [...(activeGame.playgrounds || []), ...newPlaygrounds]
                    });
                }}
            />
        )}

        {showAccess && (
            <Access
                onGameSelected={(gameId) => {
                    setActiveGameId(gameId);
                    setShowAccess(false);
                    setMode(GameMode.PLAY);
                }}
                onBack={() => {
                    setShowAccess(false);
                    setShowLanding(true);
                }}
            />
        )}

        {!activeGameId && mode === GameMode.PLAY && !showLanding && !showAccess && !playgroundTemplateToEdit && (
            <WelcomeScreen
                games={playableGames}
                userLocation={userLocation}
                onStartGame={handleStartGame}
                onSetMapStyle={(s) => setLocalMapStyle(s)}
                language="English"
                onSetLanguage={() => {}}
                onBack={() => setShowLanding(true)}
            />
        )}

        {renderModals()}

        {/* Media Approval Notifications for Editor/Instructor */}
        {activeGame && (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
            <MediaApprovalNotification
                gameId={activeGame.id}
                onApprove={async (submissionId, partialScore) => {
                    const reviewedBy = authUser?.name || 'Instructor';
                    await approveMediaSubmission(submissionId, reviewedBy, partialScore);

                    // TODO: Award points to the team
                    // Get submission details and award points based on partialScore
                    alert('✅ Media approved! Points awarded to team.');
                }}
                onReject={async (submissionId, message) => {
                    const reviewedBy = authUser?.name || 'Instructor';

                    // TODO: Get media URL from submission before deleting
                    // For now, passing empty string (will need to fetch submission first)
                    await rejectMediaSubmission(submissionId, reviewedBy, message, '');

                    // TODO: Notify team and reopen task on map
                    alert('❌ Media rejected. Team has been notified.');
                }}
            />
        )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary componentName="TeamChallenge App">
      <OfflineIndicator />
      <TagColorsProvider>
        <LocationProvider>
          <GameApp />
        </LocationProvider>
      </TagColorsProvider>
    </ErrorBoundary>
  );
};

export default App;
