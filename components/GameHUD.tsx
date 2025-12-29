import React, { useState, useEffect, useRef } from 'react';
import { GameMode, MapStyleId, Language, Coordinate, TimerConfig, Playground, GameRoute } from '../types';
import {
    Map as MapIcon, Layers, Crosshair, ChevronLeft, Ruler, Settings,
    MessageSquare, Shield, Globe, Skull, Clock,
    Route as RouteIcon, Eye, EyeOff, Snowflake, GripHorizontal, Mountain, Sun, Navigation, Upload, Users,
    MapPin, Play, LogOut, Navigation as NavigationIcon, ExternalLink, Trophy
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
    const [showMapStylesMenu, setShowMapStylesMenu] = useState(false);
    const [showLocationMapStyles, setShowLocationMapStyles] = useState(false);
    const [showTaskId, setShowTaskId] = useState(false);
    const [showTaskTitle, setShowTaskTitle] = useState(false);

    // Countdown State
    const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

    // ... Toolbox state ...
    // Position toolbox below the settings button (circular buttons are ~104px total height + gap)
    const [toolboxPos, setToolboxPos] = useState({ x: window.innerWidth - 140, y: 180 });
    const [isDraggingBox, setIsDraggingBox] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const [measureBoxPos, setMeasureBoxPos] = useState({ x: window.innerWidth / 2 - 80, y: 120 });
    const [isDraggingMeasure, setIsDraggingMeasure] = useState(false);
    const measureDragOffset = useRef({ x: 0, y: 0 });
    const [locationToolboxPos, setLocationToolboxPos] = useState({ x: 20, y: 80 });
    const [isDraggingLocationBox, setIsDraggingLocationBox] = useState(false);
    const locationDragOffset = useRef({ x: 0, y: 0 });
    const [topToolbarPos, setTopToolbarPos] = useState({ x: window.innerWidth / 2 - 90, y: 20 });
    const [isDraggingTopToolbar, setIsDraggingTopToolbar] = useState(false);
    const topToolbarDragOffset = useRef({ x: 0, y: 0 });
    const [viewSwitcherPos, setViewSwitcherPos] = useState({ x: window.innerWidth / 2 + 100, y: 20 });
    const [isDraggingViewSwitcher, setIsDraggingViewSwitcher] = useState(false);
    const viewSwitcherDragOffset = useRef({ x: 0, y: 0 });
    const [pinsToolboxPos, setPinsToolboxPos] = useState({ x: window.innerWidth - 300, y: 120 });
    const [isDraggingPinsBox, setIsDraggingPinsBox] = useState(false);
    const pinsDragOffset = useRef({ x: 0, y: 0 });

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

    const handleLocationBoxPointerDown = (e: React.PointerEvent) => {
        e.stopPropagation(); e.preventDefault();
        setIsDraggingLocationBox(true); locationDragOffset.current = { x: e.clientX - locationToolboxPos.x, y: e.clientY - locationToolboxPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleLocationBoxPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingLocationBox) return; e.stopPropagation(); e.preventDefault();
        setLocationToolboxPos({ x: e.clientX - locationDragOffset.current.x, y: e.clientY - locationDragOffset.current.y });
    };
    const handleLocationBoxPointerUp = (e: React.PointerEvent) => {
        setIsDraggingLocationBox(false); (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    };

    const handleTopToolbarPointerDown = (e: React.PointerEvent) => {
        e.stopPropagation(); e.preventDefault();
        setIsDraggingTopToolbar(true); topToolbarDragOffset.current = { x: e.clientX - topToolbarPos.x, y: e.clientY - topToolbarPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleTopToolbarPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingTopToolbar) return; e.stopPropagation(); e.preventDefault();
        setTopToolbarPos({ x: e.clientX - topToolbarDragOffset.current.x, y: e.clientY - topToolbarDragOffset.current.y });
    };
    const handleTopToolbarPointerUp = (e: React.PointerEvent) => {
        setIsDraggingTopToolbar(false); (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    };

    const handleViewSwitcherPointerDown = (e: React.PointerEvent) => {
        e.stopPropagation(); e.preventDefault();
        setIsDraggingViewSwitcher(true); viewSwitcherDragOffset.current = { x: e.clientX - viewSwitcherPos.x, y: e.clientY - viewSwitcherPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleViewSwitcherPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingViewSwitcher) return; e.stopPropagation(); e.preventDefault();
        setViewSwitcherPos({ x: e.clientX - viewSwitcherDragOffset.current.x, y: e.clientY - viewSwitcherDragOffset.current.y });
    };
    const handleViewSwitcherPointerUp = (e: React.PointerEvent) => {
        setIsDraggingViewSwitcher(false); (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    };

    const handlePinsBoxPointerDown = (e: React.PointerEvent) => {
        e.stopPropagation(); e.preventDefault();
        setIsDraggingPinsBox(true); pinsDragOffset.current = { x: e.clientX - pinsToolboxPos.x, y: e.clientY - pinsToolboxPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handlePinsBoxPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingPinsBox) return; e.stopPropagation(); e.preventDefault();
        setPinsToolboxPos({ x: e.clientX - pinsDragOffset.current.x, y: e.clientY - pinsDragOffset.current.y });
    };
    const handlePinsBoxPointerUp = (e: React.PointerEvent) => {
        setIsDraggingPinsBox(false); (e.currentTarget as Element).releasePointerCapture(e.pointerId);
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
        <div className="fixed top-24 left-20 bg-slate-900 border border-slate-700 rounded-xl p-2 min-w-[200px] shadow-xl animate-in slide-in-from-top-2 max-h-[60vh] overflow-y-auto custom-scrollbar pointer-events-auto z-[3000]">
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

    const renderLocationMapStylesMenu = () => (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 border-2 border-green-700 rounded-xl p-3 grid grid-cols-3 gap-2 shadow-xl animate-in slide-in-from-bottom-2 pointer-events-auto z-[3000] min-w-[240px]">
            <div className="col-span-3 text-center">
                <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">MAP STYLES</p>
            </div>
            {MAP_STYLES_LIST.map((style) => (
                <button
                    key={style.id}
                    onClick={(e) => { e.stopPropagation(); onSetMapStyle(style.id); setShowLocationMapStyles(false); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all border-2 ${mapStyle === style.id ? 'bg-green-600 border-green-400 shadow-lg shadow-green-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'}`}
                    title={style.label}
                >
                    <style.icon className={`w-6 h-6 ${mapStyle === style.id ? 'text-white' : 'text-slate-300'}`} />
                    <span className={`text-[8px] font-black uppercase tracking-widest ${mapStyle === style.id ? 'text-white' : 'text-slate-400'}`}>{style.label}</span>
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

            </div>

            {/* Floating Toolbox & Measure */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: toolboxPos.x, top: toolboxPos.y }}
                    onPointerDown={handleBoxPointerDown}
                    onPointerMove={handleBoxPointerMove}
                    onPointerUp={handleBoxPointerUp}
                >
                    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-1 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 rounded-full px-2 border border-slate-700 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        {showLayerMenu && renderLayerMenu()}
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowLayerMenu(!showLayerMenu); }}
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center border hover:scale-105 transition-transform group/btn relative ${showLayerMenu ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                                >
                                    <Layers className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex gap-1 text-center">
                                <div className="flex-1 text-[7px] font-black text-slate-400 uppercase tracking-widest leading-tight">LAYERS</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Draggable Location Search Toolbox */}
            {mode === GameMode.EDIT && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: locationToolboxPos.x, top: locationToolboxPos.y }}
                    onPointerDown={handleLocationBoxPointerDown}
                    onPointerMove={handleLocationBoxPointerMove}
                    onPointerUp={handleLocationBoxPointerUp}
                >
                    <div className="bg-green-900 border-2 border-green-700 rounded-xl shadow-2xl p-1.5 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-green-200 opacity-0 group-hover:opacity-100 transition-opacity bg-green-800 rounded-full px-2 border border-green-600 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col gap-1.5 min-w-[240px]">
                            <div className="text-center">
                                <h3 className="text-xs font-black uppercase tracking-widest text-green-100 mb-1">Location</h3>
                            </div>
                            <LocationSearch
                                onSelectLocation={onSearchLocation}
                                onLocateMe={onLocateMe}
                                onFitBounds={onFitBounds}
                                hideSearch={false}
                                locateFeedback={locateFeedback}
                                compact={true}
                            />
                            {/* MAPSTYLE Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowLocationMapStyles(!showLocationMapStyles)}
                                    className="w-full bg-green-700 hover:bg-green-600 text-green-100 border border-green-600 rounded-lg p-1.5 font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1 group relative"
                                    title="Map Styles"
                                >
                                    <Layers className="w-4 h-4" />
                                    MAPSTYLE
                                    {showLocationMapStyles && <div className="absolute top-0 right-2 w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>}
                                </button>
                                {showLocationMapStyles && renderLocationMapStylesMenu()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Draggable Top Toolbar (Chat, Measure, Settings) */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: topToolbarPos.x, top: topToolbarPos.y }}
                    onPointerDown={handleTopToolbarPointerDown}
                    onPointerMove={handleTopToolbarPointerMove}
                    onPointerUp={handleTopToolbarPointerUp}
                >
                    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-1 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 rounded-full px-2 border border-slate-700 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-1">
                                {/* Chat Button */}
                                <button
                                    onClick={onToggleChat}
                                    className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                                    title="Chat"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                </button>

                                {/* Settings Button */}
                                <button
                                    onClick={onEditGameSettings}
                                    className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                                    title="Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-1 text-center">
                                <div className="flex-1 text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">CHAT</div>
                                <div className="flex-1 text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">SETTINGS</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Draggable View Switcher (Editor, Instructor, Team) */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: viewSwitcherPos.x, top: viewSwitcherPos.y }}
                    onPointerDown={handleViewSwitcherPointerDown}
                    onPointerMove={handleViewSwitcherPointerMove}
                    onPointerUp={handleViewSwitcherPointerUp}
                >
                    <div className="bg-orange-600 border-2 border-orange-500 rounded-xl shadow-2xl p-1 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-orange-200 opacity-0 group-hover:opacity-100 transition-opacity bg-orange-700 rounded-full px-2 border border-orange-500 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-center">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">MAPMODE</h3>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => onSetMode(GameMode.EDIT)}
                                    className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/mode relative ${mode === GameMode.EDIT ? 'bg-white text-orange-600 border-white shadow-lg' : 'bg-orange-700 text-orange-100 border-orange-600 hover:bg-orange-800 hover:text-white'}`}
                                    title="Editor View"
                                >
                                    <MapIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onSetMode(GameMode.INSTRUCTOR)}
                                    className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/mode relative ${mode === GameMode.INSTRUCTOR ? 'bg-white text-orange-600 border-white shadow-lg' : 'bg-orange-700 text-orange-100 border-orange-600 hover:bg-orange-800 hover:text-white'}`}
                                    title="Instructor View"
                                >
                                    <Shield className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onSetMode(GameMode.PLAY)}
                                    className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/mode relative ${mode === GameMode.PLAY ? 'bg-white text-orange-600 border-white shadow-lg' : 'bg-orange-700 text-orange-100 border-orange-600 hover:bg-orange-800 hover:text-white'}`}
                                    title="Team View"
                                >
                                    <Users className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-1 text-center">
                                <div className="flex-1 text-[7px] font-black text-orange-100 uppercase tracking-widest leading-tight">EDITOR</div>
                                <div className="flex-1 text-[7px] font-black text-orange-100 uppercase tracking-widest leading-tight">INSTRUCTOR</div>
                                <div className="flex-1 text-[7px] font-black text-orange-100 uppercase tracking-widest leading-tight">TEAM</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Draggable PINS Toolbar (Measure, Scores, Relocate) */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: pinsToolboxPos.x, top: pinsToolboxPos.y }}
                    onPointerDown={handlePinsBoxPointerDown}
                    onPointerMove={handlePinsBoxPointerMove}
                    onPointerUp={handlePinsBoxPointerUp}
                >
                    <div className="bg-yellow-600 border-2 border-yellow-500 rounded-xl shadow-2xl p-1 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-yellow-200 opacity-0 group-hover:opacity-100 transition-opacity bg-yellow-700 rounded-full px-2 border border-yellow-500 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-center">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">PINS</h3>
                            </div>
                            <div className="flex gap-1">
                                {/* Danger Zone Button */}
                                <button
                                    onClick={onAddDangerZone}
                                    className={`w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-yellow-700 text-yellow-100 border-yellow-600 hover:bg-yellow-800 hover:text-white`}
                                    title="Danger Zone"
                                >
                                    <Skull className="w-4 h-4" />
                                </button>

                                {/* Measure Button */}
                                <button
                                    onClick={onToggleMeasure}
                                    className={`w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative ${isMeasuring ? 'bg-white text-yellow-600 border-white shadow-lg' : 'bg-yellow-700 text-yellow-100 border-yellow-600 hover:bg-yellow-800 hover:text-white'}`}
                                    title="Measure"
                                >
                                    <Ruler className="w-4 h-4" />
                                </button>

                                {/* Relocate Button */}
                                <button
                                    onClick={onRelocateGame}
                                    className={`w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative ${isRelocating ? 'bg-white text-yellow-600 border-white shadow-lg animate-pulse' : 'bg-yellow-700 text-yellow-100 border-yellow-600 hover:bg-yellow-800 hover:text-white'}`}
                                    title="Relocate"
                                >
                                    <Crosshair className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-1 text-center">
                                <div className="flex-1 text-[7px] font-black text-yellow-100 uppercase tracking-widest leading-tight">DANGER</div>
                                <div className="flex-1 text-[7px] font-black text-yellow-100 uppercase tracking-widest leading-tight">MEASURE</div>
                                <div className="flex-1 text-[7px] font-black text-yellow-100 uppercase tracking-widest leading-tight">RELOCATE</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SHOW Toolbar (Task ID, Title, Scores) */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: pinsToolboxPos.x, top: pinsToolboxPos.y + 120 }}
                >
                    <div className="bg-purple-600 border-2 border-purple-500 rounded-xl shadow-2xl p-1 group relative">
                        <div className="flex flex-col gap-1">
                            <div className="text-center">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-white">SHOW</h3>
                            </div>
                            <div className="flex gap-1">
                                {/* Toggle Task ID Button */}
                                <button
                                    onClick={() => setShowTaskId(!showTaskId)}
                                    className={`flex-1 rounded-lg transition-all border flex items-center justify-center group/toolbar relative text-[9px] font-black uppercase tracking-widest py-1.5 px-1 ${showTaskId ? 'bg-white text-purple-600 border-white shadow-lg' : 'bg-purple-700 text-purple-100 border-purple-600 hover:bg-purple-800 hover:text-white'}`}
                                    title="Toggle Task ID"
                                >
                                    ID
                                </button>

                                {/* Toggle Task Title Button */}
                                <button
                                    onClick={() => setShowTaskTitle(!showTaskTitle)}
                                    className={`flex-1 rounded-lg transition-all border flex items-center justify-center group/toolbar relative text-[9px] font-black uppercase tracking-widest py-1.5 px-1 ${showTaskTitle ? 'bg-white text-purple-600 border-white shadow-lg' : 'bg-purple-700 text-purple-100 border-purple-600 hover:bg-purple-800 hover:text-white'}`}
                                    title="Toggle Task Title"
                                >
                                    TITLE
                                </button>

                                {/* Scores Button */}
                                <button
                                    onClick={onToggleScores}
                                    className={`flex-1 rounded-lg transition-all border flex items-center justify-center group/toolbar relative text-[9px] font-black uppercase tracking-widest py-1.5 px-1 ${showScores ? 'bg-white text-purple-600 border-white shadow-lg' : 'bg-purple-700 text-purple-100 border-purple-600 hover:bg-purple-800 hover:text-white'}`}
                                    title="Scores"
                                >
                                    <Trophy className="w-3 h-3" />
                                </button>
                            </div>
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
