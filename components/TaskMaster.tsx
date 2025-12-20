
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TaskTemplate, TaskList, GamePoint, IconId } from '../types';
import { X, Search, Plus, Tag, Layers, Edit2, Trash2, CheckSquare, FolderOpen, CheckCircle2, ChevronRight, ListChecks, Globe, Home, ArrowLeft, Wand2, FilePlus, Sparkles, Camera, Image as ImageIcon } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import TaskEditor from './TaskEditor';
import AiTaskGenerator from './AiTaskGenerator';
import { generateTaskFromImage } from '../services/ai';

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

const ICONS: IconId[] = ['default', 'star', 'flag', 'trophy', 'camera', 'question', 'skull', 'treasure'];

const getFlagEmoji = (lang?: string) => {
    if (!lang) return '🌐';
    if (lang.includes('Danish') || lang.includes('Dansk')) return '🇩🇰';
    if (lang.includes('English')) return '🇬🇧';
    if (lang.includes('German') || lang.includes('Deutsch')) return '🇩🇪';
    if (lang.includes('Spanish') || lang.includes('Español')) return '🇪🇸';
    if (lang.includes('French') || lang.includes('Français')) return '🇫🇷';
    return '🌐';
};

// Sub-component for individual list items to handle swipe logic
const TaskListItem: React.FC<{
    list: TaskList;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: (id: string) => void;
    isSelectionMode: boolean;
}> = ({ list, isSelected, onSelect, onDelete, isSelectionMode }) => {
    const ListIcon = ICON_COMPONENTS[list.iconId || 'default'];
    
    // Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const startX = useRef<number | null>(null);
    const isSwiping = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isSelectionMode) return;
        startX.current = e.touches[0].clientX;
        isSwiping.current = true;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startX.current === null || isSelectionMode) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;
        if (diff > 0) { // Only allow swipe right
            setDragOffset(Math.min(diff, 150));
        }
    };

    const handleTouchEnd = () => {
        if (isSelectionMode) return;
        
        if (dragOffset > 80) {
            // Trigger delete on swipe threshold
            if (confirm(`Delete list "${list.name}"? Tasks will remain in library.`)) {
                onDelete(list.id);
            }
            setDragOffset(0);
        } else {
            // Snap back
            setDragOffset(0);
        }
        startX.current = null;
        isSwiping.current = false;
    };

    // Explicit delete button handler
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Delete list "${list.name}"? Tasks will remain in library.`)) {
            onDelete(list.id);
        }
    };

    return (
        <div className="relative overflow-hidden mb-2 rounded-xl group select-none">
            {/* Swipe Background (Delete Action) */}
            <div 
                className="absolute inset-y-0 left-0 bg-red-500 flex items-center justify-start pl-4 text-white rounded-xl transition-all"
                style={{ width: `${Math.max(0, dragOffset)}px`, opacity: dragOffset > 0 ? 1 : 0 }}
            >
                <Trash2 className="w-5 h-5" />
            </div>

            {/* List Content */}
            <div 
                onClick={onSelect}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`p-3 rounded-xl border cursor-pointer transition-transform relative overflow-hidden bg-white dark:bg-gray-900 
                    ${isSelected 
                        ? 'ring-2 ring-amber-500 border-transparent bg-amber-50 dark:bg-amber-900/10' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                    }
                `}
                style={{ transform: `translateX(${dragOffset}px)` }}
            >
                <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: list.color }}></div>
                
                <div className="flex justify-between items-start pl-4">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0">
                            <ListIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-100 text-sm uppercase truncate">{list.name}</span>
                    </div>
                    
                    {!isSelectionMode && (
                        <button 
                            onClick={handleDeleteClick} 
                            className="p-2 -mr-2 -mt-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors z-10"
                            title="Delete List"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
                
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-4 flex items-center justify-between uppercase tracking-wide">
                    <span>{list.tasks.length} tasks</span>
                    <ChevronRight className={`w-4 h-4 opacity-50 ${isSelected ? 'text-amber-500' : ''}`} />
                </p>
            </div>
        </div>
    );
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
  
  // Library State
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  
  // Create from Image State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // Bulk Edit State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState('');
  
  // List State
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState(COLORS[0]);
  const [newListIcon, setNewListIcon] = useState<IconId>('default');
  const [isAddingToList, setIsAddingToList] = useState(false); 
  
  // Tag Editor
  const [showTagEditor, setShowTagEditor] = useState(false);

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

  // Extract unique tags
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      library.forEach(t => t.tags.forEach(tag => tags.add(tag)));
      return Array.from(tags).sort();
  }, [library]);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsAnalyzingImage(true);
      
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64 = reader.result as string;
          const task = await generateTaskFromImage(base64);
          
          if (task) {
              // Add to library directly or prompt? Let's open editor
              setEditingTemplate(task);
          } else {
              alert("Failed to analyze image. Try another.");
          }
          setIsAnalyzingImage(false);
      };
      reader.readAsDataURL(file);
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Tag Editor Logic
  const deleteTagGlobally = (tagToDelete: string) => {
      if (!confirm(`Delete tag "${tagToDelete}" from ALL tasks?`)) return;
      
      library.forEach(t => {
          if (t.tags.includes(tagToDelete)) {
              const newTags = t.tags.filter(tag => tag !== tagToDelete);
              onSaveTemplate({ ...t, tags: newTags });
          }
      });
      
      // Update colors
      const newColors = { ...tagColors };
      delete newColors[tagToDelete];
      setTagColors(newColors);
      localStorage.setItem('geohunt_tag_colors', JSON.stringify(newColors));
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
          iconId: newListIcon,
          createdAt: Date.now()
      };
      onSaveList(newList);
      setNewListName('');
  };

  const handleDeleteListHandler = (id: string) => {
      onDeleteList(id);
      if (selectedListId === id) setSelectedListId(null);
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
                  <div className={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${isBulkSelected ? 'bg-green-50 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                      {isBulkSelected && <CheckSquare className="w-3 h-3" />}
                  </div>
              )}

              {/* Icon */}
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-gray-500 dark:text-gray-400 group-hover:bg-white dark:group-hover:bg-gray-700 shadow-sm transition-colors">
                  <Icon className="w-5 h-5" />
              </div>

              {/* Text Info - Updated Layout */}
              <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <div className="md:col-span-4 min-w-0 flex items-center gap-2">
                      <span className="text-lg" title={template.settings?.language}>{getFlagEmoji(template.settings?.language)}</span>
                      <div className="min-w-0">
                          <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate text-sm" title={template.title}>{template.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 rounded text-gray-500 uppercase font-bold tracking-wider">{template.task.type.replace('_', ' ')}</span>
                          </div>
                      </div>
                  </div>
                  
                  {/* Combined Question and Tags */}
                  <div className="md:col-span-8 min-w-0 flex flex-col justify-center gap-1.5">
                       <div 
                         className="text-xs text-gray-400 truncate dark:text-gray-500"
                         dangerouslySetInnerHTML={{ __html: template.task.question.replace(/<[^>]*>/g, '') }}
                       />
                       <div className="flex flex-wrap gap-1">
                          {template.tags.slice(0, 5).map((tag, i) => {
                              const color = tagColors[tag] || '#94a3b8'; 
                              return (
                                <span 
                                    key={i} 
                                    className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium flex items-center gap-1 shadow-sm uppercase tracking-wide"
                                    style={{ backgroundColor: color }}
                                >
                                    {tag}
                                </span>
                              );
                          })}
                          {template.tags.length > 5 && (
                              <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded-full font-medium">+{template.tags.length - 5}</span>
                          )}
                       </div>
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
                <h1 className="text-xl font-bold uppercase tracking-wider">{isSelectionMode ? 'Add Tasks to Game' : 'TaskMaster'}</h1>
                <p className="text-xs text-white/70 uppercase tracking-wide">{isSelectionMode ? `${selectedTasksBuffer.length} SELECTED` : 'LIBRARY & LIST MANAGER'}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {isSelectionMode && selectedTasksBuffer.length > 0 && (
                <button 
                    onClick={handleConfirmSelection}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 uppercase tracking-wide"
                >
                    <CheckCircle2 className="w-4 h-4" /> ADD SELECTED
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
             onClick={() => { setActiveTab('CREATE'); setIsAddingToList(false); setIsBulkMode(false); }}
             className={`flex-1 py-4 font-bold text-sm uppercase tracking-wide border-b-2 transition-all ${activeTab === 'CREATE' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
              CREATE TASK
          </button>
          <button 
             onClick={() => { setActiveTab('LISTS'); setIsAddingToList(false); setIsBulkMode(false); }}
             className={`flex-1 py-4 font-bold text-sm uppercase tracking-wide border-b-2 transition-all ${activeTab === 'LISTS' ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
              TASK LISTS
          </button>
          <button 
             onClick={() => { setActiveTab('LIBRARY'); setIsAddingToList(false); }}
             className={`flex-1 py-4 font-bold text-sm uppercase tracking-wide border-b-2 transition-all ${activeTab === 'LIBRARY' ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
              ALL TASKS (LIBRARY)
          </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex relative">
          
          {/* CREATE TASK VIEW */}
          {activeTab === 'CREATE' && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 w-full animate-in fade-in duration-300 overflow-y-auto">
                  
                  {isAnalyzingImage && (
                      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center text-white flex-col gap-4 animate-in fade-in">
                          <Sparkles className="w-12 h-12 text-orange-400 animate-spin" />
                          <p className="font-bold text-lg uppercase tracking-wider animate-pulse">ANALYZING IMAGE WITH AI...</p>
                      </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                      <button 
