import React, { useState, useEffect, useRef } from 'react';
import { Game, Playground, GamePoint, IconId } from '../types';
import { 
    X, Plus, LayoutGrid, Globe, Map as MapIcon, ArrowLeft, Trash2, Edit2, 
    Image as ImageIcon, Upload, Grid, MousePointer2, Move, ZoomIn, ZoomOut, 
    Maximize, Lock, Settings, Home, Save, Check, Type, Gamepad2, Library, Users, Shield,
    Smartphone, Tablet, Monitor, MousePointerClick, Music, Repeat, PlayCircle
} from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import { uploadImage } from '../services/storage'; // IMPORTED

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
    
    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
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

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await uploadImage(file);
            if (url) updatePlayground({ audioUrl: url, audioLoop: true });
        }
        // Reset to allow re-uploading same file
        if (audioInputRef.current) audioInputRef.current.value = '';
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
            
            {/* LEFT SIDEBAR EDITOR */}
            <div className="w-[360px] flex flex-col border-r border-slate-800 bg-[#0f172a] shadow-2xl z-20">
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]">
                    <div className="flex items-center gap-3">
                        <LayoutGrid className="w-5 h-5 text-orange-500" />
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-widest text-white">PLAYZONE EDITOR</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{game.playgrounds?.length || 0} ZONES ACTIVE</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    
                    {/* Active Zone Card */}
                    <div className="bg-[#1e293b]/50 border border-slate-700 rounded-xl p-4 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ZONE TITLE</span>
                                <input 
                                    type="text" 
                                    value={activePlayground.title} 
                                    onChange={(e) => updatePlayground({ title: e.target.value })}
                                    className="bg-transparent border-b border-slate-600 text-sm font-bold text-white uppercase focus:border-orange-500 outline-none pb-1 w-full"
                                />
                            </div>
                            <button 
                                onClick={() => {
                                    if(confirm('Delete this zone?')) {
                                        const remaining = game.playgrounds?.filter(p => p.id !== activePlayground.id) || [];
                                        onUpdateGame({ ...game, playgrounds: remaining });
                                        if (remaining.length > 0) setActivePlaygroundId(remaining[0].id);
                                        else setActivePlaygroundId(null);
                                    }
                                }}
                                className="text-slate-600 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* HUD Appearance */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <MousePointerClick className="w-3 h-3" /> HUD BUTTON APPEARANCE
                                </span>
                            </div>
                            
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

                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-[10px] font-bold text-slate-400 uppercase hover:text-white hover:border-slate-400 transition-colors flex items-center justify-center gap-2"
                            >
                                <Upload className="w-3 h-3" /> UPLOAD CUSTOM ICON
                            </button>
                            
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

                    {/* Background Audio Section */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Music className="w-3 h-3" /> BACKGROUND MUSIC
                            </span>
                        </div>
                        
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                            {!activePlayground.audioUrl ? (
                                <button 
                                    onClick={() => audioInputRef.current?.click()}
                                    className="w-full py-3 border border-dashed border-slate-600 rounded-lg text-slate-500 hover:text-white hover:border-indigo-500 hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-4 h-4" /> 
                                    <span className="text-[10px] font-bold uppercase">UPLOAD MP3</span>
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg">
                                        <div className="flex items-center gap-2 text-indigo-400">
                                            <Music className="w-4 h-4" />
                                            <span className="text-[10px] font-bold uppercase">AUDIO TRACK ACTIVE</span>
                                        </div>
                                        <button 
                                            onClick={() => updatePlayground({ audioUrl: undefined })}
                                            className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                        <button
                                            onClick={() => updatePlayground({ audioLoop: true })}
                                            className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded flex items-center justify-center gap-1 transition-colors ${activePlayground.audioLoop !== false ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            <Repeat className="w-3 h-3" /> LOOP
                                        </button>
                                        <button
                                            onClick={() => updatePlayground({ audioLoop: false })}
                                            className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded flex items-center justify-center gap-1 transition-colors ${activePlayground.audioLoop === false ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            <PlayCircle className="w-3 h-3" /> ONCE
                                        </button>
                                    </div>
                                </div>
                            )}
                            <input ref={audioInputRef} type="file" className="hidden" accept="audio/mp3,audio/mpeg,audio/wav" onChange={handleAudioUpload} />
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
                        <button className="py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center gap-2 text-white hover:bg-slate-700 transition-colors">
                            <Grid className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">GRID</span>
                        </button>
                        <button className="py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center gap-2 text-white hover:bg-slate-700 transition-colors">
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">SNAP</span>
                        </button>
                    </div>

                    {/* Tasks List */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TASKS IN ZONE ({playgroundPoints.length})</span>
                        </div>
                        <button 
                            onClick={() => onAddTask('MANUAL', activePlayground.id)}
                            className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-white hover:border-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all group"
                        >
                            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" /> ADD TASK
                        </button>
                    </div>

                </div>

                {/* Footer Buttons */}
                <div className="p-5 border-t border-slate-800 space-y-3">
                    <button 
                        onClick={() => {
                            if (isTemplateMode && onSaveTemplate) onSaveTemplate(game.name);
                            else onUpdateGame(game); // Trigger save logic in parent
                        }}
                        className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" /> {isTemplateMode ? 'UPDATE TEMPLATE' : 'UPDATE ZONE'}
                    </button>
                    <button 
                        onClick={onHome}
                        className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> RETURN TO HOME
                    </button>
                </div>
            </div>

            {/* RIGHT MAIN CANVAS */}
            <div className="flex-1 relative flex flex-col bg-[#050505]">
                {/* Top Overlay Bar */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10 pointer-events-none">
                    <div className="flex items-center gap-4 pointer-events-auto">
                        <h1 className="text-xl font-black text-white uppercase tracking-widest drop-shadow-md">
                            {isTemplateMode ? 'TEMPLATE EDITOR' : 'ZONE EDITOR'}
                        </h1>
                        <div className="bg-orange-600 text-white px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                            <span className="text-[10px] font-bold opacity-70">01</span>
                            <span className="text-xs font-black uppercase tracking-wide">{activePlayground.title}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pointer-events-auto">
                        <button onClick={onToggleScores} className={`p-3 rounded-full shadow-lg transition-all ${showScores ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                            <Type className="w-5 h-5" />
                        </button>
                        <button onClick={onHome} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full shadow-lg transition-all">
                            <Home className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full shadow-lg transition-all">
                            <X className="w-5 h-5" />
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

                        {/* Tasks on Canvas */}
                        {playgroundPoints.map(point => {
                            const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                            return (
                                <div
                                    key={point.id}
                                    className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                                    style={{ left: `${point.playgroundPosition?.x || 50}%`, top: `${point.playgroundPosition?.y || 50}%` }}
                                    onClick={(e) => { e.stopPropagation(); onEditPoint(point); }}
                                >
                                    <div className={`w-12 h-12 ${point.isCompleted ? 'bg-green-500' : 'bg-white'} rounded-full shadow-xl flex items-center justify-center border-4 border-slate-900 group-hover:scale-110 transition-transform`}>
                                        <Icon className={`w-6 h-6 ${point.isCompleted ? 'text-white' : 'text-slate-900'}`} />
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/80 text-white text-[9px] font-bold px-2 py-1 rounded uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        {point.title}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Side Tools (Vertical Pill) */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
                    <div className="bg-[#0f172a] border border-slate-800 rounded-full p-2 shadow-2xl flex flex-col gap-2">
                        <button onClick={() => onAddTask('MANUAL', activePlayground.id)} className="w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title="Add Task">
                            <Gamepad2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => onOpenLibrary(activePlayground.id)} className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title="Library">
                            <Library className="w-5 h-5" />
                        </button>
                        <button onClick={() => onAddZoneFromLibrary()} className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title="Import Zone">
                            <Users className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Zoom Controls */}
                <div className="absolute bottom-6 right-6 z-20 flex gap-2 pointer-events-auto">
                    <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"><ZoomOut className="w-5 h-5" /></button>
                    <button onClick={() => setZoom(1)} className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"><Maximize className="w-5 h-5" /></button>
                    <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl border border-slate-700 transition-colors"><ZoomIn className="w-5 h-5" /></button>
                </div>
            </div>
        </div>
    );
};

export default PlaygroundEditor;
