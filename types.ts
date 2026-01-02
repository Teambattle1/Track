// Global version variable injected at build time by Vite
declare const __APP_VERSION__: string;

export interface Coordinate {
  lat: number;
  lng: number;
}

export type IconId = 'default' | 'star' | 'flag' | 'trophy' | 'camera' | 'question' | 'skull' | 'treasure' | 'music' | 'nature' | 'world';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export type TaskType = 'text' | 'multiple_choice' | 'checkbox' | 'boolean' | 'slider' | 'dropdown' | 'multi_select_dropdown' | 'timeline' | 'photo' | 'video';

export type MapStyleId = 'osm' | 'satellite' | 'dark' | 'clean' | 'winter' | 'ski' | 'historic' | 'treasure' | 'desert' | 'google_custom' | 'none';

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

  // Media Task Settings (for PHOTO/VIDEO tasks)
  mediaSettings?: {
    requireApproval: boolean; // true = manual approval, false = auto-approve
    allowMultipleSubmissions?: boolean; // Allow teams to submit multiple times
    maxFileSize?: number; // Max file size in MB (default: 10MB for photos, 50MB for videos)
    partialScoreEnabled?: boolean; // Allow partial scores (slider from 0-100%)
  };

  // Translations
  translations?: Record<Language, TaskTranslation>;
}

// Translation Entry for Multilingual Tasks
export interface TaskTranslation {
  question: string;
  questionApproved?: boolean; // AI-generated translations default to false
  options?: string[];
  optionsApproved?: boolean;
  answer?: string;
  answerApproved?: boolean;
  correctAnswers?: string[];
  correctAnswersApproved?: boolean;
  placeholder?: string;
  placeholderApproved?: boolean;
  timelineItems?: TimelineItem[];
  timelineItemsApproved?: boolean;
  feedback?: {
    correctMessage: string;
    correctMessageApproved?: boolean;
    incorrectMessage: string;
    incorrectMessageApproved?: boolean;
    hint: string;
    hintApproved?: boolean;
  };
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
  maxAttempts?: number; // Number of attempts allowed (default 1, 0 = unlimited)
  matchTolerance?: number; // Similarity threshold for text answers (0-100, default 80)
}

// Color Scheme for Task Visual Design
export interface TaskColorScheme {
  id?: string; // Optional ID for saving/loading schemes
  name?: string; // Optional name for the scheme
  backgroundColor: string; // Main task background
  headerColor: string; // Task header/title area
  questionColor: string; // Question text color
  optionBackgroundColor: string; // Answer option background
  optionTextColor: string; // Answer option text
  correctColor: string; // Correct answer highlight
  incorrectColor: string; // Incorrect answer highlight
  buttonColor: string; // Submit/action buttons
  buttonTextColor: string; // Button text
  borderColor: string; // Borders and dividers
}

export type PointActivationType = 'radius' | 'nfc' | 'qr' | 'click' | 'ibeacon';

export type PointCompletionLogic = 
  | 'remove_any'
  | 'keep_until_correct'
  | 'keep_always'
  | 'allow_close';

// --- LOGIC SYSTEM ---
export type ActionType = 'unlock' | 'lock' | 'score' | 'message' | 'sound' | 'reveal' | 'double_trouble' | 'open_playground' | 'cooldown';

export interface GameAction {
  id: string;
  type: ActionType;
  targetId?: string;
  value?: string | number;
  // Cooldown-specific settings
  cooldownSeconds?: number; // Duration in seconds for cooldown action
}

export interface TaskLogic {
  onOpen?: GameAction[];
  onCorrect?: GameAction[];
  onIncorrect?: GameAction[];
}
// --------------------

// Device-specific layout configuration for playgrounds
export interface DeviceLayout {
  orientationLock: 'portrait' | 'landscape' | 'none';
  qrScannerPos?: { x: number; y: number }; // SCAN QR button position
  qrScannerSize?: { width: number; height: number }; // SCAN QR button size
  qrScannerColor?: string; // SCAN QR button background color (hex)
  iconPositions?: Record<string, { x: number; y: number }>; // Per-icon positions by point ID
  buttonVisible?: boolean; // Device-specific button visibility
  buttonLabel?: string; // Device-specific label
  iconScale?: number; // Device-specific icon scale (1.0 = 100%)
}

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

  // Task visibility settings (SHOW IN GAME)
  showTaskScores?: boolean;
  showTaskOrder?: boolean;
  showTaskActions?: boolean;
  showTaskNames?: boolean;
  showTaskStatus?: boolean;
  showBackground?: boolean;
  showQRScanner?: boolean;

  // Device-specific layouts (for multi-device support)
  deviceLayouts?: Record<DeviceType, DeviceLayout>;
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

// Shrinking Zone (Battle Royale Mechanic)
export interface ShrinkingZone {
  id: string;
  currentCenter: Coordinate; // Current center of the safe zone
  currentRadius: number; // Current radius in meters
  targetCenter?: Coordinate; // Next center (for zone movement)
  targetRadius?: number; // Next radius (for shrinking)
  shrinkStartTime?: number; // When the shrink phase started
  shrinkDuration?: number; // How long the shrink takes (seconds)
  damagePerSecond: number; // Damage/penalty applied per second outside zone
  phases: ShrinkingZonePhase[]; // Predefined shrink phases
  currentPhase: number; // Index of current phase
}

export interface ShrinkingZonePhase {
  radius: number; // Target radius for this phase
  center?: Coordinate; // Optional new center
  shrinkDuration: number; // How long to shrink to this radius (seconds)
  waitDuration: number; // How long to wait before next phase (seconds)
  damagePerSecond: number; // Damage rate during this phase
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
  playgroundPosition?: { x: number; y: number }; // Legacy: shared across all devices
  devicePositions?: Record<DeviceType, { x: number; y: number }>; // NEW: device-specific positions
  playgroundScale?: number;
  textLabelScale?: number; // NEW: text label size scale (0.5 to 2.0, default 1.0)
  iconImageScale?: number; // Image size within the icon circle (0.5 to 2.0, default 0.9)
  isHiddenBeforeScan?: boolean; 

  // Appearance
  iconId: IconId;
  iconUrl?: string;
  completedIconId?: IconId; // Icon to show when task is completed
  completedIconUrl?: string; // Custom icon URL to show when task is completed
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

  // Task Visibility After Completion
  keepOnScreenOnCorrect?: boolean; // If true, task stays visible (grayed) after correct answer
  keepOnScreenOnIncorrect?: boolean; // If true, task stays visible (grayed) after incorrect answer
  showBadgeOnGrayedTask?: boolean; // If true, show ✓/✗ badge on grayed-out task icon

  // Visual Design
  colorScheme?: TaskColorScheme; // Local color scheme override (only for this task in this game)
  isColorSchemeLocked?: boolean; // If true, prevents color scheme changes when imported from library

  // Event Logic
  logic?: TaskLogic;
  
  // Proximity Triggers (Discovery Mechanic)
  proximityTriggerEnabled?: boolean; // If true, task is invisible until team gets close
  proximityRevealRadius?: number; // Distance in meters at which task becomes visible (default: 100m)
  proximityStaysVisible?: boolean; // If true, task stays visible after discovery (default: true)

  // Time-Bomb (Countdown Timer)
  timeBombEnabled?: boolean; // If true, task has a countdown timer
  timeBombDuration?: number; // Duration in seconds (e.g., 300 = 5 minutes)
  timeBombStartTrigger?: 'onUnlock' | 'onActivate' | 'manual'; // When the timer starts
  timeBombPenalty?: number; // Score penalty if timer expires (negative points)
  timeBombAutoFail?: boolean; // If true, task auto-fails on expiry; if false, just applies penalty
  timeBombStartedAt?: number; // Timestamp when timer started (per team, stored in team data)

  // Multi-Team Collaboration
  multiTeamEnabled?: boolean; // If true, requires multiple teams in proximity
  multiTeamRequiredCount?: number; // Number of teams required (e.g., 2, 3, 4)
  multiTeamRadius?: number; // Distance in meters within which all teams must be (default: 50m)
  multiTeamCompletionMode?: 'all' | 'first'; // 'all' = all teams complete together, 'first' = first team to satisfy triggers
  multiTeamActiveTeams?: string[]; // Team IDs currently in proximity (tracked in real-time)

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

  // Visual Design (global library)
  colorScheme?: TaskColorScheme; // Color scheme for this template
  isColorSchemeLocked?: boolean; // If true, prevents overriding when used in games

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

// Media Submission (Photo/Video) for Live Approval
export interface MediaSubmission {
  id: string;
  gameId: string;
  teamId: string;
  teamName: string;
  pointId: string; // Which task this submission is for
  pointTitle: string;
  mediaUrl: string; // URL of the uploaded photo/video
  mediaType: 'photo' | 'video';
  submittedAt: number; // Timestamp
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string; // Name of GM/Instructor who reviewed
  reviewedAt?: number; // Timestamp of review
  reviewComment?: string; // Optional comment from GM
  partialScore?: number; // Partial score (0-100) if enabled, undefined = full score
  downloadedByClient?: boolean; // Track if client has downloaded this media
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

// Sound Configuration
export interface SoundSettings {
  correctAnswerSound?: string; // URL to sound file
  incorrectAnswerSound?: string; // URL to sound file
  volume?: number; // 0-100, default 80
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
  editorToolsPos?: ToolbarPosition;
  editorQRScannerPos?: ToolbarPosition;

  // Device-specific editor toolbar positions
  editorOrientationPosPerDevice?: Record<DeviceType, ToolbarPosition>;
  editorShowPosPerDevice?: Record<DeviceType, ToolbarPosition>;
  editorToolsPosPerDevice?: Record<DeviceType, ToolbarPosition>;
  editorQRScannerPosPerDevice?: Record<DeviceType, ToolbarPosition>;
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
  drawerStates?: {
    settingsCollapsedSections?: Record<string, boolean>; // Settings drawer collapsed sections (mapmode, layers, location, pins, show, tools)
    visibleToolbars?: Record<string, boolean>; // Visible toolbars on map (mapmode, layers, location, pins, show, tools)
  };

  // Game Access
  accessCode?: string; // Uppercase alphanumeric code for game access (case-insensitive)

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
  defaultTaskColorScheme?: TaskColorScheme; // Default color scheme for all tasks in this game
  soundSettings?: SoundSettings; // Game-specific sound overrides (uses global sounds if not set)

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
