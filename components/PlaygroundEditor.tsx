import React, { useState, useEffect, useRef } from 'react';
import { Game, Playground, GamePoint, IconId } from '../types';
import {
    X, Plus, LayoutGrid, Globe, Map as MapIcon, ArrowLeft, Trash2, Edit2,
    Image as ImageIcon, Upload, Grid, MousePointer2, Move, ZoomIn, ZoomOut,
    Maximize, Lock, Settings, Home, Save, Check, Type, Gamepad2, Library, Users, Shield,
    Smartphone, Tablet, Monitor, MousePointerClick, Music, Repeat, PlayCircle, ChevronLeft, ChevronRight,
    Wand2, Slider
} from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import { uploadImage } from '../services/storage'; // IMPORTED
import { generateAiImage } from '../services/ai';
import TaskActionModal from './TaskActionModal';

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
    onAddZoneFromLibrary
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
    
    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const taskIconInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

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
                location: { lat: 0, lng: 0 }
            };
            onUpdateGame({ ...game, playgrounds: [newPg] });
            setActivePlaygroundId(newPg.id);
        }
    }, [game.playgrounds]);

    const activePlayground = game.playgrounds?.find(p => p.id === activePlaygroundId) || game.playgrounds?.[0];
    const playgroundPoints = game.points.filter(p => p.playgroundId === activePlayground?.id);

    // Handlers
    const updatePlayground = (updates: Partial<Playground>) => {
        if (!activePlayground) return;
        const updated = game.playgrounds?.map(p => p.id === activePlayground.id ? { ...p, ...updates } : p);
        onUpdateGame({ ...game, playgrounds: updated });
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

    const selectedTask = game.points.find(p => p.id === selectedTaskId && p.playgroundId === activePlayground?.id);

    const updateTask = (updates: Partial<GamePoint>) => {
        if (!selectedTask) return;
        onUpdateGame({
            ...game,
            points: game.points.map(p => p.id === selectedTask.id ? { ...p, ...updates } : p)
        });
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
        if (!selectedTask) return;

        setIsGeneratingIcon(true);
        try {
            const iconUrl = await generateAiImage(prompt, 'simple icon style, transparent background');
            if (iconUrl) {
                updateTask({ iconUrl });
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

    const handleSnapAllToGrid = () => {
        // Dynamically calculate columns based on number of icons
        const totalIcons = playgroundPoints.length;
        let COLS = 3;

        if (totalIcons > 12) COLS = 4;
        if (totalIcons > 20) COLS = 5;

        const PADDING = 5;
        const ROW_HEIGHT = 20; // Space between rows

        // Sort points by current Y position (top to bottom), then X (left to right)
        const sortedPoints = [...playgroundPoints].sort((a, b) => {
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
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    if (!activePlayground) return null;

    const bgStyle: React.CSSProperties = {
        backgroundImage: activePlayground.imageUrl ? `url(${activePlayground.imageUrl})` : 'none',
        backgroundSize: activePlayground.backgroundStyle === 'stretch' ? '100% 100%' : (activePlayground.backgroundStyle === 'cover' ? 'cover' : 'contain'),
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        width: '100%',
        height: '100%',
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
    };

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

                {/* PLAYZONE TABS */}
                {game.playgrounds && game.playgrounds.length > 1 && (
                    <div className="px-5 py-3 border-b border-slate-800 bg-slate-900 overflow-x-auto">
                        <div className="flex gap-2">
                            {game.playgrounds.map((pg) => (
                                <button
                                    key={pg.id}
                                    onClick={() => setActivePlaygroundId(pg.id)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all flex-shrink-0 ${
                                        activePlaygroundId === pg.id
                                            ? 'bg-orange-600 text-white shadow-lg'
                                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                >
                                    {pg.title}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
                                {['default', 'star', 'flag', 'trophy', 'camera', 'question', 'skull', 'treasure'].map((iconKey) => {
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

                            <div className="space-y-2 mb-4">
                                <button
                                    onClick={() => iconInputRef.current?.click()}
                                    className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-[10px] font-bold text-slate-400 uppercase hover:text-white hover:border-slate-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-3 h-3" /> UPLOAD CUSTOM ICON
                                </button>
                                <input ref={iconInputRef} type="file" className="hidden" accept="image/*" onChange={handleIconUpload} />

                                {activePlayground.imageUrl && (
                                    <button
                                        onClick={() => updatePlayground({ iconUrl: activePlayground.imageUrl })}
                                        className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-colors ${
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
                                <span className="text-[9px] font-bold text-white uppercase tracking-widest">CHANGE IMAGE</span>
                            </div>
                        </div>
                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />

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
                    <div className="grid grid-cols-2 gap-3">
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
                            onClick={handleSnapAllToGrid}
                            className="py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center gap-2 text-white hover:bg-slate-700 active:bg-green-600 transition-colors"
                            title="Snap all icons to grid and align in rows"
                        >
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">SNAP ALL</span>
                        </button>
                    </div>

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
                <div className="p-5 border-t border-slate-800 space-y-3 flex-shrink-0">
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
                        className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
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
                    <button
                        onClick={onHome}
                        className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> RETURN TO HOME
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
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 border border-red-500"
                            title="Delete this zone permanently"
                        >
                            <Trash2 className="w-4 h-4" /> DELETE ZONE
                        </button>
                    )}
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

                {/* Top Overlay Bar */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10 pointer-events-none">
                    <div className="flex items-center gap-4 pointer-events-auto">
                        <h1 className="text-xl font-black text-white uppercase tracking-widest drop-shadow-md">
                            PLAYZONE EDITOR
                        </h1>
                        <div className="bg-orange-600 text-white px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                            <span className="text-[10px] font-bold opacity-70">01</span>
                            <span className="text-xs font-black uppercase tracking-wide">{activePlayground.title}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pointer-events-auto">
                        <button
                            onClick={onToggleScores}
                            className={`p-3 rounded-full shadow-lg transition-all ${showScores ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            title="Toggle Scores Display"
                        >
                            <Type className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onHome}
                            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full shadow-lg transition-all"
                            title="Return Home"
                        >
                            <Home className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div 
                    ref={canvasRef}
                    className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:40px_40px] [background-position:center]"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div 
                        style={bgStyle}
                        className="relative shadow-2xl"
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
                                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 165, 0, 0.2)" strokeWidth="1"/>
                                    </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#grid)" />
                            </svg>
                        )}

                        {/* Tasks on Canvas */}
                        {playgroundPoints.map(point => {
                            const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                            const isSelected = selectedTaskId === point.id;
                            const displaySize = (point.playgroundScale || 1) * 48;
                            return (
                                <div
                                    key={point.id}
                                    className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                                    style={{ left: `${point.playgroundPosition?.x || 50}%`, top: `${point.playgroundPosition?.y || 50}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTaskId(point.id);
                                    }}
                                >
                                    <div className={`rounded-full flex items-center justify-center border-4 shadow-xl transition-all ${
                                        isSelected
                                            ? 'border-orange-500 shadow-orange-500/50 scale-125'
                                            : 'border-slate-900 group-hover:scale-110'
                                    } ${point.isCompleted ? 'bg-green-500' : 'bg-white'}`}
                                    style={{ width: displaySize, height: displaySize }}>
                                        {point.iconUrl ? (
                                            <img src={point.iconUrl} alt={point.title} className="w-2/3 h-2/3 object-contain" />
                                        ) : (
                                            <Icon className={`w-6 h-6 ${point.isCompleted ? 'text-white' : 'text-slate-900'}`} />
                                        )}
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/80 text-white text-[9px] font-bold px-2 py-1 rounded uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        {point.title}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Side Tools hidden - functionality moved to right tasks drawer */}

                {/* Zoom Controls */}
                <div className="absolute bottom-6 right-6 z-20 flex gap-2 pointer-events-auto">
                    <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"><ZoomOut className="w-5 h-5" /></button>
                    <button onClick={() => setZoom(1)} className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"><Maximize className="w-5 h-5" /></button>
                    <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"><ZoomIn className="w-5 h-5" /></button>
                </div>

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
                <div className="p-5 border-b border-slate-800 flex items-center justify-center gap-3 bg-[#0f172a] relative">
                    <button
                        onClick={() => setIsTasksDrawerOpen(false)}
                        className="absolute left-5 text-orange-500 hover:text-orange-400 transition-colors p-2"
                        title="Close Tasks"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col items-center gap-1">
                        <h2 className="text-sm font-black uppercase tracking-widest text-white">TASKS</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{playgroundPoints.length} in zone</p>
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
                                <p className="text-sm font-bold text-white">{selectedTask.title}</p>
                            </div>

                            {/* Icon Size Slider */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <Slider className="w-3 h-3" /> ICON SIZE
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
                                <div className="grid grid-cols-2 gap-2">
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
                                            const prompt = prompt('Describe the icon you want to generate:\n(e.g., "red flag", "gold star", "camera icon")');
                                            if (prompt) handleGenerateTaskIcon(prompt);
                                        }}
                                        disabled={isGeneratingIcon}
                                        className={`py-2 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                                            isGeneratingIcon
                                                ? 'bg-purple-600/50 text-purple-300 cursor-wait'
                                                : 'border border-dashed border-purple-600 text-purple-400 hover:text-purple-300 hover:border-purple-400'
                                        }`}
                                        title="Generate icon with AI"
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
                                    onClick={() => onOpenLibrary(activePlayground.id)}
                                    className="py-4 px-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 border border-blue-600/40 hover:border-blue-500 rounded-lg font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all group flex-col"
                                    title="Add tasks from your library"
                                >
                                    <Library className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>LIBRARY</span>
                                </button>

                                {/* Add AI Task Button */}
                                <button
                                    onClick={() => onAddTask('AI', activePlayground.id)}
                                    className="py-4 px-3 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300 border border-purple-600/40 hover:border-purple-500 rounded-lg font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all group flex-col"
                                    title="Generate task using AI"
                                >
                                    <Smartphone className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span>AI TASK</span>
                                </button>

                                {/* Add Tasklist Button */}
                                <button
                                    onClick={() => onAddTask('MANUAL', activePlayground.id)}
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

                            {/* Tasks List */}
                            <div className="space-y-3">
                                {playgroundPoints.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">No tasks in zone yet</p>
                                        <p className="text-[9px] text-slate-600 mt-2">Use the buttons above to add your first task</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {playgroundPoints.map((point, index) => (
                                            <div
                                                key={point.id}
                                                className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-orange-500 hover:bg-slate-800 transition-colors cursor-pointer group"
                                                onClick={() => setSelectedTaskId(point.id)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">TASK {String(index + 1).padStart(2, '0')}</p>
                                                        <p className="text-xs font-bold text-white truncate group-hover:text-orange-300 transition-colors">{point.title}</p>
                                                    </div>
                                                    <Edit2 className="w-4 h-4 text-slate-500 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                                                </div>
                                            </div>
                                        ))}
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

            {/* Task Action Modal */}
            {showActionModal && selectedTask && (
                <TaskActionModal
                    point={selectedTask}
                    allPoints={playgroundPoints}
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
        </div>
    );
};

export default PlaygroundEditor;
