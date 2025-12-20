
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TaskTemplate, TaskList, GamePoint, IconId } from '../types';
import { X, Search, Plus, Tag, Layers, Edit2, Trash2, CheckSquare, FolderOpen, CheckCircle2, ChevronRight, ListChecks, Globe, Home, ArrowLeft, Wand2, FilePlus, Sparkles, Camera, Image as ImageIcon, Gamepad2, ChevronLeft, Filter } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import TaskEditor from './TaskEditor';
import AiTaskGenerator from './AiTaskGenerator';
import { generateTaskFromImage } from '../services/ai';

interface TaskMasterProps {
  library: TaskTemplate[];
  lists: TaskList[];
  onClose: () => void;
  onSaveTemplate: (template: TaskTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onSaveList: (list: TaskList) => void;
  onDeleteList: (id: string) => void;
  onCreateGameFromList: (listId: string) => void;
  isSelectionMode?: boolean;
  onSelectTasksForGame?: (tasks: TaskTemplate[]) => void;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const getFlagEmoji = (lang?: string) => {
    if (!lang) return '🌐';
    if (lang.includes('Danish') || lang.includes('Dansk')) return '🇩🇰';
    if (lang.includes('English')) return '🇬🇧';
    if (lang.includes('German') || lang.includes('Deutsch')) return '🇩🇪';
    if (lang.includes('Spanish') || lang.includes('Español')) return '🇪🇸';
    if (lang.includes('French') || lang.includes('Français')) return '🇫🇷';
    return '🌐';
};

const TaskMaster: React.FC<TaskMasterProps> = ({ 
  library, 
  lists, 
  onClose, 
  onSaveTemplate, 
  onDeleteTemplate, 
  onSaveList, 
  onDeleteList, 
  onCreateGameFromList, 
  isSelectionMode = false, 
  onSelectTasksForGame 
}) => {
  const [activeTab, setActiveTab] = useState<'CREATE' | 'LIBRARY' | 'LISTS'>('LISTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('All');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState('');
  
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState(COLORS[0]);
  const [newListIcon, setNewListIcon] = useState<IconId>('default');
  const [isAddingToList, setIsAddingToList] = useState(false); 
  const [selectedTasksBuffer, setSelectedTasksBuffer] = useState<TaskTemplate[]>([]);

  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadColors = () => {
        try {
            const stored = localStorage.getItem('geohunt_tag_colors');
            if (stored) setTagColors(JSON.parse(stored));
        } catch (e) { console.error(e); }
    };
    loadColors();
  }, [editingTemplate]);

  const allTags = useMemo(() => {
      const tags = new Set<string>();
      library.forEach(t => t.tags.forEach(tag => tags.add(tag)));
      return Array.from(tags).sort();
  }, [library]);

  const availableLanguages = useMemo(() => {
      const langs = new Set<string>();
      library.forEach(t => { if (t.settings?.language) langs.add(t.settings.language); });
      return Array.from(langs).sort();
  }, [library]);

  const filteredLibrary = useMemo(() => {
      return library.filter(t => {
          const q = searchQuery.toLowerCase();
          const matchesSearch = t.title.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q));
          const matchesLanguage = languageFilter === 'All' || t.settings?.language === languageFilter;
          const matchesTag = !selectedTagFilter || t.tags.includes(selectedTagFilter);
          return matchesSearch && matchesLanguage && matchesTag;
      }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [library, searchQuery, languageFilter, selectedTagFilter]);

  const handleSaveTemplate = (point: GamePoint) => {
    const template: TaskTemplate = {
        id: point.id, title: point.title, task: point.task, tags: point.tags || [], iconId: point.iconId,
        createdAt: library.find(t => t.id === point.id)?.createdAt || Date.now(),
        points: point.points, feedback: point.feedback, settings: point.settings
    };
    onSaveTemplate(template);
    setEditingTemplate(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsAnalyzingImage(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
          const task = await generateTaskFromImage(reader.result as string);
          if (task) setEditingTemplate(task);
          else alert("Failed to analyze image.");
          setIsAnalyzingImage(false);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderTaskRow = (template: TaskTemplate, context: 'list' | 'library') => {
      const Icon = ICON_COMPONENTS[template.iconId] || Search;
      const isInList = isAddingToList && lists.find(l => l.id === selectedListId)?.tasks.some(t => t.id === template.id);
      const isSelected = isSelectionMode && selectedTasksBuffer.some(t => t.id === template.id);
      const isBufferSelected = selectedTasksBuffer.some(t => t.id === template.id);
      const isBulkSelected = isBulkMode && bulkSelectedIds.has(template.id);

      const handleClick = () => {
         if (context === 'library') {
             if (isBulkMode) { const n = new Set(bulkSelectedIds); if(n.has(template.id)) n.delete(template.id); else n.add(template.id); setBulkSelectedIds(n); }
             else if (isAddingToList) {
                const list = lists.find(l => l.id === selectedListId);
                if (list) {
                    const exists = list.tasks.find(t => t.id === template.id);
                    onSaveList({ ...list, tasks: exists ? list.tasks.filter(t => t.id !== template.id) : [...list.tasks, template] });
                }
             }
             else if (isSelectionMode) { setSelectedTasksBuffer(p => p.find(t => t.id === template.id) ? p.filter(t => t.id !== template.id) : [...p, template]); }
         } else if (context === 'list' && isSelectionMode) {
             setSelectedTasksBuffer(p => p.find(t => t.id === template.id) ? p.filter(t => t.id !== template.id) : [...p, template]);
         }
      };

      const highlight = (context === 'library' && (isInList || isSelected || isBulkSelected)) || (context === 'list' && isSelectionMode && isBufferSelected);

      return (
          <div key={template.id} onClick={handleClick} className={`bg-white dark:bg-gray-950 border-b last:border-0 border-gray-100 dark:border-gray-800 p-4 flex items-center gap-4 transition-all hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer ${highlight ? 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/30' : ''}`}>
              {isBulkMode && context === 'library' && <div className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${isBulkSelected ? 'bg-orange-600 border-orange-600 text-white' : 'border-gray-300 dark:border-gray-700'}`}>{isBulkSelected && <CheckSquare className="w-3 h-3" />}</div>}
              
              <div className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${highlight ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/40' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px]" title={template.settings?.language}>{getFlagEmoji(template.settings?.language)}</span>
                      <h3 className="font-black text-xs uppercase tracking-widest text-gray-800 dark:text-gray-200 truncate">{template.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-black bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500 uppercase tracking-tighter">{template.task.type}</span>
                      {template.tags.map(tag => <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full text-white font-black uppercase tracking-tighter shadow-sm" style={{ backgroundColor: tagColors[tag] || '#94a3b8' }}>{tag}</span>)}
                  </div>
              </div>

              {!isBulkMode && (
                  <div className="flex items-center gap-2 ml-auto">
                      {(isAddingToList || isSelectionMode) ? (
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${highlight ? 'bg-orange-600 border-orange-600 text-white scale-110' : 'border-gray-200 dark:border-gray-700'}`}>{highlight && <CheckSquare className="w-4 h-4" />}</div>
                      ) : (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); setEditingTemplate(template); }} className="p-2 text-gray-400 hover:text-orange-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                            {context === 'list' && <button onClick={(e) => { e.stopPropagation(); handleClick(); }} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>}
                        </>
                      )}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[1900] bg-gray-50 dark:bg-gray-950 flex flex-col font-sans animate-in fade-in">
      {/* Header */}
      <div className={`p-4 text-white flex justify-between items-center shadow-2xl z-20 ${isSelectionMode ? 'bg-slate-900' : 'bg-slate-900'}`}>
        <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><Home className="w-5 h-5" /></button>
            <div className={`p-2 rounded-xl ${isSelectionMode ? 'bg-orange-600' : 'bg-orange-500 shadow-lg shadow-orange-500/20'}`}><FolderOpen className="w-6 h-6" /></div>
            <div>
                <h1 className="text-lg font-black uppercase tracking-[0.2em]">{isSelectionMode ? 'ADD TO GAME' : 'TASK MASTER'}</h1>
                <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">{isSelectionMode ? `${selectedTasksBuffer.length} SELECTED` : 'ORGANIZE YOUR LIBRARY'}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {activeTab === 'LISTS' && !selectedListId && !isSelectionMode && (
                <button onClick={() => setShowCreateListModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg flex items-center gap-2 uppercase tracking-widest">NEW LIST</button>
            )}
            {isSelectionMode && selectedTasksBuffer.length > 0 && (
                <button onClick={() => onSelectTasksForGame?.(selectedTasksBuffer)} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-xl flex items-center gap-2 uppercase tracking-[0.2em] animate-pulse">ADD TO MAP</button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex flex-shrink-0 z-10">
          {[
              {id: 'LISTS', label: 'MY LISTS', color: 'border-amber-500'},
              {id: 'LIBRARY', label: 'FULL LIBRARY', color: 'border-orange-500'},
              {id: 'CREATE', label: 'CREATE NEW', color: 'border-blue-500'}
          ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSelectedListId(null); }} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] border-b-4 transition-all ${activeTab === tab.id ? `${tab.color} text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50` : 'border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{tab.label}</button>
          ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {activeTab === 'CREATE' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
                  {isAnalyzingImage && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center text-white flex-col gap-4 animate-in fade-in"><Sparkles className="w-16 h-16 text-orange-500 animate-spin" /><p className="font-black text-xl uppercase tracking-[0.3em] animate-pulse">ANALYZING...</p></div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
                      {[
                        { id: 'MANUAL', label: 'START SCRATCH', desc: 'HAND-CRAFTED TASK', icon: FilePlus, color: 'from-orange-500 to-red-600', onClick: () => setEditingTemplate({ id: `tpl-${Date.now()}`, title: 'New Task', task: { type: 'text', question: '' }, tags: [], iconId: 'default', createdAt: Date.now() }) },
                        { id: 'AI', label: 'AI GENERATOR', desc: 'AUTO-GENERATE BY TOPIC', icon: Wand2, color: 'from-purple-600 to-indigo-700', onClick: () => setShowAiGenerator(true) },
                        { id: 'IMAGE', label: 'FROM PHOTO', desc: 'SNAP TO CREATE', icon: Camera, color: 'from-blue-600 to-cyan-700', onClick: () => fileInputRef.current?.click() }
                      ].map(card => (
                          <button key={card.id} onClick={card.onClick} className={`group relative p-8 rounded-3xl overflow-hidden shadow-2xl transition-all hover:scale-105 active:scale-95 ${card.id === 'IMAGE' ? 'sm:col-span-2' : ''}`}>
                              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-90 group-hover:opacity-100 transition-opacity`} />
                              <div className="relative z-10 flex flex-col items-center text-center text-white">
                                  <div className="p-4 bg-white/20 rounded-2xl mb-4 backdrop-blur-md group-hover:rotate-6 transition-transform"><card.icon className="w-10 h-10" /></div>
                                  <h3 className="text-xl font-black tracking-[0.2em] mb-1">{card.label}</h3>
                                  <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{card.desc}</p>
                              </div>
                          </button>
                      ))}
                  </div>
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              </div>
          )}

          {activeTab === 'LISTS' && (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
                  {!selectedListId ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {lists.map(list => (
                              <div key={list.id} onClick={() => setSelectedListId(list.id)} className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-amber-400 dark:hover:border-amber-500 cursor-pointer transition-all flex flex-col gap-4 relative group overflow-hidden">
                                  <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: list.color }} />
                                  <div className="flex justify-between items-start">
                                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-500 group-hover:bg-amber-500 group-hover:text-white transition-all"><Layers className="w-6 h-6" /></div>
                                      <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete list?')) onDeleteList(list.id); }} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-5 h-5"/></button>
                                  </div>
                                  <div>
                                      <h3 className="font-black text-sm uppercase tracking-widest text-slate-800 dark:text-white mb-1">{list.name}</h3>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">{list.tasks.length} MISSION UNITS</p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                           <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-slate-50/50 dark:bg-gray-850">
                               <div className="flex items-center gap-4">
                                   <button onClick={() => setSelectedListId(null)} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-slate-100 transition-colors"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
                                   <h3 className="font-black text-lg uppercase tracking-widest flex items-center gap-3"><div className="w-4 h-4 rounded-full shadow-lg" style={{backgroundColor: lists.find(l=>l.id===selectedListId)?.color}} /> {lists.find(l=>l.id===selectedListId)?.name}</h3>
                               </div>
                               <button onClick={() => { setActiveTab('LIBRARY'); setIsAddingToList(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"><Plus className="w-4 h-4" /> ADD TASKS</button>
                           </div>
                           <div className="flex-1 overflow-y-auto">
                               {lists.find(l=>l.id===selectedListId)?.tasks.length === 0 ? (
                                   <div className="text-center py-20 opacity-30"><FolderOpen className="w-16 h-16 mx-auto mb-4" /><p className="font-black uppercase tracking-widest">LIST IS EMPTY</p></div>
                               ) : (
                                   lists.find(l=>l.id===selectedListId)?.tasks.map(task => renderTaskRow(task, 'list'))
                               )}
                           </div>
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'LIBRARY' && (
              <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-950 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-4 bg-slate-50/50 dark:bg-gray-900/50">
                      <div className="flex gap-3">
                          <div className="flex-1 relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="SEARCH SYSTEM ARCHIVE..." className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 text-xs font-black uppercase tracking-widest focus:border-orange-500 outline-none transition-all shadow-inner dark:text-white" />
                          </div>
                          <button onClick={() => { setIsBulkMode(!isBulkMode); setBulkSelectedIds(new Set()); }} className={`px-4 py-3 rounded-2xl text-[10px] font-black border-2 transition-all flex items-center gap-2 uppercase tracking-widest ${isBulkMode ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-500 hover:border-orange-500'}`}><CheckSquare className="w-4 h-4" /> {isBulkMode ? 'FINISH' : 'BULK'}</button>
                      </div>
                      
                      {/* Tag Filtering Ribbon */}
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          <button onClick={() => setSelectedTagFilter(null)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter border-2 whitespace-nowrap transition-all ${!selectedTagFilter ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-500'}`}>ALL UNITS</button>
                          {allTags.map(tag => (
                              <button key={tag} onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter border-2 whitespace-nowrap transition-all ${selectedTagFilter === tag ? 'text-white border-transparent' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-500'}`} style={{ backgroundColor: selectedTagFilter === tag ? (tagColors[tag] || '#000') : 'transparent' }}>
                                  {tag}
                              </button>
                          ))}
                      </div>
                  </div>
                  
                  {isBulkMode && (
                      <div className="bg-orange-600 p-3 flex items-center gap-4 text-white animate-in slide-in-from-top-4">
                          <span className="text-[10px] font-black uppercase tracking-widest">{bulkSelectedIds.size} UNITS READY</span>
                          <div className="flex-1">
                              <input type="text" value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)} placeholder="BATCH TAG..." className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-white/50 focus:bg-white/20 outline-none" />
                          </div>
                          <button onClick={() => { 
                              if(!bulkTagInput.trim()) return; 
                              const ids = Array.from(bulkSelectedIds);
                              ids.forEach(id => {
                                  const tpl = library.find(t => t.id === id);
                                  if (tpl && !tpl.tags.includes(bulkTagInput.toLowerCase())) onSaveTemplate({ ...tpl, tags: [...tpl.tags, bulkTagInput.toLowerCase()] });
                              });
                              setIsBulkMode(false); setBulkSelectedIds(new Set()); setBulkTagInput('');
                          }} className="bg-white text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">APPLY</button>
                      </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                      {isAddingToList && <div className="p-3 bg-blue-600 text-white flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest">SELECT TASKS FOR LIST</span><button onClick={() => setIsAddingToList(false)} className="bg-white text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">DONE</button></div>}
                      {filteredLibrary.length === 0 ? <div className="py-20 text-center opacity-20"><Search className="w-16 h-16 mx-auto mb-4" /><p className="font-black uppercase tracking-[0.2em]">NO UNITS FOUND</p></div> : filteredLibrary.map(t => renderTaskRow(t, 'library'))}
                  </div>
              </div>
          )}
      </div>

      {editingTemplate && (
          <TaskEditor point={{ id: editingTemplate.id, title: editingTemplate.title, task: editingTemplate.task, location: { lat: 0, lng: 0 }, radiusMeters: 30, iconId: editingTemplate.iconId, isUnlocked: false, isCompleted: false, order: 0, tags: editingTemplate.tags, activationTypes: ['radius'], points: editingTemplate.points || 100, feedback: editingTemplate.feedback, settings: editingTemplate.settings }} onSave={handleSaveTemplate} onDelete={() => onDeleteTemplate(editingTemplate.id)} onClose={() => setEditingTemplate(null)} isTemplateMode={true} />
      )}
      {showAiGenerator && <AiTaskGenerator onClose={() => setShowAiGenerator(false)} onAddTasks={(tasks) => { tasks.forEach(t => onSaveTemplate(t)); setActiveTab('LIBRARY'); }} />}

      {showCreateListModal && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border-4 border-gray-100 dark:border-gray-800">
                   <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-center mb-8">NEW MISSION LIST</h3>
                   <form onSubmit={(e) => { e.preventDefault(); if(newListName.trim()) { onSaveList({ id: `list-${Date.now()}`, name: newListName, description: '', tasks: [], color: newListColor, iconId: newListIcon, createdAt: Date.now() }); setNewListName(''); setShowCreateListModal(false); } }} className="space-y-6">
                       <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">LIST DESIGNATION</label><input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="E.G. URBAN EXPLORER" className="w-full p-4 rounded-2xl border-2 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-black uppercase tracking-widest focus:border-blue-500 outline-none" autoFocus /></div>
                       <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">IDENTIFICATION COLOR</label><div className="flex flex-wrap gap-3">{COLORS.map(c => <button key={c} type="button" onClick={() => setNewListColor(c)} className={`w-8 h-8 rounded-xl border-4 transition-all ${newListColor === c ? 'border-blue-500 scale-110 shadow-lg' : 'border-white dark:border-gray-800'}`} style={{ backgroundColor: c }} />)}</div></div>
                       <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowCreateListModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest">CANCEL</button><button type="submit" disabled={!newListName.trim()} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-30">INITIALIZE</button></div>
                   </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default TaskMaster;
