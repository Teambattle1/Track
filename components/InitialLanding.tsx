import React, { useState } from 'react';
import { 
  Users, Gamepad2, Library, LayoutList, Shield, Edit2, 
  UserCircle, Settings, Play,
  LayoutDashboard, LayoutGrid, UserPlus,
  Plus, Database, ArrowLeft,
  Globe, ChevronDown, QrCode, MessageSquare, Anchor, Home, Trash2, Smartphone, FilePlus, Check, ChevronRight, LogOut
} from 'lucide-react';
import { Game, AuthUser } from '../types';

interface InitialLandingProps {
  onAction: (action: 'USERS' | 'TEAMS' | 'GAMES' | 'CREATE_GAME' | 'TASKS' | 'TASKLIST' | 'TEAMZONE' | 'EDIT_GAME' | 'PLAY' | 'TEMPLATES' | 'PLAYGROUNDS' | 'DASHBOARD' | 'TAGS' | 'ADMIN' | 'CLIENT_PORTAL' | 'QR_CODES' | 'CHAT' | 'TEAM_LOBBY' | 'DATABASE' | 'DELETE_GAMES' | 'TEAMS_MAP_VIEW' | 'PREVIEW_TEAM' | 'PREVIEW_INSTRUCTOR' | 'MANAGE_TEAMS') => void;
  version: string;
  games: Game[];
  activeGameId: string | null;
  onSelectGame: (id: string) => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
}

type CategoryView = 'HOME' | 'SETTINGS' | 'CREATE' | 'EDIT_MENU' | 'PLAY_MENU' | 'PLAY_TEAMS_MENU' | 'GAMES' | 'TEAMS' | 'TASKS' | 'ADMIN' | 'PREVIEW_SELECT';

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

const MapPinButton = ({ 
    title, 
    icon: Icon, 
    gradient, 
    onClick,
    delay,
    scale = 1
}: { 
    title: string; 
    icon: any; 
    gradient: string; 
    onClick: () => void;
    delay: number;
    scale?: number;
}) => (
    <div 
        className="flex flex-col items-center gap-6 group cursor-pointer perspective-1000" 
        onClick={onClick}
        style={{ transform: `scale(${scale})` }}
    >
        <div className="relative">
            {/* Pin Shape */}
            <div 
                className={`
                    relative w-36 h-36 md:w-48 md:h-48 
                    ${gradient}
                    rounded-full rounded-br-none 
                    rotate-45 
                    shadow-[0_10px_40px_rgba(0,0,0,0.5)] 
                    border-4 border-white/20 
                    flex items-center justify-center 
                    transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
                    group-hover:-translate-y-6 group-hover:scale-110 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.6)] group-hover:border-white/40
                    animate-in zoom-in fade-in fill-mode-backwards
                `}
                style={{ animationDelay: `${delay}ms` }}
            >
                {/* Inner Content (Counter-rotated to stay upright) */}
                <div className="-rotate-45 flex items-center justify-center">
                    <Icon className="w-12 h-12 md:w-20 md:h-20 text-white drop-shadow-md" strokeWidth={2} />
                </div>
                
                {/* Glass/Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent rounded-full rounded-br-none pointer-events-none" />
            </div>
            
            {/* Pulse Ring (behind) */}
            <div className={`absolute inset-0 rounded-full rounded-br-none rotate-45 ${gradient} opacity-20 blur-xl group-hover:blur-2xl transition-all duration-500 -z-10`} />
        </div>

        {/* Shadow Spot */}
        <div className="w-24 h-6 bg-black/60 blur-xl rounded-[100%] transition-all duration-500 group-hover:w-16 group-hover:blur-md group-hover:opacity-40 group-hover:translate-y-2" />

        {/* Title Label */}
        <div className="text-center -mt-4 transform transition-all duration-300 group-hover:-translate-y-2">
            <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-[0.2em] drop-shadow-2xl whitespace-nowrap bg-black/30 backdrop-blur-sm px-4 py-1 rounded-full">{title}</h2>
            <div className="h-1 w-12 bg-current mx-auto mt-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
    </div>
);

const InitialLanding: React.FC<InitialLandingProps> = ({ onAction, version, games, activeGameId, onSelectGame, authUser, onLogout }) => {
  const [view, setView] = useState<CategoryView>('HOME');
  const [showGameMenu, setShowGameMenu] = useState(false);
  const activeGame = games.find(g => g.id === activeGameId);

  // Dynamic Header Content
  const getHeaderContent = () => {
      switch (view) {
          case 'CREATE': return { title: 'CREATE CENTER', subtitle: 'NEW RESOURCE SETUP', showBranding: false };
          case 'EDIT_MENU': return { title: 'EDIT CENTER', subtitle: 'MODIFY RESOURCES', showBranding: false };
          case 'PLAY_MENU': return { title: 'PLAY CENTER', subtitle: 'GAME OPERATIONS', showBranding: false };
          case 'PLAY_TEAMS_MENU': return { title: 'TEAM OPERATIONS', subtitle: 'SQUAD MANAGEMENT', showBranding: false };
          case 'SETTINGS': return { title: 'SYSTEM TOOLS', subtitle: 'GLOBAL CONFIGURATION', showBranding: false };
          case 'PREVIEW_SELECT': return { title: 'SIMULATION', subtitle: 'DEVICE PREVIEW MODE', showBranding: false };
          default: return {
              title: 'HOME',
              subtitle: 'OPERATION CENTER',
              showBranding: true,
              brandingParts: [
                  { text: 'TEAM', color: 'text-white' },
                  { text: 'CHALLENGE', color: 'text-orange-500' }
              ]
          };
      }
  };

  const headerContent = getHeaderContent();

  // Navigation Logic
  const handleBack = () => {
      switch (view) {
          case 'PLAY_TEAMS_MENU':
              setView('PLAY_MENU');
              break;
          case 'PREVIEW_SELECT':
              setView('SETTINGS');
              break;
          default:
              setView('HOME');
              break;
      }
  };

  const renderHome = () => (
      <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-center justify-center w-full px-4 pb-12 pt-8">
          <MapPinButton 
              title="CREATE" 
              icon={Plus} 
              gradient="bg-gradient-to-br from-orange-600 to-red-600" 
              onClick={() => setView('CREATE')} 
              delay={0}
          />
          <MapPinButton 
              title="EDIT" 
              icon={Edit2} 
              gradient="bg-gradient-to-br from-blue-600 to-indigo-600" 
              onClick={() => setView('EDIT_MENU')} 
              delay={100}
          />
          <MapPinButton 
              title="PLAY" 
              icon={Play} 
              gradient="bg-gradient-to-br from-emerald-600 to-teal-600" 
              onClick={() => setView('PLAY_MENU')} 
              delay={200}
          />
      </div>
  );

  const renderCreateMenu = () => (
      <div className="flex flex-col items-center w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full justify-items-center pb-10 max-w-[1200px] mx-auto">
              <MapPinButton
                  title="GAME"
                  icon={Gamepad2}
                  gradient="bg-gradient-to-br from-orange-500 to-red-500"
                  onClick={() => onAction('CREATE_GAME')}
                  delay={0}
                  scale={0.75}
              />
              <MapPinButton
                  title="TASK"
                  icon={FilePlus}
                  gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
                  onClick={() => onAction('TASKS')}
                  delay={100}
                  scale={0.75}
              />
              <MapPinButton
                  title="PLAYZONE"
                  icon={Globe}
                  gradient="bg-gradient-to-br from-emerald-500 to-green-500"
                  onClick={() => onAction('PLAYGROUNDS')}
                  delay={200}
                  scale={0.75}
              />
          </div>
      </div>
  );

  const renderEditMenu = () => (
      <div className="flex flex-col items-center w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full justify-items-center pb-10 max-w-[1200px] mx-auto">
              <MapPinButton
                  title="EDIT GAME"
                  icon={Gamepad2}
                  gradient="bg-gradient-to-br from-cyan-600 to-blue-600"
                  onClick={() => onAction('GAMES')}
                  delay={0}
                  scale={0.75}
              />
              <MapPinButton
                  title="EDIT TASK"
                  icon={Edit2}
                  gradient="bg-gradient-to-br from-purple-600 to-violet-600"
                  onClick={() => onAction('TASKS')}
                  delay={100}
                  scale={0.75}
              />
              <MapPinButton
                  title="EDIT PLAYZONE"
                  icon={Globe}
                  gradient="bg-gradient-to-br from-emerald-600 to-teal-600"
                  onClick={() => onAction('PLAYGROUNDS')}
                  delay={200}
                  scale={0.75}
              />
          </div>
      </div>
  );

  const renderPlayMenu = () => (
      <div className="flex flex-col items-center w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full justify-items-center pb-10 max-w-[1200px] mx-auto">
              <MapPinButton 
                  title="PLAY GAME" 
                  icon={Play} 
                  gradient="bg-gradient-to-br from-emerald-600 to-green-600" 
                  onClick={() => onAction('PLAY')} 
                  delay={0}
                  scale={0.85}
              />
              <MapPinButton 
                  title="TEAMS" 
                  icon={Users} 
                  gradient="bg-gradient-to-br from-purple-600 to-indigo-600" 
                  onClick={() => setView('PLAY_TEAMS_MENU')} 
                  delay={100}
                  scale={0.85}
              />
              <MapPinButton 
                  title="CHAT" 
                  icon={MessageSquare} 
                  gradient="bg-gradient-to-br from-blue-600 to-cyan-600" 
                  onClick={() => onAction('CHAT')} 
                  delay={200}
                  scale={0.85}
              />
          </div>
      </div>
  );

  const renderPlayTeamsMenu = () => (
      <div className="flex flex-col items-center w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full justify-items-center pb-10 max-w-[1200px] mx-auto">
              <MapPinButton 
                  title="TEAMLOBBY" 
                  icon={Users} 
                  gradient="bg-gradient-to-br from-purple-600 to-indigo-600" 
                  onClick={() => onAction('TEAM_LOBBY')} 
                  delay={0}
                  scale={0.85}
              />
              <MapPinButton 
                  title="NEW TEAM" 
                  icon={UserPlus} 
                  gradient="bg-gradient-to-br from-pink-500 to-rose-500" 
                  onClick={() => onAction('TEAM_LOBBY')} 
                  delay={100}
                  scale={0.85}
              />
              <MapPinButton 
                  title="EDIT TEAMS" 
                  icon={Edit2} 
                  gradient="bg-gradient-to-br from-orange-600 to-amber-600" 
                  onClick={() => onAction('MANAGE_TEAMS')} 
                  delay={200}
                  scale={0.85}
              />
          </div>
      </div>
  );

  const renderCategoryContent = () => {
      switch(view) {
          case 'CREATE':
              return renderCreateMenu();
          case 'EDIT_MENU':
              return renderEditMenu();
          case 'PLAY_MENU':
              return renderPlayMenu();
          case 'PLAY_TEAMS_MENU':
              return renderPlayTeamsMenu();
          case 'SETTINGS':
              return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-right-4">
                      {/* Admin Tools */}
                      <NavCard 
                          title="USERS" 
                          subtitle="ACCESS & ROLES" 
                          icon={UserCircle} 
                          color="bg-purple-500"
                          onClick={() => onAction('USERS')}
                      />
                      <NavCard 
                          title="DATABASE" 
                          subtitle="SYSTEM MAINTENANCE" 
                          icon={Database} 
                          color="bg-blue-600"
                          onClick={() => onAction('DATABASE')} 
                      />
                      <NavCard 
                          title="GLOBAL LIBRARY" 
                          subtitle="TASK REPOSITORY" 
                          icon={Library} 
                          color="bg-emerald-500"
                          onClick={() => onAction('TASKS')}
                      />
                      <NavCard 
                          title="TEAM LOBBY" 
                          subtitle="MANAGE TEAMS" 
                          icon={Anchor} 
                          color="bg-rose-500"
                          onClick={() => onAction('TEAM_LOBBY')}
                      />
                      <NavCard 
                          title="APP PREVIEW" 
                          subtitle="SIMULATE DEVICES" 
                          icon={Smartphone} 
                          color="bg-teal-500"
                          onClick={() => setView('PREVIEW_SELECT')} 
                      />
                      <NavCard 
                          title="QR CODES" 
                          subtitle="PRINT & DOWNLOAD" 
                          icon={QrCode} 
                          color="bg-indigo-500"
                          onClick={() => onAction('QR_CODES')}
                      />
                      <NavCard 
                          title="DELETE GAMES" 
                          subtitle="REMOVE SESSIONS" 
                          icon={Trash2} 
                          color="bg-red-600"
                          onClick={() => onAction('DELETE_GAMES')} 
                      />
                  </div>
              );
          case 'PREVIEW_SELECT':
              return (
                  <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
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
    <div className="fixed inset-0 z-[4000] bg-[#1a1a1a] text-white flex flex-col font-sans uppercase overflow-hidden">
      
      {/* --- BACKGROUND LAYER (Grey Map) --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 1920 1080" preserveAspectRatio="none">
              <rect width="100%" height="100%" fill="#202020" />
              <path d="M0 0 L500 0 C 500 300, 300 500, 0 600 Z" fill="#262626" />
              <path d="M1920 1080 L1400 1080 C 1400 800, 1600 600, 1920 500 Z" fill="#262626" />
              <path d="M1920 0 L1500 0 C 1600 300, 1800 200, 1920 400 Z" fill="#2a2a2a" />
              <path d="M600 0 L900 0 L800 1080 L500 1080 Z" fill="#232323" opacity="0.5" />
              <path d="M -50 650 C 500 650, 700 350, 1100 550 C 1500 750, 1700 550, 2100 650" fill="none" stroke="#404040" strokeWidth="50" strokeLinecap="round" />
              <path d="M -50 650 C 500 650, 700 350, 1100 550 C 1500 750, 1700 550, 2100 650" fill="none" stroke="#505050" strokeWidth="4" strokeOpacity="0.5" transform="translate(0, -23)" />
              <path d="M 300 -100 C 300 300, 100 600, 200 1200" fill="none" stroke="#333333" strokeWidth="40" strokeLinecap="round" />
              <path d="M 1400 -100 C 1400 400, 1200 800, 1500 1200" fill="none" stroke="#2e2e2e" strokeWidth="30" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '100px 100px' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-10 min-h-full">
          
          {/* Header Container */}
          <div className="relative">
            
            {/* Top Left Status / Home Button */}
            <div className="absolute top-0 left-0 flex items-center gap-4 z-30">
                {view === 'HOME' ? (
                    authUser ? (
                        <div className="flex items-center gap-4 bg-slate-900/50 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                                <div className="flex flex-col">
                                    <p className="text-[8px] font-black text-slate-500 tracking-[0.2em] uppercase leading-none">OPERATOR ONLINE</p>
                                    <p className="text-xs font-black text-white tracking-widest uppercase leading-none mt-1">{authUser.name}</p>
                                </div>
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-1"></div>
                            <button 
                                onClick={onLogout} 
                                title="Logout" 
                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <p className="text-[9px] font-black text-slate-500 tracking-[0.4em] uppercase">
                              SYSTEM ONLINE &bull; v{version}
                            </p>
                        </div>
                    )
                ) : (
                    <button 
                        onClick={handleBack}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl uppercase tracking-widest text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border border-slate-700"
                        title="Go Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Right Controls */}
            <div className="absolute top-0 right-0 flex items-center gap-4 z-30">
                {/* Settings Button */}
                <button 
                    onClick={() => setView(view === 'SETTINGS' ? 'HOME' : 'SETTINGS')}
                    className={`p-3 rounded-xl transition-all hover:scale-105 active:scale-95 border ${view === 'SETTINGS' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                    title="System Settings & Tools"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            {/* Centered Title & Session Selector Block */}
            <div className="flex flex-col items-center justify-center pt-8 pb-4 gap-6">
                
                {/* Title */}
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="text-center">
                        {headerContent.showBranding ? (
                            <>
                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-2 drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]">
                                    <span className="text-white">{headerContent.brandingParts?.[0]?.text}</span>
                                    <span className="text-orange-500">{headerContent.brandingParts?.[1]?.text}</span>
                                </h1>
                                <p className="text-xs font-black text-slate-500 tracking-[0.8em] uppercase ml-2">
                                    {headerContent.subtitle}
                                </p>
                            </>
                        ) : (
                            <>
                                <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-2 text-white drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)]">
                                    {headerContent.title}
                                </h1>
                                <p className="text-xs font-black text-slate-500 tracking-[0.8em] uppercase ml-2">
                                    {headerContent.subtitle}
                                </p>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Session Selector (Only shown in Edit and Play Menus) */}
                {(view === 'EDIT_MENU' || view === 'PLAY_MENU') && (
                    <div className="relative z-20 animate-in slide-in-from-bottom-2 duration-500 delay-100">
                        <button 
                            onClick={() => setShowGameMenu(!showGameMenu)}
                            className={`flex items-center gap-3 px-8 py-4 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full shadow-2xl border transition-all font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 backdrop-blur-md ${activeGame ? 'border-orange-500/50 shadow-orange-900/20' : 'border-slate-700 hover:border-slate-500'}`}
                        >
                            <span className="max-w-[250px] truncate">{activeGame ? activeGame.name : "SELECT SESSION"}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showGameMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showGameMenu && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto animate-in slide-in-from-top-2">
                                {games.length === 0 && <div className="p-6 text-xs text-slate-500 font-bold text-center uppercase tracking-widest">NO GAMES FOUND</div>}
                                {games.map(game => (
                                    <button
                                        key={game.id}
                                        onClick={() => { onSelectGame(game.id); setShowGameMenu(false); }}
                                        className={`w-full text-left px-5 py-4 text-xs font-bold uppercase border-b border-slate-800 hover:bg-slate-800 transition-colors flex items-center justify-between ${game.id === activeGameId ? 'text-orange-500 bg-orange-900/10' : 'text-slate-300'}`}
                                    >
                                        <span className="truncate">{game.name}</span>
                                        {game.id === activeGameId && <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_orange]" />}
                                    </button>
                                ))}
                            </div>
                        )}
                        {showGameMenu && <div className="fixed inset-0 z-40" onClick={() => setShowGameMenu(false)} />}
                    </div>
                )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
              {view === 'HOME' || view === 'CREATE' || view === 'EDIT_MENU' || view === 'PLAY_MENU' || view === 'PLAY_TEAMS_MENU' ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {view === 'HOME' ? renderHome() : 
                       (view === 'CREATE' ? renderCreateMenu() : 
                       (view === 'EDIT_MENU' ? renderEditMenu() : 
                       (view === 'PLAY_MENU' ? renderPlayMenu() : 
                       renderPlayTeamsMenu())))}
                  </div>
              ) : (
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
          <div className="mt-auto pt-10 border-t border-slate-900/50 flex justify-center items-center gap-4">
            <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                POWERED BY TEAMBATTLE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitialLanding;
