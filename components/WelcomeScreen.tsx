import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game, Coordinate, MapStyleId, Language, TeamMember, Team } from '../types';
import { haversineMeters } from '../utils/geo';
import { t } from '../utils/i18n';
import { Camera, MapPin, CheckCircle, XCircle, Users, PlayCircle, Loader2, Languages, QrCode, Mic, HardDrive, Lock, Info, AlertTriangle, Hammer, User, ScanLine, ArrowLeft, Trophy, Share2, Home, RotateCcw, Keyboard, Copy, X, HelpCircle } from 'lucide-react';
import jsQR from 'jsqr';
import { teamSync } from '../services/teamSync';
import * as db from '../services/db';

interface WelcomeScreenProps {
  games: Game[];
  userLocation: Coordinate | null;
  onStartGame: (gameId: string, teamName: string, userName: string, mapStyle: MapStyleId) => void;
  onSetMapStyle: (style: MapStyleId) => void;
  language: Language;
  onSetLanguage: (lang: Language) => void;
  onOpenEditor?: () => void;
  onBack?: () => void;
}

type ViewStep = 'CHOICE' | 'JOIN_OPTIONS' | 'JOIN_SCAN' | 'MAKE_TEAM' | 'TEAM_LOBBY' | 'TAKE_PHOTO';

// Helper to generate deterministic 6-digit code from team name
const getJoinCode = (name: string): string => {
    if (!name) return '000000';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const code = Math.abs(hash) % 900000 + 100000;
    return code.toString();
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
    games, 
    userLocation, 
    onStartGame, 
    onSetMapStyle,
    language,
    onSetLanguage,
    onOpenEditor,
    onBack
}) => {
  const [viewStep, setViewStep] = useState<ViewStep>('CHOICE');
  
  // Game Data
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [teamName, setTeamName] = useState('');
  const [teamJoinCode, setTeamJoinCode] = useState(''); // Store manual entry code
  const [playerName, setPlayerName] = useState('');
  const [teamPhoto, setTeamPhoto] = useState<string | null>(null); // Base64
  
  // Teams Popup
  const [showTeamsPopup, setShowTeamsPopup] = useState(false);
  const [existingTeams, setExistingTeams] = useState<Team[]>([]);
  
  // QR Scan / Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [joinMethod, setJoinMethod] = useState<'SCAN' | 'MANUAL'>('SCAN');
  const [scanError, setScanError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isJoining, setIsJoining] = useState(false);
  
  // Confirmation Modal
  const [pendingJoinTeam, setPendingJoinTeam] = useState<{name: string, gameId: string} | null>(null);

  // Lobby State
  const [lobbyMembers, setLobbyMembers] = useState<TeamMember[]>([]);
  
  // Checks
  const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [storagePermission, setStoragePermission] = useState<'granted' | 'denied'>('denied');
  
  const [permissionHelp, setPermissionHelp] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  // Filter games based on Date (Today) and Range (10km)
  const relevantGames = useMemo(() => {
      // If no location, we can't verify range, so return empty or potentially all if we wanted fallback
      if (!userLocation) return [];

      const today = new Date();
      today.setHours(0,0,0,0);

      return games.filter(g => {
          // 1. Date Check (Created Today)
          const gDate = new Date(g.createdAt);
          gDate.setHours(0,0,0,0);
          const isToday = gDate.getTime() === today.getTime();
          
          if (!isToday) return false;

          // 2. Range Check (10km)
          if (g.points.length === 0) return false; // Game has no location definition
          
          // Calculate center of game points
          const center = {
              lat: g.points.reduce((sum, p) => sum + p.location.lat, 0) / g.points.length,
              lng: g.points.reduce((sum, p) => sum + p.location.lng, 0) / g.points.length,
          };
          
          const dist = haversineMeters(userLocation, center);
          return dist <= 10000; // 10,000 meters
      });
  }, [games, userLocation]);

  useEffect(() => {
    // Detect iOS
    const isIOSCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSCheck);

    // Check Geo
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
            setGeoPermission(result.state);
            result.onchange = () => setGeoPermission(result.state);
        });
        
        // Check Camera Permission (Best Effort)
        navigator.permissions.query({ name: 'camera' as any }).then(result => {
            setCameraPermission(result.state as any);
            result.onchange = () => setCameraPermission(result.state as any);
        }).catch(() => {
            setCameraPermission('prompt');
        });
    } else {
        setCameraPermission('prompt');
    }
    
    // Check Storage
    try {
        localStorage.setItem('geohunt_test', '1');
        localStorage.removeItem('geohunt_test');
        setStoragePermission('granted');
    } catch(e) {
        setStoragePermission('denied');
    }
    
    // Recover player name
    const savedName = localStorage.getItem('geohunt_player_name');
    if (savedName) setPlayerName(savedName);

    // Auto-select nearby game
    if (relevantGames.length > 0 && !selectedGameId) {
        setSelectedGameId(relevantGames[0].id);
    }
  }, [userLocation, games, relevantGames]);

  // Load teams when popup opens
  useEffect(() => {
      if (showTeamsPopup && selectedGameId) {
          db.fetchTeams(selectedGameId).then(setExistingTeams);
      }
  }, [showTeamsPopup, selectedGameId]);

  // QR Scanning & Camera Logic
  useEffect(() => {
      let animationFrameId: number;
      let currentStream: MediaStream | null = null;

      const scanTick = () => {
          // If modal is open, pause scanning logic
          if (pendingJoinTeam) {
              animationFrameId = requestAnimationFrame(scanTick);
              return;
          }

          if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  canvas.height = video.videoHeight;
                  canvas.width = video.videoWidth;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Only scan if in JOIN_SCAN mode
                  if (viewStep === 'JOIN_SCAN' && !pendingJoinTeam) {
                      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

                      if (code) {
                          try {
                              const data = JSON.parse(code.data);
                              if (data.action === 'join_team' && data.team && data.gameId) {
                                  setPendingJoinTeam({ name: data.team, gameId: data.gameId });
                                  setIsScanning(false);
                              }
                          } catch (e) {}
                      }
                  }
              }
          }
          if ((isScanning && joinMethod === 'SCAN') || viewStep === 'TAKE_PHOTO') {
              animationFrameId = requestAnimationFrame(scanTick);
          }
      };

      const startCamera = async () => {
          try {
              // Ensure any previous stream is stopped
              if (currentStream) {
                  (currentStream as MediaStream).getTracks().forEach(t => t.stop());
              }
              if (videoRef.current && videoRef.current.srcObject) {
                  (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
              }

              // Try requesting with facing mode first
              let stream: MediaStream;
              try {
                  stream = await navigator.mediaDevices.getUserMedia({ 
                      video: { facingMode: facingMode } 
                  });
              } catch (specificError) {
                  console.warn("Failed to get specific camera, trying fallback", specificError);
                  // Fallback to any camera
                  stream = await navigator.mediaDevices.getUserMedia({ 
                      video: true 
                  });
              }
              
              currentStream = stream;

              if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                  videoRef.current.setAttribute("playsinline", "true");
                  await videoRef.current.play();
                  requestAnimationFrame(scanTick);
              }
              setScanError(null);
              setCameraPermission('granted');
          } catch (err) {
              console.error("Camera access error:", err);
              setScanError("Camera access failed. Ensure permission is granted or try flipping the camera.");
              setCameraPermission('denied');
          }
      };

      if ((isScanning && joinMethod === 'SCAN') || viewStep === 'TAKE_PHOTO') {
          startCamera();
      } else {
          // Cleanup if mode changes
          if (currentStream) {
              (currentStream as MediaStream).getTracks().forEach(t => t.stop());
          }
          if (videoRef.current && videoRef.current.srcObject) {
              (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
          }
      }

      return () => {
          cancelAnimationFrame(animationFrameId);
          if (currentStream) {
              (currentStream as MediaStream).getTracks().forEach(t => t.stop());
          }
      };
  }, [isScanning, joinMethod, facingMode, viewStep, pendingJoinTeam]);

  const toggleCamera = () => {
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleCapturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (video.videoWidth === 0 || video.videoHeight === 0) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              // Flip horizontally if using user (front) camera for natural mirror effect
              if (facingMode === 'user') {
                  ctx.translate(canvas.width, 0);
                  ctx.scale(-1, 1);
              }
              ctx.drawImage(video, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setTeamPhoto(dataUrl);
              setViewStep('MAKE_TEAM');
          }
      }
  };

  const handleEnterLobby = async () => {
      if (selectedGameId && teamName && playerName) {
          localStorage.setItem('geohunt_player_name', playerName);
          
          const joinCode = getJoinCode(teamName);
          const teamId = `team-${teamName.replace(/\s+/g, '-').toLowerCase()}-${selectedGameId}`;
          
          // 1. Fetch ALL teams for this game to see if our team exists
          const teams = await db.fetchTeams(selectedGameId);
          const existingTeam = teams.find(t => t.id === teamId);

          // 2. Prepare members list: Merge existing with new player
          let updatedMembers = [playerName];
          if (existingTeam && existingTeam.members) {
              updatedMembers = Array.from(new Set([...existingTeam.members, playerName]));
          }

          // 3. Upsert Team
          const team: Team = {
              id: teamId,
              gameId: selectedGameId,
              name: teamName,
              joinCode: joinCode,
              // Keep existing photo if we didn't take a new one
              photoUrl: teamPhoto || (existingTeam ? existingTeam.photoUrl : undefined),
              members: updatedMembers,
              score: existingTeam ? existingTeam.score : 0,
              updatedAt: new Date().toISOString()
          };
          
          await db.registerTeam(team);

          teamSync.connect(selectedGameId, teamName, playerName);
          teamSync.subscribeToMembers((members) => setLobbyMembers(members));
          setViewStep('TEAM_LOBBY');
      }
  };

  const handleManualJoin = async () => {
      if (selectedGameId && teamJoinCode) {
          setIsJoining(true);
          try {
              // 1. Fetch teams for game
              const teams = await db.fetchTeams(selectedGameId);
              
              if (!teams || teams.length === 0) {
                  alert("No teams found for this game yet. Please create a team first.");
                  setIsJoining(false);
                  return;
              }

              // 2. Find team with matching code
              // Note: We use the helper to re-calculate code for match verification 
              // just in case DB didn't save the join_code column or value is missing
              const targetTeam = teams.find(t => {
                  return (t.joinCode && t.joinCode === teamJoinCode) || getJoinCode(t.name) === teamJoinCode;
              });

              if (targetTeam) {
                  // Instead of immediate jump, show confirmation
                  setPendingJoinTeam({ name: targetTeam.name, gameId: selectedGameId });
              } else {
                  alert(`No team found with code ${teamJoinCode}. Check the code or Game selection.`);
              }
          } catch (e) {
              console.error(e);
              alert("Error joining team. Please check connection.");
          } finally {
              setIsJoining(false);
          }
      }
  };
  
  const handleConfirmJoin = () => {
      if (pendingJoinTeam) {
          setTeamName(pendingJoinTeam.name);
          setSelectedGameId(pendingJoinTeam.gameId);
          setPendingJoinTeam(null);
          setIsScanning(false);
          setViewStep('MAKE_TEAM'); 
      }
  };

  const handleStartGameAction = () => {
      onStartGame(selectedGameId, teamName, playerName, 'osm');
  };

  const generateTeamQr = () => {
      const data = JSON.stringify({ action: 'join_team', team: teamName, gameId: selectedGameId });
      return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  };

  // Reusable System Check Row
  const StatusRow = ({ icon: Icon, label, status, onRequest, isVital = false }: any) => {
      let statusText = t('waiting', language);
      let statusColor = "text-yellow-400";
      let action = null;

      if (status === 'granted') {
          statusText = t('ready', language);
          statusColor = "text-green-400";
          action = <CheckCircle className="w-5 h-5 text-green-500" />;
      } else if (status === 'denied') {
          statusText = t('accessDenied', language);
          statusColor = "text-red-400";
          action = (<button onClick={() => setPermissionHelp(label)} className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full font-bold uppercase">{t('fix', language)}</button>);
      } else {
          statusText = isVital ? t('waiting', language) : t('check', language);
          action = onRequest ? (<button onClick={onRequest} className="text-[10px] bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded-full font-bold uppercase">{isVital ? t('enable', language) : t('check', language)}</button>) : <Loader2 className="w-4 h-4 animate-spin text-orange-400" />;
      }
      return (
        <div className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status === 'granted' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}><Icon className="w-5 h-5" /></div>
                <div><p className="font-bold text-sm text-slate-200">{label}</p><p className={`text-[10px] uppercase font-bold tracking-wider ${statusColor}`}>{statusText}</p></div>
            </div>
            {action}
        </div>
      );
  };

  const requestGeo = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(() => setGeoPermission('granted'), () => { setGeoPermission('denied'); setPermissionHelp('Location'); });
  };

  const requestCamera = () => {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            setCameraPermission('granted');
            stream.getTracks().forEach(t => t.stop());
        })
        .catch(() => {
            setCameraPermission('denied');
            setPermissionHelp('Camera');
        });
  };

  const goBack = () => {
      if (viewStep === 'TAKE_PHOTO') {
          setViewStep('MAKE_TEAM');
      } else if (viewStep === 'CHOICE' && onBack) {
          onBack();
      } else if (viewStep === 'JOIN_OPTIONS') {
          setViewStep('CHOICE');
      } else if (viewStep === 'MAKE_TEAM') {
          setViewStep('CHOICE');
      } else if (viewStep === 'JOIN_SCAN') {
          setViewStep('JOIN_OPTIONS');
          setIsScanning(false);
          setPendingJoinTeam(null);
      } else if (viewStep === 'TEAM_LOBBY') {
          setViewStep('MAKE_TEAM');
          teamSync.disconnect();
      }
  };

  // --- RENDER STEPS ---

  // 1. CHOICE
  if (viewStep === 'CHOICE') {
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-900 text-white flex flex-col items-center justify-center p-6 uppercase">
            {/* Nav Buttons */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                <button 
                    onClick={onBack} 
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white font-bold transition-all shadow-lg text-xs"
                >
                    <Home className="w-4 h-4" /> WELCOME
                </button>
                <button 
                    onClick={() => { setShowTeamsPopup(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white font-bold transition-all shadow-lg text-xs"
                >
                    <Users className="w-4 h-4" /> TEAMS
                </button>
            </div>

            <h1 className="text-4xl font-black mb-12 tracking-widest text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">Choose Mode</h1>
            <div className="flex flex-col gap-6 w-full max-w-sm">
                <button onClick={() => setViewStep('MAKE_TEAM')} className="group relative h-40 bg-orange-600 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-105">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-700 opacity-90" />
                    <div className="relative z-10 flex flex-col items-center">
                        <Users className="w-12 h-12 mb-2 text-white group-hover:scale-110 transition-transform" />
                        <span className="text-2xl font-black tracking-widest">Make Team</span>
                        <span className="text-[10px] font-bold text-orange-200 mt-1">Create & Invite</span>
                    </div>
                </button>
                <div className="flex items-center gap-4 text-slate-500 font-bold text-xs"><div className="h-px bg-slate-700 flex-1"></div>OR<div className="h-px bg-slate-700 flex-1"></div></div>
                <button onClick={() => setViewStep('JOIN_OPTIONS')} className="group relative h-40 bg-slate-700 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-105 border border-slate-600">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 opacity-90" />
                    <div className="relative z-10 flex flex-col items-center">
                        <ScanLine className="w-12 h-12 mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-2xl font-black tracking-widest">Join Team</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-1">Scan or Code</span>
                    </div>
                </button>
            </div>

            {/* Teams Popup */}
            {showTeamsPopup && (
                <div className="fixed inset-0 z-[2200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md max-h-[80vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5"/> Teams Joined</h2>
                            <button onClick={() => setShowTeamsPopup(false)}><X className="w-6 h-6 text-slate-400 hover:text-white" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {existingTeams.length === 0 && <p className="text-center text-slate-500 py-8">No teams found for this game yet.</p>}
                            {existingTeams.map(team => (
                                <div key={team.id} className="bg-slate-800 rounded-xl p-3 flex gap-3 border border-slate-700">
                                    <div className="w-16 h-16 bg-slate-700 rounded-lg flex-shrink-0 overflow-hidden">
                                        {team.photoUrl ? (
                                            <img src={team.photoUrl} className="w-full h-full object-cover" alt={team.name} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-500"><Users className="w-6 h-6" /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-white truncate text-lg">{team.name}</h3>
                                            <span className="text-orange-500 font-black text-lg">{team.score} pts</span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                            <Users className="w-3 h-3" /> {team.members?.length || 0} Players
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                                            {team.members?.join(', ') || "No members"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // 1.5 JOIN OPTIONS
  if (viewStep === 'JOIN_OPTIONS') {
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-900 text-white flex flex-col items-center justify-center p-6 uppercase">
             {/* Back Button */}
             <div className="absolute top-4 left-4">
                <button onClick={goBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white"><Home className="w-6 h-6" /></button>
             </div>

             <h1 className="text-3xl font-black mb-8 tracking-widest text-center text-white">How to Join?</h1>
             
             <div className="flex flex-col gap-6 w-full max-w-sm">
                <button 
                    onClick={() => { setViewStep('JOIN_SCAN'); setIsScanning(true); setJoinMethod('SCAN'); }} 
                    className="group relative h-32 bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-105 border-2 border-slate-700 hover:border-orange-500"
                >
                    <div className="flex flex-col items-center">
                        <QrCode className="w-10 h-10 mb-2 text-white group-hover:text-orange-500 transition-colors" />
                        <span className="text-xl font-black tracking-widest">Scan QR</span>
                    </div>
                </button>

                <button 
                    onClick={() => { setViewStep('JOIN_SCAN'); setIsScanning(false); setJoinMethod('MANUAL'); }} 
                    className="group relative h-32 bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-105 border-2 border-slate-700 hover:border-orange-500"
                >
                    <div className="flex flex-col items-center">
                        <Keyboard className="w-10 h-10 mb-2 text-white group-hover:text-orange-500 transition-colors" />
                        <span className="text-xl font-black tracking-widest">Enter Code</span>
                    </div>
                </button>
             </div>
        </div>
      );
  }

  // CAMERA VIEW
  if (viewStep === 'TAKE_PHOTO') {
      return (
          <div className="fixed inset-0 z-[2100] bg-black text-white flex flex-col">
              <div className="relative flex-1 overflow-hidden">
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted />
                  <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="p-6 bg-black/80 backdrop-blur-md flex justify-between items-center">
                  <button onClick={goBack} className="p-3 bg-white/20 rounded-full hover:bg-white/30"><X className="w-6 h-6" /></button>
                  <button onClick={handleCapturePhoto} className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-all shadow-lg"></button>
                  <button onClick={toggleCamera} className="p-3 bg-white/20 rounded-full hover:bg-white/30"><RotateCcw className="w-6 h-6" /></button>
              </div>
          </div>
      );
  }

  // 2. JOIN SCAN / MANUAL ENTRY
  if (viewStep === 'JOIN_SCAN') {
      return (
          <div className="fixed inset-0 z-[2000] bg-black text-white flex flex-col uppercase">
              {/* Header */}
              <div className="p-4 flex items-center justify-between bg-slate-900/50 backdrop-blur-md absolute top-0 w-full z-20">
                  <button onClick={goBack} className="p-2 bg-white/10 rounded-full text-white"><ArrowLeft className="w-6 h-6" /></button>
                  <div className="flex bg-black/40 rounded-lg p-1 backdrop-blur-md">
                      <button 
                        onClick={() => setJoinMethod('SCAN')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${joinMethod === 'SCAN' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      >
                          Scan QR
                      </button>
                      <button 
                        onClick={() => setJoinMethod('MANUAL')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${joinMethod === 'MANUAL' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      >
                          Enter Code
                      </button>
                  </div>
                  {joinMethod === 'SCAN' && (
                      <button onClick={toggleCamera} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors">
                          <RotateCcw className="w-6 h-6" />
                      </button>
                  )}
                  {joinMethod === 'MANUAL' && <div className="w-10" />}
              </div>

              {/* Confirmation Modal */}
              {pendingJoinTeam && (
                  <div className="absolute inset-0 z-[3000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl relative">
                          <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-slate-800 -mt-10 shadow-lg">
                              <Users className="w-8 h-8 text-white" />
                          </div>
                          <h3 className="text-xl font-black text-white mb-2 tracking-wide">Join Team?</h3>
                          <p className="text-slate-400 text-sm mb-6">
                              Are you sure you want to join team <span className="text-orange-500 font-bold">{pendingJoinTeam.name}</span>?
                          </p>
                          <div className="flex gap-3">
                              <button 
                                  onClick={() => setPendingJoinTeam(null)} 
                                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                              >
                                  Cancel
                              </button>
                              <button 
                                  onClick={handleConfirmJoin} 
                                  className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20"
                              >
                                  Yes, Join
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {/* View Content */}
              {joinMethod === 'SCAN' ? (
                  <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 border-[50px] border-black/50 z-10 pointer-events-none">
                          <div className="w-full h-full border-2 border-orange-500 relative">
                              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-orange-500 -mt-1 -ml-1"></div>
                              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-orange-500 -mt-1 -mr-1"></div>
                              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-orange-500 -mb-1 -ml-1"></div>
                              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-orange-500 -mb-1 -mr-1"></div>
                          </div>
                      </div>
                      {scanError && (
                          <div className="absolute bottom-24 bg-red-600/90 px-4 py-3 rounded-xl font-bold max-w-sm text-center mx-4 text-xs backdrop-blur-sm shadow-xl flex flex-col items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-white" />
                              {scanError}
                          </div>
                      )}
                      <div className="absolute bottom-8 text-center w-full z-20 px-4">
                          <p className="text-slate-400 text-xs font-bold drop-shadow-md">Point camera at host's QR code</p>
                      </div>
                  </div>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900">
                      <div className="w-full max-w-sm space-y-6">
                          <div className="text-center mb-8">
                              <Keyboard className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                              <h2 className="text-xl font-black tracking-widest text-white">Manual Entry</h2>
                              <p className="text-slate-400 text-xs mt-2">Enter the Game and 6-digit code.</p>
                          </div>

                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Select Game</label>
                                  <select 
                                      value={selectedGameId} 
                                      onChange={(e) => setSelectedGameId(e.target.value)}
                                      className="w-full p-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-bold outline-none focus:border-orange-500 transition-all appearance-none"
                                  >
                                      <option value="" disabled>-- Select Game --</option>
                                      {relevantGames.map(g => (
                                          <option key={g.id} value={g.id}>{g.name}</option>
                                      ))}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">6-Digit Team Code</label>
                                  <input 
                                      type="tel" 
                                      maxLength={6}
                                      value={teamJoinCode}
                                      onChange={(e) => setTeamJoinCode(e.target.value.replace(/[^0-9]/g, ''))}
                                      placeholder="123456"
                                      className="w-full p-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-black text-2xl text-center placeholder:text-slate-600 outline-none focus:border-orange-500 transition-all tracking-[0.2em]"
                                  />
                              </div>
                          </div>

                          <button 
                              onClick={handleManualJoin}
                              disabled={!selectedGameId || teamJoinCode.length !== 6 || isJoining}
                              className="w-full py-4 bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-orange-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg flex items-center justify-center gap-2"
                          >
                              {isJoining ? <Loader2 className="w-5 h-5 animate-spin"/> : "Find & Join Team"}
                          </button>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // 3. TEAM LOBBY
  if (viewStep === 'TEAM_LOBBY') {
      const joinCode = getJoinCode(teamName);
      
      return (
          <div className="fixed inset-0 z-[2000] bg-slate-900 text-white overflow-y-auto uppercase font-sans">
              <div className="max-w-md mx-auto min-h-full p-6 flex flex-col relative">
                  <button onClick={goBack} className="absolute top-4 left-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white"><Home className="w-6 h-6" /></button>
                  {/* Lobby Header */}
                  <div className="text-center mb-8 pt-10">
                      <h2 className="text-sm font-bold text-slate-500 tracking-widest mb-2 uppercase">TEAM LOBBY</h2>
                      <h1 className="text-4xl font-black text-white tracking-widest break-words leading-none text-orange-500">{teamName}</h1>
                  </div>

                  {/* QR Card */}
                  <div className="bg-white text-slate-900 p-6 rounded-3xl shadow-2xl mb-8 flex flex-col items-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-2 bg-orange-500"></div>
                      <h3 className="font-black text-lg mb-4 tracking-widest flex items-center gap-2"><ScanLine className="w-5 h-5 text-orange-600" /> Join This Team</h3>
                      
                      <div className="p-2 border-4 border-slate-900 rounded-xl mb-4 bg-white">
                          <img src={generateTeamQr()} alt="Team QR" className="w-48 h-48 mix-blend-multiply" />
                      </div>
                      
                      {/* Manual Code Section */}
                      <div className="w-full mt-2 pt-4 border-t border-slate-200 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Manual Join Code</p>
                          <div className="bg-slate-100 p-4 rounded-2xl inline-block shadow-inner">
                              <span className="text-4xl font-black text-slate-800 tracking-[0.2em]">{joinCode}</span>
                          </div>
                      </div>
                  </div>

                  {/* Members List */}
                  <div className="flex-1">
                      <div className="flex justify-between items-end mb-4">
                          <h3 className="font-bold text-slate-400 text-xs tracking-widest flex items-center gap-2"><Users className="w-4 h-4" /> Team Members ({lobbyMembers.length})</h3>
                      </div>
                      <div className="bg-slate-800/50 rounded-2xl p-4 space-y-3 border border-slate-700">
                          {lobbyMembers.map((m, i) => (
                              <div key={m.deviceId} className="flex items-center justify-between p-2 bg-slate-800 rounded-xl border border-slate-700">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${m.userName === playerName ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                          {m.userName.charAt(0)}
                                      </div>
                                      <span className={`font-bold text-sm ${m.userName === playerName ? 'text-white' : 'text-slate-300'}`}>
                                          {m.userName} {m.userName === playerName && '(You)'}
                                      </span>
                                  </div>
                                  <div className="flex flex-col items-end">
                                      <span className="text-[10px] text-green-400 font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Online</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Start Button */}
                  <div className="mt-8 pt-6 border-t border-slate-800">
                      <button 
                          onClick={handleStartGameAction}
                          className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-2xl font-black text-lg shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 tracking-widest"
                      >
                          <PlayCircle className="w-6 h-6" /> Start Game
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // 4. MAKE TEAM FORM (Default View for login)
  const isLocationReady = !!userLocation || geoPermission === 'granted';
  const isCameraReady = cameraPermission === 'granted';
  
  // NOTE: For MVP testing, we allow bypassing camera check if permission is unknown, but warn if denied.
  const allSystemsReady = isLocationReady; 

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900 text-white overflow-y-auto uppercase font-sans">
        <div className="min-h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto relative">
            <button onClick={goBack} className="absolute top-4 left-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white"><Home className="w-6 h-6" /></button>
            
            {/* Header */}
            <div className="text-center mb-6 animate-in slide-in-from-top-10 duration-500">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-4 transform rotate-3">
                    <MapPin className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-black tracking-tight mb-2 text-white">{t('welcomeTitle', language)}</h1>
                <p className="text-gray-400 text-lg font-medium">{t('welcomeSubtitle', language)}</p>
            </div>

            {/* Permission Modal */}
            {permissionHelp && (
                <div className="fixed inset-0 z-[2100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-sm w-full text-center relative shadow-2xl">
                        <button onClick={() => setPermissionHelp(null)} className="absolute top-3 right-3 text-slate-500 hover:text-white"><XCircle className="w-6 h-6" /></button>
                        <h3 className="text-lg font-bold mb-2">{isIOS ? "iOS Permission Help" : t('permHelpTitle', language)}</h3>
                        <p className="text-sm text-slate-300 mb-6">{t('permHelpInstruction', language)}</p>
                        <button onClick={() => setPermissionHelp(null)} className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl">{t('permHelpButton', language)}</button>
                    </div>
                </div>
            )}

            {/* Main Content Card */}
            <div className="w-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-700 delay-100">
                
                {/* 1. System Check */}
                <div className="mb-6">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                        {t('systemReadiness', language)}
                        <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                            <Info className="w-3 h-3" /> Required
                        </span>
                    </h2>
                    <div className="space-y-1 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                        <StatusRow icon={MapPin} label={t('locationServices', language)} status={geoPermission} onRequest={requestGeo} isVital />
                        <StatusRow icon={Camera} label={t('cameraAccess', language)} status={cameraPermission} onRequest={requestCamera} isVital />
                    </div>
                </div>

                {/* 2. Game Selection */}
                {allSystemsReady && (
                    <div className="mb-6 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{t('selectGame', language)}</h2>
                        <div className="space-y-3">
                            {relevantGames.length > 0 ? (
                                <select 
                                    value={selectedGameId} 
                                    onChange={(e) => setSelectedGameId(e.target.value)}
                                    className="w-full p-4 rounded-xl bg-slate-700 border-2 border-slate-600 text-white font-bold outline-none focus:border-orange-500 focus:bg-slate-800 transition-all appearance-none"
                                >
                                    {relevantGames.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-center p-4 bg-slate-800 rounded-xl border border-dashed border-slate-600">
                                    <p className="text-sm text-slate-400">{t('noGames', language)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Player Details & Team Photo */}
                {allSystemsReady && selectedGameId && (
                     <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 delay-100">
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">{t('teamName', language)}</label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input 
                                        type="text" 
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        placeholder={t('enterTeamName', language)}
                                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-700 border-2 border-slate-600 text-white font-bold placeholder:text-slate-500 outline-none focus:border-orange-500 focus:bg-slate-800 transition-all"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Team Photo</label>
                                {teamPhoto ? (
                                    <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-700 group cursor-pointer border-2 border-slate-600" onClick={() => setViewStep('TAKE_PHOTO')}>
                                        <img src={teamPhoto} className="w-full h-full object-cover" alt="Team" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Camera className="w-8 h-8 text-white" />
                                        </div>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setViewStep('TAKE_PHOTO')}
                                        className="w-full h-24 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-800 hover:text-orange-500 hover:border-orange-500 transition-all"
                                    >
                                        <Camera className="w-8 h-8 mb-1" />
                                        <span className="text-xs font-bold">Take Team Photo</span>
                                    </button>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Your Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input 
                                        type="text" 
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        placeholder="Enter your name..."
                                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-700 border-2 border-slate-600 text-white font-bold placeholder:text-slate-500 outline-none focus:border-orange-500 focus:bg-slate-800 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Action Button */}
                <button 
                    onClick={handleEnterLobby}
                    disabled={!allSystemsReady || !selectedGameId || !teamName || !playerName}
                    className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-lg shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-orange-500 to-red-600 text-white hover:shadow-orange-500/25 hover:shadow-2xl"
                >
                    Enter Lobby <ArrowLeft className="w-6 h-6 rotate-180" />
                </button>
            </div>

            {/* Footer */}
            <div className="mt-8 flex justify-between items-center w-full max-w-sm px-4">
                <button onClick={() => {
                        const langs: Language[] = ['English', 'Danish', 'German', 'Spanish'];
                        const next = langs[(langs.indexOf(language) + 1) % langs.length];
                        onSetLanguage(next);
                    }}
                    className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors"
                >
                    <Languages className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">{language}</span>
                </button>
                {onOpenEditor && (
                    <button onClick={onOpenEditor} className="flex items-center gap-2 text-slate-500 hover:text-orange-500 transition-colors">
                        <Hammer className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Editor</span>
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default WelcomeScreen;