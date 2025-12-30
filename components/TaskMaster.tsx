import React, { useState, useEffect, useRef } from 'react';
import { TaskList, TaskTemplate, Game, GamePoint, Coordinate } from '../types';
import * as db from '../services/db';
import { uploadImage } from '../services/storage'; // IMPORTED
import {
    X, Plus, Search, Layers, Library, Edit2, Trash2, ArrowLeft, Save,
    ImageIcon, Upload, Filter, Tag, LayoutList, RefreshCw, Check, Copy,
    ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Gamepad2, Settings, Loader2
} from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import AiTaskGenerator from './AiTaskGenerator';
import LoquizImporter from './LoquizImporter';
import AccountTags from './AccountTags';
import Dashboard from './Dashboard';
import TaskEditor from './TaskEditor';
import { runCompleteLanguageMigration } from '../services/languageMigrationScript'; 

interface TaskMasterProps {
    onClose: () => void;
    onImportTasks: (tasks: TaskTemplate[], gameId?: string) => void;
    onImportTaskList?: (list: TaskList, gameId?: string) => void;
    taskLists: TaskList[];
    onUpdateTaskLists: (lists: TaskList[]) => void;
    taskLibrary: TaskTemplate[]; // Cached library from App
    onUpdateTaskLibrary: (library: TaskTemplate[]) => void; // Update cache
    games: Game[];
    activeGame?: Game | null;  // Active game to add tasks to
    initialTab?: 'LIBRARY' | 'LISTS' | 'TAGS' | 'CLIENT';
    initialModal?: 'AI' | 'LOQUIZ' | null;
    onDeleteTagGlobally?: (tagName: string) => Promise<void>;
    onRenameTagGlobally?: (oldTag: string, newTag: string) => Promise<void>;
}

const TaskMaster: React.FC<TaskMasterProps> = ({
    onClose,
    onImportTasks,
    onImportTaskList,
    taskLists,
    onUpdateTaskLists,
    taskLibrary: cachedLibrary,
    onUpdateTaskLibrary,
    games,
    activeGame,
    initialTab = 'LIBRARY',
    initialModal = null,
    onDeleteTagGlobally,
    onRenameTagGlobally
}) => {
    const [tab, setTab] = useState<'LIBRARY' | 'LISTS' | 'TAGS' | 'CLIENT'>(initialTab);
    const [library, setLibrary] = useState<TaskTemplate[]>(cachedLibrary || []); // Initialize with cache or empty array
    const [loading, setLoading] = useState(false); // No loading needed on mount
    const [searchQuery, setSearchQuery] = useState('');

    // Editor State
    const [editingList, setEditingList] = useState<TaskList | null>(null);
    const [isSelectingForCurrentList, setIsSelectingForCurrentList] = useState(false);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

    // Modals
    const [showAiGen, setShowAiGen] = useState(initialModal === 'AI');
    const [showLoquiz, setShowLoquiz] = useState(initialModal === 'LOQUIZ');

    // View State
    const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'list'>('list');

    // Template Editing
    const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

    // Task editing within a list
    const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);

    // Sorting and Filtering
    const [sortColumn, setSortColumn] = useState<'title' | 'question' | 'language' | 'used' | 'tags'>('title');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
    const [languageFilters, setLanguageFilters] = useState<Record<string, boolean>>({});
    const [taskListFilter, setTaskListFilter] = useState<string>(''); // Filter by task list ID
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showGameSelector, setShowGameSelector] = useState(false);
    const [gameForBulkAdd, setGameForBulkAdd] = useState<Game | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [singleTaskGameSelector, setSingleTaskGameSelector] = useState<{taskId: string} | null>(null);

    // Pending imports - store what needs to be imported
    const [pendingImportTasks, setPendingImportTasks] = useState<TaskTemplate[] | null>(null);
    const [pendingImportList, setPendingImportList] = useState<TaskList | null>(null);
    const [showGameSelectorForImport, setShowGameSelectorForImport] = useState(false);

    // ADD TO destination selector (for bulk and single task)
    const [showAddToModal, setShowAddToModal] = useState(false);
    const [addToTasksSelection, setAddToTasksSelection] = useState<TaskTemplate[]>([]);
    const [addToDestinationType, setAddToDestinationType] = useState<'GAME' | 'PLAYZONE' | 'TASKLIST' | null>(null);
    const [showDestinationSelector, setShowDestinationSelector] = useState(false);

    // Refs
    const listImageInputRef = useRef<HTMLInputElement>(null);

    // Language Migration State
    const [showMigrationModal, setShowMigrationModal] = useState(false);
    const [migrationRunning, setMigrationRunning] = useState(false);
    const [migrationLog, setMigrationLog] = useState<string[]>([]);
    const [migrationResults, setMigrationResults] = useState<{totalUpdated: number; totalErrors: number} | null>(null);

    const handleRunMigration = async () => {
        setMigrationRunning(true);
        setMigrationLog(['Starting language migration...']);

        try {
            const results = await runCompleteLanguageMigration();
            setMigrationLog(results.log);
            setMigrationResults({
                totalUpdated: results.totalUpdated,
                totalErrors: results.totalErrors
            });

            // Reload library to show updated languages
            await loadLibrary();
        } catch (error: any) {
            setMigrationLog(prev => [...prev, `Error: ${error.message}`]);
        } finally {
            setMigrationRunning(false);
        }
    };

    // Initial load: fetch library if both cache and local state are empty
    useEffect(() => {
        if (library.length === 0 && (!cachedLibrary || cachedLibrary.length === 0)) {
            loadLibrary();
        }
    }, []); // Run only on mount

    // Sync with cached library from App when it updates
    useEffect(() => {
        if (cachedLibrary && Array.isArray(cachedLibrary) && cachedLibrary.length > 0 && library.length === 0) {
            setLibrary(cachedLibrary);
        }
    }, [cachedLibrary]);

    const loadLibrary = async (forceRefresh = false) => {
        if (!forceRefresh && cachedLibrary && Array.isArray(cachedLibrary) && cachedLibrary.length > 0) {
            // Use cache if available
            setLibrary(cachedLibrary);
            return;
        }

        setLoading(true);
        const data = await db.fetchLibrary();
        setLibrary(data);
        onUpdateTaskLibrary(data); // Update cache in App
        setLoading(false);
    };

    const handleCreateList = () => {
        setEditingList({
            id: `list-${Date.now()}`,
            name: 'New Task List',
            description: '',
            tasks: [],
            color: '#3b82f6',
            createdAt: Date.now()
        });
    };

    const handleSaveListUpdate = async () => {
        if (!editingList) return;
        await db.saveTaskList(editingList);
        const updatedLists = taskLists.map(l => l.id === editingList.id ? editingList : l);
        if (!taskLists.find(l => l.id === editingList.id)) {
            updatedLists.push(editingList);
        }
        onUpdateTaskLists(updatedLists);
        setEditingList(null);
    };

    const handleListImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingList) {
            const url = await uploadImage(file);
            if (url) {
                setEditingList({ ...editingList, imageUrl: url });
            }
        }
    };

    const handleAddSelectedToEditingList = () => {
        if (!editingList) return;
        const selected = library.filter(t => selectedTemplateIds.includes(t.id));
        setEditingList({
            ...editingList,
            tasks: [...editingList.tasks, ...selected]
        });
        setSelectedTemplateIds([]);
        setIsSelectingForCurrentList(false);
    };

    const toggleSelection = (id: string) => {
        setSelectedTemplateIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    // Convert TaskTemplate to GamePoint for editing
    const templateToGamePoint = (template: TaskTemplate): GamePoint => {
        return {
            id: template.id,
            title: template.title,
            task: template.task,
            location: { lat: 0, lng: 0 },
            radiusMeters: 50,
            activationTypes: ['click'],
            iconId: template.iconId,
            points: template.points || 10,
            isUnlocked: true,
            isCompleted: false,
            order: 0,
            tags: template.tags,
            feedback: template.feedback,
            settings: template.settings,
            logic: template.logic
        };
    };

    // Convert GamePoint back to TaskTemplate
    const gamePointToTemplate = (point: GamePoint): TaskTemplate => {
        return {
            id: point.id,
            title: point.title,
            task: point.task,
            tags: point.tags || [],
            iconId: point.iconId,
            createdAt: Date.now(),
            points: point.points,
            intro: point.shortIntro,
            feedback: point.feedback,
            settings: point.settings,
            logic: point.logic
        };
    };

    // Handle saving edited template
    const handleSaveTemplate = async (editedPoint: GamePoint) => {
        const updatedTemplate = gamePointToTemplate(editedPoint);
        await db.saveTemplate(updatedTemplate);
        const updatedLibrary = library.map(t => t.id === updatedTemplate.id ? updatedTemplate : t);
        onUpdateTaskLibrary(updatedLibrary); // Update cache
        setLibrary(updatedLibrary);
        setEditingTemplate(null);
    };

    // Handle saving a task being edited within a list
    const handleSaveTaskInList = async (editedPoint: GamePoint) => {
        if (editingTaskIndex === null || !editingList) return;

        const updatedTemplate = gamePointToTemplate(editedPoint);
        const updatedTasks = [...editingList.tasks];
        updatedTasks[editingTaskIndex] = updatedTemplate;

        setEditingList({
            ...editingList,
            tasks: updatedTasks
        });
        setEditingTaskIndex(null);
    };

    // All available languages in the app
    const AVAILABLE_LANGUAGES = ['English', 'Danish', 'German', 'Spanish', 'French', 'Swedish', 'Norwegian', 'Dutch', 'Belgian', 'Hebrew'];

    const getLanguagesFromTasks = (tasks: TaskTemplate[]) => {
        const languages = new Set<string>();
        tasks.forEach(task => {
            if (task.settings?.language) {
                languages.add(task.settings.language);
            }
        });
        return Array.from(languages);
    };

    // Get all languages actually used in the library
    const getUsedLanguagesInLibrary = (): string[] => {
        const used = new Set<string>();
        if (library && Array.isArray(library)) {
            library.forEach(task => {
                if (task.settings?.language) {
                    used.add(task.settings.language);
                }
            });
        }
        return Array.from(used).sort();
    };

    const getLanguageFlag = (language: string): string => {
        const flagMap: Record<string, string> = {
            'English': '🇬🇧',
            'Danish': '🇩🇰',
            'German': '🇩🇪',
            'Spanish': '🇪🇸',
            'French': '🇫🇷',
            'Swedish': '🇸🇪',
            'Norwegian': '🇳🇴',
            'Dutch': '🇳🇱',
            'Belgian': '🇧🇪',
            'Hebrew': '🇮🇱'
        };
        return flagMap[language] || '🌐';
    };

    const countGameUsage = (listId: string): number => {
        let count = 0;
        games.forEach(game => {
            // Check if any task in the game is from this tasklist
            // This is a simple check - you may want to track this more explicitly
            if (game.taskListIds && game.taskListIds.includes(listId)) {
                count++;
            }
        });
        return count;
    };

    const countTaskUsage = (taskId: string): number => {
        if (!library || !Array.isArray(library)) return 0;

        let count = 0;
        const sourceTask = library.find(t => t.id === taskId);
        if (!sourceTask) return 0;

        games.forEach(game => {
            // Count how many times this task appears in the game's points
            const taskCount = game.points.filter(p => {
                // Check if point was created from this template or has the same title/question
                return p.task.question === sourceTask.task.question;
            }).length;
            count += taskCount;
        });
        return count;
    };

    const handleSort = (column: 'title' | 'question' | 'language' | 'used' | 'tags') => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getFilteredAndSortedLibrary = () => {
        // Safety check
        if (!library || !Array.isArray(library)) {
            return [];
        }

        // Get selected languages (if any selected, only show those)
        const selectedLanguages = Object.keys(languageFilters).filter(lang => languageFilters[lang]);

        let filtered = library.filter(task => {
            // Apply search query (searches both title and tags)
            if (searchQuery) {
                const titleMatch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
                const tagsMatch = task.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
                if (!titleMatch && !tagsMatch) {
                    return false;
                }
            }

            // Apply language filters (if any language is selected, task must match)
            if (selectedLanguages.length > 0) {
                const taskLanguage = task.settings?.language || 'Unknown';
                if (!selectedLanguages.includes(taskLanguage)) {
                    return false;
                }
            }

            // Apply task list filter
            if (taskListFilter) {
                const selectedList = taskLists.find(list => list.id === taskListFilter);
                if (selectedList) {
                    // Check if this task is in the selected list
                    const taskInList = selectedList.tasks.some(listTask =>
                        listTask.task.question === task.task.question && listTask.title === task.title
                    );
                    if (!taskInList) {
                        return false;
                    }
                }
            }

            // Apply column filters
            if (columnFilters['title'] && !task.title.toLowerCase().includes(columnFilters['title'].toLowerCase())) {
                return false;
            }
            if (columnFilters['question'] && !task.task.question.toLowerCase().includes(columnFilters['question'].toLowerCase())) {
                return false;
            }
            if (columnFilters['language'] && task.settings?.language?.toLowerCase() !== columnFilters['language'].toLowerCase()) {
                return false;
            }
            if (columnFilters['tags'] && !task.tags.some(tag => tag.toLowerCase().includes(columnFilters['tags'].toLowerCase()))) {
                return false;
            }

            return true;
        });

        // Apply sorting
        return filtered.sort((a, b) => {
            let aVal: any = '';
            let bVal: any = '';

            switch (sortColumn) {
                case 'title':
                    aVal = a.title.toLowerCase();
                    bVal = b.title.toLowerCase();
                    break;
                case 'question':
                    aVal = a.task.question.toLowerCase();
                    bVal = b.task.question.toLowerCase();
                    break;
                case 'language':
                    aVal = a.settings?.language || '';
                    bVal = b.settings?.language || '';
                    break;
                case 'used':
                    aVal = countTaskUsage(a.id);
                    bVal = countTaskUsage(b.id);
                    break;
                case 'tags':
                    aVal = a.tags.join(',').toLowerCase();
                    bVal = b.tags.join(',').toLowerCase();
                    break;
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const handleBulkDelete = async () => {
        // Delete selected templates from library
        const updatedLibrary = library.filter(t => !selectedTemplateIds.includes(t.id));
        setLibrary(updatedLibrary);
        onUpdateTaskLibrary(updatedLibrary); // Update cache

        // Delete from database
        for (const id of selectedTemplateIds) {
            await db.deleteTemplate(id);
        }

        setSelectedTemplateIds([]);
        setShowBulkDeleteConfirm(false);
        setBulkSelectionMode(false);
    };

    const handleBulkAddToGame = async (game: Game) => {
        const selectedTasks = library.filter(t => selectedTemplateIds.includes(t.id));

        // Create GamePoints from selected tasks
        const newPoints = selectedTasks.map((task, i) => templateToGamePoint({
            ...task,
            id: `${task.id}-${Date.now()}-${i}`
        }));

        const updatedGame = {
            ...game,
            points: [...game.points, ...newPoints]
        };

        onImportTasks(selectedTasks); // This will trigger parent to add to the game
        setSelectedTemplateIds([]);
        setBulkSelectionMode(false);
        setShowGameSelector(false);
    };

    const handleAddSingleTaskToGame = async (game: Game) => {
        if (!singleTaskGameSelector) return;
        const task = library.find(t => t.id === singleTaskGameSelector.taskId);
        if (task) {
            onImportTasks([task], game.id);
        }
        setSingleTaskGameSelector(null);
    };

    // Handle import with game selection if needed
    const handleImportTasksWithGameSelect = (tasks: TaskTemplate[]) => {
        if (activeGame) {
            // Have active game, import directly
            onImportTasks(tasks, activeGame.id);
        } else if (games.length > 0) {
            // No active game, show selector
            setPendingImportTasks(tasks);
            setShowGameSelectorForImport(true);
        } else {
            alert('No games available. Please create a game first.');
        }
    };

    const handleImportListWithGameSelect = (list: TaskList) => {
        if (activeGame) {
            // Have active game, import directly
            onImportTaskList?.(list, activeGame.id);
        } else if (games.length > 0) {
            // No active game, show selector
            setPendingImportList(list);
            setShowGameSelectorForImport(true);
        } else {
            alert('No games available. Please create a game first.');
        }
    };

    const handleConfirmGameImport = (game: Game) => {
        if (pendingImportTasks) {
            onImportTasks(pendingImportTasks, game.id);
            setPendingImportTasks(null);
        } else if (pendingImportList) {
            onImportTaskList?.(pendingImportList, game.id);
            setPendingImportList(null);
        }
        setShowGameSelectorForImport(false);
    };

    // Show ADD TO modal for bulk or single task
    const handleShowAddToModal = (tasks: TaskTemplate[]) => {
        setAddToTasksSelection(tasks);
        setShowAddToModal(true);
    };

    // Handle destination selection from ADD TO modal
    const handleAddToDestination = (type: 'GAME' | 'PLAYZONE' | 'TASKLIST') => {
        setAddToDestinationType(type);

        if (type === 'GAME') {
            // Show game selector for import
            setShowDestinationSelector(true);
        } else if (type === 'PLAYZONE') {
            // Save/link to playzone in library (keep in global library)
            handleAddToPlayzone();
        } else if (type === 'TASKLIST') {
            // Show tasklist selector
            setShowDestinationSelector(true);
        }
    };

    const handleAddToPlayzone = () => {
        // For PLAYZONE: these tasks already exist in the library
        // Just close the modal - they're already available globally
        alert(`✓ Selected ${addToTasksSelection.length} task${addToTasksSelection.length !== 1 ? 's are' : ' is'} available in Global Playzone Library`);
        setShowAddToModal(false);
        setAddToTasksSelection([]);
        setAddToDestinationType(null);
        setSelectedTemplateIds([]);
        setBulkSelectionMode(false);
    };

    const handleConfirmAddTo = async (destination: Game | TaskList) => {
        if (addToDestinationType === 'GAME' && 'points' in destination) {
            // Add to game
            onImportTasks(addToTasksSelection, (destination as Game).id);
            alert(`✓ Successfully added ${addToTasksSelection.length} task${addToTasksSelection.length !== 1 ? 's' : ''} to "${(destination as Game).name}"`);
        } else if (addToDestinationType === 'TASKLIST' && 'tasks' in destination) {
            // Add to tasklist
            const updatedList = {
                ...(destination as TaskList),
                tasks: [...(destination as TaskList).tasks, ...addToTasksSelection]
            };
            await db.saveTaskList(updatedList);
            onUpdateTaskLists(taskLists.map(t => t.id === updatedList.id ? updatedList : t));
            alert(`✓ Successfully added ${addToTasksSelection.length} task${addToTasksSelection.length !== 1 ? 's' : ''} to "${(destination as TaskList).name}"`);
        }

        // Reset all states including bulk selection
        setShowAddToModal(false);
        setAddToTasksSelection([]);
        setAddToDestinationType(null);
        setShowDestinationSelector(false);
        setSelectedTemplateIds([]);
        setBulkSelectionMode(false);
    };

    const renderLibraryGrid = (selectionMode = false) => {
        const filtered = getFilteredAndSortedLibrary();
        
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
                {filtered.map(task => {
                    const Icon = ICON_COMPONENTS[task.iconId] || ICON_COMPONENTS.default;
                    const isSelected = selectedTemplateIds.includes(task.id);
                    
                    return (
                        <div 
                            key={task.id} 
                            onClick={() => selectionMode ? toggleSelection(task.id) : null}
                            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border transition-all cursor-pointer relative group flex flex-col h-full ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                {selectionMode && (
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                        {isSelected && <Check className="w-3 h-3" />}
                                    </div>
                                )}
                            </div>
                            
                            <h4
                                onClick={(e) => { e.stopPropagation(); setEditingTemplate(task); }}
                                className="font-bold text-gray-900 dark:text-white text-sm mb-1 line-clamp-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Click to edit"
                            >
                                {task.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 flex-1">{task.task.question}</p>

                            <div className="flex flex-wrap gap-1 mt-auto">
                                {task.tags.slice(0, 3).map((tag, index) => (
                                    <span key={`${tag}-${index}`} className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded uppercase font-bold tracking-wider">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {!selectionMode && !bulkSelectionMode && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleShowAddToModal([task]); }}
                                    className="mt-3 w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    USE THIS TASK
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderLibraryList = (selectionMode = false) => {
        const filtered = getFilteredAndSortedLibrary();

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
                        <tr>
                            {bulkSelectionMode && (
                                <th className="px-4 py-3 text-left w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedTemplateIds.length === filtered.length && filtered.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedTemplateIds(filtered.map(t => t.id));
                                            } else {
                                                setSelectedTemplateIds([]);
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-indigo-400 accent-indigo-600"
                                    />
                                </th>
                            )}
                            {selectionMode && <th className="px-4 py-3 text-left w-10"></th>}
                            <th className="px-4 py-3 text-left w-10">Icon</th>
                            <th className="px-4 py-3 text-left flex-1">Task Title</th>
                            <th className="px-4 py-3 text-left flex-1">Question</th>
                            <th className="px-4 py-3 text-left">Language</th>
                            <th className="px-4 py-3 text-center w-16">Used</th>
                            <th className="px-4 py-3 text-left">Tags</th>
                            <th className="px-4 py-3 text-center w-24">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {filtered.map(task => {
                            const Icon = ICON_COMPONENTS[task.iconId] || ICON_COMPONENTS.default;
                            const isSelected = selectedTemplateIds.includes(task.id);
                            const usageCount = countTaskUsage(task.id);

                            return (
                                <tr
                                    key={task.id}
                                    onClick={() => (selectionMode || bulkSelectionMode) ? toggleSelection(task.id) : null}
                                    className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-900/30 border-l-4 border-indigo-600' : ''}`}
                                >
                                    {bulkSelectionMode && (
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(task.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded border-indigo-400 accent-indigo-600"
                                            />
                                        </td>
                                    )}
                                    {selectionMode && (
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(task.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded border-slate-600 accent-indigo-600"
                                            />
                                        </td>
                                    )}
                                    <td className="px-4 py-3">
                                        <div className="p-2 bg-slate-700 rounded inline-flex text-slate-300">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                    </td>
                                    <td
                                        className="px-4 py-3 font-bold text-white truncate max-w-xs cursor-pointer hover:text-blue-400 transition-colors"
                                        onClick={() => !selectionMode && setEditingTemplate(task)}
                                        title="Click to edit"
                                    >
                                        {task.title}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 truncate max-w-sm">{task.task.question}</td>
                                    <td className="px-4 py-3">
                                        {task.settings?.language ? (
                                            <span title={task.settings.language} className="text-lg">
                                                {getLanguageFlag(task.settings.language)}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {usageCount > 0 ? (
                                            <span className="inline-block px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                                                {usageCount}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">0</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {task.tags.slice(0, 2).map((tag, index) => (
                                                <span key={`${tag}-${index}`} className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded uppercase font-bold">
                                                    {tag}
                                                </span>
                                            ))}
                                            {task.tags.length > 2 && (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-400">
                                                    +{task.tags.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {!selectionMode && !bulkSelectionMode && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleShowAddToModal([task]); }}
                                                className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold uppercase rounded transition-colors"
                                            >
                                                USE
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    if (editingList) {
        // ... (Editing List View - same as previous) ...
        return (
            <div className="fixed inset-0 z-[6200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 relative">
                    {/* LIST EDITOR HEADER */}
                    <div className="p-6 bg-slate-900 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <button onClick={() => { if(isSelectingForCurrentList) { setIsSelectingForCurrentList(false); setSelectedTemplateIds([]); } else { setEditingList(null); } }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">{isSelectingForCurrentList ? 'ADD FROM LIBRARY' : editingList.name}</h2>
                        </div>
                        
                        {!isSelectingForCurrentList ? (
                            <div className="flex gap-2 items-center">
                                {onImportTaskList && (
                                    <button
                                        onClick={() => {
                                            handleImportListWithGameSelect(editingList);
                                            setEditingList(null);
                                        }}
                                        className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-bold uppercase text-xs tracking-wide flex items-center gap-2 shadow-lg"
                                    >
                                        ✓ {activeGame ? `ADD TO ${activeGame.name}` : 'ADD TO GAME'}
                                    </button>
                                )}
                                <button onClick={handleSaveListUpdate} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold uppercase text-xs tracking-wide flex items-center gap-2">
                                    <Save className="w-4 h-4" /> Save List
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleAddSelectedToEditingList}
                                disabled={selectedTemplateIds.length === 0}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold uppercase text-xs tracking-wide flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> ADD {selectedTemplateIds.length} TASKS
                            </button>
                        )}
                    </div>
                    
                    {/* CONTENT */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-950 custom-scrollbar">
                        {isSelectingForCurrentList ? (
                            <div className="space-y-4">
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="text" 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search library..." 
                                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none"
                                        />
                                    </div>
                                </div>
                                {renderLibraryGrid(true)}
                            </div>
                        ) : (
                            <>
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
                                    <button 
                                        onClick={() => setIsSelectingForCurrentList(true)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-indigo-700 shadow-md flex items-center gap-2"
                                    >
                                        <Library className="w-4 h-4" /> Add From Library
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {editingList.tasks.map((task, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setEditingTaskIndex(i)}
                                            className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
                                        >
                                            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                                {React.createElement(ICON_COMPONENTS[task.iconId] || ICON_COMPONENTS.default, { className: "w-5 h-5 text-gray-500 dark:text-gray-300" })}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-sm text-gray-800 dark:text-white truncate">{task.title}</h4>
                                                    {task.settings?.language && (
                                                        <span title={task.settings.language} className="text-lg flex-shrink-0">
                                                            {getLanguageFlag(task.settings.language)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{task.task.question}</p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newTasks = [...editingList.tasks];
                                                    newTasks.splice(i, 1);
                                                    setEditingList({...editingList, tasks: newTasks});
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg flex-shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {editingList.tasks.length === 0 && (
                                        <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400">
                                            <p className="text-xs font-bold uppercase">List is empty</p>
                                            <button onClick={() => setIsSelectingForCurrentList(true)} className="mt-2 text-blue-500 hover:underline text-xs font-bold uppercase">Click to add tasks</button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#0f172a] border border-slate-800 w-full max-w-6xl h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
                
                {/* HEADER */}
                <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                            <Library className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-widest">TASK MASTER</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mt-1">GLOBAL RESOURCE MANAGER</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* TABS */}
                <div className="flex border-b border-slate-800 bg-slate-950/50 shrink-0 overflow-x-auto no-scrollbar">
                    <button onClick={() => setTab('LIBRARY')} className={`px-8 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex-shrink-0 ${tab === 'LIBRARY' ? 'border-blue-500 text-blue-400 bg-blue-900/10' : 'border-transparent text-slate-500 hover:text-white'}`}>
                        GLOBAL LIBRARY
                    </button>
                    <button onClick={() => setTab('LISTS')} className={`px-8 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex-shrink-0 ${tab === 'LISTS' ? 'border-purple-500 text-purple-400 bg-purple-900/10' : 'border-transparent text-slate-500 hover:text-white'}`}>
                        TASK LISTS
                    </button>
                    <button onClick={() => setTab('TAGS')} className={`px-8 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex-shrink-0 ${tab === 'TAGS' ? 'border-orange-500 text-orange-400 bg-orange-900/10' : 'border-transparent text-slate-500 hover:text-white'}`}>
                        TAGS & CATEGORIES
                    </button>
                    <button onClick={() => setTab('CLIENT')} className={`px-8 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex-shrink-0 ${tab === 'CLIENT' ? 'border-green-500 text-green-400 bg-green-900/10' : 'border-transparent text-slate-500 hover:text-white'}`}>
                        CLIENT PORTAL
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#0a0f1d] custom-scrollbar">
                    
                    {tab === 'LIBRARY' && (
                        <div className="space-y-6">
                            {/* Toolbar */}
                            <div className="flex flex-wrap gap-4 items-center justify-between">
                                <div className="relative w-full sm:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="SEARCH TASK & TAGS..."
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all uppercase"
                                    />
                                </div>

                                {/* Task List Filter */}
                                <div className="w-full sm:w-auto">
                                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Filter by Task List:</p>
                                            {taskListFilter && (
                                                <button
                                                    onClick={() => setTaskListFilter('')}
                                                    className="text-[9px] font-bold text-purple-400 hover:text-purple-300 uppercase"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <select
                                            value={taskListFilter}
                                            onChange={(e) => setTaskListFilter(e.target.value)}
                                            className={`w-full sm:w-48 bg-slate-800 border rounded-lg px-3 py-2 text-xs font-bold text-white outline-none transition-all ${taskListFilter ? 'border-purple-500' : 'border-slate-700 focus:border-purple-500'}`}
                                        >
                                            <option value="">All Tasks</option>
                                            {taskLists.map(list => (
                                                <option key={list.id} value={list.id}>
                                                    {list.name} ({list.tasks.length})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Language Filter */}
                                <div className="w-full sm:w-auto">
                                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Filter by Language:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {getUsedLanguagesInLibrary().map(lang => (
                                                <label key={lang} className="flex items-center gap-2 text-[10px] font-bold cursor-pointer hover:text-white text-slate-400">
                                                    <input
                                                        type="checkbox"
                                                        checked={languageFilters[lang] || false}
                                                        onChange={(e) => setLanguageFilters(prev => ({
                                                            ...prev,
                                                            [lang]: e.target.checked
                                                        }))}
                                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 cursor-pointer accent-blue-600"
                                                    />
                                                    <span>{getLanguageFlag(lang)} {lang}</span>
                                                </label>
                                            ))}
                                            {Object.keys(languageFilters).some(lang => languageFilters[lang]) && (
                                                <button
                                                    onClick={() => setLanguageFilters({})}
                                                    className="text-[9px] font-bold text-orange-400 hover:text-orange-300 uppercase ml-2"
                                                >
                                                    Clear Filters
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Settings Button with Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                                        className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold uppercase tracking-wide transition-colors flex items-center gap-2 shadow-lg"
                                        title="Settings & Tools"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Settings
                                    </button>

                                    {/* Settings Dropdown */}
                                    {showSettingsMenu && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowSettingsMenu(false)} />
                                            <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                                <button
                                                    onClick={() => {
                                                        setShowLoquiz(true);
                                                        setShowSettingsMenu(false);
                                                    }}
                                                    className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors flex items-center gap-3 text-blue-400 font-bold text-xs uppercase border-b border-slate-800"
                                                >
                                                    <Library className="w-4 h-4" />
                                                    Import from Loquiz
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowMigrationModal(true);
                                                        setShowSettingsMenu(false);
                                                    }}
                                                    className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors flex items-center gap-3 text-yellow-400 font-bold text-xs uppercase"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    Fix All Languages
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                                    <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
                                        <button
                                            onClick={() => setLibraryViewMode('grid')}
                                            className={`px-3 py-2 rounded text-[10px] font-bold uppercase transition-colors ${libraryViewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                            title="Grid view"
                                        >
                                            ⊞ GRID
                                        </button>
                                        <button
                                            onClick={() => setLibraryViewMode('list')}
                                            className={`px-3 py-2 rounded text-[10px] font-bold uppercase transition-colors ${libraryViewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                            title="List view"
                                        >
                                            ≡ LIST
                                        </button>
                                    </div>
                                    <button onClick={() => setShowAiGen(true)} className="flex-1 sm:flex-none px-4 py-2 bg-purple-900/20 text-purple-400 border border-purple-500/30 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-purple-900/40 transition-all flex items-center justify-center gap-2">
                                        <RefreshCw className="w-3 h-3" /> AI
                                    </button>
                                    <button
                                        onClick={() => {
                                            setBulkSelectionMode(!bulkSelectionMode);
                                            if(!bulkSelectionMode) setSelectedTemplateIds([]);
                                        }}
                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 border ${bulkSelectionMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-indigo-900/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-900/40'}`}
                                    >
                                        ☑ BULK SELECT
                                    </button>
                                </div>
                            </div>

                            {/* Bulk Selection Actions Toolbar */}
                            {bulkSelectionMode && selectedTemplateIds.length > 0 && (
                                <div className="sticky bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 flex items-center justify-between shadow-2xl z-50">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-white font-bold">
                                            <Check className="w-5 h-5 text-green-500" />
                                            <span className="text-sm">{selectedTemplateIds.length} TASK{selectedTemplateIds.length !== 1 ? 'S' : ''} SELECTED</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleShowAddToModal(library.filter(t => selectedTemplateIds.includes(t.id)))}
                                            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold uppercase text-xs tracking-wide flex items-center gap-2 shadow-lg transition-all"
                                        >
                                            <Plus className="w-4 h-4" /> ADD TO
                                        </button>
                                        <button
                                            onClick={() => setShowBulkDeleteConfirm(true)}
                                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-xs tracking-wide flex items-center gap-2 shadow-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" /> DELETE
                                        </button>
                                        <button
                                            onClick={() => {
                                                setBulkSelectionMode(false);
                                                setSelectedTemplateIds([]);
                                            }}
                                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold uppercase text-xs tracking-wide transition-all"
                                        >
                                            CANCEL
                                        </button>
                                    </div>
                                </div>
                            )}

                            {libraryViewMode === 'grid' ? renderLibraryGrid() : renderLibraryList()}
                        </div>
                    )}

                    {tab === 'LISTS' && (
                        <div className="space-y-6">
                            <button 
                                onClick={handleCreateList}
                                className="w-full py-4 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-white hover:border-slate-500 transition-all group"
                            >
                                <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span className="font-bold uppercase tracking-widest text-xs">CREATE NEW LIST</span>
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {taskLists.map(list => (
                                    <div key={list.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg group hover:border-blue-500/50 transition-all flex flex-col h-full">
                                        <div className="h-32 bg-slate-800 relative">
                                            {list.imageUrl ? (
                                                <img src={list.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                    <LayoutList className="w-10 h-10" />
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-1 rounded">
                                                {list.tasks.length} TASKS
                                            </div>
                                            {countGameUsage(list.id) > 0 && (
                                                <div className="absolute top-2 left-2 bg-purple-600 text-white text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1">
                                                    📊 {countGameUsage(list.id)} GAME{countGameUsage(list.id) !== 1 ? 'S' : ''}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-5 flex flex-col flex-1">
                                            <h3 className="text-lg font-black text-white uppercase truncate mb-1">{list.name}</h3>
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-3 h-8 flex-grow">{list.description || "No description"}</p>

                                            {/* Language Flags */}
                                            {getLanguagesFromTasks(list.tasks).length > 0 && (
                                                <div className="mb-3 flex flex-wrap gap-1">
                                                    {getLanguagesFromTasks(list.tasks).map(lang => (
                                                        <span key={lang} title={lang} className="text-lg">
                                                            {getLanguageFlag(lang)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex gap-2 mt-auto">
                                                {onImportTaskList && (
                                                    <button
                                                        onClick={() => {
                                                            handleImportListWithGameSelect(list);
                                                            if (activeGame) onClose();
                                                        }}
                                                        className="flex-1 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-bold uppercase text-[10px] tracking-wide transition-all shadow-lg hover:shadow-green-600/30"
                                                        title={activeGame ? `Add this entire tasklist to ${activeGame.name}` : 'Add this entire tasklist to your game'}
                                                    >
                                                        ✓ {activeGame ? 'ADD' : 'ADD TO GAME'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setEditingList(list)}
                                                    className="flex-1 py-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg font-bold uppercase text-[10px] tracking-wide transition-colors"
                                                >
                                                    EDIT
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const copiedList: TaskList = {
                                                            id: `list-${Date.now()}`,
                                                            name: `${list.name} (Copy)`,
                                                            description: list.description,
                                                            tasks: [...list.tasks],
                                                            color: list.color,
                                                            iconId: list.iconId,
                                                            imageUrl: list.imageUrl,
                                                            usageCount: 0,
                                                            createdAt: Date.now()
                                                        };
                                                        const updated = [...taskLists, copiedList];
                                                        onUpdateTaskLists(updated);
                                                        db.saveTaskList(copiedList);
                                                    }}
                                                    className="p-2 bg-slate-800 hover:bg-purple-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                                                    title="Duplicate this tasklist"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Delete this list?')) {
                                                            const updated = taskLists.filter(l => l.id !== list.id);
                                                            onUpdateTaskLists(updated);
                                                            db.deleteTaskList(list.id);
                                                        }
                                                    }}
                                                    className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === 'TAGS' && (
                        <AccountTags 
                            games={games} 
                            library={library} 
                            onDeleteTagGlobally={onDeleteTagGlobally} 
                            onRenameTagGlobally={onRenameTagGlobally} 
                        />
                    )}

                    {tab === 'CLIENT' && (
                        <Dashboard 
                            games={games} 
                            taskLists={taskLists} 
                            onBack={() => setTab('LIBRARY')} 
                            onAction={() => {}} 
                            userName="Admin"
                            initialTab='client'
                        />
                    )}
                </div>
            </div>

            {/* AI Generator Modal */}
            {showAiGen && (
                <AiTaskGenerator 
                    onClose={() => setShowAiGen(false)}
                    onAddTasks={(tasks) => {}}
                    onAddToLibrary={async (tasks) => {
                        for (const t of tasks) await db.saveTemplate(t);
                        await loadLibrary(true); // Force refresh cache
                        setShowAiGen(false);
                    }}
                    targetMode='LIBRARY'
                />
            )}

            {/* Loquiz Importer */}
            {showLoquiz && (
                <LoquizImporter
                    onClose={() => setShowLoquiz(false)}
                    onImportTasks={async (tasks) => {
                        for (const t of tasks) await db.saveTemplate(t);
                        await loadLibrary(true); // Force refresh cache
                        setShowLoquiz(false);
                    }}
                />
            )}

            {/* Task Editor Modal - for Library Templates */}
            {editingTemplate && (
                <TaskEditor
                    point={templateToGamePoint(editingTemplate)}
                    onSave={handleSaveTemplate}
                    onDelete={async (pointId) => {
                        await db.deleteTemplate(pointId);
                        const updatedLibrary = library.filter(t => t.id !== pointId);
                        onUpdateTaskLibrary(updatedLibrary); // Update cache
                        setLibrary(updatedLibrary);
                        setEditingTemplate(null);
                    }}
                    onClose={() => setEditingTemplate(null)}
                    isTemplateMode={true}
                />
            )}

            {/* Task Editor Modal - for Tasks in List */}
            {editingTaskIndex !== null && editingList && editingList.tasks[editingTaskIndex] && (
                <TaskEditor
                    point={templateToGamePoint(editingList.tasks[editingTaskIndex])}
                    onSave={handleSaveTaskInList}
                    onDelete={async (pointId) => {
                        if (editingTaskIndex !== null && editingList) {
                            const updatedTasks = editingList.tasks.filter(t => t.id !== pointId);
                            setEditingList({ ...editingList, tasks: updatedTasks });
                            setEditingTaskIndex(null);
                        }
                    }}
                    onClose={() => setEditingTaskIndex(null)}
                    isTemplateMode={true}
                />
            )}

            {/* Single Task Game Selector Modal */}
            {singleTaskGameSelector && (
                <div className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-black text-white uppercase">SELECT GAME</h3>
                            <button onClick={() => setSingleTaskGameSelector(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {games.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">No games available</p>
                            ) : (
                                games.map(game => (
                                    <button
                                        key={game.id}
                                        onClick={() => handleAddSingleTaskToGame(game)}
                                        className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 hover:border-blue-500"
                                    >
                                        <div className="font-bold text-white">{game.name}</div>
                                        <div className="text-xs text-slate-400 mt-1">{game.points.length} tasks</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Add to Game Modal */}
            {showGameSelector && (
                <div className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-black text-white uppercase">ADD {selectedTemplateIds.length} TASKS TO GAME</h3>
                            <button onClick={() => setShowGameSelector(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {games.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">No games available</p>
                            ) : (
                                games.map(game => (
                                    <button
                                        key={game.id}
                                        onClick={() => {
                                            handleBulkAddToGame(game);
                                            setShowGameSelector(false);
                                        }}
                                        className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 hover:border-green-500"
                                    >
                                        <div className="font-bold text-white">{game.name}</div>
                                        <div className="text-xs text-slate-400 mt-1">{game.points.length} tasks</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Confirmation Modal */}
            {showBulkDeleteConfirm && (
                <div className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-red-600/50 rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <AlertCircle className="w-6 h-6 text-red-500" />
                                <h3 className="text-lg font-black text-white uppercase">DELETE {selectedTemplateIds.length} TASKS?</h3>
                            </div>
                            <p className="text-slate-400 text-sm">This action cannot be undone. All selected tasks will be permanently deleted from the library.</p>
                        </div>
                        <div className="p-6 flex gap-3">
                            <button
                                onClick={() => setShowBulkDeleteConfirm(false)}
                                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold uppercase text-xs transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase text-xs transition-colors"
                            >
                                Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD TO Modal - Choose Destination Type */}
            {showAddToModal && !showDestinationSelector && (
                <div className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase">ADD {addToTasksSelection.length} TASK{addToTasksSelection.length !== 1 ? 'S' : ''} TO:</h3>
                                <p className="text-xs text-slate-400 mt-1 uppercase font-bold">Choose destination</p>
                            </div>
                            <button onClick={() => {
                                setShowAddToModal(false);
                                setAddToTasksSelection([]);
                                setAddToDestinationType(null);
                            }} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            <button
                                onClick={() => handleAddToDestination('GAME')}
                                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold uppercase text-sm tracking-wide transition-all shadow-lg flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <Gamepad2 className="w-6 h-6" />
                                    <div className="text-left">
                                        <div>GAME</div>
                                        <div className="text-[10px] opacity-80 normal-case font-normal">Add to a specific game</div>
                                    </div>
                                </div>
                                <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                            <button
                                onClick={() => handleAddToDestination('PLAYZONE')}
                                className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-bold uppercase text-sm tracking-wide transition-all shadow-lg flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <Library className="w-6 h-6" />
                                    <div className="text-left">
                                        <div>GLOBAL PLAYZONE</div>
                                        <div className="text-[10px] opacity-80 normal-case font-normal">Keep in global library</div>
                                    </div>
                                </div>
                                <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                            <button
                                onClick={() => handleAddToDestination('TASKLIST')}
                                className="w-full px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl font-bold uppercase text-sm tracking-wide transition-all shadow-lg flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <LayoutList className="w-6 h-6" />
                                    <div className="text-left">
                                        <div>TASKLIST</div>
                                        <div className="text-[10px] opacity-80 normal-case font-normal">Add to a task list</div>
                                    </div>
                                </div>
                                <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Destination Selector - GAME or TASKLIST */}
            {showAddToModal && showDestinationSelector && addToDestinationType && (
                <div className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase">
                                    SELECT {addToDestinationType === 'GAME' ? 'GAME' : 'TASKLIST'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 uppercase font-bold">
                                    {addToTasksSelection.length} task{addToTasksSelection.length !== 1 ? 's' : ''} ready to add
                                </p>
                            </div>
                            <button onClick={() => {
                                setShowDestinationSelector(false);
                                setShowAddToModal(false);
                                setAddToTasksSelection([]);
                                setAddToDestinationType(null);
                            }} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {addToDestinationType === 'GAME' ? (
                                games.length === 0 ? (
                                    <div className="text-center py-8">
                                        <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                        <p className="text-slate-400 text-sm">No games available. Create a game first.</p>
                                    </div>
                                ) : (
                                    games.map(game => (
                                        <button
                                            key={game.id}
                                            onClick={() => handleConfirmAddTo(game)}
                                            className="w-full text-left px-5 py-4 bg-slate-800 hover:bg-blue-700 rounded-xl transition-all border border-slate-700 hover:border-blue-500 group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="font-bold text-white text-sm group-hover:text-blue-100">{game.name}</div>
                                                    <div className="text-xs text-slate-400 mt-1">{game.points.length} tasks currently</div>
                                                </div>
                                                <Gamepad2 className="w-5 h-5 text-slate-600 group-hover:text-blue-300" />
                                            </div>
                                        </button>
                                    ))
                                )
                            ) : (
                                taskLists.length === 0 ? (
                                    <div className="text-center py-8">
                                        <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                        <p className="text-slate-400 text-sm">No task lists available. Create one first.</p>
                                    </div>
                                ) : (
                                    taskLists.map(list => (
                                        <button
                                            key={list.id}
                                            onClick={() => handleConfirmAddTo(list)}
                                            className="w-full text-left px-5 py-4 bg-slate-800 hover:bg-orange-700 rounded-xl transition-all border border-slate-700 hover:border-orange-500 group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="font-bold text-white text-sm group-hover:text-orange-100">{list.name}</div>
                                                    <div className="text-xs text-slate-400 mt-1">{list.tasks.length} tasks currently</div>
                                                </div>
                                                <LayoutList className="w-5 h-5 text-slate-600 group-hover:text-orange-300" />
                                            </div>
                                        </button>
                                    ))
                                )
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-700">
                            <button
                                onClick={() => setShowDestinationSelector(false)}
                                className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-bold uppercase text-xs transition-colors"
                            >
                                ← BACK TO OPTIONS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Game Selector Modal for Importing Tasks */}
            {showGameSelectorForImport && (
                <div className="fixed inset-0 z-[7000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-black text-white uppercase">SELECT GAME</h3>
                            <button onClick={() => {
                                setShowGameSelectorForImport(false);
                                setPendingImportTasks(null);
                                setPendingImportList(null);
                            }} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {games.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">No games available. Create a game first.</p>
                            ) : (
                                games.map(game => (
                                    <button
                                        key={game.id}
                                        onClick={() => handleConfirmGameImport(game)}
                                        className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 hover:border-green-500"
                                    >
                                        <div className="font-bold text-white">{game.name}</div>
                                        <div className="text-xs text-slate-400 mt-1">{game.points.length} tasks</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Language Migration Modal */}
            {showMigrationModal && (
                <div className="fixed inset-0 z-[7500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase">Language Migration</h3>
                                <p className="text-xs text-slate-400 mt-1">Auto-detect and fix all task languages</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowMigrationModal(false);
                                    setMigrationLog([]);
                                    setMigrationResults(null);
                                }}
                                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                            {!migrationRunning && !migrationResults && (
                                <div className="space-y-4">
                                    <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4">
                                        <p className="text-sm text-yellow-200 font-bold mb-2">⚠️ This will analyze all tasks</p>
                                        <p className="text-xs text-yellow-300/80">
                                            This migration will:
                                        </p>
                                        <ul className="text-xs text-yellow-300/80 list-disc list-inside mt-2 space-y-1">
                                            <li>Scan all tasks in the library and task lists</li>
                                            <li>Detect language from question text</li>
                                            <li>Remove all "GLOBAL" language values</li>
                                            <li>Update tasks with correct language</li>
                                        </ul>
                                    </div>

                                    <button
                                        onClick={handleRunMigration}
                                        className="w-full px-6 py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-sm font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                        Start Migration
                                    </button>
                                </div>
                            )}

                            {migrationRunning && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mb-4" />
                                    <p className="text-white font-bold">Running migration...</p>
                                    <p className="text-sm text-slate-400 mt-2">This may take a moment</p>
                                </div>
                            )}

                            {migrationLog.length > 0 && (
                                <div className="space-y-4">
                                    <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 max-h-96 overflow-y-auto custom-scrollbar font-mono text-xs">
                                        {migrationLog.map((line, index) => (
                                            <div
                                                key={index}
                                                className={`${
                                                    line.includes('✓') ? 'text-green-400' :
                                                    line.includes('❌') ? 'text-red-400' :
                                                    line.includes('===') ? 'text-yellow-400 font-bold' :
                                                    line.includes('📚') || line.includes('📋') ? 'text-blue-400 font-bold' :
                                                    'text-slate-400'
                                                }`}
                                            >
                                                {line}
                                            </div>
                                        ))}
                                    </div>

                                    {migrationResults && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4 text-center">
                                                <p className="text-3xl font-black text-green-400">{migrationResults.totalUpdated}</p>
                                                <p className="text-xs text-green-300 uppercase font-bold mt-1">Tasks Fixed</p>
                                            </div>
                                            <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 text-center">
                                                <p className="text-3xl font-black text-red-400">{migrationResults.totalErrors}</p>
                                                <p className="text-xs text-red-300 uppercase font-bold mt-1">Errors</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskMaster;
