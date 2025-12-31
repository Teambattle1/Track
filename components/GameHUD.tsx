import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameMode, MapStyleId, Language, Coordinate, TimerConfig, Playground, GameRoute, AuthUser, Game } from '../types';
import {
    Map as MapIcon, Layers, Crosshair, ChevronLeft, Ruler, Settings,
    MessageSquare, Shield, Globe, Skull, Clock,
    Route as RouteIcon, Eye, EyeOff, Snowflake, GripHorizontal, Mountain, Sun, Navigation, Upload, Users,
    MapPin, Play, LogOut, Navigation as NavigationIcon, ExternalLink, Trophy, Hash, Type, QrCode
} from 'lucide-react';
import LocationSearch from './LocationSearch';
import AdjustGameTimeModal from './AdjustGameTimeModal';
import { ICON_COMPONENTS } from '../utils/icons';
import { parseGPX } from '../utils/gpx';
import { timeService } from '../services/time';
import * as db from '../services/db';

// ... Imports ...

export interface GameHUDHandle {
    getToolbarPositions: () => {
        locationToolboxPos: { x: number; y: number };
        topToolbarPos: { x: number; y: number };
        viewSwitcherPos: { x: number; y: number };
        pinsToolboxPos: { x: number; y: number };
        showToolboxPos: { x: number; y: number };
    };
}

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
    onOpenTeamLobby?: () => void;
    onRelocateGame: () => void;
    isRelocating: boolean;
    timerConfig?: TimerConfig;
    onFitBounds: () => void;
    onLocateMe: () => void;
    onSearchLocation: (coord: Coordinate) => void;
    isDrawerExpanded: boolean;
    showScores: boolean;
    onToggleScores: () => void;
    showTaskId: boolean;
    onToggleTaskId: () => void;
    showTaskTitle: boolean;
    onToggleTaskTitle: () => void;
    hiddenPlaygroundIds: string[];
    onUpdateGameTime?: (newEndTime: number) => Promise<void>;
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
    // User Auth Props
    authUser?: AuthUser | null;
    // Game Props
    activeGame?: Game | null;
    onUpdateGame?: (game: Game) => Promise<void>;
    // Simulation Props
    onStartSimulation?: () => void;
    // Snap to Road Props
    onToggleSnapToRoad?: () => void;
    snapToRoadMode?: boolean;
}

const MAP_STYLES_LIST: { id: MapStyleId; label: string; icon: any; preview?: string; className?: string }[] = [
    { id: 'osm', label: 'Standard', icon: Globe, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png' },
    { id: 'ski', label: 'Ski Map', icon: Snowflake, preview: 'https://tiles.openskimap.org/map/13/4285/2722.png' },
    { id: 'norwegian', label: 'Norwegian', icon: Snowflake, preview: 'https://tiles.openskimap.org/map/13/4285/2722.png', className: 'saturate-115 brightness-108' },
    { id: 'winter', label: 'Winter', icon: Mountain, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'brightness-125 hue-rotate-180 saturate-50' },
    { id: 'satellite', label: 'Satellite', icon: Layers, preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/2722/4285' },
    { id: 'dark', label: 'Dark Mode', icon: MapIcon, preview: 'https://a.basemaps.cartocdn.com/dark_all/13/4285/2722.png' },
    { id: 'clean', label: 'Clean', icon: MapIcon, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png' },
];

const GameHUD = forwardRef<GameHUDHandle, GameHUDProps>(({    accuracy, mode, toggleMode, onSetMode, onOpenGameManager, onOpenTaskMaster, onOpenTeams,
    mapStyle, onSetMapStyle, language, onBackToHub, activeGameName, onOpenInstructorDashboard,
    isMeasuring, onToggleMeasure, measuredDistance, measurePointsCount = 0, playgrounds, onOpenPlayground, onOpenTeamDashboard, onOpenTeamLobby,
    onRelocateGame, isRelocating, onUpdateGameTime, timerConfig, onFitBounds, onLocateMe, onSearchLocation,
    isDrawerExpanded, showScores, onToggleScores, showTaskId, onToggleTaskId, showTaskTitle, onToggleTaskTitle, hiddenPlaygroundIds, onToggleChat, unreadMessagesCount,
    targetPlaygroundId, onAddDangerZone, activeDangerZone, onEditGameSettings, onOpenGameChooser,
    routes, onToggleRoute, onAddRoute, endingAt, gameEnded, onReturnToStart, allowChatting = true, locateFeedback,
    authUser, activeGame, onUpdateGame, onStartSimulation, onToggleSnapToRoad, snapToRoadMode
}, ref) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [timerAlert, setTimerAlert] = useState(false);
    const [showLayerMenu, setShowLayerMenu] = useState(false);
    const [showMapStylesMenu, setShowMapStylesMenu] = useState(false);
    const [showLocationMapStyles, setShowLocationMapStyles] = useState(false);
    const [showAdjustGameTime, setShowAdjustGameTime] = useState(false);
    // Countdown State
    const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

    // Map style hover preview state
    const [hoveredMapStyle, setHoveredMapStyle] = useState<MapStyleId | null>(null);

    // ... Toolbox state with default positions matching the image layout ...
    // Position toolbox below the settings button (circular buttons are ~104px total height + gap)
    const [toolboxPos, setToolboxPos] = useState({ x: window.innerWidth - 140, y: 180 });
    const [isDraggingBox, setIsDraggingBox] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const [measureBoxPos, setMeasureBoxPos] = useState({ x: window.innerWidth / 2 - 80, y: 120 });
    const [isDraggingMeasure, setIsDraggingMeasure] = useState(false);
    const measureDragOffset = useRef({ x: 0, y: 0 });
    // LOCATION toolbar - top center-right (to the right of TOOLS)
    const [locationToolboxPos, setLocationToolboxPos] = useState({ x: 470, y: 10 });
    const [isDraggingLocationBox, setIsDraggingLocationBox] = useState(false);
    const locationDragOffset = useRef({ x: 0, y: 0 });
    // TOOLS toolbar - top left
    const [topToolbarPos, setTopToolbarPos] = useState({ x: 330, y: 10 });
    const [isDraggingTopToolbar, setIsDraggingTopToolbar] = useState(false);
    const topToolbarDragOffset = useRef({ x: 0, y: 0 });
    // MAPMODE toolbar - top center-right
    const [viewSwitcherPos, setViewSwitcherPos] = useState({ x: window.innerWidth - 220, y: 10 });
    const [isDraggingViewSwitcher, setIsDraggingViewSwitcher] = useState(false);
    const viewSwitcherDragOffset = useRef({ x: 0, y: 0 });
    // PINS toolbar - right side, upper (below MAPMODE)
    const [pinsToolboxPos, setPinsToolboxPos] = useState({ x: window.innerWidth - 180, y: 75 });
    const [isDraggingPinsBox, setIsDraggingPinsBox] = useState(false);
    const pinsDragOffset = useRef({ x: 0, y: 0 });
    // SHOW toolbar - right side, middle (below PINS)
    const [showToolboxPos, setShowToolboxPos] = useState({ x: window.innerWidth - 180, y: 140 });
    const [isDraggingShowBox, setIsDraggingShowBox] = useState(false);
    const showDragOffset = useRef({ x: 0, y: 0 });

    // Toolbar Position Persistence
    const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isAdminRef = useRef(false);

    const DEFAULT_POSITIONS_VERSION = 2;

    // Default positions (universal) - Updated to match PICTURE 2 editor screen layout
    const DEFAULT_POSITIONS = {
        tools: { x: 330, y: 10 },
        location: { x: 470, y: 10 },
        mapmode: { x: window.innerWidth - 220, y: 10 },
        pins: { x: window.innerWidth - 180, y: 75 },
        show: { x: window.innerWidth - 180, y: 140 }
    };

    // Load toolbar positions on mount and reset on new game (admin users only)
    useEffect(() => {
        const isAdmin = authUser?.role === 'Admin' || authUser?.role === 'Owner';
        isAdminRef.current = isAdmin;

        // Always reset to defaults first when entering a new game
        setLocationToolboxPos(DEFAULT_POSITIONS.location);
        setTopToolbarPos(DEFAULT_POSITIONS.tools);
        setViewSwitcherPos(DEFAULT_POSITIONS.mapmode);
        setPinsToolboxPos(DEFAULT_POSITIONS.pins);
        setShowToolboxPos(DEFAULT_POSITIONS.show);

        // Then load positions - prioritize game-specific positions, then user settings
        if (isAdmin && authUser?.id) {
            const loadPositions = async () => {
                // Priority 1: Load from activeGame if it has saved positions
                if (activeGame?.toolbarPositions) {
                    const pos = activeGame.toolbarPositions;
                    if (pos.locationToolboxPos) setLocationToolboxPos(pos.locationToolboxPos);
                    if (pos.topToolbarPos) setTopToolbarPos(pos.topToolbarPos);
                    if (pos.viewSwitcherPos) setViewSwitcherPos(pos.viewSwitcherPos);
                    if (pos.pinsToolboxPos) setPinsToolboxPos(pos.pinsToolboxPos);
                    if (pos.showToolboxPos) setShowToolboxPos(pos.showToolboxPos);
                    return;
                }

                // Priority 2: Fall back to user settings
                const settings = await db.fetchUserSettings(authUser.id);

                // If saved positions are from an old layout, migrate to the new universal defaults.
                const savedVersion = settings?.toolbarPositionsVersion;
                if (savedVersion !== DEFAULT_POSITIONS_VERSION) {
                    const nextSettings = {
                        ...(settings || {}),
                        toolbarPositions: {
                            locationToolboxPos: DEFAULT_POSITIONS.location,
                            topToolbarPos: DEFAULT_POSITIONS.tools,
                            viewSwitcherPos: DEFAULT_POSITIONS.mapmode,
                            pinsToolboxPos: DEFAULT_POSITIONS.pins,
                            showToolboxPos: DEFAULT_POSITIONS.show
                        },
                        toolbarPositionsVersion: DEFAULT_POSITIONS_VERSION
                    };

                    await db.saveUserSettings(authUser.id, nextSettings);
                    return;
                }

                if (settings?.toolbarPositions) {
                    const pos = settings.toolbarPositions;
                    if (pos.locationToolboxPos) setLocationToolboxPos(pos.locationToolboxPos);
                    if (pos.topToolbarPos) setTopToolbarPos(pos.topToolbarPos);
                    if (pos.viewSwitcherPos) setViewSwitcherPos(pos.viewSwitcherPos);
                    if (pos.pinsToolboxPos) setPinsToolboxPos(pos.pinsToolboxPos);
                    if (pos.showToolboxPos) setShowToolboxPos(pos.showToolboxPos);
                }
            };
            loadPositions();
        }
    }, [authUser?.id, authUser?.role, activeGame?.id, activeGame?.toolbarPositions]);

    // Debounced save function for toolbar positions
    const saveToolbarPositions = () => {
        if (!isAdminRef.current || !authUser?.id) return;

        // Clear existing timeout
        if (saveDebounceTimerRef.current) {
            clearTimeout(saveDebounceTimerRef.current);
        }

        // Set new timeout (save after 500ms of inactivity)
        saveDebounceTimerRef.current = setTimeout(async () => {
            const toolbarPositions = {
                locationToolboxPos,
                topToolbarPos,
                viewSwitcherPos,
                pinsToolboxPos,
                showToolboxPos
            };

            // Save to activeGame if available, otherwise save to user settings
            try {
                if (activeGame && onUpdateGame) {
                    const updatedGame = {
                        ...activeGame,
                        toolbarPositions
                    };
                    await onUpdateGame(updatedGame);
                    console.log('[GameHUD] Toolbar positions saved to game');
                } else {
                    const success = await db.saveUserSettings(authUser.id, {
                        toolbarPositions,
                        toolbarPositionsVersion: DEFAULT_POSITIONS_VERSION
                    });

                    if (success) {
                        console.log('[GameHUD] Toolbar positions saved to user settings');
                    }
                }
            } catch (error) {
                console.error('[GameHUD] Error saving toolbar positions:', error);
            }
        }, 500);
    };

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (saveDebounceTimerRef.current) {
                clearTimeout(saveDebounceTimerRef.current);
            }
        };
    }, []);

    // ... Drag handlers (omitted for brevity, assume unchanged) ...
    const handleBoxPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingBox(true);
        dragOffset.current = { x: e.clientX - toolboxPos.x, y: e.clientY - toolboxPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleBoxPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingBox) return; e.stopPropagation(); e.preventDefault();
        setToolboxPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const handleBoxPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingBox) return;
        setIsDraggingBox(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
    };

    const handleLocationBoxPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingLocationBox(true);
        locationDragOffset.current = { x: e.clientX - locationToolboxPos.x, y: e.clientY - locationToolboxPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleLocationBoxPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingLocationBox) return; e.stopPropagation(); e.preventDefault();
        setLocationToolboxPos({ x: e.clientX - locationDragOffset.current.x, y: e.clientY - locationDragOffset.current.y });
    };
    const handleLocationBoxPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingLocationBox) return;
        setIsDraggingLocationBox(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveToolbarPositions();
    };

    const handleTopToolbarPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingTopToolbar(true);
        topToolbarDragOffset.current = { x: e.clientX - topToolbarPos.x, y: e.clientY - topToolbarPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleTopToolbarPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingTopToolbar) return; e.stopPropagation(); e.preventDefault();
        setTopToolbarPos({ x: e.clientX - topToolbarDragOffset.current.x, y: e.clientY - topToolbarDragOffset.current.y });
    };
    const handleTopToolbarPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingTopToolbar) return;
        setIsDraggingTopToolbar(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveToolbarPositions();
    };

    const handleViewSwitcherPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingViewSwitcher(true);
        viewSwitcherDragOffset.current = { x: e.clientX - viewSwitcherPos.x, y: e.clientY - viewSwitcherPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleViewSwitcherPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingViewSwitcher) return; e.stopPropagation(); e.preventDefault();
        setViewSwitcherPos({ x: e.clientX - viewSwitcherDragOffset.current.x, y: e.clientY - viewSwitcherDragOffset.current.y });
    };
    const handleViewSwitcherPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingViewSwitcher) return;
        setIsDraggingViewSwitcher(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveToolbarPositions();
    };

    const handlePinsBoxPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingPinsBox(true);
        pinsDragOffset.current = { x: e.clientX - pinsToolboxPos.x, y: e.clientY - pinsToolboxPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handlePinsBoxPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingPinsBox) return; e.stopPropagation(); e.preventDefault();
        setPinsToolboxPos({ x: e.clientX - pinsDragOffset.current.x, y: e.clientY - pinsDragOffset.current.y });
    };
    const handlePinsBoxPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingPinsBox) return;
        setIsDraggingPinsBox(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveToolbarPositions();
    };

    const handleShowBoxPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingShowBox(true);
        showDragOffset.current = { x: e.clientX - showToolboxPos.x, y: e.clientY - showToolboxPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleShowBoxPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingShowBox) return; e.stopPropagation(); e.preventDefault();
        setShowToolboxPos({ x: e.clientX - showDragOffset.current.x, y: e.clientY - showDragOffset.current.y });
    };
    const handleShowBoxPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingShowBox) return;
        setIsDraggingShowBox(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveToolbarPositions();
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
                    onMouseEnter={() => setHoveredMapStyle(style.id)}
                    onMouseLeave={() => setHoveredMapStyle(null)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold uppercase mb-1 last:mb-0 transition-colors relative ${mapStyle === style.id ? 'bg-orange-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                >
                    <style.icon className="w-4 h-4" /> {style.label}

                    {/* Hover Preview Thumbnail */}
                    {hoveredMapStyle === style.id && style.preview && (
                        <div className="absolute left-full ml-2 top-0 bg-slate-950 border-2 border-slate-700 rounded-lg shadow-2xl p-2 animate-in fade-in slide-in-from-left-2 pointer-events-none z-[3001]">
                            <img
                                src={style.preview}
                                alt={style.label}
                                className={`w-40 h-40 object-cover rounded ${style.className || ''}`}
                                loading="lazy"
                            />
                            <div className="mt-1 text-center text-[9px] font-black text-slate-400 uppercase">{style.label}</div>
                        </div>
                    )}
                </button>
            ))}
        </div>
    );

    const isSkiMode = mapStyle === 'ski';
    const isNorwegianMode = mapStyle === 'norwegian';
    const sidebarOffset = (mode === GameMode.EDIT && isDrawerExpanded) ? 'sm:translate-x-[320px]' : '';

    // Expose toolbar positions via ref for saving
    useImperativeHandle(ref, () => ({
        getToolbarPositions: () => ({
            locationToolboxPos,
            topToolbarPos,
            viewSwitcherPos,
            pinsToolboxPos,
            showToolboxPos
        })
    }), [locationToolboxPos, topToolbarPos, viewSwitcherPos, pinsToolboxPos, showToolboxPos]);

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
                    {timeLeft && (activeGame?.designConfig?.enableGameTime !== false) && (
                        <div className="flex flex-col gap-2">
                            <div className={`px-4 py-2 rounded-xl backdrop-blur-md font-mono font-bold text-lg shadow-lg flex items-center gap-2 border ${timerAlert ? 'bg-red-600/90 border-red-500 animate-pulse text-white' : 'bg-black/60 border-white/10 text-white'}`}>
                                <Clock className="w-4 h-4" />
                                {timeLeft}
                            </div>
                            {mode === GameMode.INSTRUCTOR && (
                                <button
                                    onClick={() => setShowAdjustGameTime(true)}
                                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm shadow-lg flex items-center gap-2 border border-cyan-500 transition-colors uppercase tracking-wider"
                                >
                                    <Clock className="w-4 h-4" />
                                    ADJUST TIME
                                </button>
                            )}
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


            {/* Draggable Location Search Toolbox - Only for GPS-based games */}
            {mode === GameMode.EDIT && activeGame?.gameMode !== 'playzone' && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: locationToolboxPos.x, top: locationToolboxPos.y }}
                    onPointerDown={handleLocationBoxPointerDown}
                    onPointerMove={handleLocationBoxPointerMove}
                    onPointerUp={handleLocationBoxPointerUp}
                >
                    <div className="bg-green-900 border-2 border-green-700 rounded-xl shadow-2xl p-1 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-green-200 opacity-0 group-hover:opacity-100 transition-opacity bg-green-800 rounded-full px-2 border border-green-600 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col gap-1 min-w-[240px]">
                            <div className="text-center">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-green-100">LOCATION</h3>
                            </div>
                            <LocationSearch
                                onSelectLocation={onSearchLocation}
                                onLocateMe={onLocateMe}
                                onFitBounds={onFitBounds}
                                hideSearch={false}
                                locateFeedback={locateFeedback}
                                compact={true}
                                showLabels={true}
                            />
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
                            <div className="text-center">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-300">TOOLS</h3>
                            </div>
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

                                {/* ADJUST GAMETIME Button (Editor Mode) */}
                                {mode === GameMode.EDIT && timerConfig && (
                                    <button
                                        onClick={() => setShowAdjustGameTime(true)}
                                        className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-cyan-800 border-cyan-600 text-cyan-300 hover:bg-cyan-700 hover:text-white"
                                        title="Adjust Game Time"
                                    >
                                        <Clock className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Simulate Button - Only in Editor Mode */}
                                {mode === GameMode.EDIT && onStartSimulation && (
                                    <button
                                        onClick={onStartSimulation}
                                        className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-green-800 border-green-600 text-green-300 hover:bg-green-700 hover:text-white"
                                        title="Activate Simulation Mode"
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                )}

                                {/* MAPSTYLE Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowLocationMapStyles(!showLocationMapStyles)}
                                        className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                                        title="Map Styles"
                                    >
                                        <Layers className="w-4 h-4" />
                                        {showLocationMapStyles && <div className="absolute top-0 right-0 w-2 h-2 bg-slate-300 rounded-full animate-pulse"></div>}
                                    </button>
                                    {showLocationMapStyles && (
                                        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-slate-900 border-2 border-slate-700 rounded-xl p-2 shadow-xl animate-in slide-in-from-top-2 pointer-events-auto z-[3001] flex gap-2 flex-wrap max-w-[300px]">
                                            {MAP_STYLES_LIST.map((style) => (
                                                <div key={style.id} className="relative">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onSetMapStyle(style.id); setShowLocationMapStyles(false); }}
                                                        onMouseEnter={() => setHoveredMapStyle(style.id)}
                                                        onMouseLeave={() => setHoveredMapStyle(null)}
                                                        className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all border-2 ${mapStyle === style.id ? 'bg-slate-700 border-slate-500 shadow-lg shadow-slate-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'}`}
                                                        title={style.label}
                                                    >
                                                        <style.icon className={`w-4 h-4 ${mapStyle === style.id ? 'text-white' : 'text-slate-300'}`} />
                                                        <span className={`text-[7px] font-black uppercase tracking-widest ${mapStyle === style.id ? 'text-white' : 'text-slate-400'}`}>{style.label}</span>
                                                    </button>

                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-1 text-center">
                                <div className="flex-1 text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">CHAT</div>
                                <div className="flex-1 text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">SETTINGS</div>
                                <div className="flex-1 text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">TIME</div>
                                <div className="flex-1 text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">MAP</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Draggable View Switcher (Editor, Instructor, Team) - Hide for PLAYZONE to avoid map confusion */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && activeGame?.gameMode !== 'playzone' && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: viewSwitcherPos.x, top: viewSwitcherPos.y }}
                    onPointerDown={handleViewSwitcherPointerDown}
                    onPointerMove={handleViewSwitcherPointerMove}
                    onPointerUp={handleViewSwitcherPointerUp}
                >
                    <div className="bg-red-600 border-2 border-red-500 rounded-xl shadow-2xl p-1 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-red-200 opacity-0 group-hover:opacity-100 transition-opacity bg-red-700 rounded-full px-2 border border-red-500 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-center">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">MAPMODE</h3>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => onSetMode(GameMode.EDIT)}
                                    className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/mode relative ${mode === GameMode.EDIT ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-red-700 text-red-100 border-red-600 hover:bg-red-800 hover:text-white'}`}
                                    title="Editor View"
                                >
                                    <MapIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onSetMode(GameMode.INSTRUCTOR)}
                                    className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/mode relative ${mode === GameMode.INSTRUCTOR ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-red-700 text-red-100 border-red-600 hover:bg-red-800 hover:text-white'}`}
                                    title="Instructor View"
                                >
                                    <Shield className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onSetMode(GameMode.PLAY)}
                                    className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/mode relative ${mode === GameMode.PLAY ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-red-700 text-red-100 border-red-600 hover:bg-red-800 hover:text-white'}`}
                                    title="Team View"
                                >
                                    <Users className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-1 text-center">
                                <div className="flex-1 text-[7px] font-black text-red-100 uppercase tracking-widest leading-tight">EDITOR</div>
                                <div className="flex-1 text-[7px] font-black text-red-100 uppercase tracking-widest leading-tight">INSTRUCTOR</div>
                                <div className="flex-1 text-[7px] font-black text-red-100 uppercase tracking-widest leading-tight">TEAM</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Draggable PINS Toolbar (Measure, Scores, Relocate) - Only for GPS-based games */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && activeGame?.gameMode !== 'playzone' && (
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
                                    className={`w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative ${isMeasuring ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-yellow-700 text-yellow-100 border-yellow-600 hover:bg-yellow-800 hover:text-white'}`}
                                    title="Measure"
                                >
                                    <Ruler className="w-4 h-4" />
                                </button>

                                {/* Relocate Button */}
                                <button
                                    onClick={onRelocateGame}
                                    className={`w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative ${isRelocating ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50 animate-pulse' : 'bg-yellow-700 text-yellow-100 border-yellow-600 hover:bg-yellow-800 hover:text-white'}`}
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

            {/* SHOW Toolbar (Task ID, Title, Scores) - Independent */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: showToolboxPos.x, top: showToolboxPos.y }}
                    onPointerDown={handleShowBoxPointerDown}
                    onPointerMove={handleShowBoxPointerMove}
                    onPointerUp={handleShowBoxPointerUp}
                >
                    <div className="bg-purple-600 border-2 border-purple-500 rounded-xl shadow-2xl p-1 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-purple-200 opacity-0 group-hover:opacity-100 transition-opacity bg-purple-700 rounded-full px-2 border border-purple-500 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="text-center">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-white">SHOW</h3>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                    {/* Toggle Task Order ID Button */}
                                    <button
                                        onClick={onToggleTaskId}
                                        className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/toolbar relative ${showTaskId ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-purple-700 text-purple-100 border-purple-600 hover:bg-purple-800 hover:text-white'}`}
                                        title="Toggle Task Order ID"
                                    >
                                        <Hash className="w-4 h-4" />
                                    </button>

                                    {/* Toggle Task Title Button */}
                                    <button
                                        onClick={onToggleTaskTitle}
                                        className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/toolbar relative ${showTaskTitle ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-purple-700 text-purple-100 border-purple-600 hover:bg-purple-800 hover:text-white'}`}
                                        title="Toggle Task Title"
                                    >
                                        <Type className="w-4 h-4" />
                                    </button>

                                    {/* Scores Button */}
                                    <button
                                        onClick={onToggleScores}
                                        className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/toolbar relative ${showScores ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-purple-700 text-purple-100 border-purple-600 hover:bg-purple-800 hover:text-white'}`}
                                        title="Scores"
                                    >
                                        <Trophy className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex gap-1 text-center">
                                    <div className="flex-1 text-[7px] font-black text-purple-100 uppercase tracking-widest leading-tight">ORDER ID</div>
                                    <div className="flex-1 text-[7px] font-black text-purple-100 uppercase tracking-widest leading-tight">TITLE</div>
                                    <div className="flex-1 text-[7px] font-black text-purple-100 uppercase tracking-widest leading-tight">SCORES</div>
                                </div>
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
                    {/* Team Dash & QR Scanner */}
                    <div className="pointer-events-auto flex gap-3">
                        {mode === GameMode.PLAY && (
                            <>
                                <button onClick={onOpenTeamDashboard} className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-xl flex items-center justify-center border-2 border-orange-400 hover:scale-105 transition-transform" title="Team Dashboard">
                                    <Users className="w-8 h-8 text-white" />
                                </button>
                                {onOpenTeamLobby && (
                                    <button onClick={onOpenTeamLobby} className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl shadow-xl flex items-center justify-center border-2 border-blue-400 hover:scale-105 transition-transform" title="Team Lobby - Manage Members">
                                        <Shield className="w-8 h-8 text-white" />
                                    </button>
                                )}
                                {activeGame?.designConfig?.enableCodeScanner && (
                                    <button
                                        onClick={() => {
                                            // TODO: Open QR scanner modal
                                            alert('QR Scanner functionality - Coming soon');
                                        }}
                                        className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-xl flex items-center justify-center border-2 border-blue-400 hover:scale-105 transition-transform"
                                        title="Scan QR Code"
                                    >
                                        <QrCode className="w-8 h-8 text-white" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Adjust Game Time Modal */}
            {showAdjustGameTime && (
                <AdjustGameTimeModal
                    onClose={() => setShowAdjustGameTime(false)}
                    timerConfig={timerConfig}
                    onUpdateGameTime={onUpdateGameTime || (async () => {})}
                />
            )}

            {/* Fixed Map Style Preview - Square Thumbnail */}
            {hoveredMapStyle && MAP_STYLES_LIST.find(s => s.id === hoveredMapStyle)?.preview && (
                <div
                    className="fixed pointer-events-none z-[9999] animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)'
                    }}
                >
                    <div className="bg-slate-950/95 backdrop-blur-md border-4 border-slate-700 rounded-2xl shadow-2xl p-3">
                        <img
                            src={MAP_STYLES_LIST.find(s => s.id === hoveredMapStyle)!.preview}
                            alt={MAP_STYLES_LIST.find(s => s.id === hoveredMapStyle)!.label}
                            className={`w-64 h-64 object-cover rounded-lg ${MAP_STYLES_LIST.find(s => s.id === hoveredMapStyle)?.className || ''}`}
                            loading="eager"
                            crossOrigin="anonymous"
                        />
                        <div className="mt-2 text-center text-sm font-black text-white uppercase tracking-widest">
                            {MAP_STYLES_LIST.find(s => s.id === hoveredMapStyle)!.label}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

GameHUD.displayName = 'GameHUD';
export default GameHUD;
