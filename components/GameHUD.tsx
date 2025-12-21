
import React, { useState, useEffect } from 'react';
import { GameMode, MapStyleId, Language, Playground } from '../types';
import { Map as MapIcon, Layers, GraduationCap, Menu, X, Globe, Moon, Sun, Library, Users, Home, LayoutDashboard, Ruler, Gamepad2, Shield } from 'lucide-react';

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
  playgrounds?: Playground[];
  onOpenPlayground?: (id: string) => void;
  onOpenTeamDashboard?: () => void;
}

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
  playgrounds,
  onOpenPlayground,
  onOpenTeamDashboard
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showEditBanner, setShowEditBanner] = useState(false);

  useEffect(() => {
      // Persistent banner for Edit mode
      setShowEditBanner(mode === GameMode.EDIT);
  }, [mode]);

  const mapStyles: { id: MapStyleId; label: string; icon: any }[] = [
      { id: 'osm', label: 'Standard', icon: MapIcon },
      { id: 'satellite', label: 'Satellite', icon: Globe },
      { id: 'dark', label: 'Dark Mode', icon: Moon },
      { id: 'light', label: 'Light Mode', icon: Sun },
  ];

  // Find active visible playgrounds
  const visiblePlaygrounds = playgrounds?.filter(p => p.buttonVisible) || [];

  return (
    <>
      {showEditBanner && !isMeasuring && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-orange-600/95 text-white px-6 py-3 rounded-full backdrop-blur-md z-[2000] animate-in fade-in slide-in-from-top-4 pointer-events-none shadow-xl border border-white/20 flex items-center gap-3">
              <div className="bg-white/20 p-1.5 rounded-full animate-pulse"><Layers className="w-4 h-4 text-white" /></div>
              <span className="text-xs font-black uppercase tracking-widest">
                  EDIT MODE &bull; TAP MAP TO PLACE
              </span>
          </div>
      )}

      {/* PLAYGROUND BUTTONS (Bottom Center - Active in Play, Edit & Instructor) */}
      {visiblePlaygrounds.length > 0 && (mode === GameMode.PLAY || mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex gap-4 pointer-events-auto items-end">
              {visiblePlaygrounds.map(pg => (
                  <button
                      key={pg.id}
                      onClick={() => onOpenPlayground?.(pg.id)}
                      className={`h-20 w-20 rounded-3xl flex items-center justify-center transition-all border-4 group relative overflow-hidden ${
                          pg.iconUrl ? 'bg-white border-white' : 'bg-gradient-to-br from-purple-600 to-indigo-600 border-white/30'
                      } ${mode === GameMode.PLAY ? 'shadow-[0_0_30px_rgba(147,51,234,0.6)] animate-pulse hover:animate-none hover:scale-110' : 'shadow-2xl hover:scale-105'}`}
                  >
                      {pg.iconUrl ? (
                          <img src={pg.iconUrl} className="w-full h-full object-cover" alt={pg.title} />
                      ) : (
                          <Gamepad2 className="w-10 h-10 text-white" />
                      )}
                      
                      {/* Label on Hover / Always in Edit Mode */}
                      <div className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-opacity whitespace-nowrap pointer-events-none backdrop-blur-sm border border-white/10 ${mode === GameMode.EDIT ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {pg.title}
                      </div>
                  </button>
              ))}
          </div>
      )}

      {/* NEW: Team Dashboard Button (Bottom Left) */}
      {mode === GameMode.PLAY && onOpenTeamDashboard && (
          <div className="absolute bottom-6 left-4 z-[1000] pointer-events-auto">
              <button 
                  onClick={onOpenTeamDashboard}
                  className="w-16 h-16 bg-slate-900 border-2 border-orange-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all group"
              >
                  <Shield className="w-8 h-8 text-white group-hover:text-orange-500 transition-colors" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full animate-ping" />
                  <div className="absolute top-full mt-2 bg-black/80 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      Team Zone
                  </div>
              </button>
          </div>
      )}

      <div className="absolute top-4 left-4 z-[1000] pointer-events-auto h-12 flex items-center">
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
            
            {isMenuOpen && (
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
                        <button onClick={() => { onOpenTaskMaster(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-amber-500/10 text-slate-300 hover:text-amber-400 transition-colors text-left font-bold text-xs uppercase tracking-wide border-b border-white/5 mb-1" title="Task Library">
                            <Library className="w-4 h-4" /> TASKS
                        </button>
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
                    </div>
                </div>
            )}
      </div>

      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 h-12 pointer-events-auto">
        {mode === GameMode.EDIT && onToggleMeasure && (
            <button
                onClick={onToggleMeasure}
                title={isMeasuring ? "Stop Measuring" : "Measure Distance"}
                className={`w-12 h-12 shadow-2xl rounded-2xl flex items-center justify-center transition-all border group relative ${isMeasuring ? 'bg-pink-600 text-white border-pink-500' : 'bg-slate-900/95 dark:bg-gray-800 text-pink-500 border-pink-500/50 hover:bg-pink-600 hover:text-white'}`}
            >
                <Ruler className="w-6 h-6" />
                <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap">Measure</div>
            </button>
        )}

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
        <button 
          onClick={toggleMode} 
          title={mode === GameMode.PLAY ? "Enter Edit Mode" : mode === GameMode.EDIT ? "Enter Instructor Mode" : "Return to Play Mode"}
          className={`h-12 w-12 flex items-center justify-center shadow-2xl rounded-2xl transition-all border border-white/10 hover:scale-105 active:scale-95 group relative ${mode === GameMode.EDIT ? 'bg-orange-600 text-white' : mode === GameMode.INSTRUCTOR ? 'bg-amber-50 text-amber-600' : 'bg-slate-900/95 dark:bg-gray-800 text-white'}`}
        >
          {mode === GameMode.EDIT ? <Layers className="w-6 h-6" /> : mode === GameMode.INSTRUCTOR ? <GraduationCap className="w-6 h-6" /> : <MapIcon className="w-6 h-6" />}
          <div className="absolute top-full right-0 mt-2 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap z-[2000]">
              {mode === GameMode.PLAY ? 'MODE: PLAY' : mode === GameMode.EDIT ? 'MODE: EDIT' : 'MODE: INST'}
          </div>
        </button>
      </div>
    </>
  );
};

export default GameHUD;
