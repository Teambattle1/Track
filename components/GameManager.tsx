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
  LayoutTemplate
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
  if (game.state === 'ended') return true;

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

const GameSummaryCard: React.FC<{
  game?: Game | null;
  isActive: boolean;
  onPrimaryAction: () => void;
  onDelete: () => void;
  onSettings?: () => void;
}> = ({ game, isActive, onPrimaryAction, onDelete, onSettings }) => {
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
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-800 dark:text-white uppercase truncate">
              <span className="text-orange-600 dark:text-orange-400 font-black">[{getGameDisplayId(game.id)}]</span> {game.name || 'Unnamed Game'}
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
  onEditGameSetup
}) => {
  const [section, setSection] = useState<'GAMES' | 'TEMPLATES'>('GAMES');
  const [view, setView] = useState<'LIST' | 'CREATE'>('LIST');
  const [statusTab, setStatusTab] = useState<GameStatusTab>('TODAY');
  const [newName, setNewName] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; gameId?: string; isTemplate?: boolean }>({ isOpen: false });

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
    if (onEditGame) onEditGame(gameId);
    else onSelectGame(gameId);
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <Settings className="w-5 h-5" /> Game Manager
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4">
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
                Today
              </button>
              <button
                onClick={() => setStatusTab('PLANNED')}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  statusTab === 'PLANNED'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Planned
              </button>
              <button
                onClick={() => setStatusTab('COMPLETED')}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  statusTab === 'COMPLETED'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Completed
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
                    onSettings={() => {
                      onSelectGame(game.id);
                      if (onEditGameSetup) {
                        onEditGameSetup(game.id);
                      } else if (onEditGame) {
                        onEditGame(game.id);
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
