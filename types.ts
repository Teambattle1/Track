export interface Coordinate {
  lat: number;
  lng: number;
}

export type IconId = 'default' | 'star' | 'flag' | 'trophy' | 'camera' | 'question' | 'skull' | 'treasure' | 'music' | 'nature' | 'world';

export type TaskType = 'text' | 'multiple_choice' | 'checkbox' | 'boolean' | 'slider' | 'dropdown' | 'multi_select_dropdown' | 'timeline';

export type MapStyleId = 'osm' | 'satellite' | 'dark' | 'ancient' | 'clean' | 'winter' | 'ski' | 'norwegian' | 'historic' | 'google_custom' | 'none';

export type Language = 'English' | 'Danish' | 'German' | 'Spanish' | 'French' | 'Swedish' | 'Norwegian' | 'Dutch' | 'Belgian' | 'Hebrew';

// --- Auth Types ---
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Instructor' | 'Editor';
}

// --- Team Sync Types ---
export interface TeamMember {
  deviceId: string;
  userName: string;
  lastSeen: number;
  location?: Coordinate;
  photoUrl?: string;
  role?: 'captain' | 'member';
  isSolving?: boolean; // New: Tracks if user is currently in a task modal
  isRetired?: boolean; // New: Tracks if captain has retired this member (votes don't count)
}

export interface Team {
  id: string;
  gameId: string;
  name: string;
  joinCode?: string;
  photoUrl?: string; 
  members: TeamMemberData[]; 
  score: number;
  completedPointIds?: string[];
  updatedAt: string;
  captainDeviceId?: string; 
  isStarted?: boolean; 
  startedAt?: number; 
}

export interface TeamMemberData {
    name: string;
    photo?: string;
    deviceId: string;
}

export interface TaskVote {
  deviceId: string;
  userName: string;
  pointId: string;
  answer: string | number | string[];
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  gameId: string;
  targetTeamId?: string | null;
  message: string;
  sender: string;
  timestamp: number;
  isUrgent?: boolean; 
}

export interface TeamSyncState {
  members: TeamMember[];
  votes: Record<string, TaskVote[]>;
}
// -----------------------

export interface TimelineItem {
  id: string;
  text: string;        // The main title (e.g. "Minced Beef")
  description: string; // The reveal text (e.g. "Prices rose 20%...")
  value: number;       // The sort value (e.g. 20)
  imageUrl?: string;
  order?: number;
}

export interface GameTask {
  question: string;
  type: TaskType;
  
  // Media
  imageUrl?: string; 
  videoUrl?: string;
  audioUrl?: string;
  backgroundAudioUrl?: string;
  
  // Answers
  answer?: string; 
  correctAnswers?: string[];
  options?: string[];
  placeholder?: string;

  // Slider
  range?: {
    min: number;
    max: number;
    step: number;
    correctValue: number;
    tolerance?: number; 
  };

  // Timeline
  timelineItems?: TimelineItem[];
}

export interface TaskFeedback {
  correctMessage: string;
  showCorrectMessage: boolean;
  incorrectMessage: string;
  showIncorrectMessage: boolean;
  hint: string;
  hintCost: number;
}

export interface TaskSettings {
  timeLimitSeconds?: number;
  scoreDependsOnSpeed: boolean;
  language: string;
  showAnswerStatus: boolean;
  showCorrectAnswerOnMiss: boolean;
}

export type PointActivationType = 'radius' | 'nfc' | 'qr' | 'click' | 'ibeacon';

export type PointCompletionLogic = 
  | 'remove_any'
  | 'keep_until_correct'
  | 'keep_always'
  | 'allow_close';

// --- LOGIC SYSTEM ---
export type ActionType = 'unlock' | 'lock' | 'score' | 'message' | 'sound' | 'reveal' | 'double_trouble' | 'open_playground';

export interface GameAction {
  id: string;
  type: ActionType;
  targetId?: string;
  value?: string | number;
}

export interface TaskLogic {
  onOpen?: GameAction[];
  onCorrect?: GameAction[];
  onIncorrect?: GameAction[];
}
// --------------------

export interface Playground {
  id: string;
  title: string;
  imageUrl?: string;
  backgroundStyle?: 'cover' | 'contain' | 'stretch'; 
  buttonVisible: boolean; 
  buttonLabel?: string;
  iconId?: IconId;
  iconUrl?: string; 
  buttonSize?: number; 
  orientationLock?: 'portrait' | 'landscape' | 'none'; 
  location?: Coordinate; 
  showLabels?: boolean; 
  // Audio Support
  audioUrl?: string;
  audioLoop?: boolean; // true = continuous, false = once
}

export interface DangerZone {
  id: string;
  location: Coordinate;
  radius: number;
  penalty: number; 
  duration: number; // Escape time (seconds)
  title?: string;
  penaltyType?: 'fixed' | 'time_based'; // Fixed = Escape timer, Time Based = Per second
}

// NEW: Routes for Map Overlays (GPX)
export interface GameRoute {
  id: string;
  name: string;
  color: string;
  points: Coordinate[];
  isVisible: boolean;
}

// Template for saving to library
export interface PlaygroundTemplate {
  id: string;
  title: string;
  playgroundData: Playground; 
  tasks: GamePoint[]; 
  createdAt: number;
  isGlobal: boolean;
}

export interface GamePoint {
  id: string;
  title: string;
  shortIntro?: string;

  task: GameTask;

  // Location & Activation
  location: Coordinate | null; // null for playground-only points without map location
  radiusMeters: number;
  activationTypes: PointActivationType[];
  manualUnlockCode?: string;
  isLocationLocked?: boolean; // If true, task can only be completed at this specific location
  qrCodeString?: string; // QR code string value (e.g., house ID, location code)
  qrCodeUsageCount?: number; // Track how many times this QR code is used (prevent duplicates)
  nfcTagId?: string; // NFC tag identifier for NFC-based activation
  nfcTagData?: string; // Additional NFC tag data (task info, location, etc.)
  ibeaconUUID?: string; // iBeacon UUID for beacon-based activation
  ibeaconMajor?: number; // iBeacon major ID
  ibeaconMinor?: number; // iBeacon minor ID
  ibeaconProximity?: 'immediate' | 'near' | 'far'; // Required proximity to trigger task 
  
  // Playground Specific
  playgroundId?: string; 
  playgroundPosition?: { x: number; y: number }; 
  playgroundScale?: number; 
  isHiddenBeforeScan?: boolean; 

  // Appearance
  iconId: IconId;
  iconUrl?: string; 
  areaColor?: string; 

  // Logic & Scoring
  points: number;
  isUnlocked: boolean;
  isCompleted: boolean;
  order: number;
  tags?: string[];
  
  // Advanced Config
  feedback?: TaskFeedback;
  settings?: TaskSettings;
  completionLogic?: PointCompletionLogic;
  instructorNotes?: string;
  showStatusMarkers?: boolean; // Show OK/Wrong answer markers (✓/✗) when task is completed
  
  // Event Logic
  logic?: TaskLogic;
  
  // Structural
  isSectionHeader?: boolean;
}

export interface TaskTemplate {
  id: string;
  title: string;
  task: GameTask;
  tags: string[];
  iconId: IconId;
  createdAt: number;
  points?: number;
  intro?: string;
  feedback?: TaskFeedback;
  settings?: TaskSettings;
  logic?: TaskLogic;

  // Activation Types (for template defaults)
  activationTypes?: PointActivationType[];
  qrCodeString?: string;
  nfcTagId?: string;
  ibeaconUUID?: string;

  // Client Submission Fields
  submissionStatus?: 'pending' | 'approved' | 'rejected';
  submitterName?: string;
  isNew?: boolean;
}

export interface TaskList {
  id: string;
  name: string;
  description: string;
  tasks: TaskTemplate[];
  color: string; 
  iconId?: IconId;
  imageUrl?: string; 
  usageCount?: number; 
  createdAt: number;
  
  // Client Task List Fields
  isClientList?: boolean;
  shareToken?: string;
}

// --- NEW CONFIG TYPES ---
export interface ClientInfo {
  name: string;
  logoUrl?: string;
  playingDate?: string; 
}

export type TimerMode = 'none' | 'countdown' | 'countup' | 'scheduled_end';

export interface TimerConfig {
  mode: TimerMode;
  durationMinutes?: number; 
  endTime?: string; 
  title?: string; 
}

export interface DesignConfig {
  taskBackgroundImage?: string;
  primaryColor?: string; // Hex, undefined if using default
  secondaryColor?: string; // Hex, undefined if using default
  enableCodeScanner?: boolean;
  enableGameTime?: boolean;
  hideScore?: boolean;
  showScoreAfter?: string; // HH:mm:ss
  hideScoreAfter?: string; // HH:mm:ss
}

export interface GameTaskConfiguration {
  timeLimitMode: 'none' | 'global' | 'task_specific';
  globalTimeLimit?: number; // seconds
  penaltyMode: 'zero' | 'negative';
  showCorrectAnswerMode: 'never' | 'always' | 'task_specific';
  limitHints: boolean;
  hintLimit?: number;
  showAnswerCorrectnessMode: 'never' | 'always' | 'task_specific';
  showAfterAnswerComment: boolean;
  teamVotingMode: 'require_consensus' | 'captain_submit'; // New: How team voting works
}

export interface MapConfiguration {
  pinDisplayMode: 'order' | 'score' | 'none';
  showShortIntroUnderPin: boolean;
  mapInteraction: 'disable_click' | 'allow_all' | 'allow_specific';
  hideMyLocation: boolean;
  showMyTrack: boolean;
  allowNavigation: boolean;
  allowWeakGps: boolean;
}

export interface GameChangeLogEntry {
    timestamp: number;
    user: string;
    action: string;
}

export interface ToolbarPosition {
  x: number;
  y: number;
}

export interface ToolbarPositions {
  locationToolboxPos?: ToolbarPosition;
  topToolbarPos?: ToolbarPosition;
  viewSwitcherPos?: ToolbarPosition;
  pinsToolboxPos?: ToolbarPosition;
  showToolboxPos?: ToolbarPosition;
  editorOrientationPos?: ToolbarPosition;
  editorShowPos?: ToolbarPosition;
}

// ------------------------

export interface Game {
  id: string;
  name: string;
  description: string; // Used as Intro Message
  finishMessage?: string; // New: Finish Message
  tags?: string[]; // New: Game Tags
  language?: Language;
  points: GamePoint[];
  playgrounds?: Playground[]; 
  dangerZones?: DangerZone[]; 
  routes?: GameRoute[]; 
  createdAt: number;
  defaultMapStyle?: MapStyleId;
  googleMapStyleJson?: string; // New: Custom Google Maps Style
  toolbarPositions?: ToolbarPositions; // Per-game toolbar positions

  // Game Mode Configuration
  gameMode?: 'standard' | 'playzone' | 'elimination'; // 'standard' = GPS-based, 'playzone' = playground-only indoor, 'elimination' = GPS-based CTF

  // Elimination Mode Specific Fields
  teamColors?: Record<string, string>; // Team ID -> Hex color code mapping (e.g., '#FF0000' for red)
  capturedTasks?: Record<string, string>; // Task ID -> Team ID who captured it
  failedAttempts?: Array<{
    taskId: string;
    teamId: string;
    timestamp: number;
    cooldownUntil: number; // Unix timestamp when cooldown expires (timestamp + 2 minutes)
  }>;
  bombs?: Array<{
    id: string;
    teamId: string;
    location: Coordinate;
    duration: 30 | 60 | 120; // Duration in seconds
    createdAt: number;
    detonatesAt: number; // createdAt + duration
  }>;
  teamCaptureCount?: Record<string, number>; // Team ID -> Number of captured tasks

  // Team & Permission Settings
  showOtherTeams?: boolean;
  showTaskDetailsToPlayers?: boolean; 
  showRankingToPlayers?: boolean; 
  allowChatting?: boolean;
  showPlayerLocations?: boolean;
  
  // New Metadata
  client?: ClientInfo;
  timerConfig?: TimerConfig;
  designConfig?: DesignConfig;
  taskConfig?: GameTaskConfiguration; // New Task Configuration
  mapConfig?: MapConfiguration; // New Map Configuration
  
  // Game Lifecycle / End Game
  state?: 'active' | 'ending' | 'ended';
  endingAt?: number; // Timestamp when game will end (during countdown)
  endLocation?: Coordinate; // Fixed end position
  enableMeetingPoint?: boolean; // New Flag

  // New Template Fields
  isGameTemplate?: boolean;
  aboutTemplate?: string;
  instructorNotes?: string;
  templateImageUrls?: string[];

  // Audit Info
  createdBy?: string;
  lastModifiedBy?: string;
  changeLog?: GameChangeLogEntry[];

  // Client-side mirror of DB updated_at (used for multi-user syncing)
  dbUpdatedAt?: string;
}

export interface GameState {
  activeGameId: string | null;
  games: Game[]; 
  taskLibrary: TaskTemplate[]; 
  taskLists: TaskList[]; 
  score: number;
  userLocation: Coordinate | null;
  gpsAccuracy: number | null;
  teamName?: string;
  teamId?: string;
  userName?: string;
  deviceId: string;
}

export enum GameMode {
  PLAY = 'PLAY',
  EDIT = 'EDIT',
  INSTRUCTOR = 'INSTRUCTOR',
  SIMULATION = 'SIMULATION'
}

export type TeamStatus = 'moving' | 'solving' | 'idle';

// --- ACCOUNT USERS ---
export interface UsageLogEntry {
    gameName: string;
    date: string;
    action: string;
}

export interface AdminMessage {
    id: string;
    text: string;
    sender: string;
    timestamp: number;
    read: boolean;
}

export interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: string;
  updatedAt: string;
  updatedBy: string;
  // New fields
  lastSeen?: number; // Timestamp of last activity
  password?: string; // For display in admin UI (simulated)
  usageHistory?: UsageLogEntry[];
  messages?: AdminMessage[];
}
