import React, { useState, useMemo } from 'react';
import { Game, TaskList } from '../types';
import { X, Calendar, CheckCircle, Clock, Play, MapPin, ChevronRight, Trophy, LayoutTemplate, Gamepad2, Save, RefreshCw, Home } from 'lucide-react';

interface GameChooserProps {
  games: Game[];
  taskLists: TaskList[];
  onSelectGame: (id: string) => void;
  onCreateGame: (name: string, fromTaskListId: string) => void;
  onClose: () => void;
  onSaveAsTemplate?: (gameId: string, name: string) => void;
  onRefresh?: () => void;
}

type MainView = 'GAMES' | 'TEMPLATES';
type SessionTab = 'TODAY' | 'PLANNED' | 'COMPLETED';

const GameChooser: React.FC<GameChooserProps> = ({ 
  games, 
  taskLists,
  onSelectGame, 
  onCreateGame, 
  onClose,
  onSaveAsTemplate,
  onRefresh
}) => {
  const [mainView, setMainView] = useState<MainView>('GAMES');
  const [sessionTab, setSessionTab] = useState<SessionTab>('TODAY');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper to check dates
  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const filteredGames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkCompletion = (game: Game) => {
        if (game.points.length === 0) return false;
        return game.points.every(p => p.isCompleted);
    };

    let list = [];

    switch (sessionTab) {
      case 'TODAY':
        list = games.filter(g => {
            const gDate = new Date(g.createdAt);
            const isCompleted = checkCompletion(g);
            return isSameDay(gDate, today) && !isCompleted;
        });
        // Sort by time (earliest first)
        list.sort((a, b) => a.createdAt - b.createdAt);
        break;
      
      case 'PLANNED':
        list = games.filter(g => {
            const gDate = new Date(g.createdAt);
            const isCompleted = checkCompletion(g);
            // Future dates AND not completed
            return gDate > today && !isSameDay(gDate, today) && !isCompleted;
        });
        // Sort by date (earliest first)
        list.sort((a, b) => a.createdAt - b.createdAt);
        break;

      case 'COMPLETED':
        list = games.filter(g => checkCompletion(g));
        // Sort by date (newest first)
        list.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    return list;
  }, [games, sessionTab]);

  const handleCreateFromTemplate = (list: TaskList) => {
      const name = prompt(`Name for new game based on "${list.name}":`, list.name);
      if (name) {
          onCreateGame(name, list.id);
      }
  };

  const handleSaveTemplateClick = (e: React.MouseEvent, game: Game) => {
      e.stopPropagation();
      if (!onSaveAsTemplate) return;
      const name = prompt("Enter a name for this new template:", `${game.name} Template`);
      if (name) {
          onSaveAsTemplate(game.id, name);
      }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500); // Visual feedback
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 bg-gray-900 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-full hover:bg-slate-700 text-white transition-colors">
                  <Home className="w-4 h-4" />
              </button>
              <div>
                  <h2 className="text-xl font-black tracking-tight">My Games</h2>
                  <p className="text-gray-400 text-sm">Resume playing or start new</p>
              </div>
          </div>
          <div className="flex items-center gap-1">
              {onRefresh && (
                  <button 
                    onClick={handleRefresh}
                    className={`p-2 hover:bg-white/20 rounded-full transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                    title="Refresh Data"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
          </div>
        </div>

        {/* Main Toggles */}
        <div className="flex p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button
                onClick={() => setMainView('GAMES')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${mainView === 'GAMES' ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
                <Gamepad2 className="w-4 h-4" /> GAMES
            </button>
            <button
                onClick={() => setMainView('TEMPLATES')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${mainView === 'TEMPLATES' ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
                <LayoutTemplate className="w-4 h-4" /> TEMPLATES
            </button>
        </div>

        {/* GAMES VIEW: Session Tabs */}
        {mainView === 'GAMES' && (
            <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                <button 
                    onClick={() => setSessionTab('TODAY')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all relative ${sessionTab === 'TODAY' ? 'text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                    <Clock className="w-3 h-3" /> Today
                    {sessionTab === 'TODAY' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
                </button>
                <button 
                    onClick={() => setSessionTab('PLANNED')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all relative ${sessionTab === 'PLANNED' ? 'text-amber-600 dark:text-amber-400 bg-white dark:bg-gray-800' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                    <Calendar className="w-3 h-3" /> Planned
                    {sessionTab === 'PLANNED' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />}
                </button>
                <button 
                    onClick={() => setSessionTab('COMPLETED')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all relative ${sessionTab === 'COMPLETED' ? 'text-green-600 dark:text-green-400 bg-white dark:bg-gray-800' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                    <CheckCircle className="w-3 h-3" /> Done
                    {sessionTab === 'COMPLETED' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />}
                </button>
            </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            
            {/* --- GAMES LIST --- */}
            {mainView === 'GAMES' && (
                <>
                    {filteredGames.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-3">
                                {sessionTab === 'TODAY' ? <Clock className="w-8 h-8" /> : 
                                sessionTab === 'PLANNED' ? <Calendar className="w-8 h-8" /> : 
                                <Trophy className="w-8 h-8" />}
                            </div>
                            <p className="font-medium text-sm">No games found for {sessionTab.toLowerCase()}.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredGames.map(game => {
                                const taskCount = game.points.length;
                                const date = new Date(game.createdAt);
                                const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                                const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                                return (
                                    <div 
                                        key={game.id}
                                        onClick={() => onSelectGame(game.id)}
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 hover:scale-[1.02] transition-all flex items-center justify-between group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                                                sessionTab === 'COMPLETED' 
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                : 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                            }`}>
                                                {game.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors truncate">{game.name}</h3>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateStr}</span>
                                                    {sessionTab === 'TODAY' && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeStr}</span>}
                                                    <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded"><MapPin className="w-3 h-3" /> {taskCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {onSaveAsTemplate && (
                                                <button 
                                                    onClick={(e) => handleSaveTemplateClick(e, game)}
                                                    className="p-2 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Save as Template"
                                                >
                                                    <Save className="w-4 h-4" />
                                                </button>
                                            )}
                                            <div className="text-gray-300 dark:text-gray-600 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors">
                                                {sessionTab === 'COMPLETED' ? <Trophy className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* --- TEMPLATES LIST --- */}
            {mainView === 'TEMPLATES' && (
                <>
                    {taskLists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-3">
                                <LayoutTemplate className="w-8 h-8" />
                            </div>
                            <p className="font-medium text-sm">No templates available.</p>
                            <p className="text-xs mt-1">Create one in the Library Editor.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Start a new game</p>
                            {taskLists.map(list => (
                                <button 
                                    key={list.id}
                                    onClick={() => handleCreateFromTemplate(list)}
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 hover:scale-[1.02] transition-all flex items-center justify-between group text-left relative overflow-hidden"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: list.color }}></div>
                                    <div className="flex items-center gap-4 pl-2">
                                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-500 dark:text-gray-400">
                                            {list.tasks.length}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{list.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{list.description || "No description"}</p>
                                        </div>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <Play className="w-4 h-4 fill-current" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-400">
             {mainView === 'GAMES' ? `Showing ${filteredGames.length} games` : `Showing ${taskLists.length} templates`}
        </div>

      </div>
    </div>
  );
};

export default GameChooser;