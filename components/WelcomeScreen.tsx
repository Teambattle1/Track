
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game, Coordinate, MapStyleId, Language, TeamMember, Team } from '../types';
import { haversineMeters } from '../utils/geo';
import { t } from '../utils/i18n';
import { Camera, MapPin, CheckCircle, XCircle, Users, PlayCircle, Loader2, Languages, QrCode, Mic, HardDrive, Lock, Info, AlertTriangle, Hammer, User, ScanLine, ArrowLeft, Trophy, Share2, Home, RotateCcw, Keyboard, Copy, X, HelpCircle, Edit2, Anchor, Plus } from 'lucide-react';
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

const getJoinCode = (name: string): string => {
    if (!name) return '000000';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
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
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [teamName, setTeamName] = useState('');
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [teamJoinCode, setTeamJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [teamPhoto, setTeamPhoto] = useState<string | null>(null);
  const [isJoiningExisting, setIsJoiningExisting] = useState(false);
  const [showTeamsPopup, setShowTeamsPopup] = useState(false);
  const [existingTeams, setExistingTeams] = useState<Team[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [joinMethod, setJoinMethod] = useState<'SCAN' | 'MANUAL'>('SCAN');
  const [scanError, setScanError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isJoining, setIsJoining] = useState(false);
  const [pendingJoinTeam, setPendingJoinTeam] = useState<{name: string, gameId: string, id?: string} | null>(null);
  const [showStartConfirmation, setShowStartConfirmation] = useState(false);
  const [lobbyMembers, setLobbyMembers] = useState<TeamMember[]>([]);
  const [dbMembers, setDbMembers] = useState<string[]>([]);
  const [isLoadingLobby, setIsLoadingLobby] = useState(false);
  const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [permissionHelp, setPermissionHelp] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  // Updated logic: Show all games, but calculate distance if location available
  const availableGames = useMemo(() => {
      return games.map(g => {
          let distance: number | null = null;
          if (userLocation && g.points.length > 0) {
              const center = {
                  lat: g.points.reduce((sum, p) => sum + p.location.lat, 0) / g.points.length,
                  lng: g.points.reduce((sum, p) => sum + p.location.lng, 0) / g.points.length,
              };
              distance = haversineMeters(userLocation, center);
          }
          return { ...g, distance };
      }).sort((a, b) => (a.distance || 999999) - (b.distance || 999999));
  }, [games, userLocation]);

  useEffect(() => {
    const isIOSCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSCheck);

    if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
            setGeoPermission(result.state);
            result.onchange = () => setGeoPermission(result.state);
        });
        navigator.permissions.query({ name: 'camera' as any }).then(result => {
            setCameraPermission(result.state as any);
            result.onchange = () => setCameraPermission(result.state as any);
        }).catch(() => setCameraPermission('prompt'));
    } else {
        setCameraPermission('prompt');
    }
    
    const savedName = localStorage.getItem('geohunt_player_name');
    if (savedName) setPlayerName(savedName);

    if (availableGames.length > 0 && !selectedGameId) {
        setSelectedGameId(availableGames[0].id);
    }
  }, [availableGames, selectedGameId]);

  useEffect(() => {
      if (showTeamsPopup && selectedGameId) {
          db.fetchTeams(selectedGameId).then(setExistingTeams);
      }
  }, [showTeamsPopup, selectedGameId]);

  useEffect(() => {
      if (viewStep === 'TEAM_LOBBY' && selectedGameId && teamName) {
          const loadDbMembers = async () => {
              const teams = await db.fetchTeams(selectedGameId);
              const joinCode = getJoinCode(teamName);
              const myTeam = teams.find(t => 
                  (targetTeamId && t.id === targetTeamId) || 
                  t.name === teamName || 
                  t.joinCode === joinCode
              );
              if (myTeam && myTeam.members) setDbMembers(myTeam.members);
              else setDbMembers(prev => prev.includes(playerName) ? prev : [...prev, playerName]);
          };
          loadDbMembers();
          const interval = setInterval(loadDbMembers, 5000);
          return () => clearInterval(interval);
      }
  }, [viewStep, selectedGameId, teamName, playerName, targetTeamId]);

  useEffect(() => {
      let animationFrameId: number;
      let currentStream: MediaStream | null = null;
      const scanTick = () => {
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
              if (currentStream) currentStream.getTracks().forEach(t => t.stop());
              const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
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
              setScanError("Camera access failed.");
              setCameraPermission('denied');
          }
      };
      if ((isScanning && joinMethod === 'SCAN') || viewStep === 'TAKE_PHOTO') startCamera();
      return () => {
          cancelAnimationFrame(animationFrameId);
          if (currentStream) currentStream.getTracks().forEach(t => t.stop());
      };
  }, [isScanning, joinMethod, facingMode, viewStep, pendingJoinTeam]);

  const toggleCamera = () => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');

  const handleCapturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video.videoWidth === 0 || video.videoHeight === 0) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              if (facingMode === 'user') {
                  ctx.translate(canvas.width, 0);
                  ctx.scale(-1, 1);
              }
              ctx.drawImage(video, 0, 0);
              setTeamPhoto(canvas.toDataURL('image/jpeg', 0.8));
              setViewStep('MAKE_TEAM');
          }
      }
  };

  const handleEnterLobby = async () => {
      if (selectedGameId && teamName && playerName) {
          setIsLoadingLobby(true);
          try {
              localStorage.setItem('geohunt_player_name', playerName);
              const generatedTeamId = `team-${teamName.replace(/\s+/g, '-').toLowerCase()}-${selectedGameId}`;
              const teams = await db.fetchTeams(selectedGameId);
              const existingTeam = teams.find(t => (targetTeamId && t.id === targetTeamId) || t.name === teamName || t.id === generatedTeamId);
              let updatedMembers = [playerName];
              if (existingTeam && existingTeam.members) updatedMembers = Array.from(new Set([...existingTeam.members, playerName]));
              const finalTeamId = existingTeam ? existingTeam.id : generatedTeamId;
              const team: Team = {
                  id: finalTeamId, 
                  gameId: selectedGameId,
                  name: teamName,
                  joinCode: getJoinCode(teamName),
                  photoUrl: teamPhoto || (existingTeam ? existingTeam.photoUrl : undefined),
                  members: updatedMembers,
                  score: existingTeam ? existingTeam.score : 0,
                  updatedAt: new Date().toISOString()
              };
              await db.registerTeam(team);
              setDbMembers(updatedMembers);
              setTargetTeamId(finalTeamId);
              teamSync.connect(selectedGameId, teamName, playerName);
              teamSync.subscribeToMembers((members) => setLobbyMembers(members));
              setViewStep('TEAM_LOBBY');
          } catch (e) {
              alert("Failed to join team.");
          } finally { setIsLoadingLobby(false); }
      }
  };

  const handleManualJoin = async () => {
      if (selectedGameId && teamJoinCode) {
          setIsJoining(true);
          try {
              const teams = await db.fetchTeams(selectedGameId);
              const targetTeam = teams.find(t => (t.joinCode && t.joinCode === teamJoinCode) || getJoinCode(t.name) === teamJoinCode);
              if (targetTeam) setPendingJoinTeam({ name: targetTeam.name, gameId: selectedGameId, id: targetTeam.id });
              else alert(`No team found with code ${teamJoinCode}.`);
          } catch (e) { alert("Error joining team."); }
          finally { setIsJoining(false); }
      }
  };
  
  const handleConfirmJoin = () => {
      if (pendingJoinTeam) {
          setTeamName(pendingJoinTeam.name);
          setSelectedGameId(pendingJoinTeam.gameId);
          if (pendingJoinTeam.id) setTargetTeamId(pendingJoinTeam.id);
          setIsJoiningExisting(true);
          setPendingJoinTeam(null);
          setIsScanning(false);
          setViewStep('MAKE_TEAM'); 
      }
  };

  const goBack = () => {
      if (viewStep === 'TAKE_PHOTO') setViewStep('MAKE_TEAM');
      else if (viewStep === 'CHOICE' && onBack) onBack();
      else if (viewStep === 'JOIN_OPTIONS') setViewStep('CHOICE');
      else if (viewStep === 'MAKE_TEAM') { setIsJoiningExisting(false); setTargetTeamId(null); setViewStep('CHOICE'); }
      else if (viewStep === 'JOIN_SCAN') { setViewStep('JOIN_OPTIONS'); setIsScanning(false); setPendingJoinTeam(null); }
      else if (viewStep === 'TEAM_LOBBY') { setViewStep('MAKE_TEAM'); teamSync.disconnect(); }
  };

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

  if (viewStep === 'CHOICE') {
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-900 text-white flex flex-col items-center justify-center p-6 uppercase">
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white font-bold transition-all shadow-lg text-xs uppercase tracking-wide"><Home className="w-4 h-4" /> WELCOME</button>
                <button onClick={() => { setShowTeamsPopup(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white font-bold transition-all shadow-lg text-xs uppercase tracking-wide"><Users className="w-4 h-4" /> TEAMS</button>
            </div>
            <h1 className="text-4xl font-black mb-12 tracking-widest text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 uppercase leading-tight">CHOOSE YOUR PATH</h1>
            <div className="flex flex-col gap-6 w-full max-w-sm">
                <button onClick={() => setViewStep('MAKE_TEAM')} className="group relative h-40 bg-orange-600 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-105">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-700 opacity-90" />
                    <div className="relative z-10 flex flex-col items-center">
                        <Users className="w-12 h-12 mb-2 text-white group-hover:scale-110 transition-transform" />
                        <span className="text-2xl font-black tracking-widest uppercase">CREATE TEAM</span>
                    </div>
                </button>
                <div className="flex items-center gap-4 text-slate-500 font-bold text-xs"><div className="h-px bg-slate-700 flex-1"></div>OR<div className="h-px bg-slate-700 flex-1"></div></div>
                <button onClick={() => setViewStep('JOIN_OPTIONS')} className="group relative h-40 bg-slate-700 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-105 border border-slate-600">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 opacity-90" />
                    <div className="relative z-10 flex flex-col items-center">
                        <ScanLine className="w-12 h-12 mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-2xl font-black tracking-widest uppercase">JOIN TEAM</span>
                    </div>
                </button>
            </div>
            {showTeamsPopup && (
                <div className="fixed inset-0 z-[2200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md max-h-[80vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-wide"><Users className="w-5 h-5"/> ACTIVE TEAMS</h2>
                            <button onClick={() => setShowTeamsPopup(false)}><X className="w-6 h-6 text-slate-400 hover:text-white" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {existingTeams.length === 0 && <p className="text-center text-slate-500 py-8 uppercase tracking-wide font-bold">NO TEAMS FOUND YET.</p>}
                            {existingTeams.map(team => (
                                <div key={team.id} className="bg-slate-800 rounded-xl p-3 flex gap-3 border border-slate-700">
                                    <div className="w-16 h-16 bg-slate-700 rounded-lg flex-shrink-0 overflow-hidden">
                                        {team.photoUrl ? <img src={team.photoUrl} className="w-full h-full object-cover" alt={team.name} /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Users className="w-6 h-6" /></div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start"><h3 className="font-bold text-white truncate text-lg uppercase">{team.name}</h3><span className="text-orange-500 font-black text-lg">{team.score} PTS</span></div>
                                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 uppercase tracking-wide"><Users className="w-3 h-3" /> {team.members?.length || 0} PLAYERS</div>
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

  const isLocationReady = !!userLocation || geoPermission === 'granted';
  const allSystemsReady = isLocationReady; 

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900 text-white overflow-y-auto uppercase font-sans">
        <div className="min-h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto relative">
            <button onClick={goBack} className="absolute top-4 left-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white"><Home className="w-6 h-6" /></button>
            <div className="text-center mb-6 animate-in slide-in-from-top-10 duration-500">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-4 transform rotate-3"><MapPin className="w-10 h-10 text-white" /></div>
                <h1 className="text-4xl font-black tracking-tight mb-2 text-white">{isJoiningExisting ? `JOIN ${teamName}` : t('welcomeTitle', language)}</h1>
                <p className="text-gray-400 text-lg font-medium uppercase tracking-wide">{isJoiningExisting ? 'ENTER YOUR DETAILS' : t('welcomeSubtitle', language)}</p>
            </div>
            {permissionHelp && (
                <div className="fixed inset-0 z-[2100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-sm w-full text-center relative shadow-2xl">
                        <button onClick={() => setPermissionHelp(null)} className="absolute top-3 right-3 text-slate-500 hover:text-white"><XCircle className="w-6 h-6" /></button>
                        <h3 className="text-lg font-bold mb-2 uppercase">{isIOS ? "iOS Permission Help" : t('permHelpTitle', language)}</h3>
                        <p className="text-sm text-slate-300 mb-6">{t('permHelpInstruction', language)}</p>
                        <button onClick={() => setPermissionHelp(null)} className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl uppercase tracking-wide">{t('permHelpButton', language)}</button>
                    </div>
                </div>
            )}
            <div className="w-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
                <div className="mb-6">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">{t('systemReadiness', language)}<span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 uppercase font-bold"><Info className="w-3 h-3" /> REQUIRED</span></h2>
                    <div className="space-y-1 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                        <StatusRow icon={MapPin} label={t('locationServices', language)} status={geoPermission} onRequest={() => navigator.geolocation.getCurrentPosition(() => setGeoPermission('granted'), () => setGeoPermission('denied'))} isVital />
                        <StatusRow icon={Camera} label={t('cameraAccess', language)} status={cameraPermission} onRequest={() => navigator.mediaDevices.getUserMedia({ video: true }).then(() => setCameraPermission('granted')).catch(() => setCameraPermission('denied'))} isVital />
                    </div>
                </div>
                {allSystemsReady && !isJoiningExisting && (
                    <div className="mb-6 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{t('selectGame', language)}</h2>
                        <div className="space-y-3">
                            {availableGames.length > 0 ? (
                                <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)} className="w-full p-4 rounded-xl bg-slate-700 border-2 border-slate-600 text-white font-bold outline-none focus:border-orange-500 focus:bg-slate-800 transition-all appearance-none">
                                    {availableGames.map(g => (
                                        <option key={g.id} value={g.id}>{g.name} {g.distance !== null ? `(${Math.round(g.distance / 1000)}km)` : ''}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-center p-6 bg-slate-900 rounded-xl border border-dashed border-slate-700 flex flex-col items-center gap-3">
                                    <p className="text-xs text-slate-500 font-bold uppercase">NO GAMES FOUND IN DATABASE</p>
                                    <button onClick={onOpenEditor} className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full font-black flex items-center gap-2"><Hammer className="w-3 h-3" /> GO TO EDITOR</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {allSystemsReady && (availableGames.length > 0 || isJoiningExisting) && (
                     <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 delay-100">
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex justify-between">{t('teamName', language)} {isJoiningExisting && <span className="text-orange-500">LOCKED (JOINING)</span>}</label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder={t('enterTeamName', language)} disabled={isJoiningExisting} className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 text-white font-bold outline-none transition-all uppercase ${isJoiningExisting ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed' : 'bg-slate-700 border-slate-600 focus:border-orange-500 focus:bg-slate-800'}`} />
                                    {isJoiningExisting && <button onClick={() => { setIsJoiningExisting(false); setTeamName(''); setTargetTeamId(null); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><Edit2 className="w-4 h-4" /></button>}
                                </div>
                            </div>
                            {!isJoiningExisting && (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">TEAM PHOTO</label>
                                    {teamPhoto ? (
                                        <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-700 group cursor-pointer border-2 border-slate-600" onClick={() => setViewStep('TAKE_PHOTO')}>
                                            <img src={teamPhoto} className="w-full h-full object-cover" alt="Team" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-8 h-8 text-white" /></div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setViewStep('TAKE_PHOTO')} className="w-full h-24 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-800 hover:text-orange-500 hover:border-orange-500 transition-all uppercase font-bold"><Camera className="w-8 h-8 mb-1" /><span className="text-xs font-bold">TAKE TEAM PHOTO</span></button>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">YOUR NAME</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
                                    <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="ENTER YOUR NAME..." className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-700 border-2 border-orange-500/50 text-white font-bold placeholder:text-slate-500 outline-none focus:border-orange-500 focus:bg-slate-800 transition-all uppercase" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <button onClick={handleEnterLobby} disabled={!allSystemsReady || (!isJoiningExisting && !selectedGameId) || !teamName || !playerName || isLoadingLobby} className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-lg shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-orange-500 to-red-600 text-white hover:shadow-orange-500/25 hover:shadow-2xl">
                    {isLoadingLobby ? <Loader2 className="w-6 h-6 animate-spin" /> : <>{isJoiningExisting ? 'JOIN TEAM' : 'ENTER LOBBY'} <ArrowLeft className="w-6 h-6 rotate-180" /></>}
                </button>
            </div>
            <div className="mt-8 flex justify-between items-center w-full max-w-sm px-4">
                <button onClick={() => { const langs: Language[] = ['English', 'Danish', 'German', 'Spanish']; onSetLanguage(langs[(langs.indexOf(language) + 1) % langs.length]); }} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors"><Languages className="w-4 h-4" /><span className="text-xs font-bold uppercase">{language}</span></button>
                {onOpenEditor && <button onClick={onOpenEditor} className="flex items-center gap-2 text-slate-500 hover:text-orange-500 transition-colors"><Hammer className="w-4 h-4" /><span className="text-xs font-bold uppercase">EDITOR</span></button>}
            </div>
        </div>
        {viewStep === 'TAKE_PHOTO' && (
          <div className="fixed inset-0 z-[2100] bg-black text-white flex flex-col">
              <div className="relative flex-1 overflow-hidden"><video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted /><canvas ref={canvasRef} className="hidden" /></div>
              <div className="p-6 bg-black/80 backdrop-blur-md flex justify-between items-center"><button onClick={goBack} className="p-3 bg-white/20 rounded-full hover:bg-white/30"><X className="w-6 h-6" /></button><button onClick={handleCapturePhoto} className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-all shadow-lg"></button><button onClick={toggleCamera} className="p-3 bg-white/20 rounded-full hover:bg-white/30"><RotateCcw className="w-6 h-6" /></button></div>
          </div>
        )}
    </div>
  );
};

export default WelcomeScreen;
