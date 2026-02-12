import React, { useState, useEffect } from 'react';
import { X, Users, ArrowRight, ChevronDown, ChevronUp, RefreshCw, Check, AlertCircle, Plus, Trash2, Crown, ExternalLink, Key, Copy } from 'lucide-react';
import { Team, TeamMemberData, Game } from '../types';
import * as db from '../services/db';
import GameChooserView from './GameChooserView';
import { generateTeamShortCode } from '../utils/teamUtils';

interface TeamEditorModalProps {
  gameId: string | null;
  games: Game[];
  onClose: () => void;
  onOpenLobby?: (teamId: string) => void;
}

const DEMO_TEAM_NAMES = ['Alpha Squad', 'Bravo Unit', 'Charlie Force'];
const DEMO_MEMBERS: { name: string; deviceId: string }[][] = [
  [
    { name: 'Emma Nielsen', deviceId: 'demo-a1' },
    { name: 'Oscar Berg', deviceId: 'demo-a2' },
    { name: 'Ida Larsen', deviceId: 'demo-a3' },
  ],
  [
    { name: 'Noah Jensen', deviceId: 'demo-b1' },
    { name: 'Freja Hansen', deviceId: 'demo-b2' },
    { name: 'William Olsen', deviceId: 'demo-b3' },
    { name: 'Alma Petersen', deviceId: 'demo-b4' },
  ],
  [
    { name: 'Lucas Andersen', deviceId: 'demo-c1' },
    { name: 'Sofia Madsen', deviceId: 'demo-c2' },
  ],
];

const LS_KEY = 'teamtrack_lastEditorGameId';

const TeamEditorModal: React.FC<TeamEditorModalProps> = ({ gameId: initialGameId, games, onClose, onOpenLobby }) => {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(() => {
    // Priority: prop > localStorage > first game
    if (initialGameId) return initialGameId;
    const stored = localStorage.getItem(LS_KEY);
    if (stored && games.some(g => g.id === stored)) return stored;
    return null;
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
  const [movingMember, setMovingMember] = useState<{ member: TeamMemberData; fromTeamId: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<Record<string, string>>({}); // deviceId -> code
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteConfirmTeamId, setDeleteConfirmTeamId] = useState<string | null>(null);

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
      // Auto-assign captain for teams that have members but no captain
      for (const team of data) {
        if (team.members.length > 0 && !team.captainDeviceId) {
          team.captainDeviceId = team.members[0].deviceId;
          await db.updateTeam(team.id, { captainDeviceId: team.captainDeviceId });
        }
      }
      setTeams(data);
      setExpandedTeamIds(new Set(data.map(t => t.id)));
      // Load recovery codes
      try {
        const codes = await db.fetchRecoveryCodesForGame(gId);
        const codeMap: Record<string, string> = {};
        for (const c of codes) {
          codeMap[c.deviceId] = c.code;
        }
        setRecoveryCodes(codeMap);
      } catch (e) {
        console.error('[TeamEditor] Error loading recovery codes:', e);
      }
    } catch (err) {
      console.error('[TeamEditor] Error loading teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const seedDemoTeams = async () => {
    if (!selectedGameId) return;
    setSeeding(true);
    try {
      // Remove existing demo teams first so re-seed always gives fresh data
      const oldDemoTeams = teams.filter(t => t.id.startsWith('demo-team-'));
      if (oldDemoTeams.length > 0) {
        const { supabase } = await import('../lib/supabase');
        for (const t of oldDemoTeams) {
          await supabase.from('teams').delete().eq('id', t.id);
        }
      }

      // Collect all remaining (non-demo) player names in this game session
      const remainingTeams = teams.filter(t => !t.id.startsWith('demo-team-'));
      const existingPlayerNames = new Set(
        remainingTeams.flatMap(t => t.members.map(m => (m.name || '').toLowerCase()).filter(n => n))
      );

      let created = 0;
      const existingCodes = teams.map(t => t.shortCode).filter(Boolean) as string[];

      for (let i = 0; i < DEMO_TEAM_NAMES.length; i++) {
        // Filter out members whose names already exist in real teams
        const uniqueMembers: TeamMemberData[] = DEMO_MEMBERS[i]
          .filter(m => !existingPlayerNames.has(m.name.toLowerCase()))
          .map(m => ({ name: m.name, deviceId: m.deviceId }));

        if (uniqueMembers.length === 0) continue;

        // Track names so subsequent demo teams don't reuse them
        uniqueMembers.forEach(m => existingPlayerNames.add(m.name.toLowerCase()));

        const shortCode = generateTeamShortCode(existingCodes);
        existingCodes.push(shortCode);

        const teamId = `demo-team-${Date.now()}-${i}`;
        const team: Team = {
          id: teamId,
          gameId: selectedGameId,
          name: DEMO_TEAM_NAMES[i],
          joinCode: String(100000 + Math.floor(Math.random() * 900000)),
          members: uniqueMembers,
          score: Math.floor(Math.random() * 500),
          updatedAt: new Date().toISOString(),
          captainDeviceId: uniqueMembers[0].deviceId,
          isStarted: true,
          completedPointIds: [],
          shortCode,
        };
        await db.registerTeam(team);
        created++;
      }
      setSuccessMsg(created > 0 ? `SEEDED ${created} DEMO TEAMS` : 'NO DEMO TEAMS CREATED');
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadTeams(selectedGameId);
    } catch (err) {
      console.error('[TeamEditor] Error seeding demo teams:', err);
    } finally {
      setSeeding(false);
    }
  };

  const removeDemoTeams = async () => {
    setSaving(true);
    try {
      const demoTeams = teams.filter(t => t.id.startsWith('demo-team-'));
      for (const team of demoTeams) {
        const { supabase } = await import('../lib/supabase');
        await supabase.from('teams').delete().eq('id', team.id);
      }
      setSuccessMsg(`REMOVED ${demoTeams.length} DEMO TEAMS`);
      setTimeout(() => setSuccessMsg(null), 3000);
      if (selectedGameId) await loadTeams(selectedGameId);
    } catch (err) {
      console.error('[TeamEditor] Error removing demo teams:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (teamId: string) => {
    setExpandedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const startMove = (member: TeamMemberData, fromTeamId: string) => {
    setMovingMember({ member, fromTeamId });
  };

  const cancelMove = () => {
    setMovingMember(null);
  };

  const confirmMove = async (toTeamId: string) => {
    if (!movingMember || movingMember.fromTeamId === toTeamId) return;

    setSaving(true);
    try {
      const sourceTeam = teams.find(t => t.id === movingMember.fromTeamId);
      const targetTeam = teams.find(t => t.id === toTeamId);
      if (!sourceTeam || !targetTeam) return;

      const wasCaptain = sourceTeam.captainDeviceId === movingMember.member.deviceId;

      const updatedSourceMembers = sourceTeam.members.filter(
        m => m.deviceId !== movingMember.member.deviceId
      );
      const updatedTargetMembers = [...targetTeam.members, movingMember.member];

      // Source: update members
      await db.updateTeam(sourceTeam.id, { members: updatedSourceMembers });
      // Target: update members (mover does NOT become captain on target)
      await db.updateTeam(targetTeam.id, { members: updatedTargetMembers });

      // Source: if moved player was captain, auto-promote first remaining member
      let newSourceCaptain = sourceTeam.captainDeviceId;
      if (wasCaptain) {
        newSourceCaptain = updatedSourceMembers[0]?.deviceId || undefined;
        await db.updateTeam(sourceTeam.id, { captainDeviceId: newSourceCaptain });
      }

      // Target: if team had no captain, auto-assign the existing first member (not the mover)
      let newTargetCaptain = targetTeam.captainDeviceId;
      if (!newTargetCaptain || !updatedTargetMembers.some(m => m.deviceId === newTargetCaptain)) {
        newTargetCaptain = updatedTargetMembers[0]?.deviceId || undefined;
        await db.updateTeam(targetTeam.id, { captainDeviceId: newTargetCaptain });
      }

      setTeams(prev => prev.map(t => {
        if (t.id === sourceTeam.id) return { ...t, members: updatedSourceMembers, captainDeviceId: newSourceCaptain };
        if (t.id === targetTeam.id) return { ...t, members: updatedTargetMembers, captainDeviceId: newTargetCaptain };
        return t;
      }));

      setSuccessMsg(`MOVED ${(movingMember.member.name || 'PLAYER').toUpperCase()} → ${targetTeam.name.toUpperCase()}`);
      setTimeout(() => setSuccessMsg(null), 2500);
      setMovingMember(null);
    } catch (err) {
      console.error('[TeamEditor] Error moving member:', err);
    } finally {
      setSaving(false);
    }
  };

  const setCaptain = async (teamId: string, deviceId: string, memberName: string) => {
    setSaving(true);
    try {
      await db.updateTeam(teamId, { captainDeviceId: deviceId });
      setTeams(prev => prev.map(t =>
        t.id === teamId ? { ...t, captainDeviceId: deviceId } : t
      ));
      setSuccessMsg(`${memberName || 'PLAYER'} IS NOW CAPTAIN`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error('[TeamEditor] Error setting captain:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteTeam = async (teamId: string) => {
    setSaving(true);
    try {
      const team = teams.find(t => t.id === teamId);
      const { supabase } = await import('../lib/supabase');
      await supabase.from('teams').delete().eq('id', teamId);
      setTeams(prev => prev.filter(t => t.id !== teamId));
      setDeleteConfirmTeamId(null);
      setSuccessMsg(`DELETED ${(team?.name || 'TEAM').toUpperCase()}`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error('[TeamEditor] Error deleting team:', err);
    } finally {
      setSaving(false);
    }
  };

  const hasDemoTeams = teams.some(t => t.id.startsWith('demo-team-'));

  // ========== GAME CHOOSER VIEW ==========
  if (!selectedGameId) {
    return (
      <GameChooserView
        games={games}
        title="SELECT GAME"
        subtitle="Choose a game to edit teams"
        accentColor="orange"
        onSelectGame={(id) => setSelectedGameId(id)}
        onClose={onClose}
      />
    );
  }

  // ========== TEAM EDITOR VIEW ==========
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-2xl max-h-[85vh] rounded-[2rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,1)] flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d]/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
              <Users className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">EDIT TEAMS</h2>
              <p className="text-sm text-slate-300 font-black uppercase tracking-wider mt-0.5">
                <span className="text-slate-500">GAME: </span>
                <button onClick={() => setSelectedGameId(null)} className="text-orange-400 hover:text-orange-300 transition-colors">
                  {game?.name || 'Unknown Game'}
                </button>
                <span className="text-slate-500"> — {teams.length} TEAMS</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasDemoTeams && (
              <button
                onClick={removeDemoTeams}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition-colors disabled:opacity-50"
                title="Remove demo teams"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-wider">Demo</span>
              </button>
            )}
            <button
              onClick={seedDemoTeams}
              disabled={seeding}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20 transition-colors disabled:opacity-50"
              title="Add demo teams"
            >
              <Plus className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-wider">Seed</span>
            </button>
            <button onClick={() => selectedGameId && loadTeams(selectedGameId)} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors" title="Refresh">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Moving banner */}
        {movingMember && (
          <div className="px-6 py-3 bg-blue-600/20 border-b border-blue-500/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="text-xs font-black text-blue-300 uppercase tracking-wider">
                MOVING <span className="text-white">{(movingMember.member.name || 'PLAYER').toUpperCase()}</span> — CLICK A TEAM TO TRANSFER
              </span>
            </div>
            <button onClick={cancelMove} className="text-[10px] font-black text-blue-400 hover:text-white uppercase tracking-widest transition-colors">
              CANCEL
            </button>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="px-6 py-2.5 bg-emerald-600/20 border-b border-emerald-500/30 flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">{successMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-slate-600 animate-spin" />
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-sm font-black text-slate-500 uppercase tracking-wider">NO TEAMS FOUND</p>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1 mb-6">NO TEAMS HAVE JOINED THIS GAME YET</p>
              <button
                onClick={seedDemoTeams}
                disabled={seeding}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
              >
                <Plus className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
                <span className="text-xs font-black uppercase tracking-widest">
                  {seeding ? 'CREATING...' : 'SEED 3 DEMO TEAMS'}
                </span>
              </button>
            </div>
          ) : (
            [...teams].sort((a, b) => a.name.localeCompare(b.name)).map(team => {
              const isExpanded = expandedTeamIds.has(team.id);
              const isSource = movingMember?.fromTeamId === team.id;
              const isTarget = movingMember && movingMember.fromTeamId !== team.id;
              const isDemoTeam = team.id.startsWith('demo-team-');

              return (
                <div
                  key={team.id}
                  className={`rounded-2xl border transition-all ${
                    isTarget
                      ? 'border-blue-500/50 bg-blue-600/10 cursor-pointer hover:bg-blue-600/20 hover:border-blue-400/60'
                      : isSource
                      ? 'border-orange-500/30 bg-orange-600/5'
                      : 'border-slate-800 bg-slate-900/50'
                  }`}
                  onClick={() => isTarget ? confirmMove(team.id) : undefined}
                >
                  {/* Team header */}
                  <button
                    onClick={(e) => {
                      if (isTarget) { e.stopPropagation(); confirmMove(team.id); return; }
                      toggleExpand(team.id);
                    }}
                    className={`w-full flex items-center justify-between ${movingMember ? 'p-5' : 'p-4'}`}
                  >
                    <div className={`flex items-center ${movingMember ? 'gap-4' : 'gap-3'}`}>
                      {team.photoUrl ? (
                        <img src={team.photoUrl} alt="" className={`${movingMember ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl object-cover border border-slate-700`} />
                      ) : (
                        <div className={`${movingMember ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700`}
                             style={team.color ? { backgroundColor: team.color + '20', borderColor: team.color + '40' } : {}}>
                          <Users className={`${movingMember ? 'w-6 h-6' : 'w-5 h-5'} text-slate-500`} style={team.color ? { color: team.color } : {}} />
                        </div>
                      )}
                      <div className="text-left">
                        <h3 className={`${movingMember ? 'text-lg' : 'text-lg'} font-black text-white uppercase tracking-wider`}>
                          {team.name}
                          {isDemoTeam && <span className="ml-2 text-[8px] font-black text-yellow-500 uppercase">DEMO</span>}
                        </h3>
                        <p className={`${movingMember ? 'text-sm' : 'text-sm'} font-black uppercase tracking-widest mt-0.5`}
                           style={team.color ? { color: team.color } : { color: '#94a3b8' }}>
                          {team.members.length} {team.members.length !== 1 ? 'MEMBERS' : 'MEMBER'} · {team.score} PTS
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTarget && (
                        <span className="text-xs font-black text-white uppercase tracking-widest animate-pulse">
                          MOVE HERE →
                        </span>
                      )}
                      {isSource && (
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                          SOURCE
                        </span>
                      )}
                      {!movingMember && (
                        <>
                          {onOpenLobby && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onOpenLobby(team.id); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-400 hover:bg-purple-600/20 hover:border-purple-500/40 transition-all"
                              title="Open team lobby"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="text-[8px] font-black uppercase tracking-wider">LOBBY</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmTeamId(team.id); }}
                            className="p-1.5 rounded-lg hover:bg-red-600/20 text-slate-600 hover:text-red-400 transition-all"
                            title="Delete team"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-slate-600" />
                            : <ChevronDown className="w-4 h-4 text-slate-600" />
                          }
                        </>
                      )}
                    </div>
                  </button>

                  {/* Members list */}
                  {isExpanded && !movingMember && (
                    <div className="px-4 pb-4 space-y-1.5">
                      {team.members.length === 0 ? (
                        <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest text-center py-3">NO MEMBERS</p>
                      ) : (
                        [...team.members].sort((a, b) => {
                          if (a.deviceId === team.captainDeviceId) return -1;
                          if (b.deviceId === team.captainDeviceId) return 1;
                          return (a.name || '').localeCompare(b.name || '');
                        }).map(member => {
                          const isCaptain = team.captainDeviceId === member.deviceId;
                          return (
                            <div
                              key={member.deviceId}
                              className={`flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border transition-colors ${isCaptain ? 'border-amber-500/30' : 'border-slate-800 hover:border-slate-700'}`}
                            >
                              <div className="flex items-center gap-2.5">
                                {member.photo ? (
                                  <img src={member.photo} alt="" className="w-7 h-7 rounded-lg object-cover" />
                                ) : (
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isCaptain ? 'bg-amber-600/20' : 'bg-slate-700'}`}>
                                    <span className={`text-[10px] font-black ${isCaptain ? 'text-amber-400' : 'text-slate-400'}`}>{(member.name || '?').charAt(0).toUpperCase()}</span>
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center">
                                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider">{(member.name || 'UNKNOWN').toUpperCase()}</span>
                                    {isCaptain && (
                                      <span className="ml-2 text-[8px] font-black text-amber-500 uppercase tracking-widest">CAPTAIN</span>
                                    )}
                                  </div>
                                  {recoveryCodes[member.deviceId] && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const code = recoveryCodes[member.deviceId];
                                        navigator.clipboard.writeText(code).catch(() => {});
                                        setCopiedCode(code);
                                        setTimeout(() => setCopiedCode(null), 2000);
                                      }}
                                      className="flex items-center gap-1 mt-0.5 group/code"
                                      title="Click to copy recovery code"
                                    >
                                      <Key className="w-2.5 h-2.5 text-green-500/60" />
                                      <span className="text-[9px] font-mono font-bold text-green-500/60 tracking-wider group-hover/code:text-green-400 transition-colors">{recoveryCodes[member.deviceId]}</span>
                                      {copiedCode === recoveryCodes[member.deviceId] ? (
                                        <Check className="w-2.5 h-2.5 text-green-400" />
                                      ) : (
                                        <Copy className="w-2.5 h-2.5 text-slate-600 group-hover/code:text-green-400 transition-colors" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {!isCaptain && (
                                  <button
                                    onClick={() => setCaptain(team.id, member.deviceId, member.name || 'UNKNOWN')}
                                    disabled={saving}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/50 hover:bg-amber-600/20 border border-slate-700 hover:border-amber-500/40 text-slate-500 hover:text-amber-400 transition-all disabled:opacity-50"
                                    title={`Make ${member.name} captain`}
                                  >
                                    <Crown className="w-3 h-3" />
                                    <span className="text-[8px] font-black uppercase tracking-wider">CAPTAIN</span>
                                  </button>
                                )}
                                {teams.length > 1 && (
                                  <button
                                    onClick={() => startMove(member, team.id)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/50 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/40 text-slate-500 hover:text-blue-400 transition-all"
                                    title={`Move ${member.name} to another team`}
                                  >
                                    <ArrowRight className="w-3 h-3" />
                                    <span className="text-[8px] font-black uppercase tracking-wider">MOVE</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Delete confirmation dialog */}
        {deleteConfirmTeamId && (() => {
          const teamToDelete = teams.find(t => t.id === deleteConfirmTeamId);
          if (!teamToDelete) return null;
          return (
            <div className="fixed inset-0 z-[6000] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border-2 border-red-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="text-center mb-4">
                  <div className="w-14 h-14 bg-red-500/20 rounded-full mx-auto flex items-center justify-center mb-3 border-2 border-red-500/30">
                    <Trash2 className="w-7 h-7 text-red-400" />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-widest">DELETE TEAM</h3>
                  <p className="text-2xl font-black text-red-400 uppercase tracking-wider mt-1">
                    {teamToDelete.name}?
                  </p>
                </div>

                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 mb-4">
                  <p className="text-xs text-red-300 font-bold text-center leading-relaxed">
                    This will permanently delete this team, all {teamToDelete.members.length} member(s), and their game progress. This cannot be undone.
                  </p>
                </div>

                {teamToDelete.score > 0 && (
                  <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-3 mb-4">
                    <p className="text-xs text-orange-300 font-bold text-center">
                      This team has {teamToDelete.score} points! Are you sure?
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={() => deleteTeam(deleteConfirmTeamId)}
                    disabled={saving}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {saving ? 'DELETING...' : 'DELETE TEAM'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmTeamId(null)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default TeamEditorModal;
