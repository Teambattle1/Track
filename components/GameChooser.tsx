import React, { useState } from 'react';
import { Game, TaskList } from '../types';
import { X, Search, Gamepad2, Plus, Calendar, MapPin, RefreshCw, LayoutTemplate } from 'lucide-react';

interface GameChooserProps {
  games: Game[];
  taskLists: TaskList[];
  onSelectGame: (id: string) => void;
  onCreateGame: (name: string, fromTaskListId?: string) => void;
  onClose: () => void;
  onSaveAsTemplate?: (gameId: string, name: string) => void;
  onOpenGameCreator: () => void;
  onRefresh: () => void;
}

const GameChooser: React.FC<GameChooserProps> = ({ 
    games, 
    taskLists, 
    onSelectGame, 
    onCreateGame, 
    onClose,
    onSaveAsTemplate,
    onOpenGameCreator,
    onRefresh
}) => {
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'GAMES' | 'TEMPLATES'>('GAMES');

    const filteredGames = games.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
    
    return (
        <div className="fixed inset-0 z-[5000] bg-slate-950 text-white flex flex-col font-sans overflow-hidden animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)] opacity-40 pointer-events-none" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

            {/* Header */}
            <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center z-10 relative">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
                        <Gamepad2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight uppercase leading-none">Game Sessions</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Select or Create Mission</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Toolbar */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row gap-4 items-center z-10 relative">
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
                    <button 
                        onClick={() => setView('GAMES')}
                        className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${view === 'GAMES' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        Active Games
                    </button>
                </div>

                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="SEARCH GAMES..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                    />
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={onRefresh}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
                        title="Refresh List"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onOpenGameCreator}
                        className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> New Game
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative z-0">
                {filteredGames.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <Gamepad2 className="w-16 h-16 mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest">No games found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredGames.map(game => (
                            <div 
                                key={game.id} 
                                onClick={() => onSelectGame(game.id)}
                                className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 hover:bg-slate-800 transition-all cursor-pointer shadow-xl relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10 transition-colors">
                                        <Gamepad2 className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                        {game.points.length} TASKS
                                    </span>
                                </div>
                                
                                <div className="relative z-10">
                                    <h3 className="text-lg font-black text-white uppercase tracking-wide truncate mb-1 group-hover:text-indigo-400 transition-colors">{game.name}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-2 min-h-[2.5em] mb-4">{game.description || "No description provided."}</p>
                                    
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" /> {new Date(game.createdAt).toLocaleDateString()}
                                        </div>
                                        {game.client?.name && (
                                            <div className="flex items-center gap-1 text-indigo-400">
                                                <MapPin className="w-3 h-3" /> {game.client.name}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameChooser;