
import React, { useState, useEffect } from 'react';
import { GameMode, MapStyleId, Language, Playground, TimerConfig, Coordinate } from '../types';
import { Map as MapIcon, Layers, GraduationCap, Menu, X, Globe, Moon, Sun, Library, Users, Home, LayoutDashboard, Ruler, Gamepad2, Shield, Clock, Move, MapPin, Maximize, Target, Hash, MessageSquare } from 'lucide-react';
import { formatDistance } from '../utils/geo';
import LocationSearch from './LocationSearch';
import { ICON_COMPONENTS } from '../utils/icons';

interface GameHUDProps {
  accuracy: number | null;
  mode: GameMode;
  toggleMode: () => void;
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
  onSearchLocation?: (coord: Coordinate) => void; // New Prop
  isDrawerExpanded?: boolean; // New prop to handle drawer shift
  showScores?: boolean;
  onToggleScores?: () => void;
  hiddenPlaygroundIds?: string[]; // New: List of hidden playgrounds
  onToggleChat?: () => void; // New: Chat Toggle
  unreadMessagesCount?: number; // New: Unread count
  targetPlaygroundId?: string; // New: ID of playground activated by currently selected point
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
                // Count up from start time (default to now if undefined for preview)
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

            // Formatting
            if (seconds < 0) {
                if (config.mode === 'countup') seconds = Math.abs(seconds); // Should ideally be positive
                else seconds = 0; // Timer finished
            }

            // Colors
            if (config.mode !== 'countup' && seconds < 300) setStatusColor("text-red-500 animate-pulse"); // Last 5 mins
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
  targetPlaygroundId // Recieving logic target
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEditBanner, setShowEditBanner] = useState(false);

  useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
      if (mode === GameMode.EDIT) {
          setShowEditBanner(true);
          // Auto-hide after 5 seconds
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

  // Find active visible playgrounds, filtering out those that should be hidden
  const visiblePlaygrounds = playgrounds?.filter(p => {
      // In Editor, always show (unless hiddenPlaygroundIds logic is strictly runtime). 
      // User requested "hide playground in teamview until activated". 
      // If mode is PLAY, and it's in hidden list, hide it.
      if (mode === GameMode.PLAY && hiddenPlaygroundIds.includes(p.id)) return false;
      return p.buttonVisible;
  }) || [];

  // Determine shifted positions for drawer interaction
  const leftMenuPositionClass = (mode === GameMode.EDIT && isDrawerExpanded) ? 'sm:left-[340px]' : 'left-4';
  // Shift search bar center if drawer is open on desktop
  const searchBarPositionClass = (mode === GameMode.EDIT && isDrawerExpanded) ? 'sm:left-[calc(50%+160px)]' : 'sm:left-1/2 sm:-translate-x-1/2';

  return (
    <>
      {/* TIMER DISPLAY - Shows in all modes except Edit */}
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
                  // If this playground is targeted by the current selection logic, glow heavily
                  const isTargeted = pg.id === targetPlaygroundId;

                  return (
                      <button
                          key={pg.id}
                          onClick={() => onOpenPlayground?.(pg.id)}
                          style={{ width: size, height: size }}
                          className={`rounded-3xl flex items-center justify-center transition-all border-4 group relative overflow-visible ${
                              pg.iconUrl ? 'bg-white border-white' : 'bg-gradient-to-br from-orange-500 to-red-600 border-white/30'
                          } ${
                              isTargeted 
                                ? 'shadow-[0_0_20px_rgba(249,115,22,0.6)] ring-4 ring-orange-500 ring-offset-2 ring-offset-black scale-110' 
                                : (mode === GameMode.PLAY ? 'shadow-[0_0_30px_rgba(234,88,12,0.6)] animate-pulse hover:animate-none hover:scale-110' : 'shadow-2xl hover:scale-105')
                          }`}
                      >
                          {pg.iconUrl ? (
                              <img src={pg.iconUrl} className="w-full h-full object-cover rounded-[1.3rem]" alt={pg.title} />
                          ) : (
                              <Icon className="w-1/2 h-1/2 text-white" />
                          )}
                          
                          {/* Label Logic: Show in Editor, OR show on Hover in Play Mode */}
                          <div className={`absolute -bottom-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-opacity whitespace-nowrap pointer-events-none backdrop-blur-sm border border-white/10 ${mode === GameMode.EDIT ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              {pg.title}
                          </div>
                      </button>
                  );
              })}
          </div>
      )}

      {/* TOP CENTER SEARCH BAR */}
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

      {/* TOP LEFT CORNER (Buttons) */}
      <div className={`absolute top-4 ${leftMenuPositionClass} z-[1000] pointer-events-auto h-12 flex items-center gap-2 transition-all duration-300 ease-in-out`}>
            {mode === GameMode.PLAY && onOpenTeamDashboard ? (
                // TEAM ZONE BUTTON (Play Mode)
                <button
                    onClick={onOpenTeamDashboard}
                    className="h-12 pl-3 pr-4 bg-slate-900/95 dark:bg-gray-900/95 border-2 border-orange-500 rounded-2xl flex items-center justify-center gap-2.5 shadow-2xl hover:scale-105 active:scale-95 transition-all group"
                >
                    <Shield className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
                        TEAM ZONE
                    </span>
                </button>
            ) : (
                // MENU BUTTON (Edit/Instructor Mode)
                <div className="relative group">
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      title="Main Menu"
                      className={`h-12 w-12 flex items-center justify-center shadow-2xl rounded-2xl transition-all border border-white/10 hover:scale-105 active:scale-95 ${isMenuOpen ? 'bg-white text-slate-900' : 'bg-slate-900/95 dark:bg-gray-800 text-white'}`}
                    >
                      <Menu className="w-6 h-6" />
                    </button>
                    <div className="absolute top-full left-0 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap z-[1100]">
                        Menu
                    </div>
                </div>
            )}

            {/* HOME BUTTON (Edit Mode Only) */}
            {mode === GameMode.EDIT && (
                <button 
                    onClick={onBackToHub}
                    title="Back to Hub"
                    className="h-12 w-12 flex items-center justify-center shadow-2xl rounded-2xl transition-all border border-white/10 hover:scale-105 active:scale-95 bg-slate-900/95 dark:bg-gray-800 text-white"
                >
                    <Home className="w-6 h-6" />
                </button>
            )}
            
            {/* Menu Dropdown */}
            {isMenuOpen && mode !== GameMode.PLAY && (
                <div className="absolute top-full left-0 mt-2 bg-slate-950 border border-white/10 rounded-2xl shadow-2xl p-2 min-w-[240px] animate-in slide-in-from-top-2 fade-in duration-200 origin-top-left z-[3000]">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Menu</span>
                        <button onClick={() => setIsMenuOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-col gap-1 mb-2">
                        <button onClick={() => { onBackToHub(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-left font-bold text-xs uppercase tracking-wide border-b border-white/5 mb-1" title="Back to Hub">
                            <Home className="w-4 h-4" /> HUB
                        </button>
                        <button onClick={() => { onOpenTeams(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-500/10 text-slate-300 hover:text-blue-400 transition-colors text-left font-bold text-xs uppercase tracking-wide" title="View Teams">
                            <Users className="w-4 h-4" /> TEAMS
                        </button>
                        <button onClick={() => { onOpenGameManager(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-left font-bold text-xs uppercase tracking-wide" title="Manage Games">
                            <LayoutDashboard className="w-4 h-4" /> GAMES
                        </button>
                        <button onClick={() => { if(onOpenTeamDashboard) onOpenTeamDashboard(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-left font-bold text-xs uppercase tracking-wide" title="Chat & Status">
                            <MessageSquare className="w-4 h-4" /> CHAT / STATUS
                        </button>
                        <button onClick={() => { onOpenTaskMaster(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-amber-500/10 text-slate-300 hover:text-amber-400 transition-colors text-left font-bold text-xs uppercase tracking-wide border-b border-white/5 mb-1" title="Task Library">
                            <Library className="w-4 h-4" /> TASKS
                        </button>
                        
                        {mode !== GameMode.EDIT && (
                            <div className="p-2 bg-slate-900/50 rounded-xl mt-1">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2 px-1">Map Style</span>
                                <div className="grid grid-cols-2 gap-1">
                                    {mapStyles.map((style) => (
                                        <button
                                            key={style.id}
                                            onClick={() => { onSetMapStyle(style.id); setIsMenuOpen(false); }}
                                            title={`Switch to ${style.label}`}
                                            className={`flex items-center gap-1.5 p-2 rounded-lg text-[9px] font-black uppercase transition-all border ${mapStyle === style.id ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'}`}
                                        >
                                            <style.icon className="w-3 h-3" /> {style.id}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
      </div>

      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 h-12 pointer-events-auto">
        
        {/* EDIT MODE CONTROLS */}
        {mode === GameMode.EDIT && (
            <>
                {/* View Controls Group */}
                <div className="flex bg-slate-900/95 dark:bg-gray-800 rounded-2xl border border-white/10 p-1 mr-2 shadow-2xl h-12 items-center">
                    {onFitBounds && (
                        <button 
                            onClick={onFitBounds}
                            title="Fit Tasks to Screen"
                            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <Maximize className="w-5 h-5" />
                        </button>
                    )}
                    {onLocateMe && (
                        <button 
                            onClick={onLocateMe}
                            title="My Position"
                            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <Target className="w-5 h-5" />
                        </button>
                    )}
                    {onToggleScores && (
                        <button 
                            onClick={onToggleScores}
                            title="Toggle Score Badges"
                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${showScores ? 'text-blue-400 bg-blue-900/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        >
                            <Hash className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Map Styles */}
                <div className="flex bg-slate-900/95 dark:bg-gray-800 rounded-2xl border border-white/10 p-1 mr-2 shadow-2xl h-12 items-center">
                    {mapStyles.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => onSetMapStyle(style.id)}
                            title={style.label}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${mapStyle === style.id ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        >
                            <style.icon className="w-5 h-5" />
                        </button>
                    ))}
                </div>

                {/* Relocate Button */}
                {onRelocateGame && (
                    <button
                        onClick={onRelocateGame}
                        title={isRelocating ? "Place Pins Here" : "Relocate All Tasks"}
                        className={`w-12 h-12 shadow-2xl rounded-2xl flex items-center justify-center transition-all border group relative ${
                            isRelocating 
                            ? 'bg-green-600 text-white border-green-500 animate-pulse hover:bg-green-700' 
                            : 'bg-slate-900/95 dark:bg-gray-800 text-blue-500 border-blue-500/50 hover:bg-blue-600 hover:text-white'
                        }`}
                    >
                        {isRelocating ? <MapPin className="w-6 h-6" /> : <Move className="w-6 h-6" />}
                        <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap">
                            {isRelocating ? "PASTE PINS" : "RELOCATE ALL"}
                        </div>
                    </button>
                )}

                {/* Measure Button */}
                {onToggleMeasure && !isRelocating && (
                    <button
                        onClick={onToggleMeasure}
                        title={isMeasuring ? "Stop Measuring" : "Measure Distance"}
                        className={`w-12 h-12 shadow-2xl rounded-2xl flex items-center justify-center transition-all border group relative ${isMeasuring ? 'bg-pink-600 text-white border-pink-500' : 'bg-slate-900/95 dark:bg-gray-800 text-pink-500 border-pink-500/50 hover:bg-pink-600 hover:text-white'}`}
                    >
                        <Ruler className="w-6 h-6" />
                        <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap">Measure</div>
                    </button>
                )}
            </>
        )}

        {/* Global Chat Button (Available in all modes) */}
        {onToggleChat && (
            <button
                onClick={onToggleChat}
                title="Open Chat"
                className={`w-12 h-12 shadow-2xl rounded-2xl flex items-center justify-center transition-all border group relative mr-2 ${
                    unreadMessagesCount > 0 
                    ? 'bg-orange-600 border-orange-500 animate-pulse text-white shadow-[0_0_20px_rgba(234,88,12,0.6)]' 
                    : 'bg-slate-900/95 dark:bg-gray-800 border-white/10 text-white hover:border-white/30'
                }`}
            >
                <MessageSquare className="w-6 h-6" />
                {unreadMessagesCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-slate-900">
                        {unreadMessagesCount}
                    </div>
                )}
                <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap">CHAT</div>
            </button>
        )}

        {/* Instructor Dashboard Button */}
        {mode === GameMode.INSTRUCTOR && onOpenInstructorDashboard && (
            <button 
              onClick={onOpenInstructorDashboard} 
              title="Instructor Dashboard"
              className="w-12 h-12 bg-slate-900/95 dark:bg-gray-800 text-amber-500 shadow-2xl rounded-2xl flex items-center justify-center transition-all border border-amber-500/50 hover:bg-amber-500 hover:text-white hover:scale-105 active:scale-95 group relative"
            >
                <LayoutDashboard className="w-6 h-6" />
                <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap">Dashboard</div>
            </button>
        )}
        
        {/* Mode Toggle Button */}
        <button 
          onClick={toggleMode} 
          title={mode === GameMode.PLAY ? "Enter Edit Mode" : mode === GameMode.EDIT ? "Enter Instructor Mode" : "Return to Play Mode"}
          className={`h-12 w-12 items-center justify-center shadow-2xl rounded-2xl transition-all border border-white/10 hover:scale-105 active:scale-95 group relative ${mode === GameMode.PLAY ? 'hidden md:flex' : 'flex'} ${mode === GameMode.EDIT ? 'bg-orange-600 text-white' : mode === GameMode.INSTRUCTOR ? 'bg-amber-50 text-amber-600' : 'bg-slate-900/95 dark:bg-gray-800 text-white'}`}
        >
          {mode === GameMode.EDIT ? <Layers className="w-6 h-6" /> : mode === GameMode.INSTRUCTOR ? <GraduationCap className="w-6 h-6" /> : <MapIcon className="w-6 h-6" />}
          <div className="absolute top-full right-0 mt-2 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap z-[2000] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {mode === GameMode.PLAY ? 'MODE: PLAY' : mode === GameMode.EDIT ? 'MODE: EDIT' : 'MODE: INST'}
          </div>
        </button>
      </div>
    </>
  );
};

export default GameHUD;
