
import React, { useState } from 'react';
import { 
  Users, Gamepad2, Library, LayoutList, Shield, Edit2, 
  UserCircle, Settings, MapPin, ChevronRight, Play,
  LayoutDashboard, LayoutTemplate, LayoutGrid, UserPlus,
  Monitor, Tag, Radar, Plus, Database, ArrowLeft,
  Briefcase, Boxes, ClipboardList, PenTool, Globe, Server, ChevronDown, Link, QrCode, MessageSquare, Anchor, Home, Trash2, Map, Smartphone
} from 'lucide-react';
import { Game } from '../types';

interface InitialLandingProps {
  onAction: (action: 'USERS' | 'TEAMS' | 'GAMES' | 'TASKS' | 'TASKLIST' | 'TEAMZONE' | 'EDIT_GAME' | 'PLAY' | 'TEMPLATES' | 'PLAYGROUNDS' | 'DASHBOARD' | 'TAGS' | 'ADMIN' | 'CLIENT_PORTAL' | 'QR_CODES' | 'CHAT' | 'TEAM_LOBBY' | 'DATABASE' | 'DELETE_GAMES' | 'TEAMS_MAP_VIEW' | 'PREVIEW_TEAM' | 'PREVIEW_INSTRUCTOR') => void;
  version: string;
  games: Game[];
  activeGameId: string | null;
  onSelectGame: (id: string) => void;
}

type CategoryView = 'HOME' | 'GAMES' | 'TEAMS' | 'TASKS' | 'ADMIN' | 'PREVIEW_SELECT';

const NavCard = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  color, 
  onClick 
}: { 
  title: string; 
  subtitle: string; 
  icon: any; 
  color: string; 
  onClick: () => void 
}) => (
  <button 
    onClick={onClick}
    className="group relative bg-slate-900 border border-slate-800 rounded-[1.5rem] p-5 text-left transition-all hover:scale-[1.05] active:scale-95 hover:border-white/20 hover:bg-slate-850 shadow-xl overflow-hidden flex flex-col h-full cursor-pointer hover:shadow-2xl"
  >
    <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full blur-3xl opacity-5 transition-opacity group-hover:opacity-15 ${color}`} />
    
    <div className="relative z-10 flex flex-col h-full">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:scale-110 group-hover:rotate-3 duration-300 ${color} bg-opacity-20 border border-current`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      
      <div className="flex-1">
        <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1 group-hover:text-orange-500 transition-colors">
          {title}
        </h3>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">
          {subtitle}
        </p>
      </div>
      
      <div className="mt-6 flex items-center gap-1 text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-white transition-colors group-hover:translate-x-1">
        ACCESS MODULE <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  </button>
);

const CategoryButton = ({
    title,
    icon: Icon,
    color,
    onClick
}: {
    title: string;
    icon: any;
    color: string;
    onClick: () => void;
}) => (
    <button 
        onClick={onClick}
        className={`group relative h-40 rounded-[2rem] flex flex-col items-center justify-center overflow-hidden shadow-2xl transition-all hover:scale-[1.05] active:scale-95 border-2 hover:shadow-3xl cursor-pointer ${color}`}
    >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/50 to-transparent" />
        
        <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform duration-300 group-hover:bg-white/20">
                <Icon className="w-10 h-10 text-white" />
            </div>
            <span className="text-2xl font-black text-white uppercase tracking-[0.2em] drop-shadow-md group-hover:tracking-[0.25em] transition-all">
                {title}
            </span>
        </div>
    </button>
);

const InitialLanding: React.FC<InitialLandingProps> = ({ onAction, version, games, activeGameId, onSelectGame }) => {
  const [view, setView] = useState<CategoryView>('HOME');
  const [showGameMenu, setShowGameMenu] = useState(false);
  const activeGame = games.find(g => g.id === activeGameId);

  const renderHome = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
          <CategoryButton 
              title="GAMES" 
              icon={Gamepad2} 
              color="bg-orange-600 border-orange-500" 
              onClick={() => setView('GAMES')} 
          />
          <CategoryButton 
              title="TEAMS" 
              icon={Users} 
              color="bg-blue-600 border-blue-500" 
              onClick={() => setView('TEAMS')} 
          />
          <CategoryButton 
              title="TASKS" 
              icon={Library} 
              color="bg-emerald-600 border-emerald-500" 
              onClick={() => setView('TASKS')} 
          />
          <CategoryButton 
              title="ADMIN" 
              icon={Shield} 
              color="bg-slate-700 border-slate-600" 
              onClick={() => setView('ADMIN')} 
          />
      </div>
  );

  const renderCategoryContent = () => {
      switch(view) {
          case 'GAMES':
              return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <NavCard 
                          title="GAMES" 
                          subtitle="SESSION HUB" 
                          icon={Gamepad2} 
                          color="bg-orange-500"
                          onClick={() => onAction('GAMES')}
                      />
                      <NavCard 
                          title="EDIT GAME" 
                          subtitle="MAP & LOGIC" 
                          icon={Edit2} 
                          color="bg-amber-500"
                          onClick={() => onAction('EDIT_GAME')}
                      />
                      <NavCard 
                          title="PLAYGROUND TEMPLATES" 
                          subtitle="GLOBAL LIBRARY" 
                          icon={LayoutGrid} 
                          color="bg-violet-500"
                          onClick={() => onAction('PLAYGROUNDS')}
                      />
                  </div>
              );
          case 'TEAMS':
              return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <NavCard 
                          title="TEAMLOBBY ADMIN" 
                          subtitle="MONITOR & MANAGE" 
                          icon={Anchor} 
                          color="bg-rose-500"
                          onClick={() => onAction('TEAM_LOBBY')}
                      />
                      <NavCard 
                          title="TEAM CHAT" 
                          subtitle="COMMS CHANNEL" 
                          icon={MessageSquare} 
                          color="bg-indigo-500"
                          onClick={() => onAction('CHAT')}
                      />
                      <NavCard 
                          title="TEAMS MAP VIEW" 
                          subtitle="COMMAND CENTER" 
                          icon={Map} 
                          color="bg-cyan-500"
                          onClick={() => onAction('TEAMS_MAP_VIEW')}
                      />
                      <NavCard 
                          title="TEAM LOGIN" 
                          subtitle="JOIN MISSION" 
                          icon={UserPlus} 
                          color="bg-blue-500"
                          onClick={() => onAction('TEAMS')}
                      />
                  </div>
              );
          case 'TASKS':
              return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <NavCard 
                          title="TASKS" 
                          subtitle="LIBRARY AI HUB" 
                          icon={Library} 
                          color="bg-emerald-500"
                          onClick={() => onAction('TASKS')}
                      />
                      <NavCard 
                          title="TASK LIST" 
                          subtitle="LIST MANAGER" 
                          icon={LayoutList} 
                          color="bg-green-500"
                          onClick={() => onAction('TASKLIST')}
                      />
                      <NavCard 
                          title="TAGS" 
                          subtitle="CATEGORIES" 
                          icon={Tag} 
                          color="bg-lime-500"
                          onClick={() => onAction('TAGS')}
                      />
                      <NavCard 
                          title="CLIENT PORTAL" 
                          subtitle="EXTERNAL LINKS" 
                          icon={Link} 
                          color="bg-pink-500"
                          onClick={() => onAction('CLIENT_PORTAL')}
                      />
                      <NavCard 
                          title="QR CODES" 
                          subtitle="PRINT & DOWNLOAD" 
                          icon={QrCode} 
                          color="bg-purple-500"
                          onClick={() => onAction('QR_CODES')}
                      />
                  </div>
              );
          case 'ADMIN':
              return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      <NavCard 
                          title="USERS" 
                          subtitle="ACCESS & ROLES" 
                          icon={UserCircle} 
                          color="bg-purple-500"
                          onClick={() => onAction('USERS')}
                      />
                      <NavCard 
                          title="DATABASE / SQL" 
                          subtitle="SYSTEM MAINTENANCE" 
                          icon={Database} 
                          color="bg-blue-600"
                          onClick={() => onAction('DATABASE')} 
                      />
                      <NavCard 
                          title="DELETE GAMES" 
                          subtitle="REMOVE SESSIONS" 
                          icon={Trash2} 
                          color="bg-red-600"
                          onClick={() => onAction('DELETE_GAMES')} 
                      />
                      <NavCard 
                          title="APP PREVIEW" 
                          subtitle="SIMULATE DEVICES" 
                          icon={Smartphone} 
                          color="bg-teal-500"
                          onClick={() => setView('PREVIEW_SELECT')} 
                      />
                  </div>
              );
          case 'PREVIEW_SELECT':
              return (
                  <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
                      <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-xs tracking-widest cursor-pointer hover:text-white" onClick={() => setView('ADMIN')}>
                          <ArrowLeft className="w-4 h-4" /> Back to Admin
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <NavCard 
                              title="TEAM PREVIEW" 
                              subtitle="SIMULATE PLAYER VIEW" 
                              icon={Users} 
                              color="bg-orange-500"
                              onClick={() => onAction('PREVIEW_TEAM')}
                          />
                          <NavCard 
                              title="INSTRUCTOR PREVIEW" 
                              subtitle="SIMULATES INSTRUCTOR VIEW" 
                              icon={Shield} 
                              color="bg-indigo-500"
                              onClick={() => onAction('PREVIEW_INSTRUCTOR')}
                          />
                      </div>
                  </div>
              );
          default:
              return null;
      }
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950 text-white flex flex-col font-sans uppercase overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)] opacity-40" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-10 min-h-full">
          
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <LayoutDashboard className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight leading-none mb-1">COMMAND CENTER</h1>
                <p className="text-[10px] font-black text-slate-500 tracking-[0.4em] uppercase">TEAMACTION MANAGEMENT</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Game Session Chooser */}
                <div className="relative">
                    <button 
                        onClick={() => setShowGameMenu(!showGameMenu)}
                        className={`flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-900/20 transition-all font-black uppercase text-xs tracking-widest border hover:scale-105 active:scale-95 ${activeGame ? 'border-orange-500' : 'border-red-500 animate-pulse'}`}
                    >
                        <span className="max-w-[200px] truncate">{activeGame ? activeGame.name : "SELECT SESSION"}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showGameMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showGameMenu && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto animate-in slide-in-from-top-2">
                            {games.length === 0 && <div className="p-4 text-xs text-slate-500 font-bold text-center">NO GAMES FOUND</div>}
                            {games.map(game => (
                                <button
                                    key={game.id}
                                    onClick={() => { onSelectGame(game.id); setShowGameMenu(false); }}
                                    className={`w-full text-left px-4 py-3 text-xs font-bold uppercase border-b border-slate-800 hover:bg-slate-800 transition-colors flex items-center justify-center ${game.id === activeGameId ? 'text-orange-500' : 'text-slate-300'}`}
                                >
                                    <span className="truncate">{game.name}</span>
                                    {game.id === activeGameId && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                                </button>
                            ))}
                        </div>
                    )}
                    {showGameMenu && <div className="fixed inset-0 z-40" onClick={() => setShowGameMenu(false)} />}
                </div>

                {view !== 'HOME' && (
                    <button 
                        onClick={() => setView('HOME')}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl uppercase tracking-widest text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border border-slate-700"
                        title="Back to Home"
                    >
                        <Home className="w-5 h-5" />
                    </button>
                )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
              {view === 'HOME' ? renderHome() : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="mb-6 flex items-center gap-3 opacity-50">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{view === 'PREVIEW_SELECT' ? 'PREVIEW MODE' : `${view} MODULES`}</span>
                          <div className="h-px bg-slate-700 flex-1" />
                      </div>
                      {renderCategoryContent()}
                  </div>
              )}
          </div>

          {/* Footer Branding */}
          <div className="mt-auto pt-10 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[9px] font-black text-slate-700 tracking-[0.4em] uppercase">
                  SYSTEM ONLINE &bull; v{version}
                </p>
            </div>
            <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest">
                POWERED BY TEAMBATTLE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitialLanding;
