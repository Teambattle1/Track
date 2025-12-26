
import React, { useState, useEffect } from 'react';
import { GameMode, MapStyleId, Language, Coordinate, TimerConfig, Playground } from '../types';
import { 
    LayoutDashboard, Map as MapIcon, Layers, Crosshair, 
    Zap, LogOut, ChevronLeft, Ruler, RotateCw, Play, Settings, 
    MessageSquare, AlertTriangle, Users, Trophy, Hash, Shield, Globe, Menu, X, Plus, Skull, Clock
} from 'lucide-react';
import { t } from '../utils/i18n';
import LocationSearch from './LocationSearch';
import { ICON_COMPONENTS } from '../utils/icons';

interface GameHUDProps {
    accuracy: number | null;
    mode: GameMode;
    toggleMode: () => void;
    onSetMode: (mode: GameMode) => void;
    onOpenGameManager: () => void;
    onOpenTaskMaster: () => void;
    onOpenTeams: () => void;
    mapStyle: MapStyleId;
    onSetMapStyle: (style: MapStyleId) => void;
    language: Language;
    onBackToHub: () => void;
    activeGameName?: string;
    onOpenInstructorDashboard: () => void;
    isMeasuring: boolean;
    onToggleMeasure: () => void;
    measuredDistance: number;
    playgrounds?: Playground[];
    onOpenPlayground: (id: string) => void;
    onOpenTeamDashboard: () => void;
    onRelocateGame: () => void;
    isRelocating: boolean;
    timerConfig?: TimerConfig;
    onFitBounds: () => void;
    onLocateMe: () => void;
    onSearchLocation: (coord: Coordinate) => void;
    isDrawerExpanded: boolean;
    showScores: boolean;
    onToggleScores: () => void;
    hiddenPlaygroundIds: string[];
    onToggleChat: () => void;
    unreadMessagesCount: number;
    targetPlaygroundId?: string;
    onAddDangerZone: () => void;
    activeDangerZone: any;
    onEditGameSettings: () => void;
    onOpenGameChooser: () => void;
}

const GameHUD: React.FC<GameHUDProps> = ({
    accuracy, mode, toggleMode, onSetMode, onOpenGameManager, onOpenTaskMaster, onOpenTeams,
    mapStyle, onSetMapStyle, language, onBackToHub, activeGameName, onOpenInstructorDashboard,
    isMeasuring, onToggleMeasure, measuredDistance, playgrounds, onOpenPlayground, onOpenTeamDashboard,
    onRelocateGame, isRelocating, timerConfig, onFitBounds, onLocateMe, onSearchLocation,
    isDrawerExpanded, showScores, onToggleScores, hiddenPlaygroundIds, onToggleChat, unreadMessagesCount,
    targetPlaygroundId, onAddDangerZone, activeDangerZone, onEditGameSettings, onOpenGameChooser
}) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [timerAlert, setTimerAlert] = useState(false);

    useEffect(() => {
        if (!timerConfig || timerConfig.mode === 'none') {
            setTimeLeft('');
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            let target: Date | null = null;

            if (timerConfig.mode === 'scheduled_end' && timerConfig.endTime) {
                target = new Date(timerConfig.endTime);
            }
            // For countdown, we'd need start time, which isn't passed here simply. 
            // Assuming simplified scheduled end for now or countup logic could be added if start time available.
            
            if (target) {
                const diff = target.getTime() - now.getTime();
                if (diff <= 0) {
                    setTimeLeft('00:00:00');
                    setTimerAlert(true);
                } else {
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
                    if (diff < 300000) setTimerAlert(true); // Alert last 5 mins
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [timerConfig]);

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 z-[1000]">
            
            {/* TOP BAR */}
            <div className="flex justify-between items-start">
                
                {/* Left: Hub & Measuring */}
                <div className="flex flex-col gap-2 pointer-events-auto">
                    <button onClick={onBackToHub} className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform">
                        <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                    </button>
                    {mode === GameMode.EDIT && (
                        <>
                            <button 
                                onClick={onToggleMeasure}
                                className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform ${isMeasuring ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}
                            >
                                <Ruler className="w-6 h-6" />
                            </button>
                            {isMeasuring && (
                                <div className="bg-black/80 text-white px-3 py-1 rounded-lg text-xs font-mono backdrop-blur-md">
                                    {Math.round(measuredDistance)}m
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Center: Game Info & Timer */}
                <div className="flex flex-col items-center gap-2">
                    {/* Active Game Name / Switcher */}
                    {activeGameName && (
                        <button 
                            onClick={onOpenGameChooser}
                            className="pointer-events-auto bg-black/80 backdrop-blur-md h-12 px-5 rounded-2xl border border-white/10 shadow-xl flex items-center gap-3 cursor-pointer hover:bg-black/90 transition-colors group"
                            title="Switch Game Session"
                        >
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                            <p className="text-[10px] text-white font-black uppercase tracking-widest leading-none max-w-[200px] truncate group-hover:text-orange-400 transition-colors">{activeGameName}</p>
                        </button>
                    )}

                    {/* Timer Display */}
                    {timeLeft && (
                        <div className={`pointer-events-auto px-4 py-2 rounded-xl backdrop-blur-md font-mono font-bold text-lg shadow-lg flex items-center gap-2 border ${timerAlert ? 'bg-red-600/90 border-red-500 animate-pulse text-white' : 'bg-black/60 border-white/10 text-white'}`}>
                            <Clock className="w-4 h-4" />
                            {timeLeft}
                        </div>
                    )}

                    {/* Danger Zone Warning */}
                    {activeDangerZone && (
                        <div className="pointer-events-auto bg-red-600 text-white px-4 py-2 rounded-xl shadow-lg animate-bounce flex items-center gap-2 border-2 border-red-400">
                            <Skull className="w-5 h-5" />
                            <div className="flex flex-col items-center leading-none">
                                <span className="text-[10px] font-black uppercase tracking-widest">DANGER ZONE</span>
                                <span className="text-sm font-bold font-mono">{activeDangerZone.timeRemaining}s</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Tools & Chat */}
                <div className="flex flex-col gap-2 pointer-events-auto items-end">
                    <button 
                        onClick={onToggleChat}
                        className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform relative"
                    >
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        {unreadMessagesCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                                {unreadMessagesCount}
                            </span>
                        )}
                    </button>

                    {mode === GameMode.EDIT && (
                        <>
                            <button 
                                onClick={onRelocateGame}
                                className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform ${isRelocating ? 'bg-orange-500 text-white animate-pulse' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}
                                title="Relocate Game"
                            >
                                <Crosshair className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={onAddDangerZone}
                                className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform text-red-600"
                                title="Add Danger Zone"
                            >
                                <Skull className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={onEditGameSettings}
                                className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform text-slate-700 dark:text-slate-200"
                                title="Game Settings"
                            >
                                <Settings className="w-6 h-6" />
                            </button>
                        </>
                    )}

                    {mode === GameMode.INSTRUCTOR && (
                        <button 
                            onClick={onOpenInstructorDashboard}
                            className="w-12 h-12 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center border border-indigo-400 hover:scale-105 transition-transform text-white"
                            title="Instructor Dashboard"
                        >
                            <Shield className="w-6 h-6" />
                        </button>
                    )}

                    {/* Location Search Widget */}
                    <LocationSearch 
                        onSelectLocation={onSearchLocation} 
                        onLocateMe={onLocateMe}
                        onFitBounds={onFitBounds}
                        hideSearch={window.innerWidth < 640} // Hide text input on mobile to save space
                        onToggleScores={onToggleScores}
                        showScores={showScores}
                    />
                </div>
            </div>

            {/* BOTTOM BAR */}
            <div className="flex justify-between items-end pointer-events-none">
                {/* Left: Map Style */}
                <div className="pointer-events-auto">
                    {/* Add Map Style Toggle or similar if needed, currently omitted for cleaner UI */}
                </div>

                {/* Center: Playgrounds */}
                <div className="flex gap-4 items-end pointer-events-auto max-w-[60vw] overflow-x-auto pb-2 no-scrollbar">
                    {playgrounds?.filter(p => !hiddenPlaygroundIds.includes(p.id) && p.buttonVisible).map(pg => {
                        const Icon = ICON_COMPONENTS[pg.iconId || 'default'];
                        const isTarget = targetPlaygroundId === pg.id;
                        return (
                            <button
                                key={pg.id}
                                onClick={() => onOpenPlayground(pg.id)}
                                style={{ width: pg.buttonSize || 80, height: pg.buttonSize || 80 }}
                                className={`rounded-3xl flex items-center justify-center transition-all border-4 group relative overflow-hidden shadow-2xl hover:scale-105 active:scale-95 ${pg.iconUrl ? 'bg-white border-white' : 'bg-gradient-to-br from-purple-600 to-indigo-600 border-white/30'} ${isTarget ? 'ring-4 ring-orange-500 ring-offset-4 ring-offset-black animate-pulse' : ''}`}
                            >
                                {pg.iconUrl ? <img src={pg.iconUrl} className="w-full h-full object-cover" alt={pg.title} /> : <Icon className="w-1/2 h-1/2 text-white" />}
                                {isTarget && <div className="absolute top-1 right-1 w-3 h-3 bg-orange-500 rounded-full shadow-md" />}
                            </button>
                        );
                    })}
                </div>

                {/* Right: Team / Action Button */}
                <div className="pointer-events-auto">
                    {mode === GameMode.PLAY && (
                        <button 
                            onClick={onOpenTeamDashboard}
                            className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-xl flex items-center justify-center border-2 border-orange-400 hover:scale-105 transition-transform"
                        >
                            <Users className="w-8 h-8 text-white" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameHUD;
