
import React, { useEffect, useState, useMemo } from 'react';
import { Team, Game } from '../types';
import * as db from '../services/db';
import { X, Users, RefreshCw, Hash, ChevronRight, Calendar, Clock, CheckCircle, ChevronDown, Anchor, Play } from 'lucide-react';

interface TeamsModalProps {
  gameId: string | null;
  games: Game[];
  onSelectGame: (id: string) => void;
  onClose: () => void;
  onEnterLobby?: (team: Team) => void;
}

const getJoinCode = (name: string): string => {
    if (!name) return '000000';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; 
    }
    const code = Math.abs(hash) % 900000 + 100000;
    return code.toString();
};

const TeamsModal: React.FC<TeamsModalProps> = ({ gameId, games, onSelectGame, onClose }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'TODAY' | 'PLANNED' | 'COMPLETED'>('TODAY');
  const [showGameSwitch, setShowGameSwitch] = useState(false);
  const [activeLobbyView, setActiveLobbyView] = useState<Team | null>(null);

  const loadTeams = async (targetId: string | null) => {
    if (!targetId) return;
    setLoading(true);
    try {
        console.log(`[TeamsModal] Fetching teams for game: ${targetId}`);
        const data = await db.fetchTeams(targetId);
        setTeams(data);
    } catch (e) {
        console.error("Failed to load teams", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams(gameId);
  }, [gameId]);

  const filteredGames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return games.filter(g => {
        const gDate = new Date(g.createdAt);
        gDate.setHours(0, 0, 0, 0);
        const isCompleted = g.points.length > 0 && g.points.every(p => p.isCompleted);
        if (tab === 'COMPLETED') return isCompleted;
        if (isCompleted) return false; 
        if (tab === 'TODAY') return gDate.getTime() === today.getTime();
        if (tab === 'PLANNED') return gDate.getTime() !== today.getTime();
        return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [games, tab]);

  if (activeLobbyView) {
      return (
          <div className="fixed inset-0 z-[2100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95">
              <div className="bg-slate-900 border-2 border-orange-500/50 w-full max-w-md rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                      <div className="flex flex-col">
                          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">TEAM STATUS</span>
                          <h2 className="text-xl font-black text-white uppercase tracking-wider">{activeLobbyView.name}</h2>
                      </div>
                      <button onClick={() => setActiveLobbyView(null)} className="p-2 bg-slate-800 rounded-full text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 flex-1">
                      <div className="flex items-center gap-4 mb-8">
                          <div className="w-20 h-20 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
                              {activeLobbyView.photoUrl ? <img src={activeLobbyView.photoUrl} className="w-full h-full object-cover" /> : <Users className="w-8 h-8 text-slate-600 m-auto mt-6" />}
                          </div>
                          <div>
                              <div className="bg-slate-950 px-2 py-1 rounded text-[10px] font-black text-white mb-1 inline-block uppercase font-mono">JOIN CODE: {activeLobbyView.joinCode}</div>
                              <div className={`flex items-center gap-2 text-[10px] font-black uppercase ${activeLobbyView.isStarted ? 'text-green-500' : 'text-amber-500'}`}>
                                  {activeLobbyView.isStarted ? <Play className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  {activeLobbyView.isStarted ? 'ON MISSION' : 'IN LOBBY'}
                              </div>
                          </div>
                      </div>
                      <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OPERATIVES</p>
                          <div className="grid grid-cols-1 gap-2">
                              {activeLobbyView.members.map((m, i) => (
                                  <div key={i} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{m}</span>
                                      {m === activeLobbyView.captainDeviceId && <Anchor className="w-3 h-3 text-orange-500" />}
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="p-6 bg-slate-950 border-t border-slate-800">
                      <button onClick={() => setActiveLobbyView(null)} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">CLOSE VIEW</button>
                  </div>
              </div>
          </div>
      );
  }

  if (!gameId) {
      return (
        <div className="fixed inset-0 z-[1500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-widest">
                        <Users className="w-5 h-5 text-blue-500"/> Select Game
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>
                <div className="flex border-b border-slate-800 bg-slate-900">
                    {['TODAY', 'PLANNED', 'COMPLETED'].map(t => (
                        <button key={t} onClick={() => setTab(t as any)} className={`flex-1 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 tracking-widest ${tab === t ? 'text-orange-500 border-b-2 border-orange-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>{t}</button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-900">
                    {filteredGames.length === 0 && <div className="text-center py-10 opacity-30 uppercase font-black text-xs tracking-widest">No games found.</div>}
                    {filteredGames.map(game => (
                        <button key={game.id} onClick={() => onSelectGame(game.id)} className="w-full bg-slate-800 hover:bg-slate-700 p-4 rounded-xl border border-slate-700 flex items-center justify-between transition-all group">
                            <div className="text-left">
                                <h3 className="font-black text-white uppercase tracking-widest text-sm group-hover:text-blue-400">{game.name}</h3>
                                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-bold uppercase"><Calendar className="w-2.5 h-2.5" /> {new Date(game.createdAt).toLocaleDateString()}</p>
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
    <div className="fixed inset-0 z-[1500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 w-full max-w-md max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <div className="flex flex-col min-w-0">
                    <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-widest">
                        <Users className="w-5 h-5 text-blue-500"/> Teams Joined
                    </h2>
                    <button onClick={() => setShowGameSwitch(!showGameSwitch)} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 hover:text-white transition-colors">
                        <span className="truncate">{selectedGame?.name || 'Unknown Game'}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${showGameSwitch ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => loadTeams(gameId)} title="Refresh Team List" className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>
            </div>
            {showGameSwitch && (
                <div className="bg-slate-950 border-b border-slate-800 p-2 max-h-40 overflow-y-auto animate-in slide-in-from-top-2">
                    {games.map(g => (
                        <button key={g.id} onClick={() => { onSelectGame(g.id); setShowGameSwitch(false); }} className={`w-full p-2 text-left text-[10px] font-black uppercase rounded hover:bg-slate-800 transition-colors ${g.id === gameId ? 'text-blue-500' : 'text-slate-400'}`}>{g.name}</button>
                    ))}
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900 custom-scrollbar">
                {teams.length === 0 && !loading && (
                    <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 opacity-20" /></div>
                        <p className="font-black uppercase tracking-widest text-sm">No teams found for {selectedGame?.name}</p>
                    </div>
                )}
                {teams.map(team => (
                    <div key={team.id} onClick={() => setActiveLobbyView(team)} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg flex gap-4 relative overflow-hidden group hover:border-orange-500/50 transition-all cursor-pointer">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${team.isStarted ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                        <div className="w-16 h-16 bg-slate-700 rounded-lg flex-shrink-0 overflow-hidden border border-slate-600 shadow-inner">
                            {team.photoUrl ? <img src={team.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-800"><Users className="w-8 h-8" /></div>}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-black text-white text-base leading-tight truncate pr-2 uppercase tracking-wide">{team.name}</h3>
                                <span className="bg-slate-950 text-orange-500 font-black px-2 py-0.5 rounded text-[9px] border border-slate-800 shadow-sm whitespace-nowrap uppercase tracking-widest">{team.score} PTS</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${team.isStarted ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
                                <span className={`text-[8px] font-black uppercase tracking-widest ${team.isStarted ? 'text-green-500' : 'text-amber-500'}`}>{team.isStarted ? 'ACTIVE' : 'LOBBY'}</span>
                                <div className="h-3 w-px bg-slate-700 mx-1" />
                                <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">{team.joinCode}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950"><button onClick={onClose} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl border border-slate-700 uppercase tracking-[0.2em] text-[10px]">CLOSE</button></div>
        </div>
    </div>
  );
};

export default TeamsModal;
