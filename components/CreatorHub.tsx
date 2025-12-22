import React from 'react';
import { Users, Plus, Library, Map, Database, PlayCircle, Target, ChevronDown, ArrowLeft, LayoutDashboard } from 'lucide-react';

interface CreatorHubProps {
  activeGameName?: string;
  onAction: (action: 'PLAY' | 'CREATE' | 'EDIT' | 'TEAM' | 'TASKS' | 'ADMIN' | 'DASHBOARD') => void;
  onChooseGame: () => void;
  onBack: () => void;
  version: string;
}

const CreatorHub: React.FC<CreatorHubProps> = ({ activeGameName, onAction, onChooseGame, onBack, version }) => {
  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950 flex flex-col items-center justify-center p-6 font-sans uppercase animate-in fade-in duration-300">
      {/* Footprint Background Pattern */}
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />

      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 relative z-10">
          <button 
            onClick={onBack}
            className="absolute top-4 left-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all flex items-center gap-2 group"
          >
              <ArrowLeft className="w-4 h-4" />
          </button>

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
              {/* PRIMARY DASHBOARD ACCESS */}
              <button 
                onClick={() => onAction('DASHBOARD')}
                className="group relative h-20 bg-blue-600 hover:bg-blue-700 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl transition-transform hover:scale-[1.02] border-2 border-blue-400/50 mb-2"
              >
                  <div className="flex items-center gap-4">
                      <LayoutDashboard className="w-8 h-8 text-white drop-shadow-md group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                          <span className="block text-xl font-black text-white tracking-widest leading-none uppercase">Open Dashboard</span>
                          <span className="block text-[9px] font-bold text-blue-200 mt-1 uppercase">Central Management Workspace</span>
                      </div>
                  </div>
              </button>

              <button 
                onClick={() => onAction('PLAY')}
                className="group relative h-24 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl transition-transform hover:scale-[1.02] border-2 border-orange-500/50"
              >
                  <div className="flex items-center gap-4">
                      <PlayCircle className="w-10 h-10 text-white drop-shadow-md group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                          <span className="block text-2xl font-black text-white tracking-widest leading-none">PLAY GAME</span>
                          <span className="block text-[10px] font-bold text-orange-200 mt-1">ENTER LOBBY & JOIN TEAM</span>
                      </div>
                  </div>
              </button>

              <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => onAction('CREATE')} className="group relative h-32 bg-slate-800 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-[1.02]">
                      <Plus className="w-8 h-8 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white tracking-widest text-center leading-tight uppercase">CREATE<br/>NEW GAME</span>
                  </button>

                  <button onClick={() => onAction('EDIT')} className="group relative h-32 bg-slate-800 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-[1.02]">
                      <Map className="w-8 h-8 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white tracking-widest uppercase">EDIT</span>
                  </button>

                  <button onClick={() => onAction('TEAM')} className="group relative h-32 bg-slate-800 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-[1.02]">
                      <Users className="w-8 h-8 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white tracking-widest uppercase">TEAMS</span>
                  </button>

                  <button onClick={() => onAction('TASKS')} className="group relative h-32 bg-slate-800 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-[1.02]">
                      <Library className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white tracking-widest uppercase">TASKS</span>
                  </button>
              </div>

              <button 
                onClick={() => onAction('ADMIN')}
                className="w-full group relative h-12 bg-transparent border border-slate-700 rounded-xl flex flex-row items-center justify-center gap-3 overflow-hidden transition-all hover:bg-slate-800"
              >
                  <Database className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  <span className="text-xs font-black text-slate-500 group-hover:text-white tracking-widest uppercase">ADMIN PANEL</span>
              </button>
          </div>
      </div>
    </div>
  );
};

export default CreatorHub;