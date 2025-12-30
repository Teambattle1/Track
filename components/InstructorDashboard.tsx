import React, { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Game, Team, TeamMember, Coordinate, GameMode, TeamStatus } from '../types';
import { X, Users, Eye, EyeOff, ToggleLeft, ToggleRight, Edit2, Gamepad2, Shield, User, Power, AlertTriangle, Loader2, BookOpen, CheckCircle } from 'lucide-react';
import * as db from '../services/db';
import { teamSync } from '../services/teamSync';
import GameMap, { GameMapHandle } from './GameMap';
import PlaygroundModal from './PlaygroundModal';
import LocationSearch from './LocationSearch';
import { ICON_COMPONENTS } from '../utils/icons';
import { haversineMeters } from '../utils/geo';

interface InstructorDashboardProps {
  game: Game;
  onClose: () => void;
  onSetMode: (mode: GameMode) => void;
  mode?: GameMode;
}

interface LocationHistoryItem extends Coordinate {
    timestamp: number;
}

const InstructorDashboard: React.FC<InstructorDashboardProps> = ({ game, onClose, onSetMode, mode }) => {
  const [liveGame, setLiveGame] = useState<Game>(game);

  useEffect(() => {
      setLiveGame(game);
  }, [game.id, game.dbUpdatedAt]);

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
  const [terminating, setTerminating] = useState(false);

  // Instructor Notes State
  const [notesRead, setNotesRead] = useState<boolean>(() => {
    const readNotes = localStorage.getItem('instructorNotesRead');
    if (readNotes) {
      const parsed = JSON.parse(readNotes);
      return parsed[game.id] || false;
    }
    return false;
  });

  const markNotesAsRead = () => {
    const readNotes = localStorage.getItem('instructorNotesRead');
    const parsed = readNotes ? JSON.parse(readNotes) : {};
    parsed[game.id] = true;
    localStorage.setItem('instructorNotesRead', JSON.stringify(parsed));
    setNotesRead(true);
  };

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
      // PERFORMANCE: Increased from 10s to 15s to reduce server load
      const interval = setInterval(loadTeams, 15000);
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
      await db.saveGame({ ...liveGame, showOtherTeams: newVal });
  };

  const toggleShowRanking = async () => {
      const newVal = !showRanking;
      setShowRanking(newVal);
      const updatedAt = new Date().toISOString();
      const updatedGame = { ...liveGame, showRankingToPlayers: newVal, dbUpdatedAt: updatedAt };
      await db.saveGame(updatedGame);
      setLiveGame(updatedGame);
  }

  const handleModeCycle = () => {
      onSetMode(GameMode.PLAY);
  };

  const handleTerminateGame = async () => {
      if (confirm("Are you sure you want to END THE GAME? This will trigger a 60s countdown for all players and then hide all tasks.")) {
          setTerminating(true);
          // Set state to 'ending' and countdown target to now + 60s
          const updatedAt = new Date().toISOString();
          const updatedGame = {
              ...liveGame,
              state: 'ending' as const,
              endingAt: Date.now() + 60000,
              dbUpdatedAt: updatedAt
          };
          await db.saveGame(updatedGame);
          setLiveGame(updatedGame);
          setTerminating(false);
          alert("Countdown started! Game will end in 60 seconds.");
      }
  };

  // Calculate detailed stats per team
  const getTeamStats = (team: Team, index: number) => {
      const completedIds = team.completedPointIds || [];
      const mapTasks = liveGame.points.filter(p => !p.playgroundId && !p.isSectionHeader);
      const mapSolved = mapTasks.filter(p => completedIds.includes(p.id)).length;

      const playgroundStats = (liveGame.playgrounds || []).map(pg => {
          const zoneTasks = liveGame.points.filter(p => p.playgroundId === pg.id);
          const solved = zoneTasks.filter(p => completedIds.includes(p.id)).length;
          return {
              name: pg.title,
              solved,
              total: zoneTasks.length
          };
      });

      return {
          rank: index + 1,
          mapSolved,
          mapTotal: mapTasks.length,
          playgroundStats
      };
  };

  const teamLocations = useMemo(() => {
      if (!showTeams) return [];
      // Sort teams for ranking logic
      const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

      const locs: { 
          team: Team, 
          location: Coordinate, 
          status: TeamStatus,
          stats: any 
      }[] = [];
      
      sortedTeams.forEach((team, index) => {
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
                  status: status,
                  stats: getTeamStats(team, index)
              });
          }
      });
      return locs;
  }, [teams, onlineMembers, showTeams, locationHistory, liveGame.points, liveGame.playgrounds]);

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
      liveGame.points.forEach(p => {
          if (!p.location) return;
          const addLinks = (trigger: 'onOpen' | 'onCorrect' | 'onIncorrect', color: string) => {
              const actions = p.logic?.[trigger];
              actions?.forEach(action => {
                  if ((action.type === 'unlock' || action.type === 'reveal') && action.targetId) {
                      const target = liveGame.points.find(tp => tp.id === action.targetId);
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
  }, [liveGame.points, showTasks]);

  const dependentPointIds = useMemo(() => {
      const targets = new Set<string>();
      liveGame.points.forEach(p => {
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
  }, [liveGame.points]);

  const pointStats = useMemo(() => {
      const stats: Record<string, string> = {};
      const totalTeams = teams.length;
      liveGame.points.forEach(point => {
          const visitedCount = teams.filter(t => t.completedPointIds?.includes(point.id)).length;
          stats[point.id] = `${visitedCount}/${totalTeams}`;
      });
      return stats;
  }, [liveGame.points, teams]);

  const handleUpdateScore = async (delta: number) => {
      if (selectedTeamId) {
          await db.updateTeamScore(selectedTeamId, delta);
          loadTeams();
      }
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const selectedPoint = liveGame.points.find(p => p.id === selectedPointId);
  const visiblePoints = showTasks ? liveGame.points : [];
  const visiblePlaygrounds = liveGame.playgrounds?.filter(p => p.buttonVisible) || [];
  const activePlayground = liveGame.playgrounds?.find(p => p.id === activePlaygroundId);

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
                    GAME: <span className="text-white">{liveGame.name}</span>
                </p>
            </div>
            
            <div className="flex items-center gap-2">
                {viewTab === 'MAP' && (
                    <div className="flex gap-2 mx-4 hidden xl:flex items-center">
                        <button 
                            onClick={handleTerminateGame}
                            disabled={terminating || liveGame.state === 'ending' || liveGame.state === 'ended'}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border text-xs font-black uppercase transition-colors ${liveGame.state === 'ended' ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-red-600 border-red-500 text-white hover:bg-red-700'} shadow-lg`}
                        >
                            {terminating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                            {liveGame.state === 'ending' ? 'ENDING...' : (liveGame.state === 'ended' ? 'GAME ENDED' : 'TERMINATE GAME')}
                        </button>

                        <div className="h-6 w-px bg-slate-700 mx-2"></div>

                        <button 
                            onClick={() => setShowTeams(!showTeams)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${showTeams ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                        >
                            {showTeams ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} TEAMS
                        </button>
                        <button 
                            onClick={() => setShowTasks(!showTasks)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${showTasks ? 'bg-orange-900/30 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                        >
                            {showTasks ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} TASKS
                        </button>
                        
                        <div className="h-6 w-px bg-slate-700 mx-2"></div>

                        <button 
                            onClick={toggleShowOtherTeams}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${showOtherTeams ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                            title="Enable to let teams see each other on their maps"
                        >
                            {showOtherTeams ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />} 
                            SHOW ALL TEAMS
                        </button>

                        <button 
                            onClick={toggleShowRanking}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase transition-colors ${showRanking ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
                            title="Show/Hide Ranking List for Players"
                        >
                            {showRanking ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />} 
                            REVEAL RANKING
                        </button>
                    </div>
                )}

                {/* Avatar / Mode Toggle (Desktop Only) */}
                <div className="hidden lg:block mr-2">
                    <button 
                        onClick={handleModeCycle}
                        className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center border-2 border-slate-700 hover:border-white transition-all shadow-lg overflow-hidden group"
                        title="Toggle Mode (Instructor -> Play)"
                    >
                        <Shield className="w-5 h-5 text-white" />
                    </button>
                </div>

                <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>

        {/* Instructor Notes Banner */}
        {game.instructorNotes && !notesRead && (
            <div className="bg-blue-900/30 border-b border-blue-500/50 p-4 animate-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wide">Notes for Instructor</h3>
                            <button
                                onClick={markNotesAsRead}
                                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-colors"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Mark as Read
                            </button>
                        </div>
                        <div
                            className="text-sm text-blue-100 prose prose-invert prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(game.instructorNotes) }}
                        />
                    </div>
                </div>
            </div>
        )}

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
                            onTeamClick={(teamId) => {
                                setSelectedTeamId(teamId);
                            }}
                            selectedPointId={selectedPointId}
                            onPointMove={async (id: string, loc: { lat: number; lng: number }) => {
                                const plainLoc = { lat: loc.lat, lng: loc.lng };
                                const updated = await db.updateGameItemLocation(liveGame.id, id, plainLoc, {
                                    user: 'Instructor',
                                    action: 'Moved Item'
                                });
                                if (!updated) return;
                                setLiveGame(updated);
                            }}
                        />
                        
                        {/* Instructor Map Tools - Zoom / Locate */}
                        <div className="absolute top-4 right-4 z-[1000] pointer-events-auto">
                            <LocationSearch 
                                onSelectLocation={(c) => mapRef.current?.jumpTo(c)} 
                                onLocateMe={() => { /* Instructor usually doesn't need to locate self, but useful for testing */ }}
                                onFitBounds={() => mapRef.current?.fitBounds(liveGame.points)}
                                hideSearch={true}
                                className="h-10"
                                labelButtons={true}
                            />
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
                                        <p className="text-sm text-slate-200" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedPoint.task.question) }} />
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
                        {/* List View Content (Leaderboard) ... same as before ... */}
                    </div>
                )}
            </div>
        </div>

        {/* ... (Team Control Modal and Playground Modal logic remains same) ... */}
        {/* Instructor Playground Viewer */}
        {activePlaygroundId && activePlayground && (
            <PlaygroundModal 
                playground={activePlayground}
                points={liveGame.points}
                onClose={() => setActivePlaygroundId(null)}
                onPointClick={() => {}} 
                mode={GameMode.INSTRUCTOR}
            />
        )}
    </div>
  );
};

export default InstructorDashboard;
