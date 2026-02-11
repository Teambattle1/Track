import React, { useMemo, useState } from 'react';
import {
  Game,
  TaskList,
  GamePoint,
  MapStyleId,
  GameMode
} from '../types';
import {
  X,
  Trash2,
  Play,
  Settings,
  Plus,
  LayoutTemplate,
  Wand2,
  QrCode,
  Copy,
  Check,
  Download,
  KeyRound
} from 'lucide-react';
import { getGameModeIcon } from '../utils/gameModeIcons';
import { getGameDisplayId, formatGameNameWithId } from '../utils/gameIdUtils';
import ConfirmationModal from './ConfirmationModal';

interface GameManagerProps {
  games: Game[];
  taskLists: TaskList[];
  activeGameId: string | null;
  activeGamePoints: GamePoint[];
  onCreateGame: (name: string, fromTaskListId?: string, description?: string, mapStyle?: MapStyleId) => void;
  onCreateFromTemplate?: (templateId: string) => void;
  onSelectGame: (id: string) => void;
  onEditGame?: (id: string) => void;
  onDeleteGame: (id: string) => void;
  onEditPoint: (point: GamePoint) => void;
  onReorderPoints: (points: GamePoint[]) => void;
  onCreateTestGame: () => void;
  onOpenTaskMaster: () => void;
  onClose: () => void;
  onAddFromLibrary?: () => void;
  onClearMap: () => void;
  sourceListId?: string;
  onSetSourceListId?: (id: string) => void;
  onExplicitSaveGame?: () => void;
  onSaveAsTemplate?: (gameId: string, name: string, description: string) => void;
  onOpenPlaylist?: () => void;
  onEditGameMetadata?: (id: string, name: string, description: string) => void;
  onShowResults?: () => void;
  mode: GameMode;
  onSetMode: (mode: GameMode) => void;
  onOpenAiGenerator?: () => void;
  onOpenGameCreator?: () => void;
  onEditGameSetup?: (gameId: string) => void;
  onOpenAccessSettings?: (gameId: string) => void;
  onStartSimulation?: (game: Game) => void;
  onOpenWizard?: () => void;
}

type GameStatusTab = 'TODAY' | 'PLANNED' | 'COMPLETED';

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const getGameSessionDate = (game: Game) => {
  if (!game) {
    console.error('[getGameSessionDate] Received undefined game');
    return new Date();
  }
  if (game.client?.playingDate) {
    const d = new Date(game.client.playingDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(game.createdAt || Date.now());
};

const isGameCompleted = (game: Game) => {
  if (!game) {
    console.error('[isGameCompleted] Received undefined game');
    return false;
  }
  if (game.state === 'ended' || game.state === 'ending') return true;

  const points = game.points || [];
  const playablePoints = points.filter(p => !p.isSectionHeader);
  if (playablePoints.length === 0) return false;

  return playablePoints.every(p => !!p.isCompleted);
};

const getGameStatusTab = (game: Game, now: Date): GameStatusTab => {
  if (!game) {
    console.error('[getGameStatusTab] Received undefined game');
    return 'TODAY';
  }
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

// Access Code / QR Popup for sharing game access with players
const AccessCodePopup: React.FC<{
  game: Game;
  onClose: () => void;
}> = ({ game, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const code = game.accessCode || '';
  const accessUrl = `${window.location.origin}/access?code=${code}`;

  React.useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(accessUrl, {
          width: 280,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('[AccessCodePopup] QR generation error:', err);
      }
    })();
  }, [code, accessUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(accessUrl);
    } catch { /* ignore */ }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `${game.name || 'game'}-qr-code.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-orange-500 to-orange-600 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <QrCode className="w-5 h-5" />
            <h3 className="font-black uppercase tracking-wide text-sm">Player Access</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Game Name */}
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Game Session</p>
            <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase">{game.name}</h4>
          </div>

          {code ? (
            <>
              {/* QR Code */}
              <div className="flex flex-col items-center">
                {qrDataUrl ? (
                  <div className="bg-white p-4 rounded-xl shadow-inner border-2 border-gray-200">
                    <img src={qrDataUrl} alt="Game QR Code" className="w-56 h-56" />
                  </div>
                ) : (
                  <div className="w-56 h-56 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center animate-pulse">
                    <QrCode className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">Scan to join game</p>
              </div>

              {/* Access Code Display */}
              <div className="bg-gray-900 dark:bg-gray-800 p-4 rounded-xl text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Access Code</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-black text-white tracking-[0.3em]">{code}</span>
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    title="Copy Code"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-white/70" />}
                  </button>
                </div>
              </div>

              {/* URL */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Direct Link</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-blue-600 dark:text-blue-400 font-mono truncate flex-1">{accessUrl}</code>
                  <button
                    onClick={handleCopyUrl}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors shrink-0"
                    title="Copy URL"
                  >
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Download Button */}
              {qrDataUrl && (
                <button
                  onClick={handleDownloadQR}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700"
                >
                  <Download className="w-4 h-4" />
                  Download QR Code
                </button>
              )}
            </>
          ) : (
            /* No access code set */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase">No Access Code Set</p>
              <p className="text-xs text-gray-500 mt-1">Set an access code in Game Settings → Access tab</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Inline tooltip showing game code + QR on hover
const GameCodeBadge: React.FC<{ accessCode?: string }> = ({ accessCode }) => {
  const [qrUrl, setQrUrl] = React.useState<string | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    if (!isHovered || !accessCode || qrUrl) return;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const loginUrl = `${window.location.origin}/login?code=${accessCode}`;
        const url = await QRCode.toDataURL(loginUrl, { width: 160, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        setQrUrl(url);
      } catch { /* QR generation failed */ }
    })();
  }, [isHovered, accessCode, qrUrl]);

  if (!accessCode) return null;

  return (
    <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/40 transition-colors whitespace-nowrap">
        <KeyRound className="w-3 h-3" />
        {accessCode}
      </span>

      {/* Hover tooltip */}
      {isHovered && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-2xl p-4 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-gray-900 border-l border-t border-gray-300 dark:border-gray-700 rotate-45" />

          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">Player Login Code</p>

          <div className="bg-gray-900 dark:bg-black/40 rounded-lg p-3 text-center mb-3">
            <span className="text-2xl font-black text-orange-500 tracking-[0.3em]">{accessCode}</span>
          </div>

          <div className="flex justify-center">
            {qrUrl ? (
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <img src={qrUrl} alt="Game QR" className="w-32 h-32" />
              </div>
            ) : (
              <div className="w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center animate-pulse">
                <QrCode className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          <p className="text-[8px] text-gray-500 text-center mt-2 font-bold uppercase tracking-wider">
            /login?code={accessCode}
          </p>
        </div>
      )}
    </div>
  );
};

const GameSummaryCard: React.FC<{
  game?: Game | null;
  isActive: boolean;
  onPrimaryAction: () => void;
  onDelete: () => void;
  onSettings?: () => void;
  onShowAccessCode?: () => void;
  onOpenAccessSettings?: () => void;
}> = ({ game, isActive, onPrimaryAction, onDelete, onSettings, onShowAccessCode, onOpenAccessSettings }) => {
  // CRITICAL: Guard against undefined/null game data - must be first check
  if (!game || typeof game !== 'object') {
    console.error('[GameSummaryCard] Invalid game data:', game);
    return null;
  }

  // Safely compute values with fallbacks
  let sessionDate: Date;
  let mapTaskCount: number;
  let zoneCount: number;

  try {
    sessionDate = getGameSessionDate(game);
    mapTaskCount = Array.isArray(game.points)
      ? game.points.filter(p => p && !p.playgroundId && !p.isSectionHeader).length
      : 0;
    zoneCount = Array.isArray(game.playgrounds) ? game.playgrounds.length : 0;
  } catch (error) {
    console.error('[GameSummaryCard] Error computing game stats:', error, game);
    return null;
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex justify-between items-center transition-all ${
        isActive
          ? 'border-orange-500 ring-1 ring-orange-500'
          : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
      }`}
    >
      <button
        type="button"
        onClick={onPrimaryAction}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
          {game.client?.logoUrl ? (
            <img
              src={game.client.logoUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <LayoutTemplate className="w-6 h-6 text-gray-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-gray-800 dark:text-white uppercase truncate">
              <span className="text-orange-600 dark:text-orange-400 font-black">[{getGameDisplayId(game.id)}]</span> {game.name || 'Unnamed Game'}
              {game.identificator && (
                <span className="ml-2 text-blue-600 dark:text-blue-400 font-black">({game.identificator})</span>
              )}
            </h3>
            {(() => {
              const { Icon, label, color, bgColor, borderColor } = getGameModeIcon(game.gameMode);
              return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${color} ${bgColor} border ${borderColor} whitespace-nowrap`}>
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              );
            })()}
            <GameCodeBadge accessCode={game.accessCode} />
          </div>
          <p className="text-xs text-gray-500 truncate">
            {sessionDate.toLocaleDateString()} • {(game.points?.length || 0)} Tasks{game.gameMode !== 'playzone' ? ` • ${mapTaskCount} On map` : ''} • {zoneCount} Zones
          </p>
        </div>
      </button>

      <div className="flex gap-2 shrink-0">
        <button
          onClick={onPrimaryAction}
          className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          title="Edit Game"
        >
          <Play className="w-4 h-4" />
        </button>
        {onShowAccessCode && (
          <button
            onClick={game?.accessCode ? onShowAccessCode : (onOpenAccessSettings || onShowAccessCode)}
            className={`p-2 rounded-lg transition-colors ${
              game?.accessCode
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-400 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 animate-pulse'
            }`}
            title={game?.accessCode ? `Access Code: ${game.accessCode}` : 'Click to set Access Code in Game Settings'}
          >
            <QrCode className="w-4 h-4" />
          </button>
        )}
        {onSettings && (
          <button
            onClick={onSettings}
            className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
            title="Game Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          title="Delete Game"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const GameManager: React.FC<GameManagerProps> = ({
  games,
  activeGameId,
  onSelectGame,
  onEditGame,
  onDeleteGame,
  onClose,
  onCreateGame,
  onCreateFromTemplate,
  onOpenGameCreator,
  onEditGameSetup,
  onOpenAccessSettings,
  onOpenWizard,
  mode
}) => {
  const [section, setSection] = useState<'GAMES' | 'TEMPLATES'>('GAMES');
  const [view, setView] = useState<'LIST' | 'CREATE'>('LIST');
  const [statusTab, setStatusTab] = useState<GameStatusTab>('TODAY');
  const [newName, setNewName] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; gameId?: string; isTemplate?: boolean }>({ isOpen: false });
  const [accessCodeGame, setAccessCodeGame] = useState<Game | null>(null);
  const [gameIdSearch, setGameIdSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Game[]>([]);

  const { todayGames, plannedGames, completedGames, templateList } = useMemo(() => {
    const now = new Date();
    const today: Game[] = [];
    const planned: Game[] = [];
    const completed: Game[] = [];

    // CRITICAL: Filter out any null/undefined games before processing
    const nonTemplates = games.filter(g => g && !g.isGameTemplate);

    for (const g of nonTemplates) {
      const tab = getGameStatusTab(g, now);
      if (tab === 'TODAY') today.push(g);
      else if (tab === 'PLANNED') planned.push(g);
      else completed.push(g);
    }

    const byDateThenName = (a: Game, b: Game) => {
      const ad = getGameSessionDate(a).getTime();
      const bd = getGameSessionDate(b).getTime();
      if (ad !== bd) return ad - bd;
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    };

    today.sort(byDateThenName);
    planned.sort(byDateThenName);
    completed.sort((a, b) => {
      const ad = getGameSessionDate(a).getTime();
      const bd = getGameSessionDate(b).getTime();
      if (ad !== bd) return bd - ad;
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });

    return {
      todayGames: today,
      plannedGames: planned,
      completedGames: completed,
      templateList: games.filter(g => g && g.isGameTemplate)
    };
  }, [games]);

  const visibleGames = statusTab === 'TODAY' ? todayGames : statusTab === 'PLANNED' ? plannedGames : completedGames;

  const handleCreate = () => {
    if (newName.trim()) {
      onCreateGame(newName);
      setNewName('');
      setView('LIST');
      setStatusTab('TODAY');
    }
  };

  const primaryActionForGame = (gameId: string) => {
    console.log('[GameManager] primaryActionForGame called:', { gameId, mode, hasOnEditGame: !!onEditGame });

    // INSTRUCTOR mode should only select game, not enter EDIT mode
    if (mode === GameMode.INSTRUCTOR) {
      console.log('[GameManager] INSTRUCTOR mode: selecting game');
      onSelectGame(gameId);
      onClose();
      return;
    }

    // For EDITOR mode: call onEditGame if available to ensure mode is set to EDIT
    // This guarantees game editor opens in EDIT mode, not PLAY
    if (onEditGame) {
      console.log('[GameManager] EDIT/ADMIN mode: calling onEditGame');
      onEditGame(gameId);
      // Close the modal after opening the game
      onClose();
    } else {
      // Fallback: select game and let parent handle mode change
      console.log('[GameManager] Fallback: calling onSelectGame');
      onSelectGame(gameId);
      onClose();
    }
  };

  // Handle Game ID and Name search
  const handleGameIdSearch = (value: string) => {
    setGameIdSearch(value);

    if (value.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    // Search through all games (not just templates) by display ID AND name
    const searchTerm = value.toLowerCase();
    const results = games.filter(g => {
      if (!g || g.isGameTemplate) return false;
      const displayId = getGameDisplayId(g.id);
      const gameName = (g.name || '').toLowerCase();
      return displayId.includes(value) || gameName.includes(searchTerm);
    });

    setSearchResults(results);
  };

  // Handle pressing Enter on search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, gameId?: string) => {
    if (e.key === 'Enter' && gameId) {
      primaryActionForGame(gameId);
      setGameIdSearch('');
      setSearchResults([]);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <Settings className="w-5 h-5" /> Game Manager
          </h2>
          <div className="flex items-center gap-2">
            {onOpenWizard && (
              <button
                onClick={onOpenWizard}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-lg"
              >
                <Wand2 className="w-4 h-4" />
                Quick Create
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4">
          {/* Game ID and Name Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search Game ID (e.g. 001, 123) or Name..."
              value={gameIdSearch}
              onChange={(e) => handleGameIdSearch(e.target.value)}
              onKeyDown={(e) => searchResults.length > 0 && handleSearchKeyDown(e, searchResults[0].id)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-orange-500 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {searchResults.slice(0, 5).map((game) => (
                  <button
                    key={game.id}
                    onClick={() => {
                      primaryActionForGame(game.id);
                      setGameIdSearch('');
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/30 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-orange-600 dark:text-orange-400 font-black">[{getGameDisplayId(game.id)}]</span>
                      <span className="text-gray-800 dark:text-white font-semibold">{game.name}</span>
                      {game.identificator && (
                        <span className="text-blue-600 dark:text-blue-400 font-black">({game.identificator})</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Primary Tabs: GAMES vs TEMPLATES */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
            <button
              onClick={() => {
                setSection('GAMES');
                setView('LIST');
                setStatusTab('TODAY');
              }}
              className={`px-3 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wide transition-all border-b-2 ${
                section === 'GAMES'
                  ? 'text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              📋 Games
            </button>
            <button
              onClick={() => setSection('TEMPLATES')}
              className={`px-3 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wide transition-all border-b-2 ${
                section === 'TEMPLATES'
                  ? 'text-purple-600 border-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400'
                  : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              ⭐ Templates
            </button>
          </div>

          {/* Secondary Options: MY GAMES vs CREATE NEW (only for GAMES section) */}
          {section === 'GAMES' && (
            <div className="flex gap-2">
              <button
                onClick={() => setView('LIST')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  view === 'LIST'
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                My Games
              </button>
              <button
                onClick={() => {
                  if (onOpenGameCreator) {
                    onOpenGameCreator();
                  } else {
                    setView('CREATE');
                  }
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  view === 'CREATE'
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Create New
              </button>
            </div>
          )}

          {/* Status Filters: TODAY, PLANNED, COMPLETED (only for MY GAMES view) */}
          {section === 'GAMES' && view === 'LIST' && (
            <div className="flex gap-2">
              <button
                onClick={() => setStatusTab('TODAY')}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  statusTab === 'TODAY'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Today <span className="ml-1 text-[10px] opacity-70">({todayGames.length})</span>
              </button>
              <button
                onClick={() => setStatusTab('PLANNED')}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  statusTab === 'PLANNED'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Planned <span className="ml-1 text-[10px] opacity-70">({plannedGames.length})</span>
              </button>
              <button
                onClick={() => setStatusTab('COMPLETED')}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  statusTab === 'COMPLETED'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Completed <span className="ml-1 text-[10px] opacity-70">({completedGames.length})</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-4 overflow-y-auto space-y-3 bg-white dark:bg-gray-900 flex-1">
          {section === 'GAMES' ? (
            view === 'LIST' ? (
              <div className="space-y-3">
                {visibleGames.length === 0 && (
                  <div className="text-center text-gray-500 py-10 uppercase tracking-wide text-xs font-bold">
                    No games found in this section.
                  </div>
                )}

                {visibleGames.filter(g => g).map(game => (
                  <GameSummaryCard
                    key={game.id}
                    game={game}
                    isActive={game.id === activeGameId}
                    onPrimaryAction={() => primaryActionForGame(game.id)}
                    onShowAccessCode={() => setAccessCodeGame(game)}
                    onOpenAccessSettings={onOpenAccessSettings ? () => {
                      onOpenAccessSettings(game.id);
                    } : undefined}
                    onSettings={() => {
                      if (onEditGameSetup) {
                        onEditGameSetup(game.id);
                      } else {
                        onSelectGame(game.id);
                        if (onEditGame) onEditGame(game.id);
                      }
                    }}
                    onDelete={() => {
                      setConfirmModal({ isOpen: true, gameId: game.id, isTemplate: false });
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-md mx-auto py-10">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Game Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. City Scavenger Hunt"
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold uppercase tracking-wide hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  Create Game
                </button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {templateList.length === 0 && (
                <div className="text-center text-gray-500 py-10 uppercase tracking-wide text-xs font-bold">
                  No templates found. Use "Save as Game Template" inside the editor.
                </div>
              )}

              {templateList.map(template => (
                <div
                  key={template.id}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex justify-between items-center transition-all ${
                    template.id === activeGameId
                      ? 'border-purple-500 ring-1 ring-purple-500'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                >
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white uppercase">
                      <span className="text-purple-600 dark:text-purple-400 font-black">[{getGameDisplayId(template.id)}]</span> {template.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {new Date(template.createdAt).toLocaleDateString()} • {template.points.length} Tasks
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => primaryActionForGame(template.id)}
                      className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      title="Edit Template"
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onCreateFromTemplate && onCreateFromTemplate(template.id)}
                      disabled={!onCreateFromTemplate}
                      className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
                      title="Create Game From Template"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setConfirmModal({ isOpen: true, gameId: template.id, isTemplate: true });
                      }}
                      className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Access Code / QR Popup */}
      {accessCodeGame && (
        <AccessCodePopup
          game={accessCodeGame}
          onClose={() => setAccessCodeGame(null)}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.isTemplate ? 'Delete Template?' : 'Delete Game?'}
        message={`Are you sure you want to delete this ${confirmModal.isTemplate ? 'template' : 'game'}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        icon="warning"
        onConfirm={() => {
          if (confirmModal.gameId) {
            onDeleteGame(confirmModal.gameId);
            setConfirmModal({ isOpen: false });
          }
        }}
        onCancel={() => {
          setConfirmModal({ isOpen: false });
        }}
      />
    </div>
  );
};

export default GameManager;
