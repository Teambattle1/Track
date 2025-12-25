
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Game, Team, TeamMember, Coordinate, GamePoint, GameMode, TeamStatus } from '../types';
import { X, Users, Eye, EyeOff, CheckCircle, Trophy, Minus, Plus, ToggleLeft, ToggleRight, Radio, Crown } from 'lucide-react';
import * as db from '../services/db';
import { teamSync } from '../services/teamSync';
import GameMap, { GameMapHandle } from './GameMap';
import PlaygroundModal from './PlaygroundModal';
import { ICON_COMPONENTS } from '../utils/icons';
import { haversineMeters } from '../utils/geo';

interface InstructorDashboardProps {
  game: Game;
  onClose: () => void;
}

interface LocationHistoryItem extends Coordinate {
    timestamp: number;
}

const InstructorDashboard: React.FC<InstructorDashboardProps> = ({ game, onClose }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [viewTab, setViewTab] = useState<'MAP' | 'LIST'>('MAP');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  
  // Visibility Toggles
  const [showTeams, setShowTeams] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  
  // New Toggle: Show Teams to Teams
  const [showOtherTeams, setShowOtherTeams] = useState(game.showOtherTeams || false);
  const [showRanking, setShowRanking] = useState(game.showRankingToPlayers || false);

  // Track location history for tails and speed calculation
  const [locationHistory, setLocationHistory] = useState<Record<string, LocationHistoryItem[]>>({});
  
  // Interactive Modal State (for Map clicks)
  const [showTeamControl, setShowTeamControl] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [scoreDelta, setScoreDelta] = useState(100);

  // Playground state for Instructor
  const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(null);

  const mapRef = useRef<GameMapHandle>(null);

  const loadTeams = async () => {
      setLoading(true);
      try {
          const data = await db.fetchTeams(game.id);
          const sorted = data.sort((a, b) => b.score - a.score);
          setTeams(sorted);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadTeams();
      const unsubscribe = teamSync.subscribeToMembers((members) => {
          setOnlineMembers(members);
          updateLocationHistory(members);
      });
      const interval = setInterval(loadTeams, 10000);
      return () => {
          clearInterval(interval);
          unsubscribe();
      };
  }, [game.id]);

  const updateLocationHistory = (members: TeamMember[]) => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      setLocationHistory(prev => {
          const next = { ...prev };
          members.forEach(m => {
              if (!m.location) return;
              // Find which team this member belongs to
              const team = teams.find(t => t.members.some(mem => mem.name === m.userName || mem.deviceId === m.deviceId));
              
              if (team) {
                  // Only track if this member is the captain (or first member if no captain)
                  const isCaptain = team.captainDeviceId 
                      ? team.captainDeviceId === m.deviceId 
                      : team.members[0]?.deviceId === m.deviceId;

                  if (isCaptain) {
                      if (!next[team.id]) next[team.id] = [];
                      const lastLoc = next[team.id][next[team.id].length - 1];
                      // Simple de-dupe
                      if (!lastLoc || lastLoc.lat !== m.location.lat || lastLoc.lng !== m.location.lng) {
                          next[team.id].push({ ...m.location, timestamp: now });
                      }
                  }
              }
          });
          // Cleanup old history
          Object.keys(next).forEach(teamId => {
              next[teamId] = next[teamId].filter(loc => loc.timestamp > fiveMinutesAgo);
          });
          return next;
      });
  };

  const toggleShowOtherTeams = async () => {
      const newVal = !showOtherTeams;
      setShowOtherTeams(newVal);
      // Persist setting
      await db.saveGame({ ...game, showOtherTeams: newVal });
  };

  const toggleShowRanking = async () => {
      const newVal = !showRanking;
      setShowRanking(newVal);
      await db.saveGame({ ...game, showRankingToPlayers: newVal });
  }

  const teamLocations = useMemo(() => {
      if (!showTeams) return [];
      const locs: { team: Team, location: Coordinate, status: TeamStatus }[] = [];
      
      teams.forEach(team => {
          // Identify Captain
          const captainId = team.captainDeviceId || (team.members.length > 0 ? team.members[0].deviceId : null);
          if (!captainId) return;

          const captainMember = onlineMembers.find(m => m.deviceId === captainId);
          if (captainMember && captainMember.location) {
              
              // Calculate Status
              let status: TeamStatus = 'idle';
              
              if (captainMember.isSolving) {
                  status = 'solving';
              } else {
                  // Check movement in last 20 seconds
                  const history = locationHistory[team.id] || [];
                  const recentMoves = history.filter(h => Date.now() - h.timestamp < 20000);
                  
                  if (recentMoves.length >= 2) {
                      const dist = haversineMeters(recentMoves[0], recentMoves[recentMoves.length - 1]);
                      // If moved more than 5 meters in 20 seconds, consider moving
                      if (dist > 5) status = 'moving';
                  }
              }

              locs.push({ 
                  team: team, 
                  location: captainMember.location,
                  status: status
              });
          }
      });
      return locs;
  }, [teams, onlineMembers, showTeams, locationHistory]);

  // Trails only for Captains
  const teamTrails = useMemo(() => {
      if (!showTeams) return {};
      const trails: Record<string, Coordinate[]> = {};
      Object.keys(locationHistory).forEach(teamId => {
          trails[teamId] = locationHistory[teamId].map(h => ({ lat: h.lat, lng: h.lng }));
      });
      return trails;
  }, [locationHistory, showTeams]);

  // ... (Logic Links and Dependent Points logic remains unchanged)
  const logicLinks = useMemo(() => {
      if (!showTasks) return [];
      const links: { from: Coordinate; to: Coordinate; color?: string; type?: 'onOpen' | 'onCorrect' | 'onIncorrect' }[] = [];
      game.points.forEach(p => {
          if (!p.location) return;
          const addLinks = (trigger: 'onOpen' | 'onCorrect' | 'onIncorrect', color: string) => {
              const actions = p.logic?.[trigger];
              actions?.forEach(action => {
                  if ((action.type === 'unlock' || action.type === 'reveal') && action.targetId) {
                      const target = game.points.find(tp => tp.id === action.targetId);
                      if (target && target.location) {
                          links.push({ from: p.location, to: target.location, color, type: trigger });
                      }
                  }
              });
          };
          addLinks('onOpen', '#eab308');
          addLinks('onCorrect', '#22c55e');
          addLinks('onIncorrect', '#ef4444');
      });
      return links;
  }, [game.points, showTasks]);

  const dependentPointIds = useMemo(() => {
      const targets = new Set<string>();
      game.points.forEach(p => {
          ['onOpen', 'onCorrect', 'onIncorrect'].forEach((trigger) => {
              const actions = p.logic?.[trigger as keyof typeof p.logic];
              actions?.forEach(action => {
                  if ((action.type === 'unlock' || action.type === 'reveal') && action.targetId) {
                      targets.add(action.targetId);
                  }
              });
          });
      });
      return Array.from(targets);
  }, [game.points]);

  const pointStats = useMemo(() => {
      const stats: Record<string, string> = {};
      const totalTeams = teams.length;
      game.points.forEach(point => {
          const visitedCount = teams.filter(t => t.completedPointIds?.includes(point.id)).length;
          stats[point.id] = `${visitedCount}/${totalTeams}`;
      });
      return stats;
  }, [game.points, teams]);

  const handleUpdateScore = async (delta: number) => {
      if (selectedTeamId) {
          await db.updateTeamScore(selectedTeamId, delta);
          loadTeams();
      }
  };

  const handleTeamClickOnMap = (teamId: string) => {
      setSelectedTeamId(teamId);
      setShowTeamControl(true);
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const selectedPoint = game.points.find(p => p.id === selectedPointId);
  const visiblePoints = showTasks ? game.points : [];
  const visiblePlaygrounds = game.playgrounds?.filter(p => p.buttonVisible) || [];
  const activePlayground = game.playgrounds?.find(p => p.id === activePlaygroundId);

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900 text-white flex flex-col animate-in fade-in duration-300">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center shadow-lg z-10">
            <div>
                <h1 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                    <Users className="w-6 h-6 text-orange-500" />
                    INSTRUCTOR DASHBOARD
                </h1>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mt-1">
                    GAME: <span className="text-white">{game.name}</span>
                </p>
            </div>
            
            {viewTab === 'MAP' && (
                <div className="flex gap-2 mx-4 hidden md:flex items-center">
                    <button 
                        onClick={() => setShowTeams(!showTeams)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${showTeams ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                    >
                        {showTeams ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} TEAMS
                    </button>
                    <button 
                        onClick={() => setShowTasks(!showTasks)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${showTasks ? 'bg-orange-900/30 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                    >
                        {showTasks ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} TASKS
                    </button>
                    
                    <div className="h-6 w-px bg-slate-700 mx-2"></div>

                    <button 
                        onClick={toggleShowOtherTeams}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${showOtherTeams ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                        title="Enable to let teams see each other on their maps"
                    >
                        {showOtherTeams ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />} 
                        VIS TEAMS TIL TEAMS
                    </button>

                    <button 
                        onClick={toggleShowRanking}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${showRanking ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                        title="Show/Hide Ranking List for Players"
                    >
                        {showRanking ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />} 
                        REVEAL RANKING TO TEAMS
                    </button>
                </div>
            )}

            <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            
            <div className="flex-1 relative flex flex-col">
                <div className="absolute top-4 left-4 z-[1000] flex gap-2 pointer-events-auto">
                    <button 
                        onClick={() => setViewTab('MAP')} 
                        className={`px-4 py-2 rounded-lg font-bold text-xs uppercase shadow-lg ${viewTab === 'MAP' ? 'bg-orange-600 text-white' : 'bg-white text-slate-800'}`}
                    >
                        Map View
                    </button>
                    <button 
                        onClick={() => setViewTab('LIST')} 
                        className={`px-4 py-2 rounded-lg font-bold text-xs uppercase shadow-lg ${viewTab === 'LIST' ? 'bg-orange-600 text-white' : 'bg-white text-slate-800'}`}
                    >
                        Leaderboard
                    </button>
                </div>

                {viewTab === 'MAP' ? (
                    <div className="flex-1 bg-slate-800 relative">
                        <GameMap 
                            ref={mapRef}
                            userLocation={null}
                            points={visiblePoints}
                            teams={teamLocations}
                            teamTrails={teamTrails}
                            pointLabels={pointStats}
                            logicLinks={logicLinks}
                            dependentPointIds={dependentPointIds}
                            accuracy={null}
                            mode={GameMode.INSTRUCTOR} 
                            mapStyle="osm"
                            onPointClick={(p) => setSelectedPointId(p.id)} 
                            onTeamClick={handleTeamClickOnMap}
                            selectedPointId={selectedPointId}
                        />
                        
                        {/* Legend for Status */}
                        <div className="absolute top-16 right-4 z-[1000] bg-slate-900/90 p-3 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md pointer-events-none">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">STATUS LEGEND</h4>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500 border border-white animate-pulse"></div>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">MOVING</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white"></div>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">SOLVING TASK</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">IDLE / STANDING</span>
                                </div>
                            </div>
                        </div>

                        {visiblePlaygrounds.length > 0 && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex gap-4 pointer-events-auto items-end">
                                {visiblePlaygrounds.map(pg => {
                                    const iconId = pg.iconId || 'default';
                                    const Icon = ICON_COMPONENTS[iconId];
                                    return (
                                        <button
                                            key={pg.id}
                                            onClick={() => setActivePlaygroundId(pg.id)}
                                            style={{ width: pg.buttonSize || 80, height: pg.buttonSize || 80 }}
                                            className={`rounded-3xl flex items-center justify-center transition-all border-4 group relative overflow-hidden ${pg.iconUrl ? 'bg-white border-white' : 'bg-gradient-to-br from-purple-600 to-indigo-600 border-white/30'} shadow-2xl hover:scale-105`}
                                        >
                                            {pg.iconUrl ? <img src={pg.iconUrl} className="w-full h-full object-cover" alt={pg.title} /> : <Icon className="w-1/2 h-1/2 text-white" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {selectedPoint && (
                            <div className="absolute bottom-0 left-0 right-0 z-[1100] bg-slate-900 border-t border-orange-500 rounded-t-3xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-black uppercase tracking-wide">{selectedPoint.points} PTS</span>
                                        </div>
                                        <h3 className="text-lg font-black text-white uppercase">{selectedPoint.title}</h3>
                                    </div>
                                    <button onClick={() => setSelectedPointId(null)} className="p-1 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-slate-800 p-3 rounded-xl">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">QUESTION / TASK</p>
                                        <p className="text-sm text-slate-200" dangerouslySetInnerHTML={{ __html: selectedPoint.task.question }} />
                                    </div>
                                    <div className="bg-green-900/20 border border-green-800 p-3 rounded-xl">
                                        <p className="text-[10px] font-bold text-green-500 uppercase mb-1">SOLUTION</p>
                                        <p className="text-sm font-bold text-green-300">
                                            {selectedPoint.task.answer || selectedPoint.task.correctAnswers?.join(', ') || selectedPoint.task.range?.correctValue || "No explicit answer"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 bg-slate-900 overflow-y-auto p-6 pt-16">
                        <div className="grid grid-cols-1 gap-4">
                            {teams.map((team, index) => (
                                <div key={team.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm flex items-center gap-4">
                                    <div className="flex flex-col items-center justify-center w-12 shrink-0">
                                        <Trophy className={`w-6 h-6 mb-1 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-700' : 'text-slate-600'}`} />
                                        <span className="text-xs font-black text-slate-500">#{index + 1}</span>
                                    </div>
                                    <div className="w-12 h-12 bg-slate-700 rounded-lg overflow-hidden shrink-0">
                                        {team.photoUrl ? <img src={team.photoUrl} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-slate-500 mx-auto mt-3"/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white text-lg leading-none">{team.name}</h3>
                                        <p className="text-xs text-slate-400 font-medium uppercase mt-1">{team.members.length} Members &bull; {team.completedPointIds?.length || 0} Solved</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-xl font-black text-orange-500 block">{team.score}</span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">POINTS</span>
                                    </div>
                                    <button onClick={() => { setSelectedTeamId(team.id); setShowTeamControl(true); }} className="p-2 bg-slate-700 hover:bg-white/10 rounded-lg transition-colors text-slate-300">
                                        <Eye className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* TEAM CONTROL MODAL */}
        {showTeamControl && selectedTeam && (
            <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                        <h2 className="text-lg font-black text-white uppercase tracking-wider">{selectedTeam.name}</h2>
                        <button onClick={() => setShowTeamControl(false)} className="p-1 bg-slate-800 rounded-full hover:bg-slate-700 text-white"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-6 bg-slate-900 space-y-6">
                        <div className="text-center">
                            <div className="text-5xl font-black text-white mb-2">{selectedTeam.score}</div>
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">CURRENT SCORE</span>
                        </div>
                        <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <button onClick={() => handleUpdateScore(-scoreDelta)} className="p-3 bg-red-600/20 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-colors"><Minus className="w-5 h-5" /></button>
                            <input 
                                type="number" 
                                value={scoreDelta} 
                                onChange={(e) => setScoreDelta(parseInt(e.target.value) || 0)}
                                className="w-full text-center bg-transparent text-white font-bold text-lg outline-none"
                            />
                            <button onClick={() => handleUpdateScore(scoreDelta)} className="p-3 bg-green-600/20 text-green-500 rounded-lg hover:bg-green-600 hover:text-white transition-colors"><Plus className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Instructor Playground Viewer */}
        {activePlaygroundId && activePlayground && (
            <PlaygroundModal 
                playground={activePlayground}
                points={game.points}
                onClose={() => setActivePlaygroundId(null)}
                onPointClick={() => {}} 
                mode={GameMode.INSTRUCTOR}
            />
        )}
    </div>
  );
};

export default InstructorDashboard;
