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
}

type GameStatusTab = 'TODAY' | 'PLANNED' | 'COMPLETED';

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const getGameSessionDate = (game: Game) => {
  if (game.client?.playingDate) {
    const d = new Date(game.client.playingDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(game.createdAt);
};

const isGameCompleted = (game: Game) => {
  if (game.state === 'ended') return true;

  const points = game.points || [];
  const playablePoints = points.filter(p => !p.isSectionHeader);
  if (playablePoints.length === 0) return false;

  return playablePoints.every(p => !!p.isCompleted);
};

const getGameStatusTab = (game: Game, now: Date): GameStatusTab => {
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
  game: Game;
  isActive: boolean;
  onPrimaryAction: () => void;
  onDelete: () => void;
}> = ({ game, isActive, onPrimaryAction, onDelete }) => {
  const sessionDate = getGameSessionDate(game);

  const mapTaskCount = (game.points || []).filter(p => !p.playgroundId && !p.isSectionHeader).length;
  const zoneCount = (game.playgrounds || []).length;

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

        <div className="min-w-0">
          <h3 className="font-bold text-gray-800 dark:text-white uppercase truncate">{game.name}</h3>
          <p className="text-xs text-gray-500 truncate">
            {sessionDate.toLocaleDateString()} • {game.points.length} Tasks • {mapTaskCount} On map • {zoneCount} Zones
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
  onCreateFromTemplate
}) => {
  const [section, setSection] = useState<'GAMES' | 'TEMPLATES'>('GAMES');
  const [view, setView] = useState<'LIST' | 'CREATE'>('LIST');
  const [statusTab, setStatusTab] = useState<GameStatusTab>('TODAY');
  const [newName, setNewName] = useState('');

  const { todayGames, plannedGames, completedGames, templateList } = useMemo(() => {
    const now = new Date();
    const today: Game[] = [];
    const planned: Game[] = [];
    const completed: Game[] = [];

    const nonTemplates = games.filter(g => !g.isGameTemplate);

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
      return a.name.localeCompare(b.name);
    };

    today.sort(byDateThenName);
    planned.sort(byDateThenName);
    completed.sort((a, b) => {
      const ad = getGameSessionDate(a).getTime();
      const bd = getGameSessionDate(b).getTime();
      if (ad !== bd) return bd - ad;
      return a.name.localeCompare(b.name);
    });

    return {
      todayGames: today,
      plannedGames: planned,
      completedGames: completed,
      templateList: games.filter(g => g.isGameTemplate)
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

        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setSection('GAMES')}
              className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${
                section === 'GAMES'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Games
            </button>
            <button
              onClick={() => setSection('TEMPLATES')}
              className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${
                section === 'TEMPLATES'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Game Templates
            </button>
          </div>

          {section === 'GAMES' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setView('LIST')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${
                    view === 'LIST'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  My Games
                </button>
                <button
                  onClick={() => setView('CREATE')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${
                    view === 'CREATE'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  Create New
                </button>
              </div>

              {view === 'LIST' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatusTab('TODAY')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${
                      statusTab === 'TODAY'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setStatusTab('PLANNED')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${
                      statusTab === 'PLANNED'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    Planned
                  </button>
                  <button
                    onClick={() => setStatusTab('COMPLETED')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${
                      statusTab === 'COMPLETED'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              )}
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

                {visibleGames.map(game => (
                  <GameSummaryCard
                    key={game.id}
                    game={game}
                    isActive={game.id === activeGameId}
                    onPrimaryAction={() => primaryActionForGame(game.id)}
                    onDelete={() => {
                      if (confirm('Delete game?')) onDeleteGame(game.id);
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
                    <h3 className="font-bold text-gray-800 dark:text-white uppercase">{template.name}</h3>
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
                        if (confirm('Delete template?')) onDeleteGame(template.id);
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
    </div>
  );
};

export default GameManager;
