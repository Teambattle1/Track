
import React from 'react';
import { Users, Plus, Library, Map, Database, PlayCircle, Target, ChevronDown } from 'lucide-react';

interface LandingPageProps {
  activeGameName?: string;
  onAction: (action: 'PLAY' | 'CREATE' | 'EDIT' | 'TEAM' | 'TASKS' | 'ADMIN') => void;
  onChooseGame: () => void;
  onHome: () => void;
  version: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ activeGameName, onAction, onChooseGame, version }) => {
  return (
    <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 font-sans uppercase animate-in fade-in duration-300">
      
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 relative">
          
          <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-white tracking-[0.2em] mb-1 leading-none">CREATOR HUB</h1>
              <div className="flex flex-col gap-0.5 mb-4">
                  <p className="text-[10px] text-slate-500 font-bold tracking-[0.3em]">TEAMBATTLE</p>
                  <p className="text-[9px] text-orange-500/80 font-black tracking-widest">v. {version}</p>
              </div>
              
              {activeGameName ? (
                  <button 
                    onClick={onChooseGame}
                    className="group inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 border border-orange-500/50 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg animate-in zoom-in-95 duration-500"
                  >
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="text-[10px] font-black text-white tracking-widest truncate max-w-[200px]">
                          ACTIVE: {activeGameName}
                      </span>
                      <ChevronDown className="w-3 h-3 text-white/50 group-hover:text-white transition-colors" />
                  </button>
              ) : (
                  <button 
                    onClick={onChooseGame}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all hover:scale-105 active:scale-95 text-slate-400 hover:text-white group"
                  >
                      <Target className="w-4 h-4 group-hover:text-orange-500 transition-colors" />
                      <span className="text-[10px] font-black tracking-widest">SELECT A GAME TO START</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
              )}
          </div>

          <div className="flex flex-col gap-4">
              {/* PLAY BUTTON */}
              <button 
                onClick={() => onAction('PLAY')}
                className="group relative h-24 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl transition-transform hover:scale-[1.02] border-2 border-orange-500/50"
              >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
                  <div className="flex items-center gap-4 relative z-10">
                      <PlayCircle className="w-10 h-10 text-white drop-shadow-md group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                          <span className="block text-2xl font-black text-white tracking-widest leading-none">PLAY GAME</span>
                          <span className="block text-[10px] font-bold text-orange-200 mt-1">ENTER LOBBY & JOIN TEAM</span>
                      </div>
                  </div>
              </button>

              <div className="grid grid-cols-2 gap-4">
                  {/* CREATE NEW GAME BUTTON */}
                  <button 
                    onClick={() => onAction('CREATE')}
                    className="group relative h-32 bg-slate-800 rounded-2xl flex flex-col items-center justify-center overflow-hidden shadow-lg transition-transform hover:scale-[1.02] hover:bg-slate-750"
                  >
                      <div className="absolute inset-0 bg-green-500/10 group-hover:bg-green-500/20 transition-colors" />
                      <Plus className="w-8 h-8 text-green-400 mb-2 drop-shadow-md group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white tracking-widest relative z-10 text-center px-2 leading-tight">CREATE<br/>NEW GAME</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 group-hover:text-white">START FROM SCRATCH</span>
                  </button>

                  {/* EDIT BUTTON */}
                  <button 
                    onClick={() => onAction('EDIT')}
                    className="group relative h-32 bg-slate-800 rounded-2xl flex flex-col items-center justify-center overflow-hidden shadow-lg transition-transform hover:scale-[1.02] hover:bg-slate-750"
                  >
                      <div className="absolute inset-0 bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors" />
                      <Map className="w-8 h-8 text-blue-400 mb-2 drop-shadow-md group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white tracking-widest relative z-10">EDIT</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 group-hover:text-white">MAP & TASKS</span>
                  </button>

                  {/* TEAM BUTTON */}
                  <button 
                    onClick={() => onAction('TEAM')}
                    className="group relative h-32 bg-slate-800 rounded-2xl flex flex-col items-center justify-center overflow-hidden shadow-lg transition-transform hover:scale-[1.02] hover:bg-slate-750"
                  >
                      <div className="absolute inset-0 bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors" />
                      <Users className="w-8 h-8 text-amber-400 mb-2 drop-shadow-md group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white tracking-widest relative z-10">TEAMS</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 group-hover:text-white">VIEW ACTIVE</span>
                  </button>

                  {/* TASKS BUTTON */}
                  <button 
                    onClick={() => onAction('TASKS')}
                    className="group relative h-32 bg-slate-800 rounded-2xl flex flex-col items-center justify-center overflow-hidden shadow-lg transition-transform hover:scale-[1.02] hover:bg-slate-750"
                  >
                      <div className="absolute inset-0 bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors" />
                      <Library className="w-8 h-8 text-purple-400 mb-2 drop-shadow-md group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white tracking-widest relative z-10">TASKS</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 group-hover:text-white">LIBRARY</span>
                  </button>
              </div>

              {/* ADMIN BUTTON */}
              <button 
                onClick={() => onAction('ADMIN')}
                className="w-full group relative h-12 bg-transparent border border-slate-700 rounded-xl flex flex-row items-center justify-center gap-3 overflow-hidden transition-all hover:bg-slate-800 hover:border-slate-600"
              >
                  <Database className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  <span className="text-xs font-black text-slate-500 group-hover:text-white tracking-widest uppercase">ADMIN / MANAGE GAMES</span>
              </button>
          </div>
      </div>
    </div>
  );
};

export default LandingPage;
