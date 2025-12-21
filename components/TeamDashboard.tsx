
import React, { useEffect, useState } from 'react';
import { Team, Game } from '../types';
import * as db from '../services/db';
import { X, Trophy, Target, CheckCircle, Users, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';

interface TeamDashboardProps {
  teamId?: string;
  gameId: string;
  totalMapPoints: number;
  onOpenAgents: () => void;
  onClose: () => void;
}

const TeamDashboard: React.FC<TeamDashboardProps> = ({ teamId, gameId, totalMapPoints, onOpenAgents, onClose }) => {
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [leaderboard, setLeaderboard] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const teams = await db.fetchTeams(gameId);
            const sorted = teams.sort((a, b) => b.score - a.score);
            setLeaderboard(sorted);
            
            // If teamId is provided, find that team. 
            // Otherwise (testing mode), default to the first team (leader).
            const myTeam = teamId 
                ? sorted.find(t => t.id === teamId) 
                : sorted[0];
                
            setCurrentTeam(myTeam || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [teamId, gameId]);

  if (loading && !currentTeam) {
      return (
        <div className="fixed inset-0 z-[2500] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      );
  }

  if (!currentTeam) {
      return (
        <div className="fixed inset-0 z-[2500] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-slate-500" />
                </div>
                <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest">NO TEAMS FOUND</h2>
                <p className="text-slate-400 mb-6 text-sm">Join or create a team to view the dashboard.</p>
                <button onClick={onClose} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl uppercase tracking-widest text-xs transition-colors">CLOSE</button>
            </div>
        </div>
      );
  }

  const myRankIndex = leaderboard.findIndex(t => t.id === currentTeam.id);
  const rank = myRankIndex + 1;
  
  const neighborAbove = leaderboard[myRankIndex - 1];
  const neighborBelow = leaderboard[myRankIndex + 1];

  const tasksCompleted = currentTeam.completedPointIds?.length || 0;

  return (
    <div className="fixed inset-0 z-[2500] bg-slate-950/95 backdrop-blur-md flex items-center justify-center sm:p-4 animate-in slide-in-from-bottom-10">
      <div className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-md flex flex-col bg-slate-900 border-x-0 border-y-0 sm:border border-slate-800 sm:rounded-3xl overflow-hidden shadow-2xl relative">
          {/* Header */}
          <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex flex-col">
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">TEAM ZONE</span>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider">{currentTeam.name}</h2>
              </div>
              <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Main Score Card */}
              <div className="bg-gradient-to-br from-orange-600 to-red-700 rounded-3xl p-6 text-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                  <div className="relative z-10">
                      <span className="text-xs font-black text-orange-200 uppercase tracking-widest block mb-2">CURRENT SCORE</span>
                      <h1 className="text-6xl font-black text-white tracking-tighter mb-4">{currentTeam.score}</h1>
                      <div className="inline-flex items-center gap-2 bg-black/20 px-4 py-1 rounded-full border border-white/10">
                          <Trophy className="w-4 h-4 text-yellow-400" />
                          <span className="text-xs font-bold text-white uppercase tracking-wide">RANK #{rank}</span>
                      </div>
                  </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col items-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <span className="text-2xl font-black text-white">
                          {tasksCompleted}/{totalMapPoints}
                      </span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">TASKS DONE</span>
                  </div>
                  <div 
                    onClick={onOpenAgents}
                    className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col items-center cursor-pointer hover:bg-slate-750 hover:border-orange-500/50 transition-all group"
                  >
                      <div className="relative">
                        <Users className="w-8 h-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-slate-800" />
                      </div>
                      <span className="text-2xl font-black text-white">{currentTeam.members.length}</span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-400 transition-colors">EDIT AGENTS</span>
                  </div>
              </div>

              {/* Leaderboard Snippet */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 text-center">COMPETITION INTEL</h3>
                  
                  <div className="space-y-4">
                      {neighborAbove ? (
                          <div className="flex items-center justify-between opacity-50">
                              <div className="flex items-center gap-3">
                                  <span className="font-mono font-bold text-slate-500">#{rank - 1}</span>
                                  <span className="font-bold text-slate-300 uppercase">{neighborAbove.name}</span>
                              </div>
                              <div className="flex items-center gap-1 text-green-500 text-xs font-bold">
                                  <ChevronUp className="w-4 h-4" /> {neighborAbove.score - currentTeam.score} PTS AHEAD
                              </div>
                          </div>
                      ) : (
                          <div className="text-center text-[10px] font-bold text-yellow-500 uppercase tracking-widest py-2">
                              👑 YOU ARE IN THE LEAD!
                          </div>
                      )}

                      <div className="bg-slate-700/50 p-3 rounded-xl flex items-center justify-between border border-orange-500/30">
                          <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-orange-500">#{rank}</span>
                              <span className="font-bold text-white uppercase">{currentTeam.name}</span>
                          </div>
                          <span className="font-black text-orange-500">{currentTeam.score}</span>
                      </div>

                      {neighborBelow && (
                          <div className="flex items-center justify-between opacity-50">
                              <div className="flex items-center gap-3">
                                  <span className="font-mono font-bold text-slate-500">#{rank + 1}</span>
                                  <span className="font-bold text-slate-300 uppercase">{neighborBelow.name}</span>
                              </div>
                              <div className="flex items-center gap-1 text-red-500 text-xs font-bold">
                                  <ChevronDown className="w-4 h-4" /> {currentTeam.score - neighborBelow.score} PTS BEHIND
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
          
          <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
              <button onClick={onClose} className="w-full py-4 bg-white text-slate-900 hover:bg-slate-200 font-black rounded-xl uppercase tracking-widest text-sm transition-colors">RETURN TO MAP</button>
          </div>
      </div>
    </div>
  );
};

export default TeamDashboard;
