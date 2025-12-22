import React from 'react';
import { X, Users, UserPlus, Shield, ChevronRight, Radar, Terminal } from 'lucide-react';

interface TeamsHubModalProps {
  onClose: () => void;
  onAction: (action: 'JOIN' | 'COMMAND') => void;
}

const TeamsHubModal: React.FC<TeamsHubModalProps> = ({ onClose, onAction }) => {
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,1)] relative">
        
        {/* Footprint Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center relative z-10 bg-[#0a0f1d]/80">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-500/20 shadow-[0_0_20px_rgba(234,88,12,0.1)]">
              <Radar className="w-8 h-8 text-orange-500 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">MISSION OPERATIONS</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">OPERATIVE MANAGEMENT HUB</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full text-gray-500 transition-colors">
            <X className="w-7 h-7" />
          </button>
        </div>

        {/* Content */}
        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          
          {/* JOIN MISSION (The Welcome Team flow) */}
          <button 
            onClick={() => onAction('JOIN')}
            className="group flex flex-col items-center text-center p-8 bg-slate-900/50 border border-slate-800 rounded-[2rem] hover:border-orange-500/50 hover:bg-slate-800/80 transition-all shadow-xl hover:-translate-y-1"
          >
            <div className="w-20 h-20 bg-orange-600/10 rounded-[2rem] flex items-center justify-center mb-6 border border-orange-500/20 group-hover:scale-110 transition-transform">
              <UserPlus className="w-10 h-10 text-orange-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">JOIN MISSION</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide leading-relaxed">
              Create a new team or join an existing mission lobby using a code.
            </p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform">
              ACCESS LOBBY <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* COMMAND CENTER (The Teams Modal / Instructor Lobby flow) */}
          <button 
            onClick={() => onAction('COMMAND')}
            className="group flex flex-col items-center text-center p-8 bg-slate-900/50 border border-slate-800 rounded-[2rem] hover:border-blue-500/50 hover:bg-slate-800/80 transition-all shadow-xl hover:-translate-y-1"
          >
            <div className="w-20 h-20 bg-blue-600/10 rounded-[2rem] flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Shield className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">COMMAND CENTER</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide leading-relaxed">
              Monitor active teams, manage operatives, and check mission progress.
            </p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform">
              VIEW MONITOR <ChevronRight className="w-4 h-4" />
            </div>
          </button>

        </div>

        {/* Footer info box */}
        <div className="p-8 bg-[#0a0f1d]/50 border-t border-white/5 flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 bg-slate-800/50 rounded-xl flex items-center justify-center border border-slate-700">
            <Terminal className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-tight">System Notice</p>
            <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wider mt-0.5 italic">
              Operatives must have active GPS permissions for accurate tracking.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TeamsHubModal;