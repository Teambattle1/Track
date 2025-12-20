import React from 'react';
import { Gamepad2, Hammer, Wand2, Globe, Footprints } from 'lucide-react';

interface LandingPageProps {
  onPlay: () => void;
  onCreate: () => void;
  onEdit: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onPlay, onCreate, onEdit }) => {
  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950 text-white overflow-hidden flex flex-col font-sans uppercase">
      
      {/* Background Pattern - Footprints */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-8 transform -rotate-12 scale-110">
            {[...Array(48)].map((_, i) => (
                <div key={i} className="flex justify-center items-center text-slate-200">
                    <Footprints className={`w-20 h-20 transform ${i % 2 === 0 ? 'rotate-12 scale-x-100' : '-rotate-12 -scale-x-100'}`} />
                </div>
            ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950/80"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-8 text-center animate-in slide-in-from-top-10 duration-700 mt-8 flex flex-col items-center">
        <div className="inline-flex items-center justify-center p-5 bg-orange-600/10 rounded-full mb-6 border border-orange-500/50 backdrop-blur-md shadow-[0_0_30px_rgba(234,88,12,0.3)]">
            <Globe className="w-16 h-16 text-orange-500 animate-spin-slow" />
        </div>
        <h1 className="text-4xl md:text-7xl font-black tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-600 drop-shadow-xl leading-tight whitespace-nowrap">
          TEAM<span className="text-orange-600">ACTION</span>
        </h1>
        <p className="text-slate-400 mt-4 text-sm md:text-lg font-bold tracking-[0.3em] uppercase">
            by TEAMBATTLE
        </p>
      </div>

      {/* Main Content - Globe Buttons */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-center gap-8 p-6 perspective-1000">
        
        {/* BUTTON 1: CREATE (Blue/Earth) */}
        <div className="group flex flex-col items-center gap-4">
            <button 
                onClick={onCreate}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full relative transition-transform duration-500 hover:scale-110 shadow-2xl"
                style={{
                    background: 'radial-gradient(circle at 30% 30%, #3b82f6, #1e40af, #0f172a)',
                    boxShadow: '0 0 40px rgba(59, 130, 246, 0.4), inset 0 0 20px rgba(255,255,255,0.2)'
                }}
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <Wand2 className="w-12 h-12 text-blue-100 drop-shadow-md opacity-90 group-hover:scale-110 transition-transform" />
                </div>
                {/* Orbital Ring */}
                <div className="absolute inset-[-8px] rounded-full border border-blue-500/30 w-[calc(100%+16px)] h-[calc(100%+16px)] animate-[spin_10s_linear_infinite]" />
            </button>
            <div className="text-center">
                <h2 className="text-xl font-black text-white tracking-widest group-hover:text-blue-400 transition-colors">Create</h2>
                <p className="text-[10px] font-bold text-slate-500 tracking-widest mt-1">Design New Worlds</p>
            </div>
        </div>

        {/* BUTTON 2: PLAY (Orange/Mars) - CENTER STAGE */}
        <div className="group flex flex-col items-center gap-4 md:-mt-8">
            <button 
                onClick={onPlay}
                className="w-40 h-40 md:w-48 md:h-48 rounded-full relative transition-transform duration-500 hover:scale-110 shadow-2xl z-20"
                style={{
                    background: 'radial-gradient(circle at 30% 30%, #f97316, #c2410c, #431407)',
                    boxShadow: '0 0 60px rgba(234, 88, 12, 0.6), inset 0 0 30px rgba(255,255,255,0.3)'
                }}
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <Gamepad2 className="w-20 h-20 text-orange-100 drop-shadow-lg opacity-90 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
                </div>
                {/* Orbital Ring */}
                <div className="absolute inset-[-12px] rounded-full border-2 border-orange-500/50 w-[calc(100%+24px)] h-[calc(100%+24px)] animate-[spin_15s_linear_infinite_reverse]" />
            </button>
            <div className="text-center">
                <h2 className="text-3xl font-black text-white tracking-widest group-hover:text-orange-500 transition-colors">Play</h2>
                <p className="text-xs font-bold text-slate-400 tracking-widest mt-1">Join the Adventure</p>
            </div>
        </div>

        {/* BUTTON 3: EDIT (Silver/Moon) */}
        <div className="group flex flex-col items-center gap-4">
            <button 
                onClick={onEdit}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full relative transition-transform duration-500 hover:scale-110 shadow-2xl"
                style={{
                    background: 'radial-gradient(circle at 30% 30%, #e2e8f0, #94a3b8, #0f172a)',
                    boxShadow: '0 0 40px rgba(148, 163, 184, 0.4), inset 0 0 20px rgba(255,255,255,0.5)'
                }}
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <Hammer className="w-12 h-12 text-slate-800 drop-shadow-md opacity-90 group-hover:scale-110 transition-transform" />
                </div>
                {/* Orbital Ring */}
                <div className="absolute inset-[-8px] rounded-full border border-slate-500/30 w-[calc(100%+16px)] h-[calc(100%+16px)] animate-[spin_12s_linear_infinite]" />
            </button>
            <div className="text-center">
                <h2 className="text-xl font-black text-white tracking-widest group-hover:text-slate-300 transition-colors">Edit</h2>
                <p className="text-[10px] font-bold text-slate-500 tracking-widest mt-1">Manage Games</p>
            </div>
        </div>

      </div>

      {/* Footer */}
      <div className="relative z-10 p-6 text-center">
        <p className="text-[10px] text-slate-600 font-bold tracking-[0.2em]">
            Exploring the World • TeamBattle v2.0
        </p>
      </div>

    </div>
  );
};

export default LandingPage;