
export interface Coordinate {
  lat: number;
  lng: number;
}

export type IconId = 'default' | 'star' | 'flag' | 'trophy' | 'camera' | 'question' | 'skull' | 'treasure';

export type TaskType = 'text' | 'multiple_choice' | 'checkbox' | 'boolean' | 'slider' | 'dropdown' | 'multi_select_dropdown';

export type MapStyleId = 'osm' | 'satellite' | 'dark' | 'light';

export type Language = 'English' | 'Danish' | 'German' | 'Spanish';

// --- Team Sync Types ---
export interface TeamMember {
  deviceId: string;
  userName: string;
  lastSeen: number;
  location?: Coordinate; 
}

export interface Team {
  id: string;
  gameId: string;
  name: string;
  joinCode?: string;
  photoUrl?: string;
  members: string[];
  score: number;
  completedPointIds?: string[];
  updatedAt: string;
  captainDeviceId?: string; // New: To identify the team captain
  isStarted?: boolean; // New: To track if mission has moved from lobby to active
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
export type ActionType = 'unlock' | 'lock' | 'score' | 'message' | 'sound' | 'reveal';

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
  
  // Appearance
  iconId: IconId;
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
}

export interface TaskList {
  id: string;
  name: string;
  description: string;
  tasks: TaskTemplate[];
  color: string; 
  iconId?: IconId;
  createdAt: number;
}

export interface Game {
  id: string;
  name: string;
  description: string;
  points: GamePoint[];
  createdAt: number;
  defaultMapStyle?: MapStyleId;
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
