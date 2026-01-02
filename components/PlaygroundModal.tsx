import React, { useState, useEffect, useRef } from 'react';
import { GamePoint, Playground, GameMode } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { X, CheckCircle, Lock, Smartphone, Tablet, Monitor, RotateCw, Edit2, Maximize, ZoomIn, ZoomOut, EyeOff, HelpCircle, MousePointerClick, Volume2, VolumeX } from 'lucide-react';

interface PlaygroundModalProps {
  playground: Playground;
  points: GamePoint[];
  onClose: () => void;
  onPointClick: (point: GamePoint) => void;
  mode: GameMode;
  onUpdatePlayground?: (updated: Playground) => void;
  onEditPlayground?: () => void;
  taskCooldowns?: Map<string, number>; // Map of taskId -> cooldown end timestamp
}

const PlaygroundModal: React.FC<PlaygroundModalProps> = ({ playground, points, onClose, onPointClick, mode, onUpdatePlayground, onEditPlayground, taskCooldowns = new Map() }) => {
  const playgroundPoints = points.filter(p => {
      if (p.playgroundId !== playground.id) return false;
      if (mode === GameMode.PLAY && p.isHiddenBeforeScan && !p.isUnlocked) {
          return false;
      }
      return true;
  });
  
  const [viewDevice, setViewDevice] = useState<'mobile' | 'tablet'>('mobile');
  const [viewOrientation, setViewOrientation] = useState<'portrait' | 'landscape'>(
      playground.orientationLock && playground.orientationLock !== 'none' 
        ? playground.orientationLock 
        : 'portrait'
  );

  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  
  // Audio State
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const pointersRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const prevPinchDistRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  // Audio Playback Logic
  useEffect(() => {
      if (playground.audioUrl && mode === GameMode.PLAY) {
          // If already playing same audio, don't restart
          if (audioRef.current && audioRef.current.src === playground.audioUrl) {
              return;
          }

          if (audioRef.current) {
              audioRef.current.pause();
          }

          const audio = new Audio(playground.audioUrl);
          audio.loop = playground.audioLoop !== false; // Default to true (continuous)
          audio.volume = 0.5; // Default volume
          audioRef.current = audio;

          const playPromise = audio.play();
          if (playPromise !== undefined) {
              playPromise.catch(error => {
                  console.warn("Autoplay prevented:", error);
                  // UI could show a "Click to unmute/play" button here if needed
              });
          }
      }

      return () => {
          if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
          }
      };
  }, [playground.audioUrl, mode]);

  const toggleMute = () => {
      if (audioRef.current) {
          audioRef.current.muted = !isMuted;
          setIsMuted(!isMuted);
      }
  };

  useEffect(() => {
      if (mode === GameMode.EDIT) {
          setShowRotatePrompt(false);
          return;
      }
      if (!playground.orientationLock || playground.orientationLock === 'none') {
          setShowRotatePrompt(false);
          return;
      }
      const checkOrientation = () => {
          const width = window.innerWidth;
          const height = window.innerHeight;
          const isLandscape = width > height;
          const target = playground.orientationLock;
          
          if (target === 'landscape' && !isLandscape) setShowRotatePrompt(true);
          else if (target === 'portrait' && isLandscape) setShowRotatePrompt(true);
          else setShowRotatePrompt(false);
      };
      checkOrientation();
      window.addEventListener('resize', checkOrientation);
      return () => window.removeEventListener('resize', checkOrientation);
  }, [mode, playground.orientationLock]);

  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const scaleAmount = -e.deltaY * 0.001;
          setTransform(prev => ({ ...prev, scale: Math.max(0.2, Math.min(5, prev.scale * (1 + scaleAmount))) }));
      };
      container.addEventListener('wheel', onWheel, { passive: false });
      return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const getDistance = (p1: {x: number, y: number}, p2: {x: number, y: number}) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

  const handlePointerDown = (e: React.PointerEvent) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      (e.target as Element).setPointerCapture(e.pointerId);
      if (pointersRef.current.size === 1) {
          isDraggingRef.current = true;
          dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (pointersRef.current.size === 2) {
          isDraggingRef.current = false; 
          const points = Array.from(pointersRef.current.values()) as {x: number, y: number}[];
          if (points[0] && points[1]) prevPinchDistRef.current = getDistance(points[0], points[1]);
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size === 2) {
          const points = Array.from(pointersRef.current.values()) as {x: number, y: number}[];
          if (points[0] && points[1]) {
              const dist = getDistance(points[0], points[1]);
              if (prevPinchDistRef.current) {
                  const delta = dist - prevPinchDistRef.current;
                  const scaleAmount = delta * 0.005;
                  setTransform(prev => ({ ...prev, scale: Math.max(0.2, Math.min(5, prev.scale * (1 + scaleAmount))) }));
              }
              prevPinchDistRef.current = dist;
          }
      } else if (pointersRef.current.size === 1 && isDraggingRef.current && dragStartRef.current) {
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      (e.target as Element).releasePointerCapture(e.pointerId);
      if (pointersRef.current.size < 2) prevPinchDistRef.current = null;
      if (pointersRef.current.size === 0) {
          isDraggingRef.current = false;
          dragStartRef.current = null;
      }
  };

  const handleZoomIn = () => setTransform(t => ({...t, scale: Math.min(5, t.scale + 0.2)}));
  const handleZoomOut = () => setTransform(t => ({...t, scale: Math.max(0.2, t.scale - 0.2)}));
  const handleResetZoom = () => setTransform({x:0, y:0, scale:1});

  const getContainerStyle = () => {
      if (mode !== GameMode.EDIT) {
          return { 
              width: '100%', 
              height: '100%',
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: 'center center',
              cursor: pointersRef.current.size > 1 ? 'zoom-in' : (isDraggingRef.current ? 'grabbing' : 'grab'),
              touchAction: 'none' 
          };
      }
      const baseStyles: React.CSSProperties = {
          position: 'relative',
          border: '12px solid #333',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 0 50px rgba(0,0,0,0.5)',
          backgroundColor: '#1e293b',
          transition: 'all 0.3s ease',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
          touchAction: 'none'
      };
      if (viewDevice === 'mobile') return viewOrientation === 'portrait' ? { ...baseStyles, width: '375px', height: '667px' } : { ...baseStyles, width: '667px', height: '375px' };
      return viewOrientation === 'portrait' ? { ...baseStyles, width: '768px', height: '1024px', maxHeight: '80vh' } : { ...baseStyles, width: '1024px', height: '768px', maxWidth: '90vw' };
  };

  const handleOrientationLockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onUpdatePlayground) {
          const newLock = e.target.value as 'portrait' | 'landscape' | 'none';
          onUpdatePlayground({ ...playground, orientationLock: newLock });
          if (newLock !== 'none') setViewOrientation(newLock);
      }
  };

  const stripHtml = (html: any) => typeof html === 'string' ? html.replace(/<[^>]*>?/gm, '') : '';

  return (
    <div className="fixed inset-0 z-[1500] bg-black/90 text-white flex flex-col animate-in fade-in duration-300">
      
      {showRotatePrompt && (
          <div className="fixed inset-0 z-1600 bg-black/95 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in">
              <RotateCw className="w-16 h-16 mb-6 text-orange-500" />
              <h2 className="text-2xl font-black uppercase tracking-widest mb-4">PLEASE ROTATE DEVICE</h2>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">THIS ZONE REQUIRES {playground.orientationLock} ORIENTATION</p>
          </div>
      )}

      {/* EDITOR TOOLBAR */}
      {mode === GameMode.EDIT && (
          <div className="bg-slate-900 border-b border-orange-500/30 p-2 flex flex-wrap gap-4 items-center justify-between z-30 shrink-0">
              <div className="flex items-center gap-4">
                  <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                      <button onClick={() => setViewDevice('mobile')} className={`p-2 rounded ${viewDevice === 'mobile' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}><Smartphone className="w-4 h-4" /></button>
                      <button onClick={() => setViewDevice('tablet')} className={`p-2 rounded ${viewDevice === 'tablet' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}><Tablet className="w-4 h-4" /></button>
                  </div>
                  <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                      <button onClick={() => setViewOrientation('portrait')} className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${viewOrientation === 'portrait' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}>PORTRAIT</button>
                      <button onClick={() => setViewOrientation('landscape')} className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${viewOrientation === 'landscape' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}>LANDSCAPE</button>
                  </div>
                  <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                      <button onClick={handleZoomOut} className="p-1.5 text-slate-400 hover:text-white"><ZoomOut className="w-4 h-4" /></button>
                      <button onClick={handleResetZoom} className="p-1.5 text-slate-400 hover:text-white"><Maximize className="w-4 h-4" /></button>
                      <button onClick={handleZoomIn} className="p-1.5 text-slate-400 hover:text-white"><ZoomIn className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                      <Lock className="w-3 h-3 text-orange-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">LOCK:</span>
                      <select value={playground.orientationLock || 'none'} onChange={handleOrientationLockChange} className="bg-slate-900 text-white text-xs font-bold border border-slate-600 rounded px-2 py-1 outline-none focus:border-orange-500 uppercase">
                          <option value="none">NONE</option>
                          <option value="portrait">PORTRAIT</option>
                          <option value="landscape">LANDSCAPE</option>
                      </select>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <button onClick={onEditPlayground} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg transition-colors border border-blue-500">
                      <Edit2 className="w-4 h-4" /> EDIT LAYOUT
                  </button>
                  <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white border border-slate-700"><X className="w-5 h-5" /></button>
              </div>
          </div>
      )}

      {mode !== GameMode.EDIT && (
          <div className="p-4 bg-black/60 backdrop-blur-md absolute top-0 left-0 right-0 z-20 flex justify-between items-center border-b border-white/10 pointer-events-none">
              <div className="pointer-events-auto flex flex-col items-start min-w-[150px]">
                  <h2 className="text-xl font-black uppercase tracking-widest text-white shadow-sm">{playground.title}</h2>
              </div>
              {mode === GameMode.PLAY && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none animate-pulse z-30">
                      <MousePointerClick className="w-8 h-8 text-orange-400 drop-shadow-lg" />
                      <p className="text-4xl font-black text-orange-400 uppercase tracking-[0.2em] drop-shadow-xl shadow-black leading-none">CLICK TO PLAY</p>
                  </div>
              )}
              <div className="flex gap-2 pointer-events-auto">
                  {/* Mute Button if Audio Active */}
                  {audioRef.current && (
                      <button onClick={toggleMute} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all mr-2 border border-white/20">
                          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-green-400" />}
                      </button>
                  )}
                  <button onClick={handleZoomIn} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><ZoomIn className="w-5 h-5 text-white" /></button>
                  <button onClick={handleZoomOut} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><ZoomOut className="w-5 h-5 text-white" /></button>
                  <button onClick={handleResetZoom} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><Maximize className="w-5 h-5 text-white" /></button>
                  <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all ml-2"><X className="w-6 h-6 text-white" /></button>
              </div>
          </div>
      )}

      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden flex items-center justify-center ${mode === GameMode.EDIT ? 'bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]' : 'bg-slate-900'} touch-none`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
          <div style={getContainerStyle()}>
              {playground.imageUrl ? (
                  <div className="absolute inset-0 bg-center bg-no-repeat" style={{ backgroundImage: `url(${playground.imageUrl})`, backgroundSize: playground.backgroundStyle === 'stretch' ? '100% 100%' : (playground.backgroundStyle === 'cover' ? 'cover' : 'contain'), backgroundPosition: 'center', backgroundRepeat: 'no-repeat', pointerEvents: 'none' }} />
              ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-black uppercase tracking-widest text-2xl pointer-events-none">NO BACKGROUND IMAGE</div>
              )}

              {playgroundPoints.map(point => {
                  const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                  const isUnlocked = point.isUnlocked || mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR;
                  const isCompleted = point.isCompleted;
                  const isHovered = hoveredPointId === point.id;
                  const x = point.playgroundPosition?.x || 50;
                  const y = point.playgroundPosition?.y || 50;
                  const scale = point.playgroundScale || 1;
                  const questionText = stripHtml(point.task.question);
                  const isOptionsType = ['multiple_choice', 'checkbox', 'dropdown', 'multi_select_dropdown'].includes(point.task.type);
                  const showLabel = playground.showLabels !== false;

                  return (
                      <button
                          key={point.id}
                          onClick={(e) => { e.stopPropagation(); onPointClick(point); }}
                          onPointerDown={(e) => e.stopPropagation()} 
                          onMouseEnter={() => mode === GameMode.INSTRUCTOR && setHoveredPointId(point.id)}
                          onMouseLeave={() => mode === GameMode.INSTRUCTOR && setHoveredPointId(null)}
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group flex flex-col items-center ${isUnlocked ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-not-allowed opacity-50 grayscale'}`}
                          style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) scale(${scale})`, zIndex: isHovered ? 100 : 10 }}
                      >
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-4 relative ${isCompleted ? 'bg-green-500 border-green-300' : isUnlocked ? 'bg-white border-orange-500' : 'bg-slate-700 border-slate-500'}`}>
                              {isCompleted ? <CheckCircle className="w-8 h-8 text-white" /> : !isUnlocked ? <Lock className="w-6 h-6 text-slate-400" /> : <Icon className="w-8 h-8 text-orange-600" />}
                              {mode === GameMode.EDIT && point.isHiddenBeforeScan && <div className="absolute -top-1 -left-1 w-6 h-6 bg-purple-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg"><EyeOff className="w-3 h-3 text-white" /></div>}
                              {mode === GameMode.EDIT && (point.logic?.onOpen?.length || point.logic?.onCorrect?.length) && <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />}
                          </div>

                          {/* CONDITIONAL LABEL RENDERING */}
                          {showLabel && (
                              <div className={`mt-3 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.05em] shadow-2xl whitespace-nowrap max-w-[180px] truncate border-2 backdrop-blur-md transition-colors ${isCompleted ? 'bg-green-600/90 text-white border-green-400/50' : isUnlocked ? 'bg-black/80 text-white border-white/20' : 'bg-slate-800/80 text-slate-400 border-slate-600/50'}`}>
                                  {point.title}
                              </div>
                          )}

                          {isHovered && mode === GameMode.INSTRUCTOR && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-[100] min-w-[220px] max-w-[280px] pointer-events-none">
                                  <div className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                                      <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800 relative z-10">
                                          <span className="font-black text-xs uppercase text-gray-900 dark:text-white truncate max-w-[140px]">{point.title}</span>
                                      </div>
                                      <div className="flex gap-2 items-start">
                                          <HelpCircle className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                                          <span className="text-[10px] leading-tight text-gray-600 dark:text-gray-300 font-medium whitespace-pre-wrap line-clamp-3">{questionText || "No question text"}</span>
                                      </div>
                                      {isOptionsType && point.task.options && point.task.options.length > 0 ? (
                                          <div className="flex flex-col gap-1 mt-1 border-t border-gray-100 dark:border-gray-800 pt-2">
                                              {point.task.options.map((opt, i) => {
                                                  const isCorrect = (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') ? point.task.correctAnswers?.includes(opt) : point.task.answer === opt;
                                                  return <div key={i} className={`flex items-start gap-1.5 text-[9px] px-1.5 py-1 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold border border-green-200 dark:border-green-800/30' : 'text-gray-500 dark:text-gray-400'}`}>{isCorrect ? <CheckCircle className="w-3 h-3 shrink-0 mt-[1px]" /> : <div className="w-3 h-3 shrink-0" />}<span className="leading-tight">{opt}</span></div>;
                                              })}
                                          </div>
                                      ) : (
                                          <div className="flex gap-2 items-start bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-800/30">
                                              <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                                              <span className="text-[10px] font-bold text-green-700 dark:text-green-300 leading-tight">{point.task.type === 'slider' ? `Target: ${point.task.range?.correctValue} (Range: ${point.task.range?.min}-${point.task.range?.max})` : (point.task.answer || "No answer set")}</span>
                                          </div>
                                      )}
                                  </div>
                                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-gray-900 rotate-45 border-b border-r border-gray-200 dark:border-gray-700"></div>
                              </div>
                          )}
                      </button>
                  );
              })}
          </div>
      </div>
    </div>
  );
};

export default PlaygroundModal;
