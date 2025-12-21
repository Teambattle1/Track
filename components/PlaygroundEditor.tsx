
import React, { useState, useRef } from 'react';
import { Playground, GamePoint, Game, PlaygroundTemplate } from '../types';
import { X, Plus, Upload, Trash2, GripVertical, Image as ImageIcon, Check, MousePointer2, Wand2, Library, Save, Globe, Download, MoreVertical, Loader2, Gamepad2, CheckCircle, Maximize, Scaling } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import * as db from '../services/db';
import { generateAiImage } from '../services/ai';

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
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [showAddTaskMenu, setShowAddTaskMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const activePlayground = game.playgrounds?.find(p => p.id === activePlaygroundId);
  const playgroundPoints = game.points.filter(p => p.playgroundId === activePlaygroundId);

  const handleCreatePlayground = () => {
      const newPlayground: Playground = {
          id: `pg-${Date.now()}`,
          title: 'New Playground',
          buttonVisible: true,
          backgroundStyle: 'contain'
      };
      const updatedPlaygrounds = [...(game.playgrounds || []), newPlayground];
      onUpdateGame({ ...game, playgrounds: updatedPlaygrounds });
      setActivePlaygroundId(newPlayground.id);
  };

  const handleDeletePlayground = (id: string) => {
      if (!confirm("Delete this playground? Tasks inside will be removed.")) return;
      
      const updatedPlaygrounds = game.playgrounds?.filter(p => p.id !== id) || [];
      // Remove tasks associated with this playground
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

  const handleGenerateIcon = async () => {
      if (!activePlayground) return;
      setIsGeneratingIcon(true);
      const icon = await generateAiImage(`${activePlayground.title} icon, game ui button style, square, simple vector, vibrant colors`);
      if (icon) {
          handleUpdatePlayground({ iconUrl: icon });
      }
      setIsGeneratingIcon(false);
  };

  const updatePointPosition = (pointId: string, xPercent: number, yPercent: number) => {
      const updatedPoints = game.points.map(p => p.id === pointId ? { ...p, playgroundPosition: { x: xPercent, y: yPercent } } : p);
      onUpdateGame({ ...game, points: updatedPoints });
  };

  const handleSaveAsTemplate = () => {
      if (!activePlayground) return;
      if (!confirm("Save this playground as a Global Template? It will be available for other games.")) return;

      const template: PlaygroundTemplate = {
          id: `pg-tpl-${Date.now()}`,
          title: activePlayground.title,
          isGlobal: true,
          playgroundData: activePlayground,
          tasks: playgroundPoints, // Save snapshot of current tasks
          createdAt: Date.now()
      };

      db.savePlaygroundTemplate(template).then(() => {
          alert("Saved to Global Library!");
      });
  };

  // Drag Logic
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent, pointId: string) => {
      setDraggingPointId(pointId);
      e.stopPropagation();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (draggingPointId && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Convert to percentage
          const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
          const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));
          
          updatePointPosition(draggingPointId, xPercent, yPercent);
      }
  };

  const handleMouseUp = () => {
      setDraggingPointId(null);
  };

  return (
    <div className="fixed inset-0 z-[2200] bg-gray-100 dark:bg-gray-900 flex flex-col animate-in fade-in" onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
        
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center shadow-md z-20">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-black uppercase tracking-widest text-gray-800 dark:text-white">PLAYGROUND MANAGER</h2>
                <div className="flex gap-2">
                    {game.playgrounds?.map(pg => (
                        <button 
                            key={pg.id}
                            onClick={() => setActivePlaygroundId(pg.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border-2 transition-colors ${activePlaygroundId === pg.id ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'}`}
                        >
                            {pg.title}
                        </button>
                    ))}
                    <button onClick={handleCreatePlayground} className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 hover:text-green-600 transition-colors" title="Create New Blank"><Plus className="w-4 h-4" /></button>
                </div>
            </div>
            <button onClick={onClose} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 hover:bg-red-100 hover:text-red-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar Controls */}
            {activePlayground ? (
                <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-6 overflow-y-auto z-10">
                    <button 
                        onClick={onOpenLibrary}
                        className="w-full py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-100 dark:hover:bg-orange-900/40 flex items-center justify-center gap-2 mb-2"
                    >
                        <Globe className="w-4 h-4" /> IMPORT FROM LIBRARY
                    </button>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">TITLE</label>
                        <input 
                            type="text" 
                            value={activePlayground.title} 
                            onChange={(e) => handleUpdatePlayground({ title: e.target.value })}
                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-bold"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">BACKGROUND</label>
                        <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            {activePlayground.imageUrl ? (
                                <img src={activePlayground.imageUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <div className="text-center text-gray-400">
                                    <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                                    <span className="text-[9px] font-black uppercase">UPLOAD IMAGE</span>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </div>
                        
                        {/* BACKGROUND STRETCH CONTROL */}
                        {activePlayground.imageUrl && (
                             <div className="mt-2 flex items-center gap-2">
                                <button
                                    onClick={() => handleUpdatePlayground({ backgroundStyle: activePlayground.backgroundStyle === 'stretch' ? 'contain' : 'stretch' })}
                                    className={`flex-1 py-2 px-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                                        activePlayground.backgroundStyle === 'stretch' 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                                    }`}
                                >
                                    <Scaling className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-wide">
                                        {activePlayground.backgroundStyle === 'stretch' ? 'STRETCHED' : 'FIT (CONTAIN)'}
                                    </span>
                                </button>
                             </div>
                        )}
                    </div>

                    {/* NEW: Button Icon Manager */}
                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">BUTTON ICON</label>
                        <div className="flex gap-3">
                            <div className="w-16 h-16 rounded-2xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex items-center justify-center overflow-hidden shrink-0 relative group cursor-pointer" onClick={() => iconInputRef.current?.click()}>
                                {activePlayground.iconUrl ? (
                                    <>
                                        <img src={activePlayground.iconUrl} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload className="w-4 h-4 text-white" /></div>
                                    </>
                                ) : (
                                    <Gamepad2 className="w-8 h-8 text-gray-400" />
                                )}
                                <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                <button 
                                    onClick={() => iconInputRef.current?.click()}
                                    className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                >
                                    UPLOAD ICON
                                </button>
                                <button 
                                    onClick={handleGenerateIcon}
                                    disabled={isGeneratingIcon}
                                    className="flex-1 bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isGeneratingIcon ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                    AI GENERATE
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-xl">
                        <span className="text-xs font-bold uppercase">Show in Game HUD</span>
                        <button 
                            onClick={() => handleUpdatePlayground({ buttonVisible: !activePlayground.buttonVisible })}
                            className={`w-10 h-6 rounded-full p-1 transition-colors ${activePlayground.buttonVisible ? 'bg-green-500' : 'bg-gray-400'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${activePlayground.buttonVisible ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setShowAddTaskMenu(!showAddTaskMenu)}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> ADD TASK
                        </button>
                        
                        {showAddTaskMenu && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-20 animate-in slide-in-from-top-2">
                                <button onClick={() => { onAddTask('MANUAL', activePlayground.id); setShowAddTaskMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3">
                                    <div className="bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-lg"><Plus className="w-4 h-4 text-orange-600" /></div>
                                    <span className="text-xs font-bold uppercase">New Blank Task</span>
                                </button>
                                <button onClick={() => { onAddTask('AI', activePlayground.id); setShowAddTaskMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-t border-gray-100 dark:border-gray-700">
                                    <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-lg"><Wand2 className="w-4 h-4 text-purple-600" /></div>
                                    <span className="text-xs font-bold uppercase">AI Generator</span>
                                </button>
                                <button onClick={() => { onAddTask('LIBRARY', activePlayground.id); setShowAddTaskMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-t border-gray-100 dark:border-gray-700">
                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg"><Library className="w-4 h-4 text-blue-600" /></div>
                                    <span className="text-xs font-bold uppercase">From Library</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-700 space-y-3">
                        <button 
                            onClick={onClose}
                            className="w-full py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 flex items-center justify-center gap-2 shadow-lg"
                        >
                            <CheckCircle className="w-4 h-4" /> DONE / SAVE
                        </button>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSaveAsTemplate}
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
                                title="Save as Template"
                            >
                                <Save className="w-4 h-4" /> TEMPLATE
                            </button>
                            <button 
                                onClick={() => handleDeletePlayground(activePlayground.id)}
                                className="flex-1 py-3 border border-red-200 dark:border-red-900 text-red-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Delete Playground"
                            >
                                DELETE
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 p-6 gap-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-center">No Playground Selected</p>
                    <button 
                        onClick={onOpenLibrary}
                        className="py-2 px-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 hover:bg-orange-100"
                    >
                        <Globe className="w-4 h-4" /> IMPORT FROM LIBRARY
                    </button>
                </div>
            )}

            {/* Visual Editor Area */}
            <div className="flex-1 bg-gray-200 dark:bg-gray-950 relative overflow-hidden flex items-center justify-center p-8">
                {activePlayground ? (
                    <div 
                        ref={containerRef}
                        className="relative w-full h-full max-w-5xl bg-white shadow-2xl rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700"
                        style={{ 
                            backgroundImage: activePlayground.imageUrl ? `url(${activePlayground.imageUrl})` : 'none',
                            backgroundColor: '#1e293b',
                            backgroundSize: activePlayground.backgroundStyle === 'stretch' ? '100% 100%' : 'contain',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                        }}
                    >
                        {!activePlayground.imageUrl && <div className="absolute inset-0 flex items-center justify-center text-white/20 font-black text-4xl uppercase tracking-[0.2em]">DROP IMAGE HERE</div>}
                        
                        {playgroundPoints.map(point => {
                            const Icon = ICON_COMPONENTS[point.iconId];
                            const x = point.playgroundPosition?.x || 50;
                            const y = point.playgroundPosition?.y || 50;
                            
                            return (
                                <div
                                    key={point.id}
                                    onMouseDown={(e) => handleDragStart(e, point.id)}
                                    onClick={(e) => { e.stopPropagation(); onEditPoint(point); }}
                                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group hover:z-50"
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                >
                                    <div className="w-12 h-12 bg-white rounded-full shadow-xl border-4 border-orange-500 flex items-center justify-center text-orange-600 transition-transform group-hover:scale-110">
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-black/70 text-white text-[9px] font-bold px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                        {point.title}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    </div>
  );
};

export default PlaygroundEditor;
