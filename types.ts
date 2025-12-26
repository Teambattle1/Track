
export interface Coordinate {
  lat: number;
  lng: number;
}

export type IconId = 'default' | 'star' | 'flag' | 'trophy' | 'camera' | 'question' | 'skull' | 'treasure';

export type TaskType = 'text' | 'multiple_choice' | 'checkbox' | 'boolean' | 'slider' | 'dropdown' | 'multi_select_dropdown';

export type MapStyleId = 'osm' | 'satellite' | 'dark' | 'light' | 'ancient' | 'clean' | 'voyager' | 'winter';

export type Language = 'English' | 'Danish' | 'German' | 'Spanish';

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

export type PointActivationType = 'radius' | 'nfc' | 'qr' | 'click';

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
  showLabels?: boolean; // New: Toggle label visibility
}

export interface DangerZone {
  id: string;
  location: Coordinate;
  radius: number;
  penalty: number; 
  duration: number; 
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
  location: Coordinate;
  radiusMeters: number;
  activationTypes: PointActivationType[];
  manualUnlockCode?: string; 
  
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
// ------------------------

export interface Game {
  id: string;
  name: string;
  description: string;
  language?: Language; // New: Game specific language
  points: GamePoint[];
  playgrounds?: Playground[]; 
  dangerZones?: DangerZone[]; 
  createdAt: number;
  defaultMapStyle?: MapStyleId;
  showOtherTeams?: boolean; // New: Toggle to show teams to other teams
  showTaskDetailsToPlayers?: boolean; // New: Toggle detailed task list in lobby
  showRankingToPlayers?: boolean; // New: Toggle Leaderboard visibility
  
  // New Metadata
  client?: ClientInfo;
  timerConfig?: TimerConfig;
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
  INSTRUCTOR = 'INSTRUCTOR'
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
