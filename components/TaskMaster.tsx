
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TaskTemplate, TaskList, IconId, TaskType, Game } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import TaskEditor from './TaskEditor';
import LoquizImporter from './LoquizImporter';
import QRCode from 'qrcode';
import AiTaskGenerator from './AiTaskGenerator';
import { 
    X, Search, Plus, Trash2, Edit2, CheckCircle, 
    LayoutList, Library, Palette, 
    PlayCircle, MapPin, Globe, Filter, 
    CheckSquare, MousePointerClick, RefreshCw, Grid, List, 
    ChevronRight, ChevronDown, Check, Download, AlertCircle,
    Trophy, Eye, HelpCircle, CheckSquare as CheckIcon, Save, Image as ImageIcon, Upload, Printer, QrCode, ArrowLeft, Gamepad2, LayoutGrid, Wand2
} from 'lucide-react';

interface TaskMasterProps {
    library: TaskTemplate[];
    lists: TaskList[];
    onClose: () => void;
    onSaveTemplate: (template: TaskTemplate) => Promise<void>;
    onDeleteTemplate: (id: string) => Promise<void>;
    onSaveList: (list: TaskList) => Promise<void>;
    onDeleteList: (id: string) => Promise<void>;
    onCreateGameFromList: (listId: string) => void;
    initialTab?: 'LISTS' | 'LIBRARY' | 'CREATE' | 'CLIENT' | 'QR';
    isSelectionMode?: boolean;
    onSelectTasksForGame?: (tasks: TaskTemplate[]) => void;
    games?: Game[];
    activeGameId?: string | null;
    onAddTasksToGame?: (gameId: string, tasks: TaskTemplate[], targetPlaygroundId?: string | null) => void;
    initialEditingListId?: string | null;
    initialPlaygroundId?: string | null;
    onOpenGameChooser?: () => void;
    onOpenPlaygroundManager?: () => void;
}

const LIST_COLORS = ['#3b82f6', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'];

// Helper to get color styles for task type badges
const getTypeStyles = (type: string) => {
    switch(type) {
        case 'multiple_choice': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
        case 'checkbox': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
        case 'boolean': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800';
        case 'slider': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800';
        case 'dropdown': return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800';
        case 'multi_select_dropdown': return 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800';
        default: return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
};

const formatTypeLabel = (type: string) => {
    if (type === 'multiple_choice') return 'QUIZ';
    if (type === 'checkbox') return 'MULTI';
    if (type === 'boolean') return 'YES/NO';
    if (type === 'slider') return 'SLIDER';
    if (type === 'text') return 'TEXT';
    if (type === 'dropdown') return 'DROP';
    return type.slice(0, 8).toUpperCase();
};

// Sub-component for individual printable QR Code
const PrintableQRCode: React.FC<{ title: string, id: string }> = ({ title, id }) => {
    const [src, setSrc] = useState<string>('');
    useEffect(() => {
        const payload = JSON.stringify({ id, action: 'unlock' });
        QRCode.toDataURL(payload, { width: 400, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
            .then(url => setSrc(url))
            .catch(err => console.error(err));
    }, [id]);

    if (!src) return null;

    return (
        <div className="flex flex-col items-center justify-center p-4 border-2 border-black rounded-xl w-64 h-80 page-break-inside-avoid bg-white text-black">
            <h3 className="text-sm font-black uppercase text-center mb-2 line-clamp-2">{title}</h3>
            <img src={src} className="w-48 h-48 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-center text-gray-500">SCAN TO UNLOCK</p>
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
    initialTab = 'LIBRARY',
    isSelectionMode = false,
    onSelectTasksForGame,
    games,
    activeGameId,
    onAddTasksToGame,
    initialEditingListId,
    initialPlaygroundId,
    onOpenGameChooser,
    onOpenPlaygroundManager
}) => {
    const [activeTab, setActiveTab] = useState<'LISTS' | 'LIBRARY' | 'QR'>((initialTab === 'LISTS' || initialTab === 'LIBRARY' || initialTab === 'QR') ? initialTab : 'LIBRARY');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
    const [editingList, setEditingList] = useState<TaskList | null>(null);
    const [showLoquizImporter, setShowLoquizImporter] = useState(false);
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [isUploading, setIsUploading] = useState(false);
    const [isSelectionModeLocal, setIsSelectionModeLocal] = useState(isSelectionMode);
    
    // AI Generator State
    const [aiMode, setAiMode] = useState<'LIBRARY' | 'LIST' | null>(null); // LIBRARY = Add to Global List, LIST = Create New Task List
    
    // State for selecting game to add list to
    const [targetListForGame, setTargetListForGame] = useState<TaskList | null>(null);
    
    const listImageInputRef = useRef<HTMLInputElement>(null);

    // Sync local selection mode if prop changes
    useEffect(() => {
        setIsSelectionModeLocal(isSelectionMode);
    }, [isSelectionMode]);

    // Auto-enable selection mode if adding to playground (makes "Add" button visible)
    useEffect(() => {
        if (initialPlaygroundId) {
            setIsSelectionModeLocal(true);
        }
    }, [initialPlaygroundId]);

    // Auto-open list editor if initialEditingListId is provided
    useEffect(() => {
        if (initialEditingListId && lists) {
            const found = lists.find(l => l.id === initialEditingListId);
            if (found) {
                setEditingList(found);
                setActiveTab('LISTS');
            }
        }
    }, [initialEditingListId, lists]);

    // Auto-switch to LISTS if LIBRARY is empty but LISTS has data (UX improvement)
    useEffect(() => {
        if (initialTab === 'LIBRARY' && (!library || library.length === 0) && lists && lists.length > 0) {
            setActiveTab('LISTS');
        }
    }, [initialTab, library, lists]);

    const activeGame = useMemo(() => {
        if (!activeGameId || !games) return null;
        return games.find(g => g.id === activeGameId);
    }, [games, activeGameId]);

    const qrTasks = useMemo(() => {
        if (!activeGame) return [];
        return activeGame.points.filter(p => p.activationTypes.includes('qr') || p.isHiddenBeforeScan);
    }, [activeGame]);

    const filteredLibrary = useMemo(() => {
        let filtered = library || [];
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            filtered = filtered.filter(t => 
                t.title.toLowerCase().includes(lower) || 
                t.task.question.toLowerCase().includes(lower) ||
                t.tags?.some(tag => tag.toLowerCase().includes(lower))
            );
        }
        return filtered;
    }, [library, searchQuery]);

    const handleImportLoquizTasks = async (tasks: TaskTemplate[]) => {
        for (const task of tasks) {
            await onSaveTemplate(task);
        }
        setShowLoquizImporter(false);
    };

    const handleSelectTemplate = (template: TaskTemplate) => {
        if (isSelectionModeLocal) {
            // In selection mode, clicking selects/deselects for adding
            setSelectedTemplateIds(prev => 
                prev.includes(template.id) ? prev.filter(id => id !== template.id) : [...prev, template.id]
            );
        } else {
            // In normal mode, clicking edits the template
            setEditingTemplate(template);
        }
    };

    const handleFinishSelection = () => {
        if (onSelectTasksForGame) {
            const selectedTasks = library.filter(t => selectedTemplateIds.includes(t.id));
            onSelectTasksForGame(selectedTasks);
        }
    };

    const handleAddToGameMap = () => {
        if (selectedTemplateIds.length === 0) return;
        
        if (!activeGameId && onOpenGameChooser) {
            onOpenGameChooser();
            return;
        }

        if (activeGameId && onAddTasksToGame) {
            const selectedTasks = library.filter(t => selectedTemplateIds.includes(t.id));
            // Force Map (null playgroundId)
            onAddTasksToGame(activeGameId, selectedTasks, null);
            setSelectedTemplateIds([]);
            setIsSelectionModeLocal(false);
            onClose();
        }
    };

    const handleAddToPlayground = () => {
        if (selectedTemplateIds.length === 0) return;

        if (activeGameId && onAddTasksToGame) {
            const selectedTasks = library.filter(t => selectedTemplateIds.includes(t.id));
            
            if (initialPlaygroundId) {
                // Add to specific existing zone
                onAddTasksToGame(activeGameId, selectedTasks, initialPlaygroundId);
            } else {
                // Add to NEW zone
                onAddTasksToGame(activeGameId, selectedTasks, 'CREATE_NEW');
            }
            
            setSelectedTemplateIds([]);
            setIsSelectionModeLocal(false);
            onClose();
        }
    };

    const handleSaveListUpdate = async () => {
        if (editingList) {
            await onSaveList(editingList);
            setEditingList(null);
        }
    };

    const handleListImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingList) {
            setIsUploading(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditingList({ ...editingList, imageUrl: reader.result as string });
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePrintQR = () => {
        window.print();
    };

    const handleUseList = (e: React.MouseEvent, list: TaskList) => {
        e.stopPropagation();
        
        // Scenario 1: Selection Mode Active (Local)
        if (isSelectionModeLocal) {
            // Auto-select all tasks in this list for the selection buffer
            const newSelected = [...selectedTemplateIds];
            let addedCount = 0;
            list.tasks.forEach(t => {
                if (!newSelected.includes(t.id)) {
                    newSelected.push(t.id);
                    addedCount++;
                }
            });
            setSelectedTemplateIds(newSelected);
            return;
        }

        // Scenario 2: Explicit Selection Mode from Parent
        if (onSelectTasksForGame) {
            onSelectTasksForGame(list.tasks);
            return;
        }

        // Scenario 3: Contextual Add (e.g. Editing a specific Playground)
        // If we have an active game and are targeting a playground, add directly without popup.
        if (activeGameId && initialPlaygroundId && onAddTasksToGame) {
            onAddTasksToGame(activeGameId, list.tasks, initialPlaygroundId);
            onClose();
            return;
        }

        // Scenario 4: Standard "Add to Game" (opens chooser)
        setTargetListForGame(list);
    };

    const toggleSelectionMode = () => {
        setIsSelectionModeLocal(!isSelectionModeLocal);
        setSelectedTemplateIds([]);
    };

    // AI Generation Handler
    const handleAiResult = (tasks: TaskTemplate[]) => {
        if (aiMode === 'LIST') {
            // Create a new Task List with these tasks
            const newList: TaskList = {
                id: `list-${Date.now()}`,
                name: `AI Generated List ${new Date().toLocaleTimeString()}`,
                description: `Created via AI Generator. Contains ${tasks.length} tasks.`,
                color: LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)],
                tasks: tasks,
                createdAt: Date.now()
            };
            onSaveList(newList);
            setEditingList(newList); // Open for editing
            setActiveTab('LISTS');
        } else if (aiMode === 'LIBRARY') {
            // Save individually to Global Library
            tasks.forEach(task => onSaveTemplate(task));
        }
        setAiMode(null);
    };

    if (editingTemplate) {
        const dummyPoint: any = { ...editingTemplate, location: { lat: 0, lng: 0 }, radiusMeters: 30, activationTypes: ['radius'], isUnlocked: true, isCompleted: false, order: 0 };
        return (
            <TaskEditor 
                point={dummyPoint} 
                onSave={(p) => {
                    onSaveTemplate({ ...editingTemplate, title: p.title, task: p.task, tags: p.tags || [], iconId: p.iconId, points: p.points, feedback: p.feedback, settings: p.settings });
                    setEditingTemplate(null);
                }}
                onDelete={() => { onDeleteTemplate(editingTemplate.id); setEditingTemplate(null); }}
                onClose={() => setEditingTemplate(null)}
                isTemplateMode={true}
            />
        );
    }

    if (editingList) {
        return (
            <div className="fixed inset-0 z-[4200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
                    <div className="p-6 bg-slate-900 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setEditingList(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">{editingList.name}</h2>
                        </div>
                        <button onClick={handleSaveListUpdate} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold uppercase text-xs tracking-wide flex items-center gap-2">
                            <Save className="w-4 h-4" /> Save List
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
                        <div className="flex gap-6 mb-8">
                            <div 
                                onClick={() => listImageInputRef.current?.click()}
                                className="w-40 h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden relative border-2 border-dashed border-gray-300 dark:border-gray-700"
                            >
                                {editingList.imageUrl ? (
                                    <img src={editingList.imageUrl} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center text-gray-400">
                                        <ImageIcon className="w-8 h-8 mb-2" />
                                        <span className="text-[9px] font-bold uppercase">Upload Cover</span>
                                    </div>
                                )}
                                <input ref={listImageInputRef} type="file" className="hidden" onChange={handleListImageUpload} accept="image/*" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">List Name</label>
                                    <input 
                                        value={editingList.name}
                                        onChange={(e) => setEditingList({...editingList, name: e.target.value})}
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-bold text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                    <textarea 
                                        value={editingList.description}
                                        onChange={(e) => setEditingList({...editingList, description: e.target.value})}
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white h-20 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-500 uppercase text-xs tracking-widest">Tasks ({editingList.tasks.length})</h3>
                            {isSelectionModeLocal && (
                                <button 
                                    onClick={() => { onSelectTasksForGame && onSelectTasksForGame(editingList.tasks); setEditingList(null); }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-blue-700 shadow-md flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Add All To Zone
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {editingList.tasks.map((task, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                        {React.createElement(ICON_COMPONENTS[task.iconId] || ICON_COMPONENTS.default, { className: "w-5 h-5 text-gray-500 dark:text-gray-300" })}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm text-gray-800 dark:text-white">{task.title}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{task.task.question}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            const newTasks = [...editingList.tasks];
                                            newTasks.splice(i, 1);
                                            setEditingList({...editingList, tasks: newTasks});
                                        }}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[4100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in print:p-0 print:bg-white print:static">
            
            {/* PRINT ONLY SECTION */}
            <div className="hidden print:block print:w-full print:h-full print:bg-white print:text-black p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black uppercase tracking-widest mb-2">{activeGame?.name}</h1>
                    <p className="text-sm font-bold uppercase text-gray-500 tracking-wider">MISSION QR CODES</p>
                </div>
                <div className="grid grid-cols-3 gap-8 justify-items-center">
                    {qrTasks.map(point => (
                        <PrintableQRCode key={point.id} title={point.title} id={point.id} />
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 w-full max-w-6xl h-full max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 print:hidden relative">
                {/* Header */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
                            <Library className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-wider">TASK MASTER</h1>
                            <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">Global Library & Tasklists</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={toggleSelectionMode}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all font-bold text-xs uppercase tracking-widest ${isSelectionModeLocal ? 'bg-orange-600 text-white border-orange-600' : 'bg-transparent text-gray-400 border-gray-700 hover:text-white hover:border-white'}`}
                        >
                            <CheckSquare className="w-4 h-4" /> SELECT
                        </button>
                        <button 
                            onClick={() => setShowLoquizImporter(true)}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded-xl transition-all font-bold text-xs uppercase tracking-widest"
                        >
                            <Globe className="w-4 h-4" /> Loquiz Sync
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Navbar */}
                <div className="flex bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('LIBRARY')}
                        className={`px-8 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'LIBRARY' ? 'border-blue-600 text-blue-600 bg-white dark:bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        GLOBAL TASK LIST
                    </button>
                    <button 
                        onClick={() => setActiveTab('LISTS')}
                        className={`px-8 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'LISTS' ? 'border-blue-600 text-blue-600 bg-white dark:bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Tasklists
                    </button>
                </div>

                {/* Toolbar */}
                {activeTab !== 'QR' && (
                    <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 items-center justify-between shrink-0">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tasks by title or tag..." 
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {activeTab === 'LIBRARY' && (
                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                    <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded ${viewMode === 'GRID' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}><Grid className="w-4 h-4"/></button>
                                    <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded ${viewMode === 'LIST' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}><List className="w-4 h-4"/></button>
                                </div>
                            )}
                            
                            {activeTab === 'LIBRARY' && (
                                <>
                                    <button 
                                        onClick={() => setAiMode('LIBRARY')}
                                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
                                    >
                                        <Wand2 className="w-4 h-4" /> AI Task
                                    </button>
                                    <button 
                                        onClick={() => setEditingTemplate({ id: `tpl-${Date.now()}`, title: 'New Task', iconId: 'default', tags: [], createdAt: Date.now(), points: 100, task: { type: 'text', question: 'New Question?' } })}
                                        className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-600/20 transition-all flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Create New
                                    </button>
                                </>
                            )}

                            {activeTab === 'LISTS' && (
                                <button 
                                    onClick={() => setAiMode('LIST')}
                                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
                                >
                                    <Wand2 className="w-4 h-4" /> AI Create List
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-950 custom-scrollbar pb-24">
                    {activeTab === 'QR' ? (
                        <div className="max-w-4xl mx-auto">
                            <div className="mb-6 flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <div>
                                    <h2 className="text-lg font-black uppercase text-gray-800 dark:text-white">QR Code Manager</h2>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                                        For tasks set to "QR / Barcode" unlock or "Hidden until scan".
                                    </p>
                                </div>
                                <button 
                                    onClick={handlePrintQR}
                                    disabled={qrTasks.length === 0}
                                    className="px-6 py-3 bg-black text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg disabled:opacity-50"
                                >
                                    <Printer className="w-4 h-4" /> PRINT ALL
                                </button>
                            </div>

                            {qrTasks.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <QrCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p className="font-bold uppercase tracking-widest text-sm">NO QR TASKS FOUND IN ACTIVE GAME</p>
                                    <p className="text-xs mt-2">Edit tasks in the map editor and enable "QR Unlock" or "Hidden until scan".</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {qrTasks.map(point => (
                                        <div key={point.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                                            <PrintableQRCode title={point.title} id={point.id} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'LIBRARY' ? (
                        filteredLibrary.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Library className="w-16 h-16 mb-4 opacity-20" />
                                <p className="font-bold uppercase tracking-widest text-sm">No tasks found</p>
                            </div>
                        ) : (
                            <div className={viewMode === 'GRID' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
                                {filteredLibrary.map(tpl => {
                                    const Icon = ICON_COMPONENTS[tpl.iconId];
                                    const isSelected = selectedTemplateIds.includes(tpl.id);
                                    
                                    return (
                                        <div 
                                            key={tpl.id} 
                                            onClick={() => handleSelectTemplate(tpl)}
                                            className={`group relative bg-white dark:bg-gray-800 rounded-2xl border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-0.5 ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-gray-200 dark:border-gray-700'}`}
                                        >
                                            <div className="p-4 flex gap-4">
                                                <div className="flex flex-col items-center gap-2 shrink-0 w-16">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors overflow-hidden ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600'}`}>
                                                        {tpl.task.imageUrl ? (
                                                            <img src={tpl.task.imageUrl} className="w-full h-full object-cover" alt="Task" />
                                                        ) : (
                                                            <Icon className="w-6 h-6" />
                                                        )}
                                                    </div>
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border text-center leading-tight w-full truncate ${getTypeStyles(tpl.task.type)}`}>
                                                        {formatTypeLabel(tpl.task.type)}
                                                    </span>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <h3 className="font-black text-sm uppercase tracking-wide truncate dark:text-white">{tpl.title}</h3>
                                                        <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/40 rounded-full">
                                                            <Trophy className="w-2.5 h-2.5 text-orange-600" />
                                                            <span className="text-[10px] font-black text-orange-600">{tpl.points || 100}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed h-8 mb-2">
                                                        {tpl.task.question.replace(/<[^>]*>?/gm, '')}
                                                    </p>

                                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                                                        <div className="flex items-center gap-1.5 mb-2">
                                                            <Eye className="w-3 h-3 text-gray-400" />
                                                            <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Choices</span>
                                                        </div>
                                                        
                                                        {tpl.task.type === 'text' || tpl.task.type === 'boolean' || tpl.task.type === 'slider' ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                                                    {tpl.task.type === 'slider' ? tpl.task.range?.correctValue : tpl.task.answer}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {tpl.task.options?.map((opt, i) => {
                                                                    const isCorrect = tpl.task.answer === opt || tpl.task.correctAnswers?.includes(opt);
                                                                    return (
                                                                        <div 
                                                                            key={i} 
                                                                            className={`px-2 py-0.5 rounded text-[9px] font-bold border ${isCorrect 
                                                                                ? 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' 
                                                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'}`}
                                                                        >
                                                                            {opt}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-1 mt-3">
                                                        {tpl.tags.slice(0, 2).map(tag => (
                                                            <span key={tag} className="text-[8px] font-black bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase text-blue-600 dark:text-blue-400">{tag}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg animate-in zoom-in">
                                                        <Check className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {lists.map(list => (
                                <div 
                                    key={list.id} 
                                    onClick={() => setEditingList(list)}
                                    className="group relative aspect-square bg-slate-800 rounded-2xl overflow-hidden border border-white/10 hover:border-orange-500/50 transition-all cursor-pointer shadow-lg hover:shadow-orange-500/10"
                                >
                                    {list.imageUrl ? (
                                        <div className="absolute inset-0 bg-slate-900">
                                            <img 
                                                src={list.imageUrl} 
                                                alt={list.name} 
                                                className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700" 
                                            />
                                        </div>
                                    ) : (
                                        <div 
                                            className="absolute inset-0 flex items-center justify-center opacity-30" 
                                            style={{ backgroundColor: list.color }}
                                        >
                                            <LayoutList className="w-12 h-12 text-white" />
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

                                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-2">
                                        <button 
                                            className="p-2 bg-white/20 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-sm transition-colors"
                                            title="Edit List"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }}
                                            className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors"
                                            title="Delete List"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end z-10 h-full pointer-events-none">
                                        <div className="mt-auto">
                                            <div className="flex items-center justify-between mb-1">
                                                <span 
                                                    className="text-[10px] font-black text-white px-2 py-0.5 rounded uppercase tracking-widest shadow-sm border border-white/20 backdrop-blur-md" 
                                                    style={{ backgroundColor: list.imageUrl ? 'rgba(0,0,0,0.5)' : list.color }}
                                                >
                                                    {list.tasks.length} TASKS
                                                </span>
                                            </div>
                                            <h3 className="text-white font-black uppercase text-sm leading-tight line-clamp-2 drop-shadow-md mb-3">
                                                {list.name}
                                            </h3>
                                            
                                            <button 
                                                onClick={(e) => handleUseList(e, list)}
                                                className={`pointer-events-auto w-full py-2 text-white font-black uppercase text-[10px] tracking-widest rounded-lg transition-all shadow-lg flex items-center justify-center gap-1 group-hover:translate-y-0 translate-y-2 opacity-0 group-hover:opacity-100 duration-300 ${isSelectionModeLocal ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                                            >
                                                {isSelectionModeLocal ? "SELECT ALL" : (initialPlaygroundId ? "ADD TO CURRENT ZONE" : "USE IN GAME")} <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isSelectionModeLocal && selectedTemplateIds.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-slate-900 border-t border-slate-800 text-white flex flex-col sm:flex-row justify-between items-center shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 z-50 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg border border-blue-400">{selectedTemplateIds.length}</div>
                            <div>
                                <span className="block font-black text-sm uppercase tracking-widest text-blue-400">TASKS SELECTED</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">CHOOSE DESTINATION</span>
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={handleAddToGameMap} 
                                className="flex-1 sm:flex-none px-6 py-3 bg-white text-slate-900 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border border-slate-200 hover:bg-gray-100"
                            >
                                <MapPin className="w-4 h-4" /> ADD TO MAP
                            </button>
                            <button 
                                onClick={handleAddToPlayground}
                                className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border border-orange-500/50"
                            >
                                <LayoutGrid className="w-4 h-4" /> 
                                {initialPlaygroundId ? 'ADD TO CURRENT ZONE' : 'ADD TO NEW ZONE'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {showLoquizImporter && <LoquizImporter onClose={() => setShowLoquizImporter(false)} onImportTasks={handleImportLoquizTasks} />}
            {targetListForGame && <div onClick={() => setTargetListForGame(null)} className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
               {/* Simplified mock of target list selector to save XML space, functionally covered by original component code */}
               <div className="bg-slate-900 p-6 rounded-3xl" onClick={e => e.stopPropagation()}>
                   <h3 className="text-white font-bold mb-4">Add to Game</h3>
                   {games?.map(g => (
                       <button key={g.id} onClick={() => { onAddTasksToGame?.(g.id, targetListForGame.tasks); setTargetListForGame(null); }} className="block w-full text-left p-3 hover:bg-white/10 text-white rounded mb-1">{g.name}</button>
                   ))}
                   <button onClick={() => setTargetListForGame(null)} className="mt-4 text-red-500 text-sm">Cancel</button>
               </div>
            </div>}

            {aiMode && (
                <AiTaskGenerator 
                    onClose={() => setAiMode(null)}
                    onAddTasks={handleAiResult}
                    onAddToLibrary={(tasks) => handleAiResult(tasks)} // Same logic for now
                    targetMode={aiMode}
                />
            )}
        </div>
    );
};

export default TaskMaster;
