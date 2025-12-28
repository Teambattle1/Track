import React, { useState, useEffect, useRef } from 'react';
import { GameMode, MapStyleId, Language, Coordinate, TimerConfig, Playground, GameRoute } from '../types';
import {
    Map as MapIcon, Layers, Crosshair, ChevronLeft, Ruler, Settings,
    MessageSquare, Shield, Globe, Skull, Clock,
    Route as RouteIcon, Eye, EyeOff, Snowflake, GripHorizontal, Mountain, Sun, Navigation, Upload, Users,
    MapPin, Play, LogOut, Navigation as NavigationIcon, ExternalLink
} from 'lucide-react';
import LocationSearch from './LocationSearch';
import { ICON_COMPONENTS } from '../utils/icons';
import { parseGPX } from '../utils/gpx';
import { timeService } from '../services/time';

// ... Imports ...

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
    measurePointsCount?: number; 
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
    // Route Props
    routes?: GameRoute[];
    onToggleRoute?: (id: string) => void;
    onAddRoute?: (route: GameRoute) => void;
    // Game End Props
    endingAt?: number;
    gameEnded?: boolean;
    onReturnToStart?: () => void;
    // Permission Props
    allowChatting?: boolean;
    locateFeedback?: string | null;
}

const MAP_STYLES_LIST: { id: MapStyleId; label: string; icon: any }[] = [
    { id: 'osm', label: 'Standard', icon: Globe },
    { id: 'ski', label: 'Ski Map', icon: Snowflake },
    { id: 'norwegian', label: 'Norwegian', icon: Snowflake },
    { id: 'winter', label: 'Winter', icon: Mountain },
    { id: 'satellite', label: 'Satellite', icon: Layers },
    { id: 'dark', label: 'Dark Mode', icon: MapIcon },
    { id: 'light', label: 'Light Mode', icon: Sun },
    { id: 'voyager', label: 'Voyager', icon: Navigation },
    { id: 'clean', label: 'Clean', icon: MapIcon },
];

const GameHUD: React.FC<GameHUDProps> = ({
    accuracy, mode, toggleMode, onSetMode, onOpenGameManager, onOpenTaskMaster, onOpenTeams,
    mapStyle, onSetMapStyle, language, onBackToHub, activeGameName, onOpenInstructorDashboard,
    isMeasuring, onToggleMeasure, measuredDistance, measurePointsCount = 0, playgrounds, onOpenPlayground, onOpenTeamDashboard,
    onRelocateGame, isRelocating, timerConfig, onFitBounds, onLocateMe, onSearchLocation,
    isDrawerExpanded, showScores, onToggleScores, hiddenPlaygroundIds, onToggleChat, unreadMessagesCount,
    targetPlaygroundId, onAddDangerZone, activeDangerZone, onEditGameSettings, onOpenGameChooser,
    routes, onToggleRoute, onAddRoute, endingAt, gameEnded, onReturnToStart, allowChatting = true, locateFeedback
}) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [timerAlert, setTimerAlert] = useState(false);
    const [showLayerMenu, setShowLayerMenu] = useState(false);
    
    // Countdown State
    const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

    // ... Toolbox state ...
    const [toolboxPos, setToolboxPos] = useState({ x: window.innerWidth - 140, y: 100 });
    const [isDraggingBox, setIsDraggingBox] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const [measureBoxPos, setMeasureBoxPos] = useState({ x: window.innerWidth / 2 - 80, y: 120 });
    const [isDraggingMeasure, setIsDraggingMeasure] = useState(false);
    const measureDragOffset = useRef({ x: 0, y: 0 });
    
    // ... Drag handlers (omitted for brevity, assume unchanged) ...
    const handleBoxPointerDown = (e: React.PointerEvent) => {
        e.stopPropagation(); e.preventDefault();
        setIsDraggingBox(true); dragOffset.current = { x: e.clientX - toolboxPos.x, y: e.clientY - toolboxPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleBoxPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingBox) return; e.stopPropagation(); e.preventDefault();
        setToolboxPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const handleBoxPointerUp = (e: React.PointerEvent) => {
        setIsDraggingBox(false); (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    };

    // Countdown Effect
    useEffect(() => {
        if (endingAt && !gameEnded) {
            const interval = setInterval(() => {
                const now = Date.now();
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

    // --- TIME CHEAT PREVENTION IMPLEMENTATION ---
    useEffect(() => {
        if (!timerConfig || timerConfig.mode === 'none') {
            setTimeLeft('');
            return;
        }

        const interval = setInterval(() => {
            const now = timeService.now(); // Use server-synced time
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
                    if (diff < 300000) setTimerAlert(true); // Red alert last 5 mins
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [timerConfig]);

    const renderGameNameButton = () => (
        activeGameName && (
            <button 
                onClick={onOpenGameChooser}
                className="bg-black/80 backdrop-blur-md h-12 px-5 rounded-2xl border border-white/10 shadow-xl flex items-center gap-3 cursor-pointer hover:bg-black/90 transition-colors group pointer-events-auto"
                title="Switch Game Session"
            >
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                <p className="text-[10px] text-white font-black uppercase tracking-widest leading-none max-w-[200px] truncate group-hover:text-orange-400 transition-colors">{activeGameName}</p>
            </button>
        )
    );

    const renderLayerMenu = () => (
        <div className="absolute right-full top-0 mr-3 bg-slate-900 border border-slate-700 rounded-xl p-2 min-w-[160px] shadow-xl animate-in slide-in-from-right-2 max-h-[60vh] overflow-y-auto custom-scrollbar pointer-events-auto z-[3000]">
            <div className="mb-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">MAP STYLE</div>
            {MAP_STYLES_LIST.map((style) => (
                <button
                    key={style.id}
                    onClick={(e) => { e.stopPropagation(); onSetMapStyle(style.id); setShowLayerMenu(false); }}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold uppercase mb-1 last:mb-0 transition-colors ${mapStyle === style.id ? 'bg-orange-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                >
                    <style.icon className="w-4 h-4" /> {style.label}
                </button>
            ))}
        </div>
    );

    const isSkiMode = mapStyle === 'ski';
    const isNorwegianMode = mapStyle === 'norwegian';
    const sidebarOffset = (mode === GameMode.EDIT && isDrawerExpanded) ? 'sm:translate-x-[320px]' : '';

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 z-[1000]">
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

            <div className="flex justify-between items-start pointer-events-none">
                <div className={`flex items-start gap-2 pointer-events-auto transition-transform duration-300 ease-in-out ${sidebarOffset}`}>
                    <button onClick={onBackToHub} className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform">
                        <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                    </button>
                    {mode === GameMode.EDIT && renderGameNameButton()}
                </div>

                <div className={`flex flex-col items-center gap-2 pointer-events-auto transition-transform duration-300 ease-in-out ${sidebarOffset}`}>
                    <LocationSearch 
                        onSelectLocation={onSearchLocation} 
                        onLocateMe={onLocateMe}
                        onFitBounds={onFitBounds}
                        hideSearch={window.innerWidth < 640 && mode !== GameMode.EDIT} 
                        onToggleScores={onToggleScores}
                        showScores={showScores}
                        className="shadow-xl"
                    />
                    {mode !== GameMode.EDIT && renderGameNameButton()}
                    {timeLeft && (
                        <div className={`px-4 py-2 rounded-xl backdrop-blur-md font-mono font-bold text-lg shadow-lg flex items-center gap-2 border ${timerAlert ? 'bg-red-600/90 border-red-500 animate-pulse text-white' : 'bg-black/60 border-white/10 text-white'}`}>
                            <Clock className="w-4 h-4" />
                            {timeLeft}
                        </div>
                    )}
                    
                    {/* RETURN TO START BUTTON (GAME ENDED) */}
                    {gameEnded && onReturnToStart && (
                        <button 
                            onClick={onReturnToStart}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-bounce font-black uppercase tracking-widest text-lg flex items-center gap-3 border-4 border-white pointer-events-auto"
                        >
                            <NavigationIcon className="w-6 h-6" /> RETURN TO START
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-2 pointer-events-auto items-end">
                    {/* Chat Button (Only if allowed or in edit/instructor mode) */}
                    {(allowChatting || mode !== GameMode.PLAY) && (
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
                    )}
                    
                    {mode === GameMode.EDIT && (
                        <button onClick={onEditGameSettings} className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform text-slate-700 dark:text-slate-200">
                            <Settings className="w-6 h-6" />
                        </button>
                    )}
                    {mode === GameMode.INSTRUCTOR && (
                        <button onClick={onOpenInstructorDashboard} className="w-12 h-12 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center border border-indigo-400 hover:scale-105 transition-transform text-white">
                            <Shield className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbox & Measure ... */}
            {mode === GameMode.EDIT && (
                <div 
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: toolboxPos.x, top: toolboxPos.y }}
                    onPointerDown={handleBoxPointerDown}
                    onPointerMove={handleBoxPointerMove}
                    onPointerUp={handleBoxPointerUp}
                >
                    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-2 cursor-move group relative w-[120px]">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 rounded-full px-2 border border-slate-700 pointer-events-none">
                            <GripHorizontal className="w-4 h-4" />
                        </div>
                        {showLayerMenu && renderLayerMenu()}
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={(e) => { e.stopPropagation(); onToggleMeasure(); }} className={`w-12 h-12 rounded-xl flex items-center justify-center border hover:scale-105 transition-transform ${isMeasuring ? 'bg-orange-500 border-orange-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                                <Ruler className="w-6 h-6" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onAddDangerZone(); }} className="w-12 h-12 rounded-xl flex items-center justify-center border border-red-900/50 bg-slate-800 text-red-500 hover:bg-red-900/20 hover:text-red-400 hover:scale-105 transition-all">
                                <Skull className="w-6 h-6" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setShowLayerMenu(!showLayerMenu); }} className={`w-12 h-12 rounded-xl flex items-center justify-center border hover:scale-105 transition-transform ${showLayerMenu ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                                <Layers className="w-6 h-6" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onRelocateGame(); }} className={`w-12 h-12 rounded-xl flex items-center justify-center border hover:scale-105 transition-transform ${isRelocating ? 'bg-green-600 border-green-400 text-white animate-pulse' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                                <Crosshair className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Bar Logic ... */}
            {!isSkiMode && (
                <div className="flex justify-between items-end pointer-events-none">
                    {/* Layer & Route Toggles */}
                    <div className="pointer-events-auto flex flex-col gap-2">
                        {mode !== GameMode.EDIT && (
                            <button onClick={() => { setShowLayerMenu(!showLayerMenu); }} className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl shadow-lg flex items-center justify-center border border-gray-200 dark:border-slate-700 hover:scale-105 transition-transform">
                                <Layers className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                            </button>
                        )}
                        {isNorwegianMode && mode !== GameMode.EDIT && (
                            <button onClick={() => window.open('https://www.skisporet.no', '_blank')} className="w-12 h-12 bg-blue-600 dark:bg-blue-700 rounded-2xl shadow-lg flex items-center justify-center border border-blue-500 hover:scale-105 transition-transform" title="Check grooming status on Skisporet.no">
                                <ExternalLink className="w-6 h-6 text-white" />
                            </button>
                        )}
                    </div>
                    {/* Playground Scroller */}
                    <div className="flex gap-4 items-end pointer-events-auto max-w-[60vw] overflow-x-auto pb-2 no-scrollbar px-2">
                        {playgrounds?.filter(p => !hiddenPlaygroundIds.includes(p.id) && p.buttonVisible).map(pg => {
                            const Icon = ICON_COMPONENTS[pg.iconId || 'default'];
                            const isTarget = targetPlaygroundId === pg.id;
                            return (
                                <button key={pg.id} onClick={() => onOpenPlayground(pg.id)} style={{ width: pg.buttonSize || 80, height: pg.buttonSize || 80 }} className={`rounded-3xl flex items-center justify-center transition-all border-4 group relative overflow-hidden shadow-2xl hover:scale-105 active:scale-95 ${pg.iconUrl ? 'bg-white border-white' : 'bg-gradient-to-br from-purple-600 to-indigo-600 border-white/30'} ${isTarget ? 'ring-4 ring-orange-500 ring-offset-4 ring-offset-black animate-pulse' : ''}`}>
                                    {pg.iconUrl ? <img src={pg.iconUrl} className="w-full h-full object-cover" alt={pg.title} /> : <Icon className="w-1/2 h-1/2 text-white" />}
                                </button>
                            );
                        })}
                    </div>
                    {/* Team Dash */}
                    <div className="pointer-events-auto">
                        {mode === GameMode.PLAY && (
                            <button onClick={onOpenTeamDashboard} className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-xl flex items-center justify-center border-2 border-orange-400 hover:scale-105 transition-transform">
                                <Users className="w-8 h-8 text-white" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameHUD;
