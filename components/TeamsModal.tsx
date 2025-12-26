
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Team, Game, ChatMessage, GamePoint } from '../types';
import * as db from '../services/db';
import { teamSync } from '../services/teamSync';
import { X, Users, RefreshCw, Hash, ChevronRight, Calendar, Clock, CheckCircle, ChevronDown, Anchor, Play, Edit2, Check, AlertCircle, Camera, Shield, MessageSquare, MapPin, LayoutGrid, CheckSquare, Upload, User, ToggleLeft, ToggleRight, List, AlertTriangle, Radio, Crown, Trophy, Star, Activity, PauseCircle, XCircle } from 'lucide-react';
import AvatarCreator from './AvatarCreator';

interface TeamsModalProps {
  gameId: string | null;
  games: Game[];
  targetTeamId?: string | null;
  onSelectGame: (id: string) => void;
  onClose: () => void;
  onEnterLobby?: (team: Team) => void;
  isAdmin?: boolean;
  onChatWithTeam?: (teamId: string) => void; 
  chatHistory?: ChatMessage[];
  onUpdateGame?: (game: Game) => void;
}

interface CollapsibleSectionProps {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon: Icon, children, isOpen, onToggle }) => (
    <div className="mb-2">
        <button 
            onClick={onToggle}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isOpen ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'}`}
        >
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
            <div className="mt-2 pl-2 border-l-2 border-slate-800 ml-3 animate-in slide-in-from-top-2">
                {children}
            </div>
        )}
    </div>
);

const TeamsModal: React.FC<TeamsModalProps> = ({ gameId, games, targetTeamId, onSelectGame, onClose, isAdmin = false, onChatWithTeam, chatHistory = [], onUpdateGame }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'TODAY' | 'PLANNED' | 'COMPLETED'>('TODAY');
  const [showGameSwitch, setShowGameSwitch] = useState(false);
  const [activeLobbyView, setActiveLobbyView] = useState<Team | null>(null);
  
  // Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  
  // Avatar Modal State
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarTargetMemberId, setAvatarTargetMemberId] = useState<string | null>(null);
  
  // View State
  const [collapsedLogSections, setCollapsedLogSections] = useState<Record<string, boolean>>({});
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const teamPhotoInputRef = useRef<HTMLInputElement>(null);

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
    // Refresh status periodically
    const interval = setInterval(() => {
       if (gameId) loadTeams(gameId); 
    }, 60000); // 1 minute refresh
    return () => clearInterval(interval);
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
      if (!activeLobbyView || !memberDeviceId) {
          console.warn("Cannot promote: No active lobby or missing device ID", { activeLobbyView, memberDeviceId });
          return;
      }
      if (!confirm("Promote this member to Captain? You will lose command.")) return;
      
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

  const saveMemberAvatar = async (base64: string) => {
      if (!activeLobbyView || !avatarTargetMemberId) return;
      
      await db.updateMemberPhoto(activeLobbyView.id, avatarTargetMemberId, base64);
      
      // Update local state
      setActiveLobbyView(prev => {
          if (!prev) return null;
          const newMembers = prev.members.map(m => {
              const { deviceId, name } = resolveMember(m);
              if (deviceId === avatarTargetMemberId) {
                  return { name, deviceId, photo: base64 };
              }
              return m;
          });
          return { ...prev, members: newMembers };
      });
      setShowAvatarModal(false);
      setAvatarTargetMemberId(null);
      loadTeams(gameId);
  };

  const openAvatarCreator = (memberId: string) => {
      setAvatarTargetMemberId(memberId);
      setShowAvatarModal(true);
  };

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

  // --- TEAM STATUS LOGIC ---
  const getTeamStatusConfig = (team: Team) => {
      if (!team.isStarted) {
          return { label: 'LOBBY', color: 'bg-amber-500/20 text-amber-400', icon: Clock, animate: false };
      }

      const now = Date.now();
      const lastUpdate = new Date(team.updatedAt).getTime();
      const diffMinutes = (now - lastUpdate) / (1000 * 60);

      if (diffMinutes > 30) {
          return { label: 'INACTIVE', color: 'bg-red-500/20 text-red-400', icon: XCircle, animate: false };
      }
      if (diffMinutes > 10) {
          return { label: 'IDLE', color: 'bg-yellow-500/20 text-yellow-400', icon: PauseCircle, animate: false };
      }
      return { label: 'ACTIVE', color: 'bg-green-500/20 text-green-400', icon: Activity, animate: true };
  };

  // Robustly parse member data handling double/triple serialization
  const resolveMember = (m: any) => {
      // 1. Unwind serialization layers
      let data = m;
      // Loop a few times to unwrap nested JSON strings (e.g. "{\"name\":\"...\"}")
      let attempts = 0;
      while (typeof data === 'string' && (data.trim().startsWith('{') || data.trim().startsWith('"')) && attempts < 5) {
          try {
              const parsed = JSON.parse(data);
              data = parsed;
          } catch {
              break; 
          }
          attempts++;
      }

      // 2. Default values
      let name = "Unknown Agent";
      let deviceId = "";
      let photo = null;

      if (typeof data === 'object' && data !== null) {
          // 3. Extract fields (handle case sensitivity and potential nested JSON in name field)
          const candidateName = data.name || data.NAME || data.Name;
          const candidateId = data.deviceId || data.DEVICEID || data.DeviceId;
          const candidatePhoto = data.photo || data.PHOTO || data.Photo;

          // Attempt to fix nested name objects if present
          if (candidateName) {
              if (typeof candidateName === 'string' && candidateName.trim().startsWith('{')) {
                  try {
                      const parsedNameObj = JSON.parse(candidateName);
                      name = parsedNameObj.name || parsedNameObj.NAME || "Unknown";
                      // Opportunistic ID recovery if ID is missing at top level
                      if (!candidateId && (parsedNameObj.deviceId || parsedNameObj.DEVICEID)) {
                          deviceId = parsedNameObj.deviceId || parsedNameObj.DEVICEID;
                      }
                  } catch {
                      name = candidateName;
                  }
              } else if (typeof candidateName === 'object') {
                  name = candidateName.name || candidateName.NAME || "Unknown";
              } else {
                  name = String(candidateName);
              }
          }

          if (candidateId) deviceId = candidateId;
          if (candidatePhoto) photo = candidatePhoto;

      } else {
          // Fallback if data ended up as a primitive string
          name = String(data);
      }

      return { name, deviceId, photo };
  };

  if (isAdmin && !activeLobbyView && activeGame) {
      // Sort teams by rank (highest score first)
      const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

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
                          {sortedTeams.map((team, idx) => {
                              const stats = getTeamProgress(team);
                              const rank = idx + 1;
                              const statusConfig = getTeamStatusConfig(team);
                              const StatusIcon = statusConfig.icon;
                              
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
                                          
                                          {/* Rank Badge */}
                                          <div className="absolute top-2 left-2">
                                               <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${rank === 1 ? 'bg-yellow-500 text-black' : (rank === 2 ? 'bg-gray-300 text-black' : (rank === 3 ? 'bg-amber-700 text-white' : 'bg-black/60 text-white'))}`}>
                                                   RANK #{rank}
                                               </span>
                                          </div>

                                          <div className="absolute bottom-4 left-4 right-4">
                                              <h3 className="text-lg font-black text-white uppercase tracking-wide leading-tight truncate">{team.name}</h3>
                                              <div className="flex items-center gap-2 mt-1">
                                                  <span className="text-[10px] font-bold text-slate-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm uppercase flex items-center gap-1">
                                                      <Users className="w-3 h-3" /> {team.members.length} MEMBERS
                                                  </span>
                                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm uppercase flex items-center gap-1 ${statusConfig.color}`}>
                                                      <StatusIcon className={`w-3 h-3 ${statusConfig.animate ? 'animate-pulse' : ''}`} />
                                                      {statusConfig.label}
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
      // Admin implies "Ghost Mode" access. Captains can edit team.
      const canEdit = isCaptain || isAdmin;
      
      const teamChats = chatHistory.filter(msg => 
          msg.targetTeamId === activeLobbyView.id
      ).slice(-15); // Show last 15 messages

      const unreadCount = teamChats.length; 

      const showRankingsToPlayers = isAdmin || (activeGame?.showRankingToPlayers || false);
      const showTaskDetails = isAdmin || (activeGame?.showTaskDetailsToPlayers);

      // Group tasks for display
      const mapTasks = activeGame?.points.filter(p => !p.playgroundId && !p.isSectionHeader) || [];
      const playgroundGroups = activeGame?.playgrounds?.map(pg => ({
          ...pg,
          points: activeGame.points.filter(p => p.playgroundId === pg.id)
      })) || [];

      const bonusIds = activeLobbyView.completedPointIds?.filter(id => id.startsWith('bonus-')) || [];

      // Calculate Rank
      const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
      const myRank = sortedTeams.findIndex(t => t.id === activeLobbyView.id) + 1;
      const hasRankings = sortedTeams.length > 0;

      // Status for Single View
      const statusConfig = getTeamStatusConfig(activeLobbyView);
      const StatusIcon = statusConfig.icon;

      // Sort Members: Captain first
      const sortedMembers = [...activeLobbyView.members].sort((a, b) => {
          const aRes = resolveMember(a);
          const bRes = resolveMember(b);
          if (aRes.deviceId === activeLobbyView.captainDeviceId) return -1;
          if (bRes.deviceId === activeLobbyView.captainDeviceId) return 1;
          return 0;
      });

      const renderTaskRow = (point: GamePoint) => {
          const isCompleted = activeLobbyView.completedPointIds?.includes(point.id);
          return (
              <div key={point.id} className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
                  <span className={`text-[10px] font-bold uppercase truncate max-w-[70%] ${isCompleted ? 'text-white' : 'text-slate-500'}`}>
                      {point.title}
                  </span>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase ${isCompleted ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                      {isCompleted ? (
                          <>
                              <CheckCircle className="w-3 h-3" /> DONE
                          </>
                      ) : (
                          <>
                              <AlertCircle className="w-3 h-3" /> PENDING
                          </>
                      )}
                  </div>
              </div>
          );
      };

      return (
          <div className="fixed inset-0 z-[5200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center sm:p-4 animate-in zoom-in-95">
              <div className={`bg-slate-900 border-2 border-orange-500/50 w-full h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative ${isAdmin ? 'max-w-5xl sm:rounded-[2.5rem]' : 'max-w-md sm:rounded-[2rem]'}`}>
                  {/* Footprint Pattern */}
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />

                  {/* Hidden Input for Team Photo Upload */}
                  <input ref={teamPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleTeamPhotoUpload} />

                  <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center relative z-10 shrink-0">
                      <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${statusConfig.color}`}>
                                  {statusConfig.label} {isAdmin && '(GHOST)'}
                              </span>
                              {myRank > 0 && (
                                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-2 rounded text-white">
                                      RANK #{myRank}
                                  </span>
                              )}
                          </div>
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
                      <div className="flex gap-2">
                          {isAdmin && activeGame && onUpdateGame && (
                              <button 
                                onClick={() => onUpdateGame({ ...activeGame, showTaskDetailsToPlayers: !activeGame.showTaskDetailsToPlayers })}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-colors ${activeGame.showTaskDetailsToPlayers ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                title="Toggle Task Breakdown Visibility for Players"
                              >
                                  {activeGame.showTaskDetailsToPlayers ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                  {activeGame.showTaskDetailsToPlayers ? 'PLAYER TASK LIST: VISIBLE' : 'PLAYER TASK LIST: HIDDEN'}
                              </button>
                          )}
                          <button onClick={() => { setActiveLobbyView(null); if(targetTeamId) onClose(); }} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors"><X className="w-5 h-5" /></button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-hidden relative z-10 flex flex-col md:flex-row">
                      
                      {/* LEFT COLUMN: Team Details */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 border-b md:border-b-0 md:border-r border-slate-800">
                          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6 sm:mb-8 bg-slate-800/30 p-4 rounded-3xl border border-white/5">
                              <div 
                                onClick={() => isAdmin && teamPhotoInputRef.current?.click()}
                                className={`w-20 h-20 sm:w-24 sm:h-24 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shrink-0 relative group shadow-lg ${isAdmin ? 'cursor-pointer hover:border-orange-500' : ''}`}
                              >
                                  {activeLobbyView.photoUrl ? <img src={activeLobbyView.photoUrl} className="w-full h-full object-cover" /> : <Users className="w-8 h-8 text-slate-600 m-auto mt-6 sm:mt-8" />}
                                  {isAdmin && (
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Camera className="w-6 h-6 text-white" />
                                      </div>
                                  )}
                              </div>
                              <div className="text-center sm:text-left flex-1 min-w-0">
                                  <div className="bg-black/40 px-3 py-1.5 rounded-lg text-xs font-black text-white mb-2 inline-block uppercase font-mono tracking-widest border border-white/10">
                                      JOIN CODE: {activeLobbyView.joinCode}
                                  </div>
                                  <div className={`flex items-center justify-center sm:justify-start gap-2 text-[10px] font-black uppercase ${statusConfig.color}`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {statusConfig.label}
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-2">
                                      {activeLobbyView.members.length} AGENTS DEPLOYED
                                  </p>
                              </div>
                          </div>
                          
                          {canEdit && (
                              <div className="mb-6 bg-blue-900/10 border border-blue-500/20 p-3 rounded-2xl flex items-center gap-3">
                                  <div className="p-2 bg-blue-500/20 rounded-lg"><Anchor className="w-4 h-4 text-blue-400" /></div>
                                  <div>
                                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{isAdmin ? 'ADMIN OVERRIDE' : 'CAPTAIN CONTROLS'}</p>
                                      <p className="text-[10px] text-slate-400">
                                          {isAdmin ? 'You can upload photos, rename team, and force assign captain.' : 'You can edit team name and promote other members to captain.'}
                                      </p>
                                  </div>
                              </div>
                          )}

                          <div className="space-y-3">
                              <div className="flex justify-between items-end px-1">
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OPERATIVE ROSTER</p>
                              </div>
                              
                              {/* 3x3 Grid for Team Members */}
                              <div className="grid grid-cols-3 gap-2">
                                  {sortedMembers.map((m: any, i) => {
                                      const { name, deviceId, photo } = resolveMember(m);
                                      const isMemberCaptain = deviceId === activeLobbyView.captainDeviceId;

                                      return (
                                          <div key={i} className="group relative flex flex-col items-center">
                                              <div 
                                                onClick={() => {
                                                    // Allow editing avatar if isAdmin OR if I'm editing my own avatar
                                                    if (isAdmin || deviceId === teamSync.getDeviceId()) {
                                                        openAvatarCreator(deviceId);
                                                    }
                                                }}
                                                className={`w-full aspect-square rounded-2xl bg-slate-800 overflow-hidden relative shrink-0 border-2 transition-all 
                                                    ${isMemberCaptain ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-slate-700 hover:border-slate-500'}
                                                    cursor-pointer`}
                                              >
                                                  {photo ? <img src={photo} className="w-full h-full object-cover"/> : <User className="w-8 h-8 m-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-600"/>}
                                                  
                                                  {isMemberCaptain && (
                                                      <div className="absolute top-1 right-1 bg-yellow-400 text-black p-1 rounded-full shadow-md z-10">
                                                          <Crown className="w-3 h-3 fill-current" />
                                                      </div>
                                                  )}

                                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                      <Edit2 className="w-4 h-4 text-white"/>
                                                  </div>
                                              </div>
                                              
                                              <div className="text-center w-full mt-1.5 px-1">
                                                  <h4 className="font-black text-white text-[10px] uppercase truncate w-full">{name}</h4>
                                                  {isMemberCaptain && <span className="text-[8px] font-bold text-yellow-500 uppercase block leading-none mt-0.5">CAPTAIN</span>}
                                                  
                                                  {/* Actions: Enable Promote for Admin OR Current Captain */}
                                                  {(isAdmin || isCaptain) && !isMemberCaptain && deviceId && (
                                                      <button 
                                                        onClick={() => handleMakeCaptain(deviceId)} 
                                                        className="mt-1 text-[8px] font-bold text-slate-500 hover:text-white uppercase border border-slate-700 hover:border-white px-1 rounded transition-colors w-full"
                                                      >
                                                          PROMOTE
                                                      </button>
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      </div>

                      {/* RIGHT COLUMN: Task Progress & Chat (Visible if Admin or Enabled) */}
                      {showTaskDetails && (
                          <div className="flex-1 flex flex-col min-h-[300px] bg-slate-900/50 relative overflow-hidden">
                              
                              {/* TOP: Collapsible Chat Log */}
                              <div className="border-b border-slate-800 bg-slate-950 flex-shrink-0 relative z-20">
                                  <button 
                                    onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-900 transition-colors"
                                  >
                                      <div className="flex items-center gap-2">
                                          <MessageSquare className={`w-3 h-3 ${unreadCount > 0 ? 'text-red-500 animate-pulse' : 'text-blue-500'}`} />
                                          <span className="text-[9px] font-black text-white uppercase tracking-widest">TEAM COMMS LOG</span>
                                          {unreadCount > 0 && <span className="bg-red-600 text-white text-[8px] font-bold px-1.5 rounded-full">{unreadCount}</span>}
                                      </div>
                                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isChatCollapsed ? '-rotate-90' : ''}`} />
                                  </button>
                                  
                                  {!isChatCollapsed && (
                                      <div className="h-48 overflow-y-auto p-4 space-y-3 custom-scrollbar border-t border-slate-800 bg-slate-900">
                                          {teamChats.length === 0 ? (
                                              <div className="text-center text-[10px] text-slate-600 font-bold uppercase py-8 italic">
                                                  NO MESSAGES RECORDED
                                              </div>
                                          ) : (
                                              teamChats.map(msg => (
                                                  <div key={msg.id} className={`flex flex-col gap-1 p-2 rounded-lg border ${msg.sender === 'Instructor' ? 'bg-orange-900/10 border-orange-900/30' : 'bg-slate-900 border-slate-800'}`}>
                                                      <div className="flex justify-between items-center">
                                                          <span className={`text-[9px] font-black uppercase ${msg.sender === 'Instructor' ? 'text-orange-500' : 'text-blue-400'}`}>
                                                              {msg.sender === 'Instructor' ? 'HQ (ADMIN)' : msg.sender}
                                                          </span>
                                                          <span className="text-[8px] font-mono text-slate-600">
                                                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                          </span>
                                                      </div>
                                                      <p className="text-xs text-slate-300 leading-tight">{msg.message}</p>
                                                  </div>
                                              ))
                                          )}
                                      </div>
                                  )}
                              </div>

                              {/* MAIN: Task List Section or Ranking List */}
                              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 relative">
                                  
                                  {/* Ranking Toggle (if allowed) */}
                                  {showRankingsToPlayers && (
                                      <div className="mb-4">
                                          <button 
                                              onClick={() => setShowLeaderboard(!showLeaderboard)}
                                              className={`w-full py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all 
                                                  ${showLeaderboard 
                                                      ? 'bg-purple-900/30 border-purple-500 text-purple-400' 
                                                      : (hasRankings ? 'bg-slate-800 border-purple-500/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white')
                                                  }`}
                                          >
                                              <Trophy className={`w-3 h-3 ${hasRankings && !showLeaderboard ? 'text-purple-400' : ''}`} /> {showLeaderboard ? 'HIDE RANKING LIST' : 'SHOW RANKING LIST'}
                                          </button>
                                      </div>
                                  )}

                                  {showLeaderboard ? (
                                      <div className="space-y-2 animate-in fade-in">
                                          {sortedTeams.map((t, idx) => {
                                              const isMe = t.id === activeLobbyView.id;
                                              const rank = idx + 1;
                                              return (
                                                  <div key={t.id} className={`flex items-center p-3 rounded-xl border ${isMe ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-800 border-slate-700'}`}>
                                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm mr-3 ${rank === 1 ? 'bg-yellow-500 text-black' : (rank === 2 ? 'bg-gray-300 text-black' : (rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-400'))}`}>
                                                          #{rank}
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                          <div className="flex items-center gap-2">
                                                              <span className={`text-xs font-black uppercase truncate ${isMe ? 'text-white' : 'text-slate-300'}`}>{t.name}</span>
                                                              {isMe && <span className="text-[8px] font-bold bg-purple-500 text-white px-1.5 rounded uppercase">YOU</span>}
                                                          </div>
                                                          <div className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">{t.members.length} AGENTS</div>
                                                      </div>
                                                      <div className="text-right">
                                                          <span className="block text-sm font-black text-white">{t.score}</span>
                                                          <span className="text-[8px] font-bold text-slate-500 uppercase">PTS</span>
                                                      </div>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  ) : (
                                      <>
                                          <div className="flex items-center gap-2 mb-4 px-1 sticky top-0 bg-slate-900/90 backdrop-blur-sm z-10 py-2 border-b border-white/5">
                                              <List className="w-4 h-4 text-orange-500" />
                                              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">MISSION LOG</h3>
                                          </div>

                                          <div className="space-y-4">
                                              {/* Bonus/Penalty Log */}
                                              {bonusIds.length > 0 && (
                                                  <CollapsibleSection
                                                      title="BONUS & PENALTIES"
                                                      icon={Star}
                                                      isOpen={true}
                                                      onToggle={() => {}}
                                                  >
                                                      <div className="space-y-1">
                                                          {bonusIds.map((id, i) => (
                                                              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
                                                                  <span className="text-[10px] font-bold uppercase truncate max-w-[70%] text-yellow-500">
                                                                      ADMIN ADJUSTMENT
                                                                  </span>
                                                                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                                      <CheckCircle className="w-3 h-3" /> APPLIED
                                                                  </div>
                                                              </div>
                                                          ))}
                                                      </div>
                                                  </CollapsibleSection>
                                              )}

                                              {/* Map Tasks Collapsible */}
                                              {mapTasks.length > 0 && (
                                                  <CollapsibleSection 
                                                    title="MAP TASKS" 
                                                    icon={MapPin} 
                                                    isOpen={!collapsedLogSections['map']} 
                                                    onToggle={() => setCollapsedLogSections(prev => ({...prev, 'map': !prev['map']}))}
                                                  >
                                                      <div className="space-y-1">
                                                          {mapTasks.map(renderTaskRow)}
                                                      </div>
                                                  </CollapsibleSection>
                                              )}

                                              {/* Playgrounds Collapsible */}
                                              {playgroundGroups.map(pg => (
                                                  <CollapsibleSection 
                                                    key={pg.id}
                                                    title={`ZONE: ${pg.title}`} 
                                                    icon={LayoutGrid} 
                                                    isOpen={!collapsedLogSections[pg.id]} 
                                                    onToggle={() => setCollapsedLogSections(prev => ({...prev, [pg.id]: !prev[pg.id]}))}
                                                  >
                                                      <div className="space-y-1">
                                                          {pg.points.map(renderTaskRow)}
                                                      </div>
                                                  </CollapsibleSection>
                                              ))}
                                          </div>
                                      </>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>

              {/* AVATAR CREATOR OVERLAY */}
              {showAvatarModal && (
                  <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
                      <div className="relative">
                          <button onClick={() => setShowAvatarModal(false)} className="absolute -top-12 right-0 text-white/50 hover:text-white p-2">
                              <X className="w-6 h-6" />
                          </button>
                          <AvatarCreator 
                              onConfirm={saveMemberAvatar}
                              onCancel={() => setShowAvatarModal(false)}
                          />
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // --- STANDARD GAME PICKER (Fallback) --- 
  return null;
};

export default TeamsModal;
