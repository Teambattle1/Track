
import React, { useState, useEffect } from 'react';
import { GameMode, MapStyleId, Language, Coordinate, TimerConfig, Playground, GameRoute } from '../types';
import {
    ChevronLeft, Clock, Target, Maximize, MessageSquare, Users, Trophy,
    Layers, Globe, Snowflake, Mountain, Sun, Navigation as NavIcon,
    Map as MapIcon, X, Navigation as NavigationIcon, CheckCircle, BarChart3,
    Menu, Compass
} from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import { timeService } from '../services/time';

interface PlayerHUDProps {
    accuracy: number | null;
    language: Language;
    onBackToHub: () => void;
    activeGameName?: string;
    mapStyle: MapStyleId;
    onSetMapStyle: (style: MapStyleId) => void;
    playgrounds?: Playground[];
    onOpenPlayground: (id: string) => void;
    onOpenTeamDashboard: () => void;
    timerConfig?: TimerConfig;
    onFitBounds: () => void;
    onLocateMe: () => void;
    showScores: boolean;
    onToggleScores: () => void;
    hiddenPlaygroundIds: string[];
    onToggleChat: () => void;
    unreadMessagesCount: number;
    targetPlaygroundId?: string;
    // Game end
    endingAt?: number;
    gameEnded?: boolean;
    onReturnToStart?: () => void;
    allowChatting?: boolean;
    // Player stats
    score: number;
    tasksCompleted: number;
    tasksTotal: number;
    teamName?: string;
    teamRank?: number;
    onOpenGameChooser: () => void;
}

const MAP_STYLES_LIST: { id: MapStyleId; label: string; icon: any }[] = [
    { id: 'osm', label: 'Standard', icon: Globe },
    { id: 'ski', label: 'Ski Map', icon: Snowflake },
    { id: 'winter', label: 'Winter', icon: Mountain },
    { id: 'satellite', label: 'Satellite', icon: Layers },
    { id: 'dark', label: 'Dark Mode', icon: MapIcon },
    { id: 'light', label: 'Light Mode', icon: Sun },
    { id: 'voyager', label: 'Voyager', icon: NavIcon },
    { id: 'clean', label: 'Clean', icon: MapIcon },
];

const PlayerHUD: React.FC<PlayerHUDProps> = ({
    onBackToHub, activeGameName, mapStyle, onSetMapStyle,
    playgrounds, onOpenPlayground, onOpenTeamDashboard, timerConfig,
    onFitBounds, onLocateMe, hiddenPlaygroundIds, onToggleChat,
    unreadMessagesCount, targetPlaygroundId, endingAt, gameEnded,
    onReturnToStart, allowChatting = true, score, tasksCompleted, tasksTotal,
    teamName, teamRank, onOpenGameChooser
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [showLayerMenu, setShowLayerMenu] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [timerAlert, setTimerAlert] = useState(false);
    const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

    // Countdown Effect
    useEffect(() => {
        if (endingAt && !gameEnded) {
            const interval = setInterval(() => {
                const now = timeService.now();
                const diff = Math.ceil((endingAt - now) / 1000);
                if (diff <= 0) {
                    setCountdownSeconds(0);
                    clearInterval(interval);
                } else {
                    setCountdownSeconds(diff);
                }
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setCountdownSeconds(null);
        }
    }, [endingAt, gameEnded]);

    // Timer Effect
    useEffect(() => {
        if (!timerConfig || timerConfig.mode === 'none') {
            setTimeLeft('');
            return;
        }
        const interval = setInterval(() => {
            const now = timeService.now();
            let target: number | null = null;
            if (timerConfig.mode === 'scheduled_end' && timerConfig.endTime) {
                target = new Date(timerConfig.endTime).getTime();
            }
            if (target) {
                const diff = target - now;
                if (diff <= 0) {
                    setTimeLeft('00:00:00');
                    setTimerAlert(true);
                } else {
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                    if (diff < 300000) setTimerAlert(true);
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [timerConfig]);

    const visiblePlaygrounds = playgrounds?.filter(p => !hiddenPlaygroundIds.includes(p.id) && p.buttonVisible) || [];
    const progressPct = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-[1000]">
            {/* COUNTDOWN OVERLAY */}
            {countdownSeconds !== null && countdownSeconds > 0 && (
                <div className="fixed inset-0 z-[9999] bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in-95 pointer-events-auto">
                    <div className="text-white text-9xl font-black tabular-nums tracking-tighter drop-shadow-2xl animate-pulse">
                        {countdownSeconds}
                    </div>
                    <div className="text-white text-2xl font-black uppercase tracking-widest mt-4 animate-bounce">
                        GAME ENDING
                    </div>
                </div>
            )}

            {/* === TOP BAR === */}
            <div className="pointer-events-auto">
                <div className="flex items-center justify-between px-3 pt-3 gap-2">
                    {/* Left: Back button */}
                    <button
                        onClick={onBackToHub}
                        className="w-11 h-11 bg-black/70 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0"
                    >
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>

                    {/* Center: Game name + optional timer */}
                    <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                        {activeGameName && (
                            <button
                                onClick={onOpenGameChooser}
                                className="bg-black/70 backdrop-blur-md h-11 px-4 rounded-full border border-white/10 flex items-center gap-2 max-w-full"
                            >
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_#22c55e] shrink-0" />
                                <span className="text-[11px] text-white font-bold uppercase tracking-wider truncate">{activeGameName}</span>
                            </button>
                        )}
                        {timeLeft && (
                            <div className={`px-3 py-1 rounded-full backdrop-blur-md font-mono font-bold text-sm flex items-center gap-1.5 border ${timerAlert ? 'bg-red-600/90 border-red-500 animate-pulse text-white' : 'bg-black/60 border-white/10 text-white'}`}>
                                <Clock className="w-3.5 h-3.5" />
                                {timeLeft}
                            </div>
                        )}
                    </div>

                    {/* Right: Locate me */}
                    <button
                        onClick={onLocateMe}
                        className="w-11 h-11 bg-black/70 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 active:scale-95 transition-transform shrink-0"
                    >
                        <Target className="w-5 h-5 text-blue-400" />
                    </button>
                </div>

                {/* Score + Progress strip */}
                <div className="flex items-center justify-center gap-3 mt-2 px-4">
                    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <Trophy className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-sm font-black text-white tabular-nums">{score}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-sm font-bold text-white tabular-nums">{tasksCompleted}/{tasksTotal}</span>
                    </div>
                    {teamRank !== undefined && teamRank > 0 && (
                        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-sm font-bold text-white">#{teamRank}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* === RETURN TO START (GAME ENDED) === */}
            {gameEnded && onReturnToStart && (
                <div className="flex justify-center pointer-events-auto">
                    <button
                        onClick={onReturnToStart}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-bounce font-black uppercase tracking-widest text-lg flex items-center gap-3 border-4 border-white"
                    >
                        <NavigationIcon className="w-6 h-6" /> RETURN TO START
                    </button>
                </div>
            )}

            {/* === BOTTOM SECTION === */}
            <div className="pointer-events-auto">
                {/* Playground buttons (horizontal scroll) */}
                {visiblePlaygrounds.length > 0 && (
                    <div className="flex gap-3 items-end px-3 pb-2 overflow-x-auto no-scrollbar">
                        {visiblePlaygrounds.map(pg => {
                            const Icon = ICON_COMPONENTS[pg.iconId || 'default'];
                            const isTarget = targetPlaygroundId === pg.id;
                            return (
                                <button
                                    key={pg.id}
                                    onClick={() => onOpenPlayground(pg.id)}
                                    style={{ width: pg.buttonSize || 64, height: pg.buttonSize || 64 }}
                                    className={`rounded-2xl flex items-center justify-center transition-all border-2 group relative overflow-hidden shadow-xl active:scale-95 shrink-0 ${pg.iconUrl ? 'bg-white border-white' : 'bg-gradient-to-br from-purple-600 to-indigo-600 border-white/30'} ${isTarget ? 'ring-4 ring-orange-500 ring-offset-2 ring-offset-black animate-pulse' : ''}`}
                                >
                                    {pg.iconUrl ? (
                                        <img src={pg.iconUrl} className="w-full h-full object-cover" alt={pg.title} />
                                    ) : (
                                        <Icon className="w-1/2 h-1/2 text-white" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Bottom bar */}
                <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 px-3 py-2 flex items-center justify-between gap-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
                    {/* Left: Team info */}
                    <button
                        onClick={onOpenTeamDashboard}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-transform"
                    >
                        <Users className="w-4 h-4 text-orange-500" />
                        {teamName && <span className="text-[11px] font-bold text-white uppercase tracking-wider max-w-[80px] truncate">{teamName}</span>}
                    </button>

                    {/* Center: Progress bar */}
                    <div className="flex-1 max-w-[140px] mx-2">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-orange-500 to-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <p className="text-[9px] text-white/40 font-bold text-center mt-0.5 uppercase tracking-wider">{progressPct}% COMPLETE</p>
                    </div>

                    {/* Right: Action buttons */}
                    <div className="flex items-center gap-1.5">
                        {/* Chat */}
                        {allowChatting && (
                            <button
                                onClick={onToggleChat}
                                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform relative"
                            >
                                <MessageSquare className="w-4 h-4 text-blue-400" />
                                {unreadMessagesCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-black">
                                        {unreadMessagesCount}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Layer picker */}
                        <div className="relative">
                            <button
                                onClick={() => setShowLayerMenu(!showLayerMenu)}
                                className={`w-10 h-10 rounded-xl border flex items-center justify-center active:scale-95 transition-transform ${showLayerMenu ? 'bg-orange-600 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                            >
                                <Layers className="w-4 h-4" />
                            </button>
                            {showLayerMenu && (
                                <div className="absolute bottom-full right-0 mb-2 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-1.5 min-w-[150px] shadow-2xl z-[3000] animate-in slide-in-from-bottom-2">
                                    {MAP_STYLES_LIST.map(style => (
                                        <button
                                            key={style.id}
                                            onClick={() => { onSetMapStyle(style.id); setShowLayerMenu(false); }}
                                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold uppercase mb-0.5 last:mb-0 transition-colors ${mapStyle === style.id ? 'bg-orange-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                                        >
                                            <style.icon className="w-3.5 h-3.5" /> {style.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Fit bounds */}
                        <button
                            onClick={onFitBounds}
                            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
                        >
                            <Maximize className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerHUD;
