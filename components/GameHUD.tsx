import React, { useState } from 'react';
import { GameMode, MapStyleId, Language } from '../types';
import { t } from '../utils/i18n';
import { ShieldCheck, Map as MapIcon, Layers, GraduationCap, Menu, Settings, X, Globe, Moon, Sun, Gamepad2, Library, Plus, Users } from 'lucide-react';

interface GameHUDProps {
  accuracy: number | null;
  mode: GameMode;
  toggleMode: () => void;
  onOpenGameChooser: () => void;
  onOpenGameManager: () => void;
  onOpenTaskMaster: () => void;
  onOpenTeams: () => void;
  mapStyle: MapStyleId;
  onSetMapStyle: (style: MapStyleId) => void;
  language: Language;
}

const GameHUD: React.FC<GameHUDProps> = ({ 
  accuracy, 
  mode, 
  toggleMode, 
  onOpenGameChooser,
  onOpenGameManager,
  onOpenTaskMaster,
  onOpenTeams,
  mapStyle,
  onSetMapStyle,
  language
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const mapStyles: { id: MapStyleId; label: string; icon: any }[] = [
      { id: 'osm', label: 'Standard', icon: MapIcon },
      { id: 'satellite', label: 'Satellite', icon: Globe },
      { id: 'dark', label: 'Dark', icon: Moon },
      { id: 'light', label: 'Light', icon: Sun },
  ];

  const getModeLabel = () => {
      switch(mode) {
          case GameMode.EDIT: return 'Editor';
          case GameMode.INSTRUCTOR: return 'GM';
          default: return 'Team';
      }
  };

  return (
    <>
      {/* --- TOP LEFT: MENU --- */}
      <div className="absolute top-4 left-4 z-[500] flex flex-col items-center gap-1 pointer-events-auto">
         <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`shadow-xl rounded-full p-3 transition-all border border-gray-100 dark:border-gray-700 hover:scale-105 active:scale-95 ${isMenuOpen ? 'bg-gray-800 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
              aria-label="Open Game Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Menu Popup */}
            {isMenuOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-2 min-w-[240px] animate-in slide-in-from-top-2 fade-in duration-200 origin-top-left">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Menu</span>
                        <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex flex-col gap-1 mb-2">
                        <button 
                            onClick={() => { onOpenGameChooser(); setIsMenuOpen(false); }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/30 text-gray-700 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors text-left font-medium"
                        >
                            <div className="bg-orange-100 dark:bg-orange-900/50 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                                <Gamepad2 className="w-4 h-4 fill-current" />
                            </div>
                            PLAY
                        </button>
                        <button 
                            onClick={() => { onOpenTeams(); setIsMenuOpen(false); }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left font-medium"
                        >
                            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                                <Users className="w-4 h-4" />
                            </div>
                            TEAMS
                        </button>
                        <button 
                            onClick={() => { onOpenGameManager(); setIsMenuOpen(false); }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors text-left font-medium"
                        >
                            <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg text-gray-600 dark:text-gray-300">
                                <Settings className="w-4 h-4" />
                            </div>
                            GAMES
                        </button>
                        <button 
                            onClick={() => { onOpenTaskMaster(); setIsMenuOpen(false); }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/30 text-gray-700 dark:text-gray-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left font-medium"
                        >
                            <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-lg text-amber-600 dark:text-amber-400">
                                <Library className="w-4 h-4" />
                            </div>
                            TASKS
                        </button>
                    </div>

                    {/* Map Style Selector */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2 block">Map Style</span>
                        <div className="grid grid-cols-4 gap-1 px-1">
                            {mapStyles.map((style) => (
                                <button
                                    key={style.id}
                                    onClick={() => onSetMapStyle(style.id)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${mapStyle === style.id ? 'bg-gray-100 dark:bg-gray-700 text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                    title={style.label}
                                >
                                    <style.icon className="w-5 h-5 mb-1" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
         </div>
         <span className="text-[10px] font-black text-white drop-shadow-md uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded backdrop-blur-md">Menu</span>
      </div>

      {/* --- TOP RIGHT: MODE SELECTOR --- */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col items-center gap-1 pointer-events-auto">
        <button 
          onClick={toggleMode}
          className={`shadow-xl rounded-full p-3 transition-all border border-gray-100 dark:border-gray-700 hover:scale-105 active:scale-95 ${
            mode === GameMode.EDIT ? 'bg-orange-600 text-white' : 
            mode === GameMode.INSTRUCTOR ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
          }`}
          aria-label="Toggle Mode"
        >
          {mode === GameMode.EDIT ? <Layers className="w-6 h-6" /> : 
           mode === GameMode.INSTRUCTOR ? <GraduationCap className="w-6 h-6" /> : 
           <MapIcon className="w-6 h-6" />}
        </button>
        <span className="text-[10px] font-black text-white drop-shadow-md uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded backdrop-blur-md">
            {getModeLabel()}
        </span>
      </div>

      {/* --- BOTTOM: ALERTS & INFO --- */}
      <div className="absolute bottom-24 left-0 right-0 px-4 z-[400] pointer-events-none">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          
          {/* Accuracy Warning */}
          {accuracy && accuracy > 30 && (
            <div className="bg-orange-100/90 dark:bg-orange-900/80 backdrop-blur-md border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200 px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 pointer-events-auto">
              <ShieldCheck className="w-4 h-4" />
              <span>Low GPS Accuracy ({Math.round(accuracy)}m)</span>
            </div>
          )}

          {/* Mode Info Banners */}
           {mode === GameMode.EDIT && (
            <div className="bg-orange-600/90 dark:bg-orange-600/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between pointer-events-auto animate-bounce-subtle">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <span className="font-medium">Tap map to place tasks</span>
              </div>
              <button 
                onClick={toggleMode}
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold uppercase transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {mode === GameMode.INSTRUCTOR && (
            <div className="bg-amber-600/90 dark:bg-amber-900/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                <span className="font-medium">Instructor Mode</span>
              </div>
              <div className="text-xs opacity-90">Drag to move • Tap to check</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GameHUD;