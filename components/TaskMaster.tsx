import React, { useState, useEffect, useMemo } from 'react';
import { TaskTemplate, TaskList, GamePoint } from '../types';
import { X, Search, Plus, Tag, Layers, Edit2, Trash2, CheckSquare, FolderOpen, Palette, CheckCircle2, ChevronRight, GripVertical, ArrowLeft, Wand2, Square, CheckSquare as CheckSquareFilled, ListChecks, Globe, Home } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import TaskEditor from './TaskEditor';
import AiTaskGenerator from './AiTaskGenerator';

interface TaskMasterProps {
  library: TaskTemplate[];
  lists: TaskList[];
  onClose: () => void;
  // Changed props for better DB integration
  onSaveTemplate: (template: TaskTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onSaveList: (list: TaskList) => void;
  onDeleteList: (id: string) => void;
  
  onCreateGameFromList: (listId: string) => void;
  
  // Selection Mode Props
  isSelectionMode?: boolean;
  onSelectTasksForGame?: (tasks: TaskTemplate[]) => void;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
];

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
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'LISTS'>('LISTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('All');
  
  // Library State
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  
  // Bulk Edit State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState('');
  
  // List State
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState(COLORS[0]);
  const [isAddingToList, setIsAddingToList] = useState(false); 
  
  // Game Selection Buffer
  const [selectedTasksBuffer, setSelectedTasksBuffer] = useState<TaskTemplate[]>([]);

  // Tag Colors Cache
  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadColors = () => {
        try {
            const stored = localStorage.getItem('geohunt_tag_colors');
            if (stored) {
                setTagColors(JSON.parse(stored));
            }
        } catch (e) { console.error("Failed to load tag colors", e); }
    };
    loadColors();
    window.addEventListener('storage', loadColors);
    return () => window.removeEventListener('storage', loadColors);
  }, [editingTemplate]);

  // Extract unique languages for filter
  const availableLanguages = useMemo(() => {
      const langs = new Set<string>();
      library.forEach(t => {
          if (t.settings?.language) langs.add(t.settings.language);
      });
      return Array.from(langs).sort();
  }, [library]);

  // Helpers
  const convertTemplateToPoint = (t: TaskTemplate): GamePoint => ({
    id: t.id,
    title: t.title,
    task: t.task,
    location: { lat: 0, lng: 0 }, 
    radiusMeters: 30,
    iconId: t.iconId,
    isUnlocked: false,
    isCompleted: false,
    order: 0,
    tags: t.tags,
    activationTypes: ['radius'],
    points: t.points || 100,
    feedback: t.feedback,
    settings: t.settings
  });

  const convertPointToTemplate = (p: GamePoint): TaskTemplate => ({
    id: p.id,
    title: p.title,
    task: p.task,
    tags: p.tags || [],
    iconId: p.iconId,
    createdAt: Date.now(),
    points: p.points,
    feedback: p.feedback,
    settings: p.settings
  });

  // Library Handlers
  const handleSaveTemplate = (point: GamePoint) => {
    const template = convertPointToTemplate(point);
    // If editing existing, keep ID and CreatedAt
    const existing = library.find(t => t.id === point.id);
    const finalTemplate = { 
        ...template, 
        id: existing ? existing.id : template.id,
        createdAt: existing ? existing.createdAt : Date.now() 
    };
    
    onSaveTemplate(finalTemplate);
    setEditingTemplate(null);
  };

  const handleCloneTemplate = (point: GamePoint) => {
      const template = convertPointToTemplate(point);
      const newTemplate = {
          ...template,
          id: `tpl-${Date.now()}`,
          title: `${template.title} (Copy)`,
          createdAt: Date.now()
      };
      onSaveTemplate(newTemplate);
      setEditingTemplate(null);
      alert("Task copied to Library!");
  };

  const handleDeleteTemplateHandler = (id: string) => {
    if (confirm('Are you sure? This will not remove tasks from existing games.')) {
        onDeleteTemplate(id);
        setEditingTemplate(null);
    }
  };

  const createNewTemplate = () => {
      const newTemplate: TaskTemplate = {
          id: `tpl-${Date.now()}`,
          title: 'New Task',
          task: { type: 'text', question: 'Question here...' },
          tags: [],
          iconId: 'default',
          createdAt: Date.now(),
          settings: {
              language: 'English',
              scoreDependsOnSpeed: false,
              showAnswerStatus: true,
              showCorrectAnswerOnMiss: false
          }
      };
      setEditingTemplate(newTemplate);
  };

  // Bulk Handlers
  const toggleBulkSelection = (id: string) => {
      const newSet = new Set(bulkSelectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setBulkSelectedIds(newSet);
  };

  const handleBulkAddTag = () => {
      if (!bulkTagInput.trim() || bulkSelectedIds.size === 0) return;
      
      const tag = bulkTagInput.trim();
      const ids = Array.from(bulkSelectedIds);
      
      // Update local storage for color persistence
      const newColors = { ...tagColors };
      if (!newColors[tag]) {
          newColors[tag] = COLORS[Math.floor(Math.random() * COLORS.length)];
          localStorage.setItem('geohunt_tag_colors', JSON.stringify(newColors));
          setTagColors(newColors);
      }

      // Update tasks
      ids.forEach(id => {
          const tpl = library.find(t => t.id === id);
          if (tpl && !tpl.tags.includes(tag)) {
              onSaveTemplate({ ...tpl, tags: [...tpl.tags, tag] });
          }
      });

      setBulkTagInput('');
      setBulkSelectedIds(new Set());
      setIsBulkMode(false);
      alert(`Tag "${tag}" added to ${ids.length} tasks.`);
  };

  // List Handlers
  const handleCreateList = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newListName.trim()) return;
      const newList: TaskList = {
          id: `list-${Date.now()}`,
          name: newListName,
          description: '',
          tasks: [],
          color: newListColor,
          createdAt: Date.now()
      };
      onSaveList(newList);
      setNewListName('');
  };

  const handleDeleteListHandler = (id: string) => {
      if (confirm('Delete this list? Tasks will remain in the library.')) {
          onDeleteList(id);
          if (selectedListId === id) setSelectedListId(null);
      }
  };

  const toggleTaskInList = (template: TaskTemplate) => {
      if (!selectedListId) return;
      const list = lists.find(l => l.id === selectedListId);
      if (!list) return;

      const exists = list.tasks.find(t => t.id === template.id);
      let newTasks;
      if (exists) {
          newTasks = list.tasks.filter(t => t.id !== template.id);
      } else {
          newTasks = [...list.tasks, template];
      }

      onSaveList({ ...list, tasks: newTasks });
  };

  const handleAiTasksAdded = (tasks: TaskTemplate[]) => {
      // Add all generated tasks to the library
      tasks.forEach(task => onSaveTemplate(task));
      
      // If we are currently editing a list, add them to that list as well
      if (selectedListId && isAddingToList) {
          const list = lists.find(l => l.id === selectedListId);
          if (list) {
              const newTasks = [...list.tasks];
              tasks.forEach(task => {
                  if (!newTasks.find(t => t.id === task.id)) {
                      newTasks.push(task);
                  }
              });
              onSaveList({ ...list, tasks: newTasks });
          }
      }
      
      // If in selection mode, maybe add to buffer? (Optional behavior)
      if (isSelectionMode) {
          setSelectedTasksBuffer(prev => [...prev, ...tasks]);
      }
  };

  // Selection Mode Handler
  const toggleSelectionBuffer = (template: TaskTemplate) => {
      if (selectedTasksBuffer.find(t => t.id === template.id)) {
          setSelectedTasksBuffer(prev => prev.filter(t => t.id !== template.id));
      } else {
          setSelectedTasksBuffer(prev => [...prev, template]);
      }
  };
  
  const handleConfirmSelection = () => {
      if (onSelectTasksForGame) {
          onSelectTasksForGame(selectedTasksBuffer);
          onClose();
      }
  };

  const filteredLibrary = library.filter(t => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = t.title.toLowerCase().includes(q) || 
                            t.tags.some(tag => tag.toLowerCase().includes(q));
      
      const matchesLanguage = languageFilter === 'All' || t.settings?.language === languageFilter;
      
      return matchesSearch && matchesLanguage;
  });

  const selectedList = lists.find(l => l.id === selectedListId);

  // Reusable Row Renderer
  const renderTaskRow = (template: TaskTemplate, context: 'list' | 'library') => {
      const Icon = ICON_COMPONENTS[template.iconId];
      
      const isInList = isAddingToList && selectedList?.tasks.some(t => t.id === template.id);
      const isSelected = isSelectionMode && selectedTasksBuffer.some(t => t.id === template.id);
      const isBufferSelected = selectedTasksBuffer.some(t => t.id === template.id);
      
      const isBulkSelected = isBulkMode && bulkSelectedIds.has(template.id);

      const handleClick = () => {
         if (context === 'library') {
             if (isBulkMode) toggleBulkSelection(template.id);
             else if (isAddingToList) toggleTaskInList(template);
             else if (isSelectionMode) toggleSelectionBuffer(template);
         } else if (context === 'list' && isSelectionMode) {
             toggleSelectionBuffer(template);
         }
      };

      let containerClass = "bg-white dark:bg-gray-900 border-b last:border-0 border-gray-100 dark:border-gray-800 p-3 flex items-center gap-4 transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 group";
      
      if (context === 'library') {
          if (isAddingToList || isSelectionMode || isBulkMode) {
              containerClass += " cursor-pointer";
              if (isInList || isSelected || isBulkSelected) {
                  containerClass = "bg-green-50 dark:bg-green-900/10 border-b border-green-100 dark:border-green-900/30 p-3 flex items-center gap-4 cursor-pointer";
              }
          }
      } else if (context === 'list') {
          if (isSelectionMode && isBufferSelected) {
              containerClass = "bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900/30 p-3 flex items-center gap-4 cursor-pointer";
          } else if (isSelectionMode) {
              containerClass += " cursor-pointer";
          }
      }

      return (
          <div 
            key={template.id} 
            className={containerClass}
            onClick={handleClick}
          >
              {/* Checkbox for Bulk Mode */}
              {context === 'library' && isBulkMode && (
                  <div className={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${isBulkSelected ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                      {isBulkSelected && <CheckSquareFilled className="w-3 h-3" />}
                  </div>
              )}

              {/* Icon */}
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-gray-500 dark:text-gray-400 group-hover:bg-white dark:group-hover:bg-gray-700 shadow-sm transition-colors">
                  <Icon className="w-5 h-5" />
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <div className="md:col-span-4 min-w-0 flex items-center gap-2">
                      <span className="text-lg" title={template.settings?.language}>{getFlagEmoji(template.settings?.language)}</span>
                      <div className="min-w-0">
                          <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate text-sm" title={template.title}>{template.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 rounded text-gray-500 uppercase font-bold tracking-wider">{template.task.type.replace('_', ' ')}</span>
                          </div>
                      </div>
                  </div>
                  
                  <div className="md:col-span-4 min-w-0 hidden md:block">
                       <div 
                         className="text-xs text-gray-400 truncate dark:text-gray-500"
                         dangerouslySetInnerHTML={{ __html: template.task.question.replace(/<[^>]*>/g, '') }}
                       />
                  </div>

                  <div className="md:col-span-4 min-w-0 flex flex-wrap gap-1 justify-end">
                      {template.tags.slice(0, 3).map((tag, i) => {
                          const color = tagColors[tag] || '#94a3b8'; 
                          return (
                            <span 
                                key={i} 
                                className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium flex items-center gap-1 shadow-sm"
                                style={{ backgroundColor: color }}
                            >
                                {tag}
                            </span>
                          );
                      })}
                      {template.tags.length > 3 && (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded-full font-medium">+{template.tags.length - 3}</span>
                      )}
                  </div>
              </div>

              {/* Actions */}
              {!isBulkMode && (
                  <div className="flex items-center gap-2 pl-2 border-l border-gray-100 dark:border-gray-800 ml-2">
                      {context === 'library' && (isAddingToList || isSelectionMode) ? (
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${(isInList || isSelected) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                            {(isInList || isSelected) && <CheckSquare className="w-3 h-3" />}
                        </div>
                      ) : context === 'list' && isSelectionMode ? (
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isBufferSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                            {isBufferSelected && <CheckSquare className="w-3 h-3" />}
                        </div>
                      ) : (
                          <>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingTemplate(template); }}
                                className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                                title="Edit"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            {context === 'list' && !isSelectionMode && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleTaskInList(template); }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    title="Remove from list"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                          </>
                      )}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="absolute inset-0 z-[1200] bg-gray-100 dark:bg-gray-900 flex flex-col animate-in fade-in duration-200">
      
      {/* Header */}
      <div className={`text-white p-4 shadow-md flex justify-between items-center z-10 ${isSelectionMode ? 'bg-orange-900' : 'bg-gray-800'}`}>
        <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <Home className="w-4 h-4" />
            </button>
            <div className={`p-2 rounded-lg ${isSelectionMode ? 'bg-orange-600' : 'bg-amber-500'}`}>
                {isSelectionMode ? <CheckSquare className="w-6 h-6 text-white" /> : <FolderOpen className="w-6 h-6 text-white" />}
            </div>
            <div>
                <h1 className="text-xl font-bold">{isSelectionMode ? 'Add Tasks to Game' : 'TaskMaster'}</h1>
                <p className="text-xs text-white/70">{isSelectionMode ? `${selectedTasksBuffer.length} selected` : 'Library & List Manager'}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {isSelectionMode && selectedTasksBuffer.length > 0 && (
                <button 
                    onClick={handleConfirmSelection}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2"
                >
                    <CheckCircle2 className="w-4 h-4" /> Add Selected
                </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex">
          <button 
             onClick={() => { setActiveTab('LISTS'); setIsAddingToList(false); setIsBulkMode(false); }}
             className={`flex-1 py-4 font-bold text-sm uppercase tracking-wide border-b-2 transition-all ${activeTab === 'LISTS' ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
              Task Lists
          </button>
          <button 
             onClick={() => { setActiveTab('LIBRARY'); setIsAddingToList(false); }}
             className={`flex-1 py-4 font-bold text-sm uppercase tracking-wide border-b-2 transition-all ${activeTab === 'LIBRARY' ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
              All Tasks (Library)
          </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex relative">
          
          {/* LISTS VIEW */}
          {activeTab === 'LISTS' && (
              <div className="flex-1 flex flex-col md:flex-row h-full w-full">
                  
                  {/* Left Sidebar: List of Lists */}
                  <div className={`w-full md:w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col ${selectedListId ? 'hidden md:flex' : 'flex'}`}>
                      {!isSelectionMode && (
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                            <form onSubmit={handleCreateList} className="space-y-3">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newListName}
                                        onChange={(e) => setNewListName(e.target.value)}
                                        placeholder="New List Name..."
                                        className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                    <button disabled={!newListName} type="submit" className="bg-amber-500 text-white p-2 rounded-lg hover:bg-amber-600 disabled:opacity-50">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* Color Picker */}
                                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                    {COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setNewListColor(c)}
                                            className={`w-6 h-6 rounded-full border-2 ${newListColor === c ? 'border-gray-600 dark:border-gray-300 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </form>
                        </div>
                      )}
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                          {lists.map(list => (
                              <div 
                                key={list.id}
                                onClick={() => setSelectedListId(list.id)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm relative overflow-hidden ${selectedListId === list.id ? 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-300 dark:ring-gray-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
                              >
                                  <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: list.color }}></div>
                                  <div className="flex justify-between items-start pl-4">
                                      <span className="font-bold text-gray-800 dark:text-gray-100">{list.name}</span>
                                      {!isSelectionMode && (
                                          <button onClick={(e) => { e.stopPropagation(); handleDeleteListHandler(list.id); }} className="text-gray-400 hover:text-red-500">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-4 flex items-center justify-between">
                                      <span>{list.tasks.length} tasks</span>
                                      <ChevronRight className="w-4 h-4 opacity-50" />
                                  </p>
                              </div>
                          ))}
                          {lists.length === 0 && (
                              <p className="text-center text-gray-400 text-sm py-10">No lists created yet.</p>
                          )}
                      </div>
                  </div>

                  {/* Right Panel: List Details */}
                  {selectedList ? (
                      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-800 h-full overflow-hidden absolute inset-0 md:static z-20">
                          <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-10" style={{ borderTop: `4px solid ${selectedList.color}` }}>
                              <div className="flex items-center gap-3">
                                  <button onClick={() => setSelectedListId(null)} className="md:hidden text-gray-500">
                                      <ArrowLeft className="w-6 h-6" />
                                  </button>
                                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">{selectedList.name}</h2>
                                  <span className="text-white text-xs px-2 py-1 rounded-full font-bold" style={{ backgroundColor: selectedList.color }}>
                                    {selectedList.tasks.length} Tasks
                                  </span>
                              </div>
                              <div className="flex gap-2">
                                {!isSelectionMode && (
                                    <button 
                                        onClick={() => { onCreateGameFromList(selectedList.id); onClose(); }}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm flex items-center gap-2"
                                    >
                                        <Layers className="w-4 h-4" /> Create Game
                                    </button>
                                )}
                                {isSelectionMode && (
                                    <button 
                                        onClick={() => {
                                            // Select all tasks in list
                                            selectedList.tasks.forEach(t => {
                                                if (!selectedTasksBuffer.find(st => st.id === t.id)) {
                                                    toggleSelectionBuffer(t);
                                                }
                                            });
                                        }}
                                        className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-sm flex items-center gap-2"
                                    >
                                        <CheckSquare className="w-4 h-4" /> Select All
                                    </button>
                                )}
                              </div>
                          </div>

                          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4">
                              <div className="flex justify-between items-center mb-3 px-1">
                                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tasks in List</h3>
                                  {!isSelectionMode && (
                                    <button 
                                        onClick={() => setIsAddingToList(true)}
                                        className="text-sm font-bold flex items-center gap-1 hover:underline"
                                        style={{ color: selectedList.color }}
                                    >
                                        <Plus className="w-4 h-4" /> Add from Library
                                    </button>
                                  )}
                              </div>

                              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                                  {selectedList.tasks.map(task => renderTaskRow(task, 'list'))}
                                  {selectedList.tasks.length === 0 && (
                                      <div className="text-center py-12 px-4">
                                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300 dark:text-gray-600">
                                              <Layers className="w-8 h-8" />
                                          </div>
                                          <p className="text-gray-500 dark:text-gray-400 font-medium">This list is empty.</p>
                                          {!isSelectionMode && (
                                              <button onClick={() => setIsAddingToList(true)} className="mt-2 text-sm font-bold" style={{ color: selectedList.color }}>
                                                  Browse Library to Add Tasks
                                              </button>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 flex-col gap-4">
                          <Layers className="w-16 h-16 opacity-20" />
                          <p>Select a list to view tasks</p>
                      </div>
                  )}
              </div>
          )}

          {/* LIBRARY VIEW (Or "Add to List" Overlay) */}
          {(activeTab === 'LIBRARY' || isAddingToList) && (
             <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-800 h-full w-full absolute inset-0 z-30 md:static ${isAddingToList ? 'animate-in slide-in-from-bottom-10' : ''}`}>
                 
                 {/* Library Header */}
                 <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-3 shadow-sm z-10">
                     <div className="flex items-center justify-between">
                         <h2 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                             {isAddingToList ? (
                                 <>
                                    <button onClick={() => setIsAddingToList(false)} className="bg-gray-100 dark:bg-gray-800 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
                                    Add to "{selectedList?.name}"
                                 </>
                             ) : 'Task Library'}
                         </h2>
                         {!isAddingToList && !isSelectionMode && (
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => { setIsBulkMode(!isBulkMode); setBulkSelectedIds(new Set()); }}
                                    className={`px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2 border transition-all ${isBulkMode ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <ListChecks className="w-4 h-4" /> Bulk Edit
                                </button>
                                <button 
                                    onClick={() => setShowAiGenerator(true)}
                                    className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-orange-700 flex items-center gap-2 shadow-sm border border-orange-500"
                                >
                                    <Wand2 className="w-4 h-4" /> AI Tasks
                                </button>
                                <button 
                                    onClick={createNewTemplate}
                                    className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-800 flex items-center gap-2 shadow-sm"
                                >
                                    <Plus className="w-4 h-4" /> New Task
                                </button>
                             </div>
                         )}
                     </div>
                     <div className="flex gap-2">
                         <div className="relative flex-1">
                             <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                             <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by title or tags..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-gray-900 dark:text-white"
                             />
                         </div>
                         <div className="relative w-40">
                             <Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                             <select
                                value={languageFilter}
                                onChange={(e) => setLanguageFilter(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-transparent rounded-lg focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-gray-900 dark:text-white appearance-none cursor-pointer"
                             >
                                <option value="All">All Languages</option>
                                {availableLanguages.map(lang => (
                                    <option key={lang} value={lang}>{getFlagEmoji(lang)} {lang.split(' ')[0]}</option>
                                ))}
                             </select>
                         </div>
                     </div>
                 </div>

                 {/* Library List */}
                 <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4 pb-24">
                     <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                         {filteredLibrary.map(template => renderTaskRow(template, 'library'))}
                         {filteredLibrary.length === 0 && (
                             <div className="py-20 text-center">
                                 <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300 dark:text-gray-600">
                                     <Search className="w-8 h-8" />
                                 </div>
                                 <p className="text-gray-500 dark:text-gray-400">No tasks found matching your search.</p>
                             </div>
                         )}
                     </div>
                 </div>

                 {/* Bulk Edit Floating Panel */}
                 {isBulkMode && bulkSelectedIds.size > 0 && (
                     <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl p-4 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-4 z-20">
                         <div className="flex items-center gap-3">
                             <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold px-3 py-1 rounded-full text-sm">
                                 {bulkSelectedIds.size} Selected
                             </div>
                             <span className="text-gray-500 dark:text-gray-400 text-sm">Add tag to selected tasks:</span>
                         </div>
                         <div className="flex items-center gap-2 flex-1 max-w-sm">
                             <div className="relative flex-1">
                                 <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                 <input 
                                    type="text" 
                                    value={bulkTagInput}
                                    onChange={(e) => setBulkTagInput(e.target.value)}
                                    placeholder="Enter tag name..."
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                 />
                             </div>
                             <button 
                                onClick={handleBulkAddTag}
                                disabled={!bulkTagInput.trim()}
                                className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
                             >
                                 Add Tag
                             </button>
                         </div>
                         <button onClick={() => setBulkSelectedIds(new Set())} className="text-gray-400 hover:text-red-500">
                             <X className="w-5 h-5" />
                         </button>
                     </div>
                 )}
             </div>
          )}

      </div>

      {/* Template Editor Modal */}
      {editingTemplate && (
          <TaskEditor 
            point={convertTemplateToPoint(editingTemplate)}
            onSave={handleSaveTemplate}
            onClone={handleCloneTemplate}
            onDelete={(id) => handleDeleteTemplateHandler(id)}
            onClose={() => setEditingTemplate(null)}
            isTemplateMode={true}
          />
      )}

      {/* AI Task Generator Modal */}
      {showAiGenerator && (
          <AiTaskGenerator 
              onClose={() => setShowAiGenerator(false)}
              onAddTasks={handleAiTasksAdded}
          />
      )}

    </div>
  );
};

export default TaskMaster;