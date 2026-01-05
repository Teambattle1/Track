import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Gamepad2, Library, LayoutList, Shield, Edit2,
  UserCircle, Settings, Play,
  LayoutDashboard, LayoutGrid, UserPlus,
  Plus, Database, ArrowLeft,
  Globe, ChevronDown, QrCode, MessageSquare, Anchor, Home, Trash2, Smartphone, FilePlus, Check, ChevronRight, LogOut, BarChart3, Bomb, MapPin, Gauge, Map, KeyRound, Search, X as XIcon, ExternalLink, Volume2
} from 'lucide-react';
import { Game, AuthUser } from '../types';
import { getGameDisplayId, matchesGameSearch, formatGameNameWithId } from '../utils/gameIdUtils';
import { hasNewSupabaseSetup } from './SupabaseToolsModal';
import ActivityNotificationModal from './ActivityNotificationModal';
import SupabaseScriptsModal from './SupabaseScriptsModal';
import { getActivitySinceLastLogin, getLastLogin, updateLastLogin, ActivitySummary, getPendingMediaCount } from '../services/activityTracker';
import './InitialLandingStyles.css';

interface InitialLandingProps {
  onAction: (action: 'USERS' | 'TEAMS' | 'GAMES' | 'CREATE_GAME' | 'CREATE_MAP_GAME' | 'CREATE_PLAYZONE_GAME' | 'CREATE_ELIMINATION_GAME' | 'TASKS' | 'TASKLIST' | 'TEAMZONE' | 'EDIT_GAME' | 'PLAY' | 'TEMPLATES' | 'PLAYGROUNDS' | 'DASHBOARD' | 'TAGS' | 'ADMIN' | 'CLIENT_PORTAL' | 'QR_CODES' | 'CHAT' | 'TEAM_LOBBY' | 'DATABASE' | 'DELETE_GAMES' | 'TEAMS_MAP_VIEW' | 'PREVIEW_TEAM' | 'PREVIEW_INSTRUCTOR' | 'MANAGE_TEAMS' | 'GAMESTATS' | 'MAP_STYLES' | 'DIAGNOSTICS' | 'ACCESS' | 'MEDIA' | 'SYSTEM_SOUNDS') => void;
  version: string;
  games: Game[];
  activeGameId: string | null;
  onSelectGame: (id: string) => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
}

type CategoryView = 'HOME' | 'SETTINGS' | 'CREATE' | 'CREATE_GAME_SUBMENU' | 'EDIT_MENU' | 'PLAY_MENU' | 'PLAY_TEAMS_MENU' | 'GAMES' | 'TEAMS' | 'TASKS' | 'ADMIN' | 'PREVIEW_SELECT';

const NavCard = ({
  title,
  subtitle,
  icon: Icon,
  color,
  onClick,
  badge
}: {
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  onClick: () => void;
  badge?: string;
}) => (
  <button
    onClick={onClick}
    className="group relative bg-slate-900/80 border border-slate-800 rounded-[1.5rem] p-5 text-left transition-all hover:scale-[1.05] active:scale-95 hover:border-white/20 shadow-xl overflow-hidden flex flex-col h-full cursor-pointer hover:shadow-2xl backdrop-blur-sm"
  >
    {/* Adventure map background layers */}
    <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.08),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(249,115,22,0.10),transparent_55%),radial-gradient(circle_at_55%_95%,rgba(34,197,94,0.07),transparent_60%)]" />
    <div className="absolute inset-0 opacity-15 pointer-events-none bg-[linear-gradient(transparent_0,transparent_22px,rgba(255,255,255,0.05)_22px,rgba(255,255,255,0.05)_23px,transparent_23px)] bg-[length:100%_46px]" />

    {/* Soft color glow */}
    <div className={`absolute -top-6 -right-6 w-28 h-28 rounded-full blur-3xl opacity-[0.08] transition-opacity group-hover:opacity-[0.16] ${color}`} />

    {/* Route line */}
    <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" viewBox="0 0 200 140" preserveAspectRatio="none">
      <path
        d="M-10 95 C 35 65, 55 125, 100 95 C 145 65, 165 110, 220 70"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-white/10"
      />
      <path
        d="M-10 95 C 35 65, 55 125, 100 95 C 145 65, 165 110, 220 70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        className="text-white/20"
        strokeDasharray="4 10"
      />
    </svg>

    {/* Pin drops (points) */}
    <div className="absolute inset-0 pointer-events-none">
      <MapPin className={`absolute top-3 right-3 w-5 h-5 rotate-12 opacity-25 ${color.replace('bg-', 'text-')}`} />
      <MapPin className="absolute bottom-4 right-10 w-4 h-4 -rotate-12 opacity-20 text-emerald-400" />
      <MapPin className="absolute top-12 left-5 w-4 h-4 rotate-6 opacity-20 text-amber-400" />
    </div>

    <div className="relative z-10 flex flex-col h-full">
      <div className="flex items-start justify-between gap-4">
        <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:scale-110 group-hover:rotate-3 duration-300 ${color} bg-opacity-20 border border-current`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
          {badge && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse">
              {badge}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/70 shadow-[0_0_10px_rgba(34,211,238,0.35)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-orange-400/70 shadow-[0_0_10px_rgba(251,146,60,0.35)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70 shadow-[0_0_10px_rgba(52,211,153,0.35)]" />
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1 group-hover:text-orange-500 transition-colors">
          {title}
        </h3>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">
          {subtitle}
        </p>
      </div>

      <div className="mt-6 flex items-center gap-1 text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-white transition-colors group-hover:translate-x-1">
        ACCESS MODULE <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  </button>
);

const MapPinButton = ({
    title,
    icon: Icon,
    gradient,
    onClick,
    delay,
    scale = 1,
    badge
}: {
    title: string;
    icon: any;
    gradient: string;
    onClick: () => void;
    delay: number;
    scale?: number;
    badge?: string;
}) => {
    const scaleClass = scale === 0.85 ? 'landing-scale-085'
        : scale === 0.9 ? 'landing-scale-090'
        : scale === 0.95 ? 'landing-scale-095'
        : 'landing-scale-100';

    const delayClass = delay === 100 ? 'landing-pin-delay-100'
        : delay === 200 ? 'landing-pin-delay-200'
        : delay === 300 ? 'landing-pin-delay-300'
        : 'landing-pin-delay-0';

    return (
        <div
            className={`flex flex-col items-center gap-6 group cursor-pointer perspective-1000 pointer-events-auto ${scaleClass}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    onClick();
                }
            }}
        >
            <div className="relative">
                {/* Pin Shape */}
                <div
                    className={`
                        relative w-36 h-36 md:w-48 md:h-48
                        ${gradient}
                        rounded-full rounded-br-none
                        rotate-45
                        shadow-[0_10px_40px_rgba(0,0,0,0.5)]
                        border-4 border-white/20
                        flex items-center justify-center
                        transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
                        group-hover:-translate-y-6 group-hover:scale-110 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.6)] group-hover:border-white/40
                        animate-in zoom-in fade-in fill-mode-backwards
                        ${delayClass}
                    `}
                >
                    {/* Inner Content (Counter-rotated to stay upright) */}
                    <div className="-rotate-45 flex items-center justify-center">
                        <Icon className="w-12 h-12 md:w-20 md:h-20 text-white drop-shadow-md" strokeWidth={2} />
                    </div>

                    {/* Glass/Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent rounded-full rounded-br-none pointer-events-none" />

                    {/* Badge (if provided) */}
                    {badge && (
                        <div className="absolute -top-3 -right-3 bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg border border-amber-400">
                            {badge}
                        </div>
                    )}
                </div>

                {/* Pulse Ring (behind) */}
                <div className={`absolute inset-0 rounded-full rounded-br-none rotate-45 ${gradient} opacity-20 blur-xl group-hover:blur-2xl transition-all duration-500 -z-10`} />
            </div>

            {/* Shadow Spot */}
            <div className="w-24 h-6 bg-black/60 blur-xl rounded-[100%] transition-all duration-500 group-hover:w-16 group-hover:blur-md group-hover:opacity-40 group-hover:translate-y-2" />

            {/* Title Label */}
            <div className="text-center -mt-4 transform transition-all duration-300 group-hover:-translate-y-2">
                <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-[0.2em] drop-shadow-2xl whitespace-nowrap bg-black/30 backdrop-blur-sm px-4 py-1 rounded-full">{title}</h2>
                <div className="h-1 w-12 bg-current mx-auto mt-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
        </div>
    );
};

type GameStatusTab = 'TODAY' | 'PLANNED' | 'COMPLETED';

const getGameSessionDate = (game: Game): Date => {
  if (game.client?.playingDate) {
    const d = new Date(game.client.playingDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(game.createdAt || Date.now());
};

const isGameCompleted = (game: Game): boolean => {
  if (!game) return false;
  if (game.state === 'ended' || game.state === 'ending') return true;

  const points = game.points || [];
  const playablePoints = points.filter(p => !p.isSectionHeader);
  if (playablePoints.length === 0) return false;

  return playablePoints.every(p => !!p.isCompleted);
};

const getGameStatusTab = (game: Game, now: Date): GameStatusTab => {
  if (!game) return 'TODAY';
  if (isGameCompleted(game)) return 'COMPLETED';

  const date = getGameSessionDate(game);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (date.getTime() < startOfToday.getTime()) return 'COMPLETED';
  if (date.getTime() >= startOfTomorrow.getTime()) return 'PLANNED';
  return 'TODAY';
};

const getGameModeBadge = (gameMode?: string): { label: string; bgColor: string; textColor: string } => {
  switch (gameMode) {
    case 'playzone':
      return { label: 'PLAYZONE', bgColor: 'bg-emerald-900/30', textColor: 'text-emerald-400' };
    case 'elimination':
      return { label: 'ELIMINATION', bgColor: 'bg-red-900/30', textColor: 'text-red-400' };
    default:
      return { label: 'STANDARD', bgColor: 'bg-blue-900/30', textColor: 'text-blue-400' };
  }
};

const InitialLanding: React.FC<InitialLandingProps> = ({ onAction, version, games, activeGameId, onSelectGame, authUser, onLogout }) => {
  const [view, setView] = useState<CategoryView>('HOME');
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<GameStatusTab>('TODAY');
  const [fieldsPosition, setFieldsPosition] = useState({ top: 16, right: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showGeminiWarning, setShowGeminiWarning] = useState(false);
  const [hasCheckedGeminiKey, setHasCheckedGeminiKey] = useState(false);
  const [showPlayzoneChoiceModal, setShowPlayzoneChoiceModal] = useState(false);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [showActivityNotification, setShowActivityNotification] = useState(false);
  const [showSupabaseScripts, setShowSupabaseScripts] = useState(false);
  const [pendingMediaCounts, setPendingMediaCounts] = useState<Record<string, number>>({});
  const fieldsContainerRef = React.useRef<HTMLDivElement>(null);
  const activeGame = games.find(g => g.id === activeGameId);

  // Load saved position from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('fieldsPosition');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setFieldsPosition(pos);
      } catch (e) {
        console.error('Failed to load saved position:', e);
      }
    }
  }, []);

  // Check Gemini API key on mount and periodically
  React.useEffect(() => {
    const checkGeminiKey = () => {
      try {
        // Check localStorage first (user-configured)
        const localKey = localStorage.getItem('GEMINI_API_KEY');
        if (localKey && localKey.trim().length > 0) {
          setShowGeminiWarning(false);
          setHasCheckedGeminiKey(true);
          return;
        }

        // Check environment variables (configured at build time on deployment)
        const envKey = process.env.VITE_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const hasKey = !!envKey && envKey.trim().length > 0;
        setShowGeminiWarning(!hasKey);
        setHasCheckedGeminiKey(true);
      } catch (e) {
        console.error('Failed to check Gemini API key:', e);
        setShowGeminiWarning(true);
        setHasCheckedGeminiKey(true);
      }
    };

    // Check immediately
    checkGeminiKey();

    // Check every 30 seconds
    const interval = setInterval(checkGeminiKey, 30000);

    return () => clearInterval(interval);
  }, []);

  // Check for new activity since last login
  useEffect(() => {
    const checkActivity = async () => {
      const lastLogin = getLastLogin();

      // Get activity summary
      const activity = await getActivitySinceLastLogin(games, lastLogin);
      setActivitySummary(activity);

      // Show notification if there's new activity
      const hasActivity = activity.newSubmissions > 0 ||
                         activity.recentlyApproved > 0 ||
                         activity.recentlyRejected > 0 ||
                         activity.pendingApprovals > 0;

      if (hasActivity) {
        setShowActivityNotification(true);
      }

      // Update last login time
      updateLastLogin();

      // Load pending counts for each game (for badges)
      const counts: Record<string, number> = {};
      for (const game of games) {
        const count = await getPendingMediaCount(game.id);
        if (count > 0) {
          counts[game.id] = count;
        }
      }
      setPendingMediaCounts(counts);
    };

    if (games.length > 0) {
      checkActivity();
    }
  }, [games]);

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    if (!fieldsContainerRef.current) return;
    setIsDragging(true);
    const rect = fieldsContainerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Handle drag move
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newTop = e.clientY - dragOffset.y;
      const newRight = window.innerWidth - (e.clientX + dragOffset.x);

      const newPos = {
        top: Math.max(0, newTop),
        right: Math.max(0, newRight),
      };

      setFieldsPosition(newPos);
      // Save position to localStorage in real-time during drag
      localStorage.setItem('fieldsPosition', JSON.stringify(newPos));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const filteredGames = useMemo(() => {
    const now = new Date();
    let filtered = games;

    // Apply search filter first (search across all games regardless of tab)
    if (gameSearchQuery.trim()) {
      filtered = filtered.filter(game => matchesGameSearch(game.name, game.id, gameSearchQuery));
    }

    // Then apply status tab filter (only if no search query)
    if (!gameSearchQuery.trim()) {
      filtered = filtered.filter(game => getGameStatusTab(game, now) === statusTab);
    }

    return filtered;
  }, [games, gameSearchQuery, statusTab]);

  // Dynamic Header Content
  const getHeaderContent = () => {
      switch (view) {
          case 'CREATE': return { title: 'CREATE CENTER', subtitle: 'NEW RESOURCE SETUP', showBranding: false };
          case 'CREATE_GAME_SUBMENU': return { title: 'GAME TYPE SELECTOR', subtitle: 'CHOOSE GAME MODE', showBranding: false };
          case 'EDIT_MENU': return { title: 'EDIT CENTER', subtitle: 'MODIFY RESOURCES', showBranding: false };
          case 'PLAY_MENU': return { title: 'PLAY CENTER', subtitle: 'GAME OPERATIONS', showBranding: false };
          case 'PLAY_TEAMS_MENU': return { title: 'TEAM OPERATIONS', subtitle: 'SQUAD MANAGEMENT', showBranding: false };
          case 'SETTINGS': return { title: 'SYSTEM TOOLS', subtitle: 'GLOBAL CONFIGURATION', showBranding: false };
          case 'PREVIEW_SELECT': return { title: 'SIMULATION', subtitle: 'DEVICE PREVIEW MODE', showBranding: false };
          default: return {
              title: 'HOME',
              subtitle: 'OPERATION CENTER',
              showBranding: true,
              brandingParts: [
                  { text: 'TEAM', color: 'text-white' },
                  { text: 'CHALLENGE', color: 'text-orange-500' }
              ]
          };
      }
  };

  const headerContent = getHeaderContent();

  // Navigation Logic
  const handleBack = () => {
      switch (view) {
          case 'CREATE_GAME_SUBMENU':
              setView('CREATE');
              break;
          case 'PLAY_TEAMS_MENU':
              setView('PLAY_MENU');
              break;
          case 'PREVIEW_SELECT':
              setView('SETTINGS');
              break;
          default:
              setView('HOME');
              break;
      }
  };

  const renderHome = () => (
      <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-center justify-center w-full px-4 pb-12 pt-8">
          <MapPinButton 
              title="CREATE" 
              icon={Plus} 
              gradient="bg-gradient-to-br from-orange-600 to-red-600" 
              onClick={() => setView('CREATE')} 
              delay={0}
          />
          <MapPinButton 
              title="EDIT" 
              icon={Edit2} 
              gradient="bg-gradient-to-br from-blue-600 to-indigo-600" 
              onClick={() => setView('EDIT_MENU')} 
              delay={100}
          />
          <MapPinButton 
              title="PLAY" 
              icon={Play} 
              gradient="bg-gradient-to-br from-emerald-600 to-teal-600" 
              onClick={() => setView('PLAY_MENU')} 
              delay={200}
          />
      </div>
  );

  const renderCreateMenu = () => (
      <div className="flex flex-col items-center w-full gap-8">
          {/* Create Options */}
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 lg:gap-20 items-center justify-center w-full px-4 pb-10">
              <MapPinButton
                  title="GAME"
                  icon={Gamepad2}
                  gradient="bg-gradient-to-br from-orange-500 to-red-500"
                  onClick={() => setView('CREATE_GAME_SUBMENU')}
                  delay={0}
                  scale={0.75}
              />
              <MapPinButton
                  title="TASK"
                  icon={FilePlus}
                  gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
                  onClick={() => onAction('TASKS')}
                  delay={50}
                  scale={0.75}
              />
              <MapPinButton
                  title="PLAYZONE"
                  icon={Globe}
                  gradient="bg-gradient-to-br from-emerald-500 to-green-500"
                  onClick={() => onAction('PLAYGROUNDS')}
                  delay={100}
                  scale={0.75}
              />
          </div>
      </div>
  );

  const renderGameTypeSubmenu = () => (
      <div className="flex flex-col items-center w-full">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 lg:gap-20 items-center justify-center w-full px-4 pb-10">
              <MapPinButton
                  title="MAP"
                  icon={MapPin}
                  gradient="bg-gradient-to-br from-orange-500 to-red-500"
                  onClick={() => onAction('CREATE_MAP_GAME')}
                  delay={0}
                  scale={0.75}
              />
              <MapPinButton
                  title="PLAYZONE"
                  icon={Smartphone}
                  gradient="bg-gradient-to-br from-teal-500 to-emerald-500"
                  onClick={() => setShowPlayzoneChoiceModal(true)}
                  delay={50}
                  scale={0.75}
              />
              <MapPinButton
                  title="ELIMINATION"
                  icon={Bomb}
                  gradient="bg-gradient-to-br from-red-500 to-pink-500"
                  onClick={() => onAction('CREATE_ELIMINATION_GAME')}
                  delay={100}
                  scale={0.75}
                  badge="BETA"
              />
          </div>
      </div>
  );

  const renderEditMenu = () => (
      <div className="flex flex-col items-center w-full">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 lg:gap-20 items-center justify-center w-full px-4 pb-10">
              <MapPinButton
                  title="EDIT GAME"
                  icon={Gamepad2}
                  gradient="bg-gradient-to-br from-cyan-600 to-blue-600"
                  onClick={() => onAction('GAMES')}
                  delay={0}
                  scale={0.75}
              />
              <MapPinButton
                  title="EDIT TASK"
                  icon={Edit2}
                  gradient="bg-gradient-to-br from-purple-600 to-violet-600"
                  onClick={() => onAction('TASKS')}
                  delay={100}
                  scale={0.75}
              />
              <MapPinButton
                  title="EDIT PLAYZONE"
                  icon={Globe}
                  gradient="bg-gradient-to-br from-emerald-600 to-teal-600"
                  onClick={() => onAction('PLAYGROUNDS')}
                  delay={200}
                  scale={0.75}
              />
          </div>
      </div>
  );

  const renderPlayMenu = () => (
      <div className="flex flex-col items-center w-full">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 lg:gap-20 items-center justify-center w-full px-4 pb-10">
              <MapPinButton
                  title="ACCESS"
                  icon={KeyRound}
                  gradient="bg-gradient-to-br from-blue-600 to-cyan-600"
                  onClick={() => onAction('ACCESS')}
                  delay={0}
                  scale={0.85}
              />
              <MapPinButton
                  title="PLAY GAME"
                  icon={Play}
                  gradient="bg-gradient-to-br from-emerald-600 to-green-600"
                  onClick={() => onAction('PLAY')}
                  delay={100}
                  scale={0.85}
              />
              <MapPinButton
                  title="CLIENT"
                  icon={Users}
                  gradient="bg-gradient-to-br from-purple-600 to-fuchsia-600"
                  onClick={() => onAction('CLIENT')}
                  delay={200}
                  scale={0.85}
              />
              <MapPinButton
                  title="TEAMS"
                  icon={Users}
                  gradient="bg-gradient-to-br from-indigo-600 to-blue-600"
                  onClick={() => setView('PLAY_TEAMS_MENU')}
                  delay={300}
                  scale={0.85}
              />
              <MapPinButton
                  title="CHAT"
                  icon={MessageSquare}
                  gradient="bg-gradient-to-br from-slate-600 to-slate-700"
                  onClick={() => onAction('CHAT')}
                  delay={400}
                  scale={0.85}
              />
          </div>
      </div>
  );

  const renderPlayTeamsMenu = () => (
      <div className="flex flex-col items-center w-full">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 lg:gap-20 items-center justify-center w-full px-4 pb-10">
              <MapPinButton 
                  title="TEAMLOBBY" 
                  icon={Users} 
                  gradient="bg-gradient-to-br from-purple-600 to-indigo-600" 
                  onClick={() => onAction('TEAM_LOBBY')} 
                  delay={0}
                  scale={0.85}
              />
              <MapPinButton 
                  title="NEW TEAM" 
                  icon={UserPlus} 
                  gradient="bg-gradient-to-br from-pink-500 to-rose-500" 
                  onClick={() => onAction('TEAM_LOBBY')} 
                  delay={100}
                  scale={0.85}
              />
              <MapPinButton 
                  title="EDIT TEAMS" 
                  icon={Edit2} 
                  gradient="bg-gradient-to-br from-orange-600 to-amber-600" 
                  onClick={() => onAction('MANAGE_TEAMS')} 
                  delay={200}
                  scale={0.85}
              />
          </div>
      </div>
  );

  const renderCategoryContent = () => {
      switch(view) {
          case 'CREATE':
              return renderCreateMenu();
          case 'EDIT_MENU':
              return renderEditMenu();
          case 'PLAY_MENU':
              return renderPlayMenu();
          case 'PLAY_TEAMS_MENU':
              return renderPlayTeamsMenu();
          case 'SETTINGS':
              return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-right-4">
                      {/* Admin Tools */}
                      <NavCard 
                          title="USERS" 
                          subtitle="ACCESS & ROLES" 
                          icon={UserCircle} 
                          color="bg-purple-500"
                          onClick={() => onAction('USERS')}
                      />
                      <NavCard
                          title="AI SETTINGS"
                          subtitle="SYSTEM MAINTENANCE"
                          icon={KeyRound}
                          color="bg-blue-600"
                          onClick={() => onAction('DATABASE')}
                      />
                      <NavCard
                          title="QR CODES"
                          subtitle="PRINT & DOWNLOAD"
                          icon={QrCode}
                          color="bg-indigo-500"
                          onClick={() => onAction('QR_CODES')}
                      />
                      <NavCard
                          title="GAMESTATS"
                          subtitle="GAME ANALYTICS"
                          icon={BarChart3}
                          color="bg-cyan-500"
                          onClick={() => onAction('GAMESTATS')}
                      />
                      <NavCard
                          title="MAP STYLES"
                          subtitle="CUSTOM MAP LIBRARY"
                          icon={Map}
                          color="bg-purple-600"
                          onClick={() => onAction('MAP_STYLES')}
                      />
                      <NavCard
                          title="SUPABASE"
                          subtitle="SQL SCRIPTS & MIGRATIONS"
                          icon={Database}
                          color="bg-green-600"
                          onClick={() => setShowSupabaseScripts(true)}
                      />
                      <NavCard
                          title="SYSTEM SOUNDS"
                          subtitle="GLOBAL AUDIO SETTINGS"
                          icon={Volume2}
                          color="bg-purple-600"
                          onClick={() => onAction('SYSTEM_SOUNDS')}
                      />
                      <NavCard
                          title="MEDIA"
                          subtitle="PHOTOS & VIDEOS MANAGER"
                          icon={Smartphone}
                          color="bg-orange-600"
                          onClick={() => onAction('MEDIA')}
                      />
                      <NavCard
                          title="DELETE GAMES"
                          subtitle="REMOVE SESSIONS"
                          icon={Trash2}
                          color="bg-red-600"
                          onClick={() => onAction('DELETE_GAMES')}
                      />
                  </div>
              );
          case 'PREVIEW_SELECT':
              return (
                  <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <NavCard 
                              title="TEAM PREVIEW" 
                              subtitle="SIMULATE PLAYER VIEW" 
                              icon={Users} 
                              color="bg-orange-500"
                              onClick={() => onAction('PREVIEW_TEAM')}
                          />
                          <NavCard 
                              title="INSTRUCTOR PREVIEW" 
                              subtitle="SIMULATES INSTRUCTOR VIEW" 
                              icon={Shield} 
                              color="bg-indigo-500"
                              onClick={() => onAction('PREVIEW_INSTRUCTOR')}
                          />
                      </div>
                  </div>
              );
          default:
              return null;
      }
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-[#1a1a1a] text-white flex flex-col font-sans uppercase overflow-hidden">
      
      {/* --- BACKGROUND LAYER (Grey Map) --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 1920 1080" preserveAspectRatio="none">
              <rect width="100%" height="100%" fill="#202020" />
              <path d="M0 0 L500 0 C 500 300, 300 500, 0 600 Z" fill="#262626" />
              <path d="M1920 1080 L1400 1080 C 1400 800, 1600 600, 1920 500 Z" fill="#262626" />
              <path d="M1920 0 L1500 0 C 1600 300, 1800 200, 1920 400 Z" fill="#2a2a2a" />
              <path d="M600 0 L900 0 L800 1080 L500 1080 Z" fill="#232323" opacity="0.5" />
              <path d="M -50 650 C 500 650, 700 350, 1100 550 C 1500 750, 1700 550, 2100 650" fill="none" stroke="#404040" strokeWidth="50" strokeLinecap="round" />
              <path d="M -50 650 C 500 650, 700 350, 1100 550 C 1500 750, 1700 550, 2100 650" fill="none" stroke="#505050" strokeWidth="4" strokeOpacity="0.5" transform="translate(0, -23)" />
              <path d="M 300 -100 C 300 300, 100 600, 200 1200" fill="none" stroke="#333333" strokeWidth="40" strokeLinecap="round" />
              <path d="M 1400 -100 C 1400 400, 1200 800, 1500 1200" fill="none" stroke="#2e2e2e" strokeWidth="30" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[length:100px_100px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-10 min-h-full">
          
          {/* Header Container */}
          <div className="relative">

            {/* Top Left Status / Home Button */}
            <div className="absolute top-0 left-0 flex items-center gap-4 z-30">
                {view !== 'HOME' && (
                    <button
                        onClick={handleBack}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl uppercase tracking-widest text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border border-slate-700"
                        title="Go Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Top Right Controls */}
            <div className="absolute top-0 right-0 flex items-center gap-4 z-30 pt-4 pr-4">
                {/* Settings Button */}
                <button
                    onClick={() => setView(view === 'SETTINGS' ? 'HOME' : 'SETTINGS')}
                    className={`p-3 rounded-xl transition-all hover:scale-105 active:scale-95 border ${view === 'SETTINGS' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                    title="System Settings & Tools"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            {/* Right Side Fields Column (OPERATOR, GAME ID, SESSION) */}
            {/* HIDDEN: Game selector not needed on Edit/Play Center landing pages */}
            {false && (view === 'EDIT_MENU' || view === 'PLAY_MENU') && (
                <div
                  ref={fieldsContainerRef}
                  className="absolute flex flex-col gap-0 z-30 select-none"
                  style={{
                    top: `${fieldsPosition.top}px`,
                    right: `${fieldsPosition.right}px`,
                    cursor: isDragging ? 'grabbing' : 'auto',
                  }}
                >
                    {/* Drag Handle */}
                    <div
                      onMouseDown={handleDragStart}
                      className="h-2 bg-gradient-to-r from-orange-500 via-blue-500 to-emerald-500 rounded-t-xl cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity"
                      title="Drag to move fields"
                    />

                    {/* Session Selector with GOTO Button (Orange to Blue Border) */}
                    <div className="relative flex items-center gap-2 bg-slate-900/50 backdrop-blur-md px-4 py-3 rounded-xl border-2 border-orange-500/60 h-16 transition-all animate-in fade-in slide-in-from-right-4 duration-500 delay-50 w-96">
                        {/* Top gradient line */}
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500/60 via-blue-500/60 to-emerald-500/60 rounded-t-xl" />
                        <button
                            onClick={() => setShowGameMenu(!showGameMenu)}
                            className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
                        >
                            <span className="text-xs font-black text-white tracking-widest uppercase leading-none truncate">
                                {activeGame ? `[${getGameDisplayId(activeGame.id)}] ${activeGame.name}` : "SELECT SESSION"}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform shrink-0 text-slate-400 ${showGameMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {/* GOTO Button */}
                        {activeGame && (
                            <button
                                onClick={() => {
                                    setShowGameMenu(false);
                                    onSelectGame(activeGame.id);
                                    onAction('EDIT_GAME');
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-600 to-blue-600 hover:from-orange-500 hover:to-blue-500 text-white rounded-lg font-black text-[10px] tracking-wide uppercase transition-all hover:scale-105 active:scale-95 shrink-0"
                                title="Go to game editor"
                            >
                                <span>GOTO</span>
                                <ExternalLink className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Dropdown Menu */}
                    {showGameMenu && (
                        <div className="absolute top-full left-0 mt-0 bg-slate-900 border border-slate-700 border-t-0 rounded-b-2xl shadow-2xl overflow-hidden z-50 max-h-96 flex flex-col animate-in slide-in-from-top-2" style={{ width: '384px' }}>
                            {/* Status Tabs */}
                            <div className="flex gap-2 p-3 border-b border-slate-700 bg-slate-900/50">
                                <button
                                    onClick={() => setStatusTab('TODAY')}
                                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                                      statusTab === 'TODAY'
                                        ? 'bg-blue-600 text-white border border-blue-500 shadow-lg shadow-blue-500/20'
                                        : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-white'
                                    }`}
                                >
                                    TODAY
                                </button>
                                <button
                                    onClick={() => setStatusTab('PLANNED')}
                                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                                      statusTab === 'PLANNED'
                                        ? 'bg-amber-600 text-white border border-amber-500 shadow-lg shadow-amber-500/20'
                                        : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-white'
                                    }`}
                                >
                                    PLANNED
                                </button>
                                <button
                                    onClick={() => setStatusTab('COMPLETED')}
                                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                                      statusTab === 'COMPLETED'
                                        ? 'bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-500/20'
                                        : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-white'
                                    }`}
                                >
                                    COMPLETED
                                </button>
                            </div>

                            {/* Search Input */}
                            <div className="sticky top-16 p-4 border-b border-slate-700 bg-slate-900">
                                <div className="relative flex items-center">
                                    <Search className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search by ID or name..."
                                        value={gameSearchQuery}
                                        onChange={(e) => setGameSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-8 py-2 bg-slate-800 text-white text-xs rounded-lg border border-slate-700 focus:border-orange-500 focus:outline-none placeholder-slate-500"
                                        autoFocus
                                    />
                                    {gameSearchQuery && (
                                        <button
                                            onClick={() => setGameSearchQuery('')}
                                            className="absolute right-2 p-1 hover:bg-slate-700 rounded transition-colors"
                                        >
                                            <XIcon className="w-4 h-4 text-slate-400 hover:text-white" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Game List */}
                            <div className="overflow-y-auto">
                                {filteredGames.length === 0 && <div className="p-6 text-xs text-slate-500 font-bold text-center uppercase tracking-widest">NO GAMES FOUND</div>}
                                {filteredGames.map(game => {
                                    const badge = getGameModeBadge(game.gameMode);
                                    return (
                                        <button
                                            key={game.id}
                                            onClick={() => {
                                              onSelectGame(game.id);
                                              setShowGameMenu(false);
                                              setGameSearchQuery('');
                                              // In PLAY_MENU, go directly to EDIT (simulation) mode
                                              if (view === 'PLAY_MENU') {
                                                onAction('EDIT_GAME');
                                              }
                                            }}
                                            className={`w-full text-left px-5 py-3 text-xs border-b border-slate-800 hover:bg-slate-800 transition-colors flex items-center justify-between gap-3 ${game.id === activeGameId ? 'text-orange-500 bg-orange-900/10' : 'text-slate-300'}`}
                                        >
                                            <span className="truncate flex items-center gap-2 flex-1">
                                                <span className="text-orange-400 font-black shrink-0">[{getGameDisplayId(game.id)}]</span>
                                                <span className="font-bold truncate">{game.name}</span>
                                                {pendingMediaCounts[game.id] > 0 && (
                                                    <span className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse" title="Pending media approvals">
                                                        📸 {pendingMediaCounts[game.id]}
                                                    </span>
                                                )}
                                            </span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`px-2 py-1 rounded-md text-[9px] font-black tracking-wide border ${badge.bgColor} ${badge.textColor} border-slate-700 whitespace-nowrap`}>
                                                    {badge.label}
                                                </span>
                                                {/* Game Settings Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectGame(game.id);
                                                        setShowGameMenu(false);
                                                        setGameSearchQuery('');
                                                        onAction('EDIT_GAME');
                                                    }}
                                                    className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-orange-400 flex-shrink-0"
                                                    title="Game Settings"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                                {game.id === activeGameId && <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_orange] shrink-0" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {showGameMenu && <div className="fixed inset-0 z-40" onClick={() => setShowGameMenu(false)} />}
                </div>
            )}

            {/* Operator Field (HOME view) */}
            {view === 'HOME' && authUser && (
                <div className="absolute top-0 left-0 z-30 pt-4 pl-4">
                    <div className="flex items-center gap-4 bg-slate-900/50 backdrop-blur-md px-4 py-3 rounded-xl border-2 border-green-500/60 h-16 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                            <div className="flex flex-col min-w-0">
                                <p className="text-[8px] font-black text-slate-500 tracking-[0.2em] uppercase leading-none">OPERATOR</p>
                                <p className="text-xs font-black text-white tracking-widest uppercase leading-none mt-0.5 truncate">{authUser.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            title="Logout"
                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* System Status (HOME view, no auth) */}
            {view === 'HOME' && !authUser && (
                <div className="absolute top-0 left-0 z-30 pt-4 pl-4">
                    <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-md px-4 py-3 rounded-xl border-2 border-slate-700 h-16 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-[9px] font-black text-slate-500 tracking-[0.4em] uppercase">
                          SYSTEM ONLINE &bull; v{version}
                        </p>
                    </div>
                </div>
            )}

            {/* Gemini API Key Warning Banner - Only show in EDIT mode when game is loaded */}
            {view === 'EDIT' && showGeminiWarning && hasCheckedGeminiKey && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 animate-in slide-in-from-top-4 fade-in duration-500">
                    <div className="bg-gradient-to-r from-yellow-900/90 to-orange-900/90 backdrop-blur-md border-2 border-yellow-500/60 rounded-xl p-4 shadow-2xl shadow-yellow-500/20">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center shrink-0">
                                <KeyRound className="w-5 h-5 text-yellow-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-black text-yellow-100 uppercase tracking-wider mb-1 flex items-center gap-2">
                                    ⚠️ AI Features Unavailable
                                </h3>
                                <p className="text-xs text-yellow-200/90 font-bold leading-relaxed mb-3">
                                    Gemini API key not configured. AI background generation, icon creation, and task generation will not work.
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onAction('ADMIN')}
                                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 rounded-lg font-black uppercase text-[10px] tracking-widest transition-colors flex items-center gap-2 shadow-lg"
                                    >
                                        <KeyRound className="w-3.5 h-3.5" />
                                        CONFIGURE NOW
                                    </button>
                                    <button
                                        onClick={() => setShowGeminiWarning(false)}
                                        className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-colors"
                                    >
                                        DISMISS
                                    </button>
                                    <a
                                        href="https://aistudio.google.com/app/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 text-yellow-300 hover:text-yellow-100 text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        GET FREE KEY
                                    </a>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowGeminiWarning(false)}
                                className="p-1.5 hover:bg-yellow-500/20 rounded-lg text-yellow-200/60 hover:text-yellow-100 transition-colors shrink-0"
                                title="Close"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Centered Title & Session Selector Block */}
            <div className="flex flex-col items-center justify-center pt-8 pb-4 gap-6">
                
                {/* Title */}
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="text-center">
                        {headerContent.showBranding ? (
                            <>
                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-2 drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]">
                                    <span className="text-white">{headerContent.brandingParts?.[0]?.text}</span>
                                    <span className="text-orange-500">{headerContent.brandingParts?.[1]?.text}</span>
                                </h1>
                                <div className="flex flex-col items-center gap-1">
                                    <p className="text-xs font-black text-slate-500 tracking-[0.8em] uppercase ml-2">
                                        {headerContent.subtitle}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-600 tracking-[0.1em] uppercase">
                                        v{version}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-2 text-white drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]">
                                    {headerContent.title}
                                </h1>
                                <div className="flex flex-col items-center gap-1">
                                    <p className="text-xs font-black text-slate-500 tracking-[0.8em] uppercase ml-2">
                                        {headerContent.subtitle}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-600 tracking-[0.1em] uppercase">
                                        v{version}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
              {view === 'HOME' || view === 'CREATE' || view === 'CREATE_GAME_SUBMENU' || view === 'EDIT_MENU' || view === 'PLAY_MENU' || view === 'PLAY_TEAMS_MENU' ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {view === 'HOME' ? renderHome() :
                       (view === 'CREATE' ? renderCreateMenu() :
                       (view === 'CREATE_GAME_SUBMENU' ? renderGameTypeSubmenu() :
                       (view === 'EDIT_MENU' ? renderEditMenu() :
                       (view === 'PLAY_MENU' ? renderPlayMenu() :
                       renderPlayTeamsMenu()))))}
                  </div>
              ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="mb-6 flex items-center gap-3 opacity-50">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{view === 'PREVIEW_SELECT' ? 'PREVIEW MODE' : `${view} MODULES`}</span>
                          <div className="h-px bg-slate-700 flex-1" />
                      </div>
                      {renderCategoryContent()}
                  </div>
              )}
          </div>

          {/* Footer Branding */}
          <div className="mt-auto pt-10 border-t border-slate-900/50 flex justify-center items-center gap-4">
            <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                POWERED BY TEAMBATTLE
            </p>
          </div>
        </div>

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
                    onAction('CREATE_PLAYZONE_GAME');
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
                >
                  <Plus className="w-5 h-5" />
                  CREATE NEW
                </button>

                <button
                  onClick={() => {
                    setShowPlayzoneChoiceModal(false);
                    onAction('TEMPLATES');
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
                >
                  <Library className="w-5 h-5" />
                  FROM TEMPLATE
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

        {/* Activity Notification Modal */}
        {showActivityNotification && activitySummary && (
            <ActivityNotificationModal
                activity={activitySummary}
                onClose={() => setShowActivityNotification(false)}
                onNavigateToGame={(gameId) => {
                    onSelectGame(gameId);
                    setShowActivityNotification(false);
                    onAction('EDIT_GAME'); // Go to editor to review media
                }}
            />
        )}

        {/* Supabase Scripts Modal */}
        {showSupabaseScripts && (
            <SupabaseScriptsModal
                onClose={() => setShowSupabaseScripts(false)}
            />
        )}
      </div>
    </div>
  );
};

export default InitialLanding;
