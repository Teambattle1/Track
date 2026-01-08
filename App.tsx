import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Ruler, Crosshair, Navigation, Plus, Library, Home, Trophy, Users, MessageSquare, QrCode, CheckCircle, XCircle, Compass, Maximize2, X } from 'lucide-react';
import { Game, GamePoint, TaskList, TaskTemplate, AuthUser, GameMode, Coordinate, MapStyleId, DangerZone, GameRoute, Team, ChatMessage, PlaygroundTemplate, InstructorNotification } from './types';
import { APP_VERSION } from './utils/version';
import * as db from './services/db';
import { supabase } from './lib/supabase';
import { authService } from './services/auth';
import { teamSync } from './services/teamSync';
import { LocationProvider, useLocation } from './contexts/LocationContext';
import { TagColorsProvider } from './contexts/TagColorsContext';
import { haversineMeters, isWithinRadius, isValidCoordinate } from './utils/geo';
import { snapPointsToRoad, isPointInBox } from './utils/mapbox';
import { playSound } from './utils/sounds';
import { filterTasksBySchedule } from './utils/taskScheduling';
import { vibrateChatNotification } from './utils/vibration';
import { generateDemoTeamHistory } from './services/teamHistoryDemo';
import GameMap, { GameMapHandle } from './components/GameMap';
import GameHUD from './components/GameHUD';
import GameManager from './components/GameManager';
import TaskMaster from './components/TaskMaster';
import TeamsModal from './components/TeamsModal';
import InstructorDashboard from './components/InstructorDashboard';
import TeamDashboard from './components/TeamDashboard';
import TabletFrame from './components/TabletFrame';
import WelcomeScreen from './components/WelcomeScreen';
import InitialLanding from './components/InitialLanding';
import LoginPage from './components/LoginPage';
import EditorDrawer from './components/EditorDrawer';
import TaskModal from './components/TaskModal';
import TaskEditor from './components/TaskEditor';
import DeleteGamesModal from './components/DeleteGamesModal';
import PlaygroundManager from './components/PlaygroundManager';
import AdminModal from './components/AdminModal';
import DatabaseToolsModal from './components/DatabaseToolsModal';
import ChatDrawer from './components/ChatDrawer';
import TeamsHubModal from './components/TeamsHubModal';
import TeamLobbyPanel from './components/TeamLobbyPanel';
import TeamsLobbySelector from './components/TeamsLobbySelector';
import DemoTeamsSelector from './components/DemoTeamsSelector';
import QRScannerModal from './components/QRScannerModal';
import ClientSubmissionView from './components/ClientSubmissionView';
import GameCreator from './components/GameCreator';
import TaskActionModal from './components/TaskActionModal';
import PlaygroundEditor from './components/PlaygroundEditor';
import PlayzoneGameView from './components/PlayzoneGameView';
import GameStatsModal from './components/GameStatsModal';
import MapStyleLibrary from './components/MapStyleLibrary';
import DevicePreviewToolbar from './components/DevicePreviewToolbar';
import MapDeviceFrame from './components/MapDeviceFrame';
import QRCodesTool from './components/QRCodesTool';
import GameStatsTool from './components/GameStatsTool';
import MessagePopup from './components/MessagePopup';
import Dashboard from './components/Dashboard';
import DangerZoneModal from './components/DangerZoneModal';
import DangerZoneWarningModal from './components/DangerZoneWarningModal';
import { useDangerZoneDetection } from './hooks/useDangerZoneDetection';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import MeasureBox from './components/MeasureBox';
import SupabaseDiagnostic from './components/SupabaseDiagnostic';
import SupabaseToolsModal from './components/SupabaseToolsModal';
import SystemSoundsModal from './components/SystemSoundsModal';
import ImpossibleTravelWarnings from './components/ImpossibleTravelWarnings';
import RemoteOverrideModal from './components/RemoteOverrideModal';
import ClientLobby from './components/ClientLobby';
import FullscreenOverlay from './components/FullscreenOverlay';
import ClientGameChooser from './components/ClientGameChooser';
import Access from './components/Access';
import PlayzoneSelector from './components/PlayzoneSelector';
import TranslationsManager from './components/TranslationsManager';
import MediaManager from './components/MediaManager';
import MediaApprovalNotification from './components/MediaApprovalNotification';
import MediaRejectionPopup from './components/MediaRejectionPopup';
import RankingModal from './components/RankingModal';
import InstructorNotificationPopup from './components/InstructorNotificationPopup';
import IntroMessageModal from './components/IntroMessageModal';
import FinishMessageModal from './components/FinishMessageModal';
import { approveMediaSubmission, rejectMediaSubmission, subscribeToMediaSubmissions} from './services/mediaUpload';
import { getConfiguredLanguagesForGame, validateTaskTranslations } from './utils/translationValidation';
import { createTaskIdMap, remapTaskLogicTargets, validateTaskReferences } from './utils/taskIdRemapping';
import { setupFullscreenOnInteraction } from './utils/fullscreen';

// Inner App Component that consumes LocationContext
const GameApp: React.FC = () => {
  // --- AUTH & USER STATE ---
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [userAccessMode, setUserAccessMode] = useState<'EDITOR' | 'INSTRUCTOR' | 'TEAM' | null>(null);

  // --- SUPABASE DIAGNOSTIC ---
  const [showSupabaseDiagnostic, setShowSupabaseDiagnostic] = useState(false);
  const [showTranslationsManager, setShowTranslationsManager] = useState(false);

  // CRITICAL NULL CHECK: Validate props before rendering
  // This prevents crashes from undefined game/playground states
  // Check if URL path is /login to show login page
  const [showLogin, setShowLogin] = useState(() => {
    return window.location.pathname === '/login';
  });

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
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showTeamDashboard, setShowTeamDashboard] = useState(false);
  const [showDeleteGames, setShowDeleteGames] = useState(false);
  const [showPlaygroundManager, setShowPlaygroundManager] = useState(false);
  const [showDatabaseTools, setShowDatabaseTools] = useState(false);
  const [showDatabaseToolsModal, setShowDatabaseToolsModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showTeamsHub, setShowTeamsHub] = useState(false);
  const [showTeamLobby, setShowTeamLobby] = useState(false);
  const [showTeamViewQRScanner, setShowTeamViewQRScanner] = useState(false);
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
  const [showSystemSounds, setShowSystemSounds] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [introModalShown, setIntroModalShown] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishModalShown, setFinishModalShown] = useState(false);

  // --- TEAM LOBBY ACCESS STATE ---
  const [gameForLobbyAccess, setGameForLobbyAccess] = useState<string | null>(null);
  const [showGameManagerForLobby, setShowGameManagerForLobby] = useState(false);
  const [selectedTeamIdForLobby, setSelectedTeamIdForLobby] = useState<string | null>(null);
  const [demoTeamsForLobby, setDemoTeamsForLobby] = useState<Team[]>([]);
  const [showTeamLobbySelectorModal, setShowTeamLobbySelectorModal] = useState(false);
  const [showDemoTeamSelectorModal, setShowDemoTeamSelectorModal] = useState(false);

  const playableGames = useMemo(() => games.filter(g => !g.isGameTemplate), [games]);
  const gameTemplates = useMemo(() => games.filter(g => g.isGameTemplate), [games]);
  
  // --- DASHBOARD STATE ---
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'dashboard' | 'games' | 'templates' | 'tasks' | 'users' | 'tags' | 'client'>('dashboard');

  // --- EDITOR STATE ---
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [activeTask, setActiveTask] = useState<GamePoint | null>(null);
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [viewingPlaygroundId, setViewingPlaygroundId] = useState<string | null>(null);
  const [playgroundTemplateToEdit, setPlaygroundTemplateToEdit] = useState<any>(null);
  const [activeTaskActionPoint, setActiveTaskActionPoint] = useState<GamePoint | null>(null);
  const [pendingDrawRequest, setPendingDrawRequest] = useState<'onOpen' | 'onCorrect' | 'onIncorrect' | null>(null);

  // --- DEVICE PREVIEW FOR EDIT MODE (viewing TEAM mode with device frames) ---
  const [teamEditDevice, setTeamEditDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [teamEditOrientation, setTeamEditOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [teamEditOrientationLocked, setTeamEditOrientationLocked] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(() => {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches;
  });

  // --- INSTRUCTOR NOTIFICATION STATE ---
  const [instructorNotifications, setInstructorNotifications] = useState<InstructorNotification[]>([]);

  // --- PLAY STATE (Location from Context) ---
  const { userLocation, gpsAccuracy, error: locationError } = useLocation();
  const [locateAttempt, setLocateAttempt] = useState(false);
  const [locateFeedback, setLocateFeedback] = useState<string | null>(null);
  const [activeTaskModalId, setActiveTaskModalId] = useState<string | null>(null); // Storing ID instead of Object to prevent stale state
  const [score, setScore] = useState(0);
  // Global display settings (used in EDIT mode and TEAMVIEW)
  const [showScores, setShowScores] = useState(true);
  const [showTaskId, setShowTaskId] = useState(true);
  const [showTaskTitle, setShowTaskTitle] = useState(true);
  const [showTaskActions, setShowTaskActions] = useState(true);

  // Separate state for INSTRUCTOR mode display settings (doesn't affect player view)
  const [instructorShowScores, setInstructorShowScores] = useState(true);
  const [instructorShowTaskId, setInstructorShowTaskId] = useState(true);
  const [instructorShowTaskTitle, setInstructorShowTaskTitle] = useState(true);
  const [instructorShowTaskActions, setInstructorShowTaskActions] = useState(true);

  // Media rejection notification for teams
  const [rejectedSubmission, setRejectedSubmission] = useState<{
    taskTitle: string;
    reviewerName: string;
    message: string;
    allowMultipleSubmissions: boolean;
  } | null>(null);
  const [showTeamPaths, setShowTeamPaths] = useState(false);
  const [showTeamPathSelector, setShowTeamPathSelector] = useState(false);
  const [selectedTeamPaths, setSelectedTeamPaths] = useState<string[]>([]); // Array of team IDs to show paths for
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(false);
  const [selectedTeamForFogOfWar, setSelectedTeamForFogOfWar] = useState<string | null>(null);
  const [teamsForFogOfWar, setTeamsForFogOfWar] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null); // Current team when playing in PLAY mode
  const [showRemoteOverride, setShowRemoteOverride] = useState(false);
  const [hoveredPlaygroundId, setHoveredPlaygroundId] = useState<string | null>(null);

  // --- DANGER ZONE STATE ---
  const [dangerZoneScore, setDangerZoneScore] = useState(0); // Track score deductions from danger zones

  // Layer toggles (all default to true/visible)
  const [showMapLayer, setShowMapLayer] = useState(true);
  const [showZoneLayer, setShowZoneLayer] = useState(true);
  const [showTaskLayer, setShowTaskLayer] = useState(true);
  const [showLiveLayer, setShowLiveLayer] = useState(true);

  const [currentDangerZone, setCurrentDangerZone] = useState<DangerZone | null>(null);
  const [activeDangerZone, setActiveDangerZone] = useState<DangerZone | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [latestMessage, setLatestMessage] = useState<ChatMessage | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
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

  // --- SIMULATION MODE ---
  const [isSimulationMode, setIsSimulationMode] = useState(false);

  // --- HOVER STATE ---
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null); // List → Map
  const [hoveredDangerZoneId, setHoveredDangerZoneId] = useState<string | null>(null); // List → Map
  const [mapHoveredPointId, setMapHoveredPointId] = useState<string | null>(null); // Map → List (reverse)

  // --- TEAM VIEW TOOLTIP STATE ---
  const [selectedPointForTooltip, setSelectedPointForTooltip] = useState<string | null>(null);

  // --- DRAWER & TOOLBAR STATE ---
  // Default state for EDIT mode - all sections collapsed for clean workspace
  const EDIT_MODE_COLLAPSED_SECTIONS: Record<string, boolean> = {
    mapmode: true,
    layers: true,
    location: true,
    mapstyle: true,
    device: true,
    orientation: true,
    zonechange: true,
    pins: true,
    show: true,
    tools: true,
    ranking: true,
    teams: true,
  };

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(EDIT_MODE_COLLAPSED_SECTIONS);
  const [collapsedZones, setCollapsedZones] = useState<Record<string, boolean>>({ 'map': true });

  // --- LOAD DRAWER STATES FROM ACTIVE GAME OR SET EDIT MODE DEFAULTS ---
  useEffect(() => {
    // If entering EDIT mode, always force collapsed sections regardless of saved state
    if (mode === GameMode.EDIT) {
      setCollapsedSections(EDIT_MODE_COLLAPSED_SECTIONS);
      setCollapsedZones({ 'map': true });
      return;
    }

    // For other modes, load saved drawer states from game
    if (activeGame?.drawerStates) {
      if (activeGame.drawerStates.settingsCollapsedSections) {
        setCollapsedSections(activeGame.drawerStates.settingsCollapsedSections);
      }
      if (activeGame.drawerStates.settingsCollapsedZones) {
        setCollapsedZones(activeGame.drawerStates.settingsCollapsedZones);
      }
    }
  }, [activeGame?.id, mode]);

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

  // --- RESPONSIVE SCREEN SIZE TRACKING ---
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)');

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsSmallScreen(e.matches);
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      // Only hide login if we're NOT at the /login route
      if (window.location.pathname !== '/login') {
        setShowLogin(false);
      }
      const user = authService.getCurrentUser();
      if (user) {
        setAuthUser(user);
      }

      try {
        // Attempt to load data without blocking on connection test
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

        // Run connection test in background (non-blocking)
        db.testDatabaseConnection().then(result => {
          if (!result.success) {
            console.warn('[App] Background connection test warning:', result.error);
          }
        }).catch(err => {
          console.warn('[App] Background connection test error:', err.message);
        });
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

  // --- FULLSCREEN MODE ON MOBILE/TABLET ---
  useEffect(() => {
    // Setup fullscreen on mobile/tablet devices
    // Will trigger on first user interaction (click, touch, or keyboard)
    setupFullscreenOnInteraction();
  }, []);

  // --- PERSIST ACTIVE GAME TO LOCALSTORAGE ---
  useEffect(() => {
    if (activeGameId) {
      localStorage.setItem('activeGameId', activeGameId);
    } else {
      localStorage.removeItem('activeGameId');
    }
  }, [activeGameId]);

  // --- DEMO TEAMS GENERATION FOR EDIT MODE (Lobby Preview) ---
  useEffect(() => {
    // Only generate demo teams in EDIT mode when there are no real teams
    if (mode !== GameMode.EDIT || !activeGame) {
      setDemoTeamsForLobby([]);
      return;
    }

    // Fetch real teams for this game
    const loadTeams = async () => {
      try {
        const realTeams = await db.fetchTeams(activeGame.id);

        // If there are real teams, don't show demo teams
        if (realTeams && realTeams.length > 0) {
          setDemoTeamsForLobby([]);
          return;
        }

        // No real teams - generate 3 demo teams
        const gameCenter = activeGame.points?.[0]?.location || { lat: 55.6761, lng: 12.5683 };
        const demoHistory = generateDemoTeamHistory(gameCenter, 3);

        // Convert demo history to Team interface
        const demoTeams: Team[] = demoHistory.map(history => ({
          id: history.teamId,
          gameId: activeGame.id,
          name: history.teamName,
          score: 1200 + Math.floor(Math.random() * 800),
          completedPointIds: [],
          updatedAt: new Date().toISOString(),
          members: [], // Demo teams will have no members for now
          photoUrl: undefined,
          captainDeviceId: undefined,
          isStarted: true,
          startedAt: Date.now() - 1800000 // Started 30 min ago
        }));

        setDemoTeamsForLobby(demoTeams);
      } catch (error) {
        console.error('[Demo Teams] Error loading teams:', error);
        setDemoTeamsForLobby([]);
      }
    };

    loadTeams();
  }, [mode, activeGame?.id]);

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
  }, [activeGameId]);

  // --- ENSURE EDIT MODE WHEN GAME OPENED FROM MANAGER ---
  useEffect(() => {
      // When GameManager closes and a game is selected, ensure mode is EDIT
      if (!showGameChooser && activeGameId && mode === GameMode.PLAY) {
          console.log('[GameManager] Game selected, setting mode to EDIT');
          setMode(GameMode.EDIT);
      }
  }, [showGameChooser, activeGameId]);

  // --- MULTI-USER EDIT SYNC (realtime with safe fallback) ---
  useEffect(() => {
      if (!activeGameId) return;
      if (mode !== GameMode.EDIT && mode !== GameMode.INSTRUCTOR) return;
      // Avoid overwriting local, unsaved edits while a point is open in the editor.
      if (activeTask) return;

      let isSubscribed = false;
      let pollingId: number | null = null;
      let lastReceivedDbUpdatedAt = activeGame?.dbUpdatedAt;
      const channel = supabase.channel(`game_changes_${activeGameId}`);

      const applyRemoteGame = (remote: Game) => {
          if (remote.dbUpdatedAt && remote.dbUpdatedAt === lastReceivedDbUpdatedAt) return;
          lastReceivedDbUpdatedAt = remote.dbUpdatedAt;
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
  }, [activeGameId, mode, activeTask]);

  // --- CHAT NOTIFICATIONS ---
  useEffect(() => {
      if (!activeGameId) return;

      // Subscribe to incoming chat messages
      const unsubscribe = teamSync.subscribeToChat((message: ChatMessage) => {
          // Add message to history
          setChatHistory(prev => [...prev, message]);

          // Only show notification if chat drawer is closed
          if (!showChatDrawer) {
              setUnreadMessageCount(prev => prev + 1);

              // Play notification sound
              const notificationSound = 'https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3';
              playSound(notificationSound, 70);

              // Vibrate device
              vibrateChatNotification(message.isUrgent || false);

              // Show popup notification for new message
              setLatestMessage(message);
          } else {
              // Chat drawer is open - reset unread count
              setUnreadMessageCount(0);
          }
      });

      return () => unsubscribe?.();
  }, [activeGameId, showChatDrawer]);

  // Reset unread messages when chat drawer opens
  useEffect(() => {
      if (showChatDrawer) {
          setUnreadMessageCount(0);
      }
  }, [showChatDrawer]);

  // --- CURRENT TEAM DATA LOADING (for schedule calculations in PLAY mode) ---
  useEffect(() => {
      if (!activeGameId || mode !== GameMode.PLAY) {
          setCurrentTeam(null);
          return;
      }

      // Check if teamSync is connected
      const teamState = teamSync.getState();
      if (!teamState.teamId) return;

      // Load the team's data
      const loadTeam = async () => {
          try {
              const team = await db.fetchTeam(teamState.teamId);
              setCurrentTeam(team);
          } catch (error) {
              console.error('[Schedule] Failed to load current team:', error);
          }
      };

      loadTeam();

      // Refresh team data periodically (in case startedAt is updated)
      const interval = setInterval(loadTeam, 10000); // Every 10 seconds
      return () => clearInterval(interval);
  }, [activeGameId, mode]);

  // --- MEDIA REJECTION NOTIFICATIONS (for team players) ---
  useEffect(() => {
      if (!activeGameId || !activeGame) return;

      // Only subscribe when in team mode (when teamSync is connected)
      const teamState = teamSync.getState();
      if (!teamState.teamId) return; // Not in team mode

      console.log('[Media Rejection] Setting up subscription for team:', teamState.teamId);

      const unsubscribe = subscribeToMediaSubmissions(activeGameId, (submission) => {
          // Only handle rejections for this team
          if (submission.status !== 'rejected') return;
          if (submission.teamId !== teamState.teamId) return;

          console.log('[Media Rejection] Received rejection for team:', submission);

          // Find the task to check if multiple submissions are allowed
          const task = activeGame.points.find(p => p.id === submission.pointId);
          const allowMultipleSubmissions = task?.task?.requireMedia?.allowMultipleSubmissions ?? false;

          // Set the rejection data to show popup
          setRejectedSubmission({
              taskTitle: submission.pointTitle || 'Unknown Task',
              reviewerName: submission.reviewedBy || 'Instructor',
              message: submission.reviewComment || 'Your submission did not meet the requirements.',
              allowMultipleSubmissions
          });

          // Play error sound and vibrate
          playSound('https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3', 80);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      });

      return () => unsubscribe?.();
  }, [activeGameId]);

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
  }, [userLocation, activeGame?.id, mode]);

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

  // --- INTRO MESSAGE MODAL (TEAM MODE ONLY) ---
  useEffect(() => {
      if (
          mode === GameMode.PLAY &&
          userAccessMode === 'TEAM' &&
          activeGame?.introMessageConfig?.enabled &&
          !introModalShown &&
          activeGame?.timerConfig?.startTime
      ) {
          const now = Date.now();
          const startTime = new Date(activeGame.timerConfig.startTime).getTime();

          // Show intro modal when game starts (lobby timer expires)
          if (now >= startTime) {
              setShowIntroModal(true);
              setIntroModalShown(true);
          }
      }
  }, [mode, userAccessMode, activeGame?.introMessageConfig, activeGame?.timerConfig?.startTime, introModalShown]);

  // --- DANGER ZONE DETECTION (PLAY MODE ONLY) ---
  const handleScoreChange = useCallback((newScore: number) => {
      setScore(newScore);
  }, []);

  const memoizedDangerZones = useMemo(() => {
      return mode === GameMode.PLAY ? (activeGame?.dangerZones || []) : [];
  }, [mode, activeGame?.id]);

  const dangerZoneState = useDangerZoneDetection(
      mode === GameMode.PLAY ? userLocation : null,
      memoizedDangerZones,
      score,
      handleScoreChange
  );

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
  }, [activeGame?.id, mode]);

  // Derived Active Modal Point (Live Data)
  const liveTaskModalPoint = useMemo(() => {
      if (!activeTaskModalId || !activeGame) return null;
      return activeGame?.points?.find(p => p.id === activeTaskModalId) || null;
  }, [activeTaskModalId, activeGame?.id]);

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
  }, [activeGame?.id, selectedTeamPaths, teamsForFogOfWar.length]);

  // Filter tasks based on scheduled visibility
  const visiblePoints = useMemo(() => {
      if (!activeGame?.points) return [];

      // Determine team start time for schedule calculations
      // Priority: 1) Current team (in PLAY mode), 2) Fog of War selected team, 3) First team in list, 4) undefined
      let teamStartTime: number | undefined = undefined;

      if (mode === GameMode.PLAY && currentTeam?.startedAt) {
          // Use current team's start time when playing
          teamStartTime = currentTeam.startedAt;
      } else if (selectedTeamForFogOfWar) {
          // Use selected team for fog of war in INSTRUCTOR mode
          const team = teamsForFogOfWar.find(t => t.id === selectedTeamForFogOfWar);
          teamStartTime = team?.startedAt;
      } else if (teamsForFogOfWar.length > 0) {
          // Fallback to first team
          teamStartTime = teamsForFogOfWar[0]?.startedAt;
      }

      // In EDIT/INSTRUCTOR mode, show all tasks (no schedule filtering)
      // Scheduling only affects PLAY mode (team view)
      if (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) {
          return activeGame.points;
      }

      // Apply schedule filtering for PLAY mode
      return filterTasksBySchedule(
          activeGame.points,
          teamStartTime,
          activeGame.timerConfig
      );
  }, [activeGame?.id, mode, currentTeam?.startedAt, selectedTeamForFogOfWar, teamsForFogOfWar.length]);


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
          const isPlayzoneGame = activeGame.gameMode === 'playzone';

          const taskTemplates = activeGame.points.map(point => {
              // Get existing tags and ensure 'playzone' tag is added for playzone games
              const existingTags = Array.isArray(point.tags) ? point.tags : [];
              const tags = isPlayzoneGame || point.playgroundId
                  ? [...new Set([...existingTags, 'playzone'])] // Add 'playzone' tag and remove duplicates
                  : existingTags;

              return {
                  id: point.id, // Use original ID, not template-${point.id}
                  title: point.title,
                  task: point.task,
                  feedback: point.feedback,
                  points: point.points,
                  tags: tags,
                  iconId: point.iconId,
                  iconUrl: point.iconUrl,
                  completedIconId: (point as any).completedIconId,
                  completedIconUrl: (point as any).completedIconUrl,
                  settings: point.settings,
                  logic: point.logic,
                  activationTypes: point.activationTypes,
                  qrCodeString: point.qrCodeString,
                  nfcTagId: point.nfcTagId,
                  ibeaconUUID: point.ibeaconUUID,
                  colorScheme: point.colorScheme,
                  isColorSchemeLocked: point.isColorSchemeLocked,
                  createdAt: Date.now(),
                  intro: point.shortIntro
              } as TaskTemplate;
          });

          const { ok } = await db.saveTemplates(taskTemplates);

          if (ok) {
              // Reload the global library to show newly exported tasks
              const updatedLib = await db.fetchLibrary();
              setTaskLibrary(updatedLib);

              const playzoneCount = taskTemplates.filter(t => t.tags.includes('playzone')).length;
              alert(`✅ Exported ${taskTemplates.length} tasks to Global Library and synced to Supabase!\n${playzoneCount > 0 ? `(${playzoneCount} tagged as PLAYZONE)` : ''}`);
              console.log('[Export] Tasks exported to library:', taskTemplates.length, 'Playzone tasks:', playzoneCount);
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
      try {
          // Validate coordinate
          if (!coord || !isValidCoordinate(coord)) {
              console.warn('[Map Click] Invalid coordinate:', coord);
              return;
          }

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
                  // Validate both coordinates before using isPointInBox
                  if (!isValidCoordinate(snapSelectionStart)) {
                      console.warn('[Snap to Road] Invalid start coordinate:', snapSelectionStart);
                      return;
                  }

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

              // Validate relocate scope center
              if (!isValidCoordinate(relocateScopeCenter)) {
                  console.warn('[Relocate] Invalid scope center:', relocateScopeCenter);
                  return;
              }

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
      } catch (error) {
          console.error('[Map Click] Error handling map click:', error);
          // Silently handle the error - don't exit to landing page
          return;
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

  const handleTeamLobbyClick = () => {
      console.log('[TeamLobby] Button clicked, mode:', mode);

      if (mode === GameMode.PLAY) {
          // PLAY mode: Open GameManager for lobby game selection
          console.log('[TeamLobby] PLAY mode - opening GameManager for lobby selection');
          setShowGameManagerForLobby(true);
      } else if (mode === GameMode.INSTRUCTOR) {
          // INSTRUCTOR mode: Show TeamsLobbySelector for current game
          if (activeGameId) {
              console.log('[TeamLobby] INSTRUCTOR mode - opening TeamsLobbySelector');
              setShowTeamLobbySelectorModal(true);
          }
      } else if (mode === GameMode.EDIT) {
          // EDIT mode: Show DemoTeamsSelector if demo teams available
          if (demoTeamsForLobby.length > 0) {
              console.log('[TeamLobby] EDIT mode - opening DemoTeamsSelector');
              setShowDemoTeamSelectorModal(true);
          } else {
              console.log('[TeamLobby] EDIT mode - no demo teams available');
          }
      }
  };

  const handleUpdateGameTime = async (newEndTime: number) => {
      console.log('[App] handleUpdateGameTime called with:', new Date(newEndTime).toISOString());
      if (!activeGame) {
          console.warn('[App] No activeGame, returning');
          return;
      }

      try {
          // Update the game with the new end time
          const updatedGame = {
              ...activeGame,
              timerConfig: {
                  ...activeGame.timerConfig,
                  endTime: new Date(newEndTime).toISOString(),
                  mode: activeGame.timerConfig?.mode || 'countdown'
              }
          };

          console.log('[App] Updating game with new timerConfig:', updatedGame.timerConfig);
          await updateActiveGame(updatedGame);
          console.log('[App] Game updated successfully');
      } catch (error) {
          console.error('[App] Error in handleUpdateGameTime:', error);
          throw error;
      }
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
      console.log('[Simulation] Starting simulation mode in tablet landscape view');
      // Switch to PLAY mode and enable simulation UI
      setMode(GameMode.PLAY);
      setIsSimulationMode(true);
  };

  const handleSelectSnapTools = () => {
      if (snapToRoadMode) {
          // Exiting selection mode - clear everything
          console.log('[Snap to Road] Exiting selection mode');
          setSnapToRoadMode(false);
          setSnapSelectionStart(null);
          setSnapSelectionEnd(null);
          setSelectedSnapTaskIds([]);
      } else {
          // Entering selection mode - draw rectangle to select tasks
          console.log('[Snap to Road] Entering selection mode - draw rectangle to select tasks');
          setSnapToRoadMode(true);
          setSnapSelectionStart(null);
          setSnapSelectionEnd(null);
          setSelectedSnapTaskIds([]);
      }
  };

  const handleExecuteSnap = async () => {
      console.log('[Snap to Road] Executing snap action');

      if (!activeGame || selectedSnapTaskIds.length === 0) {
          console.log('[Snap to Road] No tasks selected or no active game');
          return;
      }

      // Get coordinates of selected tasks (ONLY map tasks, not playzone tasks)
      const tasksToSnap = activeGame.points.filter(p =>
          selectedSnapTaskIds.includes(p.id) &&
          p.location &&
          !p.playgroundId // Exclude playzone tasks
      );
      const coordinates = tasksToSnap.map(p => p.location!);

      console.log('[Snap to Road] Snapping', tasksToSnap.length, 'MAP tasks to roads (excluding playzone tasks)');

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

      // Clear selection and exit selection mode
      setSnapToRoadMode(false);
      setSnapSelectionStart(null);
      setSnapSelectionEnd(null);
      setSelectedSnapTaskIds([]);
  };

  const handleToggleSnapToRoad = handleSelectSnapTools;

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

  // --- INSTRUCTOR NOTIFICATIONS ---
  const addInstructorNotification = (taskId: string, taskTitle: string, trigger: 'onOpen' | 'onCorrect' | 'onIncorrect') => {
      if (!activeGame) return;

      const teamName = teamSync.getTeamName() || 'Unknown Team';
      const notification: InstructorNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          gameId: activeGame.id,
          teamName,
          taskTitle,
          taskId,
          trigger,
          timestamp: Date.now(),
          read: false
      };

      setInstructorNotifications(prev => [notification, ...prev]);
  };

  const triggerInstructorNotification = (point: GamePoint, trigger: 'onOpen' | 'onCorrect' | 'onIncorrect') => {
      // Check if task has notify_instructor action for this trigger
      const actions = point.logic?.[trigger] || [];
      const hasNotifyAction = actions.some(action => action.type === 'notify_instructor');

      if (hasNotifyAction && mode !== GameMode.INSTRUCTOR && mode !== GameMode.EDIT) {
          // Only trigger from team play mode, not from instructor/editor viewing
          addInstructorNotification(point.id, point.title, trigger);
      }
  };

  const dismissNotification = (id: string) => {
      setInstructorNotifications(prev => prev.filter(n => n.id !== id));
  };

  const dismissAllNotifications = () => {
      setInstructorNotifications([]);
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
              onLoginSuccess={(user, mode) => {
                  setAuthUser(user);
                  setUserAccessMode(mode);
                  setShowLogin(false);

                  // For INSTRUCTOR mode, go directly to game chooser in instructor mode
                  if (mode === 'INSTRUCTOR') {
                      setShowLanding(false);
                      setShowGameChooser(true);
                      setMode(GameMode.INSTRUCTOR);
                  }

                  // Navigate to home if we came from /login URL
                  if (window.location.pathname === '/login') {
                      window.history.pushState({}, '', '/');
                  }
              }}
              onPlayAsGuest={() => {
                  setAuthUser({ id: 'guest', name: 'Guest', email: '', role: 'Editor' });
                  setUserAccessMode('TEAM');
                  setShowLogin(false);
                  // Navigate to home if we came from /login URL
                  if (window.location.pathname === '/login') {
                      window.history.pushState({}, '', '/');
                  }
              }}
              onBack={() => {
                  setShowLogin(false);
                  // Navigate to home if we came from /login URL
                  if (window.location.pathname === '/login') {
                      window.history.pushState({}, '', '/');
                  }
              }}
          />
      );
  }

  // Render fullscreen overlay on all screens
  const renderFullscreenOverlay = () => <FullscreenOverlay />;

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
                  onSelectGame={(id) => {
                      console.log('[App.tsx] onSelectGame called:', { id, currentMode: mode });
                      setActiveGameId(id);
                      setShowGameChooser(false);
                      setShowLanding(false);
                      console.log('[App.tsx] onSelectGame: state updates queued');
                  }}
                  onDeleteGame={handleDeleteGame}
                  onClose={() => setShowGameChooser(false)}
                  onEditGame={(id) => {
                      console.log('[App.tsx] onEditGame called:', { id, currentActiveGameId: activeGameId, currentMode: mode });
                      setActiveGameId(id);
                      setMode(GameMode.EDIT);
                      setShowGameChooser(false);
                      setShowLanding(false);
                      console.log('[App.tsx] onEditGame: state updates queued');
                  }}
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

          {/* Task Editor for EDIT mode */}
          {activeTask && mode === GameMode.EDIT && taskEditorOpen && (
              <TaskEditor
                  point={activeTask}
                  onSave={async (updatedPoint) => {
                      if (!activeGame) return;
                      const updatedPoints = activeGame.points.map(p => p.id === updatedPoint.id ? updatedPoint : p);
                      await updateActiveGame({ ...activeGame, points: updatedPoints });
                      setTaskEditorOpen(false);
                      setActiveTask(null);
                  }}
                  onDelete={async (pointId) => {
                      await handleDeleteItem(pointId);
                      setTaskEditorOpen(false);
                      setActiveTask(null);
                  }}
                  onClose={() => {
                      setTaskEditorOpen(false);
                      setActiveTask(null);
                  }}
              />
          )}

          {/* Task Modal for PLAY/INSTRUCTOR modes */}
          {activeTask && (mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR) && (
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
                      // Trigger instructor notification on correct answer
                      triggerInstructorNotification(liveTaskModalPoint, 'onCorrect');

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
                  onTaskOpen={() => {
                      // Trigger instructor notification when task opens
                      triggerInstructorNotification(liveTaskModalPoint, 'onOpen');
                  }}
                  onTaskIncorrect={() => {
                      // Trigger instructor notification on incorrect answer
                      triggerInstructorNotification(liveTaskModalPoint, 'onIncorrect');
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

                          // Helper function to calculate spiral placement with 50m spacing
                          const getOffsetLocation = (center: Coordinate | null | undefined, index: number): Coordinate | null => {
                              if (!center) return null;
                              if (index === 0) return center; // First task at center

                              // Spiral placement: tasks arranged in a circle pattern
                              const radiusMeters = 50; // 50m spacing
                              const tasksPerRing = 6; // 6 tasks per ring
                              const ring = Math.floor((index - 1) / tasksPerRing) + 1;
                              const posInRing = (index - 1) % tasksPerRing;
                              const angle = (posInRing / tasksPerRing) * 2 * Math.PI;

                              // Calculate offset in meters
                              const offsetMeters = radiusMeters * ring;

                              // Convert meters to degrees (approximate)
                              const latOffset = (offsetMeters * Math.cos(angle)) / 111320; // 1 degree latitude ≈ 111.32 km
                              const lngOffset = (offsetMeters * Math.sin(angle)) / (111320 * Math.cos(center.lat * Math.PI / 180));

                              return {
                                  lat: center.lat + latOffset,
                                  lng: center.lng + lngOffset
                              };
                          };

                          const newPoints = tasks.map((t, idx) => ({
                              ...t,
                              id: t.id || `p-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                              location: getOffsetLocation(mapCenter, idx),
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

                          // Helper function to calculate spiral placement with 50m spacing
                          const getOffsetLocation = (center: Coordinate | null | undefined, index: number): Coordinate | null => {
                              if (!center) return null;
                              if (index === 0) return center; // First task at center

                              // Spiral placement: tasks arranged in a circle pattern
                              const radiusMeters = 50; // 50m spacing
                              const tasksPerRing = 6; // 6 tasks per ring
                              const ring = Math.floor((index - 1) / tasksPerRing) + 1;
                              const posInRing = (index - 1) % tasksPerRing;
                              const angle = (posInRing / tasksPerRing) * 2 * Math.PI;

                              // Calculate offset in meters
                              const offsetMeters = radiusMeters * ring;

                              // Convert meters to degrees (approximate)
                              const latOffset = (offsetMeters * Math.cos(angle)) / 111320; // 1 degree latitude ≈ 111.32 km
                              const lngOffset = (offsetMeters * Math.sin(angle)) / (111320 * Math.cos(center.lat * Math.PI / 180));

                              return {
                                  lat: center.lat + latOffset,
                                  lng: center.lng + lngOffset
                              };
                          };

                          const newPoints = list.tasks.map((t, idx) => ({
                              ...t,
                              id: t.id || `p-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                              location: getOffsetLocation(mapCenter, idx),
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
              <TabletFrame onClose={() => setShowInstructorDashboard(false)}>
                  <InstructorDashboard
                      game={activeGame}
                      onClose={() => setShowInstructorDashboard(false)}
                      onSetMode={setMode}
                      mode={mode}
                      onOpenPlayground={(playgroundId) => {
                          // Close instructor dashboard and open playzone in gameplay view
                          setShowInstructorDashboard(false);
                          setViewingPlaygroundId(playgroundId);
                          // Mode is already INSTRUCTOR, so PlayzoneGameView will render
                      }}
                  />
              </TabletFrame>
          )}
          {showTeamDashboard && activeGameId && (
              <TabletFrame onClose={() => setShowTeamDashboard(false)}>
                  <TeamDashboard
                      gameId={activeGameId}
                      game={activeGame || undefined}
                      totalMapPoints={activeGame?.points.length || 0}
                      onOpenAgents={() => {}}
                      onClose={() => setShowTeamDashboard(false)}
                      chatHistory={chatHistory}
                  />
              </TabletFrame>
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
                  onGameUpdated={(updatedGame) => {
                      // Update the games state when a playzone is imported
                      // This ensures the game editor shows the newly imported tasks
                      setGames(prevGames => prevGames.map(g =>
                          g.id === updatedGame.id ? updatedGame : g
                      ));

                      // Also update activeGame if it's the same game
                      // This ensures that if the user has the game open, it shows the new tasks
                      if (activeGame?.id === updatedGame.id) {
                          setActiveGame(updatedGame);
                          console.log('[App] \u2705 Active game state also updated');
                      }

                      console.log('[App] \u2705 Games state updated after playzone import');
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
              <>
                  {/* EDITOR MODE: Full authoring environment */}
                  {mode === GameMode.EDIT && (
                      <PlaygroundEditor
                          game={activeGame}
                          initialPlaygroundId={viewingPlaygroundId}
                          onUpdateGame={(updatedGame) => {
                              updateActiveGame(updatedGame);
                          }}
                          onClose={() => {
                              setViewingPlaygroundId(null);
                          }}
                          isInstructorView={false}
                          pendingDrawTrigger={pendingDrawRequest}
                          activeTaskActionPoint={activeTaskActionPoint}
                          onDrawModeActivated={() => setPendingDrawRequest(null)}
                          onDrawModeDeactivated={() => setActiveTaskActionPoint(null)}
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
                                      task: { type: 'text', question: 'New Task Question' },
                                      tags: playgroundId ? ['playzone'] : []
                                  };
                                  await updateActiveGame({ ...activeGame, points: [...activeGame.points, newPoint] });

                                  // Save to global library
                                  const template: TaskTemplate = {
                                      id: newPoint.id,
                                      title: newPoint.title,
                                      task: newPoint.task,
                                      tags: newPoint.tags || (playgroundId ? ['playzone'] : []),
                                      iconId: newPoint.iconId,
                                      createdAt: Date.now(),
                                      points: newPoint.points,
                                      activationTypes: newPoint.activationTypes
                                  };
                                  await db.saveTemplate(template);
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
                          // onExportGameToLibrary removed - all tasks auto-sync now
                      />
                  )}

                  {/* INSTRUCTOR/TEAMPLAY MODE: Canvas-only gameplay view */}
                  {(mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                      <PlayzoneGameView
                          game={activeGame}
                          playgroundId={viewingPlaygroundId}
                          isInstructor={mode === GameMode.INSTRUCTOR}
                          showScores={mode === GameMode.INSTRUCTOR ? instructorShowScores : showScores}
                          currentScore={score}
                          onTaskComplete={(taskId) => {
                              // Award points and trigger actions
                              const task = activeGame.points?.find(p => p.id === taskId);
                              if (task?.points) {
                                  setScore(prev => prev + task.points);
                              }

                              // Mark task as completed
                              updateActiveGame({
                                  ...activeGame,
                                  points: activeGame.points.map(p =>
                                      p.id === taskId ? { ...p, isCompleted: true } : p
                                  )
                              });
                          }}
                          onClose={() => {
                              setViewingPlaygroundId(null);
                              // For PLAYZONE games, return to appropriate view
                              if (activeGame?.gameMode === 'playzone') {
                                  if (mode === GameMode.INSTRUCTOR) {
                                      setShowInstructorDashboard(true);
                                  } else if (mode === GameMode.PLAY) {
                                      setShowTeamDashboard(true);
                                  }
                              }
                          }}
                      />
                  )}
              </>
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

          {/* Team View - Team Lobby Modal */}
          {showTeamLobby && activeGame && (
              <TeamLobbyPanel
                  isOpen={showTeamLobby}
                  onClose={() => setShowTeamLobby(false)}
                  isCaptain={false}
              />
          )}

          {/* Team View - QR Scanner Modal */}
          {showTeamViewQRScanner && (
              <QRScannerModal
                  isOpen={showTeamViewQRScanner}
                  onClose={() => setShowTeamViewQRScanner(false)}
                  onScan={(data) => {
                      // Handle QR code scan for task activation
                      const task = activeGame?.points?.find(t =>
                          t.qrCodeString === data ||
                          t.nfcTagId === data ||
                          t.ibeaconUUID === data
                      );

                      if (task) {
                          // Open task modal
                          setActiveTaskModalId(task.id);
                      }

                      setShowTeamViewQRScanner(false);
                  }}
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
                  onStartDrawMode={(trigger) => {
                      // Set pending draw request and switch to EDIT mode
                      setPendingDrawRequest(trigger);
                      setMode(GameMode.EDIT);
                      // Don't clear activeTaskActionPoint - PlaygroundEditor needs it to setup draw mode
                      // It will be cleared later when draw mode exits
                  }}
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
          {activeGame?.introMessageConfig && (
              <IntroMessageModal
                  isOpen={showIntroModal}
                  onClose={() => setShowIntroModal(false)}
                  message={activeGame.introMessageConfig}
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
                    if (action === 'ADMIN') {
                        setShowDashboard(true);
                        setDashboardTab('users');
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
                            case 'TEMPLATES': setShowPlaygroundManager(true); break;
                            case 'DATABASE': setShowDatabaseTools(true); break;
                            case 'DATABASE_TOOLS': setShowDatabaseToolsModal(true); break;
                            case 'DIAGNOSTICS': setShowSupabaseDiagnostic(true); break;
                            case 'TRANSLATIONS': setShowTranslationsManager(true); break;
                            case 'MEDIA': setShowMediaManager(true); break;
                            case 'SYSTEM_SOUNDS': setShowSystemSounds(true); break;
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
            {showDatabaseToolsModal && (
                <DatabaseToolsModal
                    onClose={() => setShowDatabaseToolsModal(false)}
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

            {showSystemSounds && (
                <SystemSoundsModal
                    onClose={() => setShowSystemSounds(false)}
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

            {/* TEAM LOBBY ACCESS MODALS */}
            {/* GameManager for PLAY mode lobby game selection */}
            {showGameManagerForLobby && (
                <GameManager
                    games={playableGames}
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
                        setShowGameManagerForLobby(false);
                        setShowLanding(false);
                    }}
                    onSelectGame={(id) => {
                        console.log('[App] GameManager lobby selection:', { id });
                        setGameForLobbyAccess(id);
                        setShowGameManagerForLobby(false);
                        setShowTeamLobbySelectorModal(true);
                    }}
                    onDeleteGame={handleDeleteGame}
                    onClose={() => setShowGameManagerForLobby(false)}
                    onEditGame={(id) => {
                        setActiveGameId(id);
                        setMode(GameMode.EDIT);
                        setShowGameManagerForLobby(false);
                        setShowLanding(false);
                    }}
                    onEditGameSetup={(id) => {
                        const game = games.find(g => g.id === id);
                        if (game) {
                            setGameToEdit(game);
                            setActiveGameId(id);
                            setShowGameCreator(true);
                            setShowGameManagerForLobby(false);
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
                        setShowGameManagerForLobby(false);
                    }}
                />
            )}

            {/* TeamsLobbySelector for INSTRUCTOR mode */}
            {showTeamLobbySelectorModal && gameForLobbyAccess && (
                <TeamsLobbySelector
                    gameId={gameForLobbyAccess}
                    isOpen={showTeamLobbySelectorModal}
                    onClose={() => {
                        setShowTeamLobbySelectorModal(false);
                        setGameForLobbyAccess(null);
                    }}
                    onSelectTeam={(teamId) => {
                        setSelectedTeamIdForLobby(teamId);
                        setShowTeamLobbySelectorModal(false);
                    }}
                />
            )}

            {/* DemoTeamsSelector for EDIT mode */}
            {showDemoTeamSelectorModal && demoTeamsForLobby.length > 0 && (
                <DemoTeamsSelector
                    isOpen={showDemoTeamSelectorModal}
                    demoTeams={demoTeamsForLobby}
                    onClose={() => setShowDemoTeamSelectorModal(false)}
                    onSelectTeam={(teamId) => {
                        setSelectedTeamIdForLobby(teamId);
                        setShowDemoTeamSelectorModal(false);
                    }}
                />
            )}

            {/* TeamLobbyPanel with selectedTeamIdForLobby */}
            {selectedTeamIdForLobby && (
                <TeamLobbyPanel
                    isOpen={true}
                    onClose={() => {
                        setSelectedTeamIdForLobby(null);
                        setGameForLobbyAccess(null);
                    }}
                    teamId={selectedTeamIdForLobby}
                    isDemoTeam={demoTeamsForLobby.some(t => t.id === selectedTeamIdForLobby)}
                    isInstructorMode={mode === GameMode.INSTRUCTOR}
                    isCaptain={false}
                />
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
  // Wrap in simulation mode tablet frame if enabled
  const mainContent = (
    <div className="fixed inset-0 overflow-hidden bg-slate-900 text-white flex flex-col">
        {/* Map for EDIT/INSTRUCTOR modes - desktop: full screen, mobile/tablet: with device frame */}
        {activeGame?.gameMode !== 'playzone' && mode !== GameMode.PLAY && (() => {
            // Show device frame only if teamEditDevice is mobile or tablet (not desktop)
            const useDeviceFrame = teamEditDevice === 'mobile' || teamEditDevice === 'tablet';

            return useDeviceFrame ? (
                <div className="flex-1 flex items-center justify-center z-0 overflow-hidden">
                    <MapDeviceFrame device={teamEditDevice} orientation={teamEditOrientation}>
                        <GameMap
                ref={mapRef}
                points={visiblePoints}
                routes={activeGame?.routes || []}
                dangerZones={activeGame?.dangerZones || []}
                logicLinks={logicLinks} // Pass Logic Links!
                measurePath={measurePath}
                mode={mode}
                mapStyle={localMapStyle || 'osm'}
                onPointClick={(point) => {
                    if (mode === GameMode.PLAY) {
                        setSelectedPointForTooltip(point.id);
                        setTimeout(() => setSelectedPointForTooltip(null), 3000);
                    } else {
                        handlePointClick(point);
                    }
                }}
                onAreaColorClick={handleAreaColorClick}
                onZoneClick={(z) => {
                    if (mode === GameMode.PLAY) {
                        setSelectedPointForTooltip(z.id);
                        setTimeout(() => setSelectedPointForTooltip(null), 3000);
                    } else {
                        setActiveDangerZone(z);
                    }
                }}
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
                showScores={mode === GameMode.INSTRUCTOR ? instructorShowScores : showScores}
                showTaskId={mode === GameMode.INSTRUCTOR ? instructorShowTaskId : showTaskId}
                showTaskTitle={mode === GameMode.INSTRUCTOR ? instructorShowTaskTitle : showTaskTitle}
                showTaskActions={mode === GameMode.INSTRUCTOR ? instructorShowTaskActions : showTaskActions}
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
                showMapLayer={showMapLayer}
                showZoneLayer={showZoneLayer}
                showTaskLayer={showTaskLayer}
                            showLiveLayer={showLiveLayer}
                        />
                    </MapDeviceFrame>
                </div>
            ) : (
                <GameMap
                    ref={mapRef}
                    points={visiblePoints}
                    routes={activeGame?.routes || []}
                    dangerZones={activeGame?.dangerZones || []}
                    logicLinks={logicLinks}
                    measurePath={measurePath}
                    mode={mode}
                    mapStyle={localMapStyle || 'osm'}
                    onPointClick={(point) => {
                        if (mode === GameMode.PLAY) {
                            setSelectedPointForTooltip(point.id);
                            setTimeout(() => setSelectedPointForTooltip(null), 3000);
                        } else {
                            handlePointClick(point);
                        }
                    }}
                    onAreaColorClick={handleAreaColorClick}
                    onZoneClick={(z) => {
                        if (mode === GameMode.PLAY) {
                            setSelectedPointForTooltip(z.id);
                            setTimeout(() => setSelectedPointForTooltip(null), 3000);
                        } else {
                            setActiveDangerZone(z);
                        }
                    }}
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
                    showScores={mode === GameMode.INSTRUCTOR ? instructorShowScores : showScores}
                    showTaskId={mode === GameMode.INSTRUCTOR ? instructorShowTaskId : showTaskId}
                    showTaskTitle={mode === GameMode.INSTRUCTOR ? instructorShowTaskTitle : showTaskTitle}
                    showTaskActions={mode === GameMode.INSTRUCTOR ? instructorShowTaskActions : showTaskActions}
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
                    showMapLayer={showMapLayer}
                    showZoneLayer={showZoneLayer}
                    showTaskLayer={showTaskLayer}
                    showLiveLayer={showLiveLayer}
                />
            );
        })()}

        {/* PLAY MODE: Team HUD with device frame centered */}
        {mode === GameMode.PLAY && activeGame?.gameMode !== 'playzone' && (() => {
            const teamState = teamSync.getState();
            const teamMembers = teamSync.getAllMembers();
            const allTasks = activeGame?.points || [];
            const correctTasks = allTasks.filter(t => t.isCompleted && !t.isSectionHeader).length;
            const totalTasks = allTasks.filter(t => !t.isSectionHeader).length;
            const incorrectTasks = totalTasks - correctTasks;

            return (
            <div className="flex items-center justify-center h-full w-full p-4 gap-4">
                {/* Device Frame Container - with toolbar below */}
                <div className="flex flex-col gap-0">
                    {/* Device Frame - Centered */}
                    <MapDeviceFrame device={teamEditDevice} orientation={teamEditOrientation}>
                    <div className="flex flex-col h-full bg-black">
                        {/* HUD Header */}
                        <div className="bg-orange-600 border-b border-orange-700 flex items-center justify-between px-2 py-1.5 shadow-lg flex-shrink-0 text-xs">
                            <div className="flex items-center justify-center gap-1.5 flex-1">
                                <button
                                    onClick={() => { setShowLanding(true); setActiveGameId(null); }}
                                    className="p-1 hover:bg-orange-700 rounded transition-colors text-white hover:scale-110 flex flex-col items-center gap-0.5"
                                    title="Back to Games"
                                >
                                    <Home className="w-3 h-3" />
                                    <span className="text-[6px] font-bold uppercase">Back</span>
                                </button>

                                <div className="text-orange-700 font-bold">|</div>

                                <div className="flex flex-col items-center flex-1">
                                    <span className="text-[6px] font-bold text-white/80 uppercase">Team</span>
                                    <span className="font-black text-white">{teamState.teamName || 'Team'}</span>
                                </div>

                                <div className="text-orange-700 font-bold">|</div>

                                <div className="text-center flex-1">
                                    <div className="text-base font-black text-white font-mono">--:--</div>
                                    <span className="text-[6px] font-bold text-white/70 uppercase">Time</span>
                                </div>

                                <div className="text-orange-700 font-bold">|</div>

                                <div className="flex items-center gap-1 flex-1">
                                    <div className="flex items-center gap-0.5 px-1 py-0.5 bg-green-600/40 rounded text-[6px]">
                                        <CheckCircle className="w-2 h-2 text-green-400" />
                                        <span className="font-bold text-green-300">{correctTasks}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 px-1 py-0.5 bg-red-600/40 rounded text-[6px]">
                                        <XCircle className="w-2 h-2 text-red-400" />
                                        <span className="font-bold text-red-300">{incorrectTasks}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-700/50 rounded">
                                        <Trophy className="w-2 h-2 text-yellow-300" />
                                        <span className="font-black text-white">{score}</span>
                                    </div>
                                </div>

                                <div className="text-orange-700 font-bold">|</div>

                                <div className="flex gap-0.5">
                                    <button
                                        onClick={() => { if (mapRef.current) mapRef.current.jumpTo(userLocation || { lat: 0, lng: 0 }); }}
                                        className="p-0.5 bg-orange-700 hover:bg-orange-800 rounded transition-colors text-white hover:scale-110"
                                        disabled={!userLocation}
                                    >
                                        <Compass className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                        onClick={() => { if (mapRef.current && activeGame?.points?.length) mapRef.current.fitBounds(activeGame.points); }}
                                        className="p-0.5 bg-orange-700 hover:bg-orange-800 rounded transition-colors text-white hover:scale-110"
                                    >
                                        <Maximize2 className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Game Map */}
                        <div className="flex-1 overflow-hidden relative">
                            <GameMap
                            ref={mapRef}
                            points={visiblePoints}
                            routes={activeGame?.routes || []}
                            dangerZones={activeGame?.dangerZones || []}
                            logicLinks={logicLinks}
                            measurePath={measurePath}
                            mode={mode}
                            mapStyle={localMapStyle || 'osm'}
                            onPointClick={(point) => {
                                setSelectedPointForTooltip(point.id);
                                setTimeout(() => setSelectedPointForTooltip(null), 3000);
                            }}
                            onAreaColorClick={handleAreaColorClick}
                            onZoneClick={(z) => {
                                setSelectedPointForTooltip(z.id);
                                setTimeout(() => setSelectedPointForTooltip(null), 3000);
                            }}
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
                                if (isMeasuring) {
                                    const point = activeGame.points.find(p => p.id === id);
                                    if (point && point.location) {
                                        const oldLocation = point.location;
                                        setMeasurePath(prev => prev.map(coord =>
                                            (coord.lat === oldLocation.lat && coord.lng === oldLocation.lng)
                                                ? { lat: loc.lat, lng: loc.lng }
                                                : coord
                                        ));
                                    }
                                }
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
                            showMapLayer={showMapLayer}
                            showZoneLayer={showZoneLayer}
                            showTaskLayer={showTaskLayer}
                            showLiveLayer={showLiveLayer}
                            />

                            {/* Playground Buttons */}
                            {activeGame?.playgrounds && activeGame.playgrounds.length > 0 && (() => {
                                const visiblePlaygrounds = activeGame.playgrounds.filter(p => p.buttonVisible);
                                return visiblePlaygrounds.length > 0 ? (
                                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex gap-2 pointer-events-auto">
                                        {visiblePlaygrounds.map(pg => (
                                            <button
                                                key={pg.id}
                                                onClick={() => setViewingPlaygroundId(pg.id)}
                                                style={{ width: pg.buttonSize ? Math.max(pg.buttonSize * 0.6, 50) : 50, height: pg.buttonSize ? Math.max(pg.buttonSize * 0.6, 50) : 50 }}
                                                className="rounded-2xl flex items-center justify-center transition-all border-2 group relative overflow-hidden"
                                            >
                                                {pg.iconUrl ? (
                                                    <img src={pg.iconUrl} alt={pg.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold border-white/30">
                                                        {pg.title?.charAt(0) || 'P'}
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ) : null;
                            })()}

                            {/* Tooltip */}
                            {selectedPointForTooltip && (() => {
                                const dangerZone = activeGame?.dangerZones?.find(dz => dz.id === selectedPointForTooltip);
                                const point = activeGame?.points?.find(p => p.id === selectedPointForTooltip);
                                const tooltipContent = dangerZone
                                    ? `⚠️ ZONE\n${dangerZone.name || 'Area'}`
                                    : point
                                    ? `📍 ${point.title || 'Task'}`
                                    : null;
                                return tooltipContent ? (
                                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[51] bg-slate-900 border border-orange-500 rounded shadow-lg p-2 animate-in fade-in duration-200 pointer-events-auto max-w-xs text-xs">
                                        <p className="font-bold text-white whitespace-pre-wrap">{tooltipContent}</p>
                                    </div>
                                ) : null;
                            })()}
                        </div>

                        {/* Bottom Toolbar */}
                        <div className="bg-orange-600 border-t border-orange-700 flex items-center justify-center gap-2 px-2 py-1.5 shadow-lg flex-shrink-0 text-xs">
                            <button
                                onClick={() => setShowTeamLobby(true)}
                                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 bg-orange-700 hover:bg-orange-800 rounded font-bold text-white transition-colors"
                                title="Team Lobby"
                            >
                                <Users className="w-3 h-3" />
                                <span className="text-[6px] font-bold uppercase">Lobby</span>
                            </button>

                            <div className="text-orange-700 font-bold">|</div>

                            <button
                                onClick={() => setShowChatDrawer(!showChatDrawer)}
                                className={`relative flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded font-bold text-white transition-colors ${
                                    unreadMessageCount > 0 ? 'animate-chat-flash' : 'bg-orange-700 hover:bg-orange-800'
                                }`}
                            >
                                <MessageSquare className="w-3 h-3" />
                                <span className="text-[6px] font-bold uppercase">Chat</span>
                                {unreadMessageCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-red-600 font-black text-[6px] rounded-full w-3.5 h-3.5 flex items-center justify-center shadow-lg">
                                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                                    </span>
                                )}
                            </button>

                            <div className="text-orange-700 font-bold">|</div>

                            <button
                                onClick={() => setShowTeamViewQRScanner(true)}
                                className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 bg-orange-700 hover:bg-orange-800 rounded font-bold text-white transition-colors"
                                title="Scan QR"
                            >
                                <QrCode className="w-3 h-3" />
                                <span className="text-[6px] font-bold uppercase">QR</span>
                            </button>
                        </div>
                    </div>
                    </MapDeviceFrame>

                    {/* Device Preview Toolbar - below frame */}
                    <DevicePreviewToolbar
                        selectedDevice={teamEditDevice}
                        selectedOrientation={teamEditOrientation}
                        isOrientationLocked={teamEditOrientationLocked}
                        onDeviceChange={setTeamEditDevice}
                        onOrientationChange={setTeamEditOrientation}
                        onOrientationLockToggle={setTeamEditOrientationLocked}
                    />
                </div>
            </div>
            );
        })()}

        {/* DANGER ZONE WARNING MODAL - PLAY MODE */}
        {mode === GameMode.PLAY && (
            <DangerZoneWarningModal
                isVisible={dangerZoneState.currentZone !== null}
                zone={dangerZoneState.currentZone}
                currentScore={score}
                scoreDeductedPerSecond={dangerZoneState.scoreDeductedPerSecond}
                totalDeducted={dangerZoneState.totalDeducted}
                elapsedSeconds={dangerZoneState.elapsedSeconds}
                onClose={() => {}} // Modal cannot be closed by player
            />
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



        {/* GameHUD - Only show in non-PLAY modes */}
        {mode !== GameMode.PLAY && (
        <GameHUD
            accuracy={gpsAccuracy}
            mode={mode}
            toggleMode={() => {}}
            onSetMode={setMode}
            onOpenGameManager={() => setShowGameChooser(true)}
            onOpenTaskMaster={() => setShowTaskMaster(true)}
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
            onOpenPlayground={(id) => {
                // When opening a playzone, maintain current mode context
                // This ensures instructors see gameplay view, not editor
                setViewingPlaygroundId(id);
                // Note: mode is already set by the calling context (EDIT, INSTRUCTOR, or PLAY)
                // No need to change it here - App.tsx will render the correct component based on mode
            }}
            hoveredPlaygroundId={hoveredPlaygroundId}
            onHoverPlayground={setHoveredPlaygroundId}
            onOpenTeamDashboard={() => setShowTeamDashboard(true)}
            onOpenTeamLobby={handleTeamLobbyClick}
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
            // Use INSTRUCTOR-specific settings in INSTRUCTOR mode, global settings otherwise
            showScores={mode === GameMode.INSTRUCTOR ? instructorShowScores : showScores}
            onToggleScores={() => mode === GameMode.INSTRUCTOR ? setInstructorShowScores(!instructorShowScores) : setShowScores(!showScores)}
            showTaskId={mode === GameMode.INSTRUCTOR ? instructorShowTaskId : showTaskId}
            onToggleTaskId={() => mode === GameMode.INSTRUCTOR ? setInstructorShowTaskId(!instructorShowTaskId) : setShowTaskId(!showTaskId)}
            showTaskTitle={mode === GameMode.INSTRUCTOR ? instructorShowTaskTitle : showTaskTitle}
            onToggleTaskTitle={() => mode === GameMode.INSTRUCTOR ? setInstructorShowTaskTitle(!instructorShowTaskTitle) : setShowTaskTitle(!showTaskTitle)}
            showTaskActions={mode === GameMode.INSTRUCTOR ? instructorShowTaskActions : showTaskActions}
            onToggleTaskActions={() => mode === GameMode.INSTRUCTOR ? setInstructorShowTaskActions(!instructorShowTaskActions) : setShowTaskActions(!showTaskActions)}
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
            onExecuteSnap={handleExecuteSnap}
            selectedSnapTaskCount={selectedSnapTaskIds.length}
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
            userAccessMode={userAccessMode}
            onShowRanking={() => setShowRankingModal(true)}
            onOpenTeams={() => setShowTeamsHub(true)}
            teamEditDevice={teamEditDevice}
            onTeamEditDeviceChange={setTeamEditDevice}
            teamEditOrientation={teamEditOrientation}
            onTeamEditOrientationChange={setTeamEditOrientation}
            teamEditOrientationLocked={teamEditOrientationLocked}
            onTeamEditOrientationLockToggle={setTeamEditOrientationLocked}
        />
        )}

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
                version={APP_VERSION}
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
                onEditPoint={(p) => {
                    setActiveTask(p);
                    if (mode === GameMode.EDIT) {
                        setTaskEditorOpen(true);
                    }
                }}
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
                teamEditDevice={teamEditDevice}
                onTeamEditDeviceChange={setTeamEditDevice}
                teamEditOrientation={teamEditOrientation}
                onTeamEditOrientationChange={setTeamEditOrientation}
                teamEditOrientationLocked={teamEditOrientationLocked}
                onTeamEditOrientationLockToggle={setTeamEditOrientationLocked}
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
                                setShowPlaygroundManager(true);
                            }}
                            className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
                        >
                            <Library className="w-5 h-5" />
                            ADD FROM GLOBAL PLAYZONES
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
                    const timestamp = Date.now();
                    const newPlaygrounds: any[] = [];
                    const newTasks: GamePoint[] = [];

                    templates.forEach((tpl, index) => {
                        // Generate unique playground ID
                        const newPlaygroundId = `pg-${timestamp}-${index}`;

                        // Create the playground with settings
                        newPlaygrounds.push({
                            id: newPlaygroundId,
                            ...tpl.playgroundData,
                            title: tpl.title,
                            buttonVisible: true
                        });

                        // ============================================================
                        // CRITICAL FIX: TWO-PASS ID REMAPPING FOR TASK ACTIONS
                        // ============================================================
                        // PROBLEM: Task logic (onOpen/onCorrect/onIncorrect) still references OLD template IDs
                        // SOLUTION:
                        // 1. First pass: Create tasks with new IDs and build an ID mapping table
                        // 2. Second pass: Update all targetId references in task logic using the map

                        if (tpl.tasks && tpl.tasks.length > 0) {
                            console.log(`[App.tsx] 📋 PASS 1: Creating tasks for "${tpl.title}" with new IDs...`);

                            // DEBUG: Check first 3 tasks in template for devicePositions
                            console.log(`[App.tsx] 🔍 TEMPLATE DATA CHECK for "${tpl.title}":`, {
                                templateId: tpl.id,
                                totalTasks: tpl.tasks.length,
                                firstTaskDevicePositions: tpl.tasks[0]?.devicePositions,
                                firstTaskPlaygroundPosition: tpl.tasks[0]?.playgroundPosition,
                                firstTaskTitle: tpl.tasks[0]?.title,
                                firstTaskHasDevicePositions: !!tpl.tasks[0]?.devicePositions,
                                firstTaskDevicePositionsJSON: JSON.stringify(tpl.tasks[0]?.devicePositions || null),
                                task0_id: tpl.tasks[0]?.id,
                                task1_id: tpl.tasks[1]?.id,
                                task2_id: tpl.tasks[2]?.id
                            });

                            // PASS 1: Create tasks with new IDs (but keep old targetId references for now)
                            const tasksWithOldReferences = tpl.tasks.map((task, taskIndex) => {
                                // Deep clone to preserve nested objects (logic.onOpen, logic.onCorrect, etc.)
                                const deepClone = JSON.parse(JSON.stringify(task));

                                const clonedTask = {
                                    ...deepClone,
                                    id: `p-${timestamp}-${index}-${taskIndex}`, // Generate new unique ID
                                    playgroundId: newPlaygroundId, // Assign to the new playground
                                    isUnlocked: task.isUnlocked ?? true, // Preserve unlock state
                                    isCompleted: false, // Reset completion status for new game
                                    order: (activeGame.points?.length || 0) + newTasks.length + taskIndex // Maintain order
                                };

                                // DEBUG: Log first 3 cloned tasks to verify devicePositions preservation
                                if (taskIndex < 3) {
                                    console.log(`[App.tsx] 🔍 CLONED TASK #${taskIndex}: "${task.title}"`, {
                                        originalId: task.id,
                                        newId: clonedTask.id,
                                        originalDevicePositions: task.devicePositions,
                                        clonedDevicePositions: clonedTask.devicePositions,
                                        devicePositionsPreserved: JSON.stringify(task.devicePositions) === JSON.stringify(clonedTask.devicePositions),
                                        originalPlaygroundPosition: task.playgroundPosition,
                                        clonedPlaygroundPosition: clonedTask.playgroundPosition
                                    });
                                }

                                return clonedTask;
                            });

                            // Create ID mapping table: oldTemplateId -> newGameId
                            console.log(`[App.tsx] 🗺️ Creating ID mapping table for "${tpl.title}"...`);
                            const idMap = createTaskIdMap(tpl.tasks, tasksWithOldReferences);

                            // PASS 2: Remap all targetId references in task logic
                            console.log(`[App.tsx] 🔄 PASS 2: Remapping targetId references for "${tpl.title}"...`);
                            const remappedTasks = remapTaskLogicTargets(tasksWithOldReferences, idMap);

                            // VALIDATION: Verify all references are valid
                            console.log(`[App.tsx] ✅ VALIDATION: Checking task references for "${tpl.title}"...`);
                            const validation = validateTaskReferences(remappedTasks);

                            if (!validation.valid) {
                                console.error(`[App.tsx] ❌ VALIDATION FAILED for "${tpl.title}":`, validation.errors);
                            } else {
                                console.log(`[App.tsx] ✅ ALL TASK REFERENCES ARE VALID for "${tpl.title}"!`);
                            }

                            newTasks.push(...remappedTasks);
                        }
                    });

                    // Update game with both playgrounds AND tasks
                    await updateActiveGame({
                        ...activeGame,
                        playgrounds: [...(activeGame.playgrounds || []), ...newPlaygrounds],
                        points: [...(activeGame.points || []), ...newTasks]
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

        {/* Fullscreen Overlay - appears on all screens on mobile/tablet */}
        {renderFullscreenOverlay()}

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

        {/* Media Rejection Popup for Team Players */}
        {rejectedSubmission && (
            <MediaRejectionPopup
                taskTitle={rejectedSubmission.taskTitle}
                reviewerName={rejectedSubmission.reviewerName}
                message={rejectedSubmission.message}
                allowMultipleSubmissions={rejectedSubmission.allowMultipleSubmissions}
                onClose={() => setRejectedSubmission(null)}
            />
        )}

        {/* Ranking Modal - INSTRUCTOR mode */}
        {showRankingModal && activeGame && (
            <RankingModal
                isOpen={showRankingModal}
                onClose={() => setShowRankingModal(false)}
                teams={teamsForFogOfWar}
            />
        )}

        {/* Instructor Notifications - EDIT and INSTRUCTOR modes */}
        {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && instructorNotifications.length > 0 && (
            <InstructorNotificationPopup
                notifications={instructorNotifications}
                onDismiss={dismissNotification}
                onDismissAll={dismissAllNotifications}
            />
        )}
    </div>
  );

  // Return main content, wrapping in tablet frame if in simulation mode
  return isSimulationMode ? (
    <TabletFrame onClose={() => setIsSimulationMode(false)}>
      {mainContent}
    </TabletFrame>
  ) : (
    mainContent
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary componentName="TeamAction App">
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
