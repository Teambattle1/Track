import React, { useState, useRef, useEffect } from 'react';
import { Playground, GamePoint, Game, PlaygroundTemplate } from '../types';
import { X, Plus, Upload, Trash2, Image as ImageIcon, Globe, LayoutTemplate, Grid, Magnet, ZoomIn, ZoomOut, Maximize, Move, Scaling, Save, Check, Maximize2 } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import * as db from '../services/db';

interface PlaygroundEditorProps {
  game: Game;
  onUpdateGame: (game: Game) => void;
  onClose: () => void;
  onEditPoint: (point: GamePoint) => void;
  onAddTask: (type: 'MANUAL' | 'AI' | 'LIBRARY', playgroundId: string) => void;
  onOpenLibrary: () => void;
}

const PlaygroundEditor: React.FC<PlaygroundEditorProps> = ({ game, onUpdateGame, onClose, onEditPoint, onAddTask, onOpenLibrary }) => {
  const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(game.playgrounds?.[0]?.id || null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddTaskMenu, setShowAddTaskMenu] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [activePointId, setActivePointId] = useState<string | null>(null);

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
          backgroundStyle: 'contain'
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

  const handleOpenSaveModal = () => {
      if (!activePlayground) return;
      setTemplateName(activePlayground.title);
      setShowSaveModal(true);
  };

  const handleSaveAsTemplate = async () => {
      if (!activePlayground || !templateName.trim()) return;

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
  };

  const handleUpdatePointScale = (scale: number) => {
      if (!selectedPoint) return;
      const updatedPoints = game.points.map(p => p.id === selectedPoint.id ? { ...p, playgroundScale: scale } : p);
      onUpdateGame({ ...game, points: updatedPoints });
  };

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
                    PLAYGROUND EDITOR
                </h2>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex gap-2">
                    {game.playgrounds?.map(pg => (
                        <button 
                            key={pg.id}
                            onClick={() => { setActivePlaygroundId(pg.id); setView({x:0, y:0, scale:1}); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors whitespace-nowrap ${activePlaygroundId === pg.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'}`}
                        >
                            {pg.title}
                        </button>
                    ))}
                    <button onClick={handleCreatePlayground} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors border border-dashed border-gray-300 dark:border-gray-600"><Plus className="w-4 h-4" /></button>
                </div>
            </div>
            
            <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 hover:bg-red-100 hover:text-red-500 transition-colors shrink-0 ml-4"><X className="w-5 h-5" /></button>
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
                                    <input type="text" value={activePlayground.title} onChange={(e) => handleUpdatePlayground({ title: e.target.value })} className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-bold dark:text-white" />
                                </div>
                                
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">BACKGROUND IMAGE</label>
                                    <div 
                                        className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-orange-500 transition-colors group"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {activePlayground.imageUrl ? (
                                            <>
                                                <img src={activePlayground.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Upload className="w-6 h-6 text-white" />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
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
                                                    className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded transition-all ${
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
                                    <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg border text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${showGrid ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-400'}`}><Grid className="w-3 h-3" /> GRID</button>
                                    <button onClick={() => setSnapEnabled(!snapEnabled)} className={`p-2 rounded-lg border text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${snapEnabled ? 'bg-green-50 border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}><Magnet className="w-3 h-3" /> SNAP</button>
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
                                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isActive ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            >
                                                <div className={`p-1 rounded ${isActive ? 'bg-orange-200 text-orange-700' : 'bg-gray-200 text-gray-500'}`}><Icon className="w-3 h-3" /></div>
                                                <span className={`text-xs font-bold truncate flex-1 ${isActive ? 'text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-300'}`}>{p.title}</span>
                                                <button onClick={(e) => { e.stopPropagation(); onEditPoint(p); }} className="text-gray-400 hover:text-blue-500"><Move className="w-3 h-3" /></button>
                                            </div>
                                        );
                                    })}
                                    <button onClick={() => setShowAddTaskMenu(!showAddTaskMenu)} className="w-full py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-lg font-bold text-[10px] uppercase tracking-wide hover:bg-blue-100 transition-colors flex items-center justify-center gap-1">
                                        <Plus className="w-3 h-3" /> ADD TASK
                                    </button>
                                </div>
                                {showAddTaskMenu && (
                                    <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg mt-2 p-1 animate-in slide-in-from-top-2">
                                        <button onClick={() => { onAddTask('MANUAL', activePlayground.id); setShowAddTaskMenu(false); }} className="w-full p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-xs font-bold uppercase text-gray-700 dark:text-gray-200">Empty Task</button>
                                        <button onClick={() => { onAddTask('AI', activePlayground.id); setShowAddTaskMenu(false); }} className="w-full p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-xs font-bold uppercase text-gray-700 dark:text-gray-200">AI Generator</button>
                                        <button onClick={() => { onAddTask('LIBRARY', activePlayground.id); setShowAddTaskMenu(false); }} className="w-full p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-xs font-bold uppercase text-gray-700 dark:text-gray-200">From Library</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
                            <button onClick={onOpenLibrary} className="w-full py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold text-[10px] uppercase text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center gap-2">
                                <Globe className="w-3 h-3" /> IMPORT TEMPLATE
                            </button>
                            <div className="flex gap-2">
                                <button onClick={handleOpenSaveModal} className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 font-bold text-[10px] uppercase rounded-lg hover:bg-indigo-100 transition-colors">SAVE AS TEMPLATE</button>
                                <button onClick={() => handleDeletePlayground(activePlayground.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                        <LayoutTemplate className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-xs font-bold uppercase">NO ZONE SELECTED</p>
                        <p className="text-[10px] mt-1">Select a playground from the top bar or create a new one.</p>
                    </div>
                )}
            </div>

            {/* Canvas Area */}
            <div 
                ref={containerRef}
                className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center cursor-move touch-none"
                onPointerDown={(e) => handlePointerDown(e, 'PAN')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ 
                    backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', 
                    backgroundSize: '20px 20px',
                }}
            >
                {/* Floating Controls */}
                <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-auto">
                    <button onClick={() => setView(v => ({...v, scale: Math.min(5, v.scale + 0.2)}))} className="p-2 bg-white dark:bg-gray-800 shadow-xl rounded-lg text-gray-600 hover:text-orange-500 border border-gray-200 dark:border-gray-700"><ZoomIn className="w-5 h-5"/></button>
                    <button onClick={() => setView(v => ({...v, scale: Math.max(0.2, v.scale - 0.2)}))} className="p-2 bg-white dark:bg-gray-800 shadow-xl rounded-lg text-gray-600 hover:text-orange-500 border border-gray-200 dark:border-gray-700"><ZoomOut className="w-5 h-5"/></button>
                    <button onClick={() => setView({x:0, y:0, scale:1})} className="p-2 bg-white dark:bg-gray-800 shadow-xl rounded-lg text-gray-600 hover:text-orange-500 border border-gray-200 dark:border-gray-700"><Maximize className="w-5 h-5"/></button>
                </div>

                <div className="absolute bottom-4 left-4 z-50 pointer-events-none bg-black/60 backdrop-blur text-white px-3 py-1 rounded text-xs font-mono">
                    ZOOM: {Math.round(view.scale * 100)}% {dragItem ? '| DRAGGING' : ''}
                </div>

                {activePlayground && (
                    <div 
                        className="shadow-2xl overflow-hidden bg-slate-900 border-4 border-slate-800 transition-transform duration-75 ease-linear"
                        style={containerStyle}
                    >
                        <div ref={contentRef} className="w-full h-full relative select-none">
                            {/* Background Layer */}
                            <div 
                                className="absolute inset-0 bg-no-repeat bg-center"
                                style={{
                                    backgroundImage: activePlayground.imageUrl ? `url(${activePlayground.imageUrl})` : 'none',
                                    backgroundSize: activePlayground.backgroundStyle === 'stretch' ? '100% 100%' : (activePlayground.backgroundStyle === 'cover' ? 'cover' : 'contain'),
                                }}
                            >
                                {!activePlayground.imageUrl && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                                        <ImageIcon className="w-24 h-24 mb-4 opacity-20" />
                                        <span className="font-black text-4xl uppercase tracking-widest opacity-20">NO IMAGE</span>
                                    </div>
                                )}
                            </div>

                            {/* Grid Overlay */}
                            {showGrid && (
                                <div className="absolute inset-0 pointer-events-none z-0 opacity-20" 
                                    style={{
                                        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)`,
                                        backgroundSize: '10% 10%'
                                    }} 
                                />
                            )}

                            {/* Points Layer */}
                            {playgroundPoints.map(point => {
                                const Icon = ICON_COMPONENTS[point.iconId];
                                const isSelected = activePointId === point.id;
                                const isDragging = dragItem?.id === point.id;
                                
                                // Use drag state if dragging, else use point state
                                const x = isDragging ? dragItem!.x : (point.playgroundPosition?.x || 50);
                                const y = isDragging ? dragItem!.y : (point.playgroundPosition?.y || 50);
                                const scale = point.playgroundScale || 1;

                                return (
                                    <div
                                        key={point.id}
                                        onPointerDown={(e) => handlePointerDown(e, 'POINT', point.id, x, y)}
                                        className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group touch-none ${isSelected ? 'z-50' : 'z-10'}`}
                                        style={{ 
                                            left: `${x}%`, 
                                            top: `${y}%`, 
                                            transform: `translate(-50%, -50%) scale(${scale})`,
                                        }}
                                    >
                                        <div className={`w-12 h-12 rounded-full shadow-xl border-4 flex items-center justify-center transition-all bg-white ${isSelected ? 'border-blue-500 text-blue-600 scale-110 shadow-blue-500/50' : 'border-orange-500 text-orange-600'}`}>
                                            <Icon className="w-6 h-6 pointer-events-none" />
                                        </div>
                                        {isSelected && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping" />}
                                        
                                        {/* TASK TITLE - ALWAYS VISIBLE IN EDITOR */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap opacity-100 transition-opacity pointer-events-none border border-white/20 shadow-xl">
                                            {point.title}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* SAVE TEMPLATE MODAL */}
        {showSaveModal && (
            <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                    <h3 className="text-white font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Save className="w-5 h-5 text-indigo-500" /> Save Template
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">Save this playground configuration as a template for future use.</p>
                    
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">TEMPLATE NAME</label>
                    <input 
                        value={templateName} 
                        onChange={e => setTemplateName(e.target.value)} 
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white mb-6 outline-none focus:border-orange-500 transition-colors"
                        placeholder="e.g. Forest Maze"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleSaveAsTemplate()}
                    />
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowSaveModal(false)} 
                            className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl uppercase tracking-wide hover:bg-slate-700 transition-colors text-xs"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveAsTemplate} 
                            disabled={!templateName.trim()}
                            className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl uppercase tracking-wide hover:bg-green-700 transition-colors text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" /> Save
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default PlaygroundEditor;