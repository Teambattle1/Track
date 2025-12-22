import React, { useState, useMemo, useRef } from 'react';
import { TaskTemplate, TaskList, IconId, TaskType } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import TaskEditor from './TaskEditor';
import LoquizImporter from './LoquizImporter';
import { 
    X, Search, Plus, Trash2, Edit2, CheckCircle, 
    LayoutList, Library, Palette, 
    PlayCircle, MapPin, Globe, Filter, 
    CheckSquare, MousePointerClick, RefreshCw, Grid, List, 
    ChevronRight, ChevronDown, Check, Download, AlertCircle,
    Trophy, Eye, HelpCircle, CheckSquare as CheckIcon, Save, Image as ImageIcon, Upload
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
    initialTab?: 'LISTS' | 'LIBRARY' | 'CREATE' | 'CLIENT';
    isSelectionMode?: boolean;
    onSelectTasksForGame?: (tasks: TaskTemplate[]) => void;
}

const LIST_COLORS = ['#3b82f6', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'];

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
    onSelectTasksForGame
}) => {
    const [activeTab, setActiveTab] = useState<'LISTS' | 'LIBRARY'>(initialTab === 'LISTS' ? 'LISTS' : 'LIBRARY');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
    const [editingList, setEditingList] = useState<TaskList | null>(null);
    const [showLoquizImporter, setShowLoquizImporter] = useState(false);
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [isUploading, setIsUploading] = useState(false);
    
    const listImageInputRef = useRef<HTMLInputElement>(null);

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
        if (isSelectionMode) {
            setSelectedTemplateIds(prev => 
                prev.includes(template.id) ? prev.filter(id => id !== template.id) : [...prev, template.id]
            );
        } else {
            setEditingTemplate(template);
        }
    };

    const handleFinishSelection = () => {
        if (onSelectTasksForGame) {
            const selectedTasks = library.filter(t => selectedTemplateIds.includes(t.id));
            onSelectTasksForGame(selectedTasks);
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

    return (
        <div className="fixed inset-0 z-[4100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in">
            {showLoquizImporter && (
                <LoquizImporter 
                    onClose={() => setShowLoquizImporter(false)} 
                    onImportTasks={handleImportLoquizTasks} 
                />
            )}

            {/* LIST EDITOR OVERLAY */}
            {editingList && (
                <div className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 animate-in zoom-in-95">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl" style={{ backgroundColor: editingList.color }}>
                                    <LayoutList className="w-6 h-6 text-white" />
                                </div>
                                <h2 className="text-xl font-black uppercase tracking-widest">Edit Tasklist</h2>
                            </div>
                            <button onClick={() => setEditingList(null)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            {/* COVER IMAGE SECTION */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-widest">COVER IMAGE</label>
                                <div 
                                    onClick={() => listImageInputRef.current?.click()}
                                    className="relative aspect-video rounded-3xl bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/10 transition-all overflow-hidden group"
                                >
                                    {editingList.imageUrl ? (
                                        <>
                                            <img src={editingList.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Tasklist Cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Upload className="w-8 h-8 text-white" />
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingList({...editingList, imageUrl: undefined}); }}
                                                className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-center">
                                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400 group-hover:text-blue-500 transition-colors">
                                                <ImageIcon className="w-6 h-6" />
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Upload Landscape Photo</span>
                                        </div>
                                    )}
                                    <input 
                                        type="file" 
                                        ref={listImageInputRef} 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handleListImageUpload}
                                    />
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center">
                                            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-widest">TASKLIST NAME</label>
                                <input 
                                    type="text" 
                                    value={editingList.name} 
                                    onChange={e => setEditingList({...editingList, name: e.target.value})}
                                    className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-2 dark:border-gray-700 font-bold outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-all uppercase"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-widest">DESCRIPTION</label>
                                <textarea 
                                    value={editingList.description} 
                                    onChange={e => setEditingList({...editingList, description: e.target.value})}
                                    className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-2 dark:border-gray-700 text-sm outline-none focus:border-blue-500 text-gray-700 dark:text-gray-300 transition-all h-24 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-widest">THEME COLOR</label>
                                <div className="flex flex-wrap gap-2">
                                    {LIST_COLORS.map(color => (
                                        <button 
                                            key={color} 
                                            onClick={() => setEditingList({...editingList, color})}
                                            className={`w-8 h-8 rounded-xl border-4 transition-all ${editingList.color === color ? 'border-gray-900 dark:border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex gap-4 shrink-0">
                            <button onClick={() => setEditingList(null)} className="flex-1 py-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-100 transition-all">Cancel</button>
                            <button onClick={handleSaveListUpdate} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 transition-all">
                                <Save className="w-4 h-4" /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 w-full max-w-6xl h-full max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
                {/* Header */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
                            <Library className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-wider">TASK MASTER</h1>
                            <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">Library & Tasklists</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                <div className="flex bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0">
                    <button 
                        onClick={() => setActiveTab('LIBRARY')}
                        className={`px-8 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'LIBRARY' ? 'border-blue-600 text-blue-600 bg-white dark:bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Task Library
                    </button>
                    <button 
                        onClick={() => setActiveTab('LISTS')}
                        className={`px-8 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'LISTS' ? 'border-blue-600 text-blue-600 bg-white dark:bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Tasklists
                    </button>
                </div>

                {/* Toolbar */}
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
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                            <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded ${viewMode === 'GRID' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}><Grid className="w-4 h-4"/></button>
                            <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded ${viewMode === 'LIST' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}><List className="w-4 h-4"/></button>
                        </div>
                        <button 
                            onClick={() => setEditingTemplate({ id: `tpl-${Date.now()}`, title: 'New Task', iconId: 'default', tags: [], createdAt: Date.now(), points: 100, task: { type: 'text', question: 'New Question?' } })}
                            className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-600/20 transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Create New
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950 custom-scrollbar">
                    {activeTab === 'LIBRARY' ? (
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
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600'}`}>
                                                    <Icon className="w-6 h-6" />
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

                                                    {/* Answer Intel Section */}
                                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                                                        <div className="flex items-center gap-1.5 mb-2">
                                                            <Eye className="w-3 h-3 text-gray-400" />
                                                            <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Answer Intel</span>
                                                        </div>
                                                        
                                                        {/* Options / Answer display */}
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
                                                        <span className="text-[8px] font-black bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded uppercase text-gray-500">{tpl.task.type}</span>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {lists.map(list => (
                                <div 
                                    key={list.id} 
                                    onClick={() => setEditingList(list)}
                                    className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col hover:shadow-xl transition-all group relative cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-lg shadow-black/5`} style={{ backgroundColor: list.color }}>
                                            <LayoutList className="w-8 h-8 text-white" />
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }} 
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                                title="Delete List"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-black uppercase tracking-tight dark:text-white truncate pr-6 group-hover:text-blue-600 transition-colors">{list.name}</h3>
                                        <Edit2 className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="text-xs text-gray-500 mb-6 flex-1 line-clamp-2 italic">
                                        {list.description || "No description provided."}
                                    </p>
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50 dark:border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-white px-2 py-1 rounded uppercase shadow-sm" style={{ backgroundColor: list.color }}>
                                                {list.tasks.length} Tasks
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onCreateGameFromList(list.id); }}
                                            className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-all"
                                        >
                                            Launch Mission <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Selection Bar */}
                {isSelectionMode && selectedTemplateIds.length > 0 && (
                    <div className="p-6 bg-blue-600 text-white flex justify-between items-center shadow-2xl animate-in slide-in-from-bottom duration-300 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-lg">{selectedTemplateIds.length}</div>
                            <span className="font-black text-sm uppercase tracking-widest">Tasks selected for mission</span>
                        </div>
                        <button 
                            onClick={handleFinishSelection} 
                            className="px-8 py-3 bg-white text-blue-600 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                        >
                            ADD TO GAME <RefreshCw className="inline-block ml-2 w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskMaster;