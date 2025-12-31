import React, { useState, useEffect } from 'react';
import { X, Search, Globe, Key, Gamepad2, Loader2, AlertCircle, ArrowRight, Download, RefreshCw, Library, Check, FileText } from 'lucide-react';
import { loquizApi, LoquizGame } from '../services/loquiz';
import { TaskTemplate } from '../types';

interface LoquizImporterProps {
  onClose: () => void;
  onImportTasks: (tasks: TaskTemplate[]) => void;
}

const LoquizImporter: React.FC<LoquizImporterProps> = ({ onClose, onImportTasks }) => {
  // Pre-fill with the provided credentials or local storage
  const [apiKey, setApiKey] = useState(localStorage.getItem('loquiz_api_key') || '35dda9f2ec9b4acabc414157ac03ea8454682b5f54969faae0b8d7121150298e');
  
  const [step, setStep] = useState<'AUTH' | 'BROWSE'>('AUTH');
  const [browseTab, setBrowseTab] = useState<'GAMES' | 'LIBRARY'>('GAMES');
  
  const [games, setGames] = useState<LoquizGame[]>([]);
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAuthenticate = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Test key and fetch games to start
      const gamesList = await loquizApi.fetchGames(apiKey);
      setGames(gamesList);
      
      localStorage.setItem('loquiz_api_key', apiKey);
      setStep('BROWSE');
    } catch (err: any) {
      console.error("Auth failed:", err);
      setError(err.message || 'Failed to connect to Loquiz V4. Please verify your API key.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchLibrary = async () => {
    setLoading(true);
    setError(null);
    setBrowseTab('LIBRARY');
    try {
      const data = await loquizApi.fetchAllTasks(apiKey);
      setTasks(data);
      setSelectedTaskIds([]); 
    } catch (err: any) {
      setError(err.message || 'Failed to fetch library tasks.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGame = async (gameId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loquizApi.fetchTasksFromGame(apiKey, gameId);
      if (data.length === 0) {
          setError("This game contains no tasks.");
          return;
      }
      setTasks(data);
      setSelectedTaskIds(data.map(t => t.id));
      setBrowseTab('LIBRARY'); // Switch to results view
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks from this game.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const handleImport = () => {
    const selected = tasks.filter(t => selectedTaskIds.includes(t.id));
    // Ensure GPS (radius) is enabled by default for all imported tasks
    const tasksWithGps = selected.map(t => ({
      ...t,
      activationTypes: t.activationTypes && t.activationTypes.length > 0 ? t.activationTypes : ['radius']
    }));
    onImportTasks(tasksWithGps);
  };

  const filteredGames = games.filter(g => 
    g.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTasks = tasks.filter(t => 
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.task.question?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stripHtml = (html: string) => typeof html === 'string' ? html.replace(/<[^>]*>?/gm, '') : '';

  return (
    <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#0d0d0d] border border-white/10 w-full max-w-4xl h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#0d0d0d]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#00adef]/10 rounded-2xl flex items-center justify-center border border-[#00adef]/30">
              <Globe className="w-7 h-7 text-[#00adef]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Loquiz V4 Importer</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">
                {step === 'AUTH' ? 'STEP 1: API V4 AUTHENTICATION' : `STEP 2: BROWSE ACCOUNT`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full text-gray-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Switcher (Only in Browse Step) */}
        {step === 'BROWSE' && (
            <div className="flex bg-[#111] border-b border-white/5">
                <button 
                    onClick={() => setBrowseTab('GAMES')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${browseTab === 'GAMES' ? 'bg-[#00adef] text-black shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <Gamepad2 className="w-4 h-4" /> BROWSE GAMES
                </button>
                <button 
                    onClick={handleFetchLibrary}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${browseTab === 'LIBRARY' ? 'bg-[#00adef] text-black shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                >
                    <Library className="w-4 h-4" /> ACCOUNT LIBRARY (SEE ALL)
                </button>
            </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#0a0a0a]">
          {error && (
            <div className="mb-6 p-5 bg-red-950/40 border border-red-500/30 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-2">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                  <p className="text-sm font-black text-red-200 uppercase tracking-widest mb-1">Authorization Failed</p>
                  <p className="text-xs text-red-300/70 leading-relaxed font-medium">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-500/50 hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          )}

          {step === 'AUTH' && (
            <div className="max-w-md mx-auto py-12 space-y-8 animate-in zoom-in-95 duration-300">
              <div className="text-center">
                <Key className="w-16 h-16 text-gray-800 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">Login to Loquiz V4</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Enter your X-API-KEY from the Loquiz PRO account to sync tasks.</p>
              </div>
              
              <div className="space-y-5">
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">X-API-KEY</label>
                    <div className="relative group">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-[#00adef] transition-colors" />
                        <input 
                            type="password" 
                            value={apiKey} 
                            onChange={e => setApiKey(e.target.value)}
                            className="w-full bg-[#141414] border border-white/10 rounded-2xl p-4 pl-12 text-white font-mono outline-none focus:border-[#00adef] focus:ring-1 focus:ring-[#00adef]/30 transition-all"
                            placeholder="V4 API Key"
                        />
                    </div>
                </div>

                <button 
                  onClick={handleAuthenticate}
                  disabled={loading || !apiKey}
                  className="w-full py-5 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-sm tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw className="w-4 h-4" /> AUTHORIZE CORE V4</>}
                </button>
              </div>
            </div>
          )}

          {step === 'BROWSE' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-400">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#00adef] transition-colors" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#141414] border border-white/5 rounded-[1.5rem] p-5 pl-14 text-white font-bold outline-none focus:border-[#00adef]/50 transition-all uppercase tracking-widest text-xs"
                  placeholder={browseTab === 'GAMES' ? "Search for games..." : "Search account task library..."}
                />
              </div>

              {loading ? (
                  <div className="py-20 flex flex-col items-center gap-4 text-[#00adef]">
                      <Loader2 className="w-10 h-10 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em]">Requesting Core Data...</span>
                  </div>
              ) : browseTab === 'GAMES' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredGames.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-gray-600 uppercase font-black tracking-widest text-sm opacity-50">No games found on this account.</div>
                    ) : filteredGames.map(game => (
                        <button 
                            key={game.id} 
                            onClick={() => handleSelectGame(game.id)}
                            className="flex items-center gap-5 p-6 bg-[#141414] border border-white/5 rounded-3xl hover:border-[#00adef]/50 hover:bg-[#1a1a1a] transition-all group text-left shadow-lg"
                        >
                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 group-hover:border-[#00adef]/30">
                                <Gamepad2 className="w-7 h-7 text-gray-500 group-hover:text-[#00adef] transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-black text-white uppercase tracking-wide truncate group-hover:text-[#00adef] transition-colors text-sm">{game.title}</h4>
                                <p className="text-[9px] text-gray-600 font-bold uppercase mt-1 tracking-widest">ID: {game.id}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-white transition-all group-hover:translate-x-1" />
                        </button>
                    ))}
                </div>
              ) : (
                /* TASK LIST VIEW */
                <div className="space-y-3">
                    <div className="flex justify-between items-center mb-4">
                         <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{filteredTasks.length} ASSETS FOUND</span>
                         <div className="flex gap-4 px-4">
                             <button onClick={() => setSelectedTaskIds(tasks.map(t => t.id))} className="text-[9px] font-black text-[#00adef] uppercase tracking-widest hover:underline">Select All</button>
                             <button onClick={() => setSelectedTaskIds([])} className="text-[9px] font-black text-gray-500 uppercase tracking-widest hover:underline">Clear</button>
                         </div>
                    </div>
                    {filteredTasks.length === 0 ? (
                        <div className="py-20 text-center text-gray-600 uppercase font-black tracking-widest text-sm opacity-50">No tasks match your search criteria.</div>
                    ) : filteredTasks.map(task => {
                        const isSelected = selectedTaskIds.includes(task.id);
                        return (
                            <div 
                                key={task.id} 
                                onClick={() => toggleTask(task.id)}
                                className={`flex items-start gap-5 p-5 rounded-3xl border transition-all cursor-pointer group ${isSelected ? 'bg-[#00adef]/10 border-[#00adef]/40 shadow-[0_0_20px_rgba(0,173,239,0.1)]' : 'bg-[#141414] border-white/5 hover:border-white/10'}`}
                            >
                                <div className={`w-6 h-6 mt-1 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#00adef] border-[#00adef] text-black' : 'border-white/10 group-hover:border-white/20'}`}>
                                    {isSelected && <Check className="w-4 h-4 stroke-[4]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-black text-white uppercase tracking-wide text-sm truncate">{task.title}</h4>
                                        <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-gray-500 uppercase font-black tracking-widest border border-white/5">{task.task.type}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed italic opacity-60">
                                        "{stripHtml(task.task.question)}"
                                    </p>
                                </div>
                                {task.task.imageUrl && (
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 shrink-0 border border-white/10">
                                        <img src={task.task.imageUrl} className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-white/5 bg-[#0d0d0d] flex justify-between items-center shrink-0">
          {step === 'BROWSE' ? (
            <>
              <button onClick={() => setStep('AUTH')} className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] hover:text-white transition-colors flex items-center gap-2">
                <RefreshCw className="w-3 h-3" /> RE-AUTHENTICATE
              </button>
              
              {selectedTaskIds.length > 0 ? (
                  <button 
                    onClick={handleImport}
                    className="px-12 py-5 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-sm tracking-[0.3em] rounded-2xl transition-all shadow-2xl shadow-blue-500/30 flex items-center gap-4 animate-in slide-in-from-bottom-2"
                  >
                    <Download className="w-5 h-5" /> SYNC {selectedTaskIds.length} ASSETS
                  </button>
              ) : (
                  <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Select items to sync</div>
              )}
            </>
          ) : (
             <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.5em] ml-2">
                LOQUIZ V4 SECURE CORE ACTIVE
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoquizImporter;
