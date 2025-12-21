
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Game, Team, TeamMember, Coordinate } from '../types';
import { X, Users, MessageSquare, Send, RefreshCw, Radio, MapPin, CheckCircle, Trophy, ListChecks, Plus, Minus, Gamepad2 } from 'lucide-react';
import * as db from '../services/db';
import { teamSync } from '../services/teamSync';
import GameMap, { GameMapHandle } from './GameMap';
import PlaygroundModal from './PlaygroundModal';

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
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null); // null = All Teams
  const [sending, setSending] = useState(false);
  const [viewTab, setViewTab] = useState<'MAP' | 'LIST'>('MAP');
  
  // Track location history for tails (Last 5 mins)
  const [locationHistory, setLocationHistory] = useState<Record<string, LocationHistoryItem[]>>({});
  
  // Interactive Modal State
  const [showTeamControl, setShowTeamControl] = useState(false);
  const [controlTab, setControlTab] = useState<'CHAT' | 'SCORE' | 'TASKS'>('CHAT');
  const [scoreDelta, setScoreDelta] = useState(100);

  // Playground state for Instructor
  const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(null);

  const mapRef = useRef<GameMapHandle>(null);

  const loadTeams = async () => {
      setLoading(true);
      try {
          const data = await db.fetchTeams(game.id);
          setTeams(data);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadTeams();
      // Listen for presence to update locations
      const unsubscribe = teamSync.subscribeToMembers((members) => {
          setOnlineMembers(members);
          updateLocationHistory(members);
      });
      // Auto-refresh teams data (scores/progress) every 10s
      const interval = setInterval(loadTeams, 10000);
      
      return () => {
          clearInterval(interval);
          unsubscribe();
      };
  }, [game.id]);

  // Update history buffer
  const updateLocationHistory = (members: TeamMember[]) => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      setLocationHistory(prev => {
          const next = { ...prev };
          
          // For each online member, find their team and push location
          members.forEach(m => {
              if (!m.location) return;
              
              // Find team for this member (Checking local state 'teams')
              // Note: teams state might be stale if new team just joined, but it refreshes every 10s
              // We rely on polling for team structure
              const team = teams.find(t => t.members.includes(m.userName));
              if (team) {
                  if (!next[team.id]) next[team.id] = [];
                  
                  // Avoid duplicate pushes if location hasn't changed effectively (simple check)
                  const lastLoc = next[team.id][next[team.id].length - 1];
                  if (!lastLoc || lastLoc.lat !== m.location.lat || lastLoc.lng !== m.location.lng) {
                      next[team.id].push({ ...m.location, timestamp: now });
                  }
              }
          });

          // Prune old history
          Object.keys(next).forEach(teamId => {
              next[teamId] = next[teamId].filter(loc => loc.timestamp > fiveMinutesAgo);
          });

          return next;
      });
  };

  // Aggregate team locations (current)
  const teamLocations = useMemo(() => {
      const locs: { team: Team, location: Coordinate }[] = [];
      
      teams.forEach(team => {
          // Find online members for this team
          const teamOnlineMembers = onlineMembers.filter(m => team.members.includes(m.userName) && m.location);
          
          if (teamOnlineMembers.length > 0) {
              // Calculate average location
              const avgLat = teamOnlineMembers.reduce((sum, m) => sum + (m.location?.lat || 0), 0) / teamOnlineMembers.length;
              const avgLng = teamOnlineMembers.reduce((sum, m) => sum + (m.location?.lng || 0), 0) / teamOnlineMembers.length;
              
              locs.push({
                  team: team,
                  location: { lat: avgLat, lng: avgLng }
              });
          }
      });
      return locs;
  }, [teams, onlineMembers]);

  // Transform history to simple coordinate arrays for Map
  const teamTrails = useMemo(() => {
      const trails: Record<string, Coordinate[]> = {};
      Object.keys(locationHistory).forEach(teamId => {
          trails[teamId] = locationHistory[teamId].map(h => ({ lat: h.lat, lng: h.lng }));
      });
      return trails;
  }, [locationHistory]);

  // Calculate Map Point Statistics (X/Y Labels)
  const pointStats = useMemo(() => {
      const stats: Record<string, string> = {};
      const totalTeams = teams.length;
      
      game.points.forEach(point => {
          // Count how many teams have this point ID in completedPointIds
          const visitedCount = teams.filter(t => t.completedPointIds?.includes(point.id)).length;
          stats[point.id] = `${visitedCount}/${totalTeams}`;
      });
      
      return stats;
  }, [game.points, teams]);

  const handleSendMessage = () => {
      if (!broadcastMsg.trim()) return;
      setSending(true);
      
      teamSync.sendChatMessage(game.id, broadcastMsg, selectedTeamId);

      setTimeout(() => {
          setBroadcastMsg('');
          setSending(false);
          if (!selectedTeamId) alert("Message sent to ALL teams!");
      }, 500);
  };

  const handleUpdateScore = async (delta: number) => {
      if (selectedTeamId) {
          await db.updateTeamScore(selectedTeamId, delta);
          loadTeams(); // Refresh immediately
      }
  };

  const handleTeamClickOnMap = (teamId: string) => {
      setSelectedTeamId(teamId);
      setShowTeamControl(true);
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const visiblePlaygrounds = game.playgrounds?.filter(p => p.buttonVisible) || [];

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
            <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            
            {/* Left: Map / List Toggle */}
            <div className="flex-1 relative flex flex-col">
                <div className="absolute top-4 left-4 z-[1000] flex gap-2">
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
                        Team List
                    </button>
                </div>

                {viewTab === 'MAP' ? (
                    <div className="flex-1 bg-slate-800 relative">
                        <GameMap 
                            ref={mapRef}
                            userLocation={null} // Instructor doesn't need their own location centered
                            points={game.points}
                            teams={teamLocations}
                            teamTrails={teamTrails} // Pass movement history
                            pointLabels={pointStats}
                            accuracy={null}
                            mode={2 as any} // INSTRUCTOR Mode
                            mapStyle="osm"
                            onPointClick={() => {}} // Could show task details if needed
                            onTeamClick={handleTeamClickOnMap}
                        />
                        
                        {/* Instructor Playground Controls */}
                        {visiblePlaygrounds.length > 0 && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex gap-4 pointer-events-auto items-end">
                                {visiblePlaygrounds.map(pg => (
                                    <button
                                        key={pg.id}
                                        onClick={() => setActivePlaygroundId(pg.id)}
                                        className={`h-20 w-20 rounded-3xl flex items-center justify-center transition-all border-4 group relative overflow-hidden ${pg.iconUrl ? 'bg-white border-white' : 'bg-gradient-to-br from-purple-600 to-indigo-600 border-white/30'} shadow-2xl hover:scale-105`}
                                    >
                                        {pg.iconUrl ? (
                                            <img src={pg.iconUrl} className="w-full h-full object-cover" alt={pg.title} />
                                        ) : (
                                            <Gamepad2 className="w-10 h-10 text-white" />
                                        )}
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none backdrop-blur-sm border border-white/10">
                                            {pg.title}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 bg-slate-900 overflow-y-auto p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {teams.map(team => (
                                <div 
                                    key={team.id} 
                                    onClick={() => handleTeamClickOnMap(team.id)}
                                    className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm hover:border-orange-500 cursor-pointer transition-all"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-slate-700 rounded-lg overflow-hidden">
                                                {team.photoUrl ? <img src={team.photoUrl} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-slate-500 mx-auto mt-3"/>}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-lg leading-none">{team.name}</h3>
                                                <span className="text-xs text-orange-500 font-bold">{team.score} PTS</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-slate-700 pt-3 flex flex-wrap gap-1">
                                        {team.members.map((m, i) => (
                                            <span key={i} className="text-[10px] bg-slate-900 text-slate-300 px-2 py-1 rounded">{m}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Broadcast Center (Always visible on desktop, hidden if modal open on mobile) */}
            <div className="hidden md:flex w-80 bg-slate-800 border-l border-slate-700 flex-col z-20 shadow-2xl">
                <div className="p-6 bg-slate-900 border-b border-slate-700">
                    <h3 className="font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" /> BROADCAST
                    </h3>
                    <p className="text-xs text-slate-400">SEND TO ALL TEAMS</p>
                </div>
                <div className="p-6 flex flex-col gap-4 flex-1">
                    <textarea 
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        placeholder="Message all teams..."
                        className="w-full h-32 bg-slate-900 border-2 border-slate-700 rounded-xl p-4 text-white focus:border-orange-500 outline-none resize-none text-sm"
                    />
                    <button 
                        onClick={() => { setSelectedTeamId(null); handleSendMessage(); }}
                        disabled={!broadcastMsg.trim() || sending}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black uppercase rounded-xl flex items-center justify-center gap-2"
                    >
                        {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        SEND TO ALL
                    </button>
                </div>
            </div>
        </div>

        {/* TEAM INTERACTION MODAL */}
        {showTeamControl && selectedTeam && (
            <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]">
                    
                    {/* Modal Header */}
                    <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">{selectedTeam.name}</h2>
                            <p className="text-xs text-orange-500 font-bold uppercase tracking-wide">SCORE: {selectedTeam.score}</p>
                        </div>
                        <button onClick={() => setShowTeamControl(false)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-800 bg-slate-900">
                        <button onClick={() => setControlTab('CHAT')} className={`flex-1 py-4 text-xs font-bold uppercase border-b-2 transition-colors ${controlTab === 'CHAT' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500 hover:text-white'}`}>
                            <MessageSquare className="w-4 h-4 mx-auto mb-1" /> CHAT
                        </button>
                        <button onClick={() => setControlTab('SCORE')} className={`flex-1 py-4 text-xs font-bold uppercase border-b-2 transition-colors ${controlTab === 'SCORE' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-500 hover:text-white'}`}>
                            <Trophy className="w-4 h-4 mx-auto mb-1" /> SCORE
                        </button>
                        <button onClick={() => setControlTab('TASKS')} className={`flex-1 py-4 text-xs font-bold uppercase border-b-2 transition-colors ${controlTab === 'TASKS' ? 'border-green-500 text-green-500' : 'border-transparent text-slate-500 hover:text-white'}`}>
                            <ListChecks className="w-4 h-4 mx-auto mb-1" /> TASKS
                        </button>
                    </div>

                    {/* Modal Content */}
                    <div className="p-6 bg-slate-900 flex-1 overflow-y-auto">
                        
                        {/* CHAT TAB */}
                        {controlTab === 'CHAT' && (
                            <div className="flex flex-col gap-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">SEND MESSAGE TO {selectedTeam.name}</label>
                                <textarea 
                                    value={broadcastMsg}
                                    onChange={(e) => setBroadcastMsg(e.target.value)}
                                    placeholder={`Type message for ${selectedTeam.name}...`}
                                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:border-blue-500 outline-none resize-none"
                                />
                                <button 
                                    onClick={handleSendMessage}
                                    disabled={!broadcastMsg.trim() || sending}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide"
                                >
                                    <Send className="w-4 h-4" /> SEND
                                </button>
                            </div>
                        )}

                        {/* SCORE TAB */}
                        {controlTab === 'SCORE' && (
                            <div className="flex flex-col gap-6 items-center py-6">
                                <div className="text-center">
                                    <div className="text-6xl font-black text-white mb-2">{selectedTeam.score}</div>
                                    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">CURRENT POINTS</span>
                                </div>
                                
                                <div className="w-full bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 block text-center">ADJUST SCORE</label>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => handleUpdateScore(-scoreDelta)} className="p-4 bg-red-600/20 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-colors border border-red-600/50">
                                            <Minus className="w-6 h-6" />
                                        </button>
                                        <div className="flex-1">
                                            <input 
                                                type="number" 
                                                value={scoreDelta} 
                                                onChange={(e) => setScoreDelta(parseInt(e.target.value) || 0)}
                                                className="w-full text-center bg-slate-900 border border-slate-600 rounded-xl py-3 text-white font-bold text-xl outline-none focus:border-orange-500"
                                            />
                                        </div>
                                        <button onClick={() => handleUpdateScore(scoreDelta)} className="p-4 bg-green-600/20 text-green-500 rounded-xl hover:bg-green-600 hover:text-white transition-colors border border-green-600/50">
                                            <Plus className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <div className="flex justify-between mt-4">
                                        <button onClick={() => handleUpdateScore(-500)} className="text-xs text-red-400 font-bold hover:text-white">-500</button>
                                        <button onClick={() => handleUpdateScore(500)} className="text-xs text-green-400 font-bold hover:text-white">+500</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TASKS TAB */}
                        {controlTab === 'TASKS' && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">TASK HISTORY</p>
                                {game.points.filter(p => !p.isSectionHeader).map(point => {
                                    const isSolved = selectedTeam.completedPointIds?.includes(point.id);
                                    return (
                                        <div key={point.id} className={`p-3 rounded-xl border flex items-center justify-between ${isSolved ? 'bg-green-900/20 border-green-800' : 'bg-slate-800 border-slate-700'}`}>
                                            <span className={`text-sm font-bold truncate pr-4 ${isSolved ? 'text-white' : 'text-slate-500'}`}>
                                                {point.title}
                                            </span>
                                            {isSolved ? (
                                                <div className="flex items-center gap-1 text-green-500 text-xs font-bold uppercase bg-green-900/40 px-2 py-1 rounded">
                                                    <CheckCircle className="w-3 h-3" /> Solved
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-600 font-bold uppercase">Pending</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        )}

        {/* Instructor Playground Viewer */}
        {activePlaygroundId && (
            <PlaygroundModal 
                playground={game.playgrounds?.find(p => p.id === activePlaygroundId)!}
                points={game.points}
                onClose={() => setActivePlaygroundId(null)}
                onPointClick={() => {}} // Instructor just views, no interaction needed usually
                mode={2 as any} // INSTRUCTOR
            />
        )}
    </div>
  );
};

export default InstructorDashboard;
