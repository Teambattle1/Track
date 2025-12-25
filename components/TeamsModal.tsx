
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Team, Game } from '../types';
import * as db from '../services/db';
import { teamSync } from '../services/teamSync';
import { X, Users, RefreshCw, Hash, ChevronRight, Calendar, Clock, CheckCircle, ChevronDown, Anchor, Play, Edit2, Check, AlertCircle, Camera, Shield, MessageSquare, MapPin, LayoutGrid, CheckSquare, Upload } from 'lucide-react';

interface TeamsModalProps {
  gameId: string | null;
  games: Game[];
  targetTeamId?: string | null;
  onSelectGame: (id: string) => void;
  onClose: () => void;
  onEnterLobby?: (team: Team) => void;
  isAdmin?: boolean;
  onChatWithTeam?: (teamId: string) => void; 
}

const TeamsModal: React.FC<TeamsModalProps> = ({ gameId, games, targetTeamId, onSelectGame, onClose, isAdmin = false, onChatWithTeam }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'TODAY' | 'PLANNED' | 'COMPLETED'>('TODAY');
  const [showGameSwitch, setShowGameSwitch] = useState(false);
  const [activeLobbyView, setActiveLobbyView] = useState<Team | null>(null);
  
  // Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [uploadTargetMemberId, setUploadTargetMemberId] = useState<string | null>(null);
  
  const teamPhotoInputRef = useRef<HTMLInputElement>(null);
  const memberPhotoInputRef = useRef<HTMLInputElement>(null);

  const activeGame = games.find(g => g.id === gameId);

  const loadTeams = async (targetId: string | null) => {
    if (!targetId) return;
    setLoading(true);
    try {
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

  // Auto-open target team if provided
  useEffect(() => {
      if (targetTeamId && teams.length > 0) {
          const t = teams.find(team => team.id === targetTeamId);
          if (t) {
              setActiveLobbyView(t);
              setEditedName(t.name);
          }
      }
  }, [targetTeamId, teams]);

  const handleSaveName = async () => {
      if (activeLobbyView && editedName.trim()) {
          await db.updateTeamName(activeLobbyView.id, editedName.trim());
          setIsEditingName(false);
          // Refresh local state optimistically or wait for reload
          setActiveLobbyView(prev => prev ? { ...prev, name: editedName.trim() } : null);
          loadTeams(gameId); 
      }
  };

  const handleMakeCaptain = async (memberDeviceId: string) => {
      if (!activeLobbyView || !memberDeviceId) return;
      if (!confirm("Promote this member to Captain?")) return;
      
      await db.updateTeamCaptain(activeLobbyView.id, memberDeviceId);
      setActiveLobbyView(prev => prev ? { ...prev, captainDeviceId: memberDeviceId } : null);
      loadTeams(gameId);
  };

  // --- PHOTO UPLOAD HANDLERS ---
  const handleTeamPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && activeLobbyView) {
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              await db.updateTeamPhoto(activeLobbyView.id, base64);
              setActiveLobbyView(prev => prev ? { ...prev, photoUrl: base64 } : null);
              loadTeams(gameId);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleMemberPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && activeLobbyView && uploadTargetMemberId) {
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              await db.updateMemberPhoto(activeLobbyView.id, uploadTargetMemberId, base64);
              
              // Update local state
              setActiveLobbyView(prev => {
                  if (!prev) return null;
                  const newMembers = prev.members.map(m => {
                      const mId = typeof m === 'string' ? '' : m.deviceId; // Fallback
                      if (mId === uploadTargetMemberId) {
                          return { ...m, photo: base64 };
                      }
                      return m;
                  });
                  return { ...prev, members: newMembers };
              });
              setUploadTargetMemberId(null);
              loadTeams(gameId);
          };
          reader.readAsDataURL(file);
      }
  };

  const triggerMemberPhotoUpload = (memberId: string) => {
      setUploadTargetMemberId(memberId);
      setTimeout(() => memberPhotoInputRef.current?.click(), 100);
  };

  const filteredGames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const gamesArr = Array.isArray(games) ? games : [];
    
    return gamesArr.filter(g => {
        const gDate = new Date(g.createdAt);
        gDate.setHours(0, 0, 0, 0);
        const isCompleted = g.points?.length > 0 && g.points.every(p => p.isCompleted);
        if (tab === 'COMPLETED') return isCompleted;
        if (isCompleted) return false; 
        if (tab === 'TODAY') return gDate.getTime() === today.getTime();
        if (tab === 'PLANNED') return gDate.getTime() !== today.getTime();
        return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [games, tab]);

  // Helper to calculate team progress breakdown
  const getTeamProgress = (team: Team) => {
      if (!activeGame) return { mapSolved: 0, mapTotal: 0, playgroundStats: [] };

      const completedIds = team.completedPointIds || [];
      
      // Map Tasks
      const mapTasks = activeGame.points.filter(p => !p.playgroundId && !p.isSectionHeader);
      const mapSolved = mapTasks.filter(p => completedIds.includes(p.id)).length;

      // Playgrounds
      const playgroundStats = (activeGame.playgrounds || []).map(pg => {
          const zoneTasks = activeGame.points.filter(p => p.playgroundId === pg.id);
          const solved = zoneTasks.filter(p => completedIds.includes(p.id)).length;
          return {
              id: pg.id,
              name: pg.title,
              solved,
              total: zoneTasks.length
          };
      });

      return {
          mapSolved,
          mapTotal: mapTasks.length,
          playgroundStats
      };
  };

  if (isAdmin && !activeLobbyView && activeGame) {
      // ADMIN GRID VIEW
      return (
          <div className="fixed inset-0 z-[5200] bg-slate-950 text-white flex flex-col font-sans overflow-hidden animate-in fade-in duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)] opacity-40 pointer-events-none" />
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

              {/* Header */}
              <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0 shadow-xl z-20">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
                          <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                          <h2 className="text-2xl font-black tracking-tight uppercase leading-none">TEAMLOBBY ADMIN</h2>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">SESSION: {activeGame.name}</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => loadTeams(gameId)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
                          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                      <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                  {teams.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500">
                          <Users className="w-16 h-16 mb-4 opacity-20" />
                          <p className="font-black uppercase tracking-[0.2em] text-sm">NO TEAMS REGISTERED</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {teams.map(team => {
                              const stats = getTeamProgress(team);
                              
                              return (
                                  <div 
                                    key={team.id} 
                                    onClick={() => setActiveLobbyView(team)}
                                    className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden shadow-xl flex flex-col hover:border-rose-500/30 transition-all group cursor-pointer hover:-translate-y-1"
                                  >
                                      {/* Card Banner */}
                                      <div className="h-28 bg-slate-800 relative overflow-hidden group-hover:brightness-110 transition-all">
                                          {team.photoUrl ? (
                                              <img src={team.photoUrl} className="w-full h-full object-cover" alt={team.name} />
                                          ) : (
                                              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                                                  <Users className="w-12 h-12 text-slate-700" />
                                              </div>
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                          
                                          <div className="absolute bottom-4 left-4 right-4">
                                              <h3 className="text-lg font-black text-white uppercase tracking-wide leading-tight truncate">{team.name}</h3>
                                              <div className="flex items-center gap-2 mt-1">
                                                  <span className="text-[10px] font-bold text-slate-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm uppercase flex items-center gap-1">
                                                      <Users className="w-3 h-3" /> {team.members.length} MEMBERS
                                                  </span>
                                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm uppercase ${team.isStarted ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                      {team.isStarted ? 'ACTIVE' : 'LOBBY'}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Stats Body */}
                                      <div className="p-5 flex-1 flex flex-col gap-4">
                                          {/* Map Progress */}
                                          <div className="bg-[#0a0a0a] rounded-xl p-3 border border-white/5">
                                              <div className="flex justify-between items-center mb-2">
                                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                      <MapPin className="w-3 h-3 text-orange-500" /> MAP TASKS
                                                  </span>
                                                  <span className="text-xs font-black text-white">{stats.mapSolved}/{stats.mapTotal}</span>
                                              </div>
                                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                  <div 
                                                      className="h-full bg-orange-600 rounded-full" 
                                                      style={{ width: `${stats.mapTotal > 0 ? (stats.mapSolved / stats.mapTotal) * 100 : 0}%` }}
                                                  />
                                              </div>
                                          </div>

                                          {/* Playgrounds List */}
                                          {stats.playgroundStats.length > 0 && (
                                              <div className="flex-1 space-y-2">
                                                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 ml-1">PLAYGROUND ZONES</p>
                                                  <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                                      {stats.playgroundStats.map(pg => (
                                                          <div key={pg.id} className="flex justify-between items-center text-xs p-2 bg-[#1a1a1a] rounded-lg border border-white/5">
                                                              <span className="font-bold text-slate-400 uppercase truncate flex-1 flex items-center gap-2">
                                                                  <LayoutGrid className="w-3 h-3 text-blue-500" /> {pg.name}
                                                              </span>
                                                              <span className={`font-black ${pg.solved === pg.total && pg.total > 0 ? 'text-green-500' : 'text-slate-300'}`}>
                                                                  {pg.solved}/{pg.total}
                                                              </span>
                                                          </div>
                                                      ))}
                                                  </div>
                                              </div>
                                          )}
                                          
                                          {/* Spacer if no playgrounds to push button down */}
                                          {stats.playgroundStats.length === 0 && <div className="flex-1"></div>}

                                          {/* Action */}
                                          <button 
                                              onClick={(e) => {
                                                  e.stopPropagation(); // Don't open lobby when clicking chat
                                                  onChatWithTeam && onChatWithTeam(team.id);
                                              }}
                                              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02]"
                                          >
                                              <MessageSquare className="w-4 h-4" /> CHAT TO TEAM
                                          </button>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- LOBBY / GHOST VIEW ---

  if (activeLobbyView) {
      const myDeviceId = teamSync.getDeviceId();
      const isCaptain = activeLobbyView.captainDeviceId === myDeviceId;
      // Admin implies "Ghost Mode" access
      const canEdit = isCaptain || isAdmin;

      return (
          <div className="fixed inset-0 z-[5200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center sm:p-4 animate-in zoom-in-95">
              <div className="bg-slate-900 border-2 border-orange-500/50 w-full h-full sm:h-auto sm:max-h-[85vh] max-w-md sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl relative">
                  {/* Footprint Pattern */}
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />

                  {/* Hidden Input for Team Photo Upload */}
                  <input ref={teamPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleTeamPhotoUpload} />
                  <input ref={memberPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleMemberPhotoUpload} />

                  <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center relative z-10 shrink-0">
                      <div className="flex flex-col">
                          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                              {isAdmin ? 'ADMIN GHOST MODE' : 'TEAM STATUS'}
                          </span>
                          {isEditingName ? (
                              <div className="flex items-center gap-2 mt-1">
                                  <input 
                                    type="text" 
                                    value={editedName} 
                                    onChange={(e) => setEditedName(e.target.value)}
                                    className="bg-slate-800 text-white font-bold text-sm px-2 py-1 rounded border border-slate-600 focus:border-orange-500 outline-none uppercase"
                                    autoFocus
                                  />
                                  <button onClick={handleSaveName} className="p-1 bg-green-600 rounded hover:bg-green-700 text-white"><Check className="w-4 h-4" /></button>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2">
                                  <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider truncate max-w-[200px]">{activeLobbyView.name}</h2>
                                  {canEdit && (
                                      <button onClick={() => { setIsEditingName(true); setEditedName(activeLobbyView.name); }} className="text-slate-500 hover:text-white transition-colors">
                                          <Edit2 className="w-4 h-4" />
                                      </button>
                                  )}
                              </div>
                          )}
                      </div>
                      <button onClick={() => { setActiveLobbyView(null); if(targetTeamId) onClose(); }} className="p-2 bg-slate-800 rounded-full text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4 sm:p-6 flex-1 relative z-10 overflow-y-auto">
                      <div className="flex items-center gap-4 mb-6 sm:mb-8">
                          <div 
                            onClick={() => isAdmin && teamPhotoInputRef.current?.click()}
                            className={`w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shrink-0 relative group ${isAdmin ? 'cursor-pointer hover:border-orange-500' : ''}`}
                          >
                              {activeLobbyView.photoUrl ? <img src={activeLobbyView.photoUrl} className="w-full h-full object-cover" /> : <Users className="w-8 h-8 text-slate-600 m-auto mt-4 sm:mt-6" />}
                              {isAdmin && (
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Camera className="w-6 h-6 text-white" />
                                  </div>
                              )}
                          </div>
                          <div>
                              <div className="bg-slate-950 px-2 py-1 rounded text-[10px] font-black text-white mb-1 inline-block uppercase font-mono">JOIN CODE: {activeLobbyView.joinCode}</div>
                              <div className={`flex items-center gap-2 text-[10px] font-black uppercase ${activeLobbyView.isStarted ? 'text-green-500' : 'text-amber-500'}`}>
                                  {activeLobbyView.isStarted ? <Play className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  {activeLobbyView.isStarted ? 'ON MISSION' : 'IN LOBBY'}
                              </div>
                          </div>
                      </div>
                      
                      {canEdit && (
                          <div className="mb-6 bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl flex items-center gap-3">
                              <Anchor className="w-5 h-5 text-blue-400" />
                              <div>
                                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{isAdmin ? 'ADMIN OVERRIDE' : 'CAPTAIN CONTROLS'}</p>
                                  <p className="text-xs text-slate-300">
                                      {isAdmin ? 'You can upload photos, rename team, and force assign captain.' : 'You can edit team name and manage settings.'}
                                  </p>
                              </div>
                          </div>
                      )}

                      <div className="space-y-3">
                          <div className="flex justify-between items-end">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OPERATIVES</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase">{activeLobbyView.members.length} ASSIGNED</p>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                              {activeLobbyView.members.map((m: any, i) => {
                                  // Compatibility check: m might be a string (legacy) or object (new)
                                  const name = typeof m === 'string' ? m : m.name;
                                  const photo = typeof m === 'string' ? null : m.photo;
                                  const deviceId = typeof m === 'string' ? '' : m.deviceId;
                                  const isMemberCaptain = deviceId === activeLobbyView.captainDeviceId;

                                  return (
                                      <div key={i} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex items-center justify-between group">
                                          <div className="flex items-center gap-3">
                                              <div 
                                                onClick={() => isAdmin && triggerMemberPhotoUpload(deviceId)}
                                                className={`w-8 h-8 rounded-full bg-slate-700 overflow-hidden relative group/img ${isAdmin ? 'cursor-pointer ring-1 ring-transparent hover:ring-orange-500' : ''}`}
                                              >
                                                  {photo ? <img src={photo} className="w-full h-full object-cover"/> : <Users className="w-4 h-4 m-auto mt-2 text-slate-500"/>}
                                                  {isAdmin && (
                                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center">
                                                          <Upload className="w-3 h-3 text-white" />
                                                      </div>
                                                  )}
                                              </div>
                                              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{name || 'Unknown Agent'}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              {isMemberCaptain ? (
                                                  <div title="Captain" className="bg-orange-500/20 p-1.5 rounded-lg border border-orange-500/50"><Anchor className="w-3 h-3 text-orange-500" /></div>
                                              ) : (
                                                  isAdmin && (
                                                      <button 
                                                        onClick={() => handleMakeCaptain(deviceId)}
                                                        title="Promote to Captain"
                                                        className="p-1.5 bg-slate-700 hover:bg-orange-600 hover:text-white text-slate-500 rounded-lg transition-colors"
                                                      >
                                                          <Anchor className="w-3 h-3" />
                                                      </button>
                                                  )
                                              )}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  </div>
                  <div className="p-4 sm:p-6 bg-slate-950 border-t border-slate-800 relative z-10 shrink-0">
                      <button onClick={() => { setActiveLobbyView(null); if(targetTeamId) onClose(); }} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">RETURN</button>
                  </div>
              </div>
          </div>
      );
  }

  // --- STANDARD GAME PICKER (Fallback if no gameId provided initially) ---
  if (!gameId) {
      return (
        <div className="fixed inset-0 z-[5200] bg-black/80 backdrop-blur-sm flex items-center justify-center sm:p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 w-full h-full sm:h-auto sm:max-h-[85vh] max-w-md rounded-none sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />

                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 relative z-10 shrink-0">
                    <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-widest">
                        <Users className="w-5 h-5 text-blue-500"/> Select Game
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>
                <div className="flex border-b border-slate-800 bg-slate-900 relative z-10 shrink-0">
                    {['TODAY', 'PLANNED', 'COMPLETED'].map(t => (
                        <button key={t} onClick={() => setTab(t as any)} className={`flex-1 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 tracking-widest ${tab === t ? 'text-orange-500 border-b-2 border-orange-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>{t}</button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-900 relative z-10">
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

  const gamesArr = Array.isArray(games) ? games : [];
  const selectedGame = gamesArr.find(g => g.id === gameId);

  // Standard non-admin (or non-ghost) view is essentially skipped in Admin mode via the `if (isAdmin)` block above.
  // This return handles standard user view.
  return (
    <div className="fixed inset-0 z-[5200] bg-black/80 backdrop-blur-sm flex items-center justify-center sm:p-4 animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 w-full h-full sm:h-auto sm:max-h-[85vh] max-w-md rounded-none sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 relative">
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />

            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 relative z-10 shrink-0">
                <div className="flex flex-col min-w-0">
                    <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-widest">
                        <Users className="w-5 h-5 text-blue-500"/> Teams Joined
                    </h2>
                    <button onClick={() => setShowGameSwitch(!showGameSwitch)} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 hover:text-white transition-colors text-left">
                        <span className="truncate">{selectedGame?.name || 'Unknown Game'}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${showGameSwitch ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => loadTeams(gameId)} title="Refresh Team List" className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>
            {showGameSwitch && (
                <div className="bg-slate-950 border-b border-slate-800 p-2 max-h-40 overflow-y-auto animate-in slide-in-from-top-2 relative z-20 shrink-0">
                    {gamesArr.map(g => (
                        <button key={g.id} onClick={() => { onSelectGame(g.id); setShowGameSwitch(false); }} className={`w-full p-2 text-left text-[10px] font-black uppercase rounded hover:bg-slate-800 transition-colors ${g.id === gameId ? 'text-blue-500' : 'text-slate-400'}`}>{g.name}</button>
                    ))}
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900 custom-scrollbar relative z-10">
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
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <Users className="w-3 h-3" />
                                {team.members.length} OPERATIVES
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950 relative z-10 shrink-0"><button onClick={onClose} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl border border-slate-700 uppercase tracking-[0.2em] text-[10px]">CLOSE</button></div>
        </div>
    </div>
  );
};

export default TeamsModal;
