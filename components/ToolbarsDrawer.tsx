import React, { useState } from 'react';
import {
    ChevronLeft, ChevronRight, ChevronDown,
    MapIcon, Shield, Users,
    Filter, Globe, Skull, Target,
    Target as TargetIcon, Maximize, Layers,
    Skull as SkullIcon, Ruler, Crosshair, Navigation,
    Hash, Type, Trophy, GitBranch, RouteIcon,
    MessageSquare, Settings, Clock, Play, Zap, Eye,
    GripHorizontal, ScrollText, Mountain, Snowflake, Check
} from 'lucide-react';
import { Game, GameMode, LocationSearchProps, Coordinate, Team, MapStyleId } from '../types';
import LocationSearch from './LocationSearch';

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
}) => {
    const [collapsedSectionsLocal, setCollapsedSectionsLocal] = useState<Record<string, boolean>>({
        mapmode: true,
        layers: true,
        location: true,
        pins: true,
        show: true,
        tools: true,
    });
    const [showMapStylesMenu, setShowMapStylesMenu] = useState(false);
    const [showToolbarsMenu, setShowToolbarsMenu] = useState(false);

    // Use prop if provided, otherwise use local state
    const collapsedSections = collapsedSectionsProp || collapsedSectionsLocal;
    const visibleToolbars = visibleToolbarsProp || {
        mapmode: false,
        layers: false,
        location: false,
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
                            const allCollapsed = Object.values(collapsedSections).every(v => v);
                            setCollapsedSections({
                                mapmode: !allCollapsed,
                                layers: !allCollapsed,
                                location: !allCollapsed,
                                pins: !allCollapsed,
                                show: !allCollapsed,
                                tools: !allCollapsed,
                            });
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
                                <button
                                    onClick={() => onSetMode(GameMode.EDIT)}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${mode === GameMode.EDIT ? 'bg-black text-white' : 'bg-red-700 text-red-100 hover:bg-red-800'}`}
                                    title="Editor View"
                                >
                                    <MapIcon className="w-4 h-4" />
                                    EDITOR
                                </button>
                                <button
                                    onClick={() => onSetMode(GameMode.INSTRUCTOR)}
                                    className={`py-2 px-2 rounded-lg text-xs font-bold uppercase tracking-wider flex flex-col items-center gap-1 transition-all ${mode === GameMode.INSTRUCTOR ? 'bg-black text-white' : 'bg-red-700 text-red-100 hover:bg-red-800'}`}
                                    title="Instructor View"
                                >
                                    <Shield className="w-4 h-4" />
                                    INSTRUCTOR
                                </button>
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
                {mode === GameMode.EDIT && activeGame?.gameMode !== 'playzone' && (
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
                                    <div className="relative col-span-2">
                                        <button
                                            onClick={() => setShowMapStylesMenu(!showMapStylesMenu)}
                                            className="w-full py-2 px-2 bg-green-700 hover:bg-green-800 text-green-100 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                            title="Map Styles"
                                        >
                                            <Layers className="w-4 h-4" />
                                            MAP STYLES
                                        </button>

                                        {showMapStylesMenu && (
                                            <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900 border-2 border-green-600 rounded-lg p-2 shadow-xl z-50 max-h-80 overflow-y-auto">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {MAP_STYLES_LIST.map((style) => (
                                                        <button
                                                            key={style.id}
                                                            onClick={() => {
                                                                onSetMapStyle(style.id);
                                                                setShowMapStylesMenu(false);
                                                            }}
                                                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${mapStyle === style.id ? 'bg-green-700 border-green-500 shadow-lg' : 'bg-slate-800 border-slate-700 hover:border-green-600'}`}
                                                            title={style.label}
                                                        >
                                                            <div className="w-16 h-16 bg-slate-700 rounded border border-slate-600 overflow-hidden flex items-center justify-center">
                                                                {style.preview ? (
                                                                    <img
                                                                        src={style.preview}
                                                                        alt={style.label}
                                                                        className={`w-full h-full object-cover ${style.className || ''}`}
                                                                        loading="lazy"
                                                                    />
                                                                ) : (
                                                                    <style.icon className="w-8 h-8 text-slate-400" />
                                                                )}
                                                            </div>
                                                            <span className={`text-[9px] font-black uppercase tracking-wide ${mapStyle === style.id ? 'text-white' : 'text-slate-300'}`}>{style.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* PINS Section - Yellow */}
                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && activeGame?.gameMode !== 'playzone' && (
                    <div className="bg-yellow-600 border-2 border-yellow-500 rounded-xl p-3 space-y-3">
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
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={onAddDangerZone}
                                    className="py-2 px-2 bg-yellow-700 hover:bg-yellow-800 text-yellow-100 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                    title="Danger Zone"
                                >
                                    <SkullIcon className="w-4 h-4" />
                                    DANGER
                                </button>
                                <button
                                    onClick={onToggleMeasure}
                                    className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${isMeasuring ? 'bg-black text-white' : 'bg-yellow-700 hover:bg-yellow-800 text-yellow-100'}`}
                                    title="Measure"
                                >
                                    <Ruler className="w-4 h-4" />
                                    MEASURE
                                </button>
                                <button
                                    onClick={onRelocateGame}
                                    className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${isRelocating ? 'bg-black text-white' : 'bg-yellow-700 hover:bg-yellow-800 text-yellow-100'}`}
                                    title="Relocate"
                                >
                                    <Crosshair className="w-4 h-4" />
                                    RELOCATE
                                </button>
                                {mode === GameMode.EDIT && onToggleSnapToRoad && (
                                    <button
                                        onClick={onToggleSnapToRoad}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${snapToRoadMode ? 'bg-black text-white' : 'bg-yellow-700 hover:bg-yellow-800 text-yellow-100'}`}
                                        title="Snap to Road"
                                    >
                                        <Navigation className="w-4 h-4" />
                                        SNAP
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* SHOW Section - Purple */}
                {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR || mode === GameMode.PLAY) && (
                    <div className="bg-purple-600 border-2 border-purple-500 rounded-xl p-3 space-y-3">
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
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showTaskId ? 'bg-black text-white' : 'bg-purple-700 hover:bg-purple-800 text-purple-100'}`}
                                        title="Toggle Task ID"
                                    >
                                        <Hash className="w-4 h-4" />
                                        ID
                                    </button>
                                    <button
                                        onClick={onToggleTaskTitle}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showTaskTitle ? 'bg-black text-white' : 'bg-purple-700 hover:bg-purple-800 text-purple-100'}`}
                                        title="Toggle Task Title"
                                    >
                                        <Type className="w-4 h-4" />
                                        TITLE
                                    </button>
                                    <button
                                        onClick={onToggleScores}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showScores ? 'bg-black text-white' : 'bg-purple-700 hover:bg-purple-800 text-purple-100'}`}
                                        title="Toggle Scores"
                                    >
                                        <Trophy className="w-4 h-4" />
                                        SCORES
                                    </button>
                                    <button
                                        onClick={onToggleTaskActions}
                                        className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showTaskActions ? 'bg-black text-white' : 'bg-purple-700 hover:bg-purple-800 text-purple-100'}`}
                                        title="Toggle Task Actions"
                                    >
                                        <GitBranch className="w-4 h-4" />
                                        ACTIONS
                                    </button>
                                </div>

                                {mode === GameMode.EDIT && onToggleTeamPathSelector && (
                                    <button
                                        onClick={onToggleTeamPathSelector}
                                        className={`w-full py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-between transition-all ${showTeamPathSelector || selectedTeamPaths.length > 0 ? 'bg-black text-white' : 'bg-purple-700 hover:bg-purple-800 text-purple-100'}`}
                                        title="Select Teams"
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
                                    <button
                                        onClick={onEditGameSettings}
                                        className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                        title="Settings"
                                    >
                                        <Settings className="w-4 h-4" />
                                        SETTINGS
                                    </button>

                                    {mode === GameMode.EDIT && timerConfig && (
                                        <button
                                            onClick={onAdjustGameTime}
                                            className={`py-2 px-2 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all ${showAdjustGameTime ? 'bg-cyan-700 text-cyan-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
                                            title="Adjust Game Time"
                                        >
                                            <Clock className="w-4 h-4" />
                                            TIME
                                        </button>
                                    )}

                                    {mode === GameMode.EDIT && onStartSimulation && activeGame?.gameMode !== 'playzone' && (
                                        <button
                                            onClick={onStartSimulation}
                                            className="py-2 px-2 bg-green-700 hover:bg-green-800 text-green-200 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                            title="Start Simulation"
                                        >
                                            <Play className="w-4 h-4" />
                                            PLAY
                                        </button>
                                    )}

                                    {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && onOpenRemoteOverride && (
                                        <button
                                            onClick={onOpenRemoteOverride}
                                            className="py-2 px-2 bg-orange-700 hover:bg-orange-800 text-orange-200 text-xs font-bold uppercase tracking-wider rounded-lg flex flex-col items-center gap-1 transition-all"
                                            title="Remote Override"
                                        >
                                            <Zap className="w-4 h-4" />
                                            OVERRIDE
                                        </button>
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
            </div>
        </div>
    );
};

export default ToolbarsDrawer;
