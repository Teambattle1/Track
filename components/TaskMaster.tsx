
import React, { useState, useMemo, useRef } from 'react';
import { TaskTemplate, TaskList, IconId } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import TaskEditor from './TaskEditor';
import { 
    X, Search, Plus, Trash2, Edit2, CheckCircle, 
    LayoutList, Library, Palette, 
    PlayCircle, MapPin,
    Image as ImageIcon, Upload, Users, CheckSquare, MousePointerClick, AlertTriangle
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
    initialTab?: 'LISTS' | 'LIBRARY' | 'CREATE';
    isSelectionMode?: boolean;
    onSelectTasksForGame?: (tasks: TaskTemplate[]) => void;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];
const AVAILABLE_ICONS: IconId[] = ['default', 'star', 'flag', 'trophy', 'camera', 'question', 'skull', 'treasure'];

const TaskMaster: React.FC<TaskMasterProps> = ({
    library,
    lists,
    onClose,
    onSaveTemplate,
    onDeleteTemplate,
    onSaveList,
    onDeleteList,
    onCreateGameFromList,
    initialTab = 'LISTS',
    isSelectionMode = false,
    onSelectTasksForGame
}) => {
    const [activeTab, setActiveTab] = useState<'LISTS' | 'LIBRARY'>(initialTab === 'CREATE' ? 'LIBRARY' : initialTab as any);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    
    // List Bulk Selection
    const [isListSelectMode, setIsListSelectMode] = useState(false);
    const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

    // Template Editing
    const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

    // List Editing
    const [showListModal, setShowListModal] = useState(false);
    const [editingList, setEditingList] = useState<TaskList | null>(null);
    
    // Confirmation Modal State
    const [confirmation, setConfirmation] = useState<{ title: string; message: string; onConfirm: () => void; isDangerous?: boolean } | null>(null);
    
    // List Form State
    const [listName, setListName] = useState('');
    const [listDescription, setListDescription] = useState('');
    const [listColor, setListColor] = useState(COLORS[0]);
    const [listIcon, setListIcon] = useState<IconId>('default');
    const [listImageUrl, setListImageUrl] = useState<string | undefined>(undefined);
    const [listTasks, setListTasks] = useState<TaskTemplate[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredLibrary = useMemo(() => {
        if (!searchQuery) return library;
        const lower = searchQuery.toLowerCase();
        return library.filter(t => 
            t.title.toLowerCase().includes(lower) || 
            t.tags?.some(tag => tag.toLowerCase().includes(lower))
        );
    }, [library, searchQuery]);

    // SORTING LOGIC: Most Used First -> Then Newest
    const sortedLists = useMemo(() => {
        return [...lists].sort((a, b) => {
            const countA = a.usageCount || 0;
            const countB = b.usageCount || 0;
            if (countB !== countA) {
                return countB - countA; // Higher usage first
            }
            return b.createdAt - a.createdAt; // Newest first
        });
    }, [lists]);

    const handleOpenListModal = (list?: TaskList) => {
        if (isListSelectMode) return; // Disable modal in selection mode

        if (list) {
            setEditingList(list);
            setListName(list.name);
            setListDescription(list.description);
            setListColor(list.color);
            setListIcon(list.iconId || 'default');
            setListImageUrl(list.imageUrl);
            setListTasks(list.tasks);
        } else {
            setEditingList(null);
            setListName('');
            setListDescription('');
            setListColor(COLORS[0]);
            setListIcon('default');
            setListImageUrl(undefined);
            setListTasks([]);
        }
        setShowListModal(true);
    };

    const handleToggleListSelection = (id: string) => {
        setSelectedListIds(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            return [...prev, id];
        });
    };

    const handleBulkDeleteLists = () => {
        if (selectedListIds.length === 0) return;
        
        setConfirmation({
            title: "DELETE LISTS?",
            message: `Are you sure you want to delete ${selectedListIds.length} selected lists? This action cannot be undone.`,
            isDangerous: true,
            onConfirm: async () => {
                for (const id of selectedListIds) {
                    await onDeleteList(id);
                }
                setSelectedListIds([]);
                setIsListSelectMode(false);
                setConfirmation(null);
            }
        });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setListImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!listName.trim()) return;

        const newList: TaskList = {
            id: editingList ? editingList.id : `list-${Date.now()}`,
            name: listName,
            description: listDescription,
            color: listColor,
            iconId: listIcon,
            imageUrl: listImageUrl,
            tasks: listTasks,
            usageCount: editingList ? editingList.usageCount : 0,
            createdAt: editingList ? editingList.createdAt : Date.now()
        };

        await onSaveList(newList);
        setShowListModal(false);
    };

    // --- CRITICAL FIX: DELETE LIST FUNCTION USING CUSTOM CONFIRMATION ---
    const handleActualDelete = () => {
        if (!editingList) return;
        
        setConfirmation({
            title: `DELETE "${editingList.name}"?`,
            message: "This will remove the LIST grouping. The individual tasks will remain in your library.",
            isDangerous: true,
            onConfirm: async () => {
                setShowListModal(false);
                await onDeleteList(editingList.id);
                setConfirmation(null);
            }
        });
    };

    const handleSelectTemplate = (template: TaskTemplate) => {
        if (isSelectionMode) {
            if (selectedTemplateIds.includes(template.id)) {
                setSelectedTemplateIds(prev => prev.filter(id => id !== template.id));
            } else {
                setSelectedTemplateIds(prev => [...prev, template.id]);
            }
        } else if (showListModal) {
            // Add to list being edited
            setListTasks(prev => [...prev, template]);
        } else {
            setEditingTemplate(template);
        }
    };

    const handleFinishSelection = () => {
        if (onSelectTasksForGame) {
            const selected = library.filter(t => selectedTemplateIds.includes(t.id));
            onSelectTasksForGame(selected);
        }
    };

    const handleDeleteTemplate = (id: string) => {
        setConfirmation({
            title: "DELETE TEMPLATE?",
            message: "Are you sure you want to delete this task template permanently?",
            isDangerous: true,
            onConfirm: async () => {
                await onDeleteTemplate(id);
                setEditingTemplate(null);
                setConfirmation(null);
            }
        });
    };

    const handleCloneTemplate = async (t: TaskTemplate) => {
        const cloned = { ...t, id: `tpl-${Date.now()}`, title: `${t.title} (Copy)`, createdAt: Date.now() };
        await onSaveTemplate(cloned);
    };

    if (editingTemplate) {
        // Adapt TaskTemplate to GamePoint structure for TaskEditor
        const dummyPoint: any = {
            ...editingTemplate,
            location: { lat: 0, lng: 0 },
            radiusMeters: 30,
            activationTypes: ['radius'],
            isUnlocked: true,
            isCompleted: false,
            order: 0,
        };

        return (
            <>
                <TaskEditor 
                    point={dummyPoint} 
                    onSave={(p) => {
                        const updatedTemplate: TaskTemplate = {
                            id: editingTemplate.id,
                            title: p.title,
                            task: p.task,
                            tags: p.tags || [],
                            iconId: p.iconId,
                            createdAt: editingTemplate.createdAt,
                            points: p.points,
                            intro: p.shortIntro,
                            feedback: p.feedback,
                            settings: p.settings,
                            logic: p.logic
                        };
                        onSaveTemplate(updatedTemplate);
                        setEditingTemplate(null);
                    }}
                    onDelete={(id) => handleDeleteTemplate(id)}
                    onClose={() => setEditingTemplate(null)}
                    onClone={(p) => handleCloneTemplate(editingTemplate)}
                    isTemplateMode={true}
                />
                
                {/* Confirmation Modal Rendered over TaskEditor if needed */}
                {confirmation && (
                    <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-800 text-center animate-in zoom-in-95">
                            {confirmation.isDangerous && <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400"><AlertTriangle className="w-6 h-6" /></div>}
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">{confirmation.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{confirmation.message}</p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setConfirmation(null)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl uppercase tracking-wide hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    CANCEL
                                </button>
                                <button 
                                    onClick={confirmation.onConfirm}
                                    className={`flex-1 py-3 text-white font-bold rounded-xl uppercase tracking-wide shadow-lg transition-colors ${confirmation.isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    CONFIRM
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="fixed inset-0 z-[4000] bg-slate-950 flex flex-col animate-in fade-in">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <div className="flex items-center gap-3">
                    <Library className="w-6 h-6 text-orange-500" />
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-widest">TASK MASTER</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                            {isSelectionMode ? 'SELECT TASKS TO ADD' : 'MANAGE LIBRARY & LISTS'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Tabs */}
            {!isSelectionMode && (
                <div className="flex bg-slate-900 border-b border-slate-800">
                    <button 
                        onClick={() => setActiveTab('LISTS')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'LISTS' ? 'text-orange-500 border-b-2 border-orange-500 bg-slate-800/50' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                    >
                        <LayoutList className="w-4 h-4" /> TASK LISTS
                    </button>
                    <button 
                        onClick={() => setActiveTab('LIBRARY')}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'LIBRARY' ? 'text-blue-500 border-b-2 border-blue-500 bg-slate-800/50' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                    >
                        <Library className="w-4 h-4" /> ALL TASKS
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-slate-950 relative">
                
                {/* LISTS VIEW */}
                {activeTab === 'LISTS' && !isSelectionMode && (
                    <div className="h-full overflow-y-auto p-6 flex flex-col">
                        
                        <div className="flex gap-2 mb-6">
                            {!isListSelectMode ? (
                                <>
                                    <button 
                                        onClick={() => handleOpenListModal()}
                                        className="flex-[2] py-4 border-2 border-dashed border-slate-700 hover:border-orange-500 text-slate-500 hover:text-orange-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Plus className="w-5 h-5" /> CREATE NEW LIST
                                    </button>
                                    <button 
                                        onClick={() => { setIsListSelectMode(true); setSelectedListIds([]); }}
                                        className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-slate-700"
                                    >
                                        <CheckSquare className="w-5 h-5" /> SELECT
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => handleBulkDeleteLists()}
                                        disabled={selectedListIds.length === 0}
                                        className="flex-[2] py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
                                    >
                                        <Trash2 className="w-5 h-5" /> DELETE SELECTED ({selectedListIds.length})
                                    </button>
                                    <button 
                                        onClick={() => { setIsListSelectMode(false); setSelectedListIds([]); }}
                                        className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-slate-700"
                                    >
                                        CANCEL
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-20">
                            {sortedLists.map(list => {
                                const Icon = ICON_COMPONENTS[list.iconId || 'default'] || MapPin;
                                const isSelected = selectedListIds.includes(list.id);
                                
                                return (
                                    <div 
                                        key={list.id} 
                                        onClick={() => isListSelectMode ? handleToggleListSelection(list.id) : handleOpenListModal(list)} 
                                        className={`bg-slate-900 border rounded-2xl p-5 transition-all group relative overflow-hidden flex flex-col h-full cursor-pointer hover:shadow-xl ${
                                            isListSelectMode 
                                                ? (isSelected ? 'border-orange-500 ring-2 ring-orange-500/50 bg-orange-900/10' : 'border-slate-800 hover:border-slate-600')
                                                : 'border-slate-800 hover:border-slate-600 hover:-translate-y-1'
                                        }`}
                                    >
                                        {/* Selection Checkbox Overlay */}
                                        {isListSelectMode && (
                                            <div className="absolute top-3 right-3 z-20">
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-600 bg-slate-800'}`}>
                                                    {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
                                                </div>
                                            </div>
                                        )}

                                        {list.imageUrl && (
                                            <div className={`absolute inset-0 z-0 bg-cover bg-center transition-opacity ${isSelected ? 'opacity-30' : 'opacity-20'}`} style={{ backgroundImage: `url(${list.imageUrl})` }} />
                                        )}
                                        <div className="absolute top-0 left-0 w-1.5 h-full z-10" style={{ backgroundColor: list.color }}></div>
                                        <div className="pl-3 relative z-10 flex flex-col h-full">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-white text-lg uppercase truncate pr-8 flex items-center gap-2 shadow-sm">
                                                    <Icon className="w-5 h-5 text-slate-400" />
                                                    <span className="truncate">{list.name}</span>
                                                </h3>
                                                {/* Play Button Shortcut (Hidden in select mode) */}
                                                {!isListSelectMode && (
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-slate-900/80 rounded-lg backdrop-blur-sm p-1">
                                                        {onCreateGameFromList && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onCreateGameFromList(list.id); }} 
                                                                className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-green-400 hover:bg-slate-700 border border-slate-700" 
                                                                title="Start Game"
                                                            >
                                                                <PlayCircle className="w-4 h-4"/>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mb-4 line-clamp-2 h-8">{list.description || "No description."}</p>
                                            <div className="flex items-center justify-between mt-auto">
                                                <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded uppercase tracking-wide border border-slate-700">{list.tasks.length} TASKS</span>
                                                {/* USAGE COUNT INDICATOR */}
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase">
                                                    <Users className="w-3 h-3" /> {list.usageCount || 0}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* LIBRARY VIEW */}
                {(activeTab === 'LIBRARY' || isSelectionMode) && (
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-slate-800 bg-slate-900 flex gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search templates..." 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-white text-sm focus:border-blue-500 outline-none"
                                />
                            </div>
                            <button 
                                onClick={() => {
                                    const newTpl: any = {
                                        id: `tpl-${Date.now()}`,
                                        title: 'New Template',
                                        iconId: 'default',
                                        tags: [],
                                        createdAt: Date.now(),
                                        points: 100,
                                        task: { type: 'text', question: 'New Question' },
                                        feedback: { correctMessage: 'Correct!', showCorrectMessage: true, incorrectMessage: 'Incorrect', showIncorrectMessage: true, hint: '', hintCost: 10 },
                                        settings: { scoreDependsOnSpeed: false, language: 'English', showAnswerStatus: true, showCorrectAnswerOnMiss: false }
                                    };
                                    setEditingTemplate(newTpl);
                                }}
                                className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase text-xs tracking-wide flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> NEW
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                {filteredLibrary.map(tpl => {
                                    const Icon = ICON_COMPONENTS[tpl.iconId] || ICON_COMPONENTS.default;
                                    const isSelected = selectedTemplateIds.includes(tpl.id);
                                    
                                    return (
                                        <div 
                                            key={tpl.id} 
                                            onClick={() => handleSelectTemplate(tpl)}
                                            className={`bg-slate-900 border rounded-xl p-3 flex gap-3 cursor-pointer transition-all group ${isSelected ? 'border-blue-500 bg-blue-900/10' : 'border-slate-800 hover:border-slate-600'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                {isSelectionMode && isSelected ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`font-bold text-sm truncate uppercase ${isSelected ? 'text-blue-400' : 'text-white'}`}>{tpl.title}</h4>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {tpl.tags?.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase">{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {isSelectionMode && (
                            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedTemplateIds.length} SELECTED</span>
                                <button 
                                    onClick={handleFinishSelection}
                                    disabled={selectedTemplateIds.length === 0}
                                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ADD TO GAME
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* List Editor Modal */}
            {showListModal && (
                <div className="fixed inset-0 z-[4200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95">
                    <form onSubmit={handleSaveList} className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-800">
                       <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                           <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest">
                               {editingList ? 'EDIT LIST' : 'CREATE LIST'}
                           </h3>
                           <button type="button" onClick={() => setShowListModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500">
                               <X className="w-5 h-5" />
                           </button>
                       </div>
                       
                       <div className="p-6 flex-1 overflow-y-auto bg-white dark:bg-gray-900 space-y-6">
                           
                           {/* Image Upload */}
                           <div>
                               <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">COVER IMAGE</label>
                               <div 
                                   className="relative aspect-video w-full rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center cursor-pointer group overflow-hidden"
                                   onClick={() => fileInputRef.current?.click()}
                               >
                                   {listImageUrl ? (
                                       <>
                                           <img src={listImageUrl} alt="Cover" className="w-full h-full object-cover" />
                                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                               <Upload className="w-6 h-6 text-white" />
                                           </div>
                                       </>
                                   ) : (
                                       <div className="text-center text-gray-400">
                                           <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                                           <span className="text-[10px] font-black uppercase">CLICK TO UPLOAD</span>
                                       </div>
                                   )}
                                   <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                               </div>
                               {listImageUrl && (
                                   <button 
                                       type="button" 
                                       onClick={(e) => { e.stopPropagation(); setListImageUrl(undefined); }}
                                       className="text-[10px] text-red-500 font-bold uppercase mt-1 hover:underline block text-right"
                                   >
                                       Remove Image
                                   </button>
                               )}
                           </div>

                           <div>
                               <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">LIST NAME</label>
                               <input 
                                    type="text" 
                                    value={listName} 
                                    onChange={(e) => setListName(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-orange-500" 
                                    placeholder="e.g. City History"
                                    autoFocus
                               />
                           </div>
                           
                           <div>
                               <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">DESCRIPTION</label>
                               <textarea 
                                    value={listDescription} 
                                    onChange={(e) => setListDescription(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-orange-500" 
                                    placeholder="Optional description..."
                                    rows={3}
                               />
                           </div>

                           <div>
                               <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-2"><Palette className="w-3 h-3" /> IDENTIFICATION COLOR</label>
                               <div className="flex gap-2 flex-wrap">
                                   {COLORS.map(c => (
                                       <button 
                                            key={c} 
                                            type="button" 
                                            onClick={() => setListColor(c)} 
                                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${listColor === c ? 'border-white ring-2 ring-gray-400 dark:ring-gray-600 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                       />
                                   ))}
                               </div>
                           </div>

                           <div>
                               <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">LIST ICON</label>
                               <div className="grid grid-cols-8 gap-2">
                                   {AVAILABLE_ICONS.map(iconId => {
                                       const Icon = ICON_COMPONENTS[iconId];
                                       return (
                                           <button 
                                                key={iconId}
                                                type="button"
                                                onClick={() => setListIcon(iconId)}
                                                className={`p-2 rounded-xl border-2 flex items-center justify-center transition-all aspect-square ${listIcon === iconId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 hover:border-blue-300'}`}
                                           >
                                               <Icon className="w-5 h-5" />
                                           </button>
                                       );
                                   })}
                               </div>
                           </div>

                           <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                               <div className="flex justify-between items-center mb-3">
                                   <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">TASKS ({listTasks.length})</span>
                                   <button 
                                        type="button" 
                                        onClick={() => { setShowListModal(false); setActiveTab('LIBRARY'); setSearchQuery(''); }}
                                        className="text-[10px] font-black text-blue-500 hover:text-blue-600 uppercase tracking-wide flex items-center gap-1"
                                   >
                                       <Plus className="w-3 h-3" /> ADD FROM LIBRARY
                                   </button>
                               </div>
                               {listTasks.length === 0 ? (
                                   <p className="text-center text-xs text-gray-400 italic py-4">No tasks in list.</p>
                               ) : (
                                   <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                       {listTasks.map((t, idx) => (
                                           <div key={idx} className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg border border-gray-100 dark:border-gray-600">
                                               <span className="text-[10px] font-mono text-gray-400">{idx+1}.</span>
                                               <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate flex-1">{t.title}</span>
                                               <button 
                                                    type="button" 
                                                    onClick={() => setListTasks(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-gray-400 hover:text-red-500"
                                               >
                                                   <X className="w-3 h-3" />
                                               </button>
                                           </div>
                                       ))}
                                   </div>
                               )}
                           </div>
                       </div>

                       <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                           {editingList && (
                               <button 
                                    type="button" 
                                    onClick={handleActualDelete}
                                    className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors shadow-sm border border-red-200 dark:border-red-900/50"
                                    title="Delete List"
                               >
                                   <Trash2 className="w-5 h-5" />
                               </button>
                           )}
                           <button type="button" onClick={() => setShowListModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600">CANCEL</button>
                           <button type="submit" disabled={!listName.trim()} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-30 hover:bg-blue-700 transition-all border border-blue-500">
                               {editingList ? 'SAVE CHANGES' : 'CREATE LIST'}
                           </button>
                       </div>
                    </form>
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {confirmation && (
                <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-800 text-center animate-in zoom-in-95">
                        {confirmation.isDangerous && <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400"><AlertTriangle className="w-6 h-6" /></div>}
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">{confirmation.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{confirmation.message}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmation(null)}
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl uppercase tracking-wide hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                CANCEL
                            </button>
                            <button 
                                onClick={confirmation.onConfirm}
                                className={`flex-1 py-3 text-white font-bold rounded-xl uppercase tracking-wide shadow-lg transition-colors ${confirmation.isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                CONFIRM
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskMaster;
