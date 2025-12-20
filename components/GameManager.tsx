import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Game, GamePoint, TaskList, TaskTemplate, IconId, GameMode, MapStyleId } from '../types';
import { Plus, Play, Edit2, Trash2, GripVertical, Wand2, Trophy, Calendar, Map, ChevronRight, ArrowLeft, FolderOpen, Layers, Library, Eraser, MousePointerClick, Save, LayoutTemplate, Check, X, Database, QrCode, Users, Disc, ChevronUp, GraduationCap, Gamepad2, Clock, CheckCircle2, Globe, Moon, Sun, Home, AlertCircle } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import { seedDatabase } from '../utils/demoContent';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GameManagerProps {
  games: Game[];
  taskLists: TaskList[];
  activeGameId: string | null;
  activeGamePoints: GamePoint[];
  onCreateGame: (name: string, fromTaskListId?: string, description?: string, mapStyle?: MapStyleId) => void;
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

// ... [Sortable Item Components remain unchanged - omitting for brevity as they are internal]
interface SortablePointItemProps {
  point: GamePoint;
  onEdit: (p: GamePoint) => void;
  index: number;
}
const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');
const GAME_COLORS = [
    { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
    { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
    { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
    { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
    { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
    { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
    { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
    { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
];

const SortablePointItem: React.FC<SortablePointItemProps> = ({ point, onEdit, index }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: point.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 999 : 'auto', opacity: isDragging ? 0.8 : 1 };
  const Icon = ICON_COMPONENTS[point.iconId];

  if (point.isSectionHeader) {
      return (
        <div ref={setNodeRef} style={style} className="py-2">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div {...attributes} {...listeners} className="text-gray-400 cursor-grab p-1"><GripVertical className="w-4 h-4"/></div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{point.title}</span>
                </div>
                <button onClick={() => onEdit(point)} className="p-1 text-gray-400 hover:text-orange-600"><Edit2 className="w-3 h-3"/></button>
            </div>
        </div>
      );
  }

  return (
    <div ref={setNodeRef} style={style} className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 flex items-center gap-3 transition-all ${isDragging ? 'shadow-xl ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/50 scale-105' : 'hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-sm'}`}>
      <div {...attributes} {...listeners} className="text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing hover:text-gray-500 dark:hover:text-gray-400 touch-none p-1"><GripVertical className="w-5 h-5" /></div>
      <div className="font-mono text-[10px] font-bold text-gray-400 w-6">{(index + 1).toString().padStart(3, '0')}</div>
      <div className="bg-gray-100 dark:bg-gray-700 p-2.5 rounded-xl text-gray-600 dark:text-gray-300 flex-shrink-0 cursor-pointer transition-transform hover:scale-110 active:scale-95" onClick={() => onEdit(point)}><Icon className="w-5 h-5" /></div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(point)}>
        <p className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{point.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{stripHtml(point.task.question)}</p>
      </div>
      <button onClick={() => onEdit(point)} className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
    </div>
  );
};

const GameManager: React.FC<GameManagerProps> = ({ 
  games, 
  taskLists,
  activeGameId, 
  activeGamePoints, 
  onCreateGame, 
  onSelectGame, 
  onEditGame, 
  onDeleteGame, 
  onEditPoint, 
  onReorderPoints,
  onOpenTaskMaster,
  onClose,
  onClearMap,
  sourceListId,
  onSetSourceListId,
  onExplicitSaveGame,
  onSaveAsTemplate,
  onOpenPlaylist,
  onEditGameMetadata,
  onShowResults,
  mode,
  onSetMode,
  onOpenAiGenerator
}) => {
  const [newGameName, setNewGameName] = useState('');
  const [selectedListId, setSelectedListId] = useState<string>(''); 
  const [view, setView] = useState<'LIST' | 'DETAILS'>('LIST');
  const [gameTab, setGameTab] = useState<'TODAY' | 'PLANNED' | 'COMPLETED'>('TODAY');
  
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [showCreateGameModal, setShowCreateGameModal] = useState(false);
  const [createGameName, setCreateGameName] = useState('');
  const [createGameDesc, setCreateGameDesc] = useState('');
  const [createGameMapStyle, setCreateGameMapStyle] = useState<MapStyleId>('osm'); // Added State
  const [createGameListId, setCreateGameListId] = useState<string | undefined>(undefined);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [targetGameId, setTargetGameId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSourceMenu(false);
      }
    }
    if(showSourceMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSourceMenu]);

  React.useEffect(() => {
    if (activeGameId) {
        setView('DETAILS');
        // Only update local edit state if not currently editing to avoid overwriting user input
        if (!isEditingMetadata) {
            const g = games.find(game => game.id === activeGameId);
            if(g) { setEditName(g.name); setEditDesc(g.description || ''); }
        }
    } else { 
        setView('LIST'); 
        setIsEditingMetadata(false);
    }
  }, [activeGameId, games, isEditingMetadata]);

  const filteredGames = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Sort by creation time (newest first)
    const sorted = [...games].sort((a, b) => b.createdAt - a.createdAt);

    return sorted.filter(g => {
        const gDate = new Date(g.createdAt);
        gDate.setHours(0,0,0,0);
        const isToday = gDate.getTime() === today.getTime();
        
        // Check if fully completed
        const isCompleted = g.points.length > 0 && g.points.every(p => p.isCompleted);
        
        if (gameTab === 'COMPLETED') return isCompleted;
        if (isCompleted) return false;

        if (gameTab === 'TODAY') return isToday;
        if (gameTab === 'PLANNED') return !isToday;
        
        return true;
    });
  }, [games, gameTab]);

  const handleInlineCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGameName.trim()) {
      onCreateGame(newGameName, selectedListId || undefined, undefined, 'osm');
      setNewGameName(''); setSelectedListId(''); setView('DETAILS');
    }
  };

  const handleStartAutoGenerate = () => { 
      setIsWizardMode(true); 
      // Skip template selector, directly open create modal for a fresh start with AI
      setCreateGameListId(undefined);
      setCreateGameName("New Adventure");
      setCreateGameDesc(`Created on ${new Date().toLocaleDateString()}`);
      setCreateGameMapStyle('osm'); 
      setShowCreateGameModal(true);
  };
  
  const handleTemplateSelected = (listId: string | '') => {
      setSelectedListId(listId);
      setShowTemplateSelector(false);
      // Logic for manual template selection (if re-enabled or used elsewhere)
      if (isWizardMode) {
          setCreateGameListId(listId || undefined);
          setCreateGameName("New Adventure");
          setCreateGameDesc(`Created on ${new Date().toLocaleDateString()}`);
          setCreateGameMapStyle('osm'); 
          setShowCreateGameModal(true);
      }
  };

  const handleConfirmCreateGame = (e: React.FormEvent) => {
      e.preventDefault();
      if (!createGameName.trim()) return;
      onCreateGame(createGameName, createGameListId, createGameDesc, createGameMapStyle);
      setShowCreateGameModal(false);
      
      // If triggered via Auto-Generate wizard, open AI Generator now
      if (isWizardMode) {
          if (onOpenAiGenerator) onOpenAiGenerator();
          setIsWizardMode(false);
      }

      setCreateGameName(''); setCreateGameDesc(''); setCreateGameListId(undefined); setCreateGameMapStyle('osm');
  };
  
  const handleSaveMetadata = () => {
      if (activeGameId && onEditGameMetadata) {
          onEditGameMetadata(activeGameId, editName, editDesc);
          setIsEditingMetadata(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleSaveMetadata();
      } else if (e.key === 'Escape') {
          setIsEditingMetadata(false);
          // Revert changes from state
          const g = games.find(game => game.id === activeGameId);
          if(g) { setEditName(g.name); setEditDesc(g.description || ''); }
      }
  };

  const handleOpenSaveTemplateModal = (gameId: string) => {
      if (!onSaveAsTemplate) return;
      const game = games.find(g => g.id === gameId);
      if (!game) return;
      setTargetGameId(gameId);
      setTplName(`${game.name} Template`);
      setTplDesc(game.description || '');
      setShowSaveTemplateModal(true);
  };

  const handleConfirmSaveTemplate = (e: React.FormEvent) => {
      e.preventDefault();
      if (!targetGameId || !onSaveAsTemplate) return;
      onSaveAsTemplate(targetGameId, tplName, tplDesc);
      setShowSaveTemplateModal(false);
      setTargetGameId(null);
  };

  const handleSeedData = async () => {
    if (confirm("This will add 10 demo tasks and 2 example lists to your library. Continue?")) {
      setIsSeeding(true);
      await seedDatabase();
      setIsSeeding(false);
      window.location.reload(); 
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activeGamePoints.findIndex((p) => p.id === active.id);
      const newIndex = activeGamePoints.findIndex((p) => p.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderPoints(arrayMove(activeGamePoints, oldIndex, newIndex));
      }
    }
  };

  const activeGame = games.find(g => g.id === activeGameId);
  const completedCount = activeGamePoints.filter(p => p.isCompleted && !p.isSectionHeader).length;
  const totalCount = activeGamePoints.filter(p => !p.isSectionHeader).length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const selectedListName = useMemo(() => {
    if (!selectedListId) return "Start from Empty";
    const list = taskLists.find(l => l.id === selectedListId);
    return list ? list.name : "Start from Empty";
  }, [selectedListId, taskLists]);
  const activeSourceList = taskLists.find(l => l.id === sourceListId);

  // Stats for the currently selected source list
  const sourceListStats = useMemo(() => {
      if (!activeSourceList) return null;
      const placedCount = activeGamePoints.filter(p => activeSourceList.tasks.some(t => t.title === p.title)).length;
      const totalCount = activeSourceList.tasks.length;
      return { 
          placed: placedCount, 
          total: totalCount, 
          remaining: totalCount - placedCount,
          exhausted: placedCount >= totalCount && totalCount > 0 
      };
  }, [activeSourceList, activeGamePoints]);

  return (
    <div className="absolute top-0 left-0 bottom-0 z-[1100] w-full sm:w-[400px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 border-r border-gray-200 dark:border-gray-800">
      
      {/* --- MODALS --- */}
      {showCreateGameModal && (
          <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">New Game Setup</h3>
                  <form onSubmit={handleConfirmCreateGame} className="space-y-4">
                      <div><label className="text-xs font-bold text-gray-500 uppercase">Game Name</label><input autoFocus className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white" value={createGameName} onChange={e => setCreateGameName(e.target.value)} placeholder="e.g. City Hunt 2024" /></div>
                      <div><label className="text-xs font-bold text-gray-500 uppercase">Description / Date</label><input className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 dark:text-white" value={createGameDesc} onChange={e => setCreateGameDesc(e.target.value)} placeholder="Optional info..." /></div>
                      
                      {/* Map Style Selector */}
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Default Map Style</label>
                          <div className="grid grid-cols-4 gap-2 mt-1">
                              {[
                                  { id: 'osm', label: 'Standard', icon: Map },
                                  { id: 'satellite', label: 'Sat', icon: Globe },
                                  { id: 'dark', label: 'Dark', icon: Moon },
                                  { id: 'light', label: 'Light', icon: Sun },
                              ].map(style => (
                                  <button
                                      key={style.id}
                                      type="button"
                                      onClick={() => setCreateGameMapStyle(style.id as MapStyleId)}
                                      className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${createGameMapStyle === style.id ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}
                                  >
                                      <style.icon className="w-5 h-5 mb-1" />
                                      <span className="text-[10px] font-bold">{style.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="flex gap-3 pt-2"><button type="button" onClick={() => { setShowCreateGameModal(false); setIsWizardMode(false); }} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancel</button><button type="submit" disabled={!createGameName.trim()} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50">Create Game</button></div>
                  </form>
              </div>
          </div>
      )}
      
      {showSaveTemplateModal && (
          <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 transform transition-all scale-100">
                  <div className="flex items-center gap-3 mb-5">
                      <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl text-teal-600 dark:text-teal-400">
                          <LayoutTemplate className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Save as Template</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Create a reusable copy of this game</p>
                      </div>
                  </div>
                  
                  <form onSubmit={handleConfirmSaveTemplate} className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Template Name</label>
                          <input 
                              autoFocus 
                              className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white font-bold" 
                              value={tplName} 
                              onChange={e => setTplName(e.target.value)} 
                              placeholder="e.g. City Hunt Template"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                          <textarea 
                              className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 dark:text-white text-sm min-h-[80px]" 
                              value={tplDesc} 
                              onChange={e => setTplDesc(e.target.value)} 
                              placeholder="Describe the template..."
                          />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => setShowSaveTemplateModal(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
                          <button type="submit" disabled={!tplName.trim()} className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 disabled:shadow-none">Save Template</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Header with Integrated Mode Switcher */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
             <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-full hover:bg-slate-700 text-white mr-1 shrink-0"><Home className="w-4 h-4" /></button>
             {view === 'DETAILS' && isEditingMetadata ? (
                  <div className="flex-1 mr-2">
                      <input 
                        autoFocus 
                        className="w-full text-xl font-black bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 outline-none text-gray-900 dark:text-white border-2 border-transparent focus:border-orange-500 transition-colors" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        onKeyDown={handleKeyDown}
                        placeholder="Game Name"
                      />
                      <input 
                        className="w-full text-xs mt-1 bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 outline-none text-gray-600 dark:text-gray-300 border-2 border-transparent focus:border-orange-500 transition-colors" 
                        value={editDesc} 
                        onChange={e => setEditDesc(e.target.value)} 
                        onKeyDown={handleKeyDown}
                        placeholder="Description..." 
                      />
                      <div className="flex gap-2 mt-2">
                          <button onClick={handleSaveMetadata} className="text-xs bg-green-600 text-white px-3 py-1 rounded font-bold hover:bg-green-700">Save</button>
                          <button onClick={() => setIsEditingMetadata(false)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded font-bold hover:bg-gray-300">Cancel</button>
                      </div>
                  </div>
              ) : (
                <div className="flex-1 min-w-0 group/header">
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                            {view === 'LIST' ? 'GAMES' : (activeGame?.name || 'Game Details')}
                        </h2>
                        {view === 'DETAILS' && (
                            <button 
                                onClick={() => setIsEditingMetadata(true)} 
                                className="text-gray-400 hover:text-orange-500 opacity-0 group-hover/header:opacity-100 transition-opacity p-1"
                                title="Edit Name & Description"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {view === 'DETAILS' && (
                        <p 
                            className={`text-xs truncate ${activeGame?.description ? 'text-gray-500' : 'text-gray-400 italic cursor-pointer hover:text-orange-500'}`}
                            onClick={() => !activeGame?.description && setIsEditingMetadata(true)}
                        >
                            {activeGame?.description || "Add a description..."}
                        </p>
                    )}
                </div>
              )}
          </div>
          
          <div className="flex items-center gap-2">
              {view === 'DETAILS' && onExplicitSaveGame && (
                  <button onClick={onExplicitSaveGame} className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-2 rounded-full hover:bg-green-200 dark:hover:bg-green-800 transition-colors" title="Save Changes"><Disc className="w-5 h-5" /></button>
              )}
              <button 
                 onClick={onClose} 
                 className="text-white bg-red-500 hover:bg-red-600 p-2 rounded-full transition-colors flex-shrink-0 shadow-lg"
                 title="Close Game Manager"
              >
                 <X className="w-5 h-5" /> 
              </button>
          </div>
        </div>

        {/* Integrated Mode Switcher */}
        <div className="grid grid-cols-3 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button 
                onClick={() => { onSetMode(GameMode.PLAY); onClose(); }} 
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${mode === GameMode.PLAY ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
                <Gamepad2 className="w-4 h-4" /> Team Play
            </button>
            <button 
                onClick={() => { onSetMode(GameMode.INSTRUCTOR); onClose(); }} 
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${mode === GameMode.INSTRUCTOR ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
                <GraduationCap className="w-4 h-4" /> GM View
            </button>
            <button 
                onClick={() => onSetMode(GameMode.EDIT)} 
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${mode === GameMode.EDIT ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
                <Edit2 className="w-4 h-4" /> Editor
            </button>
        </div>

        {view === 'DETAILS' && (
           <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-2">
             <button onClick={() => setView('LIST')} className="hover:text-orange-600 hover:underline flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> All Games</button>
           </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 relative">
        
        {/* QR CODE MODAL */}
        {showQrModal && activeGameId && (
            <div className="fixed inset-0 z-[1600] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowQrModal(false)}>
                <div className="bg-white p-6 rounded-2xl flex flex-col items-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">{activeGame?.name}</h3>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(activeGameId)}`} alt="Game QR" className="w-64 h-64 mb-4" />
                    <p className="text-gray-500 text-sm text-center max-w-xs">Teams can scan this code on the Welcome Screen to instantly join this game.</p>
                    <button onClick={() => setShowQrModal(false)} className="mt-6 w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-600">Close</button>
                </div>
            </div>
        )}

        {/* TEMPLATE SELECTOR OVERLAY */}
        {showTemplateSelector && (
            <div className="absolute inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col animate-in slide-in-from-right-10 duration-200">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 bg-gray-50 dark:bg-gray-800">
                    <button onClick={() => setShowTemplateSelector(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"><ArrowLeft className="w-5 h-5" /></button>
                    <div><h3 className="font-bold text-gray-900 dark:text-white">Select Starting Template</h3><p className="text-xs text-gray-500 dark:text-gray-400">Choose a list to preload tasks</p></div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <button onClick={() => handleTemplateSelected('')} className={`w-full p-4 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${selectedListId === '' ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedListId === '' ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}><Eraser className="w-5 h-5" /></div>
                        <div className="flex-1"><h4 className={`font-bold ${selectedListId === '' ? 'text-orange-700 dark:text-orange-300' : 'text-gray-800 dark:text-gray-200'}`}>Start from Empty</h4><p className="text-xs text-gray-500">Blank canvas with no tasks</p></div>
                        {selectedListId === '' && <Check className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
                    </button>
                    {taskLists.map(list => (
                        <button key={list.id} onClick={() => handleTemplateSelected(list.id)} className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all group relative overflow-hidden ${selectedListId === list.id ? 'border-orange-500 ring-1 ring-orange-500 bg-white dark:bg-gray-800' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-700'}`}>
                            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: list.color }}></div>
                            <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold ml-2">{list.tasks.length}</div>
                            <div className="flex-1 min-w-0"><h4 className="font-bold text-gray-800 dark:text-gray-100 truncate">{list.name}</h4><p className="text-xs text-gray-500 dark:text-gray-400 truncate">{list.description || 'No description'}</p></div>
                            {selectedListId === list.id && <Check className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {view === 'LIST' ? (
          <div className="p-5 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Create New</label><button onClick={onOpenTaskMaster} className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800 px-2 py-1 rounded-lg border border-amber-100"><FolderOpen className="w-3 h-3" /> TASKS</button></div>
              <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleStartAutoGenerate} className="py-3 px-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-750 transition-all flex flex-col items-center justify-center gap-1 shadow-sm"><Wand2 className="w-5 h-5" /> Auto-Generate</button>
                  <button onClick={onOpenTaskMaster} className="py-3 px-2 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl font-bold text-xs hover:shadow-lg transition-all flex flex-col items-center justify-center gap-1 shadow-md"><FolderOpen className="w-5 h-5" /> Task Library</button>
              </div>
              <form onSubmit={handleInlineCreate} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                <input type="text" value={newGameName} onChange={(e) => setNewGameName(e.target.value)} placeholder="New game name..." className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm text-gray-900 dark:text-white" />
                <button type="button" onClick={() => { setShowTemplateSelector(true); setIsWizardMode(false); }} className={`w-full px-4 py-2.5 border rounded-lg text-left flex items-center justify-between group transition-colors ${selectedListId ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                    <div className="flex items-center gap-2 overflow-hidden"><LayoutTemplate className={`w-4 h-4 flex-shrink-0 ${selectedListId ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`} /><span className={`text-sm truncate ${selectedListId ? 'font-bold text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-300'}`}>{selectedListName}</span></div><ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </button>
                <button type="submit" disabled={!newGameName.trim()} className="w-full bg-orange-600 text-white py-2 rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Create Game</button>
              </form>
            </div>
            
            {/* YOUR GAMES SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Your Games</label>
              </div>
              
              {/* TABS */}
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                  <button onClick={() => setGameTab('TODAY')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${gameTab === 'TODAY' ? 'bg-white dark:bg-gray-700 shadow text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      <Clock className="w-3 h-3" /> Today
                  </button>
                  <button onClick={() => setGameTab('PLANNED')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${gameTab === 'PLANNED' ? 'bg-white dark:bg-gray-700 shadow text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      <Calendar className="w-3 h-3" /> Planned
                  </button>
                  <button onClick={() => setGameTab('COMPLETED')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${gameTab === 'COMPLETED' ? 'bg-white dark:bg-gray-700 shadow text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      <CheckCircle2 className="w-3 h-3" /> Done
                  </button>
              </div>

              {filteredGames.length === 0 && (
                  <div className="text-center py-8 px-6 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                      <Map className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 dark:text-gray-400 font-medium text-xs">No games found in '{gameTab.toLowerCase()}'.</p>
                  </div>
              )}

              {filteredGames.map((game, i) => {
                 const gCompleted = game.points.filter(p => p.isCompleted).length;
                 const gTotal = game.points.filter(p => !p.isSectionHeader).length;
                 const gProgress = gTotal > 0 ? Math.round((gCompleted / gTotal) * 100) : 0;
                 const dateStr = new Date(game.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                 const iconKeys = Object.keys(ICON_COMPONENTS);
                 const iconIndex = Math.abs(game.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % iconKeys.length;
                 const GameIcon = ICON_COMPONENTS[iconKeys[iconIndex] as IconId];
                 const colorIdx = Math.abs(game.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % GAME_COLORS.length;
                 const theme = GAME_COLORS[colorIdx];
                 return (
                  <div key={game.id} className={`bg-white dark:bg-gray-800 border ${theme.border} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer`} onClick={() => onSelectGame(game.id)}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${theme.bg} ${theme.text} flex items-center justify-center shadow-inner`}><GameIcon className="w-6 h-6" /></div>
                        <div><h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{game.name}</h3><div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"><Calendar className="w-3 h-3" /><span>{dateStr}</span></div></div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => onSelectGame(game.id)} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors" title="Play/Map"><Play className="w-4 h-4 fill-current" /></button>
                        {onSaveAsTemplate && <button onClick={() => handleOpenSaveTemplateModal(game.id)} className="p-2 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-800 transition-colors" title="Save as Template"><Save className="w-4 h-4" /></button>}
                        {onEditGame && <button onClick={() => onEditGame(game.id)} className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-800 transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>}
                        <button onClick={() => onDeleteGame(game.id)} className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="mt-2"><div className="flex justify-between text-xs mb-1.5"><span className="font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1"><Trophy className="w-3 h-3" /> {gCompleted}/{gTotal} Tasks</span><span className="font-bold text-orange-600 dark:text-orange-400">{gProgress}%</span></div><div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden"><div className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${gProgress}%` }} /></div></div>
                  </div>
                );
              })}
            </div>
            
            <div className="pt-4 mt-6 border-t border-gray-100 dark:border-gray-800 text-center"><button onClick={handleSeedData} disabled={isSeeding} className="text-xs font-bold text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 flex items-center justify-center gap-2 mx-auto disabled:opacity-50"><Database className="w-3 h-3" />{isSeeding ? 'Installing Demo Data...' : 'Install Demo Data'}</button></div>
          </div>
        ) : (
          <div className="p-5 pb-20">
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center"><span className="text-2xl font-black text-gray-800 dark:text-white">{totalCount}</span><span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Total Tasks</span></div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center"><span className="text-2xl font-black text-green-600 dark:text-green-400">{progress}%</span><span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Completed</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
                <button onClick={onShowResults} className="w-full py-4 bg-gradient-to-br from-orange-400 to-red-500 text-white rounded-xl shadow-lg flex flex-col items-center justify-center gap-1 transition-transform hover:scale-[1.02]"><Trophy className="w-6 h-6" /><span className="text-xs font-bold uppercase">View Results</span></button>
                <button onClick={onOpenPlaylist} className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg flex flex-col items-center justify-center gap-1 transition-transform hover:scale-[1.02]"><Layers className="w-6 h-6" /><span className="text-xs font-bold uppercase">Edit Playlist</span></button>
            </div>
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Users className="w-4 h-4" /> Active Teams</h3><button onClick={() => setShowQrModal(true)} className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold hover:bg-orange-200 flex items-center gap-1"><QrCode className="w-3 h-3" /> Show QR</button></div>
                <div className="space-y-1"><div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"><div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div><span className="text-sm font-bold text-gray-700 dark:text-gray-300">Team Alpha</span></div><span className="text-xs font-mono text-gray-400">0 pts</span></div></div>
            </div>
            {onSetSourceListId && (
                <div className="mb-6 relative z-30" ref={menuRef}>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block ml-1">Map Click Behavior</label>
                    <button 
                        onClick={() => setShowSourceMenu(!showSourceMenu)} 
                        className={`w-full bg-white dark:bg-gray-800 p-2.5 rounded-xl border flex items-center gap-3 shadow-sm hover:shadow-md transition-all group ${
                            sourceListStats?.exhausted 
                            ? 'border-red-400 dark:border-red-900 bg-red-50 dark:bg-red-900/20 animate-pulse' 
                            : 'border-gray-200 dark:border-gray-700'
                        } ${showSourceMenu ? 'ring-2 ring-orange-500 border-transparent' : ''}`}
                    >
                        <div className={`p-2 rounded-lg transition-colors ${
                            activeSourceList 
                            ? (sourceListStats?.exhausted ? 'bg-red-500 text-white' : 'text-white') 
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400'
                        }`} style={activeSourceList && !sourceListStats?.exhausted ? { backgroundColor: activeSourceList.color } : {}}>
                            {sourceListStats?.exhausted ? <AlertCircle className="w-5 h-5" /> : <MousePointerClick className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <span className={`text-[10px] uppercase font-bold block mb-0.5 ${sourceListStats?.exhausted ? 'text-red-500' : 'text-gray-400'}`}>
                                {sourceListStats?.exhausted ? "List Empty!" : "Placing from:"}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-white text-sm truncate block">{activeSourceList ? activeSourceList.name : "Default (New Empty Task)"}</span>
                            {sourceListStats && (
                                <span className={`text-[10px] font-bold ${sourceListStats.exhausted ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {sourceListStats.exhausted ? `⚠️ All ${sourceListStats.total} tasks placed` : `${sourceListStats.remaining} tasks remaining`}
                                </span>
                            )}
                        </div>
                        <div className={`text-gray-400 transition-transform duration-300 ${showSourceMenu ? 'rotate-180 text-orange-500' : 'group-hover:text-gray-600'}`}><ChevronUp className="w-5 h-5" /></div>
                    </button>
                    {showSourceMenu && (
                        <div className="absolute bottom-full left-0 right-0 mb-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-2 zoom-in-95 duration-200 origin-bottom">
                            <div className="p-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Select Source</span></div>
                            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                                <button onClick={() => { onSetSourceListId(''); setShowSourceMenu(false); }} className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all ${!sourceListId ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}><div className={`p-2 rounded-lg ${!sourceListId ? 'bg-amber-200 dark:bg-amber-800' : 'bg-gray-200 dark:bg-gray-600'}`}><Plus className="w-4 h-4" /></div><span className="font-bold text-sm flex-1 text-left">Default (New Empty Task)</span>{!sourceListId && <Check className="w-4 h-4" />}</button>
                                {taskLists.map(list => {
                                    const placed = activeGamePoints.filter(p => list.tasks.some(t => t.title === p.title)).length;
                                    const total = list.tasks.length;
                                    const exhausted = placed >= total;
                                    
                                    return (
                                    <button key={list.id} onClick={() => { onSetSourceListId(list.id); setShowSourceMenu(false); }} className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all ${sourceListId === list.id ? 'bg-gray-100 dark:bg-gray-700 shadow-inner' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                        <div className="p-2 rounded-lg text-white shadow-sm" style={{ backgroundColor: list.color }}><LayoutTemplate className="w-4 h-4" /></div>
                                        <div className="flex-1 text-left">
                                            <span className={`font-bold text-sm block ${sourceListId === list.id ? 'text-gray-900 dark:text-white' : ''}`}>{list.name}</span>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-gray-400 opacity-80">{total} tasks</span>
                                                {exhausted ? (
                                                    <span className="text-[10px] text-red-500 font-bold bg-red-100 dark:bg-red-900/30 px-1.5 rounded">All Placed</span>
                                                ) : (
                                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-100 dark:bg-green-900/30 px-1.5 rounded">{total - placed} left</span>
                                                )}
                                            </div>
                                        </div>
                                        {sourceListId === list.id && <Check className="w-4 h-4 text-gray-500" />}
                                    </button>
                                )})}
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="flex items-center justify-between mb-3 ml-1"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center"><span>Task Preview</span><span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md text-[10px]">{activeGamePoints.length} Items</span></h3><div className="flex items-center gap-1">{onSaveAsTemplate && activeGameId && <button onClick={() => handleOpenSaveTemplateModal(activeGameId)} className="p-1.5 text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/30 rounded-lg" title="Save current game tasks as a template"><Save className="w-4 h-4" /></button>}<button onClick={onClearMap} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="Delete all tasks from map"><Eraser className="w-4 h-4" /></button></div></div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={activeGamePoints.map(p => p.id)} strategy={verticalListSortingStrategy}><div className="space-y-2.5 min-h-[100px]">{activeGamePoints.length === 0 && (<div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl"><Map className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-gray-400 text-sm font-medium">No tasks yet.</p><p className="text-xs text-gray-400 mt-1">Tap the map to add one.</p></div>)}{activeGamePoints.map((point, index) => (<SortablePointItem key={point.id} point={point} onEdit={onEditPoint} index={index} />))}</div></SortableContext></DndContext>
          </div>
        )}
      </div>
      <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-center"><p className="text-[10px] text-gray-400 font-medium">TeamAction v1.0 • Drag to reorder • Click map to add</p></div>
    </div>
  );
};

export default GameManager;