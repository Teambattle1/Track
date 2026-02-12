import React, { useState, useEffect } from 'react';
import { X, Users, Shield, Search, RefreshCw, ChevronRight, ArrowLeftRight } from 'lucide-react';
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
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                {game?.name || 'Unknown Game'} — {teams.length} TEAMS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedGameId(null); setSearchQuery(''); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 hover:bg-purple-600/20 hover:border-purple-500/40 transition-all"
              title="Switch game"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">GAME</span>
            </button>
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
              <Users className="w-12 h-12 text-slate-500 mb-4" />
              <p className="text-base font-black text-slate-300 uppercase tracking-wider">
                {teams.length === 0 ? 'NO TEAMS YET' : 'NO TEAMS MATCH'}
              </p>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mt-2">
                {teams.length === 0 ? 'NO TEAMS HAVE JOINED THIS GAME YET' : 'TRY A DIFFERENT SEARCH'}
              </p>
            </div>
          ) : (
            filteredTeams.map(team => {
              const tc = team.color || '#8b5cf6'; // fallback purple
              return (
                <button
                  key={team.id}
                  onClick={() => {
                    onSelectTeam(team.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left group"
                  style={{
                    backgroundColor: tc + '10',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: tc + '30',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = tc + '60'; (e.currentTarget as HTMLElement).style.backgroundColor = tc + '18'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = tc + '30'; (e.currentTarget as HTMLElement).style.backgroundColor = tc + '10'; }}
                >
                  {team.photoUrl ? (
                    <img src={team.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: tc + '50' }} />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                         style={{ backgroundColor: tc + '20', borderWidth: '1px', borderStyle: 'solid', borderColor: tc + '40' }}>
                      <Users className="w-5 h-5" style={{ color: tc }} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-black text-white uppercase tracking-wider truncate">{team.name}</h3>
                    <p className="text-sm font-black uppercase tracking-widest" style={{ color: tc }}>
                      {team.members?.length || 0} MEMBERS · {team.score || 0} PTS
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: tc }} />
                </button>
              );
            }))
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamLobbyChooser;
