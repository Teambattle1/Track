import React, { useState, useEffect } from 'react';
import { X, Users, ArrowRight, ChevronDown, ChevronUp, RefreshCw, Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Team, TeamMemberData, Game } from '../types';
import * as db from '../services/db';
import GameChooserView from './GameChooserView';

interface TeamEditorModalProps {
  gameId: string | null;
  games: Game[];
  onClose: () => void;
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

const TeamEditorModal: React.FC<TeamEditorModalProps> = ({ gameId: initialGameId, games, onClose }) => {
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
      setExpandedTeamIds(new Set(data.map(t => t.id)));
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
      // Collect all existing team names and player names in this game session
      const existingTeamNames = new Set(teams.map(t => t.name.toLowerCase()));
      const existingPlayerNames = new Set(
        teams.flatMap(t => t.members.map(m => (m.name || '').toLowerCase()))
      );

      let created = 0;
      let skipped = 0;

      for (let i = 0; i < DEMO_TEAM_NAMES.length; i++) {
        if (existingTeamNames.has(DEMO_TEAM_NAMES[i].toLowerCase())) {
          skipped++;
          continue;
        }
        // Filter out members whose names already exist in the game
        const uniqueMembers: TeamMemberData[] = DEMO_MEMBERS[i]
          .filter(m => !existingPlayerNames.has(m.name.toLowerCase()))
          .map(m => ({ name: m.name, deviceId: m.deviceId }));

        if (uniqueMembers.length === 0) {
          skipped++;
          continue;
        }

        // Add these names to the set so subsequent teams don't reuse them
        uniqueMembers.forEach(m => existingPlayerNames.add(m.name.toLowerCase()));

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
        };
        await db.registerTeam(team);
        created++;
      }
      if (created > 0) {
        setSuccessMsg(`Created ${created} demo team${created !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
      } else {
        setSuccessMsg(`All demo teams already exist`);
      }
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
      setSuccessMsg(`Removed ${demoTeams.length} demo teams`);
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

      const updatedSourceMembers = sourceTeam.members.filter(
        m => m.deviceId !== movingMember.member.deviceId
      );
      const updatedTargetMembers = [...targetTeam.members, movingMember.member];

      await db.updateTeam(sourceTeam.id, { members: updatedSourceMembers });
      await db.updateTeam(targetTeam.id, { members: updatedTargetMembers });

      if (sourceTeam.captainDeviceId === movingMember.member.deviceId) {
        const newCaptain = updatedSourceMembers[0]?.deviceId || null;
        await db.updateTeam(sourceTeam.id, { captainDeviceId: newCaptain || undefined });
      }

      setTeams(prev => prev.map(t => {
        if (t.id === sourceTeam.id) return { ...t, members: updatedSourceMembers, captainDeviceId: t.captainDeviceId === movingMember.member.deviceId ? (updatedSourceMembers[0]?.deviceId || undefined) : t.captainDeviceId };
        if (t.id === targetTeam.id) return { ...t, members: updatedTargetMembers };
        return t;
      }));

      setSuccessMsg(`Moved ${movingMember.member.name} → ${targetTeam.name}`);
      setTimeout(() => setSuccessMsg(null), 2500);
      setMovingMember(null);
    } catch (err) {
      console.error('[TeamEditor] Error moving member:', err);
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
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-0.5">
                <button onClick={() => setSelectedGameId(null)} className="hover:text-orange-400 transition-colors">
                  {game?.name || 'Unknown Game'}
                </button>
                {' '}— {teams.length} teams
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
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                Moving <span className="text-white">{movingMember.member.name}</span> — click a team to transfer
              </span>
            </div>
            <button onClick={cancelMove} className="text-[10px] font-bold text-blue-400 hover:text-white uppercase tracking-wider transition-colors">
              Cancel
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
              <p className="text-sm font-bold text-slate-500 uppercase">No teams found</p>
              <p className="text-xs text-slate-600 mt-1 mb-6">No teams have joined this game yet.</p>
              <button
                onClick={seedDemoTeams}
                disabled={seeding}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
              >
                <Plus className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
                <span className="text-xs font-black uppercase tracking-wider">
                  {seeding ? 'Creating...' : 'Seed 3 Demo Teams'}
                </span>
              </button>
            </div>
          ) : (
            teams.map(team => {
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
                    className="w-full flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      {team.photoUrl ? (
                        <img src={team.photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700"
                             style={team.color ? { backgroundColor: team.color + '20', borderColor: team.color + '40' } : {}}>
                          <Users className="w-5 h-5 text-slate-500" style={team.color ? { color: team.color } : {}} />
                        </div>
                      )}
                      <div className="text-left">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          {team.name}
                          {isDemoTeam && <span className="ml-2 text-[8px] font-black text-yellow-500 uppercase">Demo</span>}
                        </h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                          {team.members.length} member{team.members.length !== 1 ? 's' : ''} · Score: {team.score}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTarget && (
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest animate-pulse">
                          Click to move here
                        </span>
                      )}
                      {!movingMember && (
                        isExpanded
                          ? <ChevronUp className="w-4 h-4 text-slate-600" />
                          : <ChevronDown className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                  </button>

                  {/* Members list */}
                  {isExpanded && !movingMember && (
                    <div className="px-4 pb-4 space-y-1.5">
                      {team.members.length === 0 ? (
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider text-center py-3">No members</p>
                      ) : (
                        team.members.map(member => (
                          <div
                            key={member.deviceId}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              {member.photo ? (
                                <img src={member.photo} alt="" className="w-7 h-7 rounded-lg object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center">
                                  <span className="text-[10px] font-black text-slate-400">{(member.name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-xs font-bold text-slate-300">{member.name || 'Unknown'}</span>
                                {team.captainDeviceId === member.deviceId && (
                                  <span className="ml-2 text-[8px] font-black text-amber-500 uppercase tracking-widest">Captain</span>
                                )}
                              </div>
                            </div>
                            {teams.length > 1 && (
                              <button
                                onClick={() => startMove(member, team.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/50 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/40 text-slate-500 hover:text-blue-400 transition-all"
                                title={`Move ${member.name} to another team`}
                              >
                                <ArrowRight className="w-3 h-3" />
                                <span className="text-[8px] font-black uppercase tracking-wider">Move</span>
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamEditorModal;
