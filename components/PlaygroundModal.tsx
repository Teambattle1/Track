
import React, { useState } from 'react';
import { GamePoint, Playground, GameMode } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { X, CheckCircle, Lock, Smartphone, Tablet, Monitor, RotateCw, Edit2 } from 'lucide-react';

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
  // Filter points belonging to this playground
  const playgroundPoints = points.filter(p => p.playgroundId === playground.id);
  
  // Editor view states
  const [viewDevice, setViewDevice] = useState<'mobile' | 'tablet'>('mobile');
  const [viewOrientation, setViewOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Logic to determine container style based on editor view mode
  const getContainerStyle = () => {
      if (mode !== GameMode.EDIT) return { width: '100%', height: '100%' };

      const baseStyles: React.CSSProperties = {
          position: 'relative',
          border: '12px solid #333',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 0 50px rgba(0,0,0,0.5)',
          backgroundColor: '#1e293b',
          transition: 'all 0.3s ease'
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
          onUpdatePlayground({ ...playground, orientationLock: e.target.value as any });
      }
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-black/90 text-white flex flex-col animate-in fade-in duration-300">
      
      {/* EDITOR TOOLBAR */}
      {mode === GameMode.EDIT && (
          <div className="bg-slate-900 border-b border-orange-500/30 p-2 flex flex-wrap gap-4 items-center justify-between z-30 shrink-0">
              <div className="flex items-center gap-4">
                  <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                      <button 
                          onClick={() => setViewDevice('mobile')} 
                          className={`p-2 rounded ${viewDevice === 'mobile' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          title="Mobile View"
                      >
                          <Smartphone className="w-4 h-4" />
                      </button>
                      <button 
                          onClick={() => setViewDevice('tablet')} 
                          className={`p-2 rounded ${viewDevice === 'tablet' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          title="Tablet View"
                      >
                          <Tablet className="w-4 h-4" />
                      </button>
                  </div>

                  <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                      <button 
                          onClick={() => setViewOrientation('portrait')} 
                          className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${viewOrientation === 'portrait' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                          PORTRAIT
                      </button>
                      <button 
                          onClick={() => setViewOrientation('landscape')} 
                          className={`px-3 py-1.5 rounded text-xs font-bold uppercase ${viewOrientation === 'landscape' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                          LANDSCAPE
                      </button>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                      <Lock className="w-3 h-3 text-orange-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">FORCE LOCK:</span>
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
                  <button 
                      onClick={onEditPlayground}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg transition-colors border border-blue-500"
                  >
                      <Edit2 className="w-4 h-4" /> EDIT LAYOUT
                  </button>
                  <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white border border-slate-700">
                      <X className="w-5 h-5" />
                  </button>
              </div>
          </div>
      )}

      {/* Standard Header (Hidden in Edit mode to save space/reduce clutter, or kept minimal) */}
      {mode !== GameMode.EDIT && (
          <div className="p-4 bg-black/60 backdrop-blur-md absolute top-0 left-0 right-0 z-20 flex justify-between items-center border-b border-white/10 pointer-events-none">
              <div className="pointer-events-auto">
                  <h2 className="text-xl font-black uppercase tracking-widest text-white shadow-sm">{playground.title}</h2>
                  <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wide">VIRTUAL PLAYGROUND</p>
              </div>
              <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all pointer-events-auto">
                  <X className="w-6 h-6 text-white" />
              </button>
          </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${mode === GameMode.EDIT ? 'bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]' : 'bg-slate-900'}`}>
          
          <div style={getContainerStyle()}>
              {/* Background Image */}
              {playground.imageUrl ? (
                  <div 
                    className="absolute inset-0 bg-center bg-no-repeat bg-contain" // Changed to contain to see full image
                    style={{ backgroundImage: `url(${playground.imageUrl})` }}
                  />
              ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-700 font-black uppercase tracking-widest text-2xl">
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

                  return (
                      <button
                          key={point.id}
                          onClick={() => onPointClick(point)}
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 group flex flex-col items-center ${isUnlocked ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-not-allowed opacity-50 grayscale'}`}
                          style={{ left: `${x}%`, top: `${y}%` }}
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
                              
                              {/* Logic Badge */}
                              {mode === GameMode.EDIT && (point.logic?.onOpen?.length || point.logic?.onCorrect?.length) && (
                                  <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                              )}
                          </div>

                          {/* Title Label */}
                          <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide shadow-lg whitespace-nowrap max-w-[150px] truncate ${
                              isCompleted ? 'bg-green-600 text-white' : 
                              isUnlocked ? 'bg-white text-slate-900 border-2 border-orange-500' : 'bg-slate-800 text-slate-400'
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
