
import React, { useState, useMemo, useRef } from 'react';
import { Game, TaskList, GamePoint } from '../types';
import { X, Calendar, CheckCircle, Play, MapPin, ChevronRight, Trophy, LayoutTemplate, Gamepad2, Save, RefreshCw, Home, Plus, Zap, Clock, AlertTriangle, Search, Filter, MoreHorizontal, Settings, Edit2, LayoutList, Trash2, Check, Upload, Image as ImageIcon, LayoutGrid, Layers, Grid, List as ListIcon } from 'lucide-react';

interface GameChooserProps {
  games: Game[];
  taskLists: TaskList[];
  onSelectGame: (id: string) => void;
  onCreateGame: (name: string, fromTaskListId?: string) => void;
  onClose: () => void;
  onSaveAsTemplate?: (gameId: string, name: string) => void;
  onRefresh?: () => void;
  onOpenGameCreator?: () => void;
  onEditGame?: (id: string) => void; 
  onEditTemplate?: (id: string) => void; 
  onUpdateList?: (list: TaskList) => Promise<void>; 
  onDeleteList?: (id: string) => Promise<void>; 
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
  onEditGame,
  onEditTemplate,
  onUpdateList,
  onDeleteList
}) => {
  const [mainView, setMainView] = useState<MainView>('GAMES');
  const [sessionTab, setSessionTab] = useState<SessionTab>('TODAY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  
  // Template Editing State
  const [editingTemplate, setEditingTemplate] = useState<TaskList | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', imageUrl: '' });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(g => g.name.toLowerCase().includes(q));
    }

    const checkCompletion = (game: Game) => {
        if (!game.points || game.points.length === 0) return false;
        return game.points.every(p => p.isCompleted);
    };

    return result.filter(g => {
        const dateStr = g.client?.playingDate || g.createdAt;
        const gDate = new Date(dateStr);
        gDate.setHours(0, 0, 0, 0);
        
        const isFinished = checkCompletion(g);
        const isOverdue = gDate.getTime() < today.getTime();
        const isToday = gDate.getTime() === today.getTime();
        const isFuture = gDate.getTime() > today.getTime();

        if (sessionTab === 'COMPLETED') return isFinished || isOverdue;
        if (isFinished || isOverdue) return false;
        if (sessionTab === 'TODAY') return isToday;
        if (sessionTab === 'PLANNED') return isFuture;
        
        return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [games, sessionTab, searchQuery]);

  const filteredTemplates = useMemo(() => {
      let result = taskLists;
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(t => t.name.toLowerCase().includes(q));
      }
      return result;
  }, [taskLists, searchQuery]);

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

  // --- TEMPLATE EDITING LOGIC ---
  const openTemplateDetails = (list: TaskList) => {
      setEditingTemplate(list);
      setTemplateForm({
          name: list.name,
          description: list.description,
          imageUrl: list.imageUrl || ''
      });
      setIsDeleteConfirming(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setTemplateForm(prev => ({ ...prev, imageUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const saveTemplateChanges = async () => {
      if (!editingTemplate || !onUpdateList) return;
      setIsSavingTemplate(true);
      
      const updatedList: TaskList = {
          ...editingTemplate,
          name: templateForm.name,
          description: templateForm.description,
          imageUrl: templateForm.imageUrl
      };

      await onUpdateList(updatedList);
      setIsSavingTemplate(false);
      setEditingTemplate(null); 
  };

  const performDeleteTemplate = async () => {
      if (!editingTemplate || !onDeleteList) return;
      await onDeleteList(editingTemplate.id);
      setEditingTemplate(null);
      setIsDeleteConfirming(false);
  };

  // Helper to calculate zone stats
  const getTemplateStats = (list: TaskList) => {
      const tasks = list.tasks as unknown as GamePoint[]; // Cast to access playgroundId
      const playgroundCounts: Record<string, number> = {};
      let unlistedCount = 0;

      tasks.forEach(t => {
          if (t.playgroundId) {
              playgroundCounts[t.playgroundId] = (playgroundCounts[t.playgroundId] || 0) + 1;
          } else {
              unlistedCount++;
          }
      });

      return { playgroundCounts, unlistedCount, total: tasks.length };
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950 text-white flex flex-col font-sans overflow-hidden animate-in fade-in duration-300">
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
                      placeholder={mainView === 'GAMES' ? "SEARCH GAMES..." : "SEARCH TEMPLATES..."} 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-orange-500 transition-all uppercase placeholder-slate-600 focus:ring-1 focus:ring-orange-500/50"
                  />
              </div>

              {/* View Toggle */}
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                      <Grid className="w-4 h-4" />
                  </button>
                  <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                      <ListIcon className="w-4 h-4" />
                  </button>
              </div>
              
              <div className="flex gap-2">
                  {onRefresh && (
                      <button 
                        onClick={handleRefresh}
                        className={`p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors hover:scale-105 active:scale-95 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`}
                        title="Refresh Data"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                  )}
                  <button onClick={onClose} className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors hover:scale-105 active:scale-95">
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
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${mainView === 'GAMES' ? 'bg-orange-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
              >
                  <Gamepad2 className="w-4 h-4" /> GAMES
              </button>
              <button
                  onClick={() => setMainView('TEMPLATES')}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${mainView === 'TEMPLATES' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
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
                          className={`py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all hover:text-white ${sessionTab === tab.id ? `border-current ${tab.color} scale-105` : 'border-transparent text-slate-500'}`}
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
                      {sessionTab !== 'COMPLETED' && (
                          <div className="mb-8">
                              <button 
                                  onClick={handleCreateBlankGame}
                                  className="w-full py-4 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center gap-3 text-slate-500 hover:text-orange-500 hover:border-orange-500 hover:bg-orange-500/5 transition-all group hover:scale-[1.01]"
                              >
                                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 group-hover:border-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all group-hover:scale-110">
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
                          <div className={viewMode === 'GRID' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" : "space-y-3"}>
                              {filteredGames.map(game => {
                                  const completedCount = game.points.filter(p => p.isCompleted).length;
                                  const totalCount = game.points.filter(p => !p.isSectionHeader).length;
                                  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                                  const gameDate = game.client?.playingDate ? new Date(game.client.playingDate) : new Date(game.createdAt);

                                  if (viewMode === 'LIST') {
                                      // LIST VIEW ROW
                                      return (
                                          <div 
                                              key={game.id}
                                              onClick={() => onSelectGame(game.id)}
                                              className="group flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-orange-500/50 p-3 rounded-2xl cursor-pointer transition-all shadow-sm hover:shadow-orange-500/10 hover:translate-x-1"
                                          >
                                              <div className="w-16 h-16 bg-slate-800 rounded-xl overflow-hidden relative shrink-0 border border-slate-700 group-hover:border-orange-500/30 transition-colors">
                                                  {game.client?.logoUrl ? (
                                                      <img src={game.client.logoUrl} className="w-full h-full object-contain p-2 bg-white" alt="Logo" />
                                                  ) : (
                                                      <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40"><Gamepad2 className="w-6 h-6"/></div>
                                                  )}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                  <h3 className="font-black text-white text-sm uppercase truncate group-hover:text-orange-500 transition-colors">{game.name}</h3>
                                                  <div className="flex items-center gap-3 mt-1">
                                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{game.client?.name || "INTERNAL"}</span>
                                                      <span className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1"><Calendar className="w-3 h-3" /> {gameDate.toLocaleDateString()}</span>
                                                  </div>
                                              </div>
                                              <div className="hidden sm:block w-32 mr-4">
                                                  <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-1">
                                                      <span>PROGRESS</span>
                                                      <span className="text-orange-500">{progress}%</span>
                                                  </div>
                                                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                      <div className="h-full bg-gradient-to-r from-orange-600 to-red-600" style={{ width: `${Math.max(5, progress)}%` }} />
                                                  </div>
                                              </div>
                                              <button className="p-3 bg-slate-800 group-hover:bg-white group-hover:text-black text-slate-400 rounded-xl transition-all hover:scale-110">
                                                  <Play className="w-4 h-4 fill-current" />
                                              </button>
                                          </div>
                                      );
                                  }

                                  // GRID VIEW CARD
                                  return (
                                      <div 
                                          key={game.id}
                                          onClick={() => onSelectGame(game.id)}
                                          className="group bg-slate-900 border border-slate-800 hover:border-orange-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-orange-500/20 transition-all cursor-pointer flex flex-col relative hover:-translate-y-2"
                                      >
                                          <div className="h-32 bg-slate-800 relative overflow-hidden group-hover:brightness-110 transition-all">
                                              {game.client?.logoUrl ? (
                                                  <div className="absolute inset-0 p-6 flex items-center justify-center bg-white">
                                                      <img src={game.client.logoUrl} className="max-w-full max-h-full object-contain" alt="Client Logo" />
                                                  </div>
                                              ) : (
                                                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 group-hover:opacity-20 transition-opacity" />
                                              )}
                                              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 shadow-md">
                                                  <Calendar className="w-3 h-3 text-orange-500" />
                                                  {gameDate.toLocaleDateString()}
                                              </div>
                                              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300">
                                                  {onSaveAsTemplate && (
                                                      <button 
                                                          onClick={(e) => handleSaveTemplateClick(e, game)}
                                                          className="p-1.5 bg-black/60 hover:bg-orange-600 rounded-lg text-white transition-colors border border-white/10 hover:scale-110"
                                                          title="Save as Template"
                                                      >
                                                          <Save className="w-3.5 h-3.5" />
                                                      </button>
                                                  )}
                                              </div>
                                          </div>

                                          <div className="p-5 flex flex-col flex-1">
                                              <div className="mb-4">
                                                  <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight mb-1 truncate group-hover:text-orange-500 transition-colors">{game.name}</h3>
                                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">
                                                      {game.client?.name || "INTERNAL SESSION"}
                                                  </p>
                                              </div>

                                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {totalCount} TASKS</span>
                                                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-orange-500" /> {progress}%</span>
                                              </div>

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
                                                      className="w-full py-3 bg-slate-800 group-hover:bg-white group-hover:text-black text-white font-black uppercase text-xs tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg"
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
                  <div className={viewMode === 'GRID' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" : "space-y-3"}>
                      {filteredTemplates.length === 0 ? (
                          <div className="col-span-full py-20 text-center text-slate-600 uppercase font-black tracking-widest text-sm opacity-50">NO TEMPLATES FOUND</div>
                      ) : filteredTemplates.map(list => {
                          const { playgroundCounts, unlistedCount } = getTemplateStats(list);
                          const playzones = Object.keys(playgroundCounts).length;

                          if (viewMode === 'LIST') {
                              return (
                                  <div 
                                      key={list.id} 
                                      onClick={() => openTemplateDetails(list)}
                                      className="group flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-3 rounded-2xl cursor-pointer transition-all shadow-sm hover:shadow-blue-500/10 hover:translate-x-1"
                                  >
                                      <div className="w-16 h-16 bg-slate-800 rounded-xl overflow-hidden relative shrink-0 border border-slate-700 group-hover:border-blue-500/30">
                                          {list.imageUrl ? (
                                              <img src={list.imageUrl} className="w-full h-full object-cover" alt="Template" />
                                          ) : (
                                              <div 
                                                  className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-50 transition-opacity" 
                                                  style={{ backgroundColor: list.color }}
                                              >
                                                  <LayoutTemplate className="w-6 h-6 text-white" />
                                              </div>
                                          )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <h3 className="font-black text-white text-sm uppercase truncate group-hover:text-blue-500 transition-colors">{list.name}</h3>
                                          <p className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-xs">{list.description || "No description"}</p>
                                      </div>
                                      <div className="hidden sm:flex items-center gap-4 mr-4">
                                          <div className="text-[10px] font-black text-slate-500 uppercase bg-slate-800 px-2 py-1 rounded">
                                              {list.tasks.length} TASKS
                                          </div>
                                          <div className="text-[10px] font-black text-slate-500 uppercase bg-slate-800 px-2 py-1 rounded">
                                              {playzones} ZONES
                                          </div>
                                      </div>
                                      <button className="p-3 bg-slate-800 group-hover:bg-white group-hover:text-black text-slate-400 rounded-xl transition-all hover:scale-110">
                                          <ChevronRight className="w-4 h-4" />
                                      </button>
                                  </div>
                              );
                          }

                          return (
                              <div 
                                  key={list.id} 
                                  onClick={() => openTemplateDetails(list)}
                                  className="group bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-blue-500/20 transition-all cursor-pointer flex flex-col relative hover:-translate-y-2"
                              >
                                  {/* Banner - Styled like Game Cards */}
                                  <div className="h-32 bg-slate-800 relative overflow-hidden">
                                      {list.imageUrl ? (
                                          <div className="absolute inset-0 bg-white group-hover:scale-105 transition-transform duration-700">
                                              <img src={list.imageUrl} className="w-full h-full object-cover" alt="Template" />
                                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                          </div>
                                      ) : (
                                          <div 
                                              className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-40 transition-opacity" 
                                              style={{ backgroundColor: list.color }}
                                          >
                                              <LayoutTemplate className="w-12 h-12 text-white" />
                                          </div>
                                      )}
                                      
                                      <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 shadow-md">
                                          <LayoutList className="w-3 h-3" /> TEMPLATE
                                      </div>
                                  </div>

                                  {/* Content - Matching Game Cards Structure */}
                                  <div className="p-5 flex flex-col flex-1">
                                      <div className="mb-4">
                                          <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight mb-1 truncate group-hover:text-blue-500 transition-colors">{list.name}</h3>
                                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">
                                              {list.description || "No description"}
                                          </p>
                                      </div>

                                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
                                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {list.tasks.length} TASKS</span>
                                          <span className="flex items-center gap-1"><LayoutGrid className="w-3 h-3 text-blue-500" /> {playzones} ZONES</span>
                                      </div>

                                      <div className="mt-auto">
                                          <button 
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  openTemplateDetails(list);
                                              }}
                                              className="w-full py-3 bg-slate-800 group-hover:bg-white group-hover:text-black text-white font-black uppercase text-xs tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 shadow-lg"
                                          >
                                              VIEW DETAILS <ChevronRight className="w-3 h-3" />
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

          </div>
      </div>

      {/* TEMPLATE DETAILS MODAL */}
      {editingTemplate && (
          <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
                      <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <LayoutTemplate className="w-6 h-6 text-blue-500" />
                          TEMPLATE DETAILS
                      </h2>
                      <button onClick={() => setEditingTemplate(null)} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors hover:scale-110">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-900 custom-scrollbar">
                      {/* Image Upload Banner */}
                      <div className="w-full h-48 bg-slate-800 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-blue-500 transition-colors" onClick={() => fileInputRef.current?.click()}>
                          {templateForm.imageUrl ? (
                              <img src={templateForm.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          ) : (
                              <div className="flex flex-col items-center text-slate-500">
                                  <ImageIcon className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest group-hover:text-white">UPLOAD COVER IMAGE</span>
                              </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Upload className="w-8 h-8 text-white scale-125" />
                          </div>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">TEMPLATE NAME</label>
                                  <input 
                                      value={templateForm.name}
                                      onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                                      className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:border-blue-500 outline-none transition-colors"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">DESCRIPTION</label>
                                  <textarea 
                                      value={templateForm.description}
                                      onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                                      className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-blue-500 outline-none transition-colors h-24 resize-none"
                                  />
                              </div>
                          </div>

                          <div className="space-y-4">
                              <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Settings className="w-3 h-3"/> STATS</h3>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <span className="text-[9px] text-slate-400 font-bold uppercase block">TOTAL TASKS</span>
                                          <span className="text-lg font-black text-white">{editingTemplate.tasks.length}</span>
                                      </div>
                                      <div>
                                          <span className="text-[9px] text-slate-400 font-bold uppercase block">PLAYZONES</span>
                                          <span className="text-lg font-black text-blue-500">
                                              {Object.keys(getTemplateStats(editingTemplate).playgroundCounts).length}
                                          </span>
                                      </div>
                                      <div>
                                          <span className="text-[9px] text-slate-400 font-bold uppercase block">TIMES PLAYED</span>
                                          <span className="text-lg font-black text-white">{editingTemplate.usageCount || 0}</span>
                                      </div>
                                      <div>
                                          <span className="text-[9px] text-slate-400 font-bold uppercase block">CREATED</span>
                                          <span className="text-xs font-bold text-slate-300 mt-1 block">{new Date(editingTemplate.createdAt).toLocaleDateString()}</span>
                                      </div>
                                  </div>
                              </div>

                              <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Layers className="w-3 h-3"/> CONTENT BREAKDOWN</h3>
                                  <div className="space-y-2">
                                      {(() => {
                                          const { playgroundCounts, unlistedCount } = getTemplateStats(editingTemplate);
                                          const zones = Object.entries(playgroundCounts);
                                          return (
                                              <>
                                                  {zones.map(([pid, count], idx) => (
                                                      <div key={pid} className="flex justify-between items-center text-xs">
                                                          <span className="font-bold text-slate-300 uppercase flex items-center gap-2">
                                                              <LayoutGrid className="w-3 h-3 text-orange-500" />
                                                              PLAYGROUND ZONE {idx + 1}
                                                          </span>
                                                          <span className="font-black text-slate-500">{count} TASKS</span>
                                                      </div>
                                                  ))}
                                                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/50 mt-1">
                                                      <span className="font-bold text-slate-400 uppercase flex items-center gap-2">
                                                          <MapPin className="w-3 h-3" />
                                                          UNLISTED / MAP TASKS
                                                      </span>
                                                      <span className="font-black text-slate-500">{unlistedCount} TASKS</span>
                                                  </div>
                                              </>
                                          );
                                      })()}
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className={`p-6 border-t border-slate-800 flex flex-col sm:flex-row gap-3 transition-colors ${isDeleteConfirming ? 'bg-red-950/30' : 'bg-slate-950'}`}>
                      {isDeleteConfirming ? (
                          <div className="flex-1 flex items-center gap-4 animate-in slide-in-from-left-4 fade-in">
                              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                              <div className="flex-1">
                                  <p className="text-xs font-black text-red-500 uppercase tracking-widest">ARE YOU SURE?</p>
                                  <p className="text-[10px] font-bold text-red-400/70 uppercase">THIS ACTION CANNOT BE UNDONE.</p>
                              </div>
                              <button 
                                  onClick={() => setIsDeleteConfirming(false)}
                                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-transform"
                              >
                                  CANCEL
                              </button>
                              <button 
                                  onClick={performDeleteTemplate}
                                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-900/20 hover:scale-105 transition-transform"
                              >
                                  CONFIRM DELETE
                              </button>
                          </div>
                      ) : (
                          <>
                              <button 
                                  onClick={() => setIsDeleteConfirming(true)}
                                  className="px-6 py-4 bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-105"
                              >
                                  <Trash2 className="w-4 h-4" /> DELETE
                              </button>
                              <div className="flex-1"></div>
                              <button 
                                  onClick={() => { handleCreateFromTemplate(editingTemplate); setEditingTemplate(null); }}
                                  className="flex-1 sm:flex-none px-6 py-4 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-105"
                              >
                                  <Plus className="w-4 h-4" /> CREATE GAME
                              </button>
                              <button 
                                  onClick={saveTemplateChanges}
                                  disabled={!templateForm.name.trim() || isSavingTemplate}
                                  className="flex-1 sm:flex-none px-8 py-4 bg-blue-600 text-white hover:bg-blue-500 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 hover:scale-105 active:scale-95"
                              >
                                  {isSavingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  UPDATE TEMPLATE
                              </button>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* CUSTOM INPUT MODAL OVERLAY */}
      {inputModal && inputModal.isOpen && (
          <div className="absolute inset-0 z-[5000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl relative">
                  <button 
                      onClick={() => setInputModal(null)} 
                      className="absolute top-4 right-4 text-slate-500 hover:text-white p-2 hover:scale-110 transition-transform"
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
                          className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-black uppercase tracking-wide transition-all text-xs hover:scale-105"
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
                          className="flex-1 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-wide transition-all text-xs disabled:opacity-50 shadow-lg hover:scale-105 active:scale-95"
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
