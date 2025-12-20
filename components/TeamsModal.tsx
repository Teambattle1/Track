import React, { useEffect, useState, useMemo } from 'react';
import { Team, Game } from '../types';
import * as db from '../services/db';
import { X, Users, RefreshCw, Hash, ChevronRight, Calendar, Clock, CheckCircle } from 'lucide-react';

interface TeamsModalProps {
  gameId: string | null;
  games: Game[];
  onSelectGame: (id: string) => void;
  onClose: () => void;
}

// Helper to generate deterministic 6-digit code from team name (matches WelcomeScreen logic)
const getJoinCode = (name: string): string => {
    if (!name) return '000000';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const code = Math.abs(hash) % 900000 + 100000;
    return code.toString();
};

const TeamsModal: React.FC<TeamsModalProps> = ({ gameId, games, onSelectGame, onClose }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'TODAY' | 'PLANNED' | 'COMPLETED'>('TODAY');

  const loadTeams = async () => {
    if (!gameId) return;
    setLoading(true);
    try {
        const data = await db.fetchTeams(gameId);
        setTeams(data);
    } catch (e) {
        console.error("Failed to load teams", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (gameId) {
        loadTeams();
    } else {
        setTeams([]);
    }
  }, [gameId]);

  // Helper for dates
  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const filteredGames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return games.filter(g => {
        const gDate = new Date(g.createdAt);
        gDate.setHours(0, 0, 0, 0);
        
        const isCompleted = g.points.length > 0 && g.points.every(p => p.isCompleted);
        
        if (tab === 'COMPLETED') return isCompleted;
        if (isCompleted) return false; // Don't show completed in Today/Planned

        if (tab === 'TODAY') return isSameDay(gDate, today);
        if (tab === 'PLANNED') return !isSameDay(gDate, today); // Anything not today and not completed
        
        return true;
    }).sort((a, b) => b.createdAt - a.createdAt); // Newest first
  }, [games, tab]);

  // If no game selected, show game picker
  if (!gameId) {
      return (
        <div className="fixed inset-0 z-[1500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500"/> Select Game
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* TABS */}
                <div className="flex border-b border-slate-800 bg-slate-900">
                    <button 
                        onClick={() => setTab('TODAY')}
                        className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors ${tab === 'TODAY' ? 'text-orange-500 border-b-2 border-orange-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                    >
                        <Clock className="w-3 h-3" /> Today
                    </button>
                    <button 
                        onClick={() => setTab('PLANNED')}
                        className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors ${tab === 'PLANNED' ? 'text-amber-500 border-b-2 border-amber-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                    >
                        <Calendar className="w-3 h-3" /> Planned
                    </button>
                    <button 
                        onClick={() => setTab('COMPLETED')}
                        className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors ${tab === 'COMPLETED' ? 'text-green-500 border-b-2 border-green-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                    >
                        <CheckCircle className="w-3 h-3" /> Done
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-900">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        {filteredGames.length} {tab.toLowerCase()} Games
                    </p>
                    
                    {filteredGames.length === 0 && (
                        <div className="text-center py-10 opacity-50">
                            <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                            <p className="text-slate-500">No games found.</p>
                        </div>
                    )}

                    {filteredGames.map(game => (
                        <button 
                            key={game.id} 
                            onClick={() => onSelectGame(game.id)}
                            className="w-full bg-slate-800 hover:bg-slate-700 p-4 rounded-xl border border-slate-700 flex items-center justify-between group transition-all"
                        >
                            <div className="text-left">
                                <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">{game.name}</h3>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(game.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
      );
  }

  const selectedGame = games.find(g => g.id === gameId);

  return (
    <div className="fixed inset-0 z-[1500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 w-full max-w-md max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <div className="flex flex-col">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500"/> Teams Joined
                    </h2>
                    {selectedGame && <span className="text-xs text-slate-500 ml-7">{selectedGame.name}</span>}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={loadTeams} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>
            
            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900">
                {teams.length === 0 && !loading && (
                    <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Users className="w-8 h-8 opacity-20" />
                        </div>
                        <p className="font-bold">No teams yet</p>
                        <p className="text-xs mt-1">Invite players to join via QR or Code.</p>
                    </div>
                )}
                
                {teams.map(team => {
                    // Use stored code or calculate fallback safe for display
                    const displayCode = team.joinCode || getJoinCode(team.name || 'Unknown');
                    
                    return (
                        <div key={team.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg flex gap-4 relative overflow-hidden group">
                            {/* Decorative stripe */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                            
                            {/* Photo */}
                            <div className="w-20 h-20 bg-slate-700 rounded-lg flex-shrink-0 overflow-hidden border border-slate-600 shadow-inner">
                                {team.photoUrl ? (
                                    <img src={team.photoUrl} className="w-full h-full object-cover" alt={team.name} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-800">
                                        <Users className="w-8 h-8" />
                                    </div>
                                )}
                            </div>
                            
                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-black text-white text-lg leading-tight truncate pr-2">
                                        {team.name} <span className="text-slate-500 font-mono text-sm ml-1">({displayCode})</span>
                                    </h3>
                                    <span className="bg-slate-950 text-orange-500 font-black px-2 py-0.5 rounded text-xs border border-slate-800 shadow-sm whitespace-nowrap">
                                        {team.score} pts
                                    </span>
                                </div>
                                
                                <div className="text-xs text-slate-400 mb-2 font-medium">
                                    Code: <span className="text-white font-mono tracking-wider">{displayCode}</span>
                                </div>
                                
                                {/* Members */}
                                <div className="flex flex-wrap gap-1.5 mt-auto">
                                    {team.members && team.members.length > 0 ? (
                                        team.members.map((member, i) => (
                                            <span key={i} className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                                {member}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[10px] text-slate-600 italic">Waiting for players...</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Close Button */}
            <div className="p-4 border-t border-slate-800 bg-slate-950">
                <button 
                    onClick={onClose}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors border border-slate-700"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
  );
};

export default TeamsModal;