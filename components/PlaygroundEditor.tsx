
import React, { useState, useRef, useEffect } from 'react';
import { Playground, GamePoint, Game, PlaygroundTemplate, IconId } from '../types';
import { X, Plus, Upload, Trash2, Image as ImageIcon, Globe, LayoutTemplate, Grid, Magnet, ZoomIn, ZoomOut, Maximize, Move, Scaling, Save, Check, Maximize2, MousePointer2, HelpCircle, CheckCircle, EyeOff, Smartphone, Tablet, Lock, Edit2, RotateCw, Hash, Home } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import * as db from '../services/db';

interface PlaygroundEditorProps {
  game: Game;
  onUpdateGame: (game: Game) => void;
  onClose: () => void;
  onEditPoint: (point: GamePoint) => void;
  onPointClick?: (point: GamePoint) => void;
  onAddTask: (type: 'MANUAL' | 'AI' | 'LIBRARY', playgroundId: string) => void;
  onOpenLibrary: () => void;
  showScores?: boolean;
  onToggleScores?: () => void;
  onHome?: () => void;
  onSaveTemplate?: (name: string) => void; // Optional: If provided, enables template editing mode
}

const PlaygroundEditor: React.FC<PlaygroundEditorProps> = ({ game, onUpdateGame, onClose, onEditPoint, onPointClick, onAddTask, onOpenLibrary, showScores, onToggleScores, onHome, onSaveTemplate }) => {
  const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(game.playgrounds?.[0]?.id || null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddTaskMenu, setShowAddTaskMenu] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  // Template Save Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // View Transform State
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  
  // Dragging State
  const [dragItem, setDragItem] = useState<{ id: string, x: number, y: number } | null>(null);
  
  // Refs for Drag Logic
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const hasDraggedRef = useRef(false);
  
  // State refs to access latest values in event handlers
  const dragState = useRef<{
      type: 'PAN' | 'POINT';
      id?: string;
      startX: number;
      startY: number;
      initialViewX?: number;
      initialViewY?: number;
      initialPointX?: number;
      initialPointY?: number;
  } | null>(null);

  // To avoid stale closures in event listeners
  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  const activePlayground = game.playgrounds?.find(p => p.id === activePlaygroundId);
  const playgroundPoints = game.points.filter(p => p.playgroundId === activePlaygroundId);
  const selectedPoint = playgroundPoints.find(p => p.id === activePointId);

  const isTemplateMode = !!onSaveTemplate;

  // --- ZOOM HANDLING (Wheel) ---
  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const scaleAmount = -e.deltaY * 0.001;
          setView(prev => ({ 
              ...prev, 
              scale: Math.max(0.1, Math.min(5, prev.scale * (1 + scaleAmount))) 
          }));
      };

      container.addEventListener('wheel', onWheel, { passive: false });
      return () => container.removeEventListener('wheel', onWheel);
  }, [activePlaygroundId]);

  // --- POINTER EVENT HANDLERS (Drag & Pan) ---
  
  const handlePointerDown = (e: React.PointerEvent, type: 'PAN' | 'POINT', pointId?: string, currentX?: number, currentY?: number) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Reset drag tracker
      hasDraggedRef.current = false;

      if (type === 'POINT' && pointId) {
          setActivePointId(pointId);
          setDragItem({ id: pointId, x: currentX || 50, y: currentY || 50 });
          
          dragState.current = {
              type: 'POINT',
              id: pointId,
              startX: e.clientX,
              startY: e.clientY,
              initialPointX: currentX || 50,
              initialPointY: currentY || 50
          };
      } else {
          dragState.current = {
              type: 'PAN',
              startX: e.clientX,
              startY: e.clientY,
              initialViewX: view.x,
              initialViewY: view.y
          };
      }

      // Important: Capture the pointer so we get events even if cursor leaves the element
      (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragState.current) return;
      e.preventDefault();
      e.stopPropagation();

      const { type, startX, startY } = dragState.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // Check if we moved enough to consider it a drag
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          hasDraggedRef.current = true;
      }

      if (type === 'PAN') {
          setView(prev => ({
              ...prev,
              x: (dragState.current?.initialViewX || 0) + deltaX,
              y: (dragState.current?.initialViewY || 0) + deltaY
          }));
      } else if (type === 'POINT' && contentRef.current) {
          // Calculate movement based on the SCALED size of the content container
          const rect = contentRef.current.getBoundingClientRect();
          
          // Convert pixel delta to percentage delta
          const deltaPctX = (deltaX / rect.width) * 100;
          const deltaPctY = (deltaY / rect.height) * 100;

          let newX = (dragState.current.initialPointX || 0) + deltaPctX;
          let newY = (dragState.current.initialPointY || 0) + deltaPctY;

          // Clamp to 0-100%
          newX = Math.max(0, Math.min(100, newX));
          newY = Math.max(0, Math.min(100, newY));

          // Snap Logic
          if (snapEnabled) {
              newX = Math.round(newX / 5) * 5;
              newY = Math.round(newY / 5) * 5;
          }

          setDragItem({ id: dragState.current.id!, x: newX, y: newY });
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (dragState.current) {
          e.preventDefault();
          e.stopPropagation();
          
          // Commit Point Drag
          if (dragState.current.type === 'POINT' && dragItem) {
              const updatedPoints = gameRef.current.points.map(p => 
                  p.id === dragItem.id 
                      ? { ...p, playgroundPosition: { x: dragItem.x, y: dragItem.y } } 
                      : p
              );
              onUpdateGame({ ...gameRef.current, points: updatedPoints });
              setDragItem(null);
          }

          (e.target as Element).releasePointerCapture(e.pointerId);
          dragState.current = null;
      }
  };

  // --- OTHER ACTIONS ---

  const handleCreatePlayground = () => {
      const newPlayground: Playground = {
          id: `pg-${Date.now()}`,
          title: 'New Zone',
          buttonVisible: true,
          backgroundStyle: 'contain',
          iconId: 'default',
          buttonSize: 80
      };
      const updatedPlaygrounds = [...(game.playgrounds || []), newPlayground];
      onUpdateGame({ ...game, playgrounds: updatedPlaygrounds });
      setActivePlaygroundId(newPlayground.id);
      setView({ x: 0, y: 0, scale: 1 });
  };

  const handleDeletePlayground = (id: string) => {
      if (!confirm("Delete this playground? Tasks inside will be removed.")) return;
      const updatedPlaygrounds = game.playgrounds?.filter(p => p.id !== id) || [];
      const updatedPoints = game.points.filter(p => p.playgroundId !== id);
      onUpdateGame({ ...game, playgrounds: updatedPlaygrounds, points: updatedPoints });
      if (activePlaygroundId === id) setActivePlaygroundId(updatedPlaygrounds[0]?.id || null);
  };

  const handleUpdatePlayground = (updates: Partial<Playground>) => {
      if (!activePlayground) return;
      const updated = (game.playgrounds || []).map(p => p.id === activePlayground.id ? { ...p, ...updates } : p);
      onUpdateGame({ ...game, playgrounds: updated });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && activePlayground) {
          setIsUploading(true);
          const reader = new FileReader();
          reader.onloadend = () => {
              handleUpdatePlayground({ imageUrl: reader.result as string });
              setIsUploading(false);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && activePlayground) {
          const reader = new FileReader();
          reader.onloadend = () => {
              handleUpdatePlayground({ iconUrl: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleOpenSaveModal = () => {
      if (!activePlayground) return;
      // In template mode, we might want to save immediately, but modal is good for confirming name/title.
      // If we are editing an existing template, we might skip modal if we don't change title?
      // For consistency, let's open modal to confirm name.
      setTemplateName(activePlayground.title);
      setShowSaveModal(true);
  };

  const handleSaveAsTemplate = async () => {
      if (!activePlayground || !templateName.trim()) return;

      if (onSaveTemplate) {
          // Template Mode: Delegate save to parent with just the name
          onSaveTemplate(templateName);
          setShowSaveModal(false);
      } else {
          // Game Mode: Create a copy
          const templateTasks = game.points.filter(p => p.playgroundId === activePlayground.id);

          const template: PlaygroundTemplate = {
              id: `pg-tpl-${Date.now()}`,
              title: templateName,
              playgroundData: activePlayground,
              tasks: templateTasks,
              createdAt: Date.now(),
              isGlobal: false
          };

          await db.savePlaygroundTemplate(template);
          setShowSaveModal(false);
          alert("Playground template saved successfully!");
      }
  };

  const handleUpdatePointScale = (scale: number) => {
      if (!selectedPoint) return;
      const updatedPoints = game.points.map(p => p.id === selectedPoint.id ? { ...p, playgroundScale: scale } : p);
      onUpdateGame({ ...game, points: updatedPoints });
  };

  const stripHtml = (html: any) => typeof html === 'string' ? html.replace(/<[^>]*>?/gm, '') : '';

  const containerStyle = {
      transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
      width: '800px', // Base reference width
      height: '600px', // Base reference height
      transformOrigin: '0 0'
  };

  return (
    <div className="fixed inset-0 z-[2200] bg-gray-100 dark:bg-gray-900 flex flex-col animate-in fade-in font-sans">
        
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex justify-between items-center shadow-sm z-20 shrink-0">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white flex items-center gap-2 whitespace-nowrap">
                    <LayoutTemplate className="w-5 h-5 text-orange-500" />
                    {isTemplateMode ? 'TEMPLATE EDITOR' : 'PLAYGROUND EDITOR'}
                </h2>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex gap-2">
                    {game.playgrounds?.map(pg => (
                        <button 
                            key={pg.id}
                            onClick={() => { setActivePlaygroundId(pg.id); setView({x:0, y:0, scale:1}); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all hover:scale-105 active:scale-95 whitespace-nowrap ${activePlaygroundId === pg.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600 hover:text-orange-500'}`}
                        >
                            {pg.title}
                        </button>
                    ))}
                    {!isTemplateMode && <button onClick={handleCreatePlayground} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-green-600 hover:bg-green-50 transition-all border border-dashed border-gray-300 dark:border-gray-600 hover:scale-110 active:scale-95"><Plus className="w-4 h-4" /></button>}
                </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 ml-4">
                {onToggleScores && (
                    <button 
                        onClick={onToggleScores}
                        title="Toggle Score Badges"
                        className={`p-2 rounded-lg transition-all border border-transparent hover:scale-110 active:scale-95 ${showScores ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-gray-600'}`}
                    >
                        <Hash className="w-5 h-5" />
                    </button>
                )}
                {onHome && (
                    <button 
                        onClick={onHome}
                        title="Go to Home"
                        className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 hover:bg-blue-600 hover:text-white transition-all hover:scale-110 active:scale-95"
                    >
                        <Home className="w-5 h-5" />
                    </button>
                )}
                <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 hover:bg-red-100 hover:text-red-500 transition-all hover:scale-110 active:scale-95"><X className="w-5 h-5" /></button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar */}
            <div className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-10 shrink-0 shadow-xl">
                {activePlayground ? (
                    <div className="flex flex-col h-full">
                        <div className="p-5 flex-1 overflow-y-auto space-y-6">
                            {/* Properties */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">ZONE TITLE</label>
                                    <input type="text" value={activePlayground.title} onChange={(e) => handleUpdatePlayground({ title: e.target.value })} className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-bold dark:text-white focus:border-orange-500 outline-none transition-colors" />
                                </div>
                                
                                <div className="p-3 bg-gray-100 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-600">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1">
                                        <MousePointer2 className="w-3 h-3" /> HUD BUTTON APPEARANCE
                                    </label>
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        {Object.keys(ICON_COMPONENTS).map((iconKey) => {
                                            const Icon = ICON_COMPONENTS[iconKey as IconId];
                                            const isActive = (activePlayground.iconId || 'default') === iconKey && !activePlayground.iconUrl;
                                            return (
                                                <button
                                                    key={iconKey}
                                                    onClick={() => handleUpdatePlayground({ iconId: iconKey as IconId, iconUrl: undefined })}
                                                    className={`aspect-square rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isActive ? 'bg-orange-600 text-white ring-2 ring-orange-400' : 'bg-white dark:bg-gray-600 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-500'}`}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Custom Icon Upload */}
                                    <div className="mb-3">
                                        <div 
                                            onClick={() => iconFileInputRef.current?.click()}
                                            className={`w-full py-2 px-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${activePlayground.iconUrl ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}`}
                                        >
                                            <input 
                                                ref={iconFileInputRef} 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={handleIconUpload} 
                                            />
                                            {activePlayground.iconUrl ? (
                                                <>
                                                    <img src={activePlayground.iconUrl} className="w-6 h-6 object-cover rounded bg-black/20" alt="Custom Icon" />
                                                    <span className="text-[9px] font-black text-orange-600 uppercase flex-1">Custom Icon</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleUpdatePlayground({ iconUrl: undefined }); }}
                                                        className="p-1 bg-red-100 dark:bg-red-900/30 text-red-500 rounded hover:bg-red-200 dark:hover:bg-red-900/50 hover:scale-110"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-3 h-3 text-gray-400" />
                                                    <span className="text-[9px] font-black text-gray-400 uppercase">UPLOAD CUSTOM ICON</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] font-bold text-gray-500 uppercase">SIZE</label>
                                        <input 
                                            type="range" 
                                            min="60" 
                                            max="120" 
                                            step="10" 
                                            value={activePlayground.buttonSize || 80} 
                                            onChange={(e) => handleUpdatePlayground({ buttonSize: parseInt(e.target.value) })}
                                            className="flex-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                        />
                                        <span className="text-[9px] font-bold text-gray-500 w-6 text-right">{activePlayground.buttonSize || 80}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">BACKGROUND IMAGE</label>
                                    <div 
                                        className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-orange-500 transition-all group hover:scale-[1.02] active:scale-95"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {activePlayground.imageUrl ? (
                                            <>
                                                <img src={activePlayground.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Upload className="w-6 h-6 text-white scale-125" />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center text-gray-400 group-hover:text-orange-500 transition-colors">
                                                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50 group-hover:scale-110 transition-transform" />
                                                <span className="text-[9px] font-black uppercase">UPLOAD IMAGE</span>
                                            </div>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </div>
                                    {isUploading && <div className="text-[10px] text-orange-500 font-bold mt-1 text-center animate-pulse">UPLOADING...</div>}
                                    
                                    {activePlayground.imageUrl && (
                                        <div className="flex gap-2 mt-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                            {[
                                                { id: 'contain', label: 'FIT' },
                                                { id: 'cover', label: 'FILL' },
                                                { id: 'stretch', label: 'STRETCH' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => handleUpdatePlayground({ backgroundStyle: opt.id as any })}
                                                    className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded transition-all hover:scale-105 active:scale-95 ${
                                                        (activePlayground.backgroundStyle || 'contain') === opt.id 
                                                            ? 'bg-white dark:bg-gray-600 text-orange-600 shadow-sm' 
                                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg border text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95 ${showGrid ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-400'}`}><Grid className="w-3 h-3" /> GRID</button>
                                    <button onClick={() => setSnapEnabled(!snapEnabled)} className={`p-2 rounded-lg border text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95 ${snapEnabled ? 'bg-green-50 border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}><Magnet className="w-3 h-3" /> SNAP</button>
                                </div>
                            </div>

                            {/* Active Point Settings */}
                            {selectedPoint && (
                                <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-3 rounded-xl animate-in slide-in-from-left-2">
                                    <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2 block flex items-center gap-1">
                                        <Scaling className="w-3 h-3" /> SCALE SELECTED PIN
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="range" 
                                            min="0.5" 
                                            max="3" 
                                            step="0.1" 
                                            value={selectedPoint.playgroundScale || 1} 
                                            onChange={(e) => handleUpdatePointScale(parseFloat(e.target.value))}
                                            className="flex-1 h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                        />
                                        <span className="text-xs font-bold text-orange-700 w-8 text-right">{selectedPoint.playgroundScale || 1}x</span>
                                    </div>
                                </div>
                            )}

                            {/* Task List */}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex justify-between">
                                    <span>TASKS IN ZONE ({playgroundPoints.length})</span>
                                </label>
                                <div className="space-y-1.5">
                                    {playgroundPoints.map(p => {
                                        const Icon = ICON_COMPONENTS[p.iconId];
                                        const isActive = activePointId === p.id;
                                        return (
                                            <div 
                                                key={p.id} 
                                                onClick={() => { setActivePointId(p.id); onEditPoint(p); }}
                                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all hover:translate-x-1 ${isActive ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            >
                                                <div className={`p-1 rounded ${isActive ? 'bg-orange-200 text-orange-700' : 'bg-gray-200 text-gray-500'}`}><Icon className="w-3 h-3" /></div>
                                                <span className={`text-xs font-bold truncate flex-1 ${isActive ? 'text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-300'}`}>{p.title}</span>
                                                <button onClick={(e) => { e.stopPropagation(); onEditPoint(p); }} className="p-1 text-gray-400 hover:text-blue-500 hover:scale-110"><Edit2 className="w-3 h-3" /></button>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="relative mt-2">
                                    <button 
                                        onClick={() => setShowAddTaskMenu(!showAddTaskMenu)}
                                        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-400 hover:text-orange-500 hover:border-orange-500 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        <Plus className="w-3 h-3" /> ADD TASK
                                    </button>
                                    
                                    {showAddTaskMenu && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 animate-in slide-in-from-top-1 overflow-hidden">
                                            <button onClick={() => { onAddTask('MANUAL', activePlayground.id); setShowAddTaskMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors">
                                                <div className="bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-lg"><Plus className="w-4 h-4 text-orange-600" /></div>
                                                <span className="text-xs font-bold uppercase text-gray-800 dark:text-white">New Blank Task</span>
                                            </button>
                                            <button onClick={() => { onAddTask('AI', activePlayground.id); setShowAddTaskMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-t border-gray-100 dark:border-gray-700 transition-colors">
                                                <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-lg"><Globe className="w-4 h-4 text-purple-600" /></div>
                                                <span className="text-xs font-bold uppercase text-gray-800 dark:text-white">AI Generator</span>
                                            </button>
                                            <button onClick={() => { onOpenLibrary(); setShowAddTaskMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-t border-gray-100 dark:border-gray-700 transition-colors">
                                                <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg"><LayoutTemplate className="w-4 h-4 text-blue-600" /></div>
                                                <span className="text-xs font-bold uppercase text-gray-800 dark:text-white">From Global Library</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <button 
                                onClick={handleOpenSaveModal}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg mb-2 hover:scale-105 active:scale-95 transition-all"
                            >
                                <Save className="w-4 h-4" /> {isTemplateMode ? 'SAVE TEMPLATE' : 'SAVE AS TEMPLATE'}
                            </button>
                            {!isTemplateMode && (
                                <button 
                                    onClick={() => handleDeletePlayground(activePlayground.id)}
                                    className="w-full py-3 border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                                >
                                    <Trash2 className="w-4 h-4" /> DELETE ZONE
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                        <Globe className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-bold text-sm uppercase">NO PLAYGROUND SELECTED</p>
                        <p className="text-xs mt-2">Select a zone from the top bar or create a new one.</p>
                        <button onClick={handleCreatePlayground} className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-xs hover:scale-105 transition-all shadow-lg">CREATE ZONE</button>
                    </div>
                )}
            </div>

            {/* Editor Canvas */}
            <div 
                ref={containerRef}
                className="flex-1 relative overflow-hidden bg-[#1e1e1e] cursor-grab active:cursor-grabbing flex items-center justify-center"
                onPointerDown={(e) => handlePointerDown(e, 'PAN')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onContextMenu={(e) => e.preventDefault()}
            >
                {/* Grid Background */}
                <div 
                    className="absolute inset-0 pointer-events-none opacity-20" 
                    style={{ 
                        backgroundImage: showGrid ? 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)' : 'none',
                        backgroundSize: '20px 20px',
                        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, // Sync grid movement
                        transformOrigin: '0 0'
                    }} 
                />

                {activePlayground && (
                    <div 
                        ref={contentRef}
                        className="relative bg-white shadow-2xl transition-transform duration-75 ease-out select-none"
                        style={{
                            width: '800px', // Fixed reference size for editor coordinate system
                            height: '600px',
                            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                            transformOrigin: 'center center' // Zoom from center of view
                        }}
                    >
                        {/* Background Image */}
                        {activePlayground.imageUrl ? (
                            <div 
                                className="absolute inset-0 bg-center bg-no-repeat pointer-events-none"
                                style={{ 
                                    backgroundImage: `url(${activePlayground.imageUrl})`,
                                    backgroundSize: activePlayground.backgroundStyle === 'stretch' ? '100% 100%' : (activePlayground.backgroundStyle === 'cover' ? 'cover' : 'contain'),
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-black uppercase tracking-widest text-4xl border-4 border-dashed border-gray-200">
                                NO BACKGROUND
                            </div>
                        )}

                        {/* Points */}
                        {playgroundPoints.map(point => {
                            const Icon = ICON_COMPONENTS[point.iconId];
                            const isActive = activePointId === point.id;
                            const isDragging = dragItem?.id === point.id;
                            
                            // Use drag position if dragging, otherwise stored position
                            const x = isDragging ? dragItem.x : (point.playgroundPosition?.x || 50);
                            const y = isDragging ? dragItem.y : (point.playgroundPosition?.y || 50);
                            const scale = point.playgroundScale || 1;

                            return (
                                <div
                                    key={point.id}
                                    onPointerDown={(e) => handlePointerDown(e, 'POINT', point.id, x, y)}
                                    className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10 group ${isActive ? 'ring-4 ring-orange-500 z-50' : ''}`}
                                    style={{ 
                                        left: `${x}%`, 
                                        top: `${y}%`,
                                        backgroundColor: point.isCompleted ? '#22c55e' : (point.isUnlocked ? '#ffffff' : '#334155'),
                                        color: point.isCompleted ? '#fff' : (point.isUnlocked ? '#ea580c' : '#94a3b8'),
                                        transform: `scale(${scale})`
                                    }}
                                >
                                    {point.isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                                    
                                    {/* Label on Hover */}
                                    <div className="absolute top-full mt-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        {point.title}
                                    </div>

                                    {/* Quick Actions (only when active) */}
                                    {isActive && !isDragging && (
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-auto">
                                            <button onClick={(e) => { e.stopPropagation(); onEditPoint(point); }} className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-md hover:scale-110 transition-transform"><Edit2 className="w-3 h-3" /></button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* SAVE TEMPLATE MODAL */}
        {showSaveModal && (
            <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6">
                    <h3 className="text-lg font-black uppercase text-gray-900 dark:text-white mb-4">
                        {isTemplateMode ? 'SAVE TEMPLATE CHANGES' : 'SAVE AS GLOBAL TEMPLATE'}
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">TEMPLATE NAME</label>
                            <input 
                                type="text" 
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm font-bold dark:text-white"
                                placeholder="e.g. Corporate Lobby"
                            />
                        </div>
                        
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl uppercase text-xs tracking-wide hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">CANCEL</button>
                            <button onClick={handleSaveAsTemplate} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl uppercase text-xs tracking-wide shadow-lg transition-all hover:scale-105 active:scale-95">CONFIRM SAVE</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default PlaygroundEditor;
