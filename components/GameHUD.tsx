import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameMode, MapStyleId, Language, Coordinate, TimerConfig, Playground, GameRoute, AuthUser, Game, DeviceType } from '../types';
import { detectDeviceTypeWithUA, getDeviceLayout } from '../utils/deviceUtils';
import {
    Map as MapIcon, Layers, Crosshair, ChevronLeft, Ruler, Settings,
    MessageSquare, Shield, Globe, Skull, Clock,
    Route as RouteIcon, Eye, EyeOff, Snowflake, GripHorizontal, Mountain, Sun, Navigation, Upload, Users,
    MapPin, Play, LogOut, Navigation as NavigationIcon, ExternalLink, Trophy, Hash, Type, QrCode, Target, Maximize, GitBranch, ScrollText, ChevronDown, Zap, Filter, X, Loader2, Lock
} from 'lucide-react';
import LocationSearch from './LocationSearch';
import AdjustGameTimeModal from './AdjustGameTimeModal';
import QRScannerModal from './QRScannerModal';
import ToolbarsDrawer from './ToolbarsDrawer';
import { ICON_COMPONENTS } from '../utils/icons';
import { parseGPX } from '../utils/gpx';
import { timeService } from '../services/time';
import * as db from '../services/db';
import jsQR from 'jsqr';

// ... Imports ...

export interface GameHUDHandle {
    getToolbarPositions: () => {
        locationToolboxPos: { x: number; y: number };
        topToolbarPos: { x: number; y: number };
        viewSwitcherPos: { x: number; y: number };
        pinsToolboxPos: { x: number; y: number };
        showToolboxPos: { x: number; y: number };
        qrScannerPos: { x: number; y: number };
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
    showTaskActions: boolean;
    onToggleTaskActions: () => void;
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
    // Team History Props
    showTeamPaths?: boolean;
    onToggleTeamPaths?: () => void;
    showTeamPathSelector?: boolean;
    selectedTeamPaths?: string[];
    onToggleTeamPathSelector?: () => void;
    onSelectTeamPath?: (teamId: string) => void;
    // Fog of War Props
    fogOfWarEnabled?: boolean;
    selectedTeamForFogOfWar?: string | null;
    onToggleFogOfWar?: () => void;
    onSelectTeamForFogOfWar?: (teamId: string | null) => void;
    teams?: any[]; // Available teams for fog of war selection
    // Remote Override Props
    onOpenRemoteOverride?: () => void;
    // Live Approval Props
    onOpenLiveApproval?: () => void;
    pendingApprovalsCount?: number;
    // Layer Toggle Props
    showMapLayer?: boolean;
    showZoneLayer?: boolean;
    showTaskLayer?: boolean;
    showLiveLayer?: boolean;
    onToggleMapLayer?: () => void;
    onToggleZoneLayer?: () => void;
    onToggleTaskLayer?: () => void;
    onToggleLiveLayer?: () => void;
}

const MAP_STYLES_LIST: { id: MapStyleId; label: string; icon: any; preview?: string; className?: string }[] = [
    { id: 'osm', label: 'Standard', icon: Globe, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png' },
    { id: 'satellite', label: 'Satellite', icon: Layers, preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/2722/4285' },
    { id: 'dark', label: 'Dark Mode', icon: MapIcon, preview: 'https://a.basemaps.cartocdn.com/dark_all/13/4285/2722.png' },
    { id: 'historic', label: 'Historic', icon: ScrollText, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'sepia-[.7] contrast-125 brightness-90' },
    { id: 'winter', label: 'Winter', icon: Mountain, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'brightness-125 hue-rotate-180 saturate-50' },
    { id: 'ski', label: 'Ski Map', icon: Snowflake, preview: 'https://tiles.openskimap.org/map/13/4285/2722.png' },
    { id: 'treasure', label: 'Treasure', icon: ScrollText, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'sepia-[.9] contrast-110 brightness-95 hue-rotate-30' },
    { id: 'desert', label: 'Desert', icon: Mountain, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'saturate-150 hue-rotate-15 brightness-110 contrast-105' },
    { id: 'clean', label: 'Clean', icon: Globe, preview: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/13/4285/2722.png' },
];

const GameHUD = forwardRef<GameHUDHandle, GameHUDProps>(({    accuracy, mode, toggleMode, onSetMode, onOpenGameManager, onOpenTaskMaster, onOpenTeams,
    mapStyle, onSetMapStyle, language, onBackToHub, activeGameName, onOpenInstructorDashboard,
    isMeasuring, onToggleMeasure, measuredDistance, measurePointsCount = 0, playgrounds, onOpenPlayground, onOpenTeamDashboard, onOpenTeamLobby,
    onRelocateGame, isRelocating, onUpdateGameTime, timerConfig, onFitBounds, onLocateMe, onSearchLocation,
    isDrawerExpanded, showScores, onToggleScores, showTaskId, onToggleTaskId, showTaskTitle, onToggleTaskTitle, showTaskActions, onToggleTaskActions, hiddenPlaygroundIds, onToggleChat, unreadMessagesCount,
    targetPlaygroundId, onAddDangerZone, activeDangerZone, onEditGameSettings, onOpenGameChooser,
    routes, onToggleRoute, onAddRoute, endingAt, gameEnded, onReturnToStart, allowChatting = true, locateFeedback,
    authUser, activeGame, onUpdateGame, onStartSimulation, onToggleSnapToRoad, snapToRoadMode,
    showTeamPaths, onToggleTeamPaths, showTeamPathSelector, selectedTeamPaths = [], onToggleTeamPathSelector, onSelectTeamPath,
    fogOfWarEnabled, selectedTeamForFogOfWar, onToggleFogOfWar, onSelectTeamForFogOfWar, teams,
    onOpenRemoteOverride,
    onOpenLiveApproval, pendingApprovalsCount = 0,
    showMapLayer, showZoneLayer, showTaskLayer, showLiveLayer,
    onToggleMapLayer, onToggleZoneLayer, onToggleTaskLayer, onToggleLiveLayer
}, ref) => {
    // Device detection for multi-device layout support
    const [detectedDevice, setDetectedDevice] = useState<DeviceType>('desktop');

    const [timeLeft, setTimeLeft] = useState<string>('');
    const [timerAlert, setTimerAlert] = useState(false);
    const [showLayerMenu, setShowLayerMenu] = useState(false);
    const [showMapStylesMenu, setShowMapStylesMenu] = useState(false);
    const [showLocationMapStyles, setShowLocationMapStyles] = useState(false);
    const [showAdjustGameTime, setShowAdjustGameTime] = useState(false);
    const [showFogOfWarMenu, setShowFogOfWarMenu] = useState(false);
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
    // LOCATION toolbar - right side, bottom
    const [locationToolboxPos, setLocationToolboxPos] = useState({ x: window.innerWidth - 180, y: 270 });
    const [isDraggingLocationBox, setIsDraggingLocationBox] = useState(false);
    const locationDragOffset = useRef({ x: 0, y: 0 });
    // TOOLS toolbar - right side, middle
    const [topToolbarPos, setTopToolbarPos] = useState({ x: window.innerWidth - 180, y: 140 });
    const [isDraggingTopToolbar, setIsDraggingTopToolbar] = useState(false);
    const topToolbarDragOffset = useRef({ x: 0, y: 0 });
    // MAPMODE toolbar - right side, below tools
    const [viewSwitcherPos, setViewSwitcherPos] = useState({ x: window.innerWidth - 180, y: 205 });
    const [isDraggingViewSwitcher, setIsDraggingViewSwitcher] = useState(false);
    const viewSwitcherDragOffset = useRef({ x: 0, y: 0 });
    // PINS toolbar - right side, second from top
    const [pinsToolboxPos, setPinsToolboxPos] = useState({ x: window.innerWidth - 180, y: 75 });
    const [isDraggingPinsBox, setIsDraggingPinsBox] = useState(false);
    const pinsDragOffset = useRef({ x: 0, y: 0 });
    // SHOW toolbar - right side, top
    const [showToolboxPos, setShowToolboxPos] = useState({ x: window.innerWidth - 180, y: 10 });
    const [isDraggingShowBox, setIsDraggingShowBox] = useState(false);

    // QR Scanner - floating button on game playing area
    const [qrScannerPos, setQRScannerPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
    const [qrScannerSize, setQRScannerSize] = useState({ width: 140, height: 48 });
    const [qrScannerColor, setQRScannerColor] = useState('#f97316'); // Orange-500
    const [isDraggingQRScanner, setIsDraggingQRScanner] = useState(false);
    const [isResizingQRScanner, setIsResizingQRScanner] = useState(false);
    const [showQRColorPicker, setShowQRColorPicker] = useState(false);
    const [isQRScannerActive, setIsQRScannerActive] = useState(false);
    const [qrScannedValue, setQRScannedValue] = useState<string | null>(null);
    const qrScannerDragOffset = useRef({ x: 0, y: 0 });
    const qrScannerResizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 });
    const qrVideoRef = useRef<HTMLVideoElement>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const qrStreamRef = useRef<MediaStream | null>(null);
    const qrScanIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const showDragOffset = useRef({ x: 0, y: 0 });

    // Orientation lock state
    const [isOrientationLocked, setIsOrientationLocked] = useState(false);

    // Toolbars Drawer State
    const [showToolbarsDrawer, setShowToolbarsDrawer] = useState(true);
    const [hideMapToolbars, setHideMapToolbars] = useState(false);

    // Toolbar Position Persistence
    const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isAdminRef = useRef(false);

    const DEFAULT_POSITIONS_VERSION = 3;

    // Default positions (universal) - All toolbars stacked vertically on right side
    const DEFAULT_POSITIONS = {
        show: { x: window.innerWidth - 180, y: 10 },
        pins: { x: window.innerWidth - 180, y: 75 },
        tools: { x: window.innerWidth - 180, y: 140 },
        mapmode: { x: window.innerWidth - 180, y: 205 },
        location: { x: window.innerWidth - 180, y: 270 },
        qr: { x: window.innerWidth - 80, y: window.innerHeight - 100 }
    };

    // Orientation lock function
    const toggleOrientationLock = async () => {
        const device = detectDeviceTypeWithUA();
        if (!targetPlaygroundId || !playgrounds) return;

        const playground = playgrounds.find(p => p.id === targetPlaygroundId);
        if (!playground) return;

        // Get the orientation to lock from playground settings
        const deviceLayout = playground.deviceLayouts?.[device];
        const orientationSetting = deviceLayout?.orientationLock || playground.orientationLock || 'none';

        if (orientationSetting === 'none') {
            console.warn('No orientation setting configured for this playground');
            return;
        }

        try {
            if (!isOrientationLocked) {
                // Lock orientation
                if ('orientation' in screen && 'lock' in screen.orientation) {
                    await (screen.orientation as any).lock(orientationSetting === 'portrait' ? 'portrait-primary' : 'landscape-primary');
                    setIsOrientationLocked(true);
                } else {
                    console.warn('Screen Orientation API not supported');
                }
            } else {
                // Unlock orientation
                if ('orientation' in screen && 'unlock' in screen.orientation) {
                    (screen.orientation as any).unlock();
                    setIsOrientationLocked(false);
                }
            }
        } catch (error) {
            console.warn('Failed to lock/unlock orientation:', error);
        }
    };

    // Auto-unlock orientation when leaving playground or component unmounts
    useEffect(() => {
        return () => {
            if (isOrientationLocked && 'orientation' in screen && 'unlock' in screen.orientation) {
                try {
                    (screen.orientation as any).unlock();
                } catch (error) {
                    console.warn('Failed to unlock orientation on cleanup:', error);
                }
            }
        };
    }, [isOrientationLocked]);

    // Auto-apply orientation lock when entering playground in PLAY mode
    useEffect(() => {
        const device = detectDeviceTypeWithUA();
        if (!targetPlaygroundId || !playgrounds || mode !== GameMode.PLAY) {
            // Unlock orientation when leaving playground or not in play mode
            if (isOrientationLocked && 'orientation' in screen && 'unlock' in screen.orientation) {
                try {
                    (screen.orientation as any).unlock();
                    setIsOrientationLocked(false);
                } catch (error) {
                    console.warn('Failed to unlock orientation:', error);
                }
            }
            return;
        }

        const playground = playgrounds.find(p => p.id === targetPlaygroundId);
        if (!playground) return;

        // Get the orientation lock setting from playground
        const deviceLayout = playground.deviceLayouts?.[device];
        const orientationSetting = deviceLayout?.orientationLock || playground.orientationLock || 'none';

        if (orientationSetting !== 'none') {
            // Auto-lock orientation when entering playground
            if ('orientation' in screen && 'lock' in screen.orientation) {
                (screen.orientation as any).lock(orientationSetting === 'portrait' ? 'portrait-primary' : 'landscape-primary')
                    .then(() => {
                        setIsOrientationLocked(true);
                        console.log(`🔒 Orientation locked to ${orientationSetting}`);
                    })
                    .catch((error: any) => {
                        console.warn('Failed to auto-lock orientation:', error);
                    });
            }
        } else {
            // Unlock if setting is 'none'
            if (isOrientationLocked && 'orientation' in screen && 'unlock' in screen.orientation) {
                try {
                    (screen.orientation as any).unlock();
                    setIsOrientationLocked(false);
                } catch (error) {
                    console.warn('Failed to unlock orientation:', error);
                }
            }
        }
    }, [targetPlaygroundId, playgrounds, mode]);

    // Detect device type and load device-specific layout
    useEffect(() => {
        const device = detectDeviceTypeWithUA();
        setDetectedDevice(device);

        // If we're in a playzone game with device-specific layouts, load the QR scanner position for this device
        if (targetPlaygroundId && playgrounds) {
            const playground = playgrounds.find(p => p.id === targetPlaygroundId);
            if (playground?.deviceLayouts?.[device]) {
                const deviceLayout = getDeviceLayout(playground.deviceLayouts, device);
                if (deviceLayout.qrScannerPos) {
                    setQRScannerPos(deviceLayout.qrScannerPos);
                }
                if (deviceLayout.qrScannerSize) {
                    setQRScannerSize(deviceLayout.qrScannerSize);
                }
                if (deviceLayout.qrScannerColor) {
                    setQRScannerColor(deviceLayout.qrScannerColor);
                }
            }
        }
    }, [targetPlaygroundId, playgrounds]);

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
        setQRScannerPos(DEFAULT_POSITIONS.qr);

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
                    if (pos.qrScannerPos) setQRScannerPos(pos.qrScannerPos);
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
                    if (pos.qrScannerPos) setQRScannerPos(pos.qrScannerPos);
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
                showToolboxPos,
                qrScannerPos
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

    // QR Scanner drag handlers
    const handleQRScannerPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        // Only allow dragging from the drag handle, not from buttons
        if (!target?.closest('[data-qr-drag-handle]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingQRScanner(true);
        qrScannerDragOffset.current = { x: e.clientX - qrScannerPos.x, y: e.clientY - qrScannerPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    const handleQRScannerPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingQRScanner) return;
        e.stopPropagation();
        e.preventDefault();
        setQRScannerPos({ x: e.clientX - qrScannerDragOffset.current.x, y: e.clientY - qrScannerDragOffset.current.y });
    };

    const handleQRScannerPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingQRScanner) return;
        setIsDraggingQRScanner(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveQRScannerSettings();
    };

    // QR Scanner resize handlers
    const handleQRScannerResizeDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizingQRScanner(true);
        qrScannerResizeStart.current = {
            width: qrScannerSize.width,
            height: qrScannerSize.height,
            x: e.clientX,
            y: e.clientY
        };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    const handleQRScannerResizeMove = (e: React.PointerEvent) => {
        if (!isResizingQRScanner) return;
        e.stopPropagation();
        e.preventDefault();

        const deltaX = e.clientX - qrScannerResizeStart.current.x;
        const deltaY = e.clientY - qrScannerResizeStart.current.y;
        const newWidth = Math.max(100, qrScannerResizeStart.current.width + deltaX);
        const newHeight = Math.max(40, qrScannerResizeStart.current.height + deltaY);

        setQRScannerSize({ width: newWidth, height: newHeight });
    };

    const handleQRScannerResizeUp = (e: React.PointerEvent) => {
        if (!isResizingQRScanner) return;
        setIsResizingQRScanner(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveQRScannerSettings();
    };

    // Save QR Scanner settings to playground device layout
    const saveQRScannerSettings = async () => {
        if (!targetPlaygroundId || !playgrounds || !onUpdateGame || !activeGame) return;

        const playground = playgrounds.find(p => p.id === targetPlaygroundId);
        if (!playground) return;

        const device = detectedDevice;
        const updatedDeviceLayouts = {
            ...playground.deviceLayouts,
            [device]: {
                ...playground.deviceLayouts?.[device],
                qrScannerPos,
                qrScannerSize,
                qrScannerColor
            }
        };

        // Update the playground in the game
        const updatedPlaygrounds = playgrounds.map(p =>
            p.id === targetPlaygroundId
                ? { ...p, deviceLayouts: updatedDeviceLayouts }
                : p
        );

        try {
            await onUpdateGame({
                ...activeGame,
                playgrounds: updatedPlaygrounds
            });
            console.log('[GameHUD] QR Scanner settings saved');
        } catch (error) {
            console.error('[GameHUD] Error saving QR scanner settings:', error);
        }
    };

    // QR Scanner handler
    const handleQRScanClick = async () => {
        // In EDIT mode, show color picker instead of scanning
        if (mode === GameMode.EDIT) {
            setShowQRColorPicker(true);
            return;
        }
        // Toggle scanner modal
        setIsQRScannerActive(!isQRScannerActive);
    };

    // Handle QR scan result
    const handleQRScan = (data: string) => {
        setQRScannedValue(data);
        console.log('QR Code scanned:', data);
    };

    // Cleanup QR scanner on unmount
    useEffect(() => {
        return () => {
            if (qrStreamRef.current) {
                qrStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (qrScanIntervalRef.current) {
                clearInterval(qrScanIntervalRef.current);
            }
        };
    }, []);

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
                className="bg-black/80 backdrop-blur-md h-12 px-3 rounded-2xl border border-white/10 shadow-xl flex items-center gap-2 cursor-pointer hover:bg-black/90 transition-colors group pointer-events-auto"
                title="Switch Game Session"
            >
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                {activeGame?.client?.logoUrl && (
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-white/10 border border-white/20 flex-shrink-0">
                        <img
                            src={activeGame.client.logoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
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
            showToolboxPos,
            qrScannerPos
        })
    }), [locationToolboxPos, topToolbarPos, viewSwitcherPos, pinsToolboxPos, showToolboxPos, qrScannerPos]);

    return (
        <>
            {/* TOOLBARS DRAWER */}
            <ToolbarsDrawer
                isOpen={showToolbarsDrawer}
                onToggleOpen={() => setShowToolbarsDrawer(!showToolbarsDrawer)}
                mode={mode}
                activeGame={activeGame}
                onSetMode={onSetMode}
                showMapLayer={showMapLayer}
                showZoneLayer={showZoneLayer}
                showTaskLayer={showTaskLayer}
                showLiveLayer={showLiveLayer}
                onToggleMapLayer={onToggleMapLayer || (() => {})}
                onToggleZoneLayer={onToggleZoneLayer || (() => {})}
                onToggleTaskLayer={onToggleTaskLayer || (() => {})}
                onToggleLiveLayer={onToggleLiveLayer || (() => {})}
                onLocateMe={onLocateMe}
                onFitBounds={onFitBounds}
                onSearchLocation={onSearchLocation}
                onSetMapStyle={onSetMapStyle}
                locateFeedback={locateFeedback === 'success'}
                mapStyle={mapStyle}
                isMeasuring={isMeasuring}
                isRelocating={isRelocating}
                snapToRoadMode={snapToRoadMode}
                onAddDangerZone={onAddDangerZone}
                onToggleMeasure={onToggleMeasure}
                onRelocateGame={onRelocateGame}
                onToggleSnapToRoad={onToggleSnapToRoad}
                showTaskId={showTaskId}
                showTaskTitle={showTaskTitle}
                showScores={showScores}
                showTaskActions={showTaskActions}
                onToggleTaskId={onToggleTaskId}
                onToggleTaskTitle={onToggleTaskTitle}
                onToggleScores={onToggleScores}
                onToggleTaskActions={onToggleTaskActions}
                onToggleTeamPathSelector={onToggleTeamPathSelector}
                onSelectTeamPath={onSelectTeamPath}
                showTeamPathSelector={showTeamPathSelector}
                selectedTeamPaths={selectedTeamPaths}
                teams={teams}
                onToggleVisibleToolbars={() => setHideMapToolbars(!hideMapToolbars)}
                onToggleChat={onToggleChat}
                onEditGameSettings={onEditGameSettings}
                timerConfig={timerConfig}
                showAdjustGameTime={showAdjustGameTime}
                onAdjustGameTime={() => setShowAdjustGameTime(true)}
                onStartSimulation={onStartSimulation}
                onOpenRemoteOverride={onOpenRemoteOverride}
                onOpenLiveApproval={onOpenLiveApproval}
                pendingApprovalsCount={pendingApprovalsCount}
            />
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
                        <div className="flex flex-col gap-1">
                            <div className="text-center">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-green-100">LOCATION</h3>
                            </div>

                            {/* First Line: Search Bar - Width matches 3 buttons below (3x40px + 2x4px gaps = 128px) */}
                            <div className="w-[128px]">
                                <LocationSearch
                                    onSelectLocation={onSearchLocation}
                                    hideSearch={false}
                                    locateFeedback={locateFeedback}
                                    compact={true}
                                    showLabels={false}
                                />
                            </div>

                            {/* Second Line: LOCATE, FIT, MAP Buttons */}
                            <div className="flex gap-1 items-center justify-center">
                                {/* LOCATE Button */}
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLocateMe(); }}
                                        className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-green-700 text-green-100 border-green-600 hover:bg-green-800 hover:text-white pointer-events-auto"
                                        title="Locate Me"
                                    >
                                        <Target className="w-4 h-4" />
                                    </button>
                                    <div className="text-[7px] font-black text-green-100 uppercase tracking-widest leading-tight whitespace-nowrap">LOCATE</div>
                                </div>

                                {/* FIT Button */}
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFitBounds(); }}
                                        className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-green-700 text-green-100 border-green-600 hover:bg-green-800 hover:text-white pointer-events-auto"
                                        title="Fit Bounds"
                                    >
                                        <Maximize className="w-4 h-4" />
                                    </button>
                                    <div className="text-[7px] font-black text-green-100 uppercase tracking-widest leading-tight whitespace-nowrap">FIT</div>
                                </div>

                                {/* MAPSTYLE Button */}
                                <div className="flex flex-col items-center gap-0.5">
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowLocationMapStyles(!showLocationMapStyles)}
                                            className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-green-700 text-green-100 border-green-600 hover:bg-green-800 hover:text-white"
                                            title="Map Styles"
                                        >
                                            <Layers className="w-4 h-4" />
                                            {showLocationMapStyles && <div className="absolute top-0 right-0 w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>}
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
                                    <div className="text-[7px] font-black text-green-100 uppercase tracking-widest leading-tight whitespace-nowrap">MAP</div>
                                </div>
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
                            <div className="text-center">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-300">TOOLS</h3>
                            </div>
                            <div className="flex gap-1">
                                {/* Chat Button */}
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={onToggleChat}
                                        className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                                        title="Chat"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                    </button>
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight whitespace-nowrap">CHAT</div>
                                </div>

                                {/* Settings Button */}
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={onEditGameSettings}
                                        className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                                        title="Settings"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>
                                    <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-tight whitespace-nowrap">SETTINGS</div>
                                </div>

                                {/* ADJUST GAMETIME Button (Editor Mode) */}
                                {mode === GameMode.EDIT && timerConfig && (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <button
                                            onClick={() => setShowAdjustGameTime(true)}
                                            className={`w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative ${
                                                showAdjustGameTime
                                                    ? 'bg-cyan-800 border-cyan-600 text-cyan-300 hover:bg-cyan-700 hover:text-white shadow-lg shadow-cyan-600/30'
                                                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                                            }`}
                                            title="Adjust Game Time"
                                        >
                                            <Clock className="w-4 h-4" />
                                        </button>
                                        <div className={`text-[8px] font-black uppercase tracking-widest leading-tight whitespace-nowrap ${showAdjustGameTime ? 'text-cyan-400' : 'text-slate-400'}`}>TIME</div>
                                    </div>
                                )}

                                {/* Simulate Button - Only in Editor Mode (MAP/ELIMINATION only) */}
                                {mode === GameMode.EDIT && onStartSimulation && activeGame?.gameMode !== 'playzone' && (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <button
                                            onClick={onStartSimulation}
                                            className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-green-800 border-green-600 text-green-300 hover:bg-green-700 hover:text-white"
                                            title="Activate Simulation Mode"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                        <div className="text-[8px] font-black text-green-400 uppercase tracking-widest leading-tight whitespace-nowrap">PLAY</div>
                                    </div>
                                )}

                                {/* Remote Override Button - EDIT and INSTRUCTOR modes */}
                                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && onOpenRemoteOverride && (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <button
                                            onClick={onOpenRemoteOverride}
                                            className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-orange-800 border-orange-600 text-orange-300 hover:bg-orange-700 hover:text-white"
                                            title="Remote Override (Emergency Controls)"
                                        >
                                            <Zap className="w-4 h-4" />
                                        </button>
                                        <div className="text-[8px] font-black text-orange-400 uppercase tracking-widest leading-tight whitespace-nowrap">OVERRIDE</div>
                                    </div>
                                )}

                                {/* Live Approval Button - INSTRUCTOR mode only */}
                                {mode === GameMode.INSTRUCTOR && onOpenLiveApproval && (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <button
                                            onClick={onOpenLiveApproval}
                                            className="w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative bg-purple-800 border-purple-600 text-purple-300 hover:bg-purple-700 hover:text-white"
                                            title="Live Approval Feed (Photo/Video Reviews)"
                                        >
                                            <Eye className="w-4 h-4" />
                                            {pendingApprovalsCount > 0 && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                                                    {pendingApprovalsCount}
                                                </div>
                                            )}
                                        </button>
                                        <div className="text-[8px] font-black text-purple-400 uppercase tracking-widest leading-tight whitespace-nowrap">REVIEW</div>
                                    </div>
                                )}
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

            {/* Fog of War / God Mode Toggle - PLAY and INSTRUCTOR modes only */}
            {(mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR) && onToggleFogOfWar && teams && teams.length > 0 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200] pointer-events-auto">
                    <div className="bg-indigo-600 border-2 border-indigo-500 rounded-xl shadow-2xl p-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onToggleFogOfWar}
                                className={`px-4 py-2 rounded-lg transition-all border-2 flex items-center gap-2 font-black uppercase text-xs ${
                                    fogOfWarEnabled
                                        ? 'bg-indigo-800 border-indigo-600 text-indigo-200'
                                        : 'bg-black border-gray-800 text-white shadow-lg'
                                }`}
                                title={fogOfWarEnabled ? 'God Mode Active - See All' : 'Fog of War - View as Team'}
                            >
                                {fogOfWarEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                {fogOfWarEnabled ? 'FOG OF WAR' : 'GOD MODE'}
                            </button>

                            {fogOfWarEnabled && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowFogOfWarMenu(!showFogOfWarMenu)}
                                        className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 border-2 border-indigo-600 text-white rounded-lg font-black uppercase text-xs flex items-center gap-2 transition-colors"
                                    >
                                        <Users className="w-4 h-4" />
                                        {selectedTeamForFogOfWar ? teams.find(t => t.id === selectedTeamForFogOfWar)?.name || 'Select Team' : 'Select Team'}
                                        <ChevronDown className="w-3 h-3" />
                                    </button>

                                    {showFogOfWarMenu && (
                                        <div className="absolute top-full mt-2 left-0 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden min-w-[200px] max-h-[300px] overflow-y-auto">
                                            <div className="p-2 bg-slate-800 border-b border-slate-700">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Team View</p>
                                            </div>
                                            {teams.map((team) => (
                                                <button
                                                    key={team.id}
                                                    onClick={() => {
                                                        onSelectTeamForFogOfWar?.(team.id);
                                                        setShowFogOfWarMenu(false);
                                                    }}
                                                    className={`w-full px-4 py-2 text-left text-sm font-bold transition-colors ${
                                                        selectedTeamForFogOfWar === team.id
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'text-slate-300 hover:bg-slate-800'
                                                    }`}
                                                >
                                                    {team.name}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    onSelectTeamForFogOfWar?.(null);
                                                    setShowFogOfWarMenu(false);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm font-bold text-slate-500 hover:bg-slate-800 transition-colors border-t border-slate-700"
                                            >
                                                Clear Selection
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
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

                                {/* SNAP TASKS TO ROAD Button */}
                                {mode === GameMode.EDIT && onToggleSnapToRoad && (
                                    <button
                                        onClick={onToggleSnapToRoad}
                                        className={`w-10 h-10 rounded-lg transition-all border flex flex-col items-center justify-center group/toolbar relative ${
                                            snapToRoadMode
                                                ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50'
                                                : 'bg-yellow-700 text-yellow-100 border-yellow-600 hover:bg-yellow-800 hover:text-white'
                                        }`}
                                        title={snapToRoadMode ? 'ACTIVE: Draw rectangle around tasks to select them' : 'Click to activate snap mode: draw rectangle to select tasks, then deactivate to snap to roads'}
                                    >
                                        <Navigation className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-1 text-center">
                                <div className="flex-1 text-[7px] font-black text-yellow-100 uppercase tracking-widest leading-tight">DANGER</div>
                                <div className="flex-1 text-[7px] font-black text-yellow-100 uppercase tracking-widest leading-tight">MEASURE</div>
                                <div className="flex-1 text-[7px] font-black text-yellow-100 uppercase tracking-widest leading-tight">RELOCATE</div>
                                {mode === GameMode.EDIT && onToggleSnapToRoad && (
                                    <div className="flex-1 text-[7px] font-black text-yellow-100 uppercase tracking-widest leading-tight">SNAP</div>
                                )}
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

                                    {/* Task Actions Button */}
                                    <button
                                        onClick={onToggleTaskActions}
                                        className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/toolbar relative ${showTaskActions ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-purple-700 text-purple-100 border-purple-600 hover:bg-purple-800 hover:text-white'}`}
                                        title="Toggle Task Action Connections"
                                    >
                                        <GitBranch className="w-4 h-4" />
                                    </button>

                                    {/* Team Paths Button - EDIT MODE ONLY */}
                                    {mode === GameMode.EDIT && onToggleTeamPathSelector && (
                                        <div className="relative">
                                            <button
                                                onClick={onToggleTeamPathSelector}
                                                className={`w-10 h-10 rounded-lg transition-all border flex items-center justify-center group/toolbar relative ${showTeamPathSelector || selectedTeamPaths.length > 0 ? 'bg-black text-white border-gray-800 shadow-lg shadow-black/50' : 'bg-purple-700 text-purple-100 border-purple-600 hover:bg-purple-800 hover:text-white'}`}
                                                title="Select Teams to Show Paths"
                                            >
                                                <RouteIcon className="w-4 h-4" />
                                                {selectedTeamPaths.length > 0 && (
                                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[8px] font-black flex items-center justify-center text-white">
                                                        {selectedTeamPaths.length}
                                                    </span>
                                                )}
                                            </button>

                                            {/* Team Selection Popup */}
                                            {showTeamPathSelector && teams && teams.length > 0 && (
                                                <div className="absolute top-full left-0 mt-2 bg-slate-900 border-2 border-purple-500 rounded-xl shadow-2xl p-3 min-w-[200px] z-[2000]">
                                                    <div className="text-[9px] font-black text-purple-300 uppercase tracking-widest mb-2">
                                                        Select Teams
                                                    </div>
                                                    <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                        {teams.map(team => (
                                                            <button
                                                                key={team.id}
                                                                onClick={() => onSelectTeamPath?.(team.id)}
                                                                className={`w-full px-3 py-2 rounded-lg text-left text-xs font-bold transition-all ${
                                                                    selectedTeamPaths.includes(team.id)
                                                                        ? 'bg-purple-600 text-white'
                                                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-3 h-3 rounded-full ${
                                                                        selectedTeamPaths.includes(team.id) ? 'bg-white' : 'bg-slate-600'
                                                                    }`} />
                                                                    {team.name}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1 text-center">
                                    <div className="flex-1 text-[7px] font-black text-purple-100 uppercase tracking-widest leading-tight">ORDER ID</div>
                                    <div className="flex-1 text-[7px] font-black text-purple-100 uppercase tracking-widest leading-tight">TITLE</div>
                                    <div className="flex-1 text-[7px] font-black text-purple-100 uppercase tracking-widest leading-tight">SCORES</div>
                                    <div className="flex-1 text-[7px] font-black text-purple-100 uppercase tracking-widest leading-tight">ACTIONS</div>
                                    {mode === GameMode.EDIT && onToggleTeamPaths && (
                                        <div className="flex-1 text-[7px] font-black text-purple-100 uppercase tracking-widest leading-tight">PATH</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Scanner Button - draggable, resizable floating button */}
            {(mode === GameMode.PLAY || mode === GameMode.EDIT) && (
                <div
                    className="absolute z-[1100] pointer-events-auto group"
                    style={{
                        left: qrScannerPos.x,
                        top: qrScannerPos.y,
                        width: qrScannerSize.width,
                        height: qrScannerSize.height
                    }}
                    onPointerDown={mode === GameMode.EDIT ? handleQRScannerPointerDown : undefined}
                    onPointerMove={mode === GameMode.EDIT ? handleQRScannerPointerMove : undefined}
                    onPointerUp={mode === GameMode.EDIT ? handleQRScannerPointerUp : undefined}
                >
                    <button
                        onClick={handleQRScanClick}
                        disabled={isQRScannerActive && mode === GameMode.PLAY}
                        data-qr-drag-handle={mode === GameMode.EDIT ? true : undefined}
                        style={{
                            backgroundColor: qrScannedValue ? '#16a34a' : isQRScannerActive ? '#ea580c' : qrScannerColor,
                            width: '100%',
                            height: '100%'
                        }}
                        className={`flex items-center justify-center gap-2 rounded-xl transition-all font-bold uppercase tracking-widest shadow-xl relative ${
                            mode === GameMode.EDIT
                                ? 'cursor-move hover:ring-2 hover:ring-yellow-400'
                                : qrScannedValue
                                ? 'text-white hover:bg-green-700 animate-pulse cursor-pointer'
                                : isQRScannerActive
                                ? 'text-white disabled:opacity-50 cursor-not-allowed'
                                : 'text-white hover:brightness-110 cursor-pointer'
                        }`}
                        title={mode === GameMode.EDIT ? 'Click to change color | Drag to move' : (isQRScannerActive ? 'Scanning... click to stop' : 'Click to scan QR code for task activation')}
                        type="button"
                    >
                        {/* Three-dot indicator at top removed */}

                        {mode === GameMode.PLAY && isQRScannerActive && !qrScannedValue && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {(!isQRScannerActive || mode === GameMode.EDIT) && (
                            <QrCode className="w-4 h-4" />
                        )}
                        <span className={qrScannerSize.width < 120 ? 'text-[10px]' : 'text-xs'}>
                            {mode === GameMode.EDIT ? 'SCAN QR' : (qrScannedValue ? 'SCANNED' : isQRScannerActive ? 'SCANNING...' : 'SCAN QR')}
                        </span>
                    </button>

                    {/* Resize handle - EDIT mode only */}
                    {mode === GameMode.EDIT && (
                        <div
                            className="absolute bottom-0 right-0 w-4 h-4 bg-yellow-400 border-2 border-yellow-600 rounded-tl rounded-br cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
                            onPointerDown={handleQRScannerResizeDown}
                            onPointerMove={handleQRScannerResizeMove}
                            onPointerUp={handleQRScannerResizeUp}
                            title="Drag to resize"
                        />
                    )}

                    {/* QR Scanner Modal - PLAY and INSTRUCTOR modes */}
                    {(mode === GameMode.PLAY || mode === GameMode.INSTRUCTOR) && (
                        <QRScannerModal
                            isOpen={isQRScannerActive}
                            onClose={() => setIsQRScannerActive(false)}
                            onScan={handleQRScan}
                        />
                    )}
                </div>
            )}

            {/* LAYERS Toolbar - EDIT and INSTRUCTOR modes only */}
            {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
                <div className="absolute bottom-24 left-4 z-[1100] pointer-events-auto">
                    <div className="bg-cyan-600 border-2 border-cyan-500 rounded-xl shadow-2xl p-2">
                        <div className="flex flex-col gap-1">
                            <div className="text-center mb-1">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-white flex items-center gap-1 justify-center">
                                    <Filter className="w-3 h-3" />
                                    LAYERS
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                {/* Map Layer */}
                                <button
                                    onClick={onToggleMapLayer}
                                    className={`px-2 py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center text-xs ${
                                        showMapLayer !== false
                                            ? 'bg-black text-white border-gray-800 shadow-lg'
                                            : 'bg-cyan-700 text-cyan-100 border-cyan-600 hover:bg-cyan-800'
                                    }`}
                                    title="Toggle Map Layer"
                                >
                                    <Globe className="w-4 h-4 mb-0.5" />
                                    <span className="text-[7px] font-black uppercase">MAP</span>
                                </button>

                                {/* Zone Layer */}
                                <button
                                    onClick={onToggleZoneLayer}
                                    className={`px-2 py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center text-xs ${
                                        showZoneLayer !== false
                                            ? 'bg-black text-white border-gray-800 shadow-lg'
                                            : 'bg-cyan-700 text-cyan-100 border-cyan-600 hover:bg-cyan-800'
                                    }`}
                                    title="Toggle Zone Layer (Danger Zones)"
                                >
                                    <Skull className="w-4 h-4 mb-0.5" />
                                    <span className="text-[7px] font-black uppercase">ZONES</span>
                                </button>

                                {/* Task Layer */}
                                <button
                                    onClick={onToggleTaskLayer}
                                    className={`px-2 py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center text-xs ${
                                        showTaskLayer !== false
                                            ? 'bg-black text-white border-gray-800 shadow-lg'
                                            : 'bg-cyan-700 text-cyan-100 border-cyan-600 hover:bg-cyan-800'
                                    }`}
                                    title="Toggle Task Layer (Task Pins)"
                                >
                                    <Target className="w-4 h-4 mb-0.5" />
                                    <span className="text-[7px] font-black uppercase">TASKS</span>
                                </button>

                                {/* Live Layer */}
                                <button
                                    onClick={onToggleLiveLayer}
                                    className={`px-2 py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center text-xs ${
                                        showLiveLayer !== false
                                            ? 'bg-black text-white border-gray-800 shadow-lg'
                                            : 'bg-cyan-700 text-cyan-100 border-cyan-600 hover:bg-cyan-800'
                                    }`}
                                    title="Toggle Live Layer (Team Positions)"
                                >
                                    <Users className="w-4 h-4 mb-0.5" />
                                    <span className="text-[7px] font-black uppercase">LIVE</span>
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

            {/* Orientation Lock Indicator - PLAY mode only */}
            {mode === GameMode.PLAY && isOrientationLocked && (
                <div className="fixed top-4 left-4 z-[9998] pointer-events-none animate-in fade-in slide-in-from-left-4">
                    <div className="bg-red-600/95 backdrop-blur-sm border-2 border-red-400 rounded-xl px-4 py-2 shadow-2xl flex items-center gap-2">
                        <Lock className="w-4 h-4 text-white" />
                        <span className="text-xs font-black text-white uppercase tracking-wider">
                            Orientation Locked
                        </span>
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
                        right: '200px',
                        top: '10px'
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

            {/* QR Scanner Color Picker Modal - EDIT mode only */}
            {showQRColorPicker && mode === GameMode.EDIT && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
                    <div className="w-full max-w-sm bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border-2 border-yellow-500">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-white" />
                                <h3 className="text-lg font-black text-white uppercase tracking-widest">Button Color</h3>
                            </div>
                            <button
                                onClick={() => setShowQRColorPicker(false)}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                title="Close"
                                type="button"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Color Picker Content */}
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-300 font-bold uppercase tracking-wider">Choose QR Scanner Button Color</p>

                            {/* Current Color Preview */}
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-16 h-16 rounded-xl border-2 border-slate-700 shadow-lg"
                                    style={{ backgroundColor: qrScannerColor }}
                                />
                                <div className="flex-1">
                                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Current Color</p>
                                    <p className="text-sm text-white font-mono bg-slate-800 px-3 py-1.5 rounded-lg">{qrScannerColor}</p>
                                </div>
                            </div>

                            {/* Color Input */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold uppercase">Select Color</label>
                                <input
                                    type="color"
                                    value={qrScannerColor}
                                    onChange={(e) => setQRScannerColor(e.target.value)}
                                    className="w-full h-16 bg-slate-800 border-2 border-slate-700 rounded-xl cursor-pointer hover:border-yellow-500 transition-colors"
                                />
                            </div>

                            {/* Preset Colors */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold uppercase">Quick Presets</label>
                                <div className="grid grid-cols-6 gap-2">
                                    {[
                                        { name: 'Orange', color: '#f97316' },
                                        { name: 'Red', color: '#ef4444' },
                                        { name: 'Pink', color: '#ec4899' },
                                        { name: 'Purple', color: '#a855f7' },
                                        { name: 'Blue', color: '#3b82f6' },
                                        { name: 'Cyan', color: '#06b6d4' },
                                        { name: 'Teal', color: '#14b8a6' },
                                        { name: 'Green', color: '#10b981' },
                                        { name: 'Lime', color: '#84cc16' },
                                        { name: 'Yellow', color: '#eab308' },
                                        { name: 'Amber', color: '#f59e0b' },
                                        { name: 'Gray', color: '#6b7280' }
                                    ].map((preset) => (
                                        <button
                                            key={preset.color}
                                            onClick={() => setQRScannerColor(preset.color)}
                                            className="w-10 h-10 rounded-lg border-2 border-slate-700 hover:border-yellow-500 hover:scale-110 transition-all shadow-md"
                                            style={{ backgroundColor: preset.color }}
                                            title={preset.name}
                                            type="button"
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setShowQRColorPicker(false);
                                        saveQRScannerSettings();
                                    }}
                                    className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-black uppercase text-sm rounded-xl transition-all shadow-lg"
                                    type="button"
                                >
                                    Apply
                                </button>
                                <button
                                    onClick={() => setShowQRColorPicker(false)}
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold uppercase text-sm rounded-xl transition-colors"
                                    type="button"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
            </>
    );
});

GameHUD.displayName = 'GameHUD';
export default GameHUD;
