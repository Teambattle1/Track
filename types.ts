
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
  userName: string; // Added user name
  lastSeen: number;
}

export interface Team {
  id: string;
  gameId: string;
  name: string;
  joinCode?: string; // 6-digit code
  photoUrl?: string; // Base64 or URL
  members: string[]; // List of names
  score: number;
  updatedAt: string;
}

export interface TaskVote {
  deviceId: string;
  userName: string; // Added user name
  pointId: string;
  answer: string | number | string[]; // The actual answer value
  timestamp: number;
}

export interface TeamSyncState {
  members: TeamMember[];
  votes: Record<string, TaskVote[]>; // Keyed by pointId
}
// -----------------------

export interface GameTask {
  question: string; // Now acts as HTML/RTF
  type: TaskType;
  
  // Media
  imageUrl?: string; 
  videoUrl?: string; // YouTube or Vimeo
  audioUrl?: string; // Task audio
  backgroundAudioUrl?: string; // Ambient audio
  
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
  correctMessage: string; // RTF
  showCorrectMessage: boolean;
  incorrectMessage: string; // RTF
  showIncorrectMessage: boolean;
  hint: string;
  hintCost: number;
}

export interface TaskSettings {
  timeLimitSeconds?: number;
  scoreDependsOnSpeed: boolean;
  language: string;
  showAnswerStatus: boolean; // Show if correct/incorrect
  showCorrectAnswerOnMiss: boolean; // Show correct answer after incorrect
}

export type PointActivationType = 'radius' | 'nfc' | 'qr' | 'click';

export type PointCompletionLogic = 
  | 'remove_any' // Remove when answered (correct or incorrect)
  | 'keep_until_correct' // Keep until answered correctly
  | 'keep_always' // Keep until end of game
  | 'allow_close'; // Allow close without answering

// --- LOGIC SYSTEM ---
export type ActionType = 'unlock' | 'lock' | 'score' | 'message' | 'sound' | 'reveal';

export interface GameAction {
  id: string;
  type: ActionType;
  targetId?: string; // ID of target point
  value?: string | number; // Payload (score amount, message text, sound URL)
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
  shortIntro?: string; // Hover text
  
  task: GameTask;
  
  // Location & Activation
  location: Coordinate;
  radiusMeters: number;
  activationTypes: PointActivationType[]; // ['radius', 'click', 'qr', etc.]
  manualUnlockCode?: string; 
  
  // Appearance
  iconId: IconId;
  areaColor?: string; // Custom geofence color

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
  isSectionHeader?: boolean; // If true, acts as a divider/group header in the list
}

export interface TaskTemplate {
  id: string;
  title: string;
  task: GameTask;
  tags: string[];
  iconId: IconId;
  createdAt: number;
  // Template copies of point config
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
  iconId?: IconId; // Added icon for lists
  createdAt: number;
}

export interface Game {
  id: string;
  name: string;
  description: string;
  points: GamePoint[];
  createdAt: number;
  defaultMapStyle?: MapStyleId; // Added map style preference
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
  userName?: string; // Added local user name
  deviceId: string; // Unique ID for this browser
}

export enum GameMode {
  PLAY = 'PLAY',
  EDIT = 'EDIT',
  INSTRUCTOR = 'INSTRUCTOR'
}
