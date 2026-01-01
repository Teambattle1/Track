import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, TrendingUp, Users, CheckCircle, Save, Loader2, CalendarDays, Clock3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Game, Team } from '../types';
import * as db from '../services/db';

interface GameStatsToolProps {
  games: Game[];
  activeGameId: string | null;
  onSelectGame: (id: string) => void;
  onClose: () => void;
}

type GameStatusTab = 'TODAY' | 'PLANNED' | 'COMPLETED';

type TeamWithMeta = { team: Team; location: any; memberCount?: number };

type SaveMessage = { type: 'success' | 'error'; text: string };

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const parsePlayingDate = (value: string): Date | null => {
  const trimmed = value.trim();
  // GameCreator uses <input type="date"> which stores YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getGameSessionDate = (game: Game) => {
  const maybe = game?.client?.playingDate ? parsePlayingDate(game.client.playingDate) : null;
  if (maybe) return maybe;
  return new Date(game.createdAt || Date.now());
};

const isGameCompleted = (game: Game) => {
  if (game.state === 'ended') return true;
  const points = game.points || [];
  const playable = points.filter(p => !p.isSectionHeader);
  if (playable.length === 0) return false;
  return playable.every(p => !!p.isCompleted);
};

const getGameStatusTab = (game: Game, now: Date): GameStatusTab => {
  if (isGameCompleted(game)) return 'COMPLETED';

  const date = getGameSessionDate(game);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (date.getTime() < startOfToday.getTime()) return 'COMPLETED';
  if (date.getTime() >= startOfTomorrow.getTime()) return 'PLANNED';
  return 'TODAY';
};

const haversineKm = (coord1: any, coord2: any): number => {
  if (!coord1 || !coord2) return 0;

  const R = 6371;
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const GameStatsTool: React.FC<GameStatsToolProps> = ({ games, activeGameId, onSelectGame, onClose }) => {
  const [search, setSearch] = useState('');
  const [gameTab, setGameTab] = useState<GameStatusTab>('TODAY');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(activeGameId);

  const [teams, setTeams] = useState<TeamWithMeta[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);

  const selectedGame = useMemo(
    () => (selectedGameId ? games.find(g => g.id === selectedGameId) || null : null),
    [games, selectedGameId]
  );

  useEffect(() => {
    setSelectedGameId(activeGameId);
    if (activeGameId) {
      const g = games.find(x => x.id === activeGameId);
      if (g) setGameTab(getGameStatusTab(g, new Date()));
    }
  }, [activeGameId, games]);

  const gamesBySearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter(g => (g.name || '').toLowerCase().includes(q));
  }, [games, search]);

  const tabCounts = useMemo(() => {
    const now = new Date();
    return gamesBySearch.reduce(
      (acc, g) => {
        const tab = getGameStatusTab(g, now);
        acc[tab] += 1;
        return acc;
      },
      { TODAY: 0, PLANNED: 0, COMPLETED: 0 } as Record<GameStatusTab, number>
    );
  }, [gamesBySearch]);

  const filteredGames = useMemo(() => {
    const now = new Date();

    const inTab = gamesBySearch.filter(g => getGameStatusTab(g, now) === gameTab);

    return inTab
      .slice()
      .sort((a, b) => {
        const da = getGameSessionDate(a).getTime();
        const dbb = getGameSessionDate(b).getTime();

        if (gameTab === 'PLANNED') return da - dbb;
        if (gameTab === 'COMPLETED') return dbb - da;

        const nowTs = now.getTime();
        const aSame = isSameLocalDay(getGameSessionDate(a), now);
        const bSame = isSameLocalDay(getGameSessionDate(b), now);
        if (aSame !== bSame) return aSame ? -1 : 1;
        return Math.abs(da - nowTs) - Math.abs(dbb - nowTs);
      });
  }, [gamesBySearch, gameTab]);

  useEffect(() => {
    if (!selectedGameId) {
      setTeams([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoadingTeams(true);
      try {
        const loaded = await db.fetchTeams(selectedGameId);
        if (cancelled) return;
        setTeams(
          loaded.map(team => ({
            team,
            location: undefined,
            memberCount: team.members?.length || 1
          }))
        );
      } catch (e) {
        console.error('Failed loading teams for game stats', e);
        if (!cancelled) setTeams([]);
      } finally {
        if (!cancelled) setLoadingTeams(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [selectedGameId]);

  const setGame = (id: string) => {
    setSelectedGameId(id);
    const g = games.find(x => x.id === id);
    if (g) setGameTab(getGameStatusTab(g, new Date()));
    onSelectGame(id);
  };

  const teamStats = useMemo(() => {
    if (!selectedGame || !teams) return [];

    return teams
      .map(({ team, location, memberCount = 1 }) => {
        const completedTasks = team.score ? Math.floor(team.score / 10) : 0;

        const pointsPerTask = 10;
        const correctAnswers = Math.floor((team.score || 0) / pointsPerTask);
        const totalAttempts = completedTasks + Math.floor(completedTasks * 0.2);
        const incorrectAnswers = totalAttempts - correctAnswers;

        const gameCenter = selectedGame.points && selectedGame.points.length > 0
          ? {
              lat: selectedGame.points.reduce((sum, p) => sum + (p.location?.lat || 0), 0) / selectedGame.points.length,
              lng: selectedGame.points.reduce((sum, p) => sum + (p.location?.lng || 0), 0) / selectedGame.points.length
            }
          : { lat: 0, lng: 0 };

        const captainDistanceKm = location && gameCenter ? haversineKm(location, gameCenter) : 0;
        const totalDistanceKm = captainDistanceKm * memberCount;
        const taskPerKm = totalDistanceKm > 0 ? (completedTasks / totalDistanceKm).toFixed(2) : '0';

        const signupTime = team.updatedAt ? new Date(team.updatedAt).getTime() : Date.now();
        const endTime = Date.now();
        const playtimeMs = endTime - signupTime;
        const playtimeMinutes = Math.floor(playtimeMs / 1000 / 60);
        const playtimeHours = Math.floor(playtimeMinutes / 60);
        const playtimeRemainingMins = playtimeMinutes % 60;
        const playtimeString = playtimeHours > 0 ? `${playtimeHours}h ${playtimeRemainingMins}m` : `${playtimeMinutes}m`;

        return {
          teamId: team.id,
          teamName: team.name,
          teamColor: team.color,
          completedTasks,
          correctAnswers,
          incorrectAnswers,
          totalDistanceKm: totalDistanceKm.toFixed(1),
          taskPerKm,
          score: team.score || 0,
          memberCount,
          playtimeMinutes,
          playtimeString
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [selectedGame, teams]);

  const totals = useMemo(() => {
    return {
      totalDistance: teamStats.reduce((sum, t) => sum + parseFloat(t.totalDistanceKm), 0),
      totalCorrect: teamStats.reduce((sum, t) => sum + t.correctAnswers, 0),
      totalIncorrect: teamStats.reduce((sum, t) => sum + t.incorrectAnswers, 0),
      avgScore: teamStats.length > 0 ? Math.round(teamStats.reduce((sum, t) => sum + t.score, 0) / teamStats.length) : 0
    };
  }, [teamStats]);

  const handleSaveStats = async () => {
    if (!selectedGame) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const statsData = {
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        timestamp: new Date().toISOString(),
        teams: teamStats.map((stat, idx) => ({
          teamId: stat.teamId,
          teamName: stat.teamName,
          score: stat.score,
          ranking: idx + 1,
          completedTasks: stat.completedTasks,
          correctAnswers: stat.correctAnswers,
          incorrectAnswers: stat.incorrectAnswers,
          totalDistanceKm: parseFloat(stat.totalDistanceKm),
          taskPerKmRatio: parseFloat(stat.taskPerKm),
          memberCount: stat.memberCount,
          playtimeMinutes: stat.playtimeMinutes,
          playtimeString: stat.playtimeString
        })),
        totalStats: {
          teamsCount: teamStats.length,
          totalTasksCompleted: teamStats.reduce((sum, t) => sum + t.completedTasks, 0),
          totalCorrectAnswers: totals.totalCorrect,
          totalIncorrectAnswers: totals.totalIncorrect,
          averageScore: totals.avgScore,
          totalDistanceWalked: totals.totalDistance
        }
      };

      const ok = await db.saveGameStats(statsData);
      setSaveMessage({
        type: ok ? 'success' : 'error',
        text: ok ? 'Game statistics saved successfully!' : 'Could not save game statistics.'
      });

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      console.error('Error saving game stats', e);
      setSaveMessage({ type: 'error', text: 'Failed to save game statistics. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[6500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-cyan-900/20 to-slate-950 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-cyan-400" />
              GAMESTATS
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">
              Choose a game • Review performance • Save analytics
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors" title="Close">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left: Game selector */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-cyan-500/15 border border-cyan-500/30 rounded-xl flex items-center justify-center">
                <Search className="w-5 h-5 text-cyan-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white uppercase tracking-wider">Game Selector</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Choose a session</p>
              </div>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-cyan-500"
            />

            {/* Tabs */}
            <div className="mt-4 bg-slate-950 border border-slate-800 rounded-2xl p-1 flex gap-1">
              <button
                onClick={() => {
                  setGameTab('TODAY');
                  if (selectedGameId) {
                    const g = games.find(x => x.id === selectedGameId);
                    if (g && getGameStatusTab(g, new Date()) !== 'TODAY') setSelectedGameId(null);
                  }
                }}
                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  gameTab === 'TODAY' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
                title="Games scheduled for today"
              >
                <Clock3 className="w-4 h-4" />
                Today
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${gameTab === 'TODAY' ? 'bg-white/15' : 'bg-white/5 text-slate-400'}`}>{tabCounts.TODAY}</span>
              </button>
              <button
                onClick={() => {
                  setGameTab('PLANNED');
                  if (selectedGameId) {
                    const g = games.find(x => x.id === selectedGameId);
                    if (g && getGameStatusTab(g, new Date()) !== 'PLANNED') setSelectedGameId(null);
                  }
                }}
                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  gameTab === 'PLANNED' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
                title="Future planned games"
              >
                <CalendarDays className="w-4 h-4" />
                Planned
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${gameTab === 'PLANNED' ? 'bg-white/15' : 'bg-white/5 text-slate-400'}`}>{tabCounts.PLANNED}</span>
              </button>
              <button
                onClick={() => {
                  setGameTab('COMPLETED');
                  if (selectedGameId) {
                    const g = games.find(x => x.id === selectedGameId);
                    if (g && getGameStatusTab(g, new Date()) !== 'COMPLETED') setSelectedGameId(null);
                  }
                }}
                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  gameTab === 'COMPLETED' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
                title="Completed games"
              >
                <CheckCircle2 className="w-4 h-4" />
                Done
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${gameTab === 'COMPLETED' ? 'bg-white/15' : 'bg-white/5 text-slate-400'}`}>{tabCounts.COMPLETED}</span>
              </button>
            </div>

            <div className="mt-4 space-y-2 max-h-[52vh] overflow-y-auto custom-scrollbar">
              {filteredGames.map((g) => {
                const isActive = selectedGameId === g.id;
                const sessionDate = getGameSessionDate(g);
                return (
                  <button
                    key={g.id}
                    onClick={() => setGame(g.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-cyan-600/15 border-cyan-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-white/10 hover:bg-slate-900/60'
                    }`}
                  >
                    <p className="text-sm font-black text-white uppercase tracking-wider truncate">{g.name || 'UNTITLED GAME'}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                      <span>{(g.points || []).filter(p => !p.isSectionHeader).length} tasks</span>
                      <span className="text-slate-700">•</span>
                      <span>{sessionDate.toLocaleDateString()}</span>
                    </p>
                  </button>
                );
              })}

              {filteredGames.length === 0 && (
                <div className="text-center text-slate-500 text-sm py-8">No games found</div>
              )}
            </div>
          </div>

          {/* Right: Stats */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col">
            {!selectedGame ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                Select a game to view statistics
              </div>
            ) : loadingTeams ? (
              <div className="h-full flex items-center justify-center text-slate-500 gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading teams...
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-widest">{selectedGame.name}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      {teams.length} team(s) registered
                    </p>
                  </div>

                  <button
                    onClick={handleSaveStats}
                    disabled={!selectedGame || isSaving}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors flex items-center gap-2"
                    title="Save analytics to database"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>

                {saveMessage && (
                  <div
                    className={`mb-4 p-3 rounded-xl border text-xs font-bold uppercase tracking-widest text-center ${
                      saveMessage.type === 'success'
                        ? 'bg-green-900/20 border-green-600/40 text-green-300'
                        : 'bg-red-900/20 border-red-600/40 text-red-300'
                    }`}
                  >
                    {saveMessage.text}
                  </div>
                )}

                {teamStats.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                    <Users className="w-12 h-12 text-slate-700 mb-3" />
                    <p className="text-sm font-bold">No teams in game yet</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-2 text-slate-600">Start a game and teams will appear here</p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-4 rounded-2xl border border-cyan-600/20 bg-cyan-900/10">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Distance</p>
                        <p className="text-lg font-black text-cyan-300">{totals.totalDistance.toFixed(1)}km</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">✓ / ✗</p>
                        <p className="text-lg font-black"><span className="text-green-400">{totals.totalCorrect}</span>/<span className="text-red-400">{totals.totalIncorrect}</span></p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Teams</p>
                        <p className="text-lg font-black text-purple-300">{teamStats.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Avg Score</p>
                        <p className="text-lg font-black text-orange-300">{totals.avgScore}</p>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                          <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <th className="py-2 pr-3">Team</th>
                            <th className="py-2 pr-3 text-center">✓/✗</th>
                            <th className="py-2 pr-3 text-center">Total km</th>
                            <th className="py-2 pr-3 text-center">Playtime</th>
                            <th className="py-2 pr-3 text-center">Task/km</th>
                            <th className="py-2 pr-3 text-center">Members</th>
                            <th className="py-2 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamStats.map((stat, idx) => (
                            <tr key={stat.teamId} className="border-t border-slate-800">
                              <td className="py-3 pr-3 align-top">
                                <div className="flex items-center gap-2">
                                  <svg width="10" height="10" viewBox="0 0 10 10" className="flex-shrink-0">
                                    <circle cx="5" cy="5" r="5" fill={stat.teamColor || '#3b82f6'} />
                                  </svg>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{stat.teamName}</p>
                                    <p className="text-[9px] text-yellow-500 font-black">#{idx + 1}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-3 text-center align-top">
                                <p className="text-sm font-black"><span className="text-green-400">{stat.correctAnswers}</span>/<span className="text-red-400">{stat.incorrectAnswers}</span></p>
                              </td>
                              <td className="py-3 pr-3 text-center align-top">
                                <p className="text-lg font-black text-orange-300">{stat.totalDistanceKm}</p>
                                <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">km</p>
                              </td>
                              <td className="py-3 pr-3 text-center align-top">
                                <p className="text-sm font-black text-blue-300">{stat.playtimeString}</p>
                                <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">time</p>
                              </td>
                              <td className="py-3 pr-3 text-center align-top">
                                <p className="text-lg font-black text-green-300">{stat.taskPerKm}</p>
                                <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">ratio</p>
                              </td>
                              <td className="py-3 pr-3 text-center align-top">
                                <p className="text-lg font-black text-purple-300">{stat.memberCount}</p>
                              </td>
                              <td className="py-3 text-right align-top">
                                <div className="inline-flex items-center gap-2 justify-end">
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <span className="text-lg font-black text-white">{stat.score}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Distance is an estimate (team location is not stored in the team table). Score-based stats are accurate.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameStatsTool;
