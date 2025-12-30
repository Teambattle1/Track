import React, { useState, useEffect, useMemo } from 'react';
import { Game, TaskList, TaskTemplate, Team } from '../types';
import AccountUsers from './AccountUsers';
import AccountTags from './AccountTags';
import * as db from '../services/db';
import { formatDateShort } from '../utils/date';
import {
  LayoutDashboard, Gamepad2, LayoutTemplate, ListChecks,
  ExternalLink, Plus, ChevronRight, Settings, Clock, Star,
  Search, Filter, ChevronDown, User, Lock, Eye, MoreHorizontal,
  CheckCircle2, Globe, Tag, Info, UserCircle, X, Users, Link, Copy, ClipboardList, Send, ArrowLeft, Home,
  BarChart2, Calendar
} from 'lucide-react';

interface DashboardProps {
  games: Game[];
  taskLists: TaskList[];
  taskLibrary?: TaskTemplate[]; // Added to prop interface
  onBack: () => void;
  onAction: (action: 'CREATE' | 'CREATE_FROM_TEMPLATE' | 'EDIT_GAME' | 'VIEW_TEMPLATES' | 'VIEW_TASKS' | 'REFRESH_DATA') => void;
  onSelectGame?: (id: string) => void; // New prop
  userName: string;
  initialTab?: 'dashboard' | 'games' | 'templates' | 'tasks' | 'users' | 'tags' | 'client';
  onDeleteTagGlobally?: (tagName: string) => Promise<void>;
  onRenameTagGlobally?: (oldTag: string, newTag: string) => Promise<void>;
}

const Dashboard: React.FC<DashboardProps> = ({ games, taskLists, taskLibrary = [], onBack, onAction, onSelectGame, userName, initialTab = 'dashboard', onDeleteTagGlobally, onRenameTagGlobally }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'games' | 'templates' | 'tasks' | 'users' | 'tags' | 'client'>(initialTab as any);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Client List Creation State
  const [isCreatingClientList, setIsCreatingClientList] = useState(false);
  const [newClientListName, setNewClientListName] = useState('');

  // Statistics Modal State
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsGameId, setStatsGameId] = useState<string | null>(null);
  const [statsTeams, setStatsTeams] = useState<Team[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Update active tab if initialTab changes externally
  useEffect(() => {
    setActiveTab(initialTab as any);
  }, [initialTab]);

  const gamesArr = Array.isArray(games) ? games : [];
  const listsArr = Array.isArray(taskLists) ? taskLists : [];
  const libraryArr = Array.isArray(taskLibrary) ? taskLibrary : [];

  // Sort games by date for the dashboard landing
  const recentGames = [...gamesArr].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  
  // Get some templates for the featured section
  const featuredTemplates = listsArr.slice(0, 4);

  // For the Templates tab, split between My and Free
  const myTemplates = listsArr.filter(l => !l.isClientList).slice(0, 4);

  // Use centralized date formatting (defaults to English for task lists without language)
  const formatDate = (ts: number) => {
    return formatDateShort(ts, 'English');
  };

  const getFlag = (list: TaskList) => {
    const lang = list.tasks?.[0]?.settings?.language || 'English';
    if (lang.includes('Danish')) return "🇩🇰";
    if (lang.includes('German')) return "🇩🇪";
    if (lang.includes('Spanish')) return "🇪🇸";
    return "🇬🇧";
  };

  const handleCreateClientList = async () => {
      if (!newClientListName.trim()) return;
      const newList: TaskList = {
          id: `list-${Date.now()}`,
          name: newClientListName,
          description: "Tasks submitted by client via shared link.",
          tasks: [],
          color: '#ef4444', 
          createdAt: Date.now(),
          isClientList: true,
          shareToken: Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
      };
      await db.saveTaskList(newList);
      setNewClientListName('');
      setIsCreatingClientList(false);
      onAction('REFRESH_DATA');
  };

  const copyLink = (token: string) => {
      const url = `${window.location.origin}?submitTo=${token}`;
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
  };

  const handleGameClick = (id: string) => {
      if (onSelectGame) {
          onSelectGame(id);
      } else {
          onAction('EDIT_GAME'); // Fallback behavior
      }
  };

  const handleShowStats = async (gameId: string) => {
      setStatsGameId(gameId);
      setShowStatsModal(true);
      setIsStatsLoading(true);
      try {
          const teams = await db.fetchTeams(gameId);
          setStatsTeams(teams);
      } catch (e) {
          console.error("Failed to fetch stats", e);
      } finally {
          setIsStatsLoading(false);
      }
  };

  const getGameStatsData = useMemo(() => {
      const groups: Record<string, { teams: number, players: number }> = {};
      
      statsTeams.forEach(t => {
          const date = new Date(t.updatedAt || new Date());
          // Create key "YYYY-MM"
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!groups[key]) {
              groups[key] = { teams: 0, players: 0 };
          }
          groups[key].teams++;
          groups[key].players += (t.members?.length || 0);
      });

      // Convert to array and sort descending by date (newest first)
      return Object.entries(groups)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([key, data]) => {
              const [year, month] = key.split('-');
              const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
              return {
                  monthLabel: dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }),
                  teams: data.teams,
                  players: data.players
              };
          });
  }, [statsTeams]);

  // --- RENDERERS ---

  const renderClientHub = () => {
      const clientLists = listsArr.filter(l => l.isClientList);

      return (
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-20">
              <div className="flex justify-between items-center mb-8">
                  <div>
                      <h1 className="text-4xl font-black text-white tracking-tight uppercase">CLIENT PORTAL</h1>
                      <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Manage external submission links</p>
                  </div>
                  <button 
                      onClick={() => setIsCreatingClientList(true)}
                      className="px-6 py-3 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg shadow-[#00adef]/20 flex items-center gap-2 hover:scale-105 active:scale-95"
                  >
                      <Plus className="w-4 h-4" /> CREATE NEW PORTAL
                  </button>
              </div>

              {isCreatingClientList && (
                  <div className="mb-8 bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 flex items-center gap-4 animate-in slide-in-from-top-2">
                      <div className="flex-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">EVENT / CLIENT NAME</label>
                          <input 
                              type="text" 
                              value={newClientListName}
                              onChange={(e) => setNewClientListName(e.target.value)}
                              placeholder="e.g. Coca Cola Summer Party"
                              className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-[#00adef] transition-all uppercase placeholder:text-gray-700 text-sm"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleCreateClientList()}
                          />
                      </div>
                      <div className="flex gap-2 mt-6">
                          <button onClick={() => setIsCreatingClientList(false)} className="px-4 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-xs uppercase tracking-wide hover:bg-slate-700 transition-colors">CANCEL</button>
                          <button onClick={handleCreateClientList} className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl text-xs uppercase tracking-wide hover:bg-green-700 transition-colors shadow-lg hover:scale-105">CREATE</button>
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {clientLists.length === 0 && !isCreatingClientList && (
                      <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 opacity-30">
                          <Globe className="w-16 h-16" />
                          <p className="text-sm font-black uppercase tracking-widest">NO CLIENT PORTALS ACTIVE</p>
                      </div>
                  )}

                  {clientLists.map(list => (
                      <div key={list.id} className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col hover:border-white/10 transition-all group hover:-translate-y-1">
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-[#00adef]/10 rounded-xl flex items-center justify-center border border-[#00adef]/20">
                                      <Link className="w-6 h-6 text-[#00adef]" />
                                  </div>
                                  <div>
                                      <h3 className="text-lg font-black text-white uppercase tracking-wide truncate max-w-[200px]">{list.name}</h3>
                                      <span className="text-[9px] bg-green-900/30 text-green-500 px-2 py-0.5 rounded font-black tracking-widest uppercase border border-green-500/20 inline-block mt-1">LIVE LINK</span>
                                  </div>
                              </div>
                          </div>

                          <div className="bg-[#0a0a0a] rounded-xl p-3 flex items-center justify-between border border-white/5 mb-6 group-hover:border-white/10 transition-colors">
                              <span className="text-[10px] text-gray-500 font-mono truncate max-w-[200px]">{window.location.origin}?submitTo=...</span>
                              <button 
                                  onClick={() => list.shareToken && copyLink(list.shareToken)}
                                  className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                  title="Copy Link"
                              >
                                  <Copy className="w-4 h-4" />
                              </button>
                          </div>

                          <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
                              <div className="flex items-center gap-2">
                                  <ClipboardList className="w-4 h-4 text-gray-500" />
                                  <span className="text-xs font-bold text-gray-400 uppercase">{list.tasks.length} SUBMITTED</span>
                              </div>
                              <button className="text-[10px] font-black text-[#00adef] uppercase tracking-widest flex items-center gap-1 hover:underline">
                                  REVIEW TASKS <ChevronRight className="w-3 h-3" />
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  const renderDashboardLanding = () => (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-black tracking-tight">Dashboard</h1>
        <p className="text-gray-500 font-medium text-sm mt-1">{userName}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#141414] border border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-xl group">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-[#1a1a1a] rounded-[1.5rem] flex items-center justify-center relative z-10 border border-white/10 shadow-2xl transition-transform group-hover:scale-105">
              <Gamepad2 className="w-12 h-12 text-white group-hover:scale-110 transition-transform duration-500" />
            </div>
            <Star className="absolute -top-4 -right-4 w-4 h-4 text-blue-400 animate-pulse" />
            <Star className="absolute -bottom-2 -left-6 w-5 h-5 text-blue-500 opacity-50" />
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full scale-150"></div>
          </div>
          <h2 className="text-3xl font-black mb-10 tracking-tight">Create a new game</h2>
          <div className="flex gap-4 w-full max-w-sm">
            <button onClick={() => onAction('CREATE')} className="flex-1 py-4 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/10 hover:scale-105 active:scale-95">New from scratch</button>
            <button onClick={() => { setActiveTab('templates'); }} className="flex-1 py-4 bg-transparent border-2 border-[#00adef]/40 hover:border-[#00adef] text-[#00adef] font-black uppercase text-xs tracking-widest rounded-xl transition-all hover:scale-105 active:scale-95">New from tasklist</button>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#141414] border border-white/5 rounded-2xl p-8 flex flex-col shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black tracking-tight">Featured tasklists</h3>
            <button onClick={() => setActiveTab('templates')} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 font-bold uppercase transition-colors">More <ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-4">
            {featuredTemplates.length > 0 ? featuredTemplates.map(tpl => (
              <div className="flex items-center gap-4 group cursor-pointer hover:translate-x-1 transition-transform" onClick={() => { setActiveTab('templates'); }}>
                <div className="w-12 h-12 bg-[#2d2d2d] rounded-xl overflow-hidden shrink-0 border border-white/5 group-hover:border-blue-500/50 transition-colors">
                  {tpl.imageUrl ? <img src={tpl.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-500"><LayoutTemplate className="w-5 h-5" /></div>}
                </div>
                <span className="font-bold text-sm text-gray-300 group-hover:text-white transition-colors">{tpl.name}</span>
              </div>
            )) : <p className="text-xs text-gray-600 italic">No tasklists available yet.</p>}
          </div>
        </div>
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-black tracking-tight">Recently edited games</h3>
          <button onClick={() => setActiveTab('games')} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 font-bold uppercase transition-colors">More <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="divide-y divide-white/5">
          {recentGames.length > 0 ? recentGames.map(game => (
            <div key={game.id} className="p-6 hover:bg-white/[0.05] transition-colors flex items-center justify-between group cursor-pointer" onClick={() => handleGameClick(game.id)}>
              <div>
                <h4 className="font-black text-sm uppercase tracking-wide group-hover:text-[#00adef] transition-colors">{game.name}</h4>
                <p className="text-[10px] text-gray-600 font-mono mt-1 uppercase">{game.id}</p>
              </div>
              <button className="p-2 text-gray-500 hover:text-white"><ExternalLink className="w-4 h-4" /></button>
            </div>
          )) : <div className="p-12 text-center text-gray-600 uppercase text-[10px] font-black tracking-[0.2em]">No recent games found</div>}
        </div>
      </div>
    </div>
  );

  const renderTemplatesList = () => (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-500">
      
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-black tracking-tight">My Tasklists</h1>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={() => onAction('CREATE')}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-[#00adef] hover:bg-[#0096ce] text-black font-black uppercase text-xs tracking-widest rounded-lg transition-all shadow-lg hover:scale-105 active:scale-95"
          >
            New game from scratch
          </button>
          <button className="flex-1 sm:flex-none px-6 py-2.5 bg-[#1a1a1a] border border-white/10 text-white font-black uppercase text-xs tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 hover:bg-[#252525] hover:scale-105 active:scale-95">
            How to create tasklists? <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* My Templates Section */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {myTemplates.map(list => (
            <div key={list.id} className="group bg-[#111111] border border-white/5 rounded-xl overflow-hidden hover:border-[#00adef]/30 transition-all cursor-pointer shadow-lg hover:-translate-y-1">
              <div className="aspect-[16/9] bg-[#1a1a1a] overflow-hidden relative">
                {list.imageUrl ? (
                  <img src={list.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={list.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-800 bg-[url('https://www.transparenttextures.com/patterns/circles.png')] bg-repeat">
                    <LayoutTemplate className="w-12 h-12 opacity-20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="p-5 flex items-center justify-between">
                <h3 className="font-black text-white text-sm uppercase truncate pr-4">{list.name}</h3>
                <div className="text-xl shrink-0 filter grayscale group-hover:grayscale-0 transition-all" title="Tasklist Language">
                  {getFlag(list)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="px-6 py-2.5 bg-[#1a1a1a] border border-white/10 text-gray-400 font-black uppercase text-xs tracking-widest rounded-lg transition-all flex items-center gap-2 hover:bg-[#252525] hover:text-white hover:scale-105 active:scale-95">
          More my tasklists <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  const renderGamesList = () => (
    <div className="max-w-[100%] mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-[#141414] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        
        {/* Table Header Labels */}
        <div className="grid grid-cols-[48px_1fr_80px_80px_80px_100px_100px_100px_140px_140px_80px_100px] gap-4 px-6 py-4 bg-[#0a0a0a] border-b border-white/5 items-center">
          <div className="w-4 h-4 border border-white/10 rounded"></div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Title</div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Status</div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Type</div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Tags</div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Language</div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">User</div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pass</div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Creator</div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">Updated <ChevronDown className="w-3 h-3"/></div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Players</div>
          <div></div>
        </div>

        {/* Filter / Search Row */}
        <div className="grid grid-cols-[48px_1fr_80px_80px_80px_100px_100px_100px_140px_140px_80px_100px] gap-4 px-6 py-3 bg-[#111111] border-b border-white/5 items-center">
          <div className="flex items-center justify-center"><X className="w-3 h-3 text-gray-600 hover:text-white cursor-pointer" /></div>
          <div className="relative">
            <input type="text" placeholder="Search..." className="w-full bg-transparent border-none text-xs text-gray-400 placeholder-gray-700 outline-none p-0 focus:text-white" />
          </div>
          <div className="text-[10px] font-bold text-gray-600 uppercase text-center cursor-pointer hover:text-white">All</div>
          <div className="text-[10px] font-bold text-gray-600 uppercase text-center cursor-pointer hover:text-white">All</div>
          <div className="text-[10px] font-bold text-gray-600 uppercase text-center cursor-pointer hover:text-white">All</div>
          <div className="text-[10px] font-bold text-gray-600 uppercase text-center cursor-pointer hover:text-white">All</div>
          <div><input type="text" placeholder="Search..." className="w-full bg-transparent border-none text-xs text-gray-400 placeholder-gray-700 outline-none p-0 focus:text-white" /></div>
          <div><input type="text" placeholder="Search..." className="w-full bg-transparent border-none text-xs text-gray-400 placeholder-gray-700 outline-none p-0 focus:text-white" /></div>
          <div><input type="text" placeholder="Search..." className="w-full bg-transparent border-none text-xs text-gray-400 placeholder-gray-700 outline-none p-0 focus:text-white" /></div>
          <div className="h-4"></div>
          <div className="h-4"></div>
          <div></div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5 bg-[#141414]">
          {gamesArr.map(game => (
            <div key={game.id} className="grid grid-cols-[48px_1fr_80px_80px_80px_100px_100px_100px_140px_140px_80px_100px] gap-4 px-6 py-6 items-center hover:bg-white/[0.05] transition-colors group cursor-pointer" onClick={() => handleGameClick(game.id)}>
              <div className="flex items-center justify-center"><div className="w-4 h-4 border border-white/10 rounded hover:border-blue-500 cursor-pointer"></div></div>
              
              <div className="min-w-0 pr-4">
                <h4 className="text-sm font-black text-white uppercase tracking-wide truncate group-hover:text-[#00adef] transition-colors">{game.name}</h4>
                <div className="flex items-center gap-1 mt-1 text-gray-500">
                  <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center"><Gamepad2 className="w-2.5 h-2.5 text-white" /></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Creator</span>
                </div>
              </div>

              <div className="text-center"></div> {/* Status */}
              <div className="text-center"></div> {/* Type */}
              <div className="text-center"></div> {/* Tags */}
              <div className="text-center"></div> {/* Language */}

              <div className="text-[10px] font-black text-gray-400 uppercase font-mono">{game.id.slice(-4).toUpperCase()}</div>
              <div className="text-[10px] font-black text-gray-400 uppercase font-mono">{game.id.slice(-4).toUpperCase()}</div>
              
              <div className="text-xs font-bold text-gray-300">{userName}</div>
              
              <div className="text-xs font-medium text-gray-400">{formatDate(game.createdAt)}</div>
              
              <div className="text-xs font-bold text-gray-400 text-center">0</div>

              <div className="flex items-center justify-end gap-3">
                {/* Stats Button */}
                <button 
                    className="p-1.5 text-gray-500 hover:text-orange-500 transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleShowStats(game.id); }}
                    title="View Statistics"
                >
                    <BarChart2 className="w-4 h-4" />
                </button>
                <button className="relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full bg-green-600/20 border border-green-500/30 transition-colors focus-visible:outline-none hover:scale-110 active:scale-95">
                  <span className="translate-x-5 inline-block h-3 w-3 transform rounded-full bg-green-500 transition-transform duration-200 ease-in-out" />
                </button>
                <button className="p-1.5 text-gray-500 hover:text-white transition-colors" title="External Link"><ExternalLink className="w-4 h-4" /></button>
              </div>
            </div>
          ))}

          {gamesArr.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <Gamepad2 className="w-12 h-12 text-gray-700" />
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">NO GAMES FOUND</p>
              <button onClick={() => onAction('CREATE')} className="px-6 py-3 bg-[#00adef] text-black font-black uppercase text-xs rounded-xl hover:scale-105 transition-all">Create your first game</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[3500] bg-[#0d0d0d] text-white flex flex-col font-sans overflow-hidden">
      
      {/* Top Navigation Bar */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#141414] shrink-0">
        <button 
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-xl transition-all border border-white/5 hover:border-white/10 hover:scale-105 active:scale-95"
            title="Back to Home"
        >
            <Home className="w-5 h-5 text-white" />
        </button>
      </nav>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-8 custom-scrollbar bg-[#0d0d0d]">
          {activeTab === 'dashboard' ? renderDashboardLanding() : 
           activeTab === 'games' ? renderGamesList() : 
           activeTab === 'templates' ? renderTemplatesList() :
           activeTab === 'client' ? renderClientHub() :
           activeTab === 'users' ? <AccountUsers /> :
           activeTab === 'tags' ? <AccountTags games={gamesArr} library={[...listsArr.flatMap(l => l.tasks), ...libraryArr]} onDeleteTagGlobally={onDeleteTagGlobally} onRenameTagGlobally={onRenameTagGlobally} /> :
           <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4">
               <Info className="w-12 h-12" />
               <p className="font-black uppercase tracking-[0.2em] text-sm">{activeTab} section coming soon</p>
               <button onClick={() => setActiveTab('dashboard')} className="text-xs font-bold text-blue-500 hover:underline">Return to Dashboard</button>
           </div>
          }
      </div>

      {/* STATISTICS MODAL */}
      {showStatsModal && (
          <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-[#141414] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                  
                  {/* Header */}
                  <div className="p-6 border-b border-white/5 bg-[#0a0a0a] flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3">
                              <BarChart2 className="w-6 h-6 text-orange-500" /> GAME STATISTICS
                          </h3>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                              SESSION: {gamesArr.find(g => g.id === statsGameId)?.name || 'UNKNOWN'}
                          </p>
                      </div>
                      <button onClick={() => setShowStatsModal(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-white">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 bg-[#0f0f0f] custom-scrollbar">
                      {isStatsLoading ? (
                          <div className="flex flex-col items-center justify-center h-48 opacity-50">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                              <span className="text-xs font-bold uppercase">Loading Data...</span>
                          </div>
                      ) : getGameStatsData.length === 0 ? (
                          <div className="text-center py-12 opacity-30">
                              <BarChart2 className="w-16 h-16 mx-auto mb-4" />
                              <p className="font-black uppercase tracking-widest text-sm">NO DATA AVAILABLE</p>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {/* Total Summary */}
                              <div className="grid grid-cols-2 gap-4 mb-6">
                                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 text-center">
                                      <span className="block text-2xl font-black text-white">{statsTeams.length}</span>
                                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">TOTAL TEAMS</span>
                                  </div>
                                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 text-center">
                                      <span className="block text-2xl font-black text-white">{statsTeams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}</span>
                                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">TOTAL PLAYERS</span>
                                  </div>
                              </div>

                              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">MONTHLY BREAKDOWN</h4>
                              <div className="border border-white/5 rounded-xl overflow-hidden">
                                  <table className="w-full text-left border-collapse">
                                      <thead>
                                          <tr className="bg-[#1a1a1a] border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                              <th className="p-4">Month</th>
                                              <th className="p-4 text-center">Teams</th>
                                              <th className="p-4 text-center">Players</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5">
                                          {getGameStatsData.map((stat, idx) => (
                                              <tr key={idx} className="hover:bg-white/[0.02]">
                                                  <td className="p-4 flex items-center gap-2 font-bold text-gray-300 text-xs uppercase">
                                                      <Calendar className="w-3 h-3 text-orange-500" />
                                                      {stat.monthLabel}
                                                  </td>
                                                  <td className="p-4 text-center font-mono font-bold text-white text-sm">{stat.teams}</td>
                                                  <td className="p-4 text-center font-mono font-bold text-white text-sm">{stat.players}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
