import React, { useState } from 'react';
import { GameMode, MapStyleId, Language } from '../types';
import { t } from '../utils/i18n';
import { Navigation, Target, Plus, ShieldCheck, Map as MapIcon, Layers, GraduationCap, Menu, FolderOpen, Play, Settings, X, Globe, Moon, Sun, LayoutTemplate, Gamepad2, Library } from 'lucide-react';

interface GameHUDProps {
  score: number;
  accuracy: number | null;
  mode: GameMode;
  nearestPointDistance: number | null;
  toggleMode: () => void;
  onOpenGameChooser: () => void;
  onOpenGameManager: () => void;
  onOpenTaskMaster: () => void;
  pointsCount: { total: number; completed: number };
  mapStyle: MapStyleId;
  onSetMapStyle: (style: MapStyleId) => void;
  language: Language;
}

const GameHUD: React.FC<GameHUDProps> = ({ 
  score, 
  accuracy, 
  mode, 
  nearestPointDistance, 
  toggleMode, 
  onOpenGameChooser,
  onOpenGameManager,
  onOpenTaskMaster,
  pointsCount,
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

  return (
    <>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 z-[400] pointer-events-none">
        <div className="flex justify-between items-start max-w-4xl mx-auto">
          {/* Score Card */}
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg rounded-2xl px-4 py-2 border border-gray-100 dark:border-gray-800 pointer-events-auto flex flex-col">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{t('score', language)}</span>
            <span className="text-2xl font-black text-orange-600 dark:text-orange-500">{score}</span>
          </div>

          {/* Progress Card */}
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg rounded-2xl px-4 py-2 border border-gray-100 dark:border-gray-800 pointer-events-auto flex flex-col items-end">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{t('progress', language)}</span>
            <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{pointsCount.completed} / {pointsCount.total}</span>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-6 left-0 right-0 px-4 z-[400] pointer-events-none">
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

          <div className="flex items-end justify-between gap-4 pointer-events-auto">
             
             {/* Game Menu Button with Popup */}
             <div className="relative">
                {isMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-2 min-w-[240px] animate-in slide-in-from-bottom-2 fade-in duration-200 origin-bottom-left">
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
                
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`shadow-xl rounded-full p-3 transition-all border border-gray-100 dark:border-gray-700 hover:scale-105 active:scale-95 ${isMenuOpen ? 'bg-gray-800 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
                  aria-label="Open Game Menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
             </div>

            {/* Nearest Point Indicator */}
            <div className="flex-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-xl rounded-2xl p-3 border border-gray-100 dark:border-gray-800 flex items-center justify-between min-h-[60px]">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">{t('nextTarget', language)}</span>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {nearestPointDistance !== null 
                    ? `${Math.round(nearestPointDistance)}m` 
                    : t('complete', language)}
                </span>
              </div>
              <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
            </div>

            {/* Mode Toggle Button */}
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
          </div>
        </div>
      </div>
    </>
  );
};

export default GameHUD;