import React, { useState, useEffect, useRef } from 'react';
import { Game, Playground, GamePoint, IconId, TaskTemplate, TaskList, DeviceType, PlaygroundTemplate } from '../types';
import { DEVICE_SPECS, getDeviceLayout, ensureDeviceLayouts, DEVICE_SPECS as SPECS } from '../utils/deviceUtils';
import {
    X, Plus, LayoutGrid, Globe, Map as MapIcon, ArrowLeft, Trash2, Edit2,
    Image as ImageIcon, Upload, Grid, MousePointer2, Move, ZoomIn, ZoomOut,
    Maximize, Lock, Unlock, Settings, Home, Save, Check, Type, Gamepad2, Library, Users, Shield,
    Smartphone, Tablet, Monitor, MousePointerClick, Music, Repeat, PlayCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown,
    Wand2, Zap, CheckCircle, XCircle, GripHorizontal, AlertTriangle, QrCode, Target, Loader2, MapPin, Copy, Eye, PenTool, Trophy, Download
} from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import { uploadImage } from '../services/storage'; // IMPORTED
import { generateAiImage, generateAiBackground, searchLogoUrl } from '../services/ai';
import * as db from '../services/db';
import { snapPointsToRoad, isPointInBox } from '../utils/mapbox';
import jsQR from 'jsqr';
import QRScannerModal from './QRScannerModal';
import { getGlobalCorrectSound, getGlobalIncorrectSound, getGlobalVolume } from '../utils/sounds';
import TaskActionModal from './TaskActionModal';
import AiTaskGenerator from './AiTaskGenerator';
import TaskMaster from './TaskMaster';
import TaskEditor from './TaskEditor';
import GeminiApiKeyModal from './GeminiApiKeyModal';
import TaskModal from './TaskModal';
import ConfirmationModal from './ConfirmationModal';

interface PlaygroundEditorProps {
  game: Game;
  onUpdateGame: (game: Game) => void;
  onClose: () => void;
  onEditPoint: (point: GamePoint) => void;
  onPointClick: (point: GamePoint) => void;
  onAddTask: (type: 'MANUAL' | 'AI' | 'LIBRARY', playgroundId?: string) => void;
  onOpenLibrary: (playgroundId: string) => void;
  showScores: boolean;
  onToggleScores: () => void;
  onHome: () => void;
  onSaveTemplate?: (name: string) => void;
  isTemplateMode: boolean;
  onAddZoneFromLibrary: () => void;
  onOpenPlayground?: (id: string) => void; // Optional prop for compatibility
  isAdmin?: boolean; // Admin privilege for task status marking
  onStartSimulation?: () => void; // Start simulation mode from editor
  taskLists: TaskList[]; // Task lists for TaskMaster
  onUpdateTaskLists: (lists: TaskList[]) => void; // Update task lists
  taskLibrary: TaskTemplate[]; // Task library for TaskMaster
  onUpdateTaskLibrary: (library: TaskTemplate[]) => void; // Update task library
  onOpenGameSettings?: () => void; // Open game settings
  onExportGameToLibrary?: () => void; // Export all tasks to library
  isInstructorView?: boolean; // NEW: View as instructor (player perspective, read-only)
  pendingDrawTrigger?: 'onOpen' | 'onCorrect' | 'onIncorrect' | null; // NEW: Activate draw mode on mount
  activeTaskActionPoint?: GamePoint | null; // NEW: Task being edited for draw mode
  onDrawModeActivated?: () => void; // NEW: Callback when draw mode is activated from pendingDrawTrigger
  onDrawModeDeactivated?: () => void; // NEW: Callback when draw mode is deactivated
}

const PlaygroundEditor: React.FC<PlaygroundEditorProps> = ({
    game,
    onUpdateGame,
    onClose,
    onEditPoint,
    onPointClick,
    onAddTask,
    onOpenLibrary,
    showScores,
    onToggleScores,
    onHome,
    onSaveTemplate,
    isTemplateMode,
    onAddZoneFromLibrary,
    taskLists,
    onUpdateTaskLists,
    taskLibrary,
    onUpdateTaskLibrary,
    isAdmin = false,
    onStartSimulation,
    onOpenGameSettings,
    onExportGameToLibrary,
    isInstructorView = false, // NEW: View as instructor (player perspective, read-only)
    pendingDrawTrigger = null, // NEW: Activate draw mode on mount
    activeTaskActionPoint = null, // NEW: Task being edited for draw mode
    onDrawModeActivated, // NEW: Callback when draw mode is activated
    onDrawModeDeactivated // NEW: Callback when draw mode is deactivated
}) => {
    // State
    const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    const [isDrawerOpen, setIsDrawerOpen] = useState(true); // Open by default
    const [isTasksDrawerOpen, setIsTasksDrawerOpen] = useState(true); // Open by default
    const [showGrid, setShowGrid] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showAiTaskGenerator, setShowAiTaskGenerator] = useState(false);
    const [showTaskScores, setShowTaskScores] = useState(true);
    const [showTaskOrder, setShowTaskOrder] = useState(true);
    const [showTaskActions, setShowTaskActions] = useState(true);
    const [showTaskStatus, setShowTaskStatus] = useState(true);
    const [showTaskNames, setShowTaskNames] = useState(true);
    const [showBackground, setShowBackground] = useState(true);
    const [isBackgroundLocked, setIsBackgroundLocked] = useState(false);

    // Delete Zone Confirmation Modal State
    const [deleteZoneConfirm, setDeleteZoneConfirm] = useState<{
        isOpen: boolean;
        zoneName: string;
        taskCount: number;
    }>({
        isOpen: false,
        zoneName: '',
        taskCount: 0,
    });

    // Simulation Mode State
    const [isSimulationActive, setIsSimulationActive] = useState(false);
    const [simulationScore, setSimulationScore] = useState(0);
    const [simulationTeam, setSimulationTeam] = useState<any | null>(null);
    const [showRanking, setShowRanking] = useState(false);
    const [rankingPos, setRankingPos] = useState({ x: window.innerWidth - 350, y: 100 });
    const [isDraggingRanking, setIsDraggingRanking] = useState(false);
    const rankingDragOffset = useRef({ x: 0, y: 0 });
    const [activeSimulationTaskId, setActiveSimulationTaskId] = useState<string | null>(null);

    // Audio refs for simulation mode
    const simulationBgAudioRef = useRef<HTMLAudioElement | null>(null);

    // Draw Mode State for Visual Connections
    const [drawMode, setDrawMode] = useState<{
        active: boolean;
        trigger: 'onOpen' | 'onCorrect' | 'onIncorrect' | null;
        sourceTaskId: string | null;
        mousePosition: { x: number; y: number } | null;
    }>({ active: false, trigger: null, sourceTaskId: null, mousePosition: null });

    const editorRootRef = useRef<HTMLDivElement>(null);
    const drawCanvasRef = useRef<HTMLDivElement>(null);

    const getDefaultEditorToolbarPositions = () => {
        const rootWidth = editorRootRef.current?.getBoundingClientRect().width || (typeof window !== 'undefined' ? window.innerWidth : 1200);

        // Default: top row under the header (matches the desired "Picture 2" desktop layout)
        const y = 88;

        // Approximate widths (used only to compute non-overlapping start X positions)
        const gap = 14;
        const orientationW = 470;
        const showW = 320;
        const toolsW = 320;

        const totalW = orientationW + showW + toolsW + gap * 2;
        const startX = Math.max(20, Math.round((rootWidth - totalW) / 2));

        return {
            orientation: { x: startX, y },
            show: { x: startX + orientationW + gap, y },
            tools: { x: startX + orientationW + gap + showW + gap, y },
        };
    };

    // Toolbar positions (draggable) - Default spread-out positions to avoid overlap
    const initialToolbarDefaults = getDefaultEditorToolbarPositions();
    const [orientationToolbarPos, setOrientationToolbarPos] = useState(initialToolbarDefaults.orientation);
    const [showToolbarPos, setShowToolbarPos] = useState(initialToolbarDefaults.show);
    const [toolsToolbarPos, setToolsToolbarPos] = useState(initialToolbarDefaults.tools);
    const [qrScannerPos, setQRScannerPos] = useState({ x: 85, y: 85 }); // Percentage-based positioning (85%, 85%)
    const [qrScannerSize, setQRScannerSize] = useState({ width: 140, height: 48 });
    const [qrScannerColor, setQRScannerColor] = useState('#f97316'); // Orange-500
    const [isDraggingOrientation, setIsDraggingOrientation] = useState(false);
    const [isDraggingShow, setIsDraggingShow] = useState(false);
    const [isDraggingTools, setIsDraggingTools] = useState(false);
    const [isDraggingQRScanner, setIsDraggingQRScanner] = useState(false);
    const [isResizingQRScanner, setIsResizingQRScanner] = useState(false);
    const [showQRColorPicker, setShowQRColorPicker] = useState(false);
    const [isQRScannerActive, setIsQRScannerActive] = useState(false);
    const [qrScannedValue, setQRScannedValue] = useState<string | null>(null);
    const qrScannerResizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 });
    const qrScannerDidDrag = useRef(false);
    const qrScannerClickTimer = useRef<NodeJS.Timeout | null>(null);
    const qrScannerClickCount = useRef(0);
    const qrScannerButtonDownPos = useRef({ x: 0, y: 0 });
    const qrScannerHasMoved = useRef(false);

    // Title Text State
    const [titleTextPos, setTitleTextPos] = useState({ x: 50, y: 10 }); // Percentage-based positioning
    const [titleTextSize, setTitleTextSize] = useState({ width: 300, height: 60 }); // Pixels
    const [titleTextContent, setTitleTextContent] = useState('');
    const [titleTextColor, setTitleTextColor] = useState('#ffffff'); // White
    const [titleTextFontSize, setTitleTextFontSize] = useState(28);
    const [showTitleText, setShowTitleText] = useState(false);
    const [isDraggingTitleText, setIsDraggingTitleText] = useState(false);
    const [isResizingTitleText, setIsResizingTitleText] = useState(false);
    const [showTitleTextEditor, setShowTitleTextEditor] = useState(false);
    const titleTextDragOffset = useRef({ x: 0, y: 0 });
    const titleTextResizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 });

    // Device-specific layout management
    // Smart device initialization: desktop for new playgrounds, last used for existing
    const [selectedDevice, setSelectedDevice] = useState<DeviceType>(() => {
        // Check if this is a new playground (no tasks yet)
        const playgroundId = game.playgrounds?.[0]?.id || activePlaygroundId;
        const playgroundTasks = game.points?.filter(p => p.playgroundId === playgroundId) || [];
        const isNewPlayground = playgroundTasks.length === 0;

        if (isNewPlayground) {
            // New playground: start with desktop mode
            return 'desktop';
        } else {
            // Existing playground: load last used device from localStorage
            const storageKey = `playzone_device_${playgroundId}`;
            const savedDevice = localStorage.getItem(storageKey);
            return (savedDevice as DeviceType) || 'desktop';
        }
    });
    const [deviceLayoutsCache, setDeviceLayoutsCache] = useState<Record<DeviceType, any> | null>(null);
    const orientationDragOffset = useRef({ x: 0, y: 0 });
    const showDragOffset = useRef({ x: 0, y: 0 });
    const toolsDragOffset = useRef({ x: 0, y: 0 });
    const qrScannerDragOffset = useRef({ x: 0, y: 0 });
    const qrVideoRef = useRef<HTMLVideoElement>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const qrStreamRef = useRef<MediaStream | null>(null);
    const qrScanIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const [editorOrientation, setEditorOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [showAiIconPrompt, setShowAiIconPrompt] = useState(false);
    const [aiIconPromptValue, setAiIconPromptValue] = useState('');
    const [showLogoPrompt, setShowLogoPrompt] = useState(false);
    const [logoCompanyName, setLogoCompanyName] = useState('');
    const [isSearchingLogo, setIsSearchingLogo] = useState(false);
    const [editingCompletedIcon, setEditingCompletedIcon] = useState(false); // Track if editing completed icon
    const [isMarkMode, setIsMarkMode] = useState(false);
    const [markedTaskIds, setMarkedTaskIds] = useState<Set<string>>(new Set());
    const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
    const [showQRScanner, setShowQRScanner] = useState(true);
    const [showTaskMaster, setShowTaskMaster] = useState(false);
    const [taskMasterTab, setTaskMasterTab] = useState<'LIBRARY' | 'LISTS'>('LIBRARY');
    const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
    const [editingTitleValue, setEditingTitleValue] = useState('');
    const [taskSortMode, setTaskSortMode] = useState<'order' | 'actions'>('order');
    const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set());
    const [bulkIconSourceId, setBulkIconSourceId] = useState<string | null>(null);
    const [bulkIconMode, setBulkIconMode] = useState(false);
    const [bulkIconTargets, setBulkIconTargets] = useState<Set<string>>(new Set());

    // Playzone selection for task/AI import
    const [showPlayzoneSelector, setShowPlayzoneSelector] = useState(false);
    const [pendingTasksToAdd, setPendingTasksToAdd] = useState<TaskTemplate[]>([]);
    const [isAddingAITasks, setIsAddingAITasks] = useState(false);
    const [isAddingTaskList, setIsAddingTaskList] = useState(false);

    // AI Background Generation
    const [showAiBackgroundPrompt, setShowAiBackgroundPrompt] = useState(false);
    const [aiBackgroundPromptValue, setAiBackgroundPromptValue] = useState('');
    const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
    const [showGeminiKeyModal, setShowGeminiKeyModal] = useState(false);
    const [pendingBackgroundKeywords, setPendingBackgroundKeywords] = useState<string | null>(null);

    // Delete Zone State
    const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);

    // Collapse State for Left Drawer Sections (default: all collapsed)
    const [isHudAppearanceCollapsed, setIsHudAppearanceCollapsed] = useState(true);
    const [isBackgroundImageCollapsed, setIsBackgroundImageCollapsed] = useState(true);
    const [isBackgroundMusicCollapsed, setIsBackgroundMusicCollapsed] = useState(true);
    const [isDeviceCollapsed, setIsDeviceCollapsed] = useState(true); // Collapsed by default
    const [isOrientationCollapsed, setIsOrientationCollapsed] = useState(true); // Collapsed by default
    const [isShowCollapsed, setIsShowCollapsed] = useState(true); // Collapsed by default
    const [isLayoutCollapsed, setIsLayoutCollapsed] = useState(true); // Collapsed by default

    // Toggle all sections collapsed/expanded (excluding HUD appearance)
    const toggleAllSections = () => {
        // Check if any section is expanded (excluding HUD)
        const anyExpanded = !isBackgroundImageCollapsed ||
                           !isBackgroundMusicCollapsed || !isDeviceCollapsed ||
                           !isOrientationCollapsed || !isShowCollapsed || !isLayoutCollapsed;

        // If any are expanded, collapse all. Otherwise, expand all.
        const newState = anyExpanded;
        setIsBackgroundImageCollapsed(newState);
        setIsBackgroundMusicCollapsed(newState);
        setIsDeviceCollapsed(newState);
        setIsOrientationCollapsed(newState);
        setIsShowCollapsed(newState);
        setIsLayoutCollapsed(newState);
    };

    // Snap to Road State
    const [snapToRoadMode, setSnapToRoadMode] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{ start: { x: number; y: number } | null; current: { x: number; y: number } | null }>({ start: null, current: null });

    // Task Settings Modal State
    const [showTaskSettingsModal, setShowTaskSettingsModal] = useState(false);
    const [settingsModalTaskId, setSettingsModalTaskId] = useState<string | null>(null);
    const [showTaskViewModal, setShowTaskViewModal] = useState(false);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const taskIconInputRef = useRef<HTMLInputElement>(null);
    const completedTaskIconInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const backgroundRef = useRef<HTMLDivElement>(null);

    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [dragVisualPosition, setDragVisualPosition] = useState<{ x: number; y: number } | null>(null);
    const dragTaskRef = useRef<{
        id: string | null;
        offsetX: number;
        offsetY: number;
        startClientX: number;
        startClientY: number;
        moved: boolean;
    }>({ id: null, offsetX: 0, offsetY: 0, startClientX: 0, startClientY: 0, moved: false });

    // Helper function to convert GamePoint to TaskTemplate for saving to global library
    const convertPointToTemplate = (point: GamePoint): TaskTemplate => {
        // Get existing tags and ensure 'playzone' tag is added (no duplicates)
        const existingTags = Array.isArray(point.tags) ? point.tags : [];
        const tags = [...new Set([...existingTags, 'playzone'])]; // Add 'playzone' tag and remove duplicates

        return {
            id: point.id,
            title: point.title,
            task: point.task,
            tags: tags,
            iconId: point.iconId,
            createdAt: Date.now(),
            points: point.points,
            intro: point.shortIntro,
            feedback: point.feedback,
            settings: point.settings,
            logic: point.logic,
            activationTypes: point.activationTypes,
            qrCodeString: point.qrCodeString,
            nfcTagId: point.nfcTagId,
            ibeaconUUID: point.ibeaconUUID,
            colorScheme: point.colorScheme,
            isColorSchemeLocked: point.isColorSchemeLocked
        };
    };

    // Helper function to save a task to the global library
    const saveTaskToLibrary = async (point: GamePoint) => {
        const template = convertPointToTemplate(point);
        const { ok } = await db.saveTemplate(template);
        if (!ok) {
            console.error('[PlaygroundEditor] Failed to save task to global library:', point.title);
        } else {
            console.log('[PlaygroundEditor] ✅ Task saved to global library:', point.title);
        }
        return ok;
    };

    // Initialize active playground
    useEffect(() => {
        // Set active playground to first one if none selected and playgrounds exist
        if (!activePlaygroundId && uniquePlaygrounds && uniquePlaygrounds.length > 0) {
            setActivePlaygroundId(uniquePlaygrounds[0].id);
        }
    }, [uniquePlaygrounds, activePlaygroundId]);

    // ESC key listener for draw mode
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && drawMode.active) {
                setDrawMode({ active: false, trigger: null, sourceTaskId: null, mousePosition: null });
                if (onDrawModeDeactivated) {
                    onDrawModeDeactivated();
                }
            }
        };

        window.addEventListener('keydown', handleEscKey);
        return () => window.removeEventListener('keydown', handleEscKey);
    }, [drawMode.active, onDrawModeDeactivated]);

    // Activate draw mode from pending request (when DRAW button is clicked from action modal)
    useEffect(() => {
        if (pendingDrawTrigger && activeTaskActionPoint && activeTaskActionPoint.id) {
            setSelectedTaskId(activeTaskActionPoint.id);
            setDrawMode({
                active: true,
                trigger: pendingDrawTrigger,
                sourceTaskId: activeTaskActionPoint.id,
                mousePosition: null
            });
            if (onDrawModeActivated) {
                onDrawModeActivated();
            }
        }
    }, [pendingDrawTrigger, activeTaskActionPoint, onDrawModeActivated]);

    const didSeedEditorToolbarPositionsRef = useRef(false);

    // Load toolbar positions from game (device-aware)
    useEffect(() => {
        const pos = game.toolbarPositions;

        // Default positions - spread out horizontally on the top row
        const defaults = getDefaultEditorToolbarPositions();
        const defaultOrientationPos = defaults.orientation;
        const defaultShowPos = defaults.show;
        const defaultToolsPos = defaults.tools;

        // Try device-specific positions first, fall back to default, then to hardcoded defaults
        if (pos?.editorOrientationPosPerDevice?.[selectedDevice]) {
            setOrientationToolbarPos(pos.editorOrientationPosPerDevice[selectedDevice]);
        } else if (pos?.editorOrientationPos) {
            setOrientationToolbarPos(pos.editorOrientationPos);
        } else {
            setOrientationToolbarPos(defaultOrientationPos);
        }

        if (pos?.editorShowPosPerDevice?.[selectedDevice]) {
            setShowToolbarPos(pos.editorShowPosPerDevice[selectedDevice]);
        } else if (pos?.editorShowPos) {
            setShowToolbarPos(pos.editorShowPos);
        } else {
            setShowToolbarPos(defaultShowPos);
        }

        if (pos?.editorToolsPosPerDevice?.[selectedDevice]) {
            setToolsToolbarPos(pos.editorToolsPosPerDevice[selectedDevice]);
        } else if (pos?.editorToolsPos) {
            setToolsToolbarPos(pos.editorToolsPos);
        } else {
            setToolsToolbarPos(defaultToolsPos);
        }

        if (pos?.editorQRScannerPosPerDevice?.[selectedDevice]) {
            setQRScannerPos(pos.editorQRScannerPosPerDevice[selectedDevice]);
        } else if (pos?.editorQRScannerPos) {
            setQRScannerPos(pos.editorQRScannerPos);
        }
    }, [game.id, game.toolbarPositions, selectedDevice]);

    // Ensure NEW playzone games/templates get persisted default toolbar positions (so they never stack)
    useEffect(() => {
        if (didSeedEditorToolbarPositionsRef.current) return;

        const pos = game.toolbarPositions;
        const hasEditorToolbarPositions = !!(
            pos?.editorOrientationPos ||
            pos?.editorShowPos ||
            pos?.editorToolsPos ||
            pos?.editorOrientationPosPerDevice ||
            pos?.editorShowPosPerDevice ||
            pos?.editorToolsPosPerDevice
        );

        if (hasEditorToolbarPositions) {
            didSeedEditorToolbarPositionsRef.current = true;
            return;
        }

        const defaults = getDefaultEditorToolbarPositions();

        const updatedToolbarPositions = {
            ...(pos || {}),
            editorOrientationPos: defaults.orientation,
            editorShowPos: defaults.show,
            editorToolsPos: defaults.tools,
            editorOrientationPosPerDevice: {
                ...(pos?.editorOrientationPosPerDevice || {}),
                mobile: defaults.orientation,
                tablet: defaults.orientation,
                desktop: defaults.orientation,
            },
            editorShowPosPerDevice: {
                ...(pos?.editorShowPosPerDevice || {}),
                mobile: defaults.show,
                tablet: defaults.show,
                desktop: defaults.show,
            },
            editorToolsPosPerDevice: {
                ...(pos?.editorToolsPosPerDevice || {}),
                mobile: defaults.tools,
                tablet: defaults.tools,
                desktop: defaults.tools,
            },
        };

        // Immediately update local state (so the UI is correct even before parent re-renders)
        setOrientationToolbarPos(defaults.orientation);
        setShowToolbarPos(defaults.show);
        setToolsToolbarPos(defaults.tools);

        didSeedEditorToolbarPositionsRef.current = true;
        onUpdateGame({
            ...game,
            toolbarPositions: updatedToolbarPositions,
        });
    }, [game.id]);

    // Save toolbar positions to game (device-aware)
    const saveToolbarPositions = () => {
        const existingPos = game.toolbarPositions || {};

        // Save per-device positions
        const updatedGame = {
            ...game,
            toolbarPositions: {
                ...existingPos,
                // Keep default positions for backward compatibility
                editorOrientationPos: orientationToolbarPos,
                editorShowPos: showToolbarPos,
                editorToolsPos: toolsToolbarPos,
                editorQRScannerPos: qrScannerPos,
                // Save device-specific positions
                editorOrientationPosPerDevice: {
                    ...(existingPos.editorOrientationPosPerDevice || {}),
                    [selectedDevice]: orientationToolbarPos,
                },
                editorShowPosPerDevice: {
                    ...(existingPos.editorShowPosPerDevice || {}),
                    [selectedDevice]: showToolbarPos,
                },
                editorToolsPosPerDevice: {
                    ...(existingPos.editorToolsPosPerDevice || {}),
                    [selectedDevice]: toolsToolbarPos,
                },
                editorQRScannerPosPerDevice: {
                    ...(existingPos.editorQRScannerPosPerDevice || {}),
                    [selectedDevice]: qrScannerPos,
                },
            }
        };
        onUpdateGame(updatedGame);
    };

    // Drag handlers for Orientation toolbar
    const handleOrientationPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingOrientation(true);
        orientationDragOffset.current = { x: e.clientX - orientationToolbarPos.x, y: e.clientY - orientationToolbarPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleOrientationPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingOrientation) return;
        e.stopPropagation();
        e.preventDefault();
        setOrientationToolbarPos({ x: e.clientX - orientationDragOffset.current.x, y: e.clientY - orientationDragOffset.current.y });
    };
    const handleOrientationPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingOrientation) return;
        setIsDraggingOrientation(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveToolbarPositions();
    };

    // Drag handlers for Show toolbar
    const handleShowPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingShow(true);
        showDragOffset.current = { x: e.clientX - showToolbarPos.x, y: e.clientY - showToolbarPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleShowPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingShow) return;
        e.stopPropagation();
        e.preventDefault();
        setShowToolbarPos({ x: e.clientX - showDragOffset.current.x, y: e.clientY - showDragOffset.current.y });
    };
    const handleShowPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingShow) return;
        setIsDraggingShow(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveToolbarPositions();
    };

    // Drag handlers for Tools toolbar
    const handleToolsPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingTools(true);
        toolsDragOffset.current = { x: e.clientX - toolsToolbarPos.x, y: e.clientY - toolsToolbarPos.y };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleToolsPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingTools) return;
        e.stopPropagation();
        e.preventDefault();
        setToolsToolbarPos({ x: e.clientX - toolsDragOffset.current.x, y: e.clientY - toolsDragOffset.current.y });
    };
    const handleToolsPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingTools) return;
        setIsDraggingTools(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveToolbarPositions();
    };

    // Drag handlers for QR Scanner (percentage-based, like tasks)
    const handleQRScannerPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        // Allow dragging from the QR button itself, but prevent dragging from the resize handle
        const isResizeHandle = target?.closest('.qr-resize-handle');
        if (isResizeHandle) return; // Let resize handle work

        // Allow dragging from the button - we'll detect clicks vs drags in the button handlers
        e.stopPropagation();
        e.preventDefault();
        qrScannerDidDrag.current = false; // Reset drag flag
        setIsDraggingQRScanner(true);

        // Calculate offset in percentage space
        if (backgroundRef.current) {
            const rect = backgroundRef.current.getBoundingClientRect();
            const currentX = (qrScannerPos.x / 100) * rect.width + rect.left;
            const currentY = (qrScannerPos.y / 100) * rect.height + rect.top;
            qrScannerDragOffset.current = { x: e.clientX - currentX, y: e.clientY - currentY };
        }
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };
    const handleQRScannerPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingQRScanner || !backgroundRef.current) return;

        e.stopPropagation();
        e.preventDefault();

        qrScannerDidDrag.current = true; // Mark that we actually dragged

        // Convert client coordinates to percentage within canvas
        const rect = backgroundRef.current.getBoundingClientRect();
        const x = ((e.clientX - qrScannerDragOffset.current.x - rect.left) / rect.width) * 100;
        const y = ((e.clientY - qrScannerDragOffset.current.y - rect.top) / rect.height) * 100;

        // Clamp to canvas boundaries
        setQRScannerPos({
            x: Math.max(5, Math.min(95, x)),
            y: Math.max(5, Math.min(95, y))
        });
    };
    const handleQRScannerPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingQRScanner) return;
        setIsDraggingQRScanner(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        // IMPORTANT: Reset drag flag for next click interaction
        // This ensures clicking the button after dragging will still open the color picker
        qrScannerDidDrag.current = false;
        // Reset click count after dragging so double-click works properly next time
        qrScannerClickCount.current = 0;
        if (qrScannerClickTimer.current) {
            clearTimeout(qrScannerClickTimer.current);
            qrScannerClickTimer.current = null;
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
    const saveQRScannerSettings = () => {
        if (activePlayground) {
            const newLayouts = { ...activePlayground.deviceLayouts } || {};
            // Ensure device layout exists before updating
            if (!newLayouts[selectedDevice]) {
                newLayouts[selectedDevice] = {};
            }
            newLayouts[selectedDevice] = {
                ...newLayouts[selectedDevice],
                qrScannerPos: qrScannerPos,
                qrScannerSize: qrScannerSize,
                qrScannerColor: qrScannerColor
            };
            console.log('[PlaygroundEditor] Saving QR Scanner settings:', { qrScannerColor, selectedDevice, newLayouts });
            updatePlayground({ deviceLayouts: newLayouts });
        }
    };

    // Title Text drag handlers
    const handleTitleTextPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement | null;
        // Don't drag from the text input or if resizing
        if (target?.closest('.title-text-input') || target?.closest('.title-text-resize-handle')) return;

        e.stopPropagation();
        e.preventDefault();
        setIsDraggingTitleText(true);

        if (backgroundRef.current) {
            const rect = backgroundRef.current.getBoundingClientRect();
            const currentX = (titleTextPos.x / 100) * rect.width + rect.left;
            const currentY = (titleTextPos.y / 100) * rect.height + rect.top;
            titleTextDragOffset.current = { x: e.clientX - currentX, y: e.clientY - currentY };
        }
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    const handleTitleTextPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingTitleText || !backgroundRef.current) return;

        e.stopPropagation();
        e.preventDefault();

        const rect = backgroundRef.current.getBoundingClientRect();
        const x = ((e.clientX - titleTextDragOffset.current.x - rect.left) / rect.width) * 100;
        const y = ((e.clientY - titleTextDragOffset.current.y - rect.top) / rect.height) * 100;

        setTitleTextPos({
            x: Math.max(2, Math.min(98, x)),
            y: Math.max(2, Math.min(98, y))
        });
    };

    const handleTitleTextPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingTitleText) return;
        setIsDraggingTitleText(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveTitleTextSettings();
    };

    // Title Text resize handlers
    const handleTitleTextResizeDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizingTitleText(true);
        titleTextResizeStart.current = {
            width: titleTextSize.width,
            height: titleTextSize.height,
            x: e.clientX,
            y: e.clientY
        };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    const handleTitleTextResizeMove = (e: React.PointerEvent) => {
        if (!isResizingTitleText) return;
        e.stopPropagation();
        e.preventDefault();

        const deltaX = e.clientX - titleTextResizeStart.current.x;
        const deltaY = e.clientY - titleTextResizeStart.current.y;
        const newWidth = Math.max(150, titleTextResizeStart.current.width + deltaX);
        const newHeight = Math.max(40, titleTextResizeStart.current.height + deltaY);

        setTitleTextSize({ width: newWidth, height: newHeight });
    };

    const handleTitleTextResizeUp = (e: React.PointerEvent) => {
        if (!isResizingTitleText) return;
        setIsResizingTitleText(false);
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        saveTitleTextSettings();
    };

    // Save Title Text settings to playground
    const saveTitleTextSettings = () => {
        if (activePlayground) {
            const newLayouts = { ...activePlayground.deviceLayouts } || {};
            if (!newLayouts[selectedDevice]) {
                newLayouts[selectedDevice] = {};
            }
            newLayouts[selectedDevice] = {
                ...newLayouts[selectedDevice],
                titleTextPos: titleTextPos,
                titleTextSize: titleTextSize
            };
            updatePlayground({
                deviceLayouts: newLayouts,
                showTitleText: showTitleText,
                titleText: titleTextContent,
                titleTextColor: titleTextColor,
                titleTextFontSize: titleTextFontSize
            });
        }
    };

    // QR Scanner function - Show color picker in editor mode, scanner in simulation mode
    const handleQRScanClick = async () => {
        // In simulation mode, show scanner
        if (isSimulationActive) {
            console.log('🎮 Simulation Mode: Opening QR Scanner');
            setIsQRScannerActive(!isQRScannerActive);
            return;
        }

        // In editor mode, show color picker
        setShowQRColorPicker(true);
    };

    // Handle QR scan result
    const handleQRScan = (data: string) => {
        setQRScannedValue(data);
        console.log('📷 QR Code scanned:', data);
        // TODO: In simulation mode, you could use the scanned data to trigger actions
        // For example, navigate to a task, update score, etc.
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Cleanup is now handled by QRScannerModal
        };
    }, []);

    // Get active playground
    const activePlayground = game.playgrounds?.find(p => p.id === activePlaygroundId) || game.playgrounds?.[0];

    // Check orientation lock from device-specific layout first, then fallback to playground-level
    const isOrientationLocked = (() => {
        if (!activePlayground) return false;
        const deviceLayout = activePlayground.deviceLayouts?.[selectedDevice];
        const orientationSetting = deviceLayout?.orientationLock || activePlayground.orientationLock;
        return !!orientationSetting && orientationSetting !== 'none';
    })();

    const playgroundPoints = activePlayground && game.points ? game.points.filter(p => p.playgroundId === activePlayground.id) : [];

    useEffect(() => {
        if (!activePlayground) return;

        // Get orientation from device-specific layout if available
        if (activePlayground.deviceLayouts?.[selectedDevice]) {
            const deviceLayout = activePlayground.deviceLayouts[selectedDevice];
            // Only change orientation if there's a locked orientation set
            // When unlocked (orientationLock === 'none'), keep the current editorOrientation
            if (deviceLayout.orientationLock && deviceLayout.orientationLock !== 'none') {
                setEditorOrientation(deviceLayout.orientationLock);
            }
            // Note: Removed the 'else' block that reset to default orientation
            // This preserves the current orientation when unlocking

            // Load QR scanner settings from device layout
            if (deviceLayout.qrScannerPos) {
                setQRScannerPos(deviceLayout.qrScannerPos);
            }
            if (deviceLayout.qrScannerSize) {
                setQRScannerSize(deviceLayout.qrScannerSize);
            }
            if (deviceLayout.qrScannerColor) {
                console.log('[PlaygroundEditor] Loading saved QR color:', deviceLayout.qrScannerColor);
                setQRScannerColor(deviceLayout.qrScannerColor);
            } else {
                console.log('[PlaygroundEditor] No saved QR color, using default');
            }

            // Load Title Text settings from device layout
            if (deviceLayout.titleTextPos) {
                setTitleTextPos(deviceLayout.titleTextPos);
            }
            if (deviceLayout.titleTextSize) {
                setTitleTextSize(deviceLayout.titleTextSize);
            }
        } else if (activePlayground.orientationLock && activePlayground.orientationLock !== 'none') {
            // Fallback to playground-level orientation for backward compatibility
            setEditorOrientation(activePlayground.orientationLock);
        }
        // Note: Removed the final 'else' block that reset to default orientation
        // This allows orientation to persist when switching devices

        // Initialize visibility states from playground (defaults to true if not set)
        setShowTaskScores(activePlayground.showTaskScores !== false);
        setShowTaskOrder(activePlayground.showTaskOrder !== false);
        setShowTaskActions(activePlayground.showTaskActions !== false);
        setShowTaskNames(activePlayground.showTaskNames !== false);
        setShowTaskStatus(activePlayground.showTaskStatus !== false);
        setShowBackground(activePlayground.showBackground !== false);
        setShowQRScanner(activePlayground.showQRScanner !== false);
        setShowTitleText(activePlayground.showTitleText !== false);
        setTitleTextContent(activePlayground.titleText || '');
        setTitleTextColor(activePlayground.titleTextColor || '#ffffff');
        setTitleTextFontSize(activePlayground.titleTextFontSize || 28);
    }, [activePlayground?.id, activePlayground?.orientationLock, activePlayground?.deviceLayouts?.[selectedDevice]?.qrScannerColor, activePlayground?.deviceLayouts?.[selectedDevice]?.qrScannerPos, activePlayground?.deviceLayouts?.[selectedDevice]?.qrScannerSize, selectedDevice, activePlayground?.showTaskScores, activePlayground?.showTaskOrder, activePlayground?.showTaskActions, activePlayground?.showTaskNames, activePlayground?.showTaskStatus, activePlayground?.showBackground, activePlayground?.showQRScanner]);

    // Load last used device when switching playgrounds
    useEffect(() => {
        if (activePlayground) {
            const playgroundTasks = game.points?.filter(p => p.playgroundId === activePlayground.id) || [];
            const isNewPlayground = playgroundTasks.length === 0;

            if (isNewPlayground) {
                // New playground: start with tablet mode (default for new playzone games)
                setSelectedDevice('tablet');
            } else {
                // Existing playground: load last used device from localStorage
                const storageKey = `playzone_device_${activePlayground.id}`;
                const savedDevice = localStorage.getItem(storageKey);
                if (savedDevice) {
                    setSelectedDevice(savedDevice as DeviceType);
                }
            }
        }
    }, [activePlayground?.id]);

    // Save selected device to localStorage whenever it changes
    useEffect(() => {
        if (activePlayground) {
            const storageKey = `playzone_device_${activePlayground.id}`;
            localStorage.setItem(storageKey, selectedDevice);
        }
    }, [selectedDevice, activePlayground?.id]);

    // Load and save task sort mode preference
    useEffect(() => {
        if (activePlayground) {
            const storageKey = `playzone_sortmode_${activePlayground.id}`;
            const savedSortMode = localStorage.getItem(storageKey);
            if (savedSortMode) {
                setTaskSortMode(savedSortMode as 'order' | 'actions');
            }
        }
    }, [activePlayground?.id]);

    useEffect(() => {
        if (activePlayground) {
            const storageKey = `playzone_sortmode_${activePlayground.id}`;
            localStorage.setItem(storageKey, taskSortMode);
        }
    }, [taskSortMode, activePlayground?.id]);

    // Load and save zoom level
    useEffect(() => {
        if (activePlayground) {
            const storageKey = `playzone_zoom_${activePlayground.id}`;
            const savedZoom = localStorage.getItem(storageKey);
            if (savedZoom) {
                setZoom(parseFloat(savedZoom));
            }
        }
    }, [activePlayground?.id]);

    useEffect(() => {
        if (activePlayground) {
            const storageKey = `playzone_zoom_${activePlayground.id}`;
            localStorage.setItem(storageKey, zoom.toString());
        }
    }, [zoom, activePlayground?.id]);

    // Auto-collapse all source tasks on mount when in actions mode
    useEffect(() => {
        if (activePlayground && taskSortMode === 'actions') {
            const uniquePlaygroundPoints = game.points.filter(p => p.playgroundId === activePlayground.id);
            const sourceTasks = uniquePlaygroundPoints.filter(p =>
                p.logic?.onOpen?.length > 0 ||
                p.logic?.onCorrect?.length > 0 ||
                p.logic?.onIncorrect?.length > 0
            );
            setCollapsedSources(new Set(sourceTasks.map(t => t.id)));
        }
    }, [activePlayground?.id, taskSortMode, game.points]);

    // Deduplicate playgrounds to prevent "same key" errors (fixes duplicate playground IDs)
    const uniquePlaygrounds = React.useMemo(() => {
        if (!game.playgrounds) return [];
        // Use Map to deduplicate by ID - keeps the last occurrence of each ID
        return Array.from(new Map(game.playgrounds.map(pg => [pg.id, pg])).values());
    }, [game.playgrounds]);

    // Deduplicate to prevent "same key" errors
    const uniquePlaygroundPoints = Array.from(new Map(playgroundPoints.map(p => [p.id, p])).values());

    // Device-specific position helpers
    const getDevicePosition = (point: GamePoint): { x: number; y: number } => {
        // Priority: devicePositions[selectedDevice] > playgroundPosition > default
        if (point.devicePositions?.[selectedDevice]) {
            return point.devicePositions[selectedDevice];
        }
        // Fallback to legacy playgroundPosition
        if (point.playgroundPosition) {
            return point.playgroundPosition;
        }
        // Default position
        return { x: 50, y: 50 };
    };

    const setDevicePosition = (point: GamePoint, position: { x: number; y: number }): Partial<GamePoint> => {
        // Store in device-specific position
        const devicePositions = {
            ...point.devicePositions,
            [selectedDevice]: position
        };
        return { devicePositions };
    };

    // Handlers
    const updatePlayground = (updates: Partial<Playground>) => {
        if (!activePlayground) return;
        const updated = game.playgrounds?.map(p => p.id === activePlayground.id ? { ...p, ...updates } : p);
        onUpdateGame({ ...game, playgrounds: updated });
    };

    const addNewZone = () => {
        const existingZones = uniquePlaygrounds || [];
        const zoneNumber = existingZones.length + 1;

        // Initialize device layouts with default configurations

        const newZone: Playground = {
            id: `pg-${Date.now()}`,
            title: `Global ${zoneNumber}`,
            buttonVisible: true,
            iconId: 'default',
            location: { lat: 0, lng: 0 },
            orientationLock: 'landscape',
            deviceLayouts: {
                mobile: {
                    orientationLock: 'landscape',
                    qrScannerPos: { x: 85, y: 85 }, // Percentage-based (85%, 85%)
                    qrScannerSize: { width: 140, height: 48 },
                    qrScannerColor: '#f97316', // Orange-500 default
                    iconPositions: {},
                    buttonVisible: true,
                    iconScale: 1.0,
                },
                tablet: {
                    orientationLock: 'landscape',
                    qrScannerPos: { x: 85, y: 85 }, // Percentage-based (85%, 85%)
                    qrScannerSize: { width: 140, height: 48 },
                    qrScannerColor: '#f97316', // Orange-500 default
                    iconPositions: {},
                    buttonVisible: true,
                    iconScale: 1.0,
                },
                desktop: {
                    orientationLock: 'landscape',
                    qrScannerPos: { x: 85, y: 85 }, // Percentage-based (85%, 85%)
                    qrScannerSize: { width: 140, height: 48 },
                    qrScannerColor: '#f97316', // Orange-500 default
                    iconPositions: {},
                    buttonVisible: true,
                    iconScale: 1.0,
                },
            },
        };

        const updatedPlaygrounds = [...existingZones, newZone];
        onUpdateGame({ ...game, playgrounds: updatedPlaygrounds });
        setActivePlaygroundId(newZone.id);

        // Open drawers by default for new zones
        setIsDrawerOpen(true);
        setIsTasksDrawerOpen(true);
    };

    const handleResetBackground = () => {
        // Reset background to default centered state
        // This ensures the background image is properly centered and scaled
        updatePlayground({
            backgroundScale: 1,
            backgroundOffset: { x: 0, y: 0 }
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await uploadImage(file);
            if (url) updatePlayground({ imageUrl: url });
        }
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await uploadImage(file);
            if (url) updatePlayground({ iconUrl: url });
        }
        // Reset to allow re-uploading same file
        if (iconInputRef.current) iconInputRef.current.value = '';
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await uploadImage(file);
            if (url) updatePlayground({ audioUrl: url, audioLoop: true });
        }
        // Reset to allow re-uploading same file
        if (audioInputRef.current) audioInputRef.current.value = '';
    };

    const handleGenerateAiBackground = async (keywords: string) => {
        if (!keywords.trim() || !activePlayground) return;

        setIsGeneratingBackground(true);
        try {
            console.log('[PlaygroundEditor] Generating AI background for:', { keywords, zone: activePlayground.title });
            const imageUrl = await generateAiBackground(keywords, activePlayground.title);

            if (imageUrl) {
                console.log('[PlaygroundEditor] Background generated successfully');
                updatePlayground({ imageUrl });
                setShowAiBackgroundPrompt(false);
                setAiBackgroundPromptValue('');
            } else {
                console.warn('[PlaygroundEditor] AI returned null - check console for details');
                alert('⚠️ Image generation failed\n\nGemini 2.5 Flash Image did not return image data. This could mean:\n\n1. The prompt may have been filtered by safety settings\n2. Your API key may have reached its quota\n3. The content may be too complex or ambiguous\n\nCheck the browser console (F12) for detailed error logs.\n\nTry:\n• Using simpler, descriptive keywords (e.g., "forest sunset", "medieval castle", "ocean waves")\n• Avoiding potentially sensitive content\n• Being more specific in your description\n• Uploading an image instead');
            }
        } catch (error: any) {
            console.error('[PlaygroundEditor] Error generating background:', error);
            const errorMessage = error?.message || '';
            if (errorMessage.includes('AI API Key missing')) {
                setPendingBackgroundKeywords(keywords);
                setShowGeminiKeyModal(true);
            } else {
                alert('Error generating background. Please check your API key and try again.');
            }
        } finally {
            setIsGeneratingBackground(false);
        }
    };

    const handleApiKeySaved = () => {
        // Retry the background generation with the pending keywords
        if (pendingBackgroundKeywords) {
            handleGenerateAiBackground(pendingBackgroundKeywords);
            setPendingBackgroundKeywords(null);
        }
    };

    const selectedTask = game.points?.find(p => p.id === selectedTaskId && p.playgroundId === activePlayground?.id);

    const updateTask = (updates: Partial<GamePoint>) => {
        if (!selectedTask) return;
        const updatedTask = { ...selectedTask, ...updates };
        onUpdateGame({
            ...game,
            points: game.points.map(p => p.id === selectedTask.id ? updatedTask : p)
        });
        // Auto-sync to global library
        saveTaskToLibrary(updatedTask);
    };

    const updatePointDirectly = (pointId: string, updates: Partial<GamePoint>) => {
        const pointToUpdate = game.points?.find(p => p.id === pointId);
        if (!pointToUpdate) return;

        const updatedPoint = { ...pointToUpdate, ...updates };
        onUpdateGame({
            ...game,
            points: game.points?.map(p => p.id === pointId ? updatedPoint : p)
        });
        // Auto-sync to global library
        saveTaskToLibrary(updatedPoint);
    };

    const toggleBulkIconTarget = (pointId: string) => {
        setBulkIconTargets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pointId)) {
                newSet.delete(pointId);
            } else {
                newSet.add(pointId);
            }
            return newSet;
        });
    };

    const applyBulkIcon = () => {
        if (!bulkIconSourceId || bulkIconTargets.size === 0) return;

        const sourceTask = game.points?.find(p => p.id === bulkIconSourceId);
        if (!sourceTask) return;

        const iconPayload = {
            iconId: sourceTask.iconId,
            iconUrl: sourceTask.iconUrl
        };

        onUpdateGame({
            ...game,
            points: game.points?.map(p =>
                bulkIconTargets.has(p.id) ? { ...p, ...iconPayload } : p
            )
        });

        // Reset bulk icon mode
        setBulkIconMode(false);
        setBulkIconSourceId(null);
        setBulkIconTargets(new Set());
    };

    const handleTaskIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && selectedTask) {
            const url = await uploadImage(file);
            if (url) updateTask({ iconUrl: url });
        }
        if (taskIconInputRef.current) taskIconInputRef.current.value = '';
    };

    const handleCompletedTaskIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && selectedTask) {
            const url = await uploadImage(file);
            if (url) updateTask({ completedIconUrl: url });
        }
        if (completedTaskIconInputRef.current) completedTaskIconInputRef.current.value = '';
    };

    const handleGenerateTaskIcon = async (prompt: string) => {
        if (!prompt.trim()) {
            alert('Please enter a description for the icon');
            return;
        }

        setIsGeneratingIcon(true);
        try {
            console.log('[PlaygroundEditor] Generating AI icon for:', prompt);
            const iconUrl = await generateAiImage(prompt, 'simple icon style, transparent background');

            if (iconUrl) {
                console.log('[PlaygroundEditor] Icon generated successfully');
                // If a task is selected, update task icon; otherwise update zone icon
                if (selectedTask) {
                    if (editingCompletedIcon) {
                        updateTask({ completedIconUrl: iconUrl });
                    } else {
                        updateTask({ iconUrl });
                    }
                } else {
                    updatePlayground({ iconUrl });
                }
            } else {
                console.warn('[PlaygroundEditor] AI returned null - check console for details');
                alert('⚠️ Image generation failed\n\nGemini 2.5 Flash Image did not return image data. This could mean:\n\n1. The prompt may have been filtered by safety settings\n2. Your API key may have reached its quota\n3. The content may be too complex or ambiguous\n\nCheck the browser console (F12) for detailed error logs.\n\nTry:\n• Using simpler, descriptive keywords\n• Avoiding potentially sensitive content\n• Being more specific in your description');
            }
        } catch (error: any) {
            console.error('[PlaygroundEditor] Icon generation error:', error);
            const errorMessage = error?.message || '';
            if (errorMessage.includes('AI API Key missing')) {
                setShowGeminiKeyModal(true);
            } else {
                alert('Error generating icon. Please check your API key and try again.\n\n' + errorMessage);
            }
        } finally {
            setIsGeneratingIcon(false);
        }
    };

    const handleSearchCompanyLogo = async (companyName: string) => {
        if (!companyName.trim()) {
            alert('Please enter a company name');
            return;
        }
        if (!selectedTask) return;

        setIsSearchingLogo(true);
        try {
            console.log('[Logo Search] Searching for:', companyName);
            const logoUrl = await searchLogoUrl(companyName);

            if (logoUrl) {
                console.log('[Logo Search] Found logo:', logoUrl);
                if (editingCompletedIcon) {
                    updateTask({ completedIconUrl: logoUrl });
                } else {
                    updateTask({ iconUrl: logoUrl });
                }
                setShowLogoPrompt(false);
                setLogoCompanyName('');
            } else {
                alert('Could not find a logo for this company. Please try uploading manually.');
            }
        } catch (error) {
            console.error('[Logo Search] Error:', error);
            alert('Failed to search for logo. Please try again.');
        } finally {
            setIsSearchingLogo(false);
        }
    };

    // Throttle playground position updates to prevent excessive re-renders and DB writes
    const pendingUpdatesRef = useRef<Record<string, { x: number; y: number }>>({});
    const updateTimeoutRef = useRef<number | null>(null);

    const flushPendingUpdates = () => {
        if (Object.keys(pendingUpdatesRef.current).length > 0) {
            const updates = { ...pendingUpdatesRef.current };
            pendingUpdatesRef.current = {};

            onUpdateGame({
                ...game,
                points: game.points?.map(p => {
                    if (updates[p.id]) {
                        // Store in device-specific position
                        return { ...p, ...setDevicePosition(p, updates[p.id]) };
                    }
                    return p;
                })
            });
        }
        updateTimeoutRef.current = null;
    };

    const updatePointPlaygroundPosition = (pointId: string, playgroundPosition: { x: number; y: number }) => {
        // Store update locally
        pendingUpdatesRef.current[pointId] = playgroundPosition;

        // Throttle: Only update DB at most once per 150ms while dragging
        if (updateTimeoutRef.current === null) {
            updateTimeoutRef.current = window.setTimeout(flushPendingUpdates, 150);
        }
    };

    const toggleMarkTask = (taskId: string) => {
        setMarkedTaskIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
            }
            return newSet;
        });
    };

    const requestScreenOrientation = async (orientation: 'portrait' | 'landscape') => {
        try {
            const screenOrientation = (screen as any).orientation || (screen as any).webkitOrientation;
            if (screenOrientation && screenOrientation.lock) {
                const target = orientation === 'landscape' ? 'landscape-primary' : 'portrait-primary';
                await screenOrientation.lock(target);
                console.log(`Screen orientation locked to ${orientation}`);
            }
        } catch (error) {
            console.warn('Could not lock screen orientation:', error);
        }
    };

    const handleSnapAllToGrid = () => {
        // Dynamically calculate columns based on number of icons
        const totalIcons = uniquePlaygroundPoints.length;
        let COLS = 3;

        if (totalIcons > 12) COLS = 4;
        if (totalIcons > 20) COLS = 5;

        const PADDING = 5;
        const ROW_HEIGHT = 20; // Space between rows

        // Sort points by current Y position (top to bottom), then X (left to right)
        const sortedPoints = [...uniquePlaygroundPoints].sort((a, b) => {
            const aPos = getDevicePosition(a);
            const bPos = getDevicePosition(b);
            const aY = aPos.y;
            const bY = bPos.y;
            const aX = aPos.x;
            const bX = bPos.x;

            // Group into rows (every 15% difference = new row)
            const rowDiff = Math.abs(aY - bY);
            if (rowDiff > 15) return aY - bY;
            return aX - bX;
        });

        // Snap all points to grid and arrange in rows
        const snappedPoints = sortedPoints.map((point, index) => {
            const row = Math.floor(index / COLS);
            const col = index % COLS;

            // Calculate grid-aligned position with dynamic column spacing
            const colWidth = (100 - (PADDING * 2)) / COLS;
            const x = PADDING + (col * colWidth) + (colWidth / 2);
            const y = PADDING + (row * ROW_HEIGHT) + (ROW_HEIGHT / 2);

            return {
                ...point,
                ...setDevicePosition(point, {
                    x: Math.round(x * 10) / 10,
                    y: Math.round(y * 10) / 10
                })
            };
        });

        // Update game with snapped points
        onUpdateGame({
            ...game,
            points: game.points?.map(p => {
                const snapped = snappedPoints.find(sp => sp.id === p.id);
                return snapped ? { ...p, playgroundPosition: snapped.playgroundPosition } : p;
            })
        });
    };

    const handleSnapMarkedToGrid = () => {
        if (markedTaskIds.size === 0) {
            alert('Please mark at least one task to snap');
            return;
        }

        // Get only marked tasks
        const markedPoints = uniquePlaygroundPoints.filter(p => markedTaskIds.has(p.id));

        // Group marked tasks by Y position (±10% tolerance = "same row")
        const rowTolerance = 10;
        const rows: GamePoint[][] = [];

        const sortedByY = [...markedPoints].sort((a, b) => {
            const aY = getDevicePosition(a).y;
            const bY = getDevicePosition(b).y;
            return aY - bY;
        });

        sortedByY.forEach(point => {
            const pointY = getDevicePosition(point).y;
            let foundRow = false;

            for (const row of rows) {
                const rowY = getDevicePosition(row[0]).y;
                if (Math.abs(pointY - rowY) <= rowTolerance) {
                    row.push(point);
                    foundRow = true;
                    break;
                }
            }

            if (!foundRow) {
                rows.push([point]);
            }
        });

        // Sort each row by X position
        rows.forEach(row => {
            row.sort((a, b) => {
                const aX = getDevicePosition(a).x;
                const bX = getDevicePosition(b).x;
                return aX - bX;
            });
        });

        // Detect grid dimensions: find max columns in any row
        const numRows = rows.length;
        const numCols = Math.max(...rows.map(row => row.length));

        // Padding from edges (increased to prevent text labels cutoff)
        const PADDING = 12; // 12% padding from all edges (~2cm on most screens)
        const availableWidth = 100 - (PADDING * 2);
        const availableHeight = 100 - (PADDING * 2);

        // Calculate spacing between icons (not icon positions)
        const colSpacing = numCols > 1 ? availableWidth / (numCols - 1) : 0;
        const rowSpacing = numRows > 1 ? availableHeight / (numRows - 1) : 0;

        // Position all icons in a proper rectangular grid
        const snappedMarkedPoints = rows.flatMap((row, rowIndex) => {
            // Calculate Y position for this row
            const rowY = numRows === 1 ? 50 : PADDING + (rowIndex * rowSpacing);

            return row.map((point, colIndex) => {
                // Calculate X position for this column
                const colX = numCols === 1 ? 50 : PADDING + (colIndex * colSpacing);

                return {
                    ...point,
                    ...setDevicePosition(point, {
                        x: Math.round(colX * 10) / 10, // Round to 1 decimal
                        y: Math.round(rowY * 10) / 10  // Round to 1 decimal
                    })
                };
            });
        });

        // Update game with snapped marked points
        onUpdateGame({
            ...game,
            points: game.points?.map(p => {
                const snapped = snappedMarkedPoints.find(sp => sp.id === p.id);
                if (snapped && snapped.devicePositions) {
                    return { ...p, devicePositions: snapped.devicePositions };
                }
                return p;
            })
        });

        // Exit mark mode and clear marked tasks
        setIsMarkMode(false);
        setMarkedTaskIds(new Set());
    };

    // Pan/Zoom, etc.
    const handleWheel = (e: React.WheelEvent) => {
        // Default behavior: zoom in/out
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        setZoom(z => Math.max(0.2, Math.min(5, z * (1 + scaleAmount))));

        // Note: Removed panning on scroll - users can drag to pan instead
        // This makes mousewheel zoom the primary interaction, which is more intuitive
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (dragTaskRef.current.id) return;
        if (isBackgroundLocked) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragTaskRef.current.id) return;

        // Track mouse position in draw mode
        if (drawMode.active && drawMode.sourceTaskId && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            setDrawMode(prev => ({
                ...prev,
                mousePosition: {
                    x: ((e.clientX - rect.left) / rect.width) * 100,
                    y: ((e.clientY - rect.top) / rect.height) * 100
                }
            }));
        }

        if (isDragging) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleCenterBackground = () => {
        setPan({ x: 0, y: 0 });
        setZoom(1);
    };

    // Calculate viewport dimensions based on device type and orientation
    const getViewportDimensions = () => {
        // Desktop mode: use 100% to fill available space
        if (selectedDevice === 'desktop') {
            return { width: '100%', height: '100%', aspectRatio: 'auto' };
        }

        // Mobile and Tablet: use fixed device dimensions
        const specs = DEVICE_SPECS[selectedDevice];
        if (!specs) return { width: '100%', height: '100%', aspectRatio: 'auto' };

        const width = editorOrientation === 'portrait'
            ? Math.min(specs.width, specs.height)
            : Math.max(specs.width, specs.height);
        const height = editorOrientation === 'portrait'
            ? Math.max(specs.width, specs.height)
            : Math.min(specs.width, specs.height);

        return {
            width: `${width}px`,
            height: `${height}px`,
            aspectRatio: `${width} / ${height}` as any
        };
    };

    const viewportDims = getViewportDimensions();

    const bgStyle: React.CSSProperties = {
        backgroundImage: showBackground && activePlayground?.imageUrl ? `url(${activePlayground.imageUrl})` : 'none',
        backgroundSize: activePlayground?.backgroundStyle === 'stretch' ? '100% 100%' : (activePlayground?.backgroundStyle === 'cover' ? 'cover' : 'contain'),
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: viewportDims.width,
        height: viewportDims.height,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
    };

    const handleTaskPointerDown = (e: React.PointerEvent, point: GamePoint) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = backgroundRef.current?.getBoundingClientRect();
        if (!rect) return;

        const devicePos = getDevicePosition(point);
        const currentX = devicePos.x;
        const currentY = devicePos.y;

        const centerX = rect.left + (currentX / 100) * rect.width;
        const centerY = rect.top + (currentY / 100) * rect.height;

        dragTaskRef.current = {
            id: point.id,
            offsetX: e.clientX - centerX,
            offsetY: e.clientY - centerY,
            startClientX: e.clientX,
            startClientY: e.clientY,
            moved: false
        };

        setDraggingTaskId(point.id);
        setDragVisualPosition(null); // Start with game state position
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handleTaskPointerMove = (e: React.PointerEvent) => {
        const id = dragTaskRef.current.id;
        if (!id) return;

        const rect = backgroundRef.current?.getBoundingClientRect();
        if (!rect) return;

        const dx = e.clientX - dragTaskRef.current.startClientX;
        const dy = e.clientY - dragTaskRef.current.startClientY;
        if (!dragTaskRef.current.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
            dragTaskRef.current.moved = true;
        }

        const x = ((e.clientX - rect.left - dragTaskRef.current.offsetX) / rect.width) * 100;
        const y = ((e.clientY - rect.top - dragTaskRef.current.offsetY) / rect.height) * 100;

        const clamped = {
            x: Math.max(0, Math.min(100, Math.round(x * 10) / 10)),
            y: Math.max(0, Math.min(100, Math.round(y * 10) / 10))
        };

        // Update visual position immediately for smooth dragging
        setDragVisualPosition(clamped);

        // Batch game state updates with throttle
        updatePointPlaygroundPosition(id, clamped);

        // Check if dragging over delete zone
        const deleteZoneRect = document.getElementById('delete-zone-btn')?.getBoundingClientRect();
        if (deleteZoneRect) {
            const isOver = e.clientX >= deleteZoneRect.left && e.clientX <= deleteZoneRect.right &&
                          e.clientY >= deleteZoneRect.top && e.clientY <= deleteZoneRect.bottom;
            setIsOverDeleteZone(isOver);
        }
    };

    const handleTaskPointerUp = (e: React.PointerEvent) => {
        const id = dragTaskRef.current.id;
        if (!id) return;

        e.preventDefault();
        e.stopPropagation();

        const wasClick = !dragTaskRef.current.moved;

        // Check if dropped on delete zone
        if (isOverDeleteZone) {
            onUpdateGame({
                ...game,
                points: game.points?.filter(p => p.id !== id)
            });
            setSelectedTaskId(null);
        } else {
            // Flush any pending updates immediately on pointer up
            if (updateTimeoutRef.current !== null) {
                clearTimeout(updateTimeoutRef.current);
                flushPendingUpdates();
            }

            if (wasClick) {
                setSelectedTaskId(id);
            }
        }

        dragTaskRef.current = { id: null, offsetX: 0, offsetY: 0, startClientX: 0, startClientY: 0, moved: false };
        setDraggingTaskId(null);
        setDragVisualPosition(null);
        setIsOverDeleteZone(false);
    };

    // Handle snap-to-road selection box
    const handleSnapToRoadStart = (e: React.MouseEvent) => {
        if (!snapToRoadMode) return;
        e.preventDefault();
        e.stopPropagation();
        setSelectionBox({
            start: { x: e.clientX, y: e.clientY },
            current: { x: e.clientX, y: e.clientY }
        });
    };

    const handleSnapToRoadMove = (e: React.MouseEvent) => {
        if (!snapToRoadMode || !selectionBox.start) return;
        e.preventDefault();
        e.stopPropagation();
        setSelectionBox({
            start: selectionBox.start,
            current: { x: e.clientX, y: e.clientY }
        });
    };

    const handleSnapToRoadEnd = async (e: React.MouseEvent) => {
        if (!snapToRoadMode || !selectionBox.start || !selectionBox.current || !activePlayground) return;
        e.preventDefault();
        e.stopPropagation();

        // Get canvas bounds to convert screen coords to map coords
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();

        // Convert screen coordinates to canvas relative coordinates
        const startX = (selectionBox.start.x - rect.left) / zoom + pan.x;
        const startY = (selectionBox.start.y - rect.top) / zoom + pan.y;
        const endX = (selectionBox.current.x - rect.left) / zoom + pan.x;
        const endY = (selectionBox.current.y - rect.top) / zoom + pan.y;

        // Find tasks within the selection box
        const tasksToSnap = game.points?.filter(point => {
            const pos = point.playgroundPosition;
            if (!pos) return false;

            const minX = Math.min(startX, endX);
            const maxX = Math.max(startX, endX);
            const minY = Math.min(startY, endY);
            const maxY = Math.max(startY, endY);

            return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
        });

        if (tasksToSnap.length === 0) {
            alert('No tasks selected. Please draw a larger selection box.');
            setSelectionBox({ start: null, current: null });
            return;
        }

        // Show loading state
        const originalPoints = tasksToSnap.map(p => p.location);

        try {
            // Snap tasks to road
            const snappedLocations = await snapPointsToRoad(originalPoints);

            // Update the game with snapped locations
            const updatedPoints = game.points?.map(point => {
                const taskIndex = tasksToSnap.findIndex(t => t.id === point.id);
                if (taskIndex >= 0) {
                    return {
                        ...point,
                        location: snappedLocations[taskIndex] || point.location
                    };
                }
                return point;
            });

            await updateActiveGame({ ...game, points: updatedPoints }, `Snapped ${tasksToSnap.length} tasks to road`);
            alert(`✓ Successfully snapped ${tasksToSnap.length} task${tasksToSnap.length !== 1 ? 's' : ''} to road`);
        } catch (error) {
            console.error('Error snapping to road:', error);
            alert('Failed to snap tasks to road. Please check the console for details.');
        }

        // Reset selection box and mode
        setSelectionBox({ start: null, current: null });
        setSnapToRoadMode(false);
    };

    // CRITICAL NULL CHECK: Prevent crashes if no playground exists
    if (!activePlayground) {
        return (
            <div className="fixed inset-0 z-[5000] bg-[#0f172a] text-white flex items-center justify-center">
                <div className="text-center p-8 bg-slate-900 rounded-2xl border border-red-500 shadow-2xl max-w-md">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black uppercase mb-2">No Playground Available</h2>
                    <p className="text-slate-400 mb-6">This game has no playgrounds configured. Please create one to continue.</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition-colors"
                    >
                        CLOSE EDITOR
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[5000] bg-[#0f172a] text-white flex flex-row overflow-hidden font-sans animate-in fade-in">

            {/* Top-Right Settings Gear - Fixed Position */}
            {!isSimulationActive && onOpenGameSettings && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenGameSettings();
                    }}
                    className="absolute top-6 right-6 z-[6000] p-2 text-orange-500 hover:text-orange-400 transition-all hover:scale-110 pointer-events-auto group"
                    title="Open Game Settings - Configure game rules, timing, and appearance"
                >
                    <Settings className="w-6 h-6" />
                </button>
            )}

            {/* Simulation Mode Banner - Absolute Positioned */}
            {isSimulationActive && (
                <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-[6000] bg-purple-600 border-b-4 border-purple-500 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4">
                        <PlayCircle className="w-6 h-6 text-white animate-pulse" />
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wider text-white">
                                🎮 SIMULATION MODE ACTIVE
                            </h3>
                            <p className="text-sm font-bold text-white/90">
                                Click tasks to open and solve them. Score: {simulationScore} | Team: {simulationTeam?.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setIsSimulationActive(false);
                            setSimulationScore(0);
                            setSimulationTeam(null);
                            setActiveSimulationTaskId(null);
                            setShowRanking(false);

                            // Stop background music
                            if (simulationBgAudioRef.current) {
                                simulationBgAudioRef.current.pause();
                                simulationBgAudioRef.current.currentTime = 0;
                                simulationBgAudioRef.current = null;
                            }
                        }}
                        className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 border-2 border-white/30"
                    >
                        <X className="w-5 h-5" /> EXIT SIMULATION
                    </button>
                </div>
            )}

            {/* Draw Mode Banner - Absolute Positioned */}
            {drawMode.active && drawMode.sourceTaskId && (
                <div className={`absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-[6000] border-b-4 animate-in slide-in-from-top-4 ${
                    drawMode.trigger === 'onCorrect'
                        ? 'bg-green-600 border-green-500'
                        : drawMode.trigger === 'onIncorrect'
                        ? 'bg-red-600 border-red-500'
                        : 'bg-yellow-600 border-yellow-500'
                }`}>
                    <div className="flex items-center gap-4">
                        <PenTool className="w-6 h-6 text-white animate-pulse" />
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wider text-white">
                                {drawMode.trigger === 'onCorrect' ? '✓ IF CORRECT' : drawMode.trigger === 'onIncorrect' ? '✗ IF INCORRECT' : '⚡ WHEN OPENED'} DRAW MODE
                            </h3>
                            <p className="text-sm font-bold text-white/90">
                                Click tasks to connect them. Click multiple to create a flow. Press ESC or click Exit to finish.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setDrawMode({ active: false, trigger: null, sourceTaskId: null, mousePosition: null });
                            if (onDrawModeDeactivated) {
                                onDrawModeDeactivated();
                            }
                        }}
                        className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 border-2 border-white/30"
                    >
                        <X className="w-5 h-5" /> EXIT DRAW MODE
                    </button>
                </div>
            )}

            {/* LEFT SIDEBAR EDITOR - COLLAPSIBLE DRAWER */}
            <div className={`flex flex-col border-r border-slate-800 bg-[#0f172a] shadow-2xl z-20 transition-all duration-300 ease-in-out ${
                isDrawerOpen ? 'w-[360px]' : 'w-0'
            } overflow-hidden`}>
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]">
                    <div className="flex items-center gap-3">
                        <LayoutGrid className="w-5 h-5 text-orange-500" />
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-widest text-white">PLAYZONE EDITOR</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{game.playgrounds?.length || 0} ZONES ACTIVE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Game Settings Clockwheel */}
                        {onOpenGameSettings && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onOpenGameSettings();
                                }}
                                className="text-orange-500 hover:text-orange-400 transition-all p-2 hover:scale-110"
                                title="Open Game Settings"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={toggleAllSections}
                            className="text-slate-400 hover:text-orange-400 transition-colors p-2"
                            title={(() => {
                                const anyExpanded = !isBackgroundImageCollapsed ||
                                                   !isBackgroundMusicCollapsed || !isDeviceCollapsed ||
                                                   !isOrientationCollapsed || !isShowCollapsed || !isLayoutCollapsed;
                                return anyExpanded ? "Collapse All Sections" : "Expand All Sections";
                            })()}
                        >
                            <ChevronsUpDown className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsDrawerOpen(false)}
                            className="text-orange-500 hover:text-orange-400 transition-colors p-2 -mr-2"
                            title="Close Settings"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    {/* Active Zone Card */}
                    <div className="bg-[#1e293b]/50 border border-slate-700 rounded-xl p-4">
                        <div className="flex justify-between items-center gap-2">
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ZONE TITLE</span>
                                <input
                                    type="text"
                                    value={activePlayground.title}
                                    onChange={(e) => updatePlayground({ title: e.target.value })}
                                    disabled={isInstructorView}
                                    className={`bg-transparent border-b border-slate-600 text-sm font-bold text-white uppercase focus:border-orange-500 outline-none pb-1 w-full ${isInstructorView ? 'opacity-50 cursor-not-allowed' : 'focus:border-orange-500'}`}
                                />
                            </div>
                            {onOpenGameSettings && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onOpenGameSettings();
                                    }}
                                    className="p-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all shadow-lg"
                                    title="Game Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* HUD Appearance */}
                        <div>
                            <button
                                onClick={() => setIsHudAppearanceCollapsed(!isHudAppearanceCollapsed)}
                                className="flex justify-between items-center mb-2 w-full hover:bg-slate-800/50 rounded-lg p-2 -mx-2 transition-colors group"
                            >
                                <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <MousePointerClick className="w-3 h-3" /> HUD BUTTON APPEARANCE
                                </span>
                                <ChevronDown className={`w-5 h-5 text-orange-500 group-hover:text-orange-400 transition-transform ${isHudAppearanceCollapsed ? '-rotate-90' : ''}`} />
                            </button>

                            {!isHudAppearanceCollapsed && (
                                <div className="space-y-3">
                                    {/* Custom Icon Preview */}
                                    {activePlayground.iconUrl && (
                                <div className="mb-3 p-3 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <img src={activePlayground.iconUrl} alt="Custom Icon" className="w-8 h-8 object-contain" />
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                                                {activePlayground.iconUrl === activePlayground.imageUrl ? 'BACKGROUND' : 'CUSTOM'} ICON
                                            </span>
                                            {activePlayground.iconUrl === activePlayground.imageUrl && (
                                                <span className="text-[9px] text-slate-400 uppercase tracking-wide">Using background image</span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => updatePlayground({ iconUrl: undefined, iconId: 'default' })}
                                        className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                                        title="Remove Custom Icon"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-2 mb-3">
                                {['default', 'star', 'flag', 'trophy', 'camera', 'question', 'skull', 'treasure', 'music', 'nature', 'world'].map((iconKey) => {
                                    const Icon = ICON_COMPONENTS[iconKey as IconId];
                                    const isActive = activePlayground.iconId === iconKey && !activePlayground.iconUrl;
                                    return (
                                        <button
                                            key={iconKey}
                                            onClick={() => updatePlayground({ iconId: iconKey as IconId, iconUrl: undefined })}
                                            className={`aspect-square rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-orange-600 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <button
                                    onClick={() => iconInputRef.current?.click()}
                                    className="py-2.5 border border-dashed border-slate-600 rounded-lg text-[10px] font-bold text-slate-400 uppercase hover:text-white hover:border-slate-400 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Upload className="w-3 h-3" /> UPLOAD
                                </button>
                                <input ref={iconInputRef} type="file" className="hidden" accept="image/*" onChange={handleIconUpload} />

                                <button
                                    onClick={() => {
                                        setAiIconPromptValue('');
                                        setShowAiIconPrompt(true);
                                    }}
                                    disabled={isGeneratingIcon}
                                    className={`py-2.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 transition-all ${
                                        isGeneratingIcon
                                            ? 'bg-purple-600/50 text-purple-300 cursor-wait border border-purple-500'
                                            : 'border border-dashed border-purple-600 text-purple-400 hover:text-purple-300 hover:border-purple-400'
                                    }`}
                                    title="Generate zone icon with AI"
                                >
                                    {isGeneratingIcon ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[9px]">GENERATING...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-3 h-3" /> AI ICON
                                        </>
                                    )}
                                </button>

                                {activePlayground.imageUrl && (
                                    <button
                                        onClick={() => updatePlayground({ iconUrl: activePlayground.imageUrl })}
                                        className={`col-span-2 py-2.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-colors ${
                                            activePlayground.iconUrl === activePlayground.imageUrl
                                                ? 'bg-purple-600 text-white border border-purple-500'
                                                : 'bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                                        }`}
                                        title="Use Background Image as Icon"
                                    >
                                        <ImageIcon className="w-3 h-3" /> USE BACKGROUND AS ICON
                                    </button>
                                )}
                            </div>

                            <div className="mt-4">
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-1">
                                    <span>SIZE</span>
                                    <span>{activePlayground.buttonSize || 80}PX</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="40" 
                                    max="120" 
                                    step="5"
                                    value={activePlayground.buttonSize || 80}
                                    onChange={(e) => updatePlayground({ buttonSize: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                />
                            </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Orange Divider */}
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-30 my-4" />

                    {/* Device Selection */}
                    <div>
                        <button
                            onClick={() => setIsDeviceCollapsed(!isDeviceCollapsed)}
                            className="flex justify-between items-center mb-2 w-full hover:bg-slate-800/50 rounded-lg p-2 -mx-2 transition-colors group"
                        >
                            <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-400 uppercase tracking-widest">DEVICE</span>
                            <ChevronDown className={`w-5 h-5 text-orange-500 group-hover:text-orange-400 transition-transform ${isDeviceCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        {!isDeviceCollapsed && (
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setSelectedDevice('mobile')}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${
                                        selectedDevice === 'mobile'
                                            ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                                    }`}
                                    title="Mobile (375×812)"
                                >
                                    <Smartphone className="w-6 h-6" />
                                    <span className="text-[10px] font-black uppercase">MOBILE</span>
                                </button>
                                <button
                                    onClick={() => setSelectedDevice('tablet')}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${
                                        selectedDevice === 'tablet'
                                            ? 'bg-cyan-600 text-white shadow-lg ring-2 ring-cyan-400'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                                    }`}
                                    title="Tablet (1024×768)"
                                >
                                    <Tablet className="w-6 h-6" />
                                    <span className="text-[10px] font-black uppercase">TABLET</span>
                                </button>
                                <button
                                    onClick={() => setSelectedDevice('desktop')}
                                    className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${
                                        selectedDevice === 'desktop'
                                            ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                                    }`}
                                    title="Desktop (1920×1080)"
                                >
                                    <Monitor className="w-6 h-6" />
                                    <span className="text-[10px] font-black uppercase">DESKTOP</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Orange Divider */}
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-30 my-4" />

                    {/* Orientation Selection */}
                    <div>
                        <button
                            onClick={() => setIsOrientationCollapsed(!isOrientationCollapsed)}
                            className="flex justify-between items-center mb-2 w-full hover:bg-slate-800/50 rounded-lg p-2 -mx-2 transition-colors group"
                        >
                            <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-400 uppercase tracking-widest">ORIENTATION</span>
                            <ChevronDown className={`w-5 h-5 text-orange-500 group-hover:text-orange-400 transition-transform ${isOrientationCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        {!isOrientationCollapsed && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => {
                                            setEditorOrientation('portrait');
                                            if (activePlayground) {
                                                const newLayouts = { ...activePlayground.deviceLayouts };
                                                // If already locked, update the lock to the new orientation
                                                if (isOrientationLocked) {
                                                    newLayouts[selectedDevice] = {
                                                        ...newLayouts[selectedDevice],
                                                        orientationLock: 'portrait',
                                                    };
                                                    updatePlayground({ deviceLayouts: newLayouts });
                                                }
                                            }
                                        }}
                                        className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${
                                            editorOrientation === 'portrait'
                                                ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                                        }`}
                                        title="Portrait orientation"
                                    >
                                        <Smartphone className="w-6 h-6" />
                                        <span className="text-[10px] font-black uppercase">PORTRAIT</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditorOrientation('landscape');
                                            if (activePlayground) {
                                                const newLayouts = { ...activePlayground.deviceLayouts };
                                                // If already locked, update the lock to the new orientation
                                                if (isOrientationLocked) {
                                                    newLayouts[selectedDevice] = {
                                                        ...newLayouts[selectedDevice],
                                                        orientationLock: 'landscape',
                                                    };
                                                    updatePlayground({ deviceLayouts: newLayouts });
                                                }
                                            }
                                        }}
                                        className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${
                                            editorOrientation === 'landscape'
                                                ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                                        }`}
                                        title="Landscape orientation"
                                    >
                                        <Monitor className="w-6 h-6" />
                                        <span className="text-[10px] font-black uppercase">LAND</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!activePlayground) return;
                                            const newLayouts = { ...activePlayground.deviceLayouts };
                                            if (isOrientationLocked) {
                                                newLayouts[selectedDevice] = {
                                                    ...newLayouts[selectedDevice],
                                                    orientationLock: 'none',
                                                };
                                            } else {
                                                newLayouts[selectedDevice] = {
                                                    ...newLayouts[selectedDevice],
                                                    orientationLock: editorOrientation,
                                                };
                                            }
                                            updatePlayground({ deviceLayouts: newLayouts });
                                        }}
                                        className={`flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${
                                            isOrientationLocked
                                                ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                                        }`}
                                        title={isOrientationLocked ? 'Unlock orientation' : 'Lock to selected orientation'}
                                    >
                                        <Lock className="w-6 h-6" />
                                        <span className="text-[10px] font-black uppercase">LOCK</span>
                                    </button>
                                </div>
                                {isOrientationLocked && (
                                    <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-3 text-[9px] text-orange-300 uppercase font-bold tracking-wide">
                                        ⚠️ Locked to {activePlayground?.deviceLayouts?.[selectedDevice]?.orientationLock === 'landscape' ? 'LANDSCAPE' : 'PORTRAIT'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Orange Divider */}
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-30 my-4" />

                    {/* SHOW IN GAME Section */}
                    <div>
                        <button
                            onClick={() => setIsShowCollapsed(!isShowCollapsed)}
                            className="flex justify-between items-center mb-2 w-full hover:bg-slate-800/50 rounded-lg p-2 -mx-2 transition-colors group"
                        >
                            <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-400 uppercase tracking-widest">SHOW IN GAME</span>
                            <ChevronDown className={`w-5 h-5 text-orange-500 group-hover:text-orange-400 transition-transform ${isShowCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        {!isShowCollapsed && (
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={() => {
                                        const newValue = !showTaskScores;
                                        setShowTaskScores(newValue);
                                        updatePlayground({ showTaskScores: newValue });
                                    }}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showTaskScores ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                    title="Show/Hide Scores"
                                >
                                    <span className="text-base font-bold">$</span>
                                    <span className="text-[8px] font-black uppercase">SCORE</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const newValue = !showTaskOrder;
                                        setShowTaskOrder(newValue);
                                        updatePlayground({ showTaskOrder: newValue });
                                    }}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showTaskOrder ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                >
                                    <span className="text-base font-bold">#</span>
                                    <span className="text-[8px] font-black uppercase">ORDER</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const newValue = !showTaskActions;
                                        setShowTaskActions(newValue);
                                        updatePlayground({ showTaskActions: newValue });
                                    }}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showTaskActions ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                >
                                    <Zap className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">ACTIONS</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const newValue = !showTaskNames;
                                        setShowTaskNames(newValue);
                                        updatePlayground({ showTaskNames: newValue });
                                    }}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showTaskNames ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                >
                                    <Type className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">NAME</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const newValue = !showTaskStatus;
                                        setShowTaskStatus(newValue);
                                        updatePlayground({ showTaskStatus: newValue });
                                    }}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showTaskStatus ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">ANSWERS</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const newValue = !showBackground;
                                        setShowBackground(newValue);
                                        updatePlayground({ showBackground: newValue });
                                    }}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showBackground ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">BG</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const newValue = !showQRScanner;
                                        setShowQRScanner(newValue);
                                        updatePlayground({ showQRScanner: newValue });
                                    }}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showQRScanner ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                >
                                    <QrCode className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">QR</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const newValue = !showTitleText;
                                        setShowTitleText(newValue);
                                        if (newValue && !titleTextContent) {
                                            setTitleTextContent('GAME TITLE');
                                        }
                                        setShowTitleTextEditor(newValue);
                                    }}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showTitleText ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                    title="Show/Hide Title Text"
                                >
                                    <Type className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">TITLE</span>
                                </button>
                                <button
                                    onClick={() => setShowRanking(!showRanking)}
                                    className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                                        showRanking ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                    title="Show/Hide Ranking Popup"
                                >
                                    <Trophy className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase">RANK</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Orange Divider */}
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-30 my-4" />

                    {/* LAYOUT Section */}
                    <div>
                        <button
                            onClick={() => setIsLayoutCollapsed(!isLayoutCollapsed)}
                            className="flex justify-between items-center mb-2 w-full hover:bg-slate-800/50 rounded-lg p-2 -mx-2 transition-colors group"
                        >
                            <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-400 uppercase tracking-widest">LAYOUT</span>
                            <ChevronDown className={`w-5 h-5 text-orange-500 group-hover:text-orange-400 transition-transform ${isLayoutCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        {!isLayoutCollapsed && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setShowGrid(!showGrid)}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                                            showGrid ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                        }`}
                                    >
                                        <Grid className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase">GRID</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isMarkMode) {
                                                setIsMarkMode(false);
                                                setMarkedTaskIds(new Set());
                                            } else {
                                                setIsMarkMode(true);
                                            }
                                        }}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                                            isMarkMode ? 'bg-orange-600 text-white shadow-lg animate-pulse' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                        }`}
                                        title={isMarkMode ? 'Exit mark mode' : 'Select tasks to snap to grid'}
                                    >
                                        <MousePointer2 className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase">MARK</span>
                                    </button>
                                </div>
                                {isMarkMode && (
                                    <div className="space-y-2">
                                        {/* Mark All / Unmark All Button */}
                                        <button
                                            onClick={() => {
                                                if (markedTaskIds.size === uniquePlaygroundPoints.length) {
                                                    // If all are marked, unmark all
                                                    setMarkedTaskIds(new Set());
                                                } else {
                                                    // Mark all icons in current playground
                                                    setMarkedTaskIds(new Set(uniquePlaygroundPoints.map(p => p.id)));
                                                }
                                            }}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[10px] shadow-lg transition-colors"
                                            title={markedTaskIds.size === uniquePlaygroundPoints.length ? 'Unmark all tasks' : 'Mark all tasks'}
                                        >
                                            <Target className="w-4 h-4" />
                                            {markedTaskIds.size === uniquePlaygroundPoints.length ? 'UNMARK ALL' : 'MARK ALL'}
                                        </button>

                                        {/* Snap Button - only show when tasks are marked */}
                                        {markedTaskIds.size > 0 && (
                                            <button
                                                onClick={handleSnapMarkedToGrid}
                                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[10px] shadow-lg transition-colors"
                                                title={`Snap ${markedTaskIds.size} selected task(s) to grid`}
                                            >
                                                <Check className="w-4 h-4" />
                                                SNAP ({markedTaskIds.size})
                                            </button>
                                        )}
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsBackgroundImageCollapsed(!isBackgroundImageCollapsed)}
                                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                                        !isBackgroundImageCollapsed ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                    }`}
                                >
                                    <ImageIcon className="w-5 h-5" />
                                    <span className="text-[10px] font-black uppercase">BACKGROUND</span>
                                </button>

                                {/* Background Image Content - Revealed when BACKGROUND button is clicked */}
                                {!isBackgroundImageCollapsed && (
                                    <div className="space-y-3 mt-3 p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                                        <div
                                            className="aspect-video bg-slate-900 border border-slate-700 rounded-xl overflow-hidden relative group cursor-pointer hover:border-slate-500 transition-colors"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {activePlayground.imageUrl ? (
                                                <img src={activePlayground.imageUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                    <ImageIcon className="w-8 h-8" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[9px] font-bold text-white uppercase tracking-widest">UPLOAD IMAGE</span>
                                            </div>
                                        </div>
                                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />

                                        {/* AI Background & Upload Buttons */}
                                        <div className="space-y-2">
                                            {/* API Key Status Indicator */}
                                            <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg p-2">
                                                <div className={`w-2 h-2 rounded-full ${typeof window !== 'undefined' && localStorage.getItem('GEMINI_API_KEY') ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <span className="text-[9px] font-bold uppercase text-slate-400 flex-1">
                                                    {typeof window !== 'undefined' && localStorage.getItem('GEMINI_API_KEY') ? 'API Key Configured' : 'No API Key'}
                                                </span>
                                                <button
                                                    onClick={() => setShowGeminiKeyModal(true)}
                                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[8px] font-bold uppercase tracking-wider transition-colors"
                                                    title="Configure Gemini API Key"
                                                >
                                                    {typeof window !== 'undefined' && localStorage.getItem('GEMINI_API_KEY') ? 'Update' : 'Set Key'}
                                                </button>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowAiBackgroundPrompt(true)}
                                                    disabled={isGeneratingBackground}
                                                    className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 text-white rounded-lg font-bold uppercase text-[10px] tracking-wide flex items-center justify-center gap-2 transition-colors shadow-lg"
                                                >
                                                    <Wand2 className="w-4 h-4" />
                                                    {isGeneratingBackground ? 'GENERATING...' : 'AI BACKGROUND'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Scaling Options */}
                                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                            {['contain', 'cover', 'stretch'].map((style) => (
                                                <button
                                                    key={style}
                                                    onClick={() => updatePlayground({ backgroundStyle: style as any })}
                                                    className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded transition-colors ${activePlayground.backgroundStyle === style || (!activePlayground.backgroundStyle && style === 'contain') ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                                >
                                                    {style}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* SCAN QR Button Color Picker */}
                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                        SCAN QR BUTTON COLOR
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={qrScannerColor}
                                            onChange={(e) => {
                                                setQRScannerColor(e.target.value);
                                                saveQRScannerSettings();
                                            }}
                                            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-slate-600 hover:border-slate-500 transition-colors"
                                            title="Click to change SCAN QR button color"
                                        />
                                        <div className="flex-1 space-y-1">
                                            <div
                                                className="w-full h-8 rounded-lg border-2 border-slate-600 shadow-md transition-all"
                                                style={{ backgroundColor: qrScannerColor }}
                                                title={`Current color: ${qrScannerColor}`}
                                            />
                                            <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                                                {qrScannerColor.toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Background Audio Section - At Bottom */}
                    <div>
                        <button
                            onClick={() => setIsBackgroundMusicCollapsed(!isBackgroundMusicCollapsed)}
                            className="flex justify-between items-center mb-2 w-full hover:bg-slate-800/50 rounded-lg p-2 -mx-2 transition-colors group"
                        >
                            <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Music className="w-3 h-3" /> BACKGROUND MUSIC
                            </span>
                            <ChevronDown className={`w-5 h-5 text-orange-500 group-hover:text-orange-400 transition-transform ${isBackgroundMusicCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        {!isBackgroundMusicCollapsed && (
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-3">
                            {/* Add New Track Button */}
                            <button
                                onClick={() => audioInputRef.current?.click()}
                                className="w-full py-3 border border-dashed border-indigo-600 rounded-lg text-indigo-400 hover:text-indigo-300 hover:border-indigo-400 hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase">ADD MP3 TRACK</span>
                            </button>
                            <input ref={audioInputRef} type="file" className="hidden" accept="audio/mp3,audio/mpeg,audio/wav" onChange={handleAudioUpload} />

                            {/* Active Track Display */}
                            {activePlayground.audioUrl && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg">
                                        <div className="flex items-center gap-2 text-indigo-400 flex-1 min-w-0">
                                            <Music className="w-4 h-4 flex-shrink-0" />
                                            <span className="text-[10px] font-bold uppercase truncate">PLAYING NOW</span>
                                        </div>
                                        <button
                                            onClick={() => updatePlayground({ audioUrl: undefined, audioLoop: true })}
                                            className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-lg transition-colors flex-shrink-0"
                                            title="Remove track"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Playback Mode Controls */}
                                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 gap-1">
                                        <button
                                            onClick={() => updatePlayground({ audioLoop: false })}
                                            className={`flex-1 py-2 text-[9px] font-bold uppercase rounded flex items-center justify-center gap-1 transition-colors ${activePlayground.audioLoop === false ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                            title="Play once then stop"
                                        >
                                            <PlayCircle className="w-3 h-3" /> PLAY ONCE
                                        </button>
                                        <button
                                            onClick={() => updatePlayground({ audioLoop: true })}
                                            className={`flex-1 py-2 text-[9px] font-bold uppercase rounded flex items-center justify-center gap-1 transition-colors ${activePlayground.audioLoop !== false ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                            title="Loop continuously"
                                        >
                                            <Repeat className="w-3 h-3" /> LOOP
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!activePlayground.audioUrl && (
                                <div className="text-center py-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">No music loaded</p>
                                </div>
                            )}
                        </div>
                        )}
                    </div>

                </div>

                {/* Footer Buttons - Fixed at bottom */}
                <div className="p-5 border-t border-slate-800 flex-shrink-0 space-y-3">
                    {/* SIMULATOR Button */}
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            if (isSimulationActive) {
                                // Stop simulation
                                setIsSimulationActive(false);
                                setSimulationScore(0);
                                setSimulationTeam(null);
                                setActiveSimulationTaskId(null);
                                setShowRanking(false);

                                // Stop background music
                                if (simulationBgAudioRef.current) {
                                    simulationBgAudioRef.current.pause();
                                    simulationBgAudioRef.current.currentTime = 0;
                                    simulationBgAudioRef.current = null;
                                }
                            } else {
                                // Start simulation
                                const testTeam = {
                                    id: 'sim-test-team',
                                    gameId: game.id,
                                    name: 'TEST',
                                    joinCode: 'TEST00',
                                    score: 0,
                                    members: [{ name: 'Simulator', deviceId: 'sim-device', photo: '' }],
                                    updatedAt: new Date().toISOString()
                                };
                                setSimulationTeam(testTeam);
                                setSimulationScore(0);
                                setIsSimulationActive(true);
                                setShowRanking(true);

                                // Play background music if available
                                if (activePlayground?.audioUrl) {
                                    try {
                                        const audio = new Audio(activePlayground.audioUrl);
                                        audio.loop = activePlayground.audioLoop !== false;
                                        audio.volume = (getGlobalVolume() / 100) * 0.8; // 80% of global volume for BG music
                                        audio.play().catch(err => console.warn('Auto-play prevented:', err));
                                        simulationBgAudioRef.current = audio;
                                    } catch (err) {
                                        console.warn('Failed to play background music:', err);
                                    }
                                }
                            }
                        }}
                        className={`w-full px-4 py-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs shadow-lg ${
                            isSimulationActive
                                ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/20'
                                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-500/20'
                        }`}
                        title={isSimulationActive ? 'Stop Simulation Mode' : 'Start Simulation Mode - Play the game with all tasks and rules enabled'}
                        type="button"
                    >
                        {isSimulationActive ? <X className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                        <span>{isSimulationActive ? 'STOP SIMULATOR' : 'START SIMULATOR'}</span>
                    </button>

                    {/* SAVE AS TEMPLATE Button */}
                    <button
                        onClick={async () => {
                            if (!activePlayground) {
                                alert('No playzone selected to save as template');
                                return;
                            }

                            const templateName = prompt(
                                `💾 SAVE AS GLOBAL TEMPLATE\n\n` +
                                `This will create a reusable template that includes:\n` +
                                `• All zone settings and design\n` +
                                `• All ${game.points.filter(p => p.playgroundId === activePlayground.id).length} tasks\n` +
                                `• All task actions and logic\n\n` +
                                `Enter a name for this template:`,
                                activePlayground.title
                            );

                            if (!templateName || !templateName.trim()) return;

                            try {
                                const zoneTasks = game.points.filter(p => p.playgroundId === activePlayground.id);

                                console.log('[PlaygroundEditor] Creating template:', {
                                    templateName: templateName.trim(),
                                    playgroundId: activePlayground.id,
                                    totalGamePoints: game.points.length,
                                    zoneTasks: zoneTasks.length,
                                    taskIds: zoneTasks.map(t => t.id),
                                    firstTask: zoneTasks[0],
                                    playgroundData: activePlayground
                                });

                                const template: PlaygroundTemplate = {
                                    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                    title: templateName.trim(),
                                    playgroundData: JSON.parse(JSON.stringify(activePlayground)),
                                    tasks: JSON.parse(JSON.stringify(zoneTasks)),
                                    createdAt: Date.now(),
                                    isGlobal: true
                                };

                                console.log('[PlaygroundEditor] Template prepared:', {
                                    id: template.id,
                                    title: template.title,
                                    taskCount: template.tasks.length,
                                    hasPlaygroundData: !!template.playgroundData
                                });

                                await db.savePlaygroundTemplate(template);

                                console.log('[PlaygroundEditor] Template saved successfully');
                                alert(`✅ Template "${templateName}" saved successfully!\n\nTasks included: ${zoneTasks.length}\n\nYou can now use this template to create new playzones.`);
                            } catch (error) {
                                console.error('[PlaygroundEditor] Failed to save template:', error);
                                alert('❌ Failed to save template. Please try again.');
                            }
                        }}
                        className="w-full px-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        title="Save this playzone with all tasks and settings as a reusable global template"
                        type="button"
                    >
                        <Library className="w-5 h-5" />
                        <span>SAVE AS TEMPLATE</span>
                    </button>

                    {/* SYNC FROM LIBRARY Button */}
                    <button
                        onClick={async () => {
                            const taskCount = game.points.length;
                            const confirm = window.confirm(
                                `🔄 SYNC FROM GLOBAL LIBRARY\n\n` +
                                `This will update all ${taskCount} tasks with the latest data from the global library.\n\n` +
                                `Any changes made in the library (titles, questions, points, etc.) will be applied here.\n\n` +
                                `Game-specific settings (positions, unlock status, etc.) will be preserved.\n\n` +
                                `Continue?`
                            );

                            if (!confirm) return;

                            try {
                                // Sync all game points with library
                                const { tasks: syncedTasks, syncedCount } = await db.syncTasksFromLibrary(game.points);

                                if (syncedCount === 0) {
                                    alert('ℹ️ No tasks were synced.\n\nThis could mean:\n• Tasks don\'t exist in the library\n• Tasks are already up to date');
                                    return;
                                }

                                // Update the game with synced tasks
                                onUpdateGame({
                                    ...game,
                                    points: syncedTasks
                                });

                                alert(`✅ Successfully synced ${syncedCount} task${syncedCount !== 1 ? 's' : ''} from the global library!`);
                            } catch (error) {
                                console.error('Failed to sync from library:', error);
                                alert('❌ Failed to sync from library. Please try again.');
                            }
                        }}
                        className="w-full px-4 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                        title="Update all tasks with the latest data from the global library"
                        type="button"
                    >
                        <Repeat className="w-5 h-5" />
                        <span>SYNC FROM LIBRARY</span>
                    </button>

                    {/* Orange Divider */}
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-30" />

                    {/* Update/Delete Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={async () => {
                                setIsSaving(true);
                                setSaveStatus('saving');
                                try {
                                    // Always update the game state first
                                    await Promise.resolve(onUpdateGame(game));
                                    // Then save to database if in template mode
                                    if (isTemplateMode && onSaveTemplate) {
                                        // Use the actual playzone title instead of the template name
                                        const templateName = activePlayground?.title || game.name;
                                        await Promise.resolve(onSaveTemplate(templateName));
                                    }
                                    setSaveStatus('success');
                                    setTimeout(() => {
                                        setSaveStatus('idle');
                                    }, 2500);
                                } catch (error) {
                                    console.error('Save failed:', error);
                                    setSaveStatus('idle');
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                            disabled={isSaving}
                            className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
                                saveStatus === 'success'
                                    ? 'bg-green-600 text-white'
                                    : isSaving
                                    ? 'bg-blue-600 text-white opacity-80 cursor-wait'
                                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                            }`}
                        >
                            {saveStatus === 'saving' && (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    {isTemplateMode ? 'SAVING TEMPLATE...' : 'SAVING...'}
                                </>
                            )}
                            {saveStatus === 'success' && (
                                <>
                                    <Check className="w-4 h-4" />
                                    {isTemplateMode ? 'TEMPLATE SAVED!' : 'ZONE SAVED!'}
                                </>
                            )}
                            {saveStatus === 'idle' && (
                                <>
                                    <Save className="w-4 h-4 translate-x-0.5" />
                                    {isTemplateMode ? 'UPDATE TEMPLATE' : 'UPDATE ZONE'}
                                </>
                            )}
                        </button>

                        {activePlayground && (
                            <button
                                onClick={() => {
                                    const zoneName = activePlayground.title || 'this zone';
                                    const taskCount = game.points.filter(p => p.playgroundId === activePlayground.id).length;
                                    setDeleteZoneConfirm({
                                        isOpen: true,
                                        zoneName,
                                        taskCount,
                                    });
                                }}
                                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 border-2 border-red-500 shadow-lg shadow-red-500/20"
                                title="Delete this zone permanently - WARNING: This cannot be undone!"
                            >
                                <Trash2 className="w-4 h-4" /> DELETE ZONE
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT MAIN CANVAS */}
            <div ref={editorRootRef} className="flex-1 relative flex flex-col bg-[#050505]">
                {/* Drawer Toggle Button - Always Visible */}
                <button
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-r-2xl shadow-2xl transition-all active:scale-95"
                    title={isDrawerOpen ? "Close Settings" : "Open Settings"}
                >
                    {isDrawerOpen ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                </button>

                {/* Top Overlay Bar - Title, Zone Tabs (centered), and Home */}
                <div className="absolute top-0 left-0 right-0 z-10">
                    <div className="p-4 flex items-center gap-4 relative">
                        {/* Left: Title */}
                        <div className="hidden flex items-center gap-3 bg-slate-900/80 backdrop-blur-sm border border-orange-500/30 rounded-xl px-4 py-2 shadow-xl pointer-events-auto flex-shrink-0">
                            <LayoutGrid className="w-5 h-5 text-orange-500" />
                            <div>
                                <h1 className="text-sm font-black text-white uppercase tracking-widest">
                                    PLAYZONE EDITOR
                                </h1>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    {game.playgrounds?.length || 0} ZONES ACTIVE
                                </p>
                            </div>
                        </div>

                        {/* Center: Zone Tabs - Centered in Editor Window */}
                        <div className="absolute left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto pointer-events-auto hide-scrollbar">
                            {/* ADD NEW Button First (hide when editing/creating playzone templates) */}
                            {!isTemplateMode && (
                                <button
                                    onClick={addNewZone}
                                    disabled={isInstructorView}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all flex-shrink-0 bg-green-600 hover:bg-green-700 text-white shadow-lg border-2 border-green-500 flex items-center gap-2"
                                    title="Add a new zone to the game"
                                >
                                    <Plus className="w-4 h-4" /> ADD NEW
                                </button>
                            )}

                            {/* Zone Tabs */}
                            {uniquePlaygrounds.map((pg, index) => {
                                const TabIcon = ICON_COMPONENTS[pg.iconId || 'default'] || ICON_COMPONENTS.default;
                                return (
                                <button
                                    key={pg.id}
                                    onClick={() => setActivePlaygroundId(pg.id)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-2 shadow-lg border-2 ${
                                        activePlaygroundId === pg.id
                                            ? 'bg-orange-600 text-white border-orange-500 shadow-orange-500/50'
                                            : 'bg-slate-800/80 backdrop-blur-sm text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700 hover:border-slate-600'
                                    }`}
                                    title={`Switch to ${pg.title}`}
                                >
                                    <TabIcon className="w-3 h-3 flex-shrink-0" />
                                    <span className="text-[10px] font-black opacity-70">{String(index + 1).padStart(2, '0')}</span>
                                    {pg.title}
                                </button>
                                );
                            })}
                        </div>

                        {/* Right: Home Button */}
                        <button
                            onClick={onHome}
                            className="p-3 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 text-slate-400 hover:text-white rounded-full shadow-xl border border-slate-700 transition-all pointer-events-auto flex-shrink-0 ml-auto"
                            title="Return Home"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Draggable ORIENTATION Toolbar - HIDDEN - Now in left drawer */}
                <div
                    className="hidden absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: orientationToolbarPos.x, top: orientationToolbarPos.y }}
                    onPointerDown={handleOrientationPointerDown}
                    onPointerMove={handleOrientationPointerMove}
                    onPointerUp={handleOrientationPointerUp}
                >
                    <div className="bg-black/40 backdrop-blur-sm border border-orange-500/30 rounded-lg shadow-2xl p-2 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full px-2 border border-orange-500/30 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest px-1">DEVICE</span>
                            <div className="flex gap-2 border-r border-orange-500/30 pr-2">
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSelectedDevice('mobile');
                                        }}
                                        className={`p-2 rounded transition-all cursor-pointer pointer-events-auto ${
                                            selectedDevice === 'mobile'
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Mobile (375×812)"
                                        type="button"
                                    >
                                        <Smartphone className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[7px] font-black uppercase tracking-widest whitespace-nowrap ${selectedDevice === 'mobile' ? 'text-blue-300' : 'text-slate-500'}`}>MOBILE</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSelectedDevice('tablet');
                                        }}
                                        className={`p-2 rounded transition-all cursor-pointer pointer-events-auto ${
                                            selectedDevice === 'tablet'
                                                ? 'bg-cyan-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Tablet (1024×768)"
                                        type="button"
                                    >
                                        <Tablet className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[7px] font-black uppercase tracking-widest ${selectedDevice === 'tablet' ? 'text-cyan-300' : 'text-slate-500'}`}>TABLET</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSelectedDevice('desktop');
                                        }}
                                        className={`p-2 rounded transition-all cursor-pointer pointer-events-auto ${
                                            selectedDevice === 'desktop'
                                                ? 'bg-purple-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Desktop (1920×1080)"
                                        type="button"
                                    >
                                        <Monitor className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[7px] font-black uppercase tracking-widest ${selectedDevice === 'desktop' ? 'text-purple-300' : 'text-slate-500'}`}>DESKTOP</span>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest px-1">ORIENTATION</span>
                            <div className="flex gap-3">
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEditorOrientation('portrait');
                                            if (isOrientationLocked && activePlayground) {
                                                const newLayouts = { ...activePlayground.deviceLayouts };
                                                newLayouts[selectedDevice] = {
                                                    ...newLayouts[selectedDevice],
                                                    orientationLock: 'portrait',
                                                };
                                                updatePlayground({ deviceLayouts: newLayouts });
                                            }
                                        }}
                                        className={`p-2 rounded transition-all cursor-pointer pointer-events-auto ${
                                            editorOrientation === 'portrait'
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Preview portrait"
                                        type="button"
                                    >
                                        <Smartphone className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${editorOrientation === 'portrait' ? 'text-orange-300' : 'text-slate-500'}`}>PORTRAIT</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEditorOrientation('landscape');
                                            if (isOrientationLocked && activePlayground) {
                                                const newLayouts = { ...activePlayground.deviceLayouts };
                                                newLayouts[selectedDevice] = {
                                                    ...newLayouts[selectedDevice],
                                                    orientationLock: 'landscape',
                                                };
                                                updatePlayground({ deviceLayouts: newLayouts });
                                            }
                                        }}
                                        className={`p-2 rounded transition-all cursor-pointer pointer-events-auto ${
                                            editorOrientation === 'landscape'
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Preview landscape (tablet default)"
                                        type="button"
                                    >
                                        <Monitor className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${editorOrientation === 'landscape' ? 'text-orange-300' : 'text-slate-500'}`}>LAND</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!activePlayground) return;
                                            const newLayouts = { ...activePlayground.deviceLayouts };
                                            if (isOrientationLocked) {
                                                newLayouts[selectedDevice] = {
                                                    ...newLayouts[selectedDevice],
                                                    orientationLock: 'none',
                                                };
                                            } else {
                                                newLayouts[selectedDevice] = {
                                                    ...newLayouts[selectedDevice],
                                                    orientationLock: editorOrientation,
                                                };
                                            }
                                            updatePlayground({ deviceLayouts: newLayouts });
                                        }}
                                        className={`p-2 rounded transition-all cursor-pointer pointer-events-auto ${
                                            isOrientationLocked
                                                ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-400'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title={isOrientationLocked ? 'Unlock orientation - Device can rotate freely' : 'Lock to selected orientation - Forces chosen orientation in game'}
                                        type="button"
                                    >
                                        <Lock className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${isOrientationLocked ? 'text-red-300' : 'text-slate-500'}`}>LOCK</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Orientation Lock Warning - HIDDEN - Now shown inline in left drawer */}

                {isBackgroundLocked && (
                    <div className="absolute top-4 left-4 bg-red-900/90 border-2 border-red-500 rounded-xl p-4 text-[10px] text-red-100 uppercase font-black tracking-widest shadow-2xl max-w-xs pointer-events-auto z-50 backdrop-blur-sm">
                        🔒 BACKGROUND IS LOCKED - DRAGGING DISABLED
                    </div>
                )}

                {/* Draggable SHOW Toolbar - HIDDEN - Now in left drawer */}
                <div
                    className="hidden absolute z-[1100] pointer-events-auto touch-none"
                    style={{ left: showToolbarPos.x, top: showToolbarPos.y }}
                    onPointerDown={handleShowPointerDown}
                    onPointerMove={handleShowPointerMove}
                    onPointerUp={handleShowPointerUp}
                >
                    <div className="bg-black/40 backdrop-blur-sm border border-orange-500/30 rounded-lg shadow-2xl p-2 cursor-move group relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full px-2 border border-orange-500/30 pointer-events-none">
                            <GripHorizontal className="w-3 h-3" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest px-1">SHOW</span>
                            <div className="flex gap-3">
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Auto-switch to landscape if on tablet in portrait mode
                                            if (selectedDevice === 'tablet' && editorOrientation === 'portrait' && !showTaskScores) {
                                                setEditorOrientation('landscape');
                                            }
                                            setShowTaskScores(!showTaskScores);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showTaskScores
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Show/Hide Task Scores"
                                        type="button"
                                    >
                                        <span className="text-xs font-bold">$</span>
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${showTaskScores ? 'text-orange-300' : 'text-slate-500'}`}>SCORE</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Auto-switch to landscape if on tablet in portrait mode
                                            if (selectedDevice === 'tablet' && editorOrientation === 'portrait' && !showTaskOrder) {
                                                setEditorOrientation('landscape');
                                            }
                                            setShowTaskOrder(!showTaskOrder);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showTaskOrder
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Show/Hide Task Order Numbers"
                                        type="button"
                                    >
                                        <span className="text-xs font-bold">#</span>
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${showTaskOrder ? 'text-orange-300' : 'text-slate-500'}`}>ORDER</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Auto-switch to landscape if on tablet in portrait mode
                                            if (selectedDevice === 'tablet' && editorOrientation === 'portrait' && !showTaskActions) {
                                                setEditorOrientation('landscape');
                                            }
                                            setShowTaskActions(!showTaskActions);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showTaskActions
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Show/Hide Task Actions"
                                        type="button"
                                    >
                                        <Zap className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${showTaskActions ? 'text-orange-300' : 'text-slate-500'}`}>ACTIONS</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Auto-switch to landscape if on tablet in portrait mode
                                            if (selectedDevice === 'tablet' && editorOrientation === 'portrait' && !showTaskNames) {
                                                setEditorOrientation('landscape');
                                            }
                                            setShowTaskNames(!showTaskNames);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showTaskNames
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Show/Hide Task Names"
                                        type="button"
                                    >
                                        <Type className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${showTaskNames ? 'text-orange-300' : 'text-slate-500'}`}>NAME</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Auto-switch to landscape if on tablet in portrait mode
                                            if (selectedDevice === 'tablet' && editorOrientation === 'portrait' && !showTaskStatus) {
                                                setEditorOrientation('landscape');
                                            }
                                            setShowTaskStatus(!showTaskStatus);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showTaskStatus
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Show/Hide answer markers (✓ correct / ✗ wrong) in editor preview. Each task can enable/disable this in settings."
                                        type="button"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                                        showTaskStatus ? 'text-orange-300' : 'text-slate-500'
                                    }`}>ANSWERS</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Auto-switch to landscape if on tablet in portrait mode
                                            if (selectedDevice === 'tablet' && editorOrientation === 'portrait' && !showBackground) {
                                                setEditorOrientation('landscape');
                                            }
                                            setShowBackground(!showBackground);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showBackground
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Show/Hide Background"
                                        type="button"
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${showBackground ? 'text-orange-300' : 'text-slate-500'}`}>BACKGROUND</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Auto-switch to landscape if on tablet in portrait mode
                                            if (selectedDevice === 'tablet' && editorOrientation === 'portrait' && !showQRScanner) {
                                                setEditorOrientation('landscape');
                                            }
                                            setShowQRScanner(!showQRScanner);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showQRScanner
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Show/Hide QR Scanner"
                                        type="button"
                                    >
                                        <QrCode className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${showQRScanner ? 'text-orange-300' : 'text-slate-500'}`}>QR</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowTitleTextEditor(!showTitleTextEditor);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showTitleTextEditor
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Edit Title Text Settings"
                                        type="button"
                                    >
                                        <Type className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${showTitleTextEditor ? 'text-orange-300' : 'text-slate-500'}`}>TITLE</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Auto-switch to landscape if on tablet in portrait mode
                                            if (selectedDevice === 'tablet' && editorOrientation === 'portrait' && !showRanking) {
                                                setEditorOrientation('landscape');
                                            }
                                            setShowRanking(!showRanking);
                                        }}
                                        className={`w-9 h-9 rounded transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${
                                            showRanking
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title="Show/Hide Ranking Leaderboard"
                                        type="button"
                                    >
                                        <Trophy className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${showRanking ? 'text-orange-300' : 'text-slate-500'}`}>RANKING</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Draggable TOOLS Toolbar */}
                {/* TOOLS Toolbar - REMOVED */}

                {/* Canvas Area */}
                <div
                    ref={canvasRef}
                    className={`flex-1 overflow-hidden relative bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:40px_40px] [background-position:center] flex items-center justify-center p-4 ${
                        snapToRoadMode ? 'cursor-crosshair'
                        : drawMode.active ? 'cursor-crosshair'
                        : 'cursor-grab active:cursor-grabbing'
                    }`}
                    onWheel={snapToRoadMode ? undefined : handleWheel}
                    onMouseDown={snapToRoadMode ? handleSnapToRoadStart : handleMouseDown}
                    onMouseMove={snapToRoadMode ? handleSnapToRoadMove : handleMouseMove}
                    onMouseUp={snapToRoadMode ? handleSnapToRoadEnd : handleMouseUp}
                    onMouseLeave={snapToRoadMode ? undefined : handleMouseUp}
                >
                    {/* Device Frame Scaling Wrapper - ensures full tablet portrait frame is visible */}
                    <div
                        className="flex items-center justify-center"
                        style={{
                            transform: selectedDevice === 'tablet' && editorOrientation === 'portrait' ? 'scale(0.72)' : 'scale(1)',
                            transformOrigin: 'center center',
                            transition: 'transform 0.3s ease-out',
                            width: selectedDevice === 'desktop' ? '100%' : 'auto',
                            height: selectedDevice === 'desktop' ? '100%' : 'auto'
                        }}
                    >
                        {/* Device Frame Container - Responsive to Selected Device */}
                        <div className={`relative border-8 border-slate-950 rounded-3xl overflow-hidden flex-shrink-0`}
                        style={{
                            width: viewportDims.width,
                            height: viewportDims.height,
                            boxShadow: '0 0 0 12px #1f2937, 0 0 0 16px #000000, inset 0 0 0 1px #444'
                        }}>
                        <div
                        ref={backgroundRef}
                        style={{
                            ...bgStyle,
                            width: '100%',
                            height: '100%'
                        }}
                        className="relative"
                    >
                        {!activePlayground?.imageUrl && (
                            <div className="absolute inset-0 flex items-center justify-center border-4 border-dashed border-slate-700/50 m-20 rounded-3xl">
                                <div className="text-center opacity-30">
                                    <ImageIcon className="w-24 h-24 mx-auto mb-4" />
                                    <p className="text-2xl font-black uppercase tracking-widest">UPLOAD BACKGROUND</p>
                                </div>
                            </div>
                        )}

                        {/* Grid Overlay */}
                        {showGrid && (
                            <svg
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <defs>
                                    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 165, 0, 0.6)" strokeWidth="1.5"/>
                                    </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#grid)" />
                            </svg>
                        )}

                        {/* Action Links Visualization */}
                        {showTaskActions && (
                            <svg
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <defs>
                                    <pattern id="correct-dots" width="8" height="2" patternUnits="userSpaceOnUse">
                                        <circle cx="1" cy="1" r="0.5" fill="#10b981" opacity="0.8"/>
                                    </pattern>
                                    <pattern id="incorrect-dots" width="8" height="2" patternUnits="userSpaceOnUse">
                                        <circle cx="1" cy="1" r="0.5" fill="#ef4444" opacity="0.8"/>
                                    </pattern>
                                    <pattern id="action-dots" width="8" height="2" patternUnits="userSpaceOnUse">
                                        <circle cx="1" cy="1" r="0.5" fill="#eab308" opacity="0.8"/>
                                    </pattern>
                                </defs>
                                {uniquePlaygroundPoints.flatMap((source) => {
                                    const sourcePos = getDevicePosition(source);
                                    const sourceX = sourcePos.x;
                                    const sourceY = sourcePos.y;

                                    // Extract target IDs from GameAction objects
                                    const getTargetIds = (actions: any[] | undefined) => {
                                        if (!actions) return [];
                                        return actions
                                            .map(action => action.targetId || action)
                                            .filter(id => typeof id === 'string' && id.length > 0);
                                    };

                                    return [
                                        ...getTargetIds(source.logic?.onCorrect).map((targetId, idx) => {
                                            const target = game.points?.find(p => p.id === targetId);
                                            if (!target) return null;
                                            const targetPos = getDevicePosition(target);
                                            const targetX = targetPos.x;
                                            const targetY = targetPos.y;
                                            return (
                                                <line
                                                    key={`correct-${source.id}-${targetId}-${idx}`}
                                                    x1={sourceX}
                                                    y1={sourceY}
                                                    x2={targetX}
                                                    y2={targetY}
                                                    stroke="#10b981"
                                                    strokeWidth="1.2"
                                                    strokeDasharray="4,3"
                                                    opacity="0.9"
                                                    className="animate-pulse"
                                                />
                                            );
                                        }),
                                        ...getTargetIds(source.logic?.onIncorrect).map((targetId, idx) => {
                                            const target = game.points?.find(p => p.id === targetId);
                                            if (!target) return null;
                                            const targetPos = getDevicePosition(target);
                                            const targetX = targetPos.x;
                                            const targetY = targetPos.y;
                                            return (
                                                <line
                                                    key={`incorrect-${source.id}-${targetId}-${idx}`}
                                                    x1={sourceX}
                                                    y1={sourceY}
                                                    x2={targetX}
                                                    y2={targetY}
                                                    stroke="#ef4444"
                                                    strokeWidth="1.2"
                                                    strokeDasharray="4,3"
                                                    opacity="0.9"
                                                    className="animate-pulse"
                                                />
                                            );
                                        }),
                                        ...getTargetIds(source.logic?.onOpen).map((targetId, idx) => {
                                            const target = game.points?.find(p => p.id === targetId);
                                            if (!target) return null;
                                            const targetPos = getDevicePosition(target);
                                            const targetX = targetPos.x;
                                            const targetY = targetPos.y;
                                            return (
                                                <line
                                                    key={`open-${source.id}-${targetId}-${idx}`}
                                                    x1={sourceX}
                                                    y1={sourceY}
                                                    x2={targetX}
                                                    y2={targetY}
                                                    stroke="#eab308"
                                                    strokeWidth="1.2"
                                                    strokeDasharray="4,3"
                                                    opacity="0.9"
                                                    className="animate-pulse"
                                                />
                                            );
                                        })
                                    ].filter(Boolean);
                                })}
                            </svg>
                        )}

                        {/* Temporary Draw Line - Shows line from source to mouse cursor */}
                        {drawMode.active && drawMode.sourceTaskId && drawMode.mousePosition && (
                            <svg
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                {(() => {
                                    const sourceTask = uniquePlaygroundPoints.find(p => p.id === drawMode.sourceTaskId);
                                    if (!sourceTask) return null;

                                    const sourcePos = getDevicePosition(sourceTask);
                                    const sourceX = sourcePos.x;
                                    const sourceY = sourcePos.y;
                                    const mouseX = drawMode.mousePosition.x;
                                    const mouseY = drawMode.mousePosition.y;

                                    const lineColor = drawMode.trigger === 'onCorrect'
                                        ? '#10b981'
                                        : drawMode.trigger === 'onIncorrect'
                                        ? '#ef4444'
                                        : '#eab308';

                                    return (
                                        <>
                                            {/* Animated line */}
                                            <line
                                                x1={sourceX}
                                                y1={sourceY}
                                                x2={mouseX}
                                                y2={mouseY}
                                                stroke={lineColor}
                                                strokeWidth="1.2"
                                                strokeDasharray="4,3"
                                                opacity="0.9"
                                                className="animate-pulse"
                                            />
                                            {/* End point circle */}
                                            <circle
                                                cx={mouseX}
                                                cy={mouseY}
                                                r="1.5"
                                                fill={lineColor}
                                                opacity="0.7"
                                            />
                                        </>
                                    );
                                })()}
                            </svg>
                        )}

                        {/* Tasks on Canvas */}
                        {uniquePlaygroundPoints.map((point, index) => {
                            const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                            const isSelected = selectedTaskId === point.id;
                            const isMarked = markedTaskIds.has(point.id);
                            const displaySize = (point.playgroundScale || 1) * 48;
                            const isDraggingThis = draggingTaskId === point.id;

                            // Draw mode visual states
                            const isDrawSource = drawMode.active && drawMode.sourceTaskId === point.id;
                            const isDrawTarget = drawMode.active && drawMode.sourceTaskId && point.id !== drawMode.sourceTaskId;
                            const isHoveredTarget = isDrawTarget && hoveredTaskId === point.id;

                            // Check if this task is a target of any action from other tasks
                            const isActionTarget = uniquePlaygroundPoints.some(source =>
                                source.id !== point.id && source.logic && (
                                    (source.logic.onCorrect?.some((a: any) => a.targetId === point.id || a === point.id)) ||
                                    (source.logic.onIncorrect?.some((a: any) => a.targetId === point.id || a === point.id)) ||
                                    (source.logic.onOpen?.some((a: any) => a.targetId === point.id || a === point.id))
                                )
                            );
                            // Use visual position while dragging, otherwise use device-specific position
                            const devicePos = getDevicePosition(point);
                            const displayX = isDraggingThis && dragVisualPosition ? dragVisualPosition.x : devicePos.x;
                            const displayY = isDraggingThis && dragVisualPosition ? dragVisualPosition.y : devicePos.y;

                            return (
                                <div
                                    key={point.id}
                                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 group ${
                                        isSimulationActive ? 'cursor-pointer'
                                        : isDraggingThis ? 'cursor-grabbing'
                                        : isDrawTarget ? 'cursor-pointer'
                                        : isMarkMode ? 'cursor-pointer'
                                        : drawMode.active ? 'cursor-default'
                                        : 'cursor-grab'
                                    }`}
                                    style={{ left: `${displayX}%`, top: `${displayY}%` }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onMouseEnter={() => setHoveredTaskId(point.id)}
                                    onMouseLeave={() => setHoveredTaskId(null)}
                                    onPointerDown={(e) => {
                                        // SIMULATION MODE: Click task to open it
                                        if (isSimulationActive) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setActiveSimulationTaskId(point.id);
                                            return;
                                        }

                                        if (drawMode.active && drawMode.sourceTaskId && point.id !== drawMode.sourceTaskId) {
                                            // In draw mode: clicking a target task creates the connection
                                            e.preventDefault();
                                            e.stopPropagation();

                                            const sourceTask = uniquePlaygroundPoints.find(p => p.id === drawMode.sourceTaskId);
                                            if (sourceTask && drawMode.trigger) {
                                                // Create a new "unlock" action with this target
                                                const newAction: any = {
                                                    id: `act-${Date.now()}`,
                                                    type: 'unlock',
                                                    targetId: point.id
                                                };

                                                const updatedLogic = {
                                                    ...sourceTask.logic,
                                                    [drawMode.trigger]: [...(sourceTask.logic?.[drawMode.trigger] || []), newAction]
                                                };

                                                // Update the game with the new logic
                                                onUpdateGame({
                                                    ...game,
                                                    points: game.points.map(p =>
                                                        p.id === sourceTask.id
                                                            ? { ...p, logic: updatedLogic }
                                                            : p
                                                    )
                                                });

                                                // Keep draw mode active so user can continue connecting
                                                console.log(`Connected ${sourceTask.title} → ${point.title} via ${drawMode.trigger}`);
                                            }
                                        } else if (isMarkMode && !isDraggingThis) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleMarkTask(point.id);
                                        } else if (!drawMode.active) {
                                            handleTaskPointerDown(e, point);
                                        }
                                    }}
                                    onPointerMove={handleTaskPointerMove}
                                    onPointerUp={handleTaskPointerUp}
                                    onPointerCancel={handleTaskPointerUp}
                                >
                                    <div className={`rounded-full flex items-center justify-center border-4 shadow-xl transition-all relative overflow-hidden ${
                                        isDrawSource && drawMode.trigger === 'onCorrect'
                                            ? 'border-green-500 shadow-green-500/70 scale-125 animate-pulse'
                                            : isDrawSource && drawMode.trigger === 'onIncorrect'
                                            ? 'border-red-500 shadow-red-500/70 scale-125 animate-pulse'
                                            : isDrawSource && drawMode.trigger === 'onOpen'
                                            ? 'border-yellow-500 shadow-yellow-500/70 scale-125 animate-pulse'
                                            : isHoveredTarget && drawMode.trigger === 'onCorrect'
                                            ? 'border-green-400 shadow-green-400/70 scale-125 ring-4 ring-green-400/30'
                                            : isHoveredTarget && drawMode.trigger === 'onIncorrect'
                                            ? 'border-red-400 shadow-red-400/70 scale-125 ring-4 ring-red-400/30'
                                            : isHoveredTarget && drawMode.trigger === 'onOpen'
                                            ? 'border-yellow-400 shadow-yellow-400/70 scale-125 ring-4 ring-yellow-400/30'
                                            : isDrawTarget
                                            ? 'border-slate-500 opacity-60'
                                            : hoveredTaskId === point.id
                                            ? 'border-orange-400 shadow-orange-400/70 scale-125'
                                            : isMarked
                                            ? 'border-orange-400 shadow-orange-400/70 scale-120 animate-pulse'
                                            : isSelected
                                            ? 'border-orange-500 shadow-orange-500/50 scale-125'
                                            : 'border-slate-900 group-hover:scale-110'
                                    } ${point.isCompleted ? 'bg-green-500' : isActionTarget ? 'bg-slate-400/40' : 'bg-white'} ${isActionTarget && !isDrawTarget ? 'opacity-50' : ''}`}
                                    style={{ width: displaySize, height: displaySize }}>
                                        {/* Display icon based on answer status: solved icon if correct, unsolved if incorrect */}
                                        {((point.isCompleted && !((point as any).answeredIncorrectly)) && point.completedIconUrl) ? (
                                            // Correct answer - show solved icon
                                            <img
                                                src={point.completedIconUrl}
                                                alt={`${point.title} (Solved)`}
                                                className={`object-cover object-center rounded-full ${isActionTarget ? 'opacity-50' : ''}`}
                                                style={{
                                                    width: `${(point.iconImageScale || 0.9) * 100}%`,
                                                    height: `${(point.iconImageScale || 0.9) * 100}%`
                                                }}
                                            />
                                        ) : point.iconUrl ? (
                                            // Unsolved or incorrect answer - show regular icon
                                            <img
                                                src={point.iconUrl}
                                                alt={point.title}
                                                className={`object-cover object-center rounded-full ${isActionTarget ? 'opacity-50' : ''}`}
                                                style={{
                                                    width: `${(point.iconImageScale || 0.9) * 100}%`,
                                                    height: `${(point.iconImageScale || 0.9) * 100}%`
                                                }}
                                            />
                                        ) : (
                                            <Icon className={`w-6 h-6 ${point.isCompleted && !((point as any).answeredIncorrectly) ? 'text-white' : isActionTarget ? 'text-slate-400' : 'text-slate-900'}`} />
                                        )}

                                        {/* OK/Wrong Answer Marker - Green Check (correct) or Red X (wrong) */}
                                        {showTaskStatus && (point.showStatusMarkers ?? true) && (point.isCompleted || (point as any).answeredIncorrectly) && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                {(point as any).answeredIncorrectly ? (
                                                    // Red X for incorrect - fills entire icon
                                                    <XCircle className="w-full h-full text-red-500 drop-shadow-[0_4px_12px_rgba(239,68,68,0.9)]" strokeWidth={2} />
                                                ) : (
                                                    // Green checkmark for correct - fills entire icon
                                                    <CheckCircle className="w-full h-full text-green-500 drop-shadow-[0_4px_12px_rgba(34,197,94,0.9)]" strokeWidth={2} />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Badges - Positioned outside overflow-hidden container to render on top */}
                                    {/* Mark Indicator Badge */}
                                    {isMarked && (
                                        <div className="absolute -top-2 -right-2 bg-orange-400 text-white text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-lg pointer-events-none">
                                            ✓
                                        </div>
                                    )}

                                    {/* Task Order Badge */}
                                    {showTaskOrder && (
                                        <div className="absolute -top-1 -right-1 bg-orange-600 text-white text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-lg pointer-events-none">
                                            {String(index + 1).padStart(2, '0')}
                                        </div>
                                    )}

                                    {/* Task Score Badge */}
                                    {showTaskScores && (
                                        <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-slate-900 text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-lg pointer-events-none">
                                            {point.points}
                                        </div>
                                    )}

                                    {/* Task Actions Badge */}
                                    {showTaskActions && point.logic && (point.logic.onOpen?.length || point.logic.onCorrect?.length || point.logic.onIncorrect?.length) && (
                                        <div className="absolute -bottom-1 -left-1 bg-purple-600 text-white text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-lg pointer-events-none">
                                            ⚡
                                        </div>
                                    )}

                                    {/* Task Name - Always Visible when showTaskNames is true */}
                                    {showTaskNames && (
                                        <div
                                            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/90 text-white font-bold px-2 py-1 rounded uppercase whitespace-nowrap pointer-events-none shadow-lg border border-orange-500/30"
                                            style={{
                                                fontSize: `${(point.textLabelScale || 1) * 9}px`
                                            }}
                                        >
                                            {point.title}
                                        </div>
                                    )}

                                    {/* Hover Tooltip - Only visible when names are hidden OR in mark mode */}
                                    {(!showTaskNames || isMarkMode) && (
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/80 text-white text-[9px] font-bold px-2 py-1 rounded uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            {isMarkMode ? (isMarked ? '✓ MARKED' : 'CLICK TO MARK') : point.title}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Draggable QR Scanner Button - Inside Game Canvas */}
                        {showQRScanner && (
                            <div
                                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-auto group"
                                style={{
                                    left: `${qrScannerPos.x}%`,
                                    top: `${qrScannerPos.y}%`,
                                    width: `${qrScannerSize.width}px`,
                                    height: `${qrScannerSize.height}px`,
                                }}
                                onPointerDown={isSimulationActive ? undefined : handleQRScannerPointerDown}
                                onPointerMove={isSimulationActive ? undefined : handleQRScannerPointerMove}
                                onPointerUp={isSimulationActive ? undefined : handleQRScannerPointerUp}
                                onPointerCancel={isSimulationActive ? undefined : handleQRScannerPointerUp}
                            >
                                {/* QR Scan Button - Resizable, draggable, color customizable */}
                                <button
                                    onPointerDown={(e) => {
                                        // Track button position for click detection (separate from wrapper's drag)
                                        qrScannerButtonDownPos.current = { x: e.clientX, y: e.clientY };
                                        qrScannerHasMoved.current = false;
                                        // Don't stop propagation - allow parent wrapper to handle dragging
                                    }}
                                    onPointerMove={(e) => {
                                        // Track if user moved significantly (threshold: 5px)
                                        const deltaX = Math.abs(e.clientX - qrScannerButtonDownPos.current.x);
                                        const deltaY = Math.abs(e.clientY - qrScannerButtonDownPos.current.y);
                                        if (deltaX > 5 || deltaY > 5) {
                                            qrScannerHasMoved.current = true;
                                        }
                                    }}
                                    onPointerUp={(e) => {
                                        // Only count as click if there was minimal movement
                                        if (qrScannerHasMoved.current) {
                                            return; // This was a drag, not a click
                                        }

                                        // Stop propagation only if this is a valid click (not a drag)
                                        e.stopPropagation();

                                        // In simulation mode, always open scanner on single click
                                        if (isSimulationActive) {
                                            handleQRScanClick();
                                            return;
                                        }

                                        // In editor mode, detect double-click for color picker
                                        qrScannerClickCount.current++;

                                        if (qrScannerClickCount.current === 1) {
                                            // First click - set timer to detect double-click
                                            if (qrScannerClickTimer.current) {
                                                clearTimeout(qrScannerClickTimer.current);
                                            }
                                            qrScannerClickTimer.current = setTimeout(() => {
                                                // Single click - do nothing, just allow drag/resize
                                                qrScannerClickCount.current = 0;
                                            }, 300);
                                        } else if (qrScannerClickCount.current === 2) {
                                            // Double-click detected - open color picker
                                            if (qrScannerClickTimer.current) {
                                                clearTimeout(qrScannerClickTimer.current);
                                            }
                                            qrScannerClickCount.current = 0;
                                            handleQRScanClick(); // Opens color picker
                                        }
                                    }}
                                    style={{
                                        backgroundColor: qrScannerColor,
                                        width: '100%',
                                        height: '100%',
                                        boxShadow: `inset 0 0 0 2px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.9), 0 0 16px rgba(0, 0, 0, 0.7)`
                                    }}
                                    className={`flex items-center justify-center gap-1 rounded-xl text-white font-bold uppercase shadow-xl transition-all hover:ring-2 hover:ring-yellow-400 relative ${
                                        isSimulationActive ? 'cursor-pointer' : 'cursor-move'
                                    }`}
                                    title={isSimulationActive ? 'Click to scan QR code' : 'Double-click to change color | Drag to move | Resize from corner'}
                                    type="button"
                                >
                                    {(() => {
                                        // Scale icon and text proportionally based on button height
                                        const baseHeight = 48;
                                        const scale = qrScannerSize.height / baseHeight;
                                        const iconSize = Math.max(12, Math.min(32, 16 * scale));
                                        const fontSize = Math.max(8, Math.min(14, 10 * scale));

                                        return (
                                            <>
                                                <QrCode style={{ width: `${iconSize}px`, height: `${iconSize}px` }} />
                                                <span style={{ fontSize: `${fontSize}px` }}>
                                                    SCAN QR
                                                </span>
                                            </>
                                        );
                                    })()}
                                </button>

                                {/* Resize handle - bottom-right corner (hidden in simulation mode) */}
                                {!isSimulationActive && (
                                    <div
                                        className="qr-resize-handle absolute bottom-0 right-0 w-4 h-4 bg-yellow-400 border-2 border-yellow-600 rounded-tl rounded-br cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
                                        onPointerDown={handleQRScannerResizeDown}
                                        onPointerMove={handleQRScannerResizeMove}
                                        onPointerUp={handleQRScannerResizeUp}
                                        onPointerCancel={handleQRScannerResizeUp}
                                        title="Drag to resize"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                )}
                            </div>
                        )}

                        {/* Draggable Title Text - Inside Game Canvas */}
                        {showTitleText && titleTextContent && (
                            <div
                                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto group"
                                style={{
                                    left: `${titleTextPos.x}%`,
                                    top: `${titleTextPos.y}%`,
                                    width: `${titleTextSize.width}px`,
                                    height: `${titleTextSize.height}px`,
                                }}
                                onPointerDown={isSimulationActive ? undefined : handleTitleTextPointerDown}
                                onPointerMove={isSimulationActive ? undefined : handleTitleTextPointerMove}
                                onPointerUp={isSimulationActive ? undefined : handleTitleTextPointerUp}
                                onPointerCancel={isSimulationActive ? undefined : handleTitleTextPointerUp}
                            >
                                {/* Title Text Content */}
                                <div
                                    className="w-full h-full flex items-center justify-center bg-black/50 rounded-lg border-2 border-orange-500/50 hover:border-orange-400 transition-colors"
                                    style={{
                                        color: titleTextColor,
                                        fontSize: `${titleTextFontSize}px`,
                                        fontWeight: 'bold',
                                        cursor: isSimulationActive ? 'default' : isDraggingTitleText ? 'grabbing' : 'grab',
                                        textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                                        overflow: 'hidden',
                                        wordWrap: 'break-word',
                                        padding: '8px'
                                    }}
                                >
                                    {titleTextContent}
                                </div>

                                {/* Resize Handle - Only visible in editor mode */}
                                {!isSimulationActive && (
                                    <div
                                        className="title-text-resize-handle absolute bottom-0 right-0 w-4 h-4 bg-yellow-400 border-2 border-yellow-600 rounded-tl rounded-br cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
                                        onPointerDown={handleTitleTextResizeDown}
                                        onPointerMove={handleTitleTextResizeMove}
                                        onPointerUp={handleTitleTextResizeUp}
                                        onPointerCancel={handleTitleTextResizeUp}
                                        title="Drag to resize"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                )}
                            </div>
                        )}
                        </div>
                    </div>
                    </div>
                </div>

                {/* Right Side Tools hidden - functionality moved to right tasks drawer */}

                {/* Delete Zone - Bottom Right */}
                {/* Zoom Controls & Tools - Bottom Center */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2 pointer-events-auto">
                    <button
                        onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}
                        className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-5 h-5" />
                    </button>

                    {/* CENTER Button */}
                    <button
                        onClick={handleCenterBackground}
                        className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"
                        title="Center Background"
                    >
                        <Target className="w-5 h-5" />
                    </button>

                    {/* LOCK Background Button */}
                    <button
                        onClick={() => setIsBackgroundLocked(!isBackgroundLocked)}
                        className={`p-3 rounded-full shadow-xl border-2 transition-colors ${
                            isBackgroundLocked
                                ? 'bg-red-600 border-red-500 text-white hover:bg-red-700'
                                : 'bg-slate-900 border-slate-700 text-white hover:bg-slate-800'
                        }`}
                        title={isBackgroundLocked ? 'Unlock background (draggable)' : 'Lock background (not draggable)'}
                    >
                        {isBackgroundLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={() => setZoom(z => Math.min(5, z + 0.1))}
                        className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-5 h-5" />
                    </button>
                </div>

                {/* Delete Zone (BIN) - Bottom Right Corner */}
                <button
                    id="delete-zone-btn"
                    className={`absolute bottom-6 right-6 z-20 p-4 rounded-full shadow-xl border-2 transition-all pointer-events-auto ${
                        isOverDeleteZone
                            ? 'bg-red-600 border-red-500 text-white scale-110 animate-pulse shadow-red-500/50'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-600 hover:bg-slate-800'
                    }`}
                    title={isOverDeleteZone ? 'Drop to delete task' : 'Drag task here to delete from map'}
                >
                    <Trash2 className="w-5 h-5" />
                </button>

                {/* Snap-to-Road Selection Box Visualization */}
                {snapToRoadMode && selectionBox.start && selectionBox.current && (
                    <div
                        className="absolute border-2 border-cyan-500 bg-cyan-500/10 pointer-events-none z-40"
                        style={{
                            left: `${Math.min(selectionBox.start.x, selectionBox.current.x)}px`,
                            top: `${Math.min(selectionBox.start.y, selectionBox.current.y)}px`,
                            width: `${Math.abs(selectionBox.current.x - selectionBox.start.x)}px`,
                            height: `${Math.abs(selectionBox.current.y - selectionBox.start.y)}px`,
                            boxShadow: '0 0 8px rgba(34, 211, 238, 0.5)'
                        }}
                    />
                )}

                {/* Right Tasks Drawer Toggle Button - Always Visible */}
                <button
                    onClick={() => setIsTasksDrawerOpen(!isTasksDrawerOpen)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-l-2xl shadow-2xl transition-all active:scale-95"
                    title={isTasksDrawerOpen ? "Close Tasks" : "Open Tasks"}
                >
                    {isTasksDrawerOpen ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
                </button>
            </div>

            {/* RIGHT SIDE TASKS DRAWER - COLLAPSIBLE */}
            <div className={`flex flex-col border-l border-slate-800 bg-[#0f172a] shadow-2xl z-20 transition-all duration-300 ease-in-out ${
                isTasksDrawerOpen ? 'w-[360px]' : 'w-0'
            } overflow-hidden`}>
                {/* Header */}
                <div className="p-3 border-b border-slate-800 bg-[#0f172a] relative">
                    <button
                        onClick={() => setIsTasksDrawerOpen(false)}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-orange-500 hover:text-orange-400 transition-colors p-2"
                        title="Close Tasks"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col items-center gap-2">
                        <h2 className="text-sm font-black uppercase tracking-widest text-white">TASKS</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{uniquePlaygroundPoints.length} in zone</p>
                    </div>
                </div>

                {/* Content - Task Creation or Task Editor */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {selectedTask ? (
                        // Task Editor Panel
                        <div className="space-y-4">
                            {/* Back Button */}
                            <button
                                onClick={() => setSelectedTaskId(null)}
                                className="w-full py-2 flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
                            >
                                <ArrowLeft className="w-4 h-4" /> BACK TO LIST
                            </button>

                            {/* Task Title */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TASK TITLE</label>
                                <input
                                    value={selectedTask.title}
                                    onChange={(e) => updateTask({ title: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-orange-500"
                                />

                                {/* Task Action Buttons */}
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700">
                                    {/* SETTINGS Button (Orange) */}
                                    <button
                                        onClick={() => {
                                            setSettingsModalTaskId(selectedTask.id);
                                            setShowTaskSettingsModal(true);
                                        }}
                                        className="py-2 bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 hover:text-orange-300 border border-orange-600/40 hover:border-orange-500 rounded-lg font-bold uppercase tracking-wider text-[9px] flex flex-col items-center justify-center gap-1 transition-all"
                                        title="Open task settings"
                                    >
                                        <Settings className="w-4 h-4" />
                                        <span>SETTINGS</span>
                                    </button>

                                    {/* ACTIONS Button (Green) */}
                                    <button
                                        onClick={() => setShowActionModal(true)}
                                        className="py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 hover:text-green-300 border border-green-600/40 hover:border-green-500 rounded-lg font-bold uppercase tracking-wider text-[9px] flex flex-col items-center justify-center gap-1 transition-all"
                                        title="Set up if/then logic and actions"
                                    >
                                        <Zap className="w-4 h-4" />
                                        <span>ACTIONS</span>
                                    </button>

                                    {/* VIEW Button (Blue) */}
                                    <button
                                        onClick={() => setShowTaskViewModal(true)}
                                        className="py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 border border-blue-600/40 hover:border-blue-500 rounded-lg font-bold uppercase tracking-wider text-[9px] flex flex-col items-center justify-center gap-1 transition-all"
                                        title="Preview task view"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span>VIEW</span>
                                    </button>
                                </div>
                            </div>

                            {/* Task Answer Markers - Per-Task Setting */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> ANSWER MARKERS IN GAMEPLAY
                                </label>
                                <p className="text-[8px] text-slate-400">
                                    When enabled, this task will show ✓ OK or ✗ WRONG markers when teams re-enter the playzone after solving it. Toggle visibility in editor using SHOW toolbar → ANSWERS button.
                                </p>
                                <button
                                    onClick={() => updateTask({ showStatusMarkers: !(selectedTask.showStatusMarkers ?? true) })}
                                    className={`w-full py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border-2 flex items-center justify-center gap-2 ${
                                        (selectedTask.showStatusMarkers ?? true)
                                            ? 'bg-green-600/30 border-green-500 text-green-300 hover:bg-green-600/40'
                                            : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                                    }`}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>{(selectedTask.showStatusMarkers ?? true) ? 'ENABLED' : 'DISABLED'}</span>
                                </button>
                            </div>

                            {/* Icon Size Slider */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <ChevronRight className="w-3 h-3" /> ICON SIZE
                                    </label>
                                    <span className="text-[10px] font-bold text-orange-400">{Math.round((selectedTask.playgroundScale || 1) * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={selectedTask.playgroundScale || 1}
                                    onChange={(e) => updateTask({ playgroundScale: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                />
                            </div>

                            {/* Text Label Size Slider - NEW */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <Type className="w-3 h-3" /> TEXT LABEL SIZE
                                    </label>
                                    <span className="text-[10px] font-bold text-cyan-400">{Math.round((selectedTask.textLabelScale || 1) * 100)}%</span>
                                </div>
                                <p className="text-[8px] text-slate-400">
                                    Adjust text label size to prevent overlapping in Portrait mode
                                </p>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={selectedTask.textLabelScale || 1}
                                    onChange={(e) => updateTask({ textLabelScale: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />

                                {/* Bulk Apply to Marked Tasks */}
                                {markedTaskIds.size > 0 && (
                                    <div className="pt-2 border-t border-slate-700 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <p className="text-[8px] text-orange-400 font-bold uppercase tracking-wider">
                                                    {markedTaskIds.size} {markedTaskIds.size === 1 ? 'task' : 'tasks'} marked
                                                </p>
                                                <p className="text-[7px] text-slate-500 mt-0.5">
                                                    Apply current size to all selected
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const currentScale = selectedTask.textLabelScale || 1;
                                                    const updatedPoints = game.points.map(p =>
                                                        markedTaskIds.has(p.id) ? { ...p, textLabelScale: currentScale } : p
                                                    );
                                                    onUpdateGame({ ...game, points: updatedPoints });
                                                    alert(`Applied ${Math.round(currentScale * 100)}% text size to ${markedTaskIds.size} task(s)`);
                                                }}
                                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 shadow-lg"
                                                title={`Apply ${Math.round((selectedTask.textLabelScale || 1) * 100)}% to ${markedTaskIds.size} selected task(s)`}
                                            >
                                                <Check className="w-3 h-3" />
                                                APPLY
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Icon Image Size Slider - NEW */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> ICON IMAGE SIZE
                                    </label>
                                    <span className="text-[10px] font-bold text-purple-400">{Math.round((selectedTask.iconImageScale || 0.9) * 100)}%</span>
                                </div>
                                <p className="text-[8px] text-slate-400">
                                    Zoom & center picture from 50% to 200% (crops to stay within circles)
                                </p>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.05"
                                    value={selectedTask.iconImageScale || 0.9}
                                    onChange={(e) => updateTask({ iconImageScale: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />

                                {/* Bulk Apply to Marked Tasks */}
                                {markedTaskIds.size > 0 && (
                                    <div className="pt-2 border-t border-slate-700 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <p className="text-[8px] text-orange-400 font-bold uppercase tracking-wider">
                                                    {markedTaskIds.size} {markedTaskIds.size === 1 ? 'task' : 'tasks'} marked
                                                </p>
                                                <p className="text-[7px] text-slate-500 mt-0.5">
                                                    Apply current image size to all selected
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const currentScale = selectedTask.iconImageScale || 0.9;
                                                    const updatedPoints = game.points.map(p =>
                                                        markedTaskIds.has(p.id) ? { ...p, iconImageScale: currentScale } : p
                                                    );
                                                    onUpdateGame({ ...game, points: updatedPoints });
                                                    alert(`Applied ${Math.round(currentScale * 100)}% image size to ${markedTaskIds.size} task(s)`);
                                                }}
                                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 shadow-lg"
                                                title={`Apply ${Math.round((selectedTask.iconImageScale || 0.9) * 100)}% to ${markedTaskIds.size} selected task(s)`}
                                            >
                                                <Check className="w-3 h-3" />
                                                APPLY
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Icon Editor - Dual State */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
                                {/* INCORRECT ANSWER ICON Section */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-red-400 uppercase tracking-widest">❌ INCORRECT ANSWER</label>

                                    {/* Current Icon Preview */}
                                    {selectedTask.iconUrl && (
                                        <div className="p-3 bg-slate-700 rounded-lg flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <img src={selectedTask.iconUrl} alt="Incorrect Answer Icon" className="w-8 h-8 object-contain" />
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">CUSTOM ICON</span>
                                            </div>
                                            <button
                                                onClick={() => updateTask({ iconUrl: undefined, iconId: 'default' })}
                                                className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Icon Buttons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingCompletedIcon(false);
                                                taskIconInputRef.current?.click();
                                            }}
                                            className="py-2 px-3 border border-dashed border-slate-600 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white hover:border-slate-400 transition-colors flex items-center justify-center gap-1"
                                            title="Upload custom icon for incorrect answer"
                                        >
                                            <Upload className="w-3 h-3" /> UPLOAD
                                        </button>
                                        <input ref={taskIconInputRef} type="file" className="hidden" accept="image/*" onChange={handleTaskIconUpload} />

                                        <button
                                            onClick={() => {
                                                setEditingCompletedIcon(false);
                                                setLogoCompanyName('');
                                                setShowLogoPrompt(true);
                                            }}
                                            disabled={isSearchingLogo && !editingCompletedIcon}
                                            className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                                                isSearchingLogo && !editingCompletedIcon
                                                    ? 'bg-blue-600/50 text-blue-300 cursor-wait'
                                                    : 'border border-dashed border-blue-600 text-blue-400 hover:text-blue-300 hover:border-blue-400'
                                            }`}
                                            title="Search for company logo online"
                                            type="button"
                                        >
                                            {isSearchingLogo && !editingCompletedIcon ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-[9px]">SEARCHING...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Globe className="w-3 h-3" /> LOGO
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => {
                                                setEditingCompletedIcon(false);
                                                setAiIconPromptValue('');
                                                setShowAiIconPrompt(true);
                                            }}
                                            disabled={isGeneratingIcon && !editingCompletedIcon}
                                            className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                                                isGeneratingIcon && !editingCompletedIcon
                                                    ? 'bg-purple-600/50 text-purple-300 cursor-wait'
                                                    : 'border border-dashed border-purple-600 text-purple-400 hover:text-purple-300 hover:border-purple-400'
                                            }`}
                                            title="Generate icon with AI for incorrect answer"
                                            type="button"
                                        >
                                            {isGeneratingIcon && !editingCompletedIcon ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-[9px]">GENERATING...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Wand2 className="w-3 h-3" /> AI ICON
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>

                                {/* CORRECT ANSWER ICON Section */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-green-400 uppercase tracking-widest">✅ CORRECT ANSWER</label>

                                    {/* Current Completed Icon Preview */}
                                    {selectedTask.completedIconUrl && (
                                        <div className="p-3 bg-slate-700 rounded-lg flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <img src={selectedTask.completedIconUrl} alt="Correct Answer Icon" className="w-8 h-8 object-contain" />
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">CUSTOM ICON</span>
                                            </div>
                                            <button
                                                onClick={() => updateTask({ completedIconUrl: undefined, completedIconId: 'default' })}
                                                className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Icon Buttons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingCompletedIcon(true);
                                                completedTaskIconInputRef.current?.click();
                                            }}
                                            className="py-2 px-3 border border-dashed border-slate-600 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white hover:border-slate-400 transition-colors flex items-center justify-center gap-1"
                                            title="Upload custom icon for correct answer"
                                        >
                                            <Upload className="w-3 h-3" /> UPLOAD
                                        </button>
                                        <input ref={completedTaskIconInputRef} type="file" className="hidden" accept="image/*" onChange={handleCompletedTaskIconUpload} />

                                        <button
                                            onClick={() => {
                                                setEditingCompletedIcon(true);
                                                setLogoCompanyName('');
                                                setShowLogoPrompt(true);
                                            }}
                                            disabled={isSearchingLogo && editingCompletedIcon}
                                            className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                                                isSearchingLogo && editingCompletedIcon
                                                    ? 'bg-blue-600/50 text-blue-300 cursor-wait'
                                                    : 'border border-dashed border-blue-600 text-blue-400 hover:text-blue-300 hover:border-blue-400'
                                            }`}
                                            title="Search for company logo online"
                                            type="button"
                                        >
                                            {isSearchingLogo && editingCompletedIcon ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-[9px]">SEARCHING...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Globe className="w-3 h-3" /> LOGO
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => {
                                                setEditingCompletedIcon(true);
                                                setAiIconPromptValue('');
                                                setShowAiIconPrompt(true);
                                            }}
                                            disabled={isGeneratingIcon && editingCompletedIcon}
                                            className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                                                isGeneratingIcon && editingCompletedIcon
                                                    ? 'bg-purple-600/50 text-purple-300 cursor-wait'
                                                    : 'border border-dashed border-purple-600 text-purple-400 hover:text-purple-300 hover:border-purple-400'
                                            }`}
                                            title="Generate icon with AI for correct answer"
                                            type="button"
                                        >
                                            {isGeneratingIcon && editingCompletedIcon ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-[9px]">GENERATING...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Wand2 className="w-3 h-3" /> AI ICON
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Copy Task Button */}
                            <button
                                onClick={() => {
                                    const now = Date.now();
                                    const nextOrder = Math.max(0, ...game.points.map(p => (typeof p.order === 'number' ? p.order : 0))) + 1;

                                    const originalPos = getDevicePosition(selectedTask);
                                    const copiedPos = {
                                        x: Math.min(98, Math.round((originalPos.x + 2) * 10) / 10),
                                        y: Math.min(98, Math.round((originalPos.y + 2) * 10) / 10)
                                    };

                                    // Create a copy of the selected task with a new ID
                                    const newTask: GamePoint = {
                                        ...selectedTask,
                                        id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
                                        title: `Copy of ${selectedTask.title}`,
                                        order: nextOrder,
                                        isCompleted: false,
                                        isUnlocked: true,
                                        devicePositions: {
                                            [selectedDevice]: copiedPos
                                        }
                                    };

                                    onUpdateGame({
                                        ...game,
                                        points: [...game.points, newTask]
                                    });

                                    // Save to library - create a template from the copied task
                                    (async () => {
                                        const taskTemplate: TaskTemplate = {
                                            id: `template-${Date.now()}`,
                                            title: newTask.title,
                                            task: newTask.task,
                                            feedback: newTask.feedback,
                                            points: newTask.points,
                                            tags: newTask.tags,
                                            iconId: newTask.iconId,
                                            iconUrl: newTask.iconUrl,
                                            settings: newTask.settings,
                                            logic: newTask.logic
                                        };
                                        const { ok } = await db.saveTemplates([taskTemplate]);
                                        if (!ok) {
                                            console.error('[PlaygroundEditor] Failed to save copied task to library');
                                        } else {
                                            console.log('[PlaygroundEditor] Copied task saved to library');
                                        }
                                    })();

                                    setSelectedTaskId(newTask.id);
                                }}
                                className="w-full py-3 bg-green-600/20 hover:bg-green-600/40 text-green-400 hover:text-green-300 border border-green-600/40 hover:border-green-500 rounded-lg font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all"
                                title="Create a copy of this task in the current game"
                                type="button"
                            >
                                <Copy className="w-4 h-4" /> COPY TASK
                            </button>

                            {/* Delete Task Button */}
                            <button
                                onClick={() => {
                                    if (window.confirm(`Delete task "${selectedTask.title}"?`)) {
                                        onUpdateGame({
                                            ...game,
                                            points: game.points.filter(p => p.id !== selectedTask.id)
                                        });
                                        setSelectedTaskId(null);
                                    }
                                }}
                                className="w-full py-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 border border-red-600/40 hover:border-red-500 rounded-lg font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all"
                            >
                                <Trash2 className="w-4 h-4" /> DELETE TASK
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Four Task Creation Buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                {/* Add from Library Button */}
                                <button
                                    onClick={() => {
                                        setTaskMasterTab('LIBRARY');
                                        setShowTaskMaster(true);
                                    }}
                                    className="py-4 px-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 border border-blue-600/40 hover:border-blue-500 rounded-lg font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all group flex-col"
                                    title="Add tasks from your library"
                                >
                                    <Library className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>LIBRARY</span>
                                </button>

                                {/* Add AI Task Button */}
                                <button
                                    onClick={() => setShowAiTaskGenerator(true)}
                                    className="py-4 px-3 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300 border border-purple-600/40 hover:border-purple-500 rounded-lg font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all group flex-col"
                                    title="Generate tasks using the advanced AI generator"
                                >
                                    <Wand2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>AI TASK</span>
                                </button>

                                {/* Add Tasklist Button */}
                                <button
                                    onClick={() => {
                                        setTaskMasterTab('LISTS');
                                        setShowTaskMaster(true);
                                    }}
                                    className="py-4 px-3 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-300 border border-indigo-600/40 hover:border-indigo-500 rounded-lg font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all group flex-col"
                                    title="Add a tasklist with multiple items"
                                >
                                    <LayoutGrid className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>TASKLIST</span>
                                </button>

                                {/* Add New Task Button */}
                                <button
                                    onClick={() => onAddTask('MANUAL', activePlayground.id)}
                                    disabled={isInstructorView}
                                    className="py-4 px-3 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 hover:text-yellow-300 border border-yellow-600/40 hover:border-yellow-500 rounded-lg font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all group flex-col"
                                    title="Create a new task"
                                >
                                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>NEW TASK</span>
                                </button>
                            </div>

                            {/* Export to Library Button - HIDDEN: All tasks auto-sync now */}
                            {/* {onExportGameToLibrary && (
                                <button
                                    onClick={onExportGameToLibrary}
                                    className="w-full py-3 bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 hover:text-orange-300 border border-orange-600/40 hover:border-orange-500 rounded-lg font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all"
                                    title="Export all tasks to Global Library and sync to Supabase"
                                >
                                    <Download className="w-4 h-4" /> EXPORT TO LIBRARY
                                </button>
                            )} */}

                            {/* Divider */}
                            <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-4"></div>

                            {/* Bulk Icon Mode Controls */}
                            {!selectedTask && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                    {bulkIconMode ? (
                                        <>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1">
                                                    <ImageIcon className="w-3 h-3" /> BULK ICON
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setBulkIconMode(false);
                                                        setBulkIconSourceId(null);
                                                        setBulkIconTargets(new Set());
                                                    }}
                                                    className="text-slate-500 hover:text-white text-[9px] font-bold uppercase"
                                                >
                                                    CANCEL
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {!bulkIconSourceId && (
                                                    <div className="p-2 bg-blue-900/30 rounded border border-blue-500/50 text-[9px] text-blue-300 font-bold uppercase">
                                                        ① Click a task to select as source
                                                    </div>
                                                )}
                                                {bulkIconSourceId && bulkIconTargets.size === 0 && (
                                                    <div className="p-2 bg-orange-900/30 rounded border border-orange-500/50 text-[9px] text-orange-300 font-bold uppercase">
                                                        ② Select target task(s) below
                                                    </div>
                                                )}
                                                {bulkIconSourceId && bulkIconTargets.size > 0 && (
                                                    <div className="p-2 bg-orange-900/30 rounded border border-orange-500/30 text-[9px] text-orange-300 font-bold uppercase">
                                                        {bulkIconTargets.size} target(s) selected
                                                    </div>
                                                )}
                                                {bulkIconTargets.size > 0 && (
                                                    <button
                                                        onClick={applyBulkIcon}
                                                        className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-[10px] font-bold uppercase rounded transition-colors shadow-lg"
                                                    >
                                                        ✓ APPLY ICON TO {bulkIconTargets.size}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setBulkIconMode(false);
                                                        setBulkIconSourceId(null);
                                                        setBulkIconTargets(new Set());
                                                    }}
                                                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[9px] font-bold uppercase rounded transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setBulkIconMode(true)}
                                            className="w-full py-2 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-slate-300 hover:text-white text-[10px] font-bold uppercase rounded transition-colors flex items-center justify-center gap-2"
                                        >
                                            <ImageIcon className="w-3 h-3" /> COPY ICON TO MULTIPLE
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Task Sort Control */}
                            <div className="mb-3 flex items-center gap-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sort By:</label>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setTaskSortMode('order')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                                            taskSortMode === 'order'
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        Task Order
                                    </button>
                                    <button
                                        onClick={() => setTaskSortMode('actions')}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                                            taskSortMode === 'actions'
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        Actions
                                    </button>
                                </div>
                            </div>

                            {/* Tasks List */}
                            <div className="space-y-3">
                                {uniquePlaygroundPoints.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">No tasks in zone yet</p>
                                        <p className="text-[9px] text-slate-600 mt-2">Use the buttons above to add your first task</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {(() => {
                                            // Helper function to get original task index
                                            const getOriginalTaskIndex = (taskId: string): number => {
                                                return uniquePlaygroundPoints.findIndex(p => p.id === taskId);
                                            };

                                            // Helper function to render a single task item
                                            const renderTaskItem = (
                                                point: GamePoint,
                                                renderContext: {
                                                    isNested?: boolean;
                                                    sourceTask?: GamePoint;
                                                    actionType?: 'onOpen' | 'onCorrect' | 'onIncorrect';
                                                } = {}
                                            ) => {
                                                const { isNested = false, sourceTask, actionType } = renderContext;
                                                const originalIndex = getOriginalTaskIndex(point.id);
                                                const taskNumber = String(originalIndex + 1).padStart(2, '0');

                                                // Calculate action info
                                                const hasSourceOnOpen = point.logic?.onOpen?.length > 0;
                                                const hasSourceOnCorrect = point.logic?.onCorrect?.length > 0;
                                                const hasSourceOnIncorrect = point.logic?.onIncorrect?.length > 0;

                                                const hasTargetOnOpen = uniquePlaygroundPoints.some(p =>
                                                    p.id !== point.id && p.logic?.onOpen?.some((a: any) => (a.targetId || a) === point.id)
                                                );
                                                const hasTargetOnCorrect = uniquePlaygroundPoints.some(p =>
                                                    p.id !== point.id && p.logic?.onCorrect?.some((a: any) => (a.targetId || a) === point.id)
                                                );
                                                const hasTargetOnIncorrect = uniquePlaygroundPoints.some(p =>
                                                    p.id !== point.id && p.logic?.onIncorrect?.some((a: any) => (a.targetId || a) === point.id)
                                                );

                                                const isMarked = markedTaskIds.has(point.id);
                                                const isHovered = hoveredTaskId === point.id;
                                                const hasActions = hasSourceOnOpen || hasSourceOnCorrect || hasSourceOnIncorrect;
                                                const isSourceTask = taskSortMode === 'actions' && hasActions && !isNested;

                                                const uniqueKey = isNested
                                                    ? `${point.id}-nested-${sourceTask?.id}-${actionType}`
                                                    : point.id;

                                                return (
                                                    <div
                                                        key={uniqueKey}
                                                        className={`px-3 py-2 border rounded transition-colors group flex items-center gap-2 ${
                                                            isNested ? 'ml-6 border-l-2 border-l-orange-500' : ''
                                                        } ${
                                                            bulkIconMode
                                                                ? bulkIconSourceId === point.id
                                                                    ? 'bg-blue-500/20 border-blue-500 cursor-pointer'
                                                                    : 'bg-slate-800/50 border-slate-700 cursor-pointer'
                                                                : (isHovered
                                                                    ? 'bg-orange-500/20 border-orange-500'
                                                                    : isMarked
                                                                    ? 'bg-orange-500/20 border-orange-500'
                                                                    : 'bg-slate-800/50 border-slate-700 hover:border-orange-500 hover:bg-slate-800')
                                                        }`}
                                                        onMouseEnter={() => setHoveredTaskId(point.id)}
                                                        onMouseLeave={() => setHoveredTaskId(null)}
                                                        onClick={() => {
                                                            if (bulkIconMode) {
                                                                if (bulkIconSourceId === null) {
                                                                    setBulkIconSourceId(point.id);
                                                                } else if (bulkIconSourceId === point.id) {
                                                                    setBulkIconSourceId(null);
                                                                } else {
                                                                    toggleBulkIconTarget(point.id);
                                                                }
                                                            } else {
                                                                setSelectedTaskId(point.id);
                                                            }
                                                        }}
                                                    >
                                                        {/* Checkbox for bulk/mark mode */}
                                                        {bulkIconMode ? (
                                                            <>
                                                                {bulkIconSourceId === null ? (
                                                                    <div className="w-6 h-6 bg-blue-900/50 border-2 border-blue-400 rounded flex items-center justify-center flex-shrink-0 text-[8px] font-bold text-blue-300 cursor-pointer hover:bg-blue-800/50">
                                                                        📌
                                                                    </div>
                                                                ) : bulkIconSourceId === point.id ? (
                                                                    <div className="w-6 h-6 bg-blue-600 border-2 border-blue-400 rounded flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/50">
                                                                        {point.iconUrl ? (
                                                                            <img src={point.iconUrl} alt="" className="w-4 h-4 object-contain" />
                                                                        ) : (
                                                                            (() => {
                                                                                const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                                                                                return <Icon className="w-4 h-4 text-white" />;
                                                                            })()
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={bulkIconTargets.has(point.id)}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleBulkIconTarget(point.id);
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="w-4 h-4 rounded border-2 border-orange-500 bg-slate-900 cursor-pointer accent-orange-500 flex-shrink-0"
                                                                        title="Click checkbox or task to select target"
                                                                    />
                                                                )}
                                                            </>
                                                        ) : isMarkMode && (
                                                            <input
                                                                type="checkbox"
                                                                checked={isMarked}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleMarkTask(point.id);
                                                                }}
                                                                className="w-4 h-4 rounded border-2 border-orange-400 bg-slate-900 cursor-pointer accent-orange-500 flex-shrink-0"
                                                                title="Mark for snapping"
                                                            />
                                                        )}

                                                        {/* Icon */}
                                                        <div className="w-5 h-5 bg-slate-700 rounded flex items-center justify-center flex-shrink-0 border border-slate-600">
                                                            {point.iconUrl ? (
                                                                <img src={point.iconUrl} alt="" className="w-3 h-3 object-contain" />
                                                            ) : (
                                                                (() => {
                                                                    const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                                                                    return <Icon className="w-3 h-3 text-slate-400" />;
                                                                })()
                                                            )}
                                                        </div>

                                                        {/* Task number and title on one line */}
                                                        <div className="flex-1 min-w-0">
                                                            {editingTitleId === point.id ? (
                                                                <input
                                                                    type="text"
                                                                    value={editingTitleValue}
                                                                    onChange={(e) => setEditingTitleValue(e.target.value)}
                                                                    onBlur={() => {
                                                                        if (editingTitleValue.trim()) {
                                                                            updatePointDirectly(point.id, { title: editingTitleValue });
                                                                        }
                                                                        setEditingTitleId(null);
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            if (editingTitleValue.trim()) {
                                                                                updatePointDirectly(point.id, { title: editingTitleValue });
                                                                            }
                                                                            setEditingTitleId(null);
                                                                        } else if (e.key === 'Escape') {
                                                                            setEditingTitleId(null);
                                                                        }
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="w-full bg-slate-700 border border-orange-500 rounded px-1.5 py-0.5 text-[11px] font-bold text-white outline-none focus:border-orange-400"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase flex-shrink-0">TASK {taskNumber}</p>
                                                                    <p
                                                                        className="text-[11px] font-bold text-white truncate group-hover:text-orange-300 transition-colors cursor-text flex-1"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingTitleId(point.id);
                                                                            setEditingTitleValue(point.title);
                                                                        }}
                                                                        title="Click to edit task title"
                                                                    >
                                                                        {point.title}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Score */}
                                                        {showTaskScores && (
                                                            <p className="text-[10px] font-bold text-orange-400 uppercase flex-shrink-0">
                                                                ${point.points}
                                                            </p>
                                                        )}

                                                        {/* Action indicators - tri-color system */}
                                                        {showTaskActions && (
                                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                {/* SOURCE indicators (this task triggers actions) */}
                                                                {hasSourceOnOpen && (
                                                                    <div
                                                                        className={`w-2 h-2 rounded-full bg-yellow-400 border-2 border-yellow-600 ${isSourceTask ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-800' : ''}`}
                                                                        title="SOURCE: When Opened action"
                                                                    />
                                                                )}
                                                                {hasSourceOnCorrect && (
                                                                    <div
                                                                        className={`w-2 h-2 rounded-full bg-green-400 border-2 border-green-600 ${isSourceTask ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-slate-800' : ''}`}
                                                                        title="SOURCE: If Correct action"
                                                                    />
                                                                )}
                                                                {hasSourceOnIncorrect && (
                                                                    <div
                                                                        className={`w-2 h-2 rounded-full bg-red-400 border-2 border-red-600 ${isSourceTask ? 'ring-2 ring-red-400 ring-offset-1 ring-offset-slate-800' : ''}`}
                                                                        title="SOURCE: If Incorrect action"
                                                                    />
                                                                )}

                                                                {/* Divider if both source and target */}
                                                                {(hasSourceOnOpen || hasSourceOnCorrect || hasSourceOnIncorrect) &&
                                                                 (hasTargetOnOpen || hasTargetOnCorrect || hasTargetOnIncorrect) && (
                                                                    <div className="w-px h-3 bg-slate-600" />
                                                                )}

                                                                {/* TARGET indicators (other tasks point to this task) */}
                                                                {hasTargetOnOpen && (
                                                                    <div
                                                                        className="w-2 h-2 rounded-full bg-yellow-400/40 border border-yellow-500"
                                                                        title="TARGET: Unlocked by 'When Opened' action"
                                                                    />
                                                                )}
                                                                {hasTargetOnCorrect && (
                                                                    <div
                                                                        className="w-2 h-2 rounded-full bg-green-400/40 border border-green-500"
                                                                        title="TARGET: Unlocked by 'If Correct' action"
                                                                    />
                                                                )}
                                                                {hasTargetOnIncorrect && (
                                                                    <div
                                                                        className="w-2 h-2 rounded-full bg-red-400/40 border border-red-500"
                                                                        title="TARGET: Unlocked by 'If Incorrect' action"
                                                                    />
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Edit button */}
                                                        <Edit2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                                                    </div>
                                                );
                                            };

                                            if (taskSortMode === 'order') {
                                                // Simple list in original order
                                                return uniquePlaygroundPoints.map((point) => renderTaskItem(point));
                                            } else {
                                                // Hierarchical action-based view
                                                const renderedItems: JSX.Element[] = [];

                                                // First, render SOURCE tasks with their targets
                                                const sourceTasks = uniquePlaygroundPoints.filter(p =>
                                                    p.logic?.onOpen?.length > 0 ||
                                                    p.logic?.onCorrect?.length > 0 ||
                                                    p.logic?.onIncorrect?.length > 0
                                                );

                                                if (sourceTasks.length > 0) {
                                                    renderedItems.push(
                                                        <div key="header-source" className="flex items-center gap-2 py-2 px-2 mt-3 mb-1">
                                                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                                                ⚡ SOURCE Tasks
                                                            </span>
                                                            <div className="flex-1 h-px bg-gradient-to-r from-slate-600 via-transparent to-transparent" />
                                                        </div>
                                                    );

                                                    sourceTasks.forEach(sourceTask => {
                                                        const isCollapsed = collapsedSources.has(sourceTask.id);

                                                        // Render source task with collapse/expand button
                                                        renderedItems.push(
                                                            <div key={`source-${sourceTask.id}`} className="space-y-1">
                                                                <div className="flex items-start gap-1">
                                                                    {/* Collapse/Expand button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const newCollapsed = new Set(collapsedSources);
                                                                            if (isCollapsed) {
                                                                                newCollapsed.delete(sourceTask.id);
                                                                            } else {
                                                                                newCollapsed.add(sourceTask.id);
                                                                            }
                                                                            setCollapsedSources(newCollapsed);
                                                                        }}
                                                                        className="mt-2 p-1 rounded hover:bg-slate-700 transition-colors flex-shrink-0"
                                                                        title={isCollapsed ? 'Expand to show target tasks' : 'Collapse to hide target tasks'}
                                                                    >
                                                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
                                                                    </button>
                                                                    <div className="flex-1">
                                                                        {renderTaskItem(sourceTask)}
                                                                    </div>
                                                                </div>

                                                                {/* Render target tasks when expanded */}
                                                                {!isCollapsed && (
                                                                    <div className="space-y-1">
                                                                        {/* onOpen targets */}
                                                                        {sourceTask.logic?.onOpen?.map((action: any) => {
                                                                            const targetId = action.targetId || action;
                                                                            const targetTask = uniquePlaygroundPoints.find(p => p.id === targetId);
                                                                            if (!targetTask) return null;
                                                                            return renderTaskItem(targetTask, {
                                                                                isNested: true,
                                                                                sourceTask,
                                                                                actionType: 'onOpen'
                                                                            });
                                                                        })}

                                                                        {/* onCorrect targets */}
                                                                        {sourceTask.logic?.onCorrect?.map((action: any) => {
                                                                            const targetId = action.targetId || action;
                                                                            const targetTask = uniquePlaygroundPoints.find(p => p.id === targetId);
                                                                            if (!targetTask) return null;
                                                                            return renderTaskItem(targetTask, {
                                                                                isNested: true,
                                                                                sourceTask,
                                                                                actionType: 'onCorrect'
                                                                            });
                                                                        })}

                                                                        {/* onIncorrect targets */}
                                                                        {sourceTask.logic?.onIncorrect?.map((action: any) => {
                                                                            const targetId = action.targetId || action;
                                                                            const targetTask = uniquePlaygroundPoints.find(p => p.id === targetId);
                                                                            if (!targetTask) return null;
                                                                            return renderTaskItem(targetTask, {
                                                                                isNested: true,
                                                                                sourceTask,
                                                                                actionType: 'onIncorrect'
                                                                            });
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                }

                                                // TARGET TASKS section removed - all targets are now only visible under their source tasks

                                                // Finally, render tasks with no actions
                                                const noActionTasks = uniquePlaygroundPoints.filter(p => {
                                                    const isSource = p.logic?.onOpen?.length > 0 ||
                                                                   p.logic?.onCorrect?.length > 0 ||
                                                                   p.logic?.onIncorrect?.length > 0;
                                                    const isTarget = uniquePlaygroundPoints.some(other =>
                                                        other.id !== p.id && (
                                                            other.logic?.onOpen?.some((a: any) => (a.targetId || a) === p.id) ||
                                                            other.logic?.onCorrect?.some((a: any) => (a.targetId || a) === p.id) ||
                                                            other.logic?.onIncorrect?.some((a: any) => (a.targetId || a) === p.id)
                                                        )
                                                    );
                                                    return !isSource && !isTarget;
                                                });

                                                if (noActionTasks.length > 0) {
                                                    renderedItems.push(
                                                        <div key="header-noaction" className="flex items-center gap-2 py-2 px-2 mt-3 mb-1">
                                                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                                                📋 No Actions
                                                            </span>
                                                            <div className="flex-1 h-px bg-gradient-to-r from-slate-600 via-transparent to-transparent" />
                                                        </div>
                                                    );

                                                    noActionTasks.forEach(task => {
                                                        renderedItems.push(renderTaskItem(task));
                                                    });
                                                }

                                                return renderedItems;
                                            }
                                        })()}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-800 flex-shrink-0">
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest text-center">Zone: <span className="text-orange-400 font-bold">{activePlayground.title}</span></p>
                </div>
            </div>

            {/* AI Icon Prompt Modal */}
            {showAiIconPrompt && (
                <div className="fixed inset-0 z-[6500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-purple-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-white">
                                    GENERATE {selectedTask ? 'TASK' : 'ZONE'} ICON
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowAiIconPrompt(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                type="button"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Describe the icon you want (e.g. “red flag”, “gold star”, “camera”).</p>
                            <input
                                value={aiIconPromptValue}
                                onChange={(e) => setAiIconPromptValue(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-white outline-none focus:border-purple-500"
                                placeholder="TYPE KEYWORDS..."
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowAiIconPrompt(false)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
                                    type="button"
                                >
                                    CANCEL
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowAiIconPrompt(false);
                                        await handleGenerateTaskIcon(aiIconPromptValue);
                                    }}
                                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
                                    type="button"
                                >
                                    GENERATE
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Logo Search Prompt Modal */}
            {showLogoPrompt && (
                <div className="fixed inset-0 z-[6500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-white">COMPANY LOGO SEARCH</h3>
                            </div>
                            <button
                                onClick={() => setShowLogoPrompt(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                type="button"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Enter the company name to search for its logo online (e.g. "Nike", "Coca-Cola", "Apple")
                            </p>
                            <input
                                value={logoCompanyName}
                                onChange={(e) => setLogoCompanyName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isSearchingLogo && logoCompanyName.trim()) {
                                        handleSearchCompanyLogo(logoCompanyName);
                                    }
                                }}
                                disabled={isSearchingLogo}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 disabled:opacity-50"
                                placeholder="COMPANY NAME..."
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowLogoPrompt(false)}
                                    disabled={isSearchingLogo}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
                                    type="button"
                                >
                                    CANCEL
                                </button>
                                <button
                                    onClick={() => handleSearchCompanyLogo(logoCompanyName)}
                                    disabled={!logoCompanyName.trim() || isSearchingLogo}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2"
                                    type="button"
                                >
                                    {isSearchingLogo ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            SEARCHING...
                                        </>
                                    ) : (
                                        <>
                                            <Globe className="w-3 h-3" />
                                            SEARCH LOGO
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="pt-3 border-t border-slate-700">
                                <p className="text-[8px] text-slate-500 uppercase tracking-wide">
                                    ℹ️ This will search online databases (Clearbit, Google) for the company's official logo
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Background Prompt Modal */}
            {showAiBackgroundPrompt && (
                <div className="fixed inset-0 z-[6500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-purple-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-white">AI BACKGROUND GENERATOR</h3>
                            </div>
                            <button
                                onClick={() => setShowAiBackgroundPrompt(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                type="button"
                                title="Close"
                                disabled={isGeneratingBackground}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Describe the background you want. Examples: "forest at sunset", "futuristic city", "underwater temple", "medieval castle"
                                </p>
                                <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-2">
                                    <p className="text-[9px] text-blue-200 uppercase font-bold flex items-center gap-1">
                                        <Wand2 className="w-3 h-3" /> Powered by Gemini 2.5 Flash
                                    </p>
                                    <p className="text-[8px] text-blue-300/80 mt-1">Uses Gemini's built-in image generation. Note: Imagen 3 (higher quality) requires Vertex AI and is not available with API keys.</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase text-slate-500 mb-1 block">Zone: <span className="text-orange-400">{activePlayground?.title || 'Unknown'}</span></label>
                                <textarea
                                    value={aiBackgroundPromptValue}
                                    onChange={(e) => setAiBackgroundPromptValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.ctrlKey && !isGeneratingBackground) {
                                            handleGenerateAiBackground(aiBackgroundPromptValue);
                                        }
                                    }}
                                    disabled={isGeneratingBackground}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-white outline-none focus:border-purple-500 disabled:opacity-50 resize-none"
                                    placeholder="ENTER KEYWORDS..."
                                    rows={4}
                                    autoFocus
                                />
                                <p className="text-[8px] text-slate-500 mt-1 uppercase">Tip: Press Ctrl+Enter to generate</p>
                            </div>
                            <button
                                onClick={() => handleGenerateAiBackground(aiBackgroundPromptValue)}
                                disabled={!aiBackgroundPromptValue.trim() || isGeneratingBackground}
                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
                                type="button"
                            >
                                {isGeneratingBackground ? 'GENERATING...' : 'GENERATE'}
                            </button>
                            {activePlayground?.imageUrl && (
                                <div className="pt-3 border-t border-slate-700 text-[9px] text-slate-400">
                                    <p className="font-bold mb-1">Current Background:</p>
                                    <img src={activePlayground.imageUrl} alt="Current background" className="w-full h-auto rounded-lg max-h-24 object-cover" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Task Action Modal */}
            {showActionModal && selectedTask && (
                <TaskActionModal
                    point={selectedTask}
                    allPoints={uniquePlaygroundPoints}
                    playgrounds={uniquePlaygrounds}
                    onClose={() => setShowActionModal(false)}
                    onSave={(updatedPoint) => {
                        onUpdateGame({
                            ...game,
                            points: game.points.map(p => p.id === updatedPoint.id ? updatedPoint : p)
                        });
                        setShowActionModal(false);
                    }}
                    onStartDrawMode={(trigger) => {
                        // Enter draw mode: highlight source, allow clicking targets
                        setDrawMode({
                            active: true,
                            trigger,
                            sourceTaskId: selectedTask.id,
                            mousePosition: null
                        });
                        setShowActionModal(false);
                        // Show toast/instruction
                        console.log(`Draw mode activated for ${trigger}. Click tasks to connect.`);
                    }}
                />
            )}

            {/* Task Settings Modal */}
            {showTaskSettingsModal && settingsModalTaskId && selectedTask?.id === settingsModalTaskId && selectedTask && (
                <TaskEditor
                    point={selectedTask}
                    requestedTab="SETTINGS"
                    gameMode="playzone"
                    onSave={(updatedPoint) => {
                        onUpdateGame({
                            ...game,
                            points: game.points.map(p => p.id === updatedPoint.id ? updatedPoint : p)
                        });
                        // Save to global library
                        saveTaskToLibrary(updatedPoint);
                        setShowTaskSettingsModal(false);
                        setSettingsModalTaskId(null);
                    }}
                    onDelete={(pointId) => {
                        onUpdateGame({
                            ...game,
                            points: game.points.filter(p => p.id !== pointId)
                        });
                        setShowTaskSettingsModal(false);
                        setSettingsModalTaskId(null);
                    }}
                    onClose={() => {
                        setShowTaskSettingsModal(false);
                        setSettingsModalTaskId(null);
                    }}
                />
            )}

            {/* Task View Modal - Preview Task */}
            {showTaskViewModal && selectedTask && (
                <div className="fixed inset-0 z-[6500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-blue-600/50 w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-blue-600 to-blue-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                                    <Eye className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-widest">TASK PREVIEW</h2>
                                    <p className="text-xs text-blue-100 font-bold uppercase tracking-wider mt-0.5">{selectedTask.title}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTaskViewModal(false)}
                                className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Task Type Badge */}
                            <div className="flex items-center gap-3">
                                <span className="px-4 py-2 bg-blue-600/20 border border-blue-600/40 text-blue-300 rounded-lg font-black uppercase text-xs tracking-widest">
                                    {selectedTask.task.type === 'text' && '✍️ TEXT ANSWER'}
                                    {selectedTask.task.type === 'multiple_choice' && '☑️ MULTIPLE CHOICE'}
                                    {selectedTask.task.type === 'boolean' && '✓/✗ TRUE/FALSE'}
                                    {selectedTask.task.type === 'slider' && '🎚️ SLIDER'}
                                    {selectedTask.task.type === 'checkbox' && '☑️ CHECKBOXES'}
                                    {selectedTask.task.type === 'dropdown' && '📋 DROPDOWN'}
                                </span>
                                <span className="px-3 py-1.5 bg-orange-600/20 border border-orange-600/40 text-orange-300 rounded-lg font-bold text-xs">
                                    {selectedTask.points || 100} POINTS
                                </span>
                            </div>

                            {/* Question */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">QUESTION</label>
                                <div
                                    className="text-base font-bold text-white leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: selectedTask.task.question || 'No question set' }}
                                />
                            </div>

                            {/* Task Image */}
                            {selectedTask.task.imageUrl && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">TASK IMAGE</label>
                                    <img
                                        src={selectedTask.task.imageUrl}
                                        alt="Task illustration"
                                        className="w-full rounded-lg max-h-64 object-cover"
                                    />
                                </div>
                            )}

                            {/* Answer Options & Correct Answers */}
                            {(selectedTask.task.type === 'multiple_choice' || selectedTask.task.type === 'checkbox' || selectedTask.task.type === 'dropdown') && selectedTask.task.options && selectedTask.task.options.length > 0 && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ANSWER OPTIONS</label>
                                    <div className="space-y-2">
                                        {selectedTask.task.options.map((option, idx) => {
                                            const isCorrect = selectedTask.task.correctAnswers?.includes(option);
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded-lg border-2 flex items-center gap-3 ${
                                                        isCorrect
                                                            ? 'bg-green-600/20 border-green-500 text-green-300'
                                                            : 'bg-slate-700/50 border-slate-600 text-slate-300'
                                                    }`}
                                                >
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                                        isCorrect ? 'bg-green-500 text-white' : 'bg-slate-600 text-slate-400'
                                                    }`}>
                                                        {isCorrect ? '✓' : String.fromCharCode(65 + idx)}
                                                    </div>
                                                    <span className="font-bold text-sm flex-1">{option}</span>
                                                    {isCorrect && (
                                                        <span className="px-2 py-1 bg-green-600 text-white rounded text-[8px] font-black uppercase tracking-wider">
                                                            CORRECT
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Text Answer */}
                            {selectedTask.task.type === 'text' && selectedTask.task.answer && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CORRECT ANSWER</label>
                                    <div className="p-3 bg-green-600/20 border-2 border-green-500 rounded-lg">
                                        <p className="text-green-300 font-bold">{selectedTask.task.answer}</p>
                                    </div>
                                </div>
                            )}

                            {/* Boolean Answer */}
                            {selectedTask.task.type === 'boolean' && selectedTask.task.answer !== undefined && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CORRECT ANSWER</label>
                                    <div className="p-3 bg-green-600/20 border-2 border-green-500 rounded-lg">
                                        <p className="text-green-300 font-black text-lg uppercase">
                                            {selectedTask.task.answer === 'true' || selectedTask.task.answer === true ? '✓ TRUE' : '✗ FALSE'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Slider Range */}
                            {selectedTask.task.type === 'slider' && selectedTask.task.range && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SLIDER SETTINGS</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-3 bg-slate-700 rounded-lg">
                                            <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Minimum</p>
                                            <p className="text-white font-black text-lg">{selectedTask.task.range.min}</p>
                                        </div>
                                        <div className="p-3 bg-green-600/20 border-2 border-green-500 rounded-lg">
                                            <p className="text-[9px] text-green-400 uppercase font-bold mb-1">Correct</p>
                                            <p className="text-green-300 font-black text-lg">{selectedTask.task.range.correctValue}</p>
                                        </div>
                                        <div className="p-3 bg-slate-700 rounded-lg">
                                            <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Maximum</p>
                                            <p className="text-white font-black text-lg">{selectedTask.task.range.max}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Hint */}
                            {selectedTask.feedback?.hint && (
                                <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-xl p-5 space-y-2">
                                    <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                                        💡 HINT
                                        {selectedTask.feedback.hintCost > 0 && (
                                            <span className="text-[8px] px-2 py-0.5 bg-yellow-600/30 rounded">
                                                -{selectedTask.feedback.hintCost} PTS
                                            </span>
                                        )}
                                    </label>
                                    <p className="text-yellow-200 font-medium text-sm">{selectedTask.feedback.hint}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-950 border-t border-slate-800">
                            <button
                                onClick={() => setShowTaskViewModal(false)}
                                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-colors"
                            >
                                CLOSE PREVIEW
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Playzone Selector Modal - For choosing which playzone to add tasks to */}
            {showPlayzoneSelector && (
                <div className="fixed inset-0 z-[9000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border-2 border-orange-500">
                        {/* Header */}
                        <div className="bg-orange-600 px-6 py-4">
                            <h2 className="text-lg font-black text-white uppercase tracking-widest">SELECT DESTINATION</h2>
                            <p className="text-[10px] text-orange-100 font-bold uppercase tracking-wider mt-1">{pendingTasksToAdd.length} task{pendingTasksToAdd.length !== 1 ? 's' : ''} ready to add</p>
                        </div>

                        {/* Content */}
                        <div className={`p-6 ${isAddingTaskList ? 'grid grid-cols-1' : 'grid grid-cols-1 md:grid-cols-2'} gap-6`}>
                          {/* MAP Section - Only show when not adding from playzone editor */}
                          {!isAddingTaskList && (
                          <div>
                            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-3 pb-2 border-b border-slate-700">MAP</h3>
                            <button
                              onClick={() => {
                                // Add the pending tasks to the MAP (no playgroundId)
                                const mapPoints = game.points?.filter(p => !p.playgroundId);
                                const baseOrder = mapPoints?.length || 0;

                                // Filter out duplicates (by title match)
                                const newTasksToAdd = pendingTasksToAdd.filter(t =>
                                  !game.points?.some(p => p.title === t.title)
                                );

                                if (newTasksToAdd.length === 0) {
                                  alert('All tasks already exist in this game. No duplicates were added.');
                                  return;
                                }

                                const newPoints: GamePoint[] = newTasksToAdd.map((t, i) => {
                                  const templateAny = t as any;
                                  const radiusMeters = typeof templateAny.radiusMeters === 'number' ? templateAny.radiusMeters : 30;
                                  const areaColor = typeof templateAny.areaColor === 'string' ? templateAny.areaColor : undefined;
                                  const openingAudioUrl = typeof templateAny.openingAudioUrl === 'string' ? templateAny.openingAudioUrl : undefined;

                                  return {
                                    id: `m-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
                                    title: t.title,
                                    shortIntro: (t as any).intro,
                                    task: t.task,
                                    location: { lat: 0, lng: 0 },
                                    radiusMeters,
                                    activationTypes: t.activationTypes || ['radius'], // Use task's activation types or default to radius for map
                                    manualUnlockCode: undefined,
                                    iconId: t.iconId || 'default',
                                    iconUrl: (t as any).iconUrl,
                                    areaColor,
                                    openingAudioUrl,
                                    points: t.points || 100,
                                    isUnlocked: true,
                                    isCompleted: false,
                                    order: baseOrder + i,
                                    tags: t.tags,
                                    feedback: t.feedback,
                                    settings: t.settings,
                                    logic: t.logic,
                                    completionLogic: (t as any).completionLogic
                                  } as GamePoint;
                                });

                                onUpdateGame({
                                  ...game,
                                  points: [...game.points, ...newPoints]
                                });

                                // Save templates to library and sync to Supabase
                                (async () => {
                                  const { ok } = await db.saveTemplates(newTasksToAdd);
                                  if (!ok) {
                                    console.error('[PlaygroundEditor] Failed to save tasks to library');
                                  } else {
                                    console.log('[PlaygroundEditor] Tasks saved to library:', newTasksToAdd.length);
                                  }
                                })();

                                // Reset state
                                setShowPlayzoneSelector(false);
                                setPendingTasksToAdd([]);
                                setIsAddingAITasks(false);
                                setIsAddingTaskList(false);
                                if (isAddingAITasks) {
                                  setShowAiTaskGenerator(false);
                                } else {
                                  setShowTaskMaster(false);
                                }
                              }}
                              className="w-full p-4 bg-blue-900/40 hover:bg-blue-800/60 border-2 border-blue-500/50 hover:border-blue-500 rounded-lg transition-colors text-left"
                            >
                              <div className="font-bold text-white uppercase tracking-widest text-sm">MAP TASKS</div>
                              <div className="text-[10px] text-slate-400 mt-1">
                                {game.points.filter(p => !p.playgroundId).length} tasks on map
                              </div>
                            </button>
                          </div>
                          )}

                          {/* PLAYZONES Section */}
                          <div>
                            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-3 pb-2 border-b border-slate-700">PLAYZONES</h3>
                            <div className="space-y-3">
                              {uniquePlaygrounds && uniquePlaygrounds.length > 0 ? (
                                uniquePlaygrounds.map((playzone) => (
                                  <button
                                    key={playzone.id}
                                    onClick={() => {
                                      // Add the pending tasks to the selected playzone
                                      // Filter out duplicates (by title match)
                                      const newTasksToAdd = pendingTasksToAdd.filter(t =>
                                        !game.points?.some(p => p.title === t.title)
                                      );

                                      if (newTasksToAdd.length === 0) {
                                        alert('All tasks already exist in this game. No duplicates were added.');
                                        return;
                                      }

                                      const baseOrder = uniquePlaygroundPoints.filter(p => p.playgroundId === playzone.id).length;
                                      const COLS = 3;
                                      const PADDING = 10;
                                      const ROW_HEIGHT = 18;

                                      const newPoints: GamePoint[] = newTasksToAdd.map((t, i) => {
                                        const row = Math.floor((baseOrder + i) / COLS);
                                        const col = (baseOrder + i) % COLS;
                                        const colWidth = (100 - PADDING * 2) / COLS;

                                        const x = PADDING + col * colWidth + colWidth / 2;
                                        const y = PADDING + row * ROW_HEIGHT + ROW_HEIGHT / 2;

                                        const templateAny = t as any;
                                        const radiusMeters = typeof templateAny.radiusMeters === 'number' ? templateAny.radiusMeters : 30;
                                        const areaColor = typeof templateAny.areaColor === 'string' ? templateAny.areaColor : undefined;
                                        const openingAudioUrl = typeof templateAny.openingAudioUrl === 'string' ? templateAny.openingAudioUrl : undefined;

                                        return {
                                          id: t.id || `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
                                          title: t.title,
                                          shortIntro: (t as any).intro,
                                          task: t.task,
                                          location: { lat: 0, lng: 0 },
                                          radiusMeters,
                                          activationTypes: t.activationTypes || ['click'],
                                          manualUnlockCode: undefined,
                                          playgroundId: playzone.id,
                                          devicePositions: {
                                              [selectedDevice]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
                                          },
                                          playgroundScale: 1,
                                          isHiddenBeforeScan: false,
                                          iconId: t.iconId || 'default',
                                          iconUrl: (t as any).iconUrl,
                                          areaColor,
                                          openingAudioUrl,
                                          points: t.points || 100,
                                          isUnlocked: true,
                                          isCompleted: false,
                                          order: baseOrder + i,
                                          tags: t.tags,
                                          feedback: t.feedback,
                                          settings: t.settings,
                                          logic: t.logic,
                                          completionLogic: (t as any).completionLogic
                                        } as GamePoint;
                                      });

                                      onUpdateGame({
                                        ...game,
                                        points: [...game.points, ...newPoints]
                                      });

                                      // Save templates to library and sync to Supabase
                                      (async () => {
                                        const { ok } = await db.saveTemplates(newTasksToAdd);
                                        if (!ok) {
                                          console.error('[PlaygroundEditor] Failed to save tasks to library');
                                        } else {
                                          console.log('[PlaygroundEditor] Tasks saved to library:', newTasksToAdd.length);
                                        }
                                      })();

                                      // Reset state
                                      setShowPlayzoneSelector(false);
                                      setPendingTasksToAdd([]);
                                      setIsAddingAITasks(false);
                                      setIsAddingTaskList(false);
                                      if (isAddingAITasks) {
                                        setShowAiTaskGenerator(false);
                                      } else {
                                        setShowTaskMaster(false);
                                      }
                                    }}
                                    className="w-full p-3 bg-orange-900/40 hover:bg-orange-800/60 border-2 border-orange-500/50 hover:border-orange-500 rounded-lg transition-colors text-left"
                                    type="button"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 bg-orange-500 rounded-md flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-3 h-3 text-white" />
                                      </div>
                                      <div className="font-bold text-white uppercase tracking-widest text-sm">{playzone.title || `Playzone ${game.playgrounds?.indexOf(playzone) + 1}`}</div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                      {uniquePlaygroundPoints.filter(p => p.playgroundId === playzone.id).length} tasks
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <p className="text-slate-400 text-xs italic">No playzones available</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-700 px-6 py-3 bg-slate-950 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowPlayzoneSelector(false);
                                    setPendingTasksToAdd([]);
                                    setIsAddingAITasks(false);
                                    setIsAddingTaskList(false);
                                }}
                                className="px-4 py-2 text-slate-300 hover:text-white font-bold uppercase text-xs transition-colors"
                            >
                                CANCEL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Advanced AI Task Generator (TaskMaster version) */}
            {showAiTaskGenerator && (
                <AiTaskGenerator
                    onClose={() => setShowAiTaskGenerator(false)}
                    playgrounds={uniquePlaygrounds || []}
                    initialPlaygroundId={activePlayground?.id || null}
                    targetMode="GAME"
                    onAddTasks={(tasks, targetPlaygroundId) => {
                        // If no specific playzone selected and targetPlaygroundId is undefined (MAP mode), add to map
                        // If targetPlaygroundId is null, show selector to choose MAP or PLAYZONE
                        if (targetPlaygroundId === null) {
                            setPendingTasksToAdd(tasks);
                            setIsAddingAITasks(true);
                            setShowPlayzoneSelector(true);
                            return;
                        }

                        if (!targetPlaygroundId && targetPlaygroundId !== undefined) {
                            // Edge case: undefined but falsy, shouldn't happen but safety check
                            setPendingTasksToAdd(tasks);
                            setIsAddingAITasks(true);
                            setShowPlayzoneSelector(true);
                            return;
                        }

                        // Otherwise, add directly to the specified or active playzone
                        const baseOrder = uniquePlaygroundPoints.length;
                        const COLS = 3;
                        const PADDING = 10;
                        const ROW_HEIGHT = 18;

                        const newPoints: GamePoint[] = tasks.map((t, i) => {
                            const row = Math.floor((baseOrder + i) / COLS);
                            const col = (baseOrder + i) % COLS;
                            const colWidth = (100 - PADDING * 2) / COLS;

                            const x = PADDING + col * colWidth + colWidth / 2;
                            const y = PADDING + row * ROW_HEIGHT + ROW_HEIGHT / 2;

                            const templateAny = t as any;
                            const radiusMeters = typeof templateAny.radiusMeters === 'number' ? templateAny.radiusMeters : 30;
                            const areaColor = typeof templateAny.areaColor === 'string' ? templateAny.areaColor : undefined;

                            return {
                                id: t.id || `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
                                title: t.title,
                                shortIntro: (t as any).intro,
                                task: t.task,
                                location: { lat: 0, lng: 0 },
                                radiusMeters,
                                activationTypes: ['radius'],
                                manualUnlockCode: undefined,
                                playgroundId: targetPlaygroundId || activePlayground?.id,
                                devicePositions: {
                                    [selectedDevice]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
                                },
                                playgroundScale: 1,
                                isHiddenBeforeScan: false,
                                iconId: t.iconId || 'default',
                                iconUrl: (t as any).iconUrl,
                                areaColor,
                                points: t.points || 100,
                                isUnlocked: true,
                                isCompleted: false,
                                order: baseOrder + i,
                                tags: t.tags,
                                feedback: t.feedback,
                                settings: t.settings,
                                logic: t.logic,
                                completionLogic: (t as any).completionLogic
                            } as GamePoint;
                        });

                        onUpdateGame({
                            ...game,
                            points: [...game.points, ...newPoints]
                        });

                        // Save templates to library and sync to Supabase
                        (async () => {
                            const { ok } = await db.saveTemplates(tasks);
                            if (!ok) {
                                console.error('[PlaygroundEditor] Failed to save tasks to library');
                            } else {
                                console.log('[PlaygroundEditor] Tasks saved to library:', tasks.length);
                            }
                        })();
                    }}
                    onAddToLibrary={async (tasks) => {
                        const { ok } = await db.saveTemplates(tasks);
                        if (!ok) console.error('[PlaygroundEditor] Failed to save templates to library');
                    }}
                />
            )}

            {/* TaskMaster Modal for LIBRARY and TASKLIST */}
            {showTaskMaster && (
                <TaskMaster
                    onClose={() => {
                        setShowTaskMaster(false);
                        setIsAddingTaskList(false);
                    }}
                    isPlayzoneEditor={true}
                    onImportTasks={(tasks) => {
                        setPendingTasksToAdd(tasks);
                        setIsAddingAITasks(false);
                        setIsAddingTaskList(false);
                        setShowPlayzoneSelector(true);
                    }}
                    onImportTaskList={(list, destination) => {
                        if (destination === '__PLAYZONE__') {
                            const targetPlaygroundId = activePlayground?.id;
                            if (!targetPlaygroundId) {
                                alert('No active playzone selected.');
                                return;
                            }

                            const newTasksToAdd = (list.tasks || []).filter(t =>
                                !game.points?.some(p => p.title === t.title)
                            );

                            if (newTasksToAdd.length === 0) {
                                alert('All tasks already exist in this game. No duplicates were added.');
                                return;
                            }

                            const baseOrder = uniquePlaygroundPoints.filter(p => p.playgroundId === targetPlaygroundId).length;
                            const COLS = 3;
                            const PADDING = 10;
                            const ROW_HEIGHT = 18;

                            const newPoints: GamePoint[] = newTasksToAdd.map((t, i) => {
                                const row = Math.floor((baseOrder + i) / COLS);
                                const col = (baseOrder + i) % COLS;
                                const colWidth = (100 - PADDING * 2) / COLS;

                                const x = PADDING + col * colWidth + colWidth / 2;
                                const y = PADDING + row * ROW_HEIGHT + ROW_HEIGHT / 2;

                                const templateAny = t as any;
                                const radiusMeters = typeof templateAny.radiusMeters === 'number' ? templateAny.radiusMeters : 30;
                                const areaColor = typeof templateAny.areaColor === 'string' ? templateAny.areaColor : undefined;
                                const openingAudioUrl = typeof templateAny.openingAudioUrl === 'string' ? templateAny.openingAudioUrl : undefined;

                                return {
                                    id: t.id || `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
                                    title: t.title,
                                    shortIntro: (t as any).intro,
                                    task: t.task,
                                    location: { lat: 0, lng: 0 },
                                    radiusMeters,
                                    activationTypes: t.activationTypes || ['click'],
                                    manualUnlockCode: undefined,
                                    playgroundId: targetPlaygroundId,
                                    devicePositions: {
                                        [selectedDevice]: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
                                    },
                                    playgroundScale: 1,
                                    isHiddenBeforeScan: false,
                                    iconId: t.iconId || 'default',
                                    iconUrl: (t as any).iconUrl,
                                    areaColor,
                                    openingAudioUrl,
                                    points: t.points || 100,
                                    isUnlocked: true,
                                    isCompleted: false,
                                    order: baseOrder + i,
                                    tags: t.tags,
                                    feedback: t.feedback,
                                    settings: t.settings,
                                    logic: t.logic,
                                    completionLogic: (t as any).completionLogic
                                } as GamePoint;
                            });

                            onUpdateGame({
                                ...game,
                                points: [...game.points, ...newPoints]
                            });

                            // Save templates to library and sync to Supabase
                            (async () => {
                                const { ok } = await db.saveTemplates(newTasksToAdd);
                                if (!ok) {
                                    console.error('[PlaygroundEditor] Failed to save tasks to library');
                                } else {
                                    console.log('[PlaygroundEditor] Tasks saved to library:', newTasksToAdd.length);
                                }
                            })();

                            setShowTaskMaster(false);
                            return;
                        }

                        // '__GAME__' (or default): open existing destination selector (MAP or PLAYZONES)
                        setPendingTasksToAdd(list.tasks || []);
                        setIsAddingAITasks(false);
                        setIsAddingTaskList(false);
                        setShowPlayzoneSelector(true);
                    }}
                    taskLists={taskLists}
                    onUpdateTaskLists={onUpdateTaskLists}
                    taskLibrary={taskLibrary}
                    onUpdateTaskLibrary={onUpdateTaskLibrary}
                    games={[game]}
                    initialTab={taskMasterTab}
                />
            )}


            {/* Gemini API Key Modal */}
            <GeminiApiKeyModal
                isOpen={showGeminiKeyModal}
                onClose={() => setShowGeminiKeyModal(false)}
                onSave={handleApiKeySaved}
            />

            {/* QR Scanner Color Picker Modal */}
            {showQRColorPicker && (
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
                                        saveQRScannerSettings();
                                        setShowQRColorPicker(false);
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

            {/* Title Text Editor Modal */}
            {showTitleTextEditor && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
                    <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border-2 border-blue-500">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Type className="w-5 h-5 text-white" />
                                <h3 className="text-lg font-black text-white uppercase tracking-widest">Title Text</h3>
                            </div>
                            <button
                                onClick={() => setShowTitleTextEditor(false)}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                title="Close"
                                type="button"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5">
                            {/* Text Input */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold uppercase">Title Text Content</label>
                                <input
                                    type="text"
                                    value={titleTextContent}
                                    onChange={(e) => setTitleTextContent(e.target.value)}
                                    placeholder="Enter title text..."
                                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 text-white rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                                />
                            </div>

                            {/* Font Size Slider */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold uppercase">Font Size: {titleTextFontSize}px</label>
                                <input
                                    type="range"
                                    min="12"
                                    max="64"
                                    value={titleTextFontSize}
                                    onChange={(e) => setTitleTextFontSize(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Color Picker */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold uppercase">Text Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={titleTextColor}
                                        onChange={(e) => setTitleTextColor(e.target.value)}
                                        className="w-12 h-12 bg-slate-800 border-2 border-slate-700 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                                    />
                                    <input
                                        type="text"
                                        value={titleTextColor}
                                        onChange={(e) => setTitleTextColor(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-slate-800 border-2 border-slate-700 text-white rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-sm font-mono"
                                    />
                                </div>
                            </div>

                            {/* Color Presets */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold uppercase">Quick Presets</label>
                                <div className="grid grid-cols-6 gap-2">
                                    {[
                                        { color: '#ffffff' },
                                        { color: '#f0f0f0' },
                                        { color: '#ff6b6b' },
                                        { color: '#4ecdc4' },
                                        { color: '#ffd93d' },
                                        { color: '#6bcf7f' }
                                    ].map((preset) => (
                                        <button
                                            key={preset.color}
                                            onClick={() => setTitleTextColor(preset.color)}
                                            className="w-10 h-10 rounded-lg border-2 border-slate-700 hover:border-blue-400 hover:scale-110 transition-all shadow-md"
                                            style={{ backgroundColor: preset.color }}
                                            type="button"
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Toggle Visibility */}
                            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                <span className="text-sm font-bold text-slate-300 uppercase">Show Title Text</span>
                                <button
                                    onClick={() => setShowTitleText(!showTitleText)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        showTitleText ? 'bg-blue-600' : 'bg-slate-600'
                                    }`}
                                    type="button"
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            showTitleText ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        saveTitleTextSettings();
                                        setShowTitleTextEditor(false);
                                    }}
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-black uppercase text-sm rounded-xl transition-all shadow-lg"
                                    type="button"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setShowTitleTextEditor(false)}
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold uppercase text-sm rounded-xl transition-colors"
                                    type="button"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ranking Leaderboard - Draggable Popup */}
            {showRanking && (
                <div
                    className="fixed z-[9999] pointer-events-auto"
                    style={{ left: rankingPos.x, top: rankingPos.y }}
                >
                    <div className="w-80 bg-slate-900 rounded-xl shadow-2xl overflow-hidden border-2 border-yellow-500">
                        {/* Draggable Header */}
                        <div
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 flex items-center justify-between cursor-move touch-none"
                            onPointerDown={(e) => {
                                setIsDraggingRanking(true);
                                rankingDragOffset.current = { x: e.clientX - rankingPos.x, y: e.clientY - rankingPos.y };
                                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                            }}
                            onPointerMove={(e) => {
                                if (!isDraggingRanking) return;
                                setRankingPos({ x: e.clientX - rankingDragOffset.current.x, y: e.clientY - rankingDragOffset.current.y });
                            }}
                            onPointerUp={(e) => {
                                setIsDraggingRanking(false);
                                try {
                                    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
                                } catch {}
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-white" />
                                <h3 className="text-lg font-black text-white uppercase tracking-widest">Ranking</h3>
                            </div>
                            <button
                                onClick={() => setShowRanking(false)}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                title="Close"
                                type="button"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>

                        {/* Leaderboard Content */}
                        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                            {isSimulationActive && simulationTeam ? (
                                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="text-2xl font-black text-yellow-400">#1</div>
                                            <div>
                                                <p className="text-sm font-black text-white uppercase">{simulationTeam.name}</p>
                                                <p className="text-xs text-slate-400">Simulation Mode</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-yellow-400">{simulationScore}</p>
                                            <p className="text-[10px] text-slate-400 uppercase">Points</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400 font-bold">Start simulation to see ranking</p>
                                    <p className="text-xs text-slate-500 mt-1">Use SIMULATOR button in TOOLS</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Simulation Task Modal */}
            {isSimulationActive && activeSimulationTaskId && (() => {
                const task = uniquePlaygroundPoints.find(p => p.id === activeSimulationTaskId);
                if (!task) return null;

                return (
                    <TaskModal
                        point={task}
                        onClose={() => setActiveSimulationTaskId(null)}
                        onComplete={(pointId, customScore) => {
                            // Update simulation score
                            const scoreDelta = customScore !== undefined ? customScore : (task.score || 0);
                            setSimulationScore(prev => prev + scoreDelta);

                            // Update task status
                            const updatedPoints = game.points.map(p =>
                                p.id === pointId
                                    ? { ...p, isCompleted: true, isCorrect: true }
                                    : p
                            );
                            onUpdateGame({ ...game, points: updatedPoints });

                            // Close modal
                            setActiveSimulationTaskId(null);
                        }}
                        onPenalty={(amount) => {
                            // Handle penalties in simulation mode
                            setSimulationScore(prev => Math.max(0, prev - amount));
                        }}
                        distance={0}
                        mode={GameMode.SIMULATION}
                        game={game}
                    />
                );
            })()}

            {/* QR Scanner Modal - Active in simulation mode */}
            {isSimulationActive && (
                <QRScannerModal
                    isOpen={isQRScannerActive}
                    onClose={() => setIsQRScannerActive(false)}
                    onScan={handleQRScan}
                />
            )}

            {/* Delete Zone Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteZoneConfirm.isOpen}
                title={`DELETE ZONE: "${deleteZoneConfirm.zoneName}"`}
                message={`This will permanently delete:\n• The zone and all its settings\n• ${deleteZoneConfirm.taskCount} task${deleteZoneConfirm.taskCount !== 1 ? 's' : ''} inside this zone\n\nThis action CANNOT be undone!`}
                confirmText="DELETE"
                cancelText="CANCEL"
                isDangerous={true}
                icon="warning"
                onConfirm={() => {
                    if (activePlayground) {
                        const remaining = game.playgrounds?.filter(p => p.id !== activePlayground.id) || [];
                        onUpdateGame({ ...game, playgrounds: remaining });
                        if (remaining.length > 0) setActivePlaygroundId(remaining[0].id);
                        else setActivePlaygroundId(null);
                    }
                    setDeleteZoneConfirm({ isOpen: false, zoneName: '', taskCount: 0 });
                }}
                onCancel={() => {
                    setDeleteZoneConfirm({ isOpen: false, zoneName: '', taskCount: 0 });
                }}
            />
        </div>
    );
};

export default PlaygroundEditor;
