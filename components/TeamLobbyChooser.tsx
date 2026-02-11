import React, { useState, useEffect } from 'react';
import { X, Users, Shield, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { Team, Game } from '../types';
import * as db from '../services/db';
import GameChooserView from './GameChooserView';

interface TeamLobbyChooserProps {
  games: Game[];
  onClose: () => void;
  onSelectTeam: (teamId: string) => void;
}

const LS_KEY = 'teamtrack_lastLobbyGameId';

const TeamLobbyChooser: React.FC<TeamLobbyChooserProps> = ({ games, onClose, onSelectTeam }) => {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored && games.some(g => g.id === stored && !g.isGameTemplate)) return stored;
    return null;
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const game = games.find(g => g.id === selectedGameId);

  useEffect(() => {
    if (selectedGameId) {
      localStorage.setItem(LS_KEY, selectedGameId);
      loadTeams(selectedGameId);
    }
  }, [selectedGameId]);

  const loadTeams = async (gId: string) => {
    setLoading(true);
    try {
      const data = await db.fetchTeams(gId);
      setTeams(data);
    } catch (err) {
      console.error('[TeamLobbyChooser] Error loading teams:', err);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  // ========== GAME CHOOSER VIEW ==========
  if (!selectedGameId) {
    return (
      <GameChooserView
        games={games}
        title="SELECT GAME"
        subtitle="Choose a game to view team lobby"
        accentColor="purple"
        onSelectGame={(id) => setSelectedGameId(id)}
        onClose={onClose}
      />
    );
  }

  // ========== TEAM SELECTOR VIEW ==========
  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-lg max-h-[80vh] rounded-[2rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,1)] flex flex-col">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d]/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
              <Shield className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">TEAM LOBBY</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-0.5">
                <button onClick={() => { setSelectedGameId(null); setSearchQuery(''); }} className="hover:text-purple-400 transition-colors">
                  {game?.name || 'Unknown Game'}
                </button>
                {' '}— {teams.length} teams
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => selectedGameId && loadTeams(selectedGameId)} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors" title="Refresh">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {teams.length > 5 && (
          <div className="px-5 pt-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search teams..."
                className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 rounded-xl border-2 border-slate-300 focus:border-purple-500/50 focus:outline-none text-sm font-medium shadow-sm"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-slate-600 animate-spin" />
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-sm font-bold text-slate-500 uppercase">
                {teams.length === 0 ? 'No teams yet' : 'No teams match'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {teams.length === 0 ? 'No teams have joined this game yet.' : 'Try a different search.'}
              </p>
            </div>
          ) : (
            filteredTeams.map(team => (
              <button
                key={team.id}
                onClick={() => {
                  onSelectTeam(team.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/40 hover:bg-slate-800/60 transition-all text-left group"
              >
                {team.photoUrl ? (
                  <img src={team.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0"
                       style={team.color ? { backgroundColor: team.color + '20', borderColor: team.color + '40' } : {}}>
                    <Users className="w-5 h-5 text-slate-500" style={team.color ? { color: team.color } : {}} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">{team.name}</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                    {team.members?.length || 0} members · {team.score || 0} pts
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamLobbyChooser;
