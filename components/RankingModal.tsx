import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, X, Crown, Star, Target } from 'lucide-react';
import { Team } from '../types';

interface RankingModalProps {
    isOpen: boolean;
    onClose: () => void;
    teams: Team[];
}

interface TeamWithRank extends Team {
    rank: number;
    points: number;
}

const RankingModal: React.FC<RankingModalProps> = ({ isOpen, onClose, teams }) => {
    const [rankedTeams, setRankedTeams] = useState<TeamWithRank[]>([]);

    useEffect(() => {
        if (!teams) return;

        // Calculate points and rank teams
        const teamsWithPoints = teams.map(team => ({
            ...team,
            points: team.completedPoints?.length || 0
        }));

        // Sort by points (descending) and assign ranks
        const sorted = teamsWithPoints.sort((a, b) => b.points - a.points);
        const ranked = sorted.map((team, index) => ({
            ...team,
            rank: index + 1
        }));

        setRankedTeams(ranked);
    }, [teams]);

    if (!isOpen) return null;

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className="w-12 h-12 text-yellow-400" />;
            case 2:
                return <Medal className="w-10 h-10 text-gray-400" />;
            case 3:
                return <Award className="w-10 h-10 text-amber-600" />;
            default:
                return <Star className="w-8 h-8 text-slate-400" />;
        }
    };

    const getRankColor = (rank: number) => {
        switch (rank) {
            case 1:
                return 'from-yellow-600 to-amber-700 border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.4)]';
            case 2:
                return 'from-gray-500 to-slate-600 border-gray-400 shadow-[0_0_30px_rgba(156,163,175,0.3)]';
            case 3:
                return 'from-amber-700 to-orange-800 border-amber-600 shadow-[0_0_30px_rgba(217,119,6,0.3)]';
            default:
                return 'from-slate-700 to-slate-800 border-slate-600';
        }
    };

    const getPositionText = (rank: number) => {
        switch (rank) {
            case 1:
                return '1ST PLACE';
            case 2:
                return '2ND PLACE';
            case 3:
                return '3RD PLACE';
            default:
                return `${rank}TH PLACE`;
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
            
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 shadow-2xl z-10"
                title="Close Ranking"
            >
                <X className="w-7 h-7" />
            </button>

            {/* Content */}
            <div className="w-full max-w-6xl relative">
                {/* Header */}
                <div className="text-center mb-12 animate-in slide-in-from-top duration-500">
                    <div className="w-24 h-24 bg-gradient-to-br from-yellow-500 to-amber-700 rounded-full flex items-center justify-center mx-auto mb-6 border-8 border-white/20 shadow-2xl">
                        <Trophy className="w-14 h-14 text-white" />
                    </div>
                    <h1 className="text-7xl font-black text-white uppercase tracking-widest mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                        RANKINGS
                    </h1>
                    <p className="text-2xl text-slate-400 font-bold uppercase tracking-wider">Live Leaderboard</p>
                </div>

                {/* Rankings Grid */}
                <div className="space-y-4 max-h-[60vh] overflow-y-auto px-2 pb-4">
                    {rankedTeams.map((team, index) => (
                        <div
                            key={team.id}
                            className={`relative bg-gradient-to-r ${getRankColor(team.rank)} border-4 rounded-3xl p-6 transition-all hover:scale-[1.02] animate-in slide-in-from-left duration-500`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex items-center justify-between">
                                {/* Rank & Icon */}
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col items-center">
                                        {getRankIcon(team.rank)}
                                        <span className="text-xs font-black text-white/70 uppercase tracking-widest mt-1">
                                            {getPositionText(team.rank)}
                                        </span>
                                    </div>

                                    {/* Team Info */}
                                    <div>
                                        <h2 className="text-4xl font-black text-white uppercase tracking-wider mb-1">
                                            {team.name || `Team ${team.id.substring(0, 6)}`}
                                        </h2>
                                        <div className="flex items-center gap-2">
                                            <Target className="w-4 h-4 text-white/60" />
                                            <span className="text-sm font-bold text-white/80 uppercase tracking-wider">
                                                {team.completedPoints?.length || 0} Tasks Completed
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Points Display */}
                                <div className="text-right">
                                    <div className="text-6xl font-black text-white drop-shadow-lg">
                                        {team.points}
                                    </div>
                                    <div className="text-sm font-black text-white/60 uppercase tracking-widest">
                                        POINTS
                                    </div>
                                </div>
                            </div>

                            {/* Top 3 Badge */}
                            {team.rank <= 3 && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-1 shadow-xl">
                                    <span className="text-xs font-black uppercase tracking-widest bg-gradient-to-r from-yellow-600 to-amber-700 bg-clip-text text-transparent">
                                        TOP {team.rank}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}

                    {rankedTeams.length === 0 && (
                        <div className="text-center py-20">
                            <Trophy className="w-20 h-20 text-slate-600 mx-auto mb-4" />
                            <p className="text-2xl font-black text-slate-500 uppercase tracking-wider">
                                No teams yet
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RankingModal;
