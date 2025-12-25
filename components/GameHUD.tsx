
import React, { useState, useEffect, useRef } from 'react';
import { GameMode, MapStyleId, Language, Playground, TimerConfig, Coordinate } from '../types';
import { Map as MapIcon, Layers, GraduationCap, Menu, X, Globe, Moon, Sun, Library, Users, Home, LayoutDashboard, Ruler, Gamepad2, Shield, Clock, Move, MapPin, Maximize, Target, Hash, MessageSquare, Skull, Siren, AlertTriangle, GripHorizontal, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatDistance } from '../utils/geo';
import LocationSearch from './LocationSearch';
import { ICON_COMPONENTS } from '../utils/icons';

interface GameHUDProps {
  accuracy: number | null;
  mode: GameMode;
  toggleMode: () => void;
  onSetMode?: (mode: GameMode) => void; 
  onOpenGameManager: () => void;
  onOpenTaskMaster: () => void;
  onOpenTeams: () => void;
  mapStyle: MapStyleId;
  onSetMapStyle: (style: MapStyleId) => void;
  language: Language;
  onBackToHub: () => void;
  activeGameName?: string;
  onOpenInstructorDashboard?: () => void;
  isMeasuring?: boolean;
  onToggleMeasure?: () => void;
  measuredDistance?: number;
  playgrounds?: Playground[];
  onOpenPlayground?: (id: string) => void;
  onOpenTeamDashboard?: () => void;
  onRelocateGame?: () => void;
  isRelocating?: boolean;
  timerConfig?: TimerConfig; 
  gameStartedAt?: number;
  onFitBounds?: () => void; 
  onLocateMe?: () => void; 
  onSearchLocation?: (coord: Coordinate) => void; 
  isDrawerExpanded?: boolean; 
  showScores?: boolean;
  onToggleScores?: () => void;
  hiddenPlaygroundIds?: string[]; 
  onToggleChat?: () => void; 
  unreadMessagesCount?: number; 
  targetPlaygroundId?: string; 
  onAddDangerZone?: () => void; 
  activeDangerZone?: { id: string; enteredAt: number; timeRemaining: number } | null; 
  showOtherTeams?: boolean;
  onToggleShowOtherTeams?: () => void;
}

// Timer Sub-component
const TimerDisplay = ({ config, startTime }: { config: TimerConfig, startTime?: number }) => {
    const [displayTime, setDisplayTime] = useState("--:--");
    const [statusColor, setStatusColor] = useState("text-white");

    useEffect(() => {
        if (config.mode === 'none') return;

        const updateTimer = () => {
            const now = Date.now();
            let seconds = 0;

            if (config.mode === 'countup') {
                const start = startTime || now; 
                seconds = Math.floor((now - start) / 1000);
            } else if (config.mode === 'countdown') {
                const start = startTime || now;
                const durationSec = (config.durationMinutes || 60) * 60;
                const elapsed = Math.floor((now - start) / 1000);
                seconds = durationSec - elapsed;
            } else if (config.mode === 'scheduled_end') {
                if (config.endTime) {
                    const end = new Date(config.endTime).getTime();
                    seconds = Math.floor((end - now) / 1000);
                }
            }

            if (seconds < 0) {
                if (config.mode === 'countup') seconds = Math.abs(seconds); 
                else seconds = 0; 
            }

            if (config.mode !== 'countup' && seconds < 300) setStatusColor("text-red-500 animate-pulse"); 
            else setStatusColor("text-white");

            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;

            if (h > 0) {
                setDisplayTime(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            } else {
                setDisplayTime(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [config, startTime]);

    if (config.mode === 'none') return null;

    return (
        <div className="absolute top-16 md:top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700 px-4 py-1.5 rounded-xl shadow-xl flex flex-col items-center min-w-[100px] z-[500] pointer-events-none">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                {config.title || "TIMER"}
            </span>
            <div className={`text-xl font-mono font-black leading-none flex items-center gap-2 ${statusColor}`}>
                <Clock className="w-4 h-4 opacity-50" />
                {displayTime}
            </div>
        </div>
    );
};

const GameHUD: React.FC<GameHUDProps> = ({ 
  mode, 
  toggleMode,
  onSetMode,
  onOpenGameManager,
  onOpenTaskMaster,
  onOpenTeams,
  mapStyle,
  onSetMapStyle,
  onBackToHub,
  onOpenInstructorDashboard,
  isMeasuring,
  onToggleMeasure,
  measuredDistance,
  playgrounds,
  onOpenPlayground,
  onOpenTeamDashboard,
  onRelocateGame,
  isRelocating,
  timerConfig,
  gameStartedAt,
  onFitBounds,
  onLocateMe,
  onSearchLocation,
  isDrawerExpanded = false,
  showScores,
  onToggleScores,
  hiddenPlaygroundIds = [],
  onToggleChat,
  unreadMessagesCount = 0,
  targetPlaygroundId, 
  onAddDangerZone,
  activeDangerZone,
  showOtherTeams,
  onToggleShowOtherTeams
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEditBanner, setShowEditBanner] = useState(false);

  // Floating Toolbar State
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number, y: number, initialX: number, initialY: number } | null>(null);

  useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
      if (mode === GameMode.EDIT) {
          setShowEditBanner(true);
          timer = setTimeout(() => {
              setShowEditBanner(false);
          }, 5000);
      } else {
          setShowEditBanner(false);
      }
      return () => clearTimeout(timer);
  }, [mode]);

  const mapStyles: { id: MapStyleId; label: string; icon: any }[] = [
      { id: 'osm', label: 'Standard', icon: MapIcon },
      { id: 'satellite', label: 'Satellite', icon: Globe },
      { id: 'dark', label: 'Dark Mode', icon: Moon },
      { id: 'light', label: 'Light Mode', icon: Sun },
  ];

  const visiblePlaygrounds = playgrounds?.filter(p => {
      if (mode === GameMode.PLAY && hiddenPlaygroundIds.includes(p.id)) return false;
      return p.buttonVisible;
  }) || [];

  const leftMenuPositionClass = (mode === GameMode.EDIT && isDrawerExpanded) ? 'sm:left-[340px]' : 'left-4';
  const searchBarPositionClass = (mode === GameMode.EDIT && isDrawerExpanded) ? 'sm:left-[calc(50%+160px)]' : 'sm:left-1/2 sm:-translate-x-1/2';

  const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          initialX: toolbarPos.x,
          initialY: toolbarPos.y
      };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setToolbarPos({
          x: dragStartRef.current.initialX + dx,
          y: dragStartRef.current.initialY + dy
      });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (dragStartRef.current) {
          (e.target as Element).releasePointerCapture(e.pointerId);
          dragStartRef.current = null;
      }
  };

  // Switch Mode Handler
  const handleSetMode = (m: GameMode) => {
      if (onSetMode) onSetMode(m);
      else toggleMode(); // Fallback
  };

  if (activeDangerZone && mode === GameMode.PLAY) {
      return (
          <div className="fixed inset-0 z-[9999] bg-red-600 animate-pulse flex flex-col items-center justify-center text-white p-8 text-center pointer-events-none">
              <div className="bg-black/80 backdrop-blur-xl p-10 rounded-[3rem] border-8 border-red-500 shadow-[0_0_100px_rgba(255,0,0,0.8)] max-w-lg w-full flex flex-col items-center">
                  <Siren className="w-24 h-24 text-red-500 mb-6 animate-bounce" />
                  <h1 className="text-5xl font-black uppercase tracking-widest mb-2 text-red-500 drop-shadow-lg">WARNING</h1>
                  <h2 className="text-2xl font-black uppercase tracking-widest mb-8">RESTRICTED AREA</h2>
                  
                  {activeDangerZone.timeRemaining > 0 ? (
                      <>
                          <p className="text-sm font-bold uppercase tracking-widest mb-4 text-gray-300">LEAVE IMMEDIATELY OR LOSE POINTS</p>
                          <div className="text-8xl font-black font-mono tabular-nums text-white animate-pulse">
                              {activeDangerZone.timeRemaining}
                          </div>
                          <p className="text-xs font-bold uppercase mt-2 text-red-400">SECONDS REMAINING</p>
                      </>
                  ) : (
                      <>
                          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                          <h3 className="text-3xl font-black text-white uppercase tracking-widest mb-2">DAMAGE TAKEN</h3>
                          <p className="text-xl font-bold text-red-400 uppercase">-500 POINTS</p>
                      </>
                  )}
              </div>
          </div>
      );
  }

  return (
    <>
      {/* TIMER */}
      {timerConfig && mode !== GameMode.EDIT && (
          <TimerDisplay config={timerConfig} startTime={gameStartedAt} />
      )}

      {showEditBanner && !isMeasuring && !isRelocating && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-orange-600/95 text-white px-6 py-3 rounded-full backdrop-blur-md z-[2000] animate-in fade-in slide-in-from-bottom-4 pointer-events-none shadow-xl border border-white/20 flex items-center gap-3 transition-opacity duration-500">
              <div className="bg-white/20 p-1.5 rounded-full animate-pulse"><Layers className="w-4 h-4 text-white" /></div>
              <span className="text-xs font-black uppercase tracking-widest">
                  EDIT MODE &bull; TAP MAP TO PLACE
              </span>
          </div>
      )}

      {isRelocating && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-green-600/95 text-white px-6 py-3 rounded-full backdrop-blur-md z-[2000] animate-in fade-in slide-in-from-bottom-4 pointer-events-none shadow-xl border border-white/20 flex items-center gap-3 transition-opacity duration-500">
              <div className="bg-white/20 p-1.5 rounded-full animate-pulse"><Move className="w-4 h-4 text-white" /></div>
              <span className="text-xs font-black uppercase tracking-widest">
                  RELOCATING &bull; DRAG MAP TO NEW CENTER
              </span>
          </div>
      )}

      {isMeasuring && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-pink-600/95 text-white px-6 py-3 rounded-full backdrop-blur-md z-[2000] animate-in fade-in slide-in-from-bottom-4 pointer-events-none shadow-xl border border-white/20 flex items-center gap-3 transition-opacity duration-500">
              <div className="bg-white/20 p-1.5 rounded-full animate-pulse"><Ruler className="w-4 h-4 text-white" /></div>
              <span className="text-xs font-black uppercase tracking-widest">
                  MEASURING: {formatDistance(measuredDistance || 0)}
              </span>
          </div>
      )}

      {/* PLAYGROUND BUTTONS */}
      {visiblePlaygrounds.length > 0 && (mode === GameMode.PLAY || mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex gap-4 pointer-events-auto items-end">
              {visiblePlaygrounds.map(pg => {
                  const iconId = pg.iconId || 'default';
                  const Icon = ICON_COMPONENTS[iconId];
                  const size = pg.buttonSize || 80;
                  const isTargeted = pg.id === targetPlaygroundId;

                  return (
                      <button
                          key={pg.id}
                          onClick={() => onOpenPlayground?.(pg.id)}
                          style={{ width: size, height: size }}
                          className={`rounded-3xl flex items-center justify-center transition-all border-4 group relative overflow-visible hover:scale-110 active:scale-95 ${
                              pg.iconUrl ? 'bg-white border-white' : 'bg-gradient-to-br from-orange-500 to-red-600 border-white/30'
                          } ${
                              isTargeted 
                                ? 'shadow-[0_0_20px_rgba(249,115,22,0.6)] ring-4 ring-orange-500 ring-offset-2 ring-offset-black scale-110' 
                                : (mode === GameMode.PLAY ? 'shadow-[0_0_30px_rgba(234,88,12,0.6)] animate-pulse hover:animate-none' : 'shadow-2xl')
                          }`}
                      >
                          {pg.iconUrl ? (
                              <img src={pg.iconUrl} className="w-full h-full object-cover rounded-[1.3rem]" alt={pg.title} />
                          ) : (
                              <Icon className="w-1/2 h-1/2 text-white" />
                          )}
                          
                          <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-opacity whitespace-nowrap pointer-events-none backdrop-blur-sm border border-white/10 ${mode === GameMode.EDIT ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              {pg.title}
                          </div>
                      </button>
                  );
              })}
          </div>
      )}

      {/* SEARCH BAR */}
      {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && onSearchLocation && (
          <div className={`absolute top-4 ${searchBarPositionClass} left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto transition-all duration-300 ease-in-out`}>
              <div className="hidden sm:block shadow-2xl">
                  <LocationSearch 
                      onSelectLocation={onSearchLocation} 
                      className="h-12" 
                      hideSearch={false}
                  />
              </div>
          </div>
      )}

      {/* TOP LEFT BUTTONS */}
      <div className={`absolute top-4 ${leftMenuPositionClass} z-[1000] pointer-events-auto h-12 flex items-center gap-2 transition-all duration-300 ease-in-out`}>
            {mode === GameMode.PLAY && onOpenTeamDashboard ? (
                <button
                    onClick={onOpenTeamDashboard}
                    className="h-12 pl-3 pr-4 bg-slate-900/95 dark:bg-gray-900/95 border-2 border-orange-500 rounded-2xl flex items-center justify-center gap-2.5 shadow-2xl hover:scale-105 active:scale-95 transition-all group hover:bg-slate-800"
                >
                    <Shield className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
                        TEAM ZONE
                    </span>
                </button>
            ) : (
                <div className="relative group">
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      title="Main Menu"
                      className={`h-12 w-12 flex items-center justify-center shadow-2xl rounded-2xl transition-all border border-white/10 hover:scale-105 active:scale-95 hover:border-white/30 ${isMenuOpen ? 'bg-white text-slate-900' : 'bg-slate-900/95 dark:bg-gray-800 text-white hover:bg-slate-800'}`}
                    >
                      {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            )}
            
            {/* Menu Dropdown */}
            {isMenuOpen && mode !== GameMode.PLAY && (
                <div className="absolute top-14 left-0 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 min-w-[240px] animate-in slide-in-from-top-2 fade-in duration-200 origin-top-left z-[3000]">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MENU</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <button onClick={() => { onBackToHub(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-left font-bold text-xs uppercase tracking-wide">
                            <Home className="w-4 h-4" /> HUB
                        </button>
                        <button onClick={() => { onOpenTeams(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-left font-bold text-xs uppercase tracking-wide">
                            <Users className="w-4 h-4" /> TEAMS
                        </button>
                        <button onClick={() => { onOpenGameManager(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-left font-bold text-xs uppercase tracking-wide">
                            <LayoutDashboard className="w-4 h-4" /> GAMES
                        </button>
                        <button onClick={() => { if(onOpenTeamDashboard) onOpenTeamDashboard(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-left font-bold text-xs uppercase tracking-wide">
                            <MessageSquare className="w-4 h-4" /> CHAT / STATUS
                        </button>
                        <button onClick={() => { onOpenTaskMaster(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-left font-bold text-xs uppercase tracking-wide">
                            <Library className="w-4 h-4" /> TASKS
                        </button>
                    </div>
                </div>
            )}
      </div>

      {/* FLOATING DRAGGABLE TOOLBAR */}
      <div 
        className="absolute top-4 right-4 z-[1000] pointer-events-auto"
        style={{ transform: `translate(${toolbarPos.x}px, ${toolbarPos.y}px)`, touchAction: 'none' }}
      >
        <div className="bg-slate-900/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-2 flex flex-col gap-2 min-w-[72px] items-center transition-shadow hover:shadow-orange-500/10">
            
            {/* Drag Handle */}
            <div 
                className="w-full flex justify-center py-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-white transition-colors border-b border-white/5 mb-1"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                title="Drag Toolbar"
            >
                <GripHorizontal className="w-5 h-5" />
            </div>

            {/* Permanent Mode Switcher (Reordered: Editor -> Instructor -> Play) */}
            <div className="flex flex-col items-center gap-1 w-full pb-2 border-b border-white/10">
                <div className="flex gap-1 bg-slate-800/80 p-1 rounded-xl">
                    <button 
                        onClick={() => handleSetMode(GameMode.EDIT)} 
                        className={`p-2 rounded-lg transition-all hover:scale-110 active:scale-95 ${mode === GameMode.EDIT ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        title="Editor Mode"
                    >
                        <Layers className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleSetMode(GameMode.INSTRUCTOR)} 
                        className={`p-2 rounded-lg transition-all hover:scale-110 active:scale-95 ${mode === GameMode.INSTRUCTOR ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        title="Instructor Mode"
                    >
                        <GraduationCap className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleSetMode(GameMode.PLAY)} 
                        className={`p-2 rounded-lg transition-all hover:scale-110 active:scale-95 ${mode === GameMode.PLAY ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        title="Team Mode"
                    >
                        <Shield className="w-4 h-4" />
                    </button>
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                    {mode === GameMode.PLAY ? 'TEAM ZONE' : mode === GameMode.EDIT ? 'EDITOR' : 'INSTRUCTOR'}
                </span>
            </div>

            {/* Global Actions */}
            <div className="flex gap-2 justify-center w-full">
                {onToggleChat && (
                    <button
                        onClick={onToggleChat}
                        title="Chat"
                        className={`w-10 h-10 flex items-center justify-center shadow-lg rounded-xl transition-all border border-white/10 hover:scale-110 active:scale-95 relative ${unreadMessagesCount > 0 ? 'bg-orange-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    >
                        <MessageSquare className="w-5 h-5" />
                        {unreadMessagesCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-slate-900">
                                {unreadMessagesCount}
                            </div>
                        )}
                    </button>
                )}
                {mode === GameMode.INSTRUCTOR && onOpenInstructorDashboard && (
                    <button 
                      onClick={onOpenInstructorDashboard} 
                      title="Dashboard"
                      className="w-10 h-10 bg-slate-800 text-amber-500 shadow-lg rounded-xl flex items-center justify-center transition-all border border-amber-500/50 hover:bg-amber-500 hover:text-white hover:scale-110 active:scale-95"
                    >
                        <LayoutDashboard className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* EDITOR CONTROLS */}
            {mode === GameMode.EDIT && (
                <>
                    {/* TASKS SECTION */}
                    <div className="w-full pt-2 border-t border-white/10 mt-1 flex flex-col items-center">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">TASKS</span>
                        <div className="grid grid-cols-2 gap-2">
                            {onAddDangerZone && (
                                <button
                                    onClick={onAddDangerZone}
                                    title="Add Danger Zone"
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all border border-white/5 hover:scale-110 active:scale-95"
                                >
                                    <Skull className="w-5 h-5" />
                                </button>
                            )}
                            {onToggleScores && (
                                <button 
                                    onClick={onToggleScores}
                                    title="Toggle Scores"
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-white/5 hover:scale-110 active:scale-95 ${showScores ? 'text-blue-400 bg-blue-900/30' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                >
                                    <Hash className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* SETTINGS SECTION (Moved from Drawer) */}
                    <div className="w-full pt-2 border-t border-white/10 mt-1 flex flex-col items-center">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">SETTINGS</span>
                        <div className="grid grid-cols-1 gap-2">
                            {onToggleShowOtherTeams && (
                                <button 
                                    onClick={onToggleShowOtherTeams}
                                    title="Show Teams to Teams"
                                    className={`w-full py-2 flex items-center justify-center gap-2 rounded-xl transition-all border border-white/5 hover:scale-105 active:scale-95 ${showOtherTeams ? 'text-green-400 bg-green-900/30' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                >
                                    {showOtherTeams ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                    <span className="text-[8px] font-black uppercase">VIS TEAMS</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ZOOM SECTION */}
                    <div className="w-full pt-2 border-t border-white/10 mt-1 flex flex-col items-center">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">ZOOM</span>
                        <div className="grid grid-cols-2 gap-2">
                            {onFitBounds && (
                                <button 
                                    onClick={onFitBounds}
                                    title="Fit Tasks"
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 hover:scale-110 active:scale-95"
                                >
                                    <Maximize className="w-5 h-5" />
                                </button>
                            )}
                            {onLocateMe && (
                                <button 
                                    onClick={onLocateMe}
                                    title="My Location"
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 hover:scale-110 active:scale-95"
                                >
                                    <Target className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* MAP SECTION (Includes Styles + Edit Tools) */}
                    <div className="w-full pt-2 border-t border-white/10 mt-1 flex flex-col items-center">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">MAP</span>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {mapStyles.map((style) => (
                                <button
                                    key={style.id}
                                    onClick={() => onSetMapStyle(style.id)}
                                    title={style.label}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-white/5 hover:scale-110 active:scale-95 ${mapStyle === style.id ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                >
                                    <style.icon className="w-5 h-5" />
                                </button>
                            ))}
                        </div>
                        
                        <div className="w-full h-px bg-white/5 mb-2"></div>

                        <div className="grid grid-cols-2 gap-2">
                            {onRelocateGame && (
                                <button
                                    onClick={onRelocateGame}
                                    title={isRelocating ? "Place Pins" : "Relocate"}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border hover:scale-110 active:scale-95 ${isRelocating ? 'bg-green-600 text-white border-green-500 animate-pulse' : 'bg-slate-800 text-blue-500 border-blue-500/30 hover:bg-blue-600 hover:text-white'}`}
                                >
                                    {isRelocating ? <MapPin className="w-5 h-5" /> : <Move className="w-5 h-5" />}
                                </button>
                            )}
                            {onToggleMeasure && !isRelocating && (
                                <button
                                    onClick={onToggleMeasure}
                                    title={isMeasuring ? "Stop" : "Measure"}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border hover:scale-110 active:scale-95 ${isMeasuring ? 'bg-pink-600 text-white border-pink-500' : 'bg-slate-800 text-pink-500 border-pink-500/30 hover:bg-pink-600 hover:text-white'}`}
                                >
                                    <Ruler className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
      </div>
    </>
  );
};

export default GameHUD;
