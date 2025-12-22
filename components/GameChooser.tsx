
import React, { useState, useMemo } from 'react';
import { Game, TaskList } from '../types';
import { X, Calendar, CheckCircle, Play, MapPin, ChevronRight, Trophy, LayoutTemplate, Gamepad2, Save, RefreshCw, Home, Plus, Zap, Clock, AlertTriangle, Search, Filter, MoreHorizontal, Settings } from 'lucide-react';

interface GameChooserProps {
  games: Game[];
  taskLists: TaskList[];
  onSelectGame: (id: string) => void;
  onCreateGame: (name: string, fromTaskListId?: string) => void;
  onClose: () => void;
  onSaveAsTemplate?: (gameId: string, name: string) => void;
  onRefresh?: () => void;
  onOpenGameCreator?: () => void;
  onEditGame?: (id: string) => void; // New prop for editing details
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
  onRefresh,
  onOpenGameCreator,
  onEditGame
}) => {
  const [mainView, setMainView] = useState<MainView>('GAMES');
  const [sessionTab, setSessionTab] = useState<SessionTab>('TODAY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Input Modal State
  const [inputModal, setInputModal] = useState<{
      isOpen: boolean;
      title: string;
      defaultValue: string;
      onConfirm: (val: string) => void;
  } | null>(null);
  const [inputValue, setInputValue] = useState('');

  const openInputModal = (title: string, defaultValue: string, onConfirm: (val: string) => void) => {
      setInputValue(defaultValue);
      setInputModal({ isOpen: true, title, defaultValue, onConfirm });
  };

  const filteredGames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let result = games;

    // Search filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(g => g.name.toLowerCase().includes(q));
    }

    const checkCompletion = (game: Game) => {
        if (!game.points || game.points.length === 0) return false;
        return game.points.every(p => p.isCompleted);
    };

    return result.filter(g => {
        // Use client playing date if available, else createdAt
        const dateStr = g.client?.playingDate || g.createdAt;
        const gDate = new Date(dateStr);
        gDate.setHours(0, 0, 0, 0);
        
        const isFinished = checkCompletion(g);
        const isOverdue = gDate.getTime() < today.getTime();
        const isToday = gDate.getTime() === today.getTime();
        const isFuture = gDate.getTime() > today.getTime();

        if (sessionTab === 'COMPLETED') {
            // Show if finished OR overdue (past date)
            return isFinished || isOverdue;
        }
        
        // For TODAY and PLANNED, exclude finished or overdue games
        if (isFinished || isOverdue) return false;

        if (sessionTab === 'TODAY') return isToday;
        if (sessionTab === 'PLANNED') return isFuture;
        
        return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [games, sessionTab, searchQuery]);

  const handleCreateFromTemplate = (list: TaskList) => {
      openInputModal(
          `Name for new game based on "${list.name}"`,
          list.name,
          (name) => onCreateGame(name, list.id)
      );
  };

  const handleCreateBlankGame = () => {
      if (onOpenGameCreator) {
          onOpenGameCreator();
      } else {
          openInputModal(
              "Name for new empty game",
              "New Game",
              (name) => onCreateGame(name)
          );
      }
  };

  const handleSaveTemplateClick = (e: React.MouseEvent, game: Game) => {
      e.stopPropagation();
      if (!onSaveAsTemplate) return;
      openInputModal(
          "Enter a name for this new template",
          `${game.name} Template`,
          (name) => onSaveAsTemplate(game.id, name)
      );
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950 text-white flex flex-col font-sans overflow-hidden animate-in fade-in duration-300">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)] opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Header */}
      <div className="p-6 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center shrink-0 shadow-xl z-20 gap-4">
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
                  <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <div>
                  <h2 className="text-2xl font-black tracking-tight uppercase leading-none">GAME SESSIONS</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">SELECT OR CREATE A MISSION</p>
              </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="SEARCH GAMES..." 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-orange-500 transition-all uppercase placeholder-slate-600"
                  />
              </div>
              
              <div className="flex gap-2">
                  {onRefresh && (
                      <button 
                        onClick={handleRefresh}
                        className={`p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors ${isRefreshing ? 'animate-spin text-orange-500' : ''}`}
                        title="Refresh Data"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                  )}
                  <button onClick={onClose} className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
              </div>
          </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex justify-center shrink-0 z-10">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                  onClick={() => setMainView('GAMES')}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${mainView === 'GAMES' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                  <Gamepad2 className="w-4 h-4" /> GAMES
              </button>
              <button
                  onClick={() => setMainView('TEMPLATES')}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${mainView === 'TEMPLATES' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                  <LayoutTemplate className="w-4 h-4" /> TEMPLATES
              </button>
          </div>
      </div>

      {/* Sub Tabs (Games Only) */}
      {mainView === 'GAMES' && (
          <div className="bg-slate-900/50 border-b border-slate-800 px-6 flex justify-center shrink-0 z-10 backdrop-blur-sm">
              <div className="flex gap-8">
                  {[
                      { id: 'TODAY', label: 'TODAY', icon: Clock, color: 'text-orange-500' },
                      { id: 'PLANNED', label: 'PLANNED', icon: Calendar, color: 'text-amber-500' },
                      { id: 'COMPLETED', label: 'COMPLETED', icon: CheckCircle, color: 'text-green-500' }
                  ].map(tab => (
                      <button
                          key={tab.id}
                          onClick={() => setSessionTab(tab.id as SessionTab)}
                          className={`py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${sessionTab === tab.id ? `border-current ${tab.color} scale-105` : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                      >
                          <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                      </button>
                  ))}
              </div>
          </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative z-0">
          <div className="max-w-[1920px] mx-auto">
              
              {mainView === 'GAMES' && (
                  <>
                      {/* Create New Card */}
                      {sessionTab !== 'COMPLETED' && (
                          <div className="mb-8">
                              <button 
                                  onClick={handleCreateBlankGame}
                                  className="w-full py-4 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center gap-3 text-slate-500 hover:text-orange-500 hover:border-orange-500 hover:bg-orange-500/5 transition-all group"
                              >
                                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 group-hover:border-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                      <Plus className="w-5 h-5" />
                                  </div>
                                  <span className="font-black uppercase tracking-widest text-sm">CREATE NEW GAME SESSION</span>
                              </button>
                          </div>
                      )}

                      {filteredGames.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                              <Gamepad2 className="w-16 h-16 mb-4 opacity-20" />
                              <p className="font-black uppercase tracking-[0.2em] text-sm">NO {sessionTab} GAMES FOUND</p>
                          </div>
                      ) : (
                          // UPDATED GRID: 5 COLUMNS ON XL
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                              {filteredGames.map(game => {
                                  const completedCount = game.points.filter(p => p.isCompleted).length;
                                  const totalCount = game.points.filter(p => !p.isSectionHeader).length;
                                  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                                  const gameDate = game.client?.playingDate ? new Date(game.client.playingDate) : new Date(game.createdAt);

                                  return (
                                      <div 
                                          key={game.id}
                                          onClick={() => onSelectGame(game.id)}
                                          className="group bg-slate-900 border border-slate-800 hover:border-orange-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-orange-500/10 transition-all cursor-pointer flex flex-col relative"
                                      >
                                          {/* Banner */}
                                          <div className="h-32 bg-slate-800 relative overflow-hidden">
                                              {game.client?.logoUrl ? (
                                                  <div className="absolute inset-0 p-6 flex items-center justify-center bg-white">
                                                      <img src={game.client.logoUrl} className="max-w-full max-h-full object-contain" alt="Client Logo" />
                                                  </div>
                                              ) : (
                                                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                                              )}
                                              
                                              {/* Date Badge */}
                                              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                                                  <Calendar className="w-3 h-3 text-orange-500" />
                                                  {gameDate.toLocaleDateString()}
                                              </div>

                                              {/* Actions Menu */}
                                              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  {onSaveAsTemplate && (
                                                      <button 
                                                          onClick={(e) => handleSaveTemplateClick(e, game)}
                                                          className="p-1.5 bg-black/60 hover:bg-orange-600 rounded-lg text-white transition-colors border border-white/10"
                                                          title="Save as Template"
                                                      >
                                                          <Save className="w-3.5 h-3.5" />
                                                      </button>
                                                  )}
                                              </div>
                                          </div>

                                          {/* Content */}
                                          <div className="p-5 flex flex-col flex-1">
                                              <div className="mb-4">
                                                  <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight mb-1 truncate">{game.name}</h3>
                                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">
                                                      {game.client?.name || "INTERNAL SESSION"}
                                                  </p>
                                              </div>

                                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {totalCount} TASKS</span>
                                                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-orange-500" /> {progress}%</span>
                                              </div>

                                              {/* Progress Bar */}
                                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                                                  <div 
                                                      className="h-full bg-gradient-to-r from-orange-600 to-red-600 transition-all duration-500" 
                                                      style={{ width: `${Math.max(5, progress)}%` }}
                                                  />
                                              </div>

                                              <div className="mt-auto">
                                                  <button 
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (onEditGame) onEditGame(game.id);
                                                      }}
                                                      className="w-full py-3 bg-slate-800 group-hover:bg-white group-hover:text-black text-white font-black uppercase text-xs tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2"
                                                  >
                                                      EDIT SESSION <Settings className="w-3 h-3" />
                                                  </button>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </>
              )}

              {mainView === 'TEMPLATES' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {taskLists.length === 0 ? (
                          <div className="col-span-full py-20 text-center text-slate-600 uppercase font-black tracking-widest text-sm opacity-50">NO TEMPLATES AVAILABLE</div>
                      ) : taskLists.map(list => (
                          <div 
                              key={list.id}
                              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-blue-500/50 transition-all group relative overflow-hidden"
                          >
                              <div className="flex items-start justify-between mb-6">
                                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg text-white" style={{ backgroundColor: list.color }}>
                                      <LayoutTemplate className="w-7 h-7" />
                                  </div>
                                  <div className="bg-slate-800 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      {list.tasks.length} TASKS
                                  </div>
                              </div>
                              
                              <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2 truncate">{list.name}</h3>
                              <p className="text-xs text-slate-500 line-clamp-2 mb-6 h-8">{list.description || "No description provided."}</p>
                              
                              <button 
                                  onClick={() => handleCreateFromTemplate(list)}
                                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                              >
                                  <Plus className="w-4 h-4" /> CREATE GAME
                              </button>
                          </div>
                      ))}
                  </div>
              )}

          </div>
      </div>

      {/* CUSTOM INPUT MODAL OVERLAY */}
      {inputModal && inputModal.isOpen && (
          <div className="absolute inset-0 z-[5000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl relative">
                  <button 
                      onClick={() => setInputModal(null)} 
                      className="absolute top-4 right-4 text-slate-500 hover:text-white p-2"
                  >
                      <X className="w-5 h-5" />
                  </button>
                  <h3 className="text-sm font-black text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> ACTION REQUIRED
                  </h3>
                  <h2 className="text-xl font-black text-white uppercase tracking-wide mb-6">
                      {inputModal.title}
                  </h2>
                  <input 
                      type="text" 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl p-4 text-white font-bold mb-8 outline-none focus:border-orange-500 transition-colors uppercase placeholder-slate-700 text-lg"
                      autoFocus
                      placeholder="ENTER NAME..."
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && inputValue.trim()) {
                              inputModal.onConfirm(inputValue);
                              setInputModal(null);
                          }
                      }}
                  />
                  <div className="flex gap-4">
                      <button 
                          onClick={() => setInputModal(null)}
                          className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-black uppercase tracking-wide transition-colors text-xs"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={() => {
                              if (inputValue.trim()) {
                                  inputModal.onConfirm(inputValue);
                                  setInputModal(null);
                              }
                          }}
                          disabled={!inputValue.trim()}
                          className="flex-1 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-wide transition-colors text-xs disabled:opacity-50 shadow-lg"
                      >
                          Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default GameChooser;
