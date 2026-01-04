import React, { useState, useEffect, useRef } from 'react';
import { Game, Playground, GamePoint, DeviceType } from '../types';
import { DEVICE_SPECS, getDeviceLayout } from '../utils/deviceUtils';
import { X, Home, QrCode, Trophy } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import TaskModal from './TaskModal';
import QRScannerModal from './QRScannerModal';

interface PlayzoneGameViewProps {
  game: Game;
  playgroundId: string;
  isInstructor: boolean;
  onTaskComplete: (taskId: string) => void;
  onClose: () => void;
  showScores: boolean;
  currentScore: number;
}

/**
 * PlayzoneGameView - Canvas-only rendering for gameplay mode
 * Extracts and displays ONLY the interactive game canvas (content inside device borders)
 * Used in Instructor and Teamplay modes to provide a clean gameplay experience
 */
const PlayzoneGameView: React.FC<PlayzoneGameViewProps> = ({
  game,
  playgroundId,
  isInstructor,
  onTaskComplete,
  onClose,
  showScores,
  currentScore
}) => {
  // Find the active playground
  const activePlayground = game.playgrounds?.find(pg => pg.id === playgroundId);
  
  // Auto-detect device type based on viewport
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>(() => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  });

  // Responsive device detection
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) setSelectedDevice('mobile');
      else if (width < 1024) setSelectedDevice('tablet');
      else setSelectedDevice('desktop');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get device layout for current device
  const deviceLayout = activePlayground?.deviceLayouts?.[selectedDevice] || null;
  const specs = DEVICE_SPECS[selectedDevice];

  // QR Scanner state
  const [isQRScannerActive, setIsQRScannerActive] = useState(false);
  
  // Task interaction state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [touchedTaskId, setTouchedTaskId] = useState<string | null>(null); // Visual feedback

  // Double-tap tracking (only in instructor mode)
  const lastTapRef = useRef<{ taskId: string; timestamp: number } | null>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get tasks for this playground
  const playgroundTasks = game.points?.filter(p => p.playgroundId === playgroundId) || [];

  // Get position for a task from device layout
  const getTaskPosition = (task: GamePoint) => {
    const pos = deviceLayout?.iconPositions?.[task.id];
    if (pos) {
      return { x: pos.x, y: pos.y };
    }
    // Fallback to center
    return { x: 50, y: 50 };
  };

  // Get QR scanner configuration
  const qrScannerPos = deviceLayout?.qrScannerPos || { x: 85, y: 85 };
  const qrScannerSize = deviceLayout?.qrScannerSize || { width: 140, height: 48 };
  const qrScannerColor = deviceLayout?.qrScannerColor || '#f97316';
  const showQRScanner = activePlayground?.showQRScanner !== false;

  // Title text configuration
  const showTitleText = activePlayground?.showTitleText || false;
  const titleTextContent = activePlayground?.titleTextContent || '';
  const titleTextPos = activePlayground?.titleTextPos || { x: 50, y: 10 };
  const titleTextColor = activePlayground?.titleTextColor || '#ffffff';
  const titleTextFontSize = activePlayground?.titleTextFontSize || 28;

  // Background styling
  const bgStyle: React.CSSProperties = {
    backgroundImage: activePlayground?.imageUrl ? `url(${activePlayground.imageUrl})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    width: '100%',
    height: '100%'
  };

  // Viewport dimensions
  const viewportDims = specs ? {
    width: specs.width,
    height: specs.height,
    aspectRatio: `${specs.width} / ${specs.height}`
  } : { width: '100%', height: '100%', aspectRatio: 'auto' };

  // Cleanup tap timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  // Handle task click/tap with double-tap detection in instructor mode
  const handleTaskClick = (task: GamePoint) => {
    // Provide visual feedback
    setTouchedTaskId(task.id);

    if (isInstructor) {
      // Instructor mode: require double-tap to open task
      const now = Date.now();
      const isDoubleTap = lastTapRef.current &&
                          lastTapRef.current.taskId === task.id &&
                          now - lastTapRef.current.timestamp < 300;

      if (isDoubleTap) {
        // Double-tap detected: open task modal
        if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
        setActiveTaskId(task.id);
        lastTapRef.current = null;
      } else {
        // First tap: record it and set timeout to reset
        lastTapRef.current = { taskId: task.id, timestamp: now };

        if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = setTimeout(() => {
          lastTapRef.current = null;
        }, 300);
      }
    } else {
      // Non-instructor mode: single tap opens task
      setTimeout(() => {
        setActiveTaskId(task.id);
        setTouchedTaskId(null);
      }, 100);
    }

    setTimeout(() => {
      setTouchedTaskId(null);
    }, 100);
  };

  // Handle task completion
  const handleTaskClose = (completed: boolean, taskId: string) => {
    setActiveTaskId(null);
    if (completed) {
      onTaskComplete(taskId);
    }
  };

  // Handle QR scan
  const handleQRScan = (value: string) => {
    setIsQRScannerActive(false);
    
    // Find task with matching QR code
    const task = playgroundTasks.find(t => 
      t.qrCodeString === value || 
      t.nfcTagId === value || 
      t.ibeaconUUID === value
    );
    
    if (task) {
      handleTaskClick(task);
    }
  };

  if (!activePlayground) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl font-bold">Playzone not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-xl font-bold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const activeTask = playgroundTasks.find(t => t.id === activeTaskId);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505] flex flex-col">
      {/* Top Bar - Minimal HUD */}
      <div className="h-14 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            title="Back"
          >
            <Home className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-white truncate max-w-xs">
            {activePlayground.title || 'Playzone'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {showScores && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-600/20 border border-orange-600/50 rounded-lg">
              <Trophy className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-black text-orange-400">{currentScore}</span>
            </div>
          )}
          
          {isInstructor && (
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
              Instructor View
            </span>
          )}
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {/* Device Frame Scaling Wrapper */}
        <div
          className="flex items-center justify-center"
          style={{
            transform: selectedDevice === 'tablet' ? 'scale(0.85)' : 'scale(1)',
            transformOrigin: 'center center',
            transition: 'transform 0.3s ease-out',
            width: selectedDevice === 'desktop' ? '100%' : 'auto',
            height: selectedDevice === 'desktop' ? '100%' : 'auto'
          }}
        >
          {/* Device Frame Container */}
          <div
            className="relative border-8 border-slate-950 rounded-3xl overflow-hidden flex-shrink-0"
            style={{
              width: viewportDims.width,
              height: viewportDims.height,
              boxShadow: '0 0 0 12px #1f2937, 0 0 0 16px #000000, inset 0 0 0 1px #444'
            }}
          >
            {/* Background Canvas */}
            <div
              style={bgStyle}
              className="relative w-full h-full"
            >
              {/* No background placeholder for gameplay */}
              {!activePlayground.imageUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-2xl font-black text-slate-700 uppercase tracking-widest">
                    No Background
                  </p>
                </div>
              )}

              {/* Tasks on Canvas */}
              {playgroundTasks.map((task) => {
                const Icon = ICON_COMPONENTS[task.iconId] || ICON_COMPONENTS.default;
                const displaySize = (task.playgroundScale || 1) * 48;
                const position = getTaskPosition(task);
                const isTouched = touchedTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      transform: isTouched ? 'translate(-50%, -50%) scale(0.95)' : 'translate(-50%, -50%)',
                      transition: 'transform 0.1s ease'
                    }}
                    onClick={() => handleTaskClick(task)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setTouchedTaskId(task.id);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleTaskClick(task);
                    }}
                  >
                    {/* Task Icon Circle */}
                    <div
                      className="rounded-full flex items-center justify-center border-4 shadow-2xl transition-all group-hover:scale-110 group-active:scale-95"
                      style={{
                        width: displaySize,
                        height: displaySize,
                        backgroundColor: task.colorScheme?.primary || '#f97316',
                        borderColor: task.colorScheme?.secondary || '#ffffff',
                      }}
                    >
                      <Icon
                        className="text-white"
                        style={{
                          width: displaySize * 0.5,
                          height: displaySize * 0.5
                        }}
                      />
                    </div>

                    {/* Task Title (on hover/touch) */}
                    {task.title && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-black/80 text-white text-xs font-bold px-3 py-1 rounded-lg">
                          {task.title}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* QR Scanner Button */}
              {showQRScanner && (
                <div
                  className="absolute"
                  style={{
                    left: `${qrScannerPos.x}%`,
                    top: `${qrScannerPos.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <button
                    onClick={() => setIsQRScannerActive(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform"
                    style={{
                      backgroundColor: qrScannerColor,
                      width: qrScannerSize.width,
                      height: qrScannerSize.height
                    }}
                  >
                    <QrCode className="w-6 h-6" />
                    <span className="text-sm">SCAN</span>
                  </button>
                </div>
              )}

              {/* Title Text Overlay */}
              {showTitleText && titleTextContent && (
                <div
                  className="absolute flex items-center justify-center pointer-events-none"
                  style={{
                    left: `${titleTextPos.x}%`,
                    top: `${titleTextPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    color: titleTextColor,
                    fontSize: titleTextFontSize,
                    fontWeight: 'bold',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {titleTextContent}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {activeTask && (
        <TaskModal
          point={activeTask}
          onClose={(completed) => handleTaskClose(completed || false, activeTask.id)}
          onEdit={() => {}} // No editing in gameplay mode
          canEdit={false} // Disable editing
        />
      )}

      {/* QR Scanner Modal */}
      {isQRScannerActive && (
        <QRScannerModal
          onScan={handleQRScan}
          onClose={() => setIsQRScannerActive(false)}
        />
      )}
    </div>
  );
};

export default PlayzoneGameView;
