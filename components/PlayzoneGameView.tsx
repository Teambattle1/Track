import React, { useState, useEffect, useRef } from 'react';
import { Game, Playground, GamePoint, DeviceType } from '../types';
import { DEVICE_SPECS, getDeviceLayout } from '../utils/deviceUtils';
import { X, Home, QrCode, Trophy, Settings, MessageSquare, Users, Map, MapPin, Info, CheckCircle, XCircle, Compass, Maximize2 } from 'lucide-react';
import { ICON_COMPONENTS } from '../utils/icons';
import TaskModal from './TaskModal';
import QRScannerModal from './QRScannerModal';
import { teamSync } from '../services/teamSync';

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
 * Team View features:
 * - Orange header bar with timer (center), score (right), settings cogwheel (left)
 * - Permanent orange toolbox with Team Lobby and Chat buttons
 * - Lenovo Tab 8 landscape as default for tablets
 * - Password-protected settings modal (code: 4027)
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
  
  // For team view: default to tablet (Lenovo Tab 8), for instructor: auto-detect
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>(() => {
    if (isInstructor) {
      const width = window.innerWidth;
      if (width < 768) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    }
    // Team view defaults to tablet (Lenovo Tab 8) but respects viewport
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1440) return 'tablet'; // Wider range for tablet
    return 'desktop';
  });

  // Responsive device detection
  useEffect(() => {
    const handleResize = () => {
      if (isInstructor) {
        const width = window.innerWidth;
        if (width < 768) setSelectedDevice('mobile');
        else if (width < 1024) setSelectedDevice('tablet');
        else setSelectedDevice('desktop');
      } else {
        // Team view
        const width = window.innerWidth;
        if (width < 768) setSelectedDevice('mobile');
        else if (width < 1440) setSelectedDevice('tablet');
        else setSelectedDevice('desktop');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInstructor]);

  // Get device layout for current device
  const deviceLayout = activePlayground?.deviceLayouts?.[selectedDevice] || null;
  const specs = DEVICE_SPECS[selectedDevice];

  // QR Scanner state
  const [isQRScannerActive, setIsQRScannerActive] = useState(false);
  
  // Task interaction state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [touchedTaskId, setTouchedTaskId] = useState<string | null>(null);

  // Double-tap tracking (instructor mode) and ranking reveal (team mode)
  const lastTapRef = useRef<{ taskId: string; timestamp: number } | null>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scoreDoubleClickRef = useRef<number>(0);

  // Team View state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsPasswordError, setSettingsPasswordError] = useState('');
  const [showRanking, setShowRanking] = useState(false);
  const [gameTime, setGameTime] = useState<string>('00:00');
  const [selectedMapStyle, setSelectedMapStyle] = useState<'standard' | 'satellite'>(() => {
    return game.defaultMapStyle === 'satellite' ? 'satellite' : 'standard';
  });
  const [showMapStyleInfo, setShowMapStyleInfo] = useState(false);

  // Timer for team view
  useEffect(() => {
    if (isInstructor || !game.timerConfig || game.timerConfig.mode === 'none') {
      return;
    }

    const updateTimer = () => {
      let target: number | null = null;

      if (game.timerConfig?.mode === 'scheduled_end' && game.timerConfig?.endTime) {
        target = new Date(game.timerConfig.endTime).getTime();
      }
      
      if (target) {
        const now = Date.now();
        const diff = target - now;
        if (diff <= 0) {
          setGameTime('00:00');
        } else {
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setGameTime(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [game.timerConfig, isInstructor]);

  // Get tasks for this playground
  const playgroundTasks = game.points?.filter(p => p.playgroundId === playgroundId) || [];

  // Get position for a task from device layout
  const getTaskPosition = (task: GamePoint) => {
    const pos = deviceLayout?.iconPositions?.[task.id];
    if (pos) {
      return { x: pos.x, y: pos.y };
    }
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

  // Handle settings password submission
  const handleSettingsPasswordSubmit = () => {
    if (settingsPassword === '4027') {
      setShowSettingsModal(false);
      setSettingsPassword('');
      setSettingsPasswordError('');
      // Return to editor mode
      onClose();
    } else {
      setSettingsPasswordError('Incorrect password');
      setSettingsPassword('');
    }
  };

  // Handle score double-click to reveal ranking
  const handleScoreClick = () => {
    if (!isInstructor) {
      scoreDoubleClickRef.current += 1;
      if (scoreDoubleClickRef.current >= 2) {
        setShowRanking(true);
        scoreDoubleClickRef.current = 0;
        setTimeout(() => setShowRanking(false), 3000);
      } else {
        setTimeout(() => {
          scoreDoubleClickRef.current = 0;
        }, 300);
      }
    }
  };

  // Handle task click/tap with double-tap detection in instructor mode
  const handleTaskClick = (task: GamePoint) => {
    setTouchedTaskId(task.id);

    if (isInstructor) {
      const now = Date.now();
      const isDoubleTap = lastTapRef.current &&
                          lastTapRef.current.taskId === task.id &&
                          now - lastTapRef.current.timestamp < 300;

      if (isDoubleTap) {
        if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
        setActiveTaskId(task.id);
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { taskId: task.id, timestamp: now };

        if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = setTimeout(() => {
          lastTapRef.current = null;
        }, 300);
      }
    } else {
      // Team mode: single tap opens task
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
      {/* Team View: Orange Header Bar */}
      {!isInstructor && (() => {
        const teamState = teamSync.getState();
        const teamMembers = teamSync.getAllMembers();
        const allTasks = playgroundTasks;
        const correctTasks = allTasks.filter(t => t.isCompleted && !t.isSectionHeader).length;
        const totalTasks = allTasks.filter(t => !t.isSectionHeader).length;
        const incorrectTasks = totalTasks - correctTasks;

        return (
        <div className="h-16 bg-orange-600 border-b-2 border-orange-700 flex items-center justify-between px-6 shadow-lg">
          {/* Settings Cogwheel (Left) */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 hover:bg-orange-700 rounded-lg transition-colors text-white hover:scale-110"
            title="Settings"
          >
            <Settings className="w-6 h-6" />
          </button>

          {/* Divider */}
          <div className="h-8 w-px bg-orange-700/60 mx-3"></div>

          {/* Team Info */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white/80 uppercase tracking-wide">Team</span>
              <span className="text-lg font-black text-white">{teamState.teamName || 'Team'}</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-orange-700/50 rounded-lg">
              <Users className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-bold text-white">{teamMembers.length}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-orange-700/60 mx-3"></div>

          {/* Timer (Center) */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-white/80 uppercase tracking-wide">Game Time</span>
            <span className="text-3xl font-black text-white font-mono">{gameTime}</span>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-orange-700/60 mx-3"></div>

          {/* Task Progress + Score */}
          <div className="flex items-center gap-3">
            {/* Task Progress */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-green-600/40 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold text-green-300">{correctTasks}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-red-600/40 rounded-lg">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-300">{incorrectTasks}</span>
              </div>
            </div>

            {/* Score */}
            <button
              onClick={handleScoreClick}
              className="flex items-center gap-2 px-4 py-2 bg-orange-700/50 hover:bg-orange-700 rounded-xl transition-colors"
              title={showRanking ? 'Ranking Revealed' : 'Double-click to see ranking'}
            >
              <Trophy className="w-5 h-5 text-yellow-300" />
              <span className="text-lg font-black text-white">{currentScore}</span>
            </button>
          </div>
        </div>
        );
      })()}

      {/* Instructor Header (Simpler) */}
      {isInstructor && (
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
            
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
              Instructor View
            </span>
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
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

        {/* Center Map Button (Right Side) */}
        {!isInstructor && (
          <button
            onClick={() => {
              // Center map functionality - scroll/pan to center
              const canvas = document.querySelector('[style*="aspect-ratio"]');
              if (canvas?.parentElement?.parentElement) {
                canvas.parentElement.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
              }
            }}
            className="absolute right-6 bottom-24 p-3 bg-orange-600 hover:bg-orange-700 text-white rounded-full shadow-lg transition-all hover:scale-110 active:scale-95"
            title="Center Map"
          >
            <MapPin className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Team View: Orange Toolbox (Bottom) */}
      {!isInstructor && (
        <div className="h-16 bg-orange-600 border-t-2 border-orange-700 flex items-center justify-center gap-4 px-6 shadow-lg">
          <button
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-700 hover:bg-orange-800 rounded-xl font-bold text-white transition-colors shadow-lg"
            title="Team Lobby"
          >
            <Users className="w-5 h-5" />
            <span>TEAM LOBBY</span>
          </button>

          <button
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-700 hover:bg-orange-800 rounded-xl font-bold text-white transition-colors shadow-lg"
            title="Chat"
          >
            <MessageSquare className="w-5 h-5" />
            <span>CHAT</span>
          </button>

          <button
            onClick={() => setIsQRScannerActive(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-700 hover:bg-orange-800 rounded-xl font-bold text-white transition-colors shadow-lg"
            title="Scan QR Code"
          >
            <QrCode className="w-5 h-5" />
            <span>SCAN QR</span>
          </button>

          {/* Map Style Selector */}
          {!game.designConfig?.lockMapStyle ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-700/50 hover:bg-orange-700 rounded-xl transition-colors">
              <Map className="w-5 h-5 text-white" />
              <select
                value={selectedMapStyle}
                onChange={(e) => setSelectedMapStyle(e.target.value as 'standard' | 'satellite')}
                className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer"
              >
                <option value="standard">Standard</option>
                <option value="satellite">Satellite</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-700/50 rounded-xl">
              <Map className="w-5 h-5 text-white" />
              <span className="text-white font-bold text-sm">
                {selectedMapStyle === 'satellite' ? 'Satellite' : 'Standard'}
              </span>
            </div>
          )}

          {/* Map Style Info Button */}
          <div className="relative">
            <button
              onClick={() => setShowMapStyleInfo(!showMapStyleInfo)}
              className="p-2 bg-orange-700/50 hover:bg-orange-700 rounded-full transition-colors text-white"
              title="Map Style Information"
            >
              <Info className="w-5 h-5" />
            </button>

            {/* Info Tooltip */}
            {showMapStyleInfo && (
              <div className="absolute bottom-full right-0 mb-3 bg-white rounded-lg shadow-2xl p-4 max-w-xs text-sm text-gray-800 animate-in fade-in slide-in-from-bottom-2 z-50">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-gray-900 mb-1">Map Style</p>
                    <p className="text-gray-700">
                      {game.designConfig?.lockMapStyle
                        ? 'The map style is locked by the game administrator. You cannot change it.'
                        : 'Choose between Standard and Satellite views. The map style has been selected by the game administrator.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Modal */}
      {activeTask && (
        <TaskModal
          point={activeTask}
          onClose={(completed) => handleTaskClose(completed || false, activeTask.id)}
          onEdit={() => {}}
          canEdit={false}
        />
      )}

      {/* QR Scanner Modal */}
      {isQRScannerActive && (
        <QRScannerModal
          onScan={handleQRScan}
          onClose={() => setIsQRScannerActive(false)}
        />
      )}

      {/* Settings Password Modal (Team View Only) */}
      {!isInstructor && showSettingsModal && (
        <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">Settings</h2>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setSettingsPassword('');
                  setSettingsPasswordError('');
                }}
                className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Enter Password
                </label>
                <input
                  type="password"
                  value={settingsPassword}
                  onChange={(e) => {
                    setSettingsPassword(e.target.value);
                    if (settingsPasswordError) setSettingsPasswordError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSettingsPasswordSubmit();
                  }}
                  placeholder="****"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-600 font-mono text-lg tracking-widest"
                  autoFocus
                />
                {settingsPasswordError && (
                  <p className="text-red-600 text-sm font-bold mt-2">{settingsPasswordError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSettingsPassword('');
                    setSettingsPasswordError('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSettingsPasswordSubmit}
                  className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold text-white transition-colors"
                >
                  Enter Editor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ranking Reveal Banner (Team View Only) */}
      {!isInstructor && showRanking && (
        <div className="fixed inset-0 z-[10001] bg-black/40 flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
          <div className="bg-orange-600 rounded-2xl shadow-2xl p-8 text-center max-w-sm">
            <Trophy className="w-16 h-16 text-yellow-300 mx-auto mb-4" />
            <h2 className="text-3xl font-black text-white mb-2">Your Ranking</h2>
            <p className="text-4xl font-black text-yellow-300">Coming Soon...</p>
            <p className="text-white/80 text-sm mt-4">Ranking system will be available when the game master enables it</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayzoneGameView;
