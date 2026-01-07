import React, { useState } from 'react';
import {
    ChevronLeft, ChevronRight, ChevronDown,
    MapIcon, Shield, Users,
    Filter, Globe, Skull, Target,
    Target as TargetIcon, Maximize, Layers,
    Skull as SkullIcon, Ruler, Crosshair, Navigation,
    Hash, Type, Trophy, GitBranch, RouteIcon,
    MessageSquare, Settings, Clock, Play, Zap, Eye,
    GripHorizontal, ScrollText, Mountain, Snowflake, Check, MapPin,
    Smartphone, Tablet, Monitor, RotateCw, Lock, Unlock
} from 'lucide-react';
import { Game, GameMode, LocationSearchProps, Coordinate, Team, MapStyleId } from '../types';
import LocationSearch from './LocationSearch';
import InfoBox from './InfoBox';
import ZoneChangeItem from './ZoneChangeItem';

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

interface ToolbarsDrawerProps {
    isOpen: boolean;
    onToggleOpen: () => void;
    mode: GameMode;
    activeGame: Game | null;
    visibleToolbars?: Record<string, boolean>;
    onToggleToolbarVisibility?: (toolbarId: string) => void;
    collapsedSections?: Record<string, boolean>;
    onCollapsedSectionsChange?: (sections: Record<string, boolean>) => void;
    
    // MAPMODE
    onSetMode: (mode: GameMode) => void;
    
    // LAYERS
    showMapLayer?: boolean;
    showZoneLayer?: boolean;
    showTaskLayer?: boolean;
    showLiveLayer?: boolean;
    onToggleMapLayer: () => void;
    onToggleZoneLayer: () => void;
    onToggleTaskLayer: () => void;
    onToggleLiveLayer: () => void;
    
    // LOCATION
    onLocateMe: () => void;
    onFitBounds: () => void;
    onSearchLocation: (coord: Coordinate) => void;
    onSetMapStyle: (styleId: string) => void;
    locateFeedback?: boolean;
    mapStyle?: string;
    
    // PINS
    isMeasuring?: boolean;
    isRelocating?: boolean;
    snapToRoadMode?: boolean;
    onAddDangerZone: () => void;
    onToggleMeasure: () => void;
    onRelocateGame: () => void;
    onToggleSnapToRoad?: () => void;
    onExecuteSnap?: () => void;
    selectedSnapTaskCount?: number;
    
    // SHOW
    showTaskId?: boolean;
    showTaskTitle?: boolean;
    showScores?: boolean;
    showTaskActions?: boolean;
    onToggleTaskId: () => void;
    onToggleTaskTitle: () => void;
    onToggleScores: () => void;
    onToggleTaskActions: () => void;
    onToggleTeamPathSelector?: () => void;
    onSelectTeamPath?: (teamId: string) => void;
    showTeamPathSelector?: boolean;
    selectedTeamPaths?: string[];
    teams?: Team[];
    onToggleVisibleToolbars?: () => void;
    onResetToolbarPositions?: () => void;
    
    // TOOLS
    onToggleChat: () => void;
    onEditGameSettings: () => void;
    onOpenGameChooser?: () => void;
    timerConfig?: any;
    showAdjustGameTime?: boolean;
    onAdjustGameTime?: () => void;
    onStartSimulation?: () => void;
    onOpenRemoteOverride?: () => void;
    onOpenLiveApproval?: () => void;
    pendingApprovalsCount?: number;

    // ZONE CHANGES
    zoneChanges?: any[];
    onAdjustZoneChange?: (zoneChangeId: string) => void;

    // INSTRUCTOR FEATURES
    onShowRanking?: () => void;
    onOpenTeams?: () => void;

    // Access Mode Props
    userAccessMode?: 'EDITOR' | 'INSTRUCTOR' | 'TEAM' | null;

    // Device Preview Props
    teamEditDevice?: 'mobile' | 'tablet' | 'desktop';
    onTeamEditDeviceChange?: (device: 'mobile' | 'tablet' | 'desktop') => void;
    teamEditOrientation?: 'portrait' | 'landscape';
    onTeamEditOrientationChange?: (orientation: 'portrait' | 'landscape') => void;
    teamEditOrientationLocked?: boolean;
    onTeamEditOrientationLockToggle?: (locked: boolean) => void;
}

const ToolbarsDrawer: React.FC<ToolbarsDrawerProps> = ({
    isOpen,
    onToggleOpen,
    mode,
    activeGame,
    visibleToolbars: visibleToolbarsProp,
    onToggleToolbarVisibility,
    collapsedSections: collapsedSectionsProp,
    onCollapsedSectionsChange,
    onSetMode,
    showMapLayer,
    showZoneLayer,
    showTaskLayer,
    showLiveLayer,
    onToggleMapLayer,
    onToggleZoneLayer,
    onToggleTaskLayer,
    onToggleLiveLayer,
    onLocateMe,
    onFitBounds,
    onSearchLocation,
    onSetMapStyle,
    locateFeedback,
    mapStyle,
    isMeasuring,
    isRelocating,
    snapToRoadMode,
    onAddDangerZone,
    onToggleMeasure,
    onRelocateGame,
    onToggleSnapToRoad,
    onExecuteSnap,
    selectedSnapTaskCount = 0,
    showTaskId,
    showTaskTitle,
    showScores,
    showTaskActions,
    onToggleTaskId,
    onToggleTaskTitle,
    onToggleScores,
    onToggleTaskActions,
    onToggleTeamPathSelector,
    onSelectTeamPath,
    showTeamPathSelector,
    selectedTeamPaths = [],
    teams = [],
    onToggleVisibleToolbars,
    onResetToolbarPositions,
    onToggleChat,
    onEditGameSettings,
    onOpenGameChooser,
    timerConfig,
    showAdjustGameTime,
    onAdjustGameTime,
    onStartSimulation,
    onOpenRemoteOverride,
    onOpenLiveApproval,
    pendingApprovalsCount = 0,
    zoneChanges = [],
    onAdjustZoneChange,
    onShowRanking,
    onOpenTeams,
    userAccessMode,
    teamEditDevice = 'desktop',
    onTeamEditDeviceChange,
    teamEditOrientation = 'landscape',
    onTeamEditOrientationChange,
    teamEditOrientationLocked = false,
    onTeamEditOrientationLockToggle,
}) => {
    // Auto-collapse all sections in editor mode by default
    const defaultCollapsedState = {
        mapmode: true,   // All sections collapsed on entry to EDIT mode
        layers: true,
        location: true,
        mapstyle: true,
        device: true,    // Collapsed in EDIT mode
        orientation: true, // Collapsed in EDIT mode
        zonechange: true,
        pins: true,
        show: true,
        tools: true,
        ranking: true,   // INSTRUCTOR: Collapsed by default
        teams: true,     // INSTRUCTOR: Collapsed by default
    };

    const [collapsedSectionsLocal, setCollapsedSectionsLocal] = useState<Record<string, boolean>>(defaultCollapsedState);
    const [showMapStylesMenu, setShowMapStylesMenu] = useState(false);
    const [showToolbarsMenu, setShowToolbarsMenu] = useState(false);

    // Auto-collapse all sections when entering editor mode
    React.useEffect(() => {
        if (mode === GameMode.EDIT) {
            const newState = {
                mapmode: true,
                layers: true,
                location: true,
                mapstyle: true,
                device: true,
                orientation: true,
                zonechange: true,
                pins: true,
                show: true,
                tools: true,
                ranking: true,
                teams: true,
            };
            if (onCollapsedSectionsChange) {
                onCollapsedSectionsChange(newState);
            } else {
                setCollapsedSectionsLocal(newState);
            }
        }
    }, [mode, onCollapsedSectionsChange]);

    // Auto-collapse Zone Change section when game ends or when no active countdowns
    React.useEffect(() => {
        const isGameEnded = activeGame?.state === 'ended' || activeGame?.state === 'ending' || (timerConfig && timerConfig.timeLeft <= 0);
        const now = Date.now();
        const hasActiveCountdowns = zoneChanges && zoneChanges.some(zc =>
            zc.enabled && !zc.hasTriggered && zc.targetTime && zc.targetTime > now
        );

        // Collapse if game ended OR if there are no active countdowns
        if ((isGameEnded || !hasActiveCountdowns) && zoneChanges && zoneChanges.length > 0) {
            const newState = {
                ...collapsedSections,
                zonechange: true
            };
            if (onCollapsedSectionsChange) {
                onCollapsedSectionsChange(newState);
            } else {
                setCollapsedSectionsLocal(newState);
            }
        }
    }, [activeGame?.state, timerConfig?.timeLeft, zoneChanges]);

    // Use prop if provided, otherwise use local state
    const collapsedSections = collapsedSectionsProp || collapsedSectionsLocal;
    const visibleToolbars = visibleToolbarsProp || {
        mapmode: false,
        layers: false,
        location: false,
        mapstyle: false,
        pins: false,
        show: false,
        tools: false,
    };

    const toggleSection = (section: string) => {
        const newState = {
            ...collapsedSections,
            [section]: !collapsedSections[section]
        };

        if (onCollapsedSectionsChange) {
            onCollapsedSectionsChange(newState);
        } else {
            setCollapsedSectionsLocal(newState);
        }
    };

    const isVisible = (section: string) => !collapsedSections[section];

    return (
        <div className={`fixed top-0 left-0 bottom-0 z-[2100] w-full sm:w-[320px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-r border-gray-200 dark:border-gray-800 pointer-events-auto transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {/* Toggle Button - Orange Arrow Handle */}
            <button
                onClick={onToggleOpen}
                className="absolute left-full top-1/2 -translate-y-1/2 bg-orange-600 hover:bg-orange-700 w-8 h-24 rounded-r-xl shadow-lg border-y border-r border-orange-600 text-white transition-all flex items-center justify-center pointer-events-auto"
                title={isOpen ? "Collapse Toolbars" : "Expand Toolbars"}
            >
                {isOpen ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
            </button>

            {/* Header */}
            <div className="px-4 py-3 bg-orange-600 text-white border-b border-orange-700 flex-shrink-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <h2 className="font-black text-sm uppercase tracking-widest">Settings</h2>
                        <button
                            onClick={onEditGameSettings}
                            className="p-1 hover:bg-orange-700 rounded-lg transition-colors flex-shrink-0"
                            title="Edit Game Setup"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            if (onCollapsedSectionsChange) {
                                const allCollapsed = Object.values(collapsedSectionsProp || {}).every(v => v);
                                onCollapsedSectionsChange({
                                    mapmode: !allCollapsed,
                                    layers: !allCollapsed,
                                    location: !allCollapsed,
                                    mapstyle: !allCollapsed,
                                    zonechange: !allCollapsed,
                                    pins: !allCollapsed,
                                    show: !allCollapsed,
                                    tools: !allCollapsed,
                                });
                            }
                        }}
                        className="p-1 hover:bg-orange-700 rounded-lg transition-colors flex-shrink-0"
                        title="Collapse all sections"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-[10px] opacity-80 uppercase tracking-wide flex-1">Edit Mode Controls</p>
                    {activeGame && (
                        <button
                            onClick={onOpenGameChooser}
                            className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-orange-700 hover:bg-orange-600 rounded-lg flex-shrink-0 whitespace-nowrap transition-colors cursor-pointer"
                            title="Click to switch games"
                        >
                            {activeGame.name}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                {/* MAPMODE Section - Red */}
                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && activeGame?.gameMode !== 'playzone' && (
                    <div className="bg-red-600 border-2 border-red-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('mapmode')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <MapIcon className="w-4 h-4" />
                                MAPMODE
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('mapmode') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('mapmode') && (
                            <div className="grid grid-cols-3 gap-2">
                                {/* EDITOR button - Show if user has EDITOR access OR is in EDIT/INSTRUCTOR mode */}
                                {(userAccessMode === 'EDITOR' || mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
                                    <button
                                        onClick={() => onSetMode(GameMode.EDIT)}
                                        className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${mode === GameMode.EDIT ? 'bg-black text-white' : 'bg-red-700 text-red-100 hover:bg-red-800'}`}
                                        title="Editor View"
                                    >
                                        <MapIcon className="w-4 h-4" />
                                        EDITOR
                                    </button>
                                )}
                                {/* INSTRUCTOR button - Show if user has EDITOR/INSTRUCTOR access OR is currently in EDIT/INSTRUCTOR mode */}
                                {(userAccessMode === 'EDITOR' || userAccessMode === 'INSTRUCTOR' || mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
                                    <button
                                        onClick={() => onSetMode(GameMode.INSTRUCTOR)}
                                        className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${mode === GameMode.INSTRUCTOR ? 'bg-black text-white' : 'bg-red-700 text-red-100 hover:bg-red-800'}`}
                                        title="Instructor View"
                                    >
                                        <Shield className="w-4 h-4" />
                                        INSTRUCTOR
                                    </button>
                                )}
                                {/* TEAM button - Show for all access modes */}
                                <button
                                    onClick={() => onSetMode(GameMode.PLAY)}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${mode === GameMode.PLAY ? 'bg-black text-white' : 'bg-red-700 text-red-100 hover:bg-red-800'}`}
                                    title="Team View"
                                >
                                    <Users className="w-4 h-4" />
                                    TEAM
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* LAYERS Section - Cyan */}
                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
                    <div className="bg-cyan-600 border-2 border-cyan-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('layers')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                LAYERS
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('layers') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('layers') && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={onToggleMapLayer}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${showMapLayer !== false ? 'bg-black text-white' : 'bg-cyan-700 text-cyan-100 hover:bg-cyan-800'}`}
                                    title="Toggle Map Layer"
                                >
                                    <Globe className="w-4 h-4" />
                                    MAP
                                </button>
                                <button
                                    onClick={onToggleZoneLayer}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${showZoneLayer !== false ? 'bg-black text-white' : 'bg-cyan-700 text-cyan-100 hover:bg-cyan-800'}`}
                                    title="Toggle Zone Layer"
                                >
                                    <Skull className="w-4 h-4" />
                                    ZONES
                                </button>
                                <button
                                    onClick={onToggleTaskLayer}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${showTaskLayer !== false ? 'bg-black text-white' : 'bg-cyan-700 text-cyan-100 hover:bg-cyan-800'}`}
                                    title="Toggle Task Layer"
                                >
                                    <Target className="w-4 h-4" />
                                    TASKS
                                </button>
                                <button
                                    onClick={onToggleLiveLayer}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${showLiveLayer !== false ? 'bg-black text-white' : 'bg-cyan-700 text-cyan-100 hover:bg-cyan-800'}`}
                                    title="Toggle Live Layer"
                                >
                                    <Users className="w-4 h-4" />
                                    LIVE
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* LOCATION Section - Green */}
                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && activeGame?.gameMode !== 'playzone' && (
                    <div className="bg-green-600 border-2 border-green-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('location')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <TargetIcon className="w-4 h-4" />
                                LOCATION
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('location') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('location') && (
                            <div className="space-y-2">
                                <div className="mb-2">
                                    <LocationSearch
                                        onSelectLocation={onSearchLocation}
                                        hideSearch={false}
                                        locateFeedback={locateFeedback}
                                        compact={true}
                                        showLabels={false}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={onLocateMe}
                                        className="py-2 px-2 bg-green-700 hover:bg-green-800 text-green-100 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                        title="Locate Me"
                                    >
                                        <TargetIcon className="w-4 h-4" />
                                        LOCATE
                                    </button>
                                    <button
                                        onClick={onFitBounds}
                                        className="py-2 px-2 bg-green-700 hover:bg-green-800 text-green-100 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                        title="Fit Bounds"
                                    >
                                        <Maximize className="w-4 h-4" />
                                        FIT
                                    </button>
                                    {/* MAP STYLES button hidden */}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MAPSTYLE Section - Blue - Hidden in Instructor Mode */}
                {mode !== GameMode.INSTRUCTOR && (mode === GameMode.EDIT || mode === GameMode.PLAY) && activeGame?.gameMode !== 'playzone' && (
                    <div className="bg-blue-600 border-2 border-blue-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('mapstyle')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                MAPSTYLE
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('mapstyle') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('mapstyle') && (
                            <div className="grid grid-cols-3 gap-2">
                                {MAP_STYLES_LIST.map((style) => {
                                    const Icon = style.icon;
                                    const isActive = mapStyle === style.id;

                                    return (
                                        <button
                                            key={style.id}
                                            onClick={() => onSetMapStyle(style.id)}
                                            className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${
                                                isActive
                                                    ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                                    : 'bg-blue-700 hover:bg-blue-800 text-blue-100'
                                            }`}
                                            title={style.label}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="text-[9px] leading-tight text-center">{style.label}</span>
                                            {isActive && (
                                                <Check className="w-3 h-3 absolute top-1 right-1" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* DEVICE Section - Cyan/Indigo - EDIT mode only */}
                {mode === GameMode.EDIT && (
                    <div className="bg-indigo-600 border-2 border-indigo-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('device')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4" />
                                DEVICE
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('device') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('device') && (
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => onTeamEditDeviceChange?.('mobile')}
                                    className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${
                                        teamEditDevice === 'mobile'
                                            ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                            : 'bg-indigo-700 hover:bg-indigo-800 text-indigo-100'
                                    }`}
                                    title="Mobile Device Preview"
                                >
                                    <Smartphone className="w-4 h-4" />
                                    <span className="text-[9px] leading-tight text-center">Mobile</span>
                                </button>

                                <button
                                    onClick={() => onTeamEditDeviceChange?.('tablet')}
                                    className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${
                                        teamEditDevice === 'tablet'
                                            ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                            : 'bg-indigo-700 hover:bg-indigo-800 text-indigo-100'
                                    }`}
                                    title="Tablet Device Preview"
                                >
                                    <Tablet className="w-4 h-4" />
                                    <span className="text-[9px] leading-tight text-center">Tablet</span>
                                </button>

                                <button
                                    onClick={() => onTeamEditDeviceChange?.('desktop')}
                                    className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${
                                        teamEditDevice === 'desktop'
                                            ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                            : 'bg-indigo-700 hover:bg-indigo-800 text-indigo-100'
                                    }`}
                                    title="Desktop Fullscreen Editing"
                                >
                                    <Monitor className="w-4 h-4" />
                                    <span className="text-[9px] leading-tight text-center">Desktop</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ORIENTATION Section - Green - EDIT mode only, hidden when Desktop */}
                {mode === GameMode.EDIT && teamEditDevice !== 'desktop' && (
                    <div className="bg-green-600 border-2 border-green-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('orientation')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <RotateCw className="w-4 h-4" />
                                ORIENTATION
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('orientation') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('orientation') && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => onTeamEditOrientationChange?.('portrait')}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${
                                            teamEditOrientation === 'portrait'
                                                ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                                : 'bg-green-700 hover:bg-green-800 text-green-100'
                                        }`}
                                        title="Portrait Orientation"
                                    >
                                        <span>⬜</span>
                                        <span className="text-[9px] leading-tight">Portrait</span>
                                    </button>

                                    <button
                                        onClick={() => onTeamEditOrientationChange?.('landscape')}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${
                                            teamEditOrientation === 'landscape'
                                                ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                                : 'bg-green-700 hover:bg-green-800 text-green-100'
                                        }`}
                                        title="Landscape Orientation"
                                    >
                                        <span>⬛</span>
                                        <span className="text-[9px] leading-tight">Landscape</span>
                                    </button>
                                </div>

                                <button
                                    onClick={() => onTeamEditOrientationLockToggle?.(!teamEditOrientationLocked)}
                                    className={`w-full py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all ${
                                        teamEditOrientationLocked
                                            ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                            : 'bg-green-700 hover:bg-green-800 text-green-100'
                                    }`}
                                    title="Lock orientation to prevent auto-rotate"
                                >
                                    {teamEditOrientationLocked ? (
                                        <>
                                            <Lock className="w-3.5 h-3.5" />
                                            <span>LOCKED</span>
                                        </>
                                    ) : (
                                        <>
                                            <Unlock className="w-3.5 h-3.5" />
                                            <span>UNLOCKED</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ZONE CHANGE Section - Yellow with glow when active, Pink when game ended (NO glow when ended) */}
                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && zoneChanges && zoneChanges.length > 0 && (() => {
                    const now = Date.now();
                    // Only show as active if enabled, not triggered, AND targetTime is in the future
                    const hasActiveZoneChanges = zoneChanges.some(zc =>
                        zc.enabled && !zc.hasTriggered && zc.targetTime && zc.targetTime > now
                    );
                    // Check if game has ended OR if timer has run out (timeLeft is at or below 0)
                    const isGameEnded = activeGame?.state === 'ended' || activeGame?.state === 'ending' || (timerConfig && timerConfig.timeLeft <= 0);

                    return (
                        <div className={`${
                            isGameEnded
                                ? 'bg-pink-600 border-2 border-pink-500'
                                : hasActiveZoneChanges
                                    ? 'bg-yellow-600 border-2 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.6)] animate-pulse'
                                    : 'bg-orange-600 border-2 border-orange-500'
                        } rounded-xl p-3 space-y-3`}>
                            <button
                                onClick={() => toggleSection('zonechange')}
                                className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                            >
                                <span className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    ZONE CHANGE
                                    {zoneChanges.filter(zc => zc.enabled && !zc.hasTriggered).length > 0 && (
                                        <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                                            isGameEnded
                                                ? 'bg-pink-700'
                                                : hasActiveZoneChanges
                                                    ? 'bg-yellow-700'
                                                    : 'bg-orange-700'
                                        }`}>
                                            {zoneChanges.filter(zc => zc.enabled && !zc.hasTriggered).length}
                                        </span>
                                    )}
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('zonechange') ? '' : '-rotate-90'}`} />
                            </button>

                            {isVisible('zonechange') && (
                                <div className="space-y-2">
                                    {zoneChanges.map((zc, index) => {
                                        const now = Date.now();
                                        const hasActiveZoneChanges = zoneChanges.some(zc =>
                                            zc.enabled && !zc.hasTriggered && zc.targetTime && zc.targetTime > now
                                        );

                                        return (
                                            <ZoneChangeItem
                                                key={zc.id}
                                                id={zc.id}
                                                index={index}
                                                title={zc.title}
                                                enabled={zc.enabled}
                                                hasTriggered={zc.hasTriggered}
                                                targetTime={zc.targetTime}
                                                hasActiveZoneChanges={hasActiveZoneChanges}
                                                isGameEnded={isGameEnded}
                                                onClick={() => {
                                                    if (onAdjustZoneChange) {
                                                        onAdjustZoneChange(zc.id);
                                                    }
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* PINS Section - Pink - Hidden in Instructor Mode */}
                {mode !== GameMode.INSTRUCTOR && (mode === GameMode.EDIT || mode === GameMode.PLAY) && activeGame?.gameMode !== 'playzone' && (
                    <div className="bg-pink-600 border-2 border-pink-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('pins')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <SkullIcon className="w-4 h-4" />
                                PINS
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('pins') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('pins') && (
                            <div className="space-y-3">
                                {/* PINS Action Buttons */}
                                <div className="grid grid-cols-2 gap-2">
                                    {/* DANGER ZONE - Available to both EDIT and INSTRUCTOR */}
                                    <button
                                        onClick={onAddDangerZone}
                                        className="py-2 px-2 bg-pink-700 hover:bg-pink-800 text-pink-100 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                        title="Danger Zone"
                                    >
                                        <SkullIcon className="w-4 h-4" />
                                        DANGER
                                    </button>

                                    {/* MEASURE - EDIT mode only */}
                                    {mode === GameMode.EDIT && (
                                        <button
                                            onClick={onToggleMeasure}
                                            className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${isMeasuring ? 'bg-black text-white' : 'bg-pink-700 hover:bg-pink-800 text-pink-100'}`}
                                            title="Measure"
                                        >
                                            <Ruler className="w-4 h-4" />
                                            MEASURE
                                        </button>
                                    )}

                                    {/* RELOCATE - EDIT mode only */}
                                    {mode === GameMode.EDIT && (
                                        <button
                                            onClick={onRelocateGame}
                                            className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${isRelocating ? 'bg-black text-white' : 'bg-pink-700 hover:bg-pink-800 text-pink-100'}`}
                                            title="Relocate All Tasks"
                                        >
                                            <Crosshair className="w-4 h-4" />
                                            RELOCATE
                                        </button>
                                    )}

                                    {/* SELECT TOOLS - EDIT mode only */}
                                    {mode === GameMode.EDIT && onToggleSnapToRoad && (
                                        <button
                                            onClick={onToggleSnapToRoad}
                                            className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${snapToRoadMode ? 'bg-cyan-600 text-white' : 'bg-pink-700 hover:bg-pink-800 text-pink-100'}`}
                                            title="Select Tasks Tool - Draw rectangle to select tasks"
                                        >
                                            <TargetIcon className="w-4 h-4" />
                                            SELECT
                                        </button>
                                    )}

                                    {/* SNAP - EDIT mode only, only active when tasks are selected */}
                                    {mode === GameMode.EDIT && onExecuteSnap && (
                                        <button
                                            onClick={onExecuteSnap}
                                            disabled={selectedSnapTaskCount === 0}
                                            className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${
                                                selectedSnapTaskCount > 0
                                                    ? 'bg-green-700 hover:bg-green-800 text-white cursor-pointer'
                                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                                            }`}
                                            title={selectedSnapTaskCount > 0 ? `Snap ${selectedSnapTaskCount} task${selectedSnapTaskCount !== 1 ? 's' : ''} to road` : 'Select tasks first using SELECT button'}
                                        >
                                            <Navigation className="w-4 h-4" />
                                            SNAP
                                            {selectedSnapTaskCount > 0 && (
                                                <span className="text-[8px] font-black">({selectedSnapTaskCount})</span>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* PIN SETTINGS Divider */}
                                <div className="h-px bg-gradient-to-r from-pink-400 via-pink-300 to-transparent"></div>

                                {/* PIN SETTINGS Section */}
                                <div className="space-y-3">
                                    {/* Pin Visibility Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-3 h-3 text-pink-200" />
                                            <span className="text-[10px] font-bold text-pink-100 uppercase tracking-wide">Show Task Pins</span>
                                        </div>
                                        <button
                                            onClick={() => {/* TODO: Toggle pin visibility */}}
                                            className="px-3 py-1 bg-pink-700 text-white rounded text-[9px] font-bold uppercase tracking-wide hover:bg-pink-800 transition-colors"
                                        >
                                            ON
                                        </button>
                                    </div>

                                    {/* Pin Labels Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Hash className="w-3 h-3 text-pink-200" />
                                            <span className="text-[10px] font-bold text-pink-100 uppercase tracking-wide">Show Labels</span>
                                        </div>
                                        <button
                                            onClick={() => {/* TODO: Toggle labels */}}
                                            className="px-3 py-1 bg-pink-700 text-white rounded text-[9px] font-bold uppercase tracking-wide hover:bg-pink-800 transition-colors"
                                        >
                                            ON
                                        </button>
                                    </div>

                                    {/* Pin Size Control */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-pink-100 uppercase tracking-wide">Pin Size</span>
                                            <span className="text-[9px] font-bold text-pink-200">100%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="50"
                                            max="150"
                                            defaultValue="100"
                                            className="w-full h-2 bg-pink-700 dark:bg-pink-800 rounded-lg appearance-none cursor-pointer accent-pink-400"
                                            onChange={(e) => {/* TODO: Update pin size */}}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SHOW Section - Purple */}
                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                    <div className="bg-yellow-600 border-2 border-yellow-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('show')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                SHOW
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('show') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('show') && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={onToggleTaskId}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showTaskId ? 'bg-black text-white' : 'bg-yellow-700 hover:bg-yellow-800 text-yellow-100'}`}
                                        title="Toggle Task ID"
                                    >
                                        <Hash className="w-4 h-4" />
                                        ID
                                    </button>
                                    <button
                                        onClick={onToggleTaskTitle}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showTaskTitle ? 'bg-black text-white' : 'bg-yellow-700 hover:bg-yellow-800 text-yellow-100'}`}
                                        title="Toggle Task Title"
                                    >
                                        <Type className="w-4 h-4" />
                                        TITLE
                                    </button>
                                    <button
                                        onClick={onToggleScores}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showScores ? 'bg-black text-white' : 'bg-yellow-700 hover:bg-yellow-800 text-yellow-100'}`}
                                        title="Toggle Scores"
                                    >
                                        <Trophy className="w-4 h-4" />
                                        SCORES
                                    </button>
                                    <button
                                        onClick={onToggleTaskActions}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showTaskActions ? 'bg-black text-white' : 'bg-yellow-700 hover:bg-yellow-800 text-yellow-100'}`}
                                        title="Toggle Task Actions"
                                    >
                                        <GitBranch className="w-4 h-4" />
                                        ACTIONS
                                    </button>
                                </div>

                                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && onToggleTeamPathSelector && (
                                    <button
                                        onClick={onToggleTeamPathSelector}
                                        className={`w-full py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-between transition-all ${showTeamPathSelector || selectedTeamPaths.length > 0 ? 'bg-black text-white' : 'bg-yellow-700 hover:bg-yellow-800 text-yellow-100'}`}
                                        title="Select Teams to Track - Shows historic path as dotted lines"
                                    >
                                        <span className="flex items-center gap-2">
                                            <RouteIcon className="w-4 h-4" />
                                            TEAM PATHS
                                        </span>
                                        {selectedTeamPaths.length > 0 && (
                                            <span className="bg-amber-500 rounded-full px-2 text-xs font-black">{selectedTeamPaths.length}</span>
                                        )}
                                    </button>
                                )}

                                <div className="relative">
                                    <button
                                        onClick={() => setShowToolbarsMenu(!showToolbarsMenu)}
                                        className="w-full py-2 px-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all"
                                        title="Select Toolbars to Display"
                                    >
                                        <GripHorizontal className="w-4 h-4" />
                                        TOOLBARS
                                    </button>

                                    {showToolbarsMenu && (
                                        <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900 border-2 border-indigo-600 rounded-lg p-3 shadow-xl z-50 space-y-2">
                                            <div className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-2">Show Toolbars on Map:</div>

                                            {[
                                                { id: 'mapmode', label: 'MAPMODE', bgActive: 'bg-red-700', borderActive: 'border-red-500', bgCheck: 'bg-red-600', borderCheck: 'border-red-400' },
                                                { id: 'layers', label: 'LAYERS', bgActive: 'bg-cyan-700', borderActive: 'border-cyan-500', bgCheck: 'bg-cyan-600', borderCheck: 'border-cyan-400' },
                                                { id: 'location', label: 'LOCATION', bgActive: 'bg-green-700', borderActive: 'border-green-500', bgCheck: 'bg-green-600', borderCheck: 'border-green-400' },
                                                { id: 'pins', label: 'PINS', bgActive: 'bg-yellow-700', borderActive: 'border-yellow-500', bgCheck: 'bg-yellow-600', borderCheck: 'border-yellow-400' },
                                                { id: 'show', label: 'SHOW', bgActive: 'bg-purple-700', borderActive: 'border-purple-500', bgCheck: 'bg-purple-600', borderCheck: 'border-purple-400' },
                                                { id: 'tools', label: 'TOOLS', bgActive: 'bg-slate-600', borderActive: 'border-slate-500', bgCheck: 'bg-slate-500', borderCheck: 'border-slate-400' },
                                            ].map(toolbar => (
                                                <button
                                                    key={toolbar.id}
                                                    onClick={() => {
                                                        if (onToggleToolbarVisibility) {
                                                            onToggleToolbarVisibility(toolbar.id);
                                                        }
                                                    }}
                                                    className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${
                                                        visibleToolbars[toolbar.id]
                                                            ? `${toolbar.bgActive} text-white border-2 ${toolbar.borderActive}`
                                                            : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:text-slate-300'
                                                    }`}
                                                >
                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                        visibleToolbars[toolbar.id]
                                                            ? `${toolbar.bgCheck} ${toolbar.borderCheck}`
                                                            : 'border-slate-600'
                                                    }`}>
                                                        {visibleToolbars[toolbar.id] && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    {toolbar.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Reset Toolbar Positions Button */}
                                {onResetToolbarPositions && (
                                    <button
                                        onClick={onResetToolbarPositions}
                                        className="w-full py-2 px-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all"
                                        title="Reset all toolbar positions to default"
                                    >
                                        <Target className="w-4 h-4" />
                                        RESET POSITIONS
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* TOOLS Section - Slate */}
                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && activeGame?.gameMode !== 'playzone' && (
                    <div className="bg-slate-700 border-2 border-slate-600 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('tools')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                TOOLS
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('tools') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('tools') && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={onToggleChat}
                                        className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                        title="Chat"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        CHAT
                                    </button>
                                    {/* SETTINGS button hidden */}

                                    {/* DANGER button for Instructor Mode */}
                                    {mode === GameMode.INSTRUCTOR && onAddDangerZone && (
                                        <button
                                            onClick={onAddDangerZone}
                                            className="py-2 px-2 bg-yellow-700 hover:bg-yellow-800 text-yellow-100 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                            title="Add Danger Zone"
                                        >
                                            <SkullIcon className="w-4 h-4" />
                                            DANGER
                                        </button>
                                    )}

                                    {mode === GameMode.EDIT && timerConfig && (
                                        <button
                                            onClick={onAdjustGameTime}
                                            className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showAdjustGameTime ? 'bg-cyan-700 text-cyan-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
                                            title="Set Game Time"
                                        >
                                            <Clock className="w-4 h-4" />
                                            SET GAME TIME
                                        </button>
                                    )}

                                    {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && onStartSimulation && activeGame?.gameMode !== 'playzone' && (
                                        <button
                                            onClick={onStartSimulation}
                                            className="py-2 px-2 bg-green-700 hover:bg-green-800 text-green-200 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                            title="Start Simulator"
                                        >
                                            <Play className="w-4 h-4" />
                                            SIMULATOR
                                        </button>
                                    )}

                                    {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && onEditGameSettings && (
                                        <button
                                            onClick={onEditGameSettings}
                                            className="py-2 px-2 bg-indigo-700 hover:bg-indigo-800 text-indigo-200 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                            title="Edit Game Settings"
                                        >
                                            <Settings className="w-4 h-4" />
                                            SETTINGS
                                        </button>
                                    )}

                                    {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && onOpenRemoteOverride && (
                                        <div className="relative group">
                                            <button
                                                onClick={onOpenRemoteOverride}
                                                className="py-2 px-2 bg-orange-700 hover:bg-orange-800 text-orange-200 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                                title="Remote Override"
                                            >
                                                <Zap className="w-4 h-4" />
                                                OVERRIDE
                                            </button>
                                            <div className="absolute -top-2 -right-2 z-[9999]">
                                                <InfoBox
                                                    title="REMOTE OVERRIDE"
                                                    className="left-full ml-2 -top-2 w-72"
                                                >
                                                    <div className="space-y-2">
                                                        <p className="font-semibold text-blue-300">What it does:</p>
                                                        <ul className="list-disc list-inside space-y-1 text-slate-300">
                                                            <li><strong>Force Complete:</strong> Mark a task as completed for a specific team, even if they haven&apos;t solved it</li>
                                                            <li><strong>Teleport Team:</strong> Instantly move a team to a different location on the map</li>
                                                        </ul>
                                                        <p className="font-semibold text-blue-300 mt-3">How to use:</p>
                                                        <ol className="list-decimal list-inside space-y-1 text-slate-300">
                                                            <li>Click the OVERRIDE button to open the modal</li>
                                                            <li>Select a team from the dropdown</li>
                                                            <li>Choose an action: Force Complete or Teleport</li>
                                                            <li>For Force Complete: select the task to mark complete</li>
                                                            <li>For Teleport: click on the map to choose destination</li>
                                                            <li>Confirm to apply the override</li>
                                                        </ol>
                                                        <p className="text-slate-400 text-[10px] italic mt-3">
                                                            Use this for emergency game management when teams are stuck or need redirection.
                                                        </p>
                                                    </div>
                                                </InfoBox>
                                            </div>
                                        </div>
                                    )}

                                    {mode === GameMode.INSTRUCTOR && onOpenLiveApproval && (
                                        <button
                                            onClick={onOpenLiveApproval}
                                            className="py-2 px-2 bg-purple-700 hover:bg-purple-800 text-purple-200 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all relative"
                                            title="Live Approval"
                                        >
                                            <Eye className="w-4 h-4" />
                                            REVIEW
                                            {pendingApprovalsCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] font-black flex items-center justify-center animate-pulse">
                                                    {pendingApprovalsCount}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SHOW RANKING Section - Only for INSTRUCTOR mode */}
                {mode === GameMode.INSTRUCTOR && onShowRanking && (
                    <div className="bg-amber-600 border-2 border-amber-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('ranking')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <Trophy className="w-4 h-4" />
                                SHOW RANKING
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('ranking') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('ranking') && (
                            <div className="space-y-2">
                                <button
                                    onClick={onShowRanking}
                                    className="w-full py-3 px-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all"
                                    title="Show Full Screen Ranking"
                                >
                                    <Trophy className="w-5 h-5" />
                                    FULL SCREEN RANKING
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* TEAMS Section - Only for INSTRUCTOR mode */}
                {mode === GameMode.INSTRUCTOR && (
                    <div className="bg-indigo-600 border-2 border-indigo-500 rounded-xl p-3 space-y-3">
                        <button
                            onClick={() => toggleSection('teams')}
                            className="w-full flex items-center justify-between text-white font-bold uppercase text-[10px] tracking-wider"
                        >
                            <span className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                TEAMS
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isVisible('teams') ? '' : '-rotate-90'}`} />
                        </button>

                        {isVisible('teams') && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={onToggleChat}
                                        className="py-2 px-2 bg-indigo-700 hover:bg-indigo-800 text-indigo-100 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                        title="Open Chat"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        CHAT
                                    </button>
                                    {onOpenTeams && (
                                        <button
                                            onClick={onOpenTeams}
                                            className="py-2 px-2 bg-indigo-700 hover:bg-indigo-800 text-indigo-100 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                            title="Show Teams"
                                        >
                                            <Users className="w-4 h-4" />
                                            TEAMS
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ToolbarsDrawer;
