import React, { useState, useEffect, useRef } from 'react';
import { Game, Playground, GamePoint, IconId, TaskTemplate, TaskList } from '../types';
import {
    X, Plus, LayoutGrid, Globe, Map as MapIcon, ArrowLeft, Trash2, Edit2,
    Image as ImageIcon, Upload, Grid, MousePointer2, Move, ZoomIn, ZoomOut,
    Maximize, Lock, Settings, Home, Save, Check, Type, Gamepad2, Library, Users, Shield,
    Smartphone, Tablet, Monitor, MousePointerClick, Music, Repeat, PlayCircle, ChevronLeft, ChevronRight,
    Wand2, Zap, CheckCircle, XCircle, GripHorizontal, Navigation, AlertTriangle
} from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import { uploadImage } from '../services/storage'; // IMPORTED
import { generateAiImage, generateAiBackground, searchLogoUrl } from '../services/ai';
import * as db from '../services/db';
import { snapPointsToRoad, isPointInBox } from '../utils/mapbox';
import TaskActionModal from './TaskActionModal';
import AiTaskGenerator from './AiTaskGenerator';
import TaskMaster from './TaskMaster';

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
    onStartSimulation
}) => {
    // State
    const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isTasksDrawerOpen, setIsTasksDrawerOpen] = useState(false);
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

    // Toolbar positions (draggable)
    const [orientationToolbarPos, setOrientationToolbarPos] = useState({ x: 420, y: 24 });
    const [showToolbarPos, setShowToolbarPos] = useState({ x: 750, y: 24 });
    const [toolsToolbarPos, setToolsToolbarPos] = useState({ x: 1050, y: 24 });
    const [isDraggingOrientation, setIsDraggingOrientation] = useState(false);
    const [isDraggingShow, setIsDraggingShow] = useState(false);
    const [isDraggingTools, setIsDraggingTools] = useState(false);
    const orientationDragOffset = useRef({ x: 0, y: 0 });
    const showDragOffset = useRef({ x: 0, y: 0 });
    const toolsDragOffset = useRef({ x: 0, y: 0 });

    const [editorOrientation, setEditorOrientation] = useState<'portrait' | 'landscape'>('landscape');
    const [showAiIconPrompt, setShowAiIconPrompt] = useState(false);
    const [aiIconPromptValue, setAiIconPromptValue] = useState('');
    const [showLogoPrompt, setShowLogoPrompt] = useState(false);
    const [logoCompanyName, setLogoCompanyName] = useState('');
    const [isSearchingLogo, setIsSearchingLogo] = useState(false);
    const [isMarkMode, setIsMarkMode] = useState(false);
    const [markedTaskIds, setMarkedTaskIds] = useState<Set<string>>(new Set());
    const [showTaskMaster, setShowTaskMaster] = useState(false);
    const [taskMasterTab, setTaskMasterTab] = useState<'LIBRARY' | 'LISTS'>('LIBRARY');
    const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
    const [editingTitleValue, setEditingTitleValue] = useState('');
    const [bulkIconSourceId, setBulkIconSourceId] = useState<string | null>(null);
    const [bulkIconMode, setBulkIconMode] = useState(false);
    const [bulkIconTargets, setBulkIconTargets] = useState<Set<string>>(new Set());

    // AI Background Generation
    const [showAiBackgroundPrompt, setShowAiBackgroundPrompt] = useState(false);
    const [aiBackgroundPromptValue, setAiBackgroundPromptValue] = useState('');
    const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);

    // Delete Zone State
    const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);

    // Snap to Road State
    const [snapToRoadMode, setSnapToRoadMode] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{ start: { x: number; y: number } | null; current: { x: number; y: number } | null }>({ start: null, current: null });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const taskIconInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const backgroundRef = useRef<HTMLDivElement>(null);

    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const dragTaskRef = useRef<{
        id: string | null;
        offsetX: number;
        offsetY: number;
        startClientX: number;
        startClientY: number;
        moved: boolean;
    }>({ id: null, offsetX: 0, offsetY: 0, startClientX: 0, startClientY: 0, moved: false });

    // Initialize active playground
    useEffect(() => {
        if (!activePlaygroundId && game.playgrounds && game.playgrounds.length > 0) {
            setActivePlaygroundId(game.playgrounds[0].id);
        } else if (!game.playgrounds || game.playgrounds.length === 0) {
            // Auto-create if none exists
            const newPg: Playground = {
                id: `pg-${Date.now()}`,
                title: 'Global 1',
                buttonVisible: true,
                iconId: 'default',
                location: { lat: 0, lng: 0 },
                orientationLock: 'landscape'
            };
            onUpdateGame({ ...game, playgrounds: [newPg] });
            setActivePlaygroundId(newPg.id);
        }
    }, [game.playgrounds]);

    // Load toolbar positions from game
    useEffect(() => {
        if (game.toolbarPositions?.editorOrientationPos) {
            setOrientationToolbarPos(game.toolbarPositions.editorOrientationPos);
        }
        if (game.toolbarPositions?.editorShowPos) {
            setShowToolbarPos(game.toolbarPositions.editorShowPos);
        }
        if (game.toolbarPositions?.editorToolsPos) {
            setToolsToolbarPos(game.toolbarPositions.editorToolsPos);
        }
    }, [game.id]);

    // Save toolbar positions to game
    const saveToolbarPositions = () => {
        const updatedGame = {
            ...game,
            toolbarPositions: {
                ...game.toolbarPositions,
                editorOrientationPos: orientationToolbarPos,
                editorShowPos: showToolbarPos,
                editorToolsPos: toolsToolbarPos
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

    const activePlayground = game.playgrounds?.find(p => p.id === activePlaygroundId) || game.playgrounds?.[0];

    // CRITICAL NULL CHECK: Prevent crash if no playground exists
    if (!activePlayground) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '2rem',
                    maxWidth: '400px',
                    textAlign: 'center',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                }}>
                    <h2 style={{ color: '#1f2937', marginBottom: '1rem' }}>No Playground Available</h2>
                    <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                        This game doesn't have any playgrounds yet. Please create one first.
                    </p>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#667eea',
                            color: 'white',
                            padding: '0.625rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const isOrientationLocked = !!activePlayground.orientationLock && activePlayground.orientationLock !== 'none';

    const playgroundPoints = game.points.filter(p => p.playgroundId === activePlayground.id);

    useEffect(() => {
        if (!activePlayground) return;
        if (activePlayground.orientationLock && activePlayground.orientationLock !== 'none') {
            setEditorOrientation(activePlayground.orientationLock);
        } else {
            setEditorOrientation('landscape');
        }
    }, [activePlayground?.id, activePlayground?.orientationLock]);

    // Deduplicate to prevent "same key" errors
    const uniquePlaygroundPoints = Array.from(new Map(playgroundPoints.map(p => [p.id, p])).values());

    // Handlers
    const updatePlayground = (updates: Partial<Playground>) => {
        if (!activePlayground) return;
        const updated = game.playgrounds?.map(p => p.id === activePlayground.id ? { ...p, ...updates } : p);
        onUpdateGame({ ...game, playgrounds: updated });
    };

    const addNewZone = () => {
        const existingZones = game.playgrounds || [];
        const zoneNumber = existingZones.length + 1;

        const newZone: Playground = {
            id: `pg-${Date.now()}`,
            title: `Global ${zoneNumber}`,
            buttonVisible: true,
            iconId: 'default',
            location: { lat: 0, lng: 0 },
            orientationLock: 'landscape'
        };

        const updatedPlaygrounds = [...existingZones, newZone];
        onUpdateGame({ ...game, playgrounds: updatedPlaygrounds });
        setActivePlaygroundId(newZone.id);
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
        } catch (error) {
            console.error('[PlaygroundEditor] Error generating background:', error);
            alert('Error generating background. Please check your API key and try again.');
        } finally {
            setIsGeneratingBackground(false);
        }
    };

    const selectedTask = game.points.find(p => p.id === selectedTaskId && p.playgroundId === activePlayground?.id);

    const updateTask = (updates: Partial<GamePoint>) => {
        if (!selectedTask) return;
        onUpdateGame({
            ...game,
            points: game.points.map(p => p.id === selectedTask.id ? { ...p, ...updates } : p)
        });
    };

    const updatePointDirectly = (pointId: string, updates: Partial<GamePoint>) => {
        onUpdateGame({
            ...game,
            points: game.points.map(p => p.id === pointId ? { ...p, ...updates } : p)
        });
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

        const sourceTask = game.points.find(p => p.id === bulkIconSourceId);
        if (!sourceTask) return;

        const iconPayload = {
            iconId: sourceTask.iconId,
            iconUrl: sourceTask.iconUrl
        };

        onUpdateGame({
            ...game,
            points: game.points.map(p =>
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

    const handleGenerateTaskIcon = async (prompt: string) => {
        if (!prompt.trim()) {
            alert('Please enter a description for the icon');
            return;
        }

        setIsGeneratingIcon(true);
        try {
            const iconUrl = await generateAiImage(prompt, 'simple icon style, transparent background');
            if (iconUrl) {
                // If a task is selected, update task icon; otherwise update zone icon
                if (selectedTask) {
                    updateTask({ iconUrl });
                } else {
                    updatePlayground({ iconUrl });
                }
            } else {
                alert('Icon generation failed. Please try again.');
            }
        } catch (error) {
            console.error('Icon generation error:', error);
            alert('Failed to generate icon. Check your API key or try again.');
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
                updateTask({ iconUrl: logoUrl });
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
                points: game.points.map(p => {
                    if (updates[p.id]) {
                        return { ...p, playgroundPosition: updates[p.id] };
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
            const aY = a.playgroundPosition?.y || 50;
            const bY = b.playgroundPosition?.y || 50;
            const aX = a.playgroundPosition?.x || 50;
            const bX = b.playgroundPosition?.x || 50;

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
                playgroundPosition: {
                    x: Math.round(x * 10) / 10,
                    y: Math.round(y * 10) / 10
                }
            };
        });

        // Update game with snapped points
        onUpdateGame({
            ...game,
            points: game.points.map(p => {
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
            const aY = a.playgroundPosition?.y || 50;
            const bY = b.playgroundPosition?.y || 50;
            return aY - bY;
        });

        sortedByY.forEach(point => {
            const pointY = point.playgroundPosition?.y || 50;
            let foundRow = false;

            for (const row of rows) {
                const rowY = row[0]?.playgroundPosition?.y || 50;
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

        // Within each row, sort by X and distribute horizontally
        const PADDING = 5;
        const snappedMarkedPoints = rows.flatMap((row, rowIndex) => {
            const baseY = row[0].playgroundPosition?.y || 50;
            const sortedByX = [...row].sort((a, b) => {
                const aX = a.playgroundPosition?.x || 50;
                const bX = b.playgroundPosition?.x || 50;
                return aX - bX;
            });

            const colWidth = (100 - (PADDING * 2)) / sortedByX.length;
            return sortedByX.map((point, colIndex) => {
                const x = PADDING + (colIndex * colWidth) + (colWidth / 2);
                return {
                    ...point,
                    playgroundPosition: {
                        x: Math.round(x * 10) / 10,
                        y: Math.round(baseY * 10) / 10
                    }
                };
            });
        });

        // Update game with snapped marked points
        onUpdateGame({
            ...game,
            points: game.points.map(p => {
                const snapped = snappedMarkedPoints.find(sp => sp.id === p.id);
                return snapped ? { ...p, playgroundPosition: snapped.playgroundPosition } : p;
            })
        });

        // Exit mark mode and clear marked tasks
        setIsMarkMode(false);
        setMarkedTaskIds(new Set());
    };

    // Pan/Zoom, etc.
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const scaleAmount = -e.deltaY * 0.001;
            setZoom(z => Math.max(0.2, Math.min(5, z * (1 + scaleAmount))));
        } else {
            // Pan
            setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (dragTaskRef.current.id) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragTaskRef.current.id) return;
        if (isDragging) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    if (!activePlayground) return null;

    const bgStyle: React.CSSProperties = {
        backgroundImage: showBackground && activePlayground.imageUrl ? `url(${activePlayground.imageUrl})` : 'none',
        backgroundSize: activePlayground.backgroundStyle === 'stretch' ? '100% 100%' : (activePlayground.backgroundStyle === 'cover' ? 'cover' : 'contain'),
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: '100%',
        height: '100%',
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
    };

    const handleTaskPointerDown = (e: React.PointerEvent, point: GamePoint) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = backgroundRef.current?.getBoundingClientRect();
        if (!rect) return;

        const currentX = point.playgroundPosition?.x ?? 50;
        const currentY = point.playgroundPosition?.y ?? 50;

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
                points: game.points.filter(p => p.id !== id)
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
        const tasksToSnap = game.points.filter(point => {
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
            const updatedPoints = game.points.map(point => {
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
                    <button
                        onClick={() => setIsDrawerOpen(false)}
                        className="text-orange-500 hover:text-orange-400 transition-colors p-2 -mr-2"
                        title="Close Settings"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                </div>

                {/* PLAYZONE TABS - ZONE SELECTOR */}
                <div className="px-5 py-3 border-b border-slate-800 bg-slate-900 overflow-x-auto">
                    <div className="flex gap-2">
                        {game.playgrounds?.map((pg, index) => (
                            <button
                                key={pg.id}
                                onClick={() => setActivePlaygroundId(pg.id)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5 ${
                                    activePlaygroundId === pg.id
                                        ? 'bg-orange-600 text-white shadow-lg'
                                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                            >
                                <span className="text-[9px] opacity-70">{String(index + 1).padStart(2, '0')}</span>
                                {pg.title}
                            </button>
                        ))}
                        <button
                            onClick={addNewZone}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all flex-shrink-0 bg-green-600 hover:bg-green-700 text-white shadow-lg flex items-center gap-1"
                            title="Add a new zone to the game"
                        >
                            <Plus className="w-3 h-3" /> ADD NEW ZONE
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    
                    {/* Active Zone Card */}
                    <div className="bg-[#1e293b]/50 border border-slate-700 rounded-xl p-4 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ZONE TITLE</span>
                                <input
                                    type="text"
                                    value={activePlayground.title}
                                    onChange={(e) => updatePlayground({ title: e.target.value })}
                                    className="bg-transparent border-b border-slate-600 text-sm font-bold text-white uppercase focus:border-orange-500 outline-none pb-1 w-full"
                                />
                            </div>
                        </div>

                        {/* HUD Appearance */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <MousePointerClick className="w-3 h-3" /> HUD BUTTON APPEARANCE
                                </span>
                            </div>

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
                    </div>

                    {/* Background Image */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BACKGROUND IMAGE</span>
                        </div>

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
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => setShowAiBackgroundPrompt(true)}
                                disabled={isGeneratingBackground}
                                className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 text-white rounded-lg font-bold uppercase text-[10px] tracking-wide flex items-center justify-center gap-2 transition-colors shadow-lg"
                            >
                                <Wand2 className="w-4 h-4" />
                                {isGeneratingBackground ? 'GENERATING...' : 'AI BACKGROUND'}
                            </button>
                        </div>

                        {/* Scaling Options */}
                        <div className="flex bg-slate-800 rounded-lg p-1 mt-3 border border-slate-700">
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

                    {/* Grid Controls */}
                    <div className={`grid gap-3 ${isMarkMode ? 'grid-cols-2' : 'grid-cols-2'}`}>
                        <button
                            onClick={() => setShowGrid(!showGrid)}
                            className={`py-3 border rounded-xl flex items-center justify-center gap-2 transition-colors ${
                                showGrid
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                            }`}
                        >
                            <Grid className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">GRID</span>
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
                            className={`py-3 border rounded-xl flex items-center justify-center gap-2 transition-all ${
                                isMarkMode
                                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/50 animate-pulse'
                                    : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                            }`}
                            title={isMarkMode ? 'Exit mark mode' : 'Select tasks to snap to line-based grid'}
                        >
                            <MousePointer2 className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">MARK & SNAP</span>
                        </button>
                    </div>

                    {/* Snap Selected Button (only shown in mark mode) */}
                    {isMarkMode && markedTaskIds.size > 0 && (
                        <button
                            onClick={handleSnapMarkedToGrid}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 border border-green-500 rounded-xl flex items-center justify-center gap-2 text-white transition-all font-black uppercase tracking-widest text-[10px] shadow-lg"
                            title={`Snap ${markedTaskIds.size} selected task(s) to grid`}
                        >
                            <Check className="w-4 h-4" />
                            <span>SNAP SELECTED ({markedTaskIds.size})</span>
                        </button>
                    )}

                    {/* Background Audio Section - At Bottom */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Music className="w-3 h-3" /> BACKGROUND MUSIC
                            </span>
                        </div>

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
                    </div>

                </div>

                {/* Footer Buttons - Fixed at bottom */}
                <div className="p-5 border-t border-slate-800 flex-shrink-0">
                    <div className="flex gap-3">
                        <button
                            onClick={async () => {
                                setIsSaving(true);
                                setSaveStatus('saving');
                                try {
                                    // Always update the game state first
                                    await Promise.resolve(onUpdateGame(game));
                                    // Then save to database if in template mode
                                    if (isTemplateMode && onSaveTemplate) {
                                        await Promise.resolve(onSaveTemplate(game.name));
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
                                    <Save className="w-4 h-4" /> {isTemplateMode ? 'UPDATE TEMPLATE' : 'UPDATE ZONE'}
                                </>
                            )}
                        </button>

                        {activePlayground && (
                            <button
                                onClick={() => {
                                    if(window.confirm(`Delete zone "${activePlayground.title}"? This cannot be undone.`)) {
                                        const remaining = game.playgrounds?.filter(p => p.id !== activePlayground.id) || [];
                                        onUpdateGame({ ...game, playgrounds: remaining });
                                        if (remaining.length > 0) setActivePlaygroundId(remaining[0].id);
                                        else setActivePlaygroundId(null);
                                    }
                                }}
                                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 border border-red-500"
                                title="Delete this zone permanently"
                            >
                                <Trash2 className="w-4 h-4" /> DELETE ZONE
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT MAIN CANVAS */}
            <div className="flex-1 relative flex flex-col bg-[#050505]">
                {/* Drawer Toggle Button */}
                {!isDrawerOpen && (
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-r-2xl shadow-2xl transition-all active:scale-95"
                        title="Open Settings"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}

                {/* Top Overlay Bar - Title and Home Only */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 pointer-events-none">
                    <div className="flex items-center gap-4 pointer-events-auto">
                        <h1 className="text-xl font-black text-white uppercase tracking-widest drop-shadow-md">
                            PLAYZONE EDITOR
                        </h1>
                        <div className="bg-orange-600 text-white px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                            <span className="text-[10px] font-bold opacity-70">01</span>
                            <span className="text-xs font-black uppercase tracking-wide">{activePlayground.title}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pointer-events-auto">
                        <button
                            onClick={onHome}
                            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full shadow-lg transition-all"
                            title="Return Home"
                        >
                            <Home className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Draggable ORIENTATION Toolbar */}
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
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
                            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest px-1">ORIENTATION</span>
                            <div className="flex gap-3">
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEditorOrientation('portrait');
                                            if (isOrientationLocked) updatePlayground({ orientationLock: 'portrait' });
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
                                            if (isOrientationLocked) updatePlayground({ orientationLock: 'landscape' });
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
                                            if (isOrientationLocked) {
                                                updatePlayground({ orientationLock: 'none' });
                                            } else {
                                                updatePlayground({ orientationLock: editorOrientation });
                                            }
                                        }}
                                        className={`p-2 rounded transition-all cursor-pointer pointer-events-auto ${
                                            isOrientationLocked
                                                ? 'bg-orange-600 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                        }`}
                                        title={isOrientationLocked ? 'Unlock orientation' : 'Lock to selected orientation'}
                                        type="button"
                                    >
                                        <Lock className="w-4 h-4" />
                                    </button>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${isOrientationLocked ? 'text-orange-300' : 'text-slate-500'}`}>LOCK</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Orientation Lock Warning */}
                {isOrientationLocked && (
                    <div className="absolute top-24 left-6 bg-orange-900/80 border border-orange-500 rounded-lg p-3 text-[9px] text-orange-200 uppercase font-bold tracking-wide shadow-lg max-w-xs pointer-events-auto z-40">
                        ⚠️ Orientation is LOCKED to {activePlayground?.orientationLock === 'landscape' ? 'LANDSCAPE' : 'PORTRAIT'} when playing
                    </div>
                )}

                {/* Draggable SHOW Toolbar */}
                <div
                    className="absolute z-[1100] pointer-events-auto touch-none"
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
                            </div>
                        </div>
                    </div>
                </div>

                {/* Draggable TOOLS Toolbar */}
                {onStartSimulation && !isTemplateMode && (
                    <div
                        className="absolute z-[1100] pointer-events-auto touch-none"
                        style={{ left: toolsToolbarPos.x, top: toolsToolbarPos.y }}
                        onPointerDown={handleToolsPointerDown}
                        onPointerMove={handleToolsPointerMove}
                        onPointerUp={handleToolsPointerUp}
                    >
                        <div className="bg-black/40 backdrop-blur-sm border border-orange-500/30 rounded-lg shadow-2xl p-2 cursor-move group relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full px-2 border border-orange-500/30 pointer-events-none">
                                <GripHorizontal className="w-3 h-3" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest px-1">TOOLS</span>
                                <div className="flex gap-3">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setSnapToRoadMode(!snapToRoadMode);
                                                setSelectionBox({ start: null, current: null });
                                            }}
                                            className={`px-3 py-2 rounded transition-all cursor-pointer pointer-events-auto flex items-center gap-2 ${
                                                snapToRoadMode
                                                    ? 'bg-cyan-600 text-white shadow-lg hover:bg-cyan-700'
                                                    : 'bg-slate-700 text-slate-300 shadow-lg hover:bg-slate-600'
                                            }`}
                                            title={snapToRoadMode ? 'Click and drag on map to select tasks' : 'Snap selected tasks to road network'}
                                            type="button"
                                        >
                                            <Navigation className="w-4 h-4" />
                                            <span className="text-xs font-black uppercase tracking-wider">SNAP ROAD</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onStartSimulation();
                                            }}
                                            className="px-3 py-2 rounded transition-all cursor-pointer pointer-events-auto bg-purple-600 text-white shadow-lg hover:bg-purple-700 hover:shadow-xl active:scale-95 flex items-center gap-2"
                                            title="Start Simulation Mode - Play the game with all tasks and rules enabled"
                                            type="button"
                                        >
                                            <PlayCircle className="w-4 h-4" />
                                            <span className="text-xs font-black uppercase tracking-wider">SIMULATOR</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Canvas Area */}
                <div
                    ref={canvasRef}
                    className={`flex-1 overflow-hidden relative bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:40px_40px] [background-position:center] flex items-center justify-center p-8 ${
                        snapToRoadMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
                    }`}
                    onWheel={snapToRoadMode ? undefined : handleWheel}
                    onMouseDown={snapToRoadMode ? handleSnapToRoadStart : handleMouseDown}
                    onMouseMove={snapToRoadMode ? handleSnapToRoadMove : handleMouseMove}
                    onMouseUp={snapToRoadMode ? handleSnapToRoadEnd : handleMouseUp}
                    onMouseLeave={snapToRoadMode ? undefined : handleMouseUp}
                >
                    {/* Tablet Frame Container */}
                    <div className={`relative border-8 border-slate-950 rounded-3xl overflow-hidden flex-shrink-0 ${
                        editorOrientation === 'landscape'
                            ? 'w-[1024px] h-[768px]'
                            : 'w-[768px] h-[1024px]'
                    }`}
                    style={{
                        boxShadow: '0 0 0 12px #1f2937, 0 0 0 16px #000000, inset 0 0 0 1px #444'
                    }}>
                        {/* Device Notch/Speaker */}
                        {editorOrientation === 'landscape' && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-2 bg-black rounded-b-xl z-10"></div>
                        )}
                        {editorOrientation === 'portrait' && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-2 bg-black rounded-t-xl z-10"></div>
                        )}

                    <div
                        ref={backgroundRef}
                        style={{
                            ...bgStyle,
                            width: '100%',
                            height: '100%'
                        }}
                        className="relative"
                    >
                        {!activePlayground.imageUrl && (
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
                                        <circle cx="1" cy="1" r="0.5" fill="#f59e0b" opacity="0.8"/>
                                    </pattern>
                                </defs>
                                {uniquePlaygroundPoints.flatMap((source) => {
                                    const sourceX = (source.playgroundPosition?.x || 50);
                                    const sourceY = (source.playgroundPosition?.y || 50);

                                    // Extract target IDs from GameAction objects
                                    const getTargetIds = (actions: any[] | undefined) => {
                                        if (!actions) return [];
                                        return actions
                                            .map(action => action.targetId || action)
                                            .filter(id => typeof id === 'string' && id.length > 0);
                                    };

                                    return [
                                        ...getTargetIds(source.logic?.onCorrect).map((targetId) => {
                                            const target = game.points.find(p => p.id === targetId);
                                            if (!target) return null;
                                            const targetX = (target.playgroundPosition?.x || 50);
                                            const targetY = (target.playgroundPosition?.y || 50);
                                            return (
                                                <line
                                                    key={`correct-${source.id}-${targetId}`}
                                                    x1={sourceX}
                                                    y1={sourceY}
                                                    x2={targetX}
                                                    y2={targetY}
                                                    stroke="#10b981"
                                                    strokeWidth="0.3"
                                                    strokeDasharray="1,1"
                                                    opacity="0.8"
                                                />
                                            );
                                        }),
                                        ...getTargetIds(source.logic?.onIncorrect).map((targetId) => {
                                            const target = game.points.find(p => p.id === targetId);
                                            if (!target) return null;
                                            const targetX = (target.playgroundPosition?.x || 50);
                                            const targetY = (target.playgroundPosition?.y || 50);
                                            return (
                                                <line
                                                    key={`incorrect-${source.id}-${targetId}`}
                                                    x1={sourceX}
                                                    y1={sourceY}
                                                    x2={targetX}
                                                    y2={targetY}
                                                    stroke="#ef4444"
                                                    strokeWidth="0.3"
                                                    strokeDasharray="1,1"
                                                    opacity="0.8"
                                                />
                                            );
                                        }),
                                        ...getTargetIds(source.logic?.onOpen).map((targetId) => {
                                            const target = game.points.find(p => p.id === targetId);
                                            if (!target) return null;
                                            const targetX = (target.playgroundPosition?.x || 50);
                                            const targetY = (target.playgroundPosition?.y || 50);
                                            return (
                                                <line
                                                    key={`open-${source.id}-${targetId}`}
                                                    x1={sourceX}
                                                    y1={sourceY}
                                                    x2={targetX}
                                                    y2={targetY}
                                                    stroke="#f59e0b"
                                                    strokeWidth="0.3"
                                                    strokeDasharray="1,1"
                                                    opacity="0.8"
                                                />
                                            );
                                        })
                                    ].filter(Boolean);
                                })}
                            </svg>
                        )}

                        {/* Tasks on Canvas */}
                        {uniquePlaygroundPoints.map((point, index) => {
                            const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                            const isSelected = selectedTaskId === point.id;
                            const isMarked = markedTaskIds.has(point.id);
                            const displaySize = (point.playgroundScale || 1) * 48;
                            const isDraggingThis = draggingTaskId === point.id;

                            // Check if this task is a target of any action from other tasks
                            const isActionTarget = uniquePlaygroundPoints.some(source =>
                                source.id !== point.id && source.logic && (
                                    (source.logic.onCorrect?.some((a: any) => a.targetId === point.id || a === point.id)) ||
                                    (source.logic.onIncorrect?.some((a: any) => a.targetId === point.id || a === point.id)) ||
                                    (source.logic.onOpen?.some((a: any) => a.targetId === point.id || a === point.id))
                                )
                            );
                            return (
                                <div
                                    key={point.id}
                                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 group ${isDraggingThis ? 'cursor-grabbing' : isMarkMode ? 'cursor-pointer' : 'cursor-grab'}`}
                                    style={{ left: `${point.playgroundPosition?.x || 50}%`, top: `${point.playgroundPosition?.y || 50}%` }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onPointerDown={(e) => {
                                        if (isMarkMode && !isDraggingThis) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleMarkTask(point.id);
                                        } else {
                                            handleTaskPointerDown(e, point);
                                        }
                                    }}
                                    onPointerMove={handleTaskPointerMove}
                                    onPointerUp={handleTaskPointerUp}
                                    onPointerCancel={handleTaskPointerUp}
                                >
                                    <div className={`rounded-full flex items-center justify-center border-4 shadow-xl transition-all relative ${
                                        isMarked
                                            ? 'border-orange-400 shadow-orange-400/70 scale-120 animate-pulse'
                                            : isSelected
                                            ? 'border-orange-500 shadow-orange-500/50 scale-125'
                                            : 'border-slate-900 group-hover:scale-110'
                                    } ${point.isCompleted ? 'bg-green-500' : isActionTarget ? 'bg-slate-400/40' : 'bg-white'} ${isActionTarget ? 'opacity-50' : ''}`}
                                    style={{ width: displaySize, height: displaySize }}>
                                        {point.iconUrl ? (
                                            <img src={point.iconUrl} alt={point.title} className={`w-2/3 h-2/3 object-contain ${isActionTarget ? 'opacity-50' : ''}`} />
                                        ) : (
                                            <Icon className={`w-6 h-6 ${point.isCompleted ? 'text-white' : isActionTarget ? 'text-slate-400' : 'text-slate-900'}`} />
                                        )}

                                        {/* Mark Indicator Badge */}
                                        {isMarked && (
                                            <div className="absolute -top-2 -right-2 bg-orange-400 text-white text-[10px] font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-lg">
                                                ✓
                                            </div>
                                        )}

                                        {/* Task Order Badge */}
                                        {showTaskOrder && (
                                            <div className="absolute -top-1 -right-1 bg-orange-600 text-white text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-lg">
                                                {String(index + 1).padStart(2, '0')}
                                            </div>
                                        )}

                                        {/* Task Score Badge */}
                                        {showTaskScores && (
                                            <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-slate-900 text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-lg">
                                                {point.points}
                                            </div>
                                        )}

                                        {/* Task Actions Badge */}
                                        {showTaskActions && point.logic && (point.logic.onOpen?.length || point.logic.onCorrect?.length || point.logic.onIncorrect?.length) && (
                                            <div className="absolute -bottom-1 -left-1 bg-purple-600 text-white text-[8px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-lg">
                                                ⚡
                                            </div>
                                        )}

                                        {/* OK/Wrong Answer Marker - Green Check (correct) or Red X (wrong) */}
                                        {(point.showStatusMarkers ?? true) && (point.isCompleted || (point as any).answeredIncorrectly) && (
                                            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
                                                (point as any).answeredIncorrectly ? 'opacity-90' : 'opacity-80'
                                            }`}>
                                                {(point as any).answeredIncorrectly ? (
                                                    // Red X for incorrect
                                                    <div className="relative">
                                                        <XCircle className="w-16 h-16 text-red-500 drop-shadow-[0_2px_8px_rgba(239,68,68,0.8)]" strokeWidth={3} />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-12 h-12 bg-red-500/20 rounded-full blur-xl"></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Green check for correct
                                                    <div className="relative">
                                                        <CheckCircle className="w-16 h-16 text-green-500 drop-shadow-[0_2px_8px_rgba(34,197,94,0.8)]" strokeWidth={3} />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-12 h-12 bg-green-500/20 rounded-full blur-xl"></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Task Name - Always Visible when showTaskNames is true */}
                                    {showTaskNames && (
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/90 text-white text-[9px] font-bold px-2 py-1 rounded uppercase whitespace-nowrap pointer-events-none shadow-lg border border-orange-500/30">
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
                    </div>
                    </div>
                </div>

                {/* Right Side Tools hidden - functionality moved to right tasks drawer */}

                {/* Delete Zone - Bottom Right */}
                {/* Zoom Controls - Bottom Center */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2 pointer-events-auto">
                    <button
                        onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}
                        className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setZoom(1)}
                        className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"
                        title="Reset Zoom"
                    >
                        <Maximize className="w-5 h-5" />
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

                {/* Right Tasks Drawer Toggle Button */}
                {!isTasksDrawerOpen && (
                    <button
                        onClick={() => setIsTasksDrawerOpen(true)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-l-2xl shadow-2xl transition-all active:scale-95"
                        title="Open Tasks"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* RIGHT SIDE TASKS DRAWER - COLLAPSIBLE */}
            <div className={`flex flex-col border-l border-slate-800 bg-[#0f172a] shadow-2xl z-20 transition-all duration-300 ease-in-out ${
                isTasksDrawerOpen ? 'w-[360px]' : 'w-0'
            } overflow-hidden`}>
                {/* Header */}
                <div className="p-5 border-b border-slate-800 bg-[#0f172a] relative">
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

                        {/* Status Markers Toggle - Editor Preview Only */}
                        <button
                            onClick={() => setShowTaskStatus(!showTaskStatus)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border-2 flex items-center gap-2 ${
                                showTaskStatus
                                    ? 'bg-green-600 border-green-500 text-white shadow-lg'
                                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                            }`}
                            title="Toggle visibility in editor (per-task control in settings)"
                        >
                            <CheckCircle className="w-4 h-4" />
                            <span>Preview Markers</span>
                        </button>
                    </div>
                </div>

                {/* Content - Task Creation or Task Editor */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
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
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TASK TITLE</label>
                                <input
                                    value={selectedTask.title}
                                    onChange={(e) => updateTask({ title: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Task Status Markers Toggle */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> SHOW OK/WRONG ANSWER MARKERS
                                </label>
                                <p className="text-[8px] text-slate-400">
                                    When enabled, this task will display visual markers (✓ OK / ✗ WRONG) when teams re-enter the playzone after solving it.
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

                            {/* Icon Editor */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TASK ICON</label>

                                {/* Current Icon Preview */}
                                {selectedTask.iconUrl && (
                                    <div className="p-3 bg-slate-700 rounded-lg flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <img src={selectedTask.iconUrl} alt="Task Icon" className="w-8 h-8 object-contain" />
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
                                        onClick={() => taskIconInputRef.current?.click()}
                                        className="py-2 px-3 border border-dashed border-slate-600 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white hover:border-slate-400 transition-colors flex items-center justify-center gap-1"
                                        title="Upload custom icon"
                                    >
                                        <Upload className="w-3 h-3" /> UPLOAD
                                    </button>
                                    <input ref={taskIconInputRef} type="file" className="hidden" accept="image/*" onChange={handleTaskIconUpload} />

                                    <button
                                        onClick={() => {
                                            setLogoCompanyName('');
                                            setShowLogoPrompt(true);
                                        }}
                                        disabled={isSearchingLogo}
                                        className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                                            isSearchingLogo
                                                ? 'bg-blue-600/50 text-blue-300 cursor-wait'
                                                : 'border border-dashed border-blue-600 text-blue-400 hover:text-blue-300 hover:border-blue-400'
                                        }`}
                                        title="Search for company logo online"
                                        type="button"
                                    >
                                        {isSearchingLogo ? (
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
                                            setAiIconPromptValue('');
                                            setShowAiIconPrompt(true);
                                        }}
                                        disabled={isGeneratingIcon}
                                        className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                                            isGeneratingIcon
                                                ? 'bg-purple-600/50 text-purple-300 cursor-wait'
                                                : 'border border-dashed border-purple-600 text-purple-400 hover:text-purple-300 hover:border-purple-400'
                                        }`}
                                        title="Generate icon with AI"
                                        type="button"
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
                                </div>
                            </div>

                            {/* Actions Button */}
                            <button
                                onClick={() => setShowActionModal(true)}
                                className="w-full py-3 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-300 border border-indigo-600/40 hover:border-indigo-500 rounded-lg font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all"
                                title="Set up if/then logic and actions"
                            >
                                <Zap className="w-4 h-4" /> CONFIGURE ACTIONS
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
                                    className="py-4 px-3 bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 hover:text-orange-300 border border-orange-600/40 hover:border-orange-500 rounded-lg font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all group flex-col"
                                    title="Create a new task"
                                >
                                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>NEW TASK</span>
                                </button>
                            </div>

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

                            {/* Tasks List */}
                            <div className="space-y-3">
                                {uniquePlaygroundPoints.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">No tasks in zone yet</p>
                                        <p className="text-[9px] text-slate-600 mt-2">Use the buttons above to add your first task</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {uniquePlaygroundPoints.map((point, index) => {
                                            const hasActions = point.logic && (point.logic.onOpen?.length || point.logic.onCorrect?.length || point.logic.onIncorrect?.length);
                                            const isMarked = markedTaskIds.has(point.id);
                                            return (
                                                <div
                                                    key={point.id}
                                                    className={`p-3 border rounded-lg transition-colors group ${
                                                        bulkIconMode
                                                            ? bulkIconSourceId === point.id
                                                                ? 'bg-blue-500/20 border-blue-500 cursor-pointer'
                                                                : 'bg-slate-800/50 border-slate-700 cursor-pointer'
                                                            : (isMarked
                                                                ? 'bg-orange-500/20 border-orange-500'
                                                                : 'bg-slate-800/50 border-slate-700 hover:border-orange-500 hover:bg-slate-800')
                                                    }`}
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
                                                    <div className="flex items-start justify-between gap-3">
                                                        {bulkIconMode ? (
                                                            <>
                                                                {bulkIconSourceId === null ? (
                                                                    <div className="w-8 h-8 bg-blue-900/50 border-2 border-blue-400 rounded flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-blue-300 cursor-pointer hover:bg-blue-800/50">
                                                                        📌
                                                                    </div>
                                                                ) : bulkIconSourceId === point.id ? (
                                                                    <div className="w-8 h-8 bg-blue-600 border-2 border-blue-400 rounded flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/50">
                                                                        {point.iconUrl ? (
                                                                            <img src={point.iconUrl} alt="" className="w-5 h-5 object-contain" />
                                                                        ) : (
                                                                            (() => {
                                                                                const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                                                                                return <Icon className="w-5 h-5 text-white" />;
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
                                                                        className="mt-1 w-4 h-4 rounded border-2 border-orange-500 bg-slate-900 cursor-pointer accent-orange-500 flex-shrink-0"
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
                                                                className="mt-1 w-4 h-4 rounded border-2 border-orange-400 bg-slate-900 cursor-pointer accent-orange-500 flex-shrink-0"
                                                                title="Mark for snapping"
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            {showTaskOrder && (
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">TASK {String(index + 1).padStart(2, '0')}</p>
                                                                    {bulkIconMode && (
                                                                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                                            bulkIconSourceId === point.id
                                                                                ? 'bg-blue-600 text-white'
                                                                                : bulkIconSourceId && bulkIconTargets.has(point.id)
                                                                                    ? 'bg-orange-600 text-white'
                                                                                    : 'bg-slate-700 text-slate-400'
                                                                        }`}>
                                                                            {bulkIconSourceId === null ? 'SELECT SOURCE' : bulkIconSourceId === point.id ? 'SOURCE ✓' : 'TARGET'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
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
                                                                    className="w-full bg-slate-700 border border-orange-500 rounded px-2 py-1 text-xs font-bold text-white outline-none focus:border-orange-400"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <p
                                                                    className="text-xs font-bold text-white truncate group-hover:text-orange-300 transition-colors cursor-text"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingTitleId(point.id);
                                                                        setEditingTitleValue(point.title);
                                                                    }}
                                                                    title="Click to edit task title"
                                                                >
                                                                    {point.title}
                                                                </p>
                                                            )}
                                                            {showTaskScores && (
                                                                <p className="text-[9px] font-bold text-orange-400 uppercase mt-1 flex items-center gap-1">
                                                                    <span>$</span>
                                                                    <span>{point.points}</span>
                                                                </p>
                                                            )}

                                                            {/* Icon Thumbnail */}
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <div className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center flex-shrink-0 border border-slate-600">
                                                                    {point.iconUrl ? (
                                                                        <img src={point.iconUrl} alt="" className="w-4 h-4 object-contain" />
                                                                    ) : (
                                                                        (() => {
                                                                            const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                                                                            return <Icon className="w-4 h-4 text-slate-400" />;
                                                                        })()
                                                                    )}
                                                                </div>
                                                                <span className="text-[8px] text-slate-500 uppercase font-bold">Icon</span>
                                                            </div>

                                                            {showTaskActions && hasActions && (
                                                                <p className="text-[9px] font-bold text-purple-400 uppercase mt-2 flex items-center gap-1">
                                                                    <Zap className="w-2.5 h-2.5" />
                                                                    <span>HAS ACTIONS</span>
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Edit2 className="w-4 h-4 text-slate-500 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                    playgrounds={game.playgrounds}
                    onClose={() => setShowActionModal(false)}
                    onSave={(updatedPoint) => {
                        onUpdateGame({
                            ...game,
                            points: game.points.map(p => p.id === updatedPoint.id ? updatedPoint : p)
                        });
                        setShowActionModal(false);
                    }}
                    onStartDrawMode={() => {}}
                />
            )}

            {/* Advanced AI Task Generator (TaskMaster version) */}
            {showAiTaskGenerator && (
                <AiTaskGenerator
                    onClose={() => setShowAiTaskGenerator(false)}
                    playgrounds={game.playgrounds || []}
                    initialPlaygroundId={activePlayground?.id || null}
                    targetMode="GAME"
                    onAddTasks={(tasks, targetPlaygroundId) => {
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
                                id: `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
                                title: t.title,
                                shortIntro: (t as any).intro,
                                task: t.task,
                                location: { lat: 0, lng: 0 },
                                radiusMeters,
                                activationTypes: ['radius'],
                                manualUnlockCode: undefined,
                                playgroundId: targetPlaygroundId || activePlayground?.id,
                                playgroundPosition: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
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
                    }}
                    onAddToLibrary={async (tasks) => {
                        for (const t of tasks) {
                            await db.saveTemplate(t);
                        }
                    }}
                />
            )}

            {/* TaskMaster Modal for LIBRARY and TASKLIST */}
            {showTaskMaster && (
                <TaskMaster
                    onClose={() => setShowTaskMaster(false)}
                    onImportTasks={(tasks) => {
                        // Add selected tasks to the current playground
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
                            const openingAudioUrl = typeof templateAny.openingAudioUrl === 'string' ? templateAny.openingAudioUrl : undefined;

                            return {
                                id: `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
                                title: t.title,
                                shortIntro: (t as any).intro,
                                task: t.task,
                                location: { lat: 0, lng: 0 },
                                radiusMeters,
                                activationTypes: ['radius'],
                                manualUnlockCode: undefined,
                                playgroundId: activePlayground?.id,
                                playgroundPosition: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
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
                                completionLogic: (t as any).completionLogic,
                                openingAudioUrl
                            } as GamePoint;
                        });

                        onUpdateGame({
                            ...game,
                            points: [...game.points, ...newPoints]
                        });

                        setShowTaskMaster(false);
                    }}
                    taskLists={taskLists}
                    onUpdateTaskLists={onUpdateTaskLists}
                    taskLibrary={taskLibrary}
                    onUpdateTaskLibrary={onUpdateTaskLibrary}
                    games={[game]}
                    initialTab={taskMasterTab}
                />
            )}
        </div>
    );
};

export default PlaygroundEditor;
