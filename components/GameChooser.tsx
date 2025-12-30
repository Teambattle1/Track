import React, { useState } from 'react';
import { Game, TaskList, MapStyleId, GameChangeLogEntry } from '../types';
import { X, Search, Gamepad2, Plus, Calendar, MapPin, RefreshCw, Settings, Layers, Clock, Hourglass, StopCircle, LayoutGrid, Map as MapIcon, List, LayoutList, History, User, FileClock, ChevronDown, PlayCircle } from 'lucide-react';
import { getFlag } from '../utils/i18n';

interface GameChooserProps {
  games: Game[];
  taskLists: TaskList[];
  onSelectGame: (id: string) => void;
  onCreateGame: (name: string, fromTaskListId?: string) => void;
  onClose: () => void;
  onSaveAsTemplate?: (gameId: string, name: string) => void;
  onOpenGameCreator: () => void;
  onRefresh: () => void;
  onEditGame: (game: Game) => void;
  onStartSimulation?: (game: Game) => void;
}

const MAP_LABELS: Record<MapStyleId, string> = {
    osm: 'Standard',
    satellite: 'Satellite',
    dark: 'Dark Mode',
    ancient: 'Ancient',
    clean: 'Clean',
    winter: 'Winter',
    ski: 'Ski Map',
    norwegian: 'Norwegian',
    historic: 'Historic',
    google_custom: 'Google Custom',
    none: 'No Map'
};

const GameHistoryModal = ({ logs, gameName, onClose }: { logs: GameChangeLogEntry[], gameName: string, onClose: () => void }) => (
    <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-[#141414] border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-white/5 bg-[#0a0a0a] flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <History className="w-5 h-5 text-blue-500" /> CHANGE LOG
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wide">
                        HISTORY FOR: {gameName}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {logs && logs.length > 0 ? (
                    logs.slice().reverse().map((log, idx) => (
                        <div key={idx} className="flex gap-4 p-4 bg-[#0a0a0a] border border-white/5 rounded-xl">
                            <div className="flex flex-col items-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mb-1"></div>
                                <div className="w-px h-full bg-blue-500/20"></div>
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-white uppercase tracking-wide">{log.action}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-2">
                                    <User className="w-3 h-3 text-slate-600" /> {log.user || 'Unknown'}
                                </p>
                                <p className="text-[9px] text-slate-600 font-mono mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 opacity-50">
                        <History className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase text-slate-500">No history recorded</p>
                    </div>
                )}
            </div>
        </div>
    </div>
);

const GameChooser: React.FC<GameChooserProps> = ({ 
    games, 
    taskLists, 
    onSelectGame, 
    onCreateGame, 
    onClose, 
    onSaveAsTemplate,
    onOpenGameCreator,
    onRefresh,
    onEditGame,
    onStartSimulation
}) => {
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'GAMES' | 'TEMPLATES'>('GAMES');
    const [layout, setLayout] = useState<'GRID' | 'LIST'>('GRID');
    const [historyGame, setHistoryGame] = useState<Game | null>(null);

    const filteredGames = games.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
    
    const getTimerLabel = (game: Game) => {
        if (!game.timerConfig || game.timerConfig.mode === 'none') return { label: 'No Timer', icon: Clock };
        if (game.timerConfig.mode === 'countdown') return { label: `${game.timerConfig.durationMinutes}m`, icon: Hourglass };
        if (game.timerConfig.mode === 'scheduled_end') return { label: new Date(game.timerConfig.endTime || '').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), icon: StopCircle };
        return { label: 'Run Time', icon: Clock };
    };

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

                {/* Layout Toggle */}
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button 
                        onClick={() => setLayout('GRID')} 
                        className={`p-2 rounded-lg transition-all ${layout === 'GRID' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                        title="Grid View"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setLayout('LIST')} 
                        className={`p-2 rounded-lg transition-all ${layout === 'LIST' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                        title="List View"
                    >
                        <LayoutList className="w-4 h-4" />
                    </button>
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
                    <div className={layout === 'GRID' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-3"}>
                        {filteredGames.map(game => {
                            const timerInfo = getTimerLabel(game);
                            const TimerIcon = timerInfo.icon;
                            
                            // Task counts
                            const mapTaskCount = game.points.filter(p => !p.playgroundId && !p.isSectionHeader).length;
                            const playgroundStats = (game.playgrounds || []).map(pg => ({
                                title: pg.title,
                                count: game.points.filter(p => p.playgroundId === pg.id).length
                            }));

                            if (layout === 'LIST') {
                                return (
                                    <div 
                                        key={game.id}
                                        onClick={() => onSelectGame(game.id)}
                                        className="group bg-slate-900 border border-slate-800 rounded-xl p-3 hover:border-indigo-500/50 hover:bg-slate-800 transition-all cursor-pointer shadow-sm relative overflow-hidden flex items-center gap-4"
                                    >
                                        {/* Icon & Flag */}
                                        <div className="relative shrink-0">
                                            <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700 group-hover:border-indigo-500/30">
                                                {game.client?.logoUrl ? (
                                                    <img src={game.client.logoUrl} className="w-full h-full object-cover rounded-lg opacity-80 group-hover:opacity-100" />
                                                ) : (
                                                    <Gamepad2 className="w-6 h-6 text-slate-500 group-hover:text-indigo-400" />
                                                )}
                                            </div>
                                            <div className="absolute -top-2 -right-2 text-xl drop-shadow-md bg-slate-900 rounded-full border border-slate-700 w-6 h-6 flex items-center justify-center">
                                                {getFlag(game.language)}
                                            </div>
                                        </div>

                                        {/* Name & Desc */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-black text-white uppercase tracking-wide truncate group-hover:text-indigo-400">{game.name}</h3>
                                                <div className="hidden sm:flex items-center gap-2 px-2 py-0.5 bg-slate-950 rounded border border-slate-700">
                                                    <Layers className="w-3 h-3 text-indigo-400" />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{MAP_LABELS[game.defaultMapStyle || 'osm'] || 'Standard'}</span>
                                                </div>
                                                <div className="hidden sm:flex items-center gap-2 px-2 py-0.5 bg-slate-950 rounded border border-slate-700">
                                                    <TimerIcon className="w-3 h-3 text-orange-400" />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{timerInfo.label}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                                <span className="flex items-center gap-1.5 truncate"><MapPin className="w-3 h-3 text-indigo-500" /> CLIENT: {game.client?.name || 'N/A'}</span>
                                                {game.lastModifiedBy && (
                                                    <span className="flex items-center gap-1.5 truncate"><FileClock className="w-3 h-3 text-blue-500" /> MODIFIED BY: {game.lastModifiedBy}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="hidden md:flex items-center gap-3 shrink-0">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black text-white">{mapTaskCount}</span>
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">ON MAP</span>
                                            </div>
                                            <div className="w-px h-6 bg-slate-800"></div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-[10px] font-black text-white">{playgroundStats.length}</span>
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">ZONES</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0 border-l border-slate-800 pl-4">
                                            {onStartSimulation && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onStartSimulation(game);
                                                    }}
                                                    className="p-2 text-slate-500 hover:text-white hover:bg-orange-600 rounded-lg transition-colors"
                                                    title="Simulate Game"
                                                >
                                                    <PlayCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setHistoryGame(game);
                                                }}
                                                className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                                title="View Log"
                                            >
                                                <History className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditGame(game);
                                                }}
                                                className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                                title="Edit Settings"
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div 
                                    key={game.id} 
                                    onClick={() => onSelectGame(game.id)}
                                    className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl relative flex flex-col min-h-[380px] hover:border-indigo-500/50 hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    {/* Background Image */}
                                    {game.client?.logoUrl ? (
                                        <>
                                            <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity bg-center bg-cover bg-no-repeat" style={{ backgroundImage: `url(${game.client.logoUrl})` }} />
                                            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-900" />
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
                                    )}

                                    <div className="relative z-10 flex flex-col h-full p-5">
                                        
                                        {/* Top Row: Icon + Flag */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-10 h-10 bg-slate-800/80 backdrop-blur rounded-xl flex items-center justify-center border border-slate-700/50 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10 transition-colors">
                                                <Gamepad2 className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
                                            </div>
                                            {/* Large Flag */}
                                            <div className="text-3xl filter drop-shadow-md" title={`Language: ${game.language}`}>
                                                {getFlag(game.language)}
                                            </div>
                                        </div>
                                        
                                        {/* Title & Desc */}
                                        <div className="mb-4">
                                            <h3 className="text-lg font-black text-white uppercase tracking-wide leading-tight mb-1 group-hover:text-indigo-400 transition-colors drop-shadow-sm truncate">{game.name}</h3>
                                            <p className="text-xs text-slate-400 line-clamp-2 h-8 leading-tight">{game.description || "No description provided."}</p>
                                        </div>

                                        {/* Metadata Rows */}
                                        <div className="space-y-2 mb-4 bg-black/20 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                                <Layers className="w-3 h-3 text-indigo-400" />
                                                <span className="uppercase">{MAP_LABELS[game.defaultMapStyle || 'osm'] || 'Standard'} Map</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                                <TimerIcon className="w-3 h-3 text-orange-400" />
                                                <span className="uppercase">{timerInfo.label}</span>
                                            </div>
                                            {game.createdBy && (
                                                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 border-t border-white/5 pt-1 mt-1">
                                                    <User className="w-3 h-3 text-green-500" />
                                                    <span className="uppercase truncate">CREATOR: {game.createdBy}</span>
                                                </div>
                                            )}
                                            {game.lastModifiedBy && (
                                                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
                                                    <FileClock className="w-3 h-3 text-blue-500" />
                                                    <span className="uppercase truncate">MOD: {game.lastModifiedBy}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Task Breakdown */}
                                        <div className="flex-1 space-y-1 mb-4">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                                                <span className="flex items-center gap-1"><MapIcon className="w-3 h-3" /> ON MAP TASKS</span>
                                                <span className="text-white">{mapTaskCount}</span>
                                            </div>
                                            {playgroundStats.map((pg, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                                                    <span className="flex items-center gap-1 truncate max-w-[140px]"><LayoutGrid className="w-3 h-3 text-blue-400" /> ZONE: {pg.title}</span>
                                                    <span className="text-white">{pg.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Footer Info */}
                                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800/50">
                                            <div className="flex flex-col gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3 h-3" /> <span className="text-slate-400">DATE:</span> {game.client?.playingDate ? new Date(game.client.playingDate).toLocaleDateString() : new Date(game.createdAt).toLocaleDateString()}
                                                </div>
                                                {game.client?.name && (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="w-3 h-3" /> <span className="text-slate-400">CLIENT:</span> {game.client.name}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Action Buttons */}
                                            <div className="flex gap-1">
                                                {onStartSimulation && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onStartSimulation(game);
                                                        }}
                                                        className="p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-orange-600 hover:border-orange-500 rounded-lg transition-all shadow-lg flex-shrink-0"
                                                        title="Simulate Game"
                                                    >
                                                        <PlayCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setHistoryGame(game);
                                                    }}
                                                    className="p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-blue-600 hover:border-blue-500 rounded-lg transition-all shadow-lg flex-shrink-0"
                                                    title="View Change Log"
                                                >
                                                    <History className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditGame(game);
                                                    }}
                                                    className="p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 rounded-lg transition-all shadow-lg flex-shrink-0"
                                                    title="Edit Game Settings"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hover Glow Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* History Modal */}
            {historyGame && (
                <GameHistoryModal 
                    logs={historyGame.changeLog || []} 
                    gameName={historyGame.name} 
                    onClose={() => setHistoryGame(null)} 
                />
            )}
        </div>
    );
};

export default GameChooser;
