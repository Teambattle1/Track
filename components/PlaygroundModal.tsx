
import React, { useState, useEffect, useRef } from 'react';
import { GamePoint, Playground, GameMode } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { X, CheckCircle, Lock, Smartphone, Tablet, Monitor, RotateCw, Edit2, Maximize, ZoomIn, ZoomOut, EyeOff } from 'lucide-react';

interface PlaygroundModalProps {
  playground: Playground;
  points: GamePoint[];
  onClose: () => void;
  onPointClick: (point: GamePoint) => void;
  mode: GameMode;
  onUpdatePlayground?: (updated: Playground) => void;
  onEditPlayground?: () => void;
}

const PlaygroundModal: React.FC<PlaygroundModalProps> = ({ playground, points, onClose, onPointClick, mode, onUpdatePlayground, onEditPlayground }) => {
  // Logic: Filter points belonging to this playground
  // Additionally: For players (not in EDIT/INSTRUCTOR mode), hide tasks marked as isHiddenBeforeScan until they are unlocked.
  const playgroundPoints = points.filter(p => {
      if (p.playgroundId !== playground.id) return false;
      
      // If in Play Mode, hide tasks that are marked "Hidden Before Scan" and are NOT yet unlocked
      if (mode === GameMode.PLAY && p.isHiddenBeforeScan && !p.isUnlocked) {
          return false;
      }
      
      return true;
  });
  
  // Editor view states
  const [viewDevice, setViewDevice] = useState<'mobile' | 'tablet'>('mobile');
  const [viewOrientation, setViewOrientation] = useState<'portrait' | 'landscape'>(
      playground.orientationLock && playground.orientationLock !== 'none' 
        ? playground.orientationLock 
        : 'portrait'
  );

  // Play Mode Orientation Check
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);

  // PAN & ZOOM STATE
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const isDraggingRef = useRef(false);

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

  // Handle Zoom (Wheel) - Enable for ALL modes
  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const scaleAmount = -e.deltaY * 0.001;
          setTransform(prev => ({ 
              ...prev, 
              scale: Math.max(0.2, Math.min(5, prev.scale * (1 + scaleAmount))) 
          }));
      };

      container.addEventListener('wheel', onWheel, { passive: false });
      return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Handle Drag (Pan)
  const handlePointerDown = (e: React.PointerEvent) => {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;
      
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      isDraggingRef.current = false;
      dragStartRef.current = null;
      (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleZoomIn = () => setTransform(t => ({...t, scale: Math.min(5, t.scale + 0.2)}));
  const handleZoomOut = () => setTransform(t => ({...t, scale: Math.max(0.2, t.scale - 0.2)}));
  const handleResetZoom = () => setTransform({x:0, y:0, scale:1});

  // Logic to determine container style based on editor view mode
  const getContainerStyle = () => {
      if (mode !== GameMode.EDIT) {
          // Play Mode: Full screen but transformed by Pan/Zoom
          return { 
              width: '100%', 
              height: '100%',
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: 'center center',
              cursor: isDraggingRef.current ? 'grabbing' : 'grab'
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
          // Apply pan zoom to the preview container in Edit Mode
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          cursor: isDraggingRef.current ? 'grabbing' : 'grab'
      };

      if (viewDevice === 'mobile') {
          if (viewOrientation === 'portrait') {
              return { ...baseStyles, width: '375px', height: '667px' }; // approx mobile
          } else {
              return { ...baseStyles, width: '667px', height: '375px' };
          }
      } else {
          // Tablet
          if (viewOrientation === 'portrait') {
              return { ...baseStyles, width: '768px', height: '1024px', maxHeight: '80vh' }; // scaled down slightly
          } else {
              return { ...baseStyles, width: '1024px', height: '768px', maxWidth: '90vw' };
          }
      }
  };

  const handleOrientationLockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onUpdatePlayground) {
          const newLock = e.target.value as 'portrait' | 'landscape' | 'none';
          onUpdatePlayground({ ...playground, orientationLock: newLock });
          if (newLock !== 'none') {
              setViewOrientation(newLock);
          }
      }
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-black/90 text-white flex flex-col animate-in fade-in duration-300">
      
      {/* Rotation Prompt Overlay for Players */}
      {showRotatePrompt && (
          <div className="fixed inset-0 z-1600 bg-black/95 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in">
              <RotateCw className="w-16 h-16 mb-6 text-orange-500" />
              <h2 className="text-2xl font-black uppercase tracking-widest mb-4">PLEASE ROTATE DEVICE</h2>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">
                  THIS ZONE REQUIRES {playground.orientationLock} ORIENTATION
              </p>
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

                  {/* Edit Mode Zoom Controls */}
                  <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                      <button onClick={handleZoomOut} className="p-1.5 text-slate-400 hover:text-white"><ZoomOut className="w-4 h-4" /></button>
                      <button onClick={handleResetZoom} className="p-1.5 text-slate-400 hover:text-white"><Maximize className="w-4 h-4" /></button>
                      <button onClick={handleZoomIn} className="p-1.5 text-slate-400 hover:text-white"><ZoomIn className="w-4 h-4" /></button>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                      <Lock className="w-3 h-3 text-orange-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">LOCK:</span>
                      <select 
                          value={playground.orientationLock || 'none'} 
                          onChange={handleOrientationLockChange}
                          className="bg-slate-900 text-white text-xs font-bold border border-slate-600 rounded px-2 py-1 outline-none focus:border-orange-500 uppercase"
                      >
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

      {/* Standard Header (Play Mode) */}
      {mode !== GameMode.EDIT && (
          <div className="p-4 bg-black/60 backdrop-blur-md absolute top-0 left-0 right-0 z-20 flex justify-between items-center border-b border-white/10 pointer-events-none">
              <div className="pointer-events-auto">
                  <h2 className="text-xl font-black uppercase tracking-widest text-white shadow-sm">{playground.title}</h2>
                  <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wide">VIRTUAL PLAYGROUND</p>
              </div>
              <div className="flex gap-2 pointer-events-auto">
                  <button onClick={handleZoomIn} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><ZoomIn className="w-5 h-5 text-white" /></button>
                  <button onClick={handleZoomOut} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><ZoomOut className="w-5 h-5 text-white" /></button>
                  <button onClick={handleResetZoom} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><Maximize className="w-5 h-5 text-white" /></button>
                  <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all ml-2"><X className="w-6 h-6 text-white" /></button>
              </div>
          </div>
      )}

      {/* Main Content Area */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden flex items-center justify-center ${mode === GameMode.EDIT ? 'bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]' : 'bg-slate-900'} touch-none`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
          <div style={getContainerStyle()}>
              {/* Background Image */}
              {playground.imageUrl ? (
                  <div 
                    className="absolute inset-0 bg-center bg-no-repeat"
                    style={{ 
                        backgroundImage: `url(${playground.imageUrl})`,
                        backgroundSize: playground.backgroundStyle === 'stretch' ? '100% 100%' : (playground.backgroundStyle === 'cover' ? 'cover' : 'contain'),
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        pointerEvents: 'none'
                    }}
                  />
              ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-black uppercase tracking-widest text-2xl pointer-events-none">
                      NO BACKGROUND IMAGE
                  </div>
              )}

              {/* Points */}
              {playgroundPoints.map(point => {
                  const Icon = ICON_COMPONENTS[point.iconId] || ICON_COMPONENTS.default;
                  const isUnlocked = point.isUnlocked || mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR;
                  const isCompleted = point.isCompleted;
                  
                  const x = point.playgroundPosition?.x || 50;
                  const y = point.playgroundPosition?.y || 50;
                  const scale = point.playgroundScale || 1;

                  return (
                      <button
                          key={point.id}
                          onClick={(e) => { e.stopPropagation(); onPointClick(point); }}
                          onPointerDown={(e) => e.stopPropagation()} // Stop propagation to container PAN logic
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group flex flex-col items-center ${isUnlocked ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-not-allowed opacity-50 grayscale'}`}
                          style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) scale(${scale})` }}
                      >
                          {/* Icon Bubble */}
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-4 relative ${
                              isCompleted ? 'bg-green-500 border-green-300' : 
                              isUnlocked ? 'bg-white border-orange-500' : 'bg-slate-700 border-slate-500'
                          }`}>
                              {isCompleted ? (
                                  <CheckCircle className="w-8 h-8 text-white" />
                              ) : !isUnlocked ? (
                                  <Lock className="w-6 h-6 text-slate-400" />
                              ) : (
                                  <Icon className="w-8 h-8 text-orange-600" />
                              )}
                              
                              {/* Editor Badge: Hidden Status */}
                              {mode === GameMode.EDIT && point.isHiddenBeforeScan && (
                                  <div className="absolute -top-1 -left-1 w-6 h-6 bg-purple-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg" title="Hidden until Scan">
                                      <EyeOff className="w-3 h-3 text-white" />
                                  </div>
                              )}

                              {mode === GameMode.EDIT && (point.logic?.onOpen?.length || point.logic?.onCorrect?.length) && (
                                  <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                              )}
                          </div>

                          {/* Title Label - ALWAYS VISIBLE, HIGH CONTRAST PILL */}
                          <div className={`mt-3 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.05em] shadow-2xl whitespace-nowrap max-w-[180px] truncate border-2 backdrop-blur-md transition-colors ${
                              isCompleted ? 'bg-green-600/90 text-white border-green-400/50' : 
                              isUnlocked ? 'bg-black/80 text-white border-white/20' : 'bg-slate-800/80 text-slate-400 border-slate-600/50'
                          }`}>
                              {point.title}
                          </div>
                      </button>
                  );
              })}
          </div>
      </div>
    </div>
  );
};

export default PlaygroundModal;
