import React, { useState } from 'react';
import { 
    Game, 
    TaskList, 
    GamePoint, 
    MapStyleId, 
    GameMode 
} from '../types';
import { 
    X, 
    Trash2, 
    Play, 
    Settings,
    Plus,
    LayoutTemplate
} from 'lucide-react';
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
import { ICON_COMPONENTS } from '../utils/icons';
import { authService } from '../services/auth'; // Import auth

interface GameManagerProps {
  games: Game[];
  taskLists: TaskList[];
  activeGameId: string | null;
  activeGamePoints: GamePoint[];
  onCreateGame: (name: string, fromTaskListId?: string, description?: string, mapStyle?: MapStyleId) => void;
  onCreateFromTemplate?: (templateId: string) => void;
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

const GameManager: React.FC<GameManagerProps> = ({
    games,
    activeGameId,
    onSelectGame,
    onEditGame,
    onDeleteGame,
    onClose,
    onCreateGame,
    onCreateFromTemplate
}) => {
    const [section, setSection] = useState<'GAMES' | 'TEMPLATES'>('GAMES');
    const [view, setView] = useState<'LIST' | 'CREATE'>('LIST');
    const [newName, setNewName] = useState('');

    const gameList = games.filter(g => !g.isGameTemplate);
    const templateList = games.filter(g => g.isGameTemplate);

    const handleCreate = () => {
        if (newName.trim()) {
            onCreateGame(newName);
            setNewName('');
            setView('LIST');
        }
    };

    return (
        <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                        <Settings className="w-5 h-5" /> Game Manager
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-2">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSection('GAMES')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${section === 'GAMES' ? 'bg-orange-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
                        >
                            Games
                        </button>
                        <button
                            onClick={() => setSection('TEMPLATES')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${section === 'TEMPLATES' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
                        >
                            Game Templates
                        </button>
                    </div>

                    {section === 'GAMES' && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setView('LIST')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${view === 'LIST' ? 'bg-orange-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
                            >
                                My Games
                            </button>
                            <button
                                onClick={() => setView('CREATE')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors ${view === 'CREATE' ? 'bg-orange-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
                            >
                                Create New
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 overflow-y-auto space-y-3 bg-white dark:bg-gray-900 flex-1">
                    {section === 'GAMES' ? (
                        view === 'LIST' ? (
                            <div className="space-y-3">
                                {gameList.length === 0 && <div className="text-center text-gray-500 py-10 uppercase tracking-wide text-xs font-bold">No games found. Create one!</div>}
                                {gameList.map(game => (
                                    <div key={game.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex justify-between items-center transition-all ${game.id === activeGameId ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'}`}>
                                        <div>
                                            <h3 className="font-bold text-gray-800 dark:text-white uppercase">{game.name}</h3>
                                            <p className="text-xs text-gray-500">{new Date(game.createdAt).toLocaleDateString()} • {game.points.length} Tasks</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => (onEditGame ? onEditGame(game.id) : onSelectGame(game.id))}
                                                className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                                title="Edit Game"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { if(confirm('Delete game?')) onDeleteGame(game.id); }}
                                                className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                                title="Delete Game"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 max-w-md mx-auto py-10">
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Game Name</label>
                                     <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="e.g. City Scavenger Hunt"
                                        className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-orange-500 outline-none"
                                     />
                                 </div>
                                 <button
                                    onClick={handleCreate}
                                    disabled={!newName.trim()}
                                    className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold uppercase tracking-wide hover:bg-orange-700 disabled:opacity-50 transition-colors"
                                 >
                                     Create Game
                                 </button>
                            </div>
                        )
                    ) : (
                        <div className="space-y-3">
                            {templateList.length === 0 && <div className="text-center text-gray-500 py-10 uppercase tracking-wide text-xs font-bold">No templates found. Use "Save as Game Template" inside the editor.</div>}
                            {templateList.map(template => (
                                <div key={template.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex justify-between items-center transition-all ${template.id === activeGameId ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}>
                                    <div>
                                        <h3 className="font-bold text-gray-800 dark:text-white uppercase">{template.name}</h3>
                                        <p className="text-xs text-gray-500">{new Date(template.createdAt).toLocaleDateString()} • {template.points.length} Tasks</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onEditGame ? onEditGame(template.id) : onSelectGame(template.id)}
                                            className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                            title="Edit Template"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => onCreateFromTemplate && onCreateFromTemplate(template.id)}
                                            disabled={!onCreateFromTemplate}
                                            className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
                                            title="Create Game From Template"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => { if(confirm('Delete template?')) onDeleteGame(template.id); }}
                                            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                            title="Delete Template"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameManager;
