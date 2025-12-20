
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game, Coordinate, MapStyleId, Language, TeamMember, Team } from '../types';
import { haversineMeters } from '../utils/geo';
import { t } from '../utils/i18n';
import { Camera, MapPin, CheckCircle, XCircle, Users, PlayCircle, Loader2, Languages, QrCode, Mic, HardDrive, Lock, Info, AlertTriangle, Hammer, User, ScanLine, ArrowLeft, Trophy, Share2, Home, RotateCcw, Keyboard, Copy, X, HelpCircle, Edit2, Anchor, Plus, Play, Sparkles, Hash } from 'lucide-react';
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
  onBack?: () => void;
}

type ViewStep = 'CHOICE' | 'JOIN_OPTIONS' | 'JOIN_SCAN' | 'JOIN_CODE' | 'MAKE_TEAM' | 'TEAM_LOBBY' | 'TAKE_PHOTO';

const STORAGE_KEY_GAME_ID = 'teambattle_last_game_id';
const STORAGE_KEY_PLAYER_NAME = 'teambattle_player_name';

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
    onBack
}) => {
  const [viewStep, setViewStep] = useState<ViewStep>('CHOICE');
  const [selectedGameId, setSelectedGameId] = useState<string>(localStorage.getItem(STORAGE_KEY_GAME_ID) || '');
  const [teamName, setTeamName] = useState('');
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [teamPhoto, setTeamPhoto] = useState<string | null>(null);
  const [isJoiningExisting, setIsJoiningExisting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lobbyMembers, setLobbyMembers] = useState<TeamMember[]>([]);
  const [dbMembers, setDbMembers] = useState<string[]>([]);
  const [isLoadingLobby, setIsLoadingLobby] = useState(false);
  const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [isIOS, setIsIOS] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [permissionHelp, setPermissionHelp] = useState<string | null>(null);

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
        }).catch(() => setCameraPermission('prompt'));
    }
    const savedName = localStorage.getItem(STORAGE_KEY_PLAYER_NAME);
    if (savedName) setPlayerName(savedName);
  }, []);

  useEffect(() => {
      if (viewStep === 'TEAM_LOBBY' && selectedGameId && teamName) {
          const checkTeamStatus = async () => {
              const teams = await db.fetchTeams(selectedGameId);
              const joinCode = getJoinCode(teamName);
              const myTeam = teams.find(t => (targetTeamId && t.id === targetTeamId) || t.name.toLowerCase() === teamName.toLowerCase() || t.joinCode === joinCode);
              if (myTeam) {
                  setCurrentTeam(myTeam);
                  setDbMembers(myTeam.members || []);
                  const myDeviceId = teamSync.getDeviceId();
                  setIsCaptain(myTeam.captainDeviceId === myDeviceId);
                  if (myTeam.isStarted) onStartGame(selectedGameId, teamName, playerName, 'osm');
              }
          };
          checkTeamStatus();
          const interval = setInterval(checkTeamStatus, 3000);
          return () => clearInterval(interval);
      }
  }, [viewStep, selectedGameId, teamName, targetTeamId, playerName, onStartGame]);

  const handleManualCodeSubmit = async () => {
      if (manualCode.length < 6) return;
      setIsLoadingLobby(true);
      try {
          // Flatten teams across all games to find this code
          let foundTeam: Team | null = null;
          let foundGameId = '';
          for (const game of games) {
              const teams = await db.fetchTeams(game.id);
              const t = teams.find(team => team.joinCode === manualCode);
              if (t) { foundTeam = t; foundGameId = game.id; break; }
          }
          if (foundTeam) {
              setSelectedGameId(foundGameId);
              setTeamName(foundTeam.name);
              setTargetTeamId(foundTeam.id);
              setIsJoiningExisting(true);
              setViewStep('MAKE_TEAM');
          } else {
              alert("Invalid Code. Team not found.");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingLobby(false);
      }
  };

  const handleCapturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
              ctx.drawImage(video, 0, 0);
              setTeamPhoto(canvas.toDataURL('image/jpeg', 0.8));
              setViewStep('MAKE_TEAM');
          }
      }
  };

  const handleEnterLobby = async () => {
      if (!selectedGameId || !teamName || !playerName) return;
      setIsLoadingLobby(true);
      try {
          const myDeviceId = teamSync.getDeviceId();
          localStorage.setItem(STORAGE_KEY_PLAYER_NAME, playerName);
          localStorage.setItem(STORAGE_KEY_GAME_ID, selectedGameId);
          const cleanTeamName = teamName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
          const generatedTeamId = `team-${cleanTeamName}-${selectedGameId}`;
          const teams = await db.fetchTeams(selectedGameId);
          const existingTeam = teams.find(t => (targetTeamId && t.id === targetTeamId) || t.name.toLowerCase() === teamName.toLowerCase() || t.id === generatedTeamId);
          let updatedMembers = existingTeam ? Array.from(new Set([...existingTeam.members, playerName])) : [playerName];
          const team: Team = {
              id: existingTeam ? existingTeam.id : generatedTeamId, 
              gameId: selectedGameId,
              name: teamName,
              joinCode: existingTeam ? existingTeam.joinCode : getJoinCode(teamName),
              photoUrl: teamPhoto || existingTeam?.photoUrl,
              members: updatedMembers,
              score: existingTeam?.score || 0,
              completedPointIds: existingTeam?.completedPointIds || [],
              updatedAt: new Date().toISOString(),
              captainDeviceId: existingTeam ? existingTeam.captainDeviceId : myDeviceId,
              isStarted: false
          };
          await db.registerTeam(team);
          setDbMembers(updatedMembers);
          setTargetTeamId(team.id);
          teamSync.connect(selectedGameId, teamName, playerName);
          teamSync.subscribeToMembers((m) => setLobbyMembers(m));
          setViewStep('TEAM_LOBBY');
      } catch (e) {
          console.error(e);
          alert("Error joining team.");
      } finally { setIsLoadingLobby(false); }
  };

  const handleStartMission = async () => {
      if (!targetTeamId) return;
      setIsLoadingLobby(true);
      try {
          await db.updateTeamStatus(targetTeamId, true);
          onStartGame(selectedGameId, teamName, playerName, 'osm');
      } catch (e) { console.error(e); }
      finally { setIsLoadingLobby(false); }
  };

  const goBack = () => {
      if (viewStep === 'MAKE_TEAM') { setIsJoiningExisting(false); setViewStep('CHOICE'); }
      else if (viewStep === 'JOIN_OPTIONS') setViewStep('CHOICE');
      else if (viewStep === 'JOIN_CODE') setViewStep('JOIN_OPTIONS');
      else if (viewStep === 'TEAM_LOBBY') { setViewStep('CHOICE'); teamSync.disconnect(); }
      else if (viewStep === 'TAKE_PHOTO') setViewStep('MAKE_TEAM');
      else if (onBack) onBack();
  };

  const StatusRow = ({ icon: Icon, label, status, onRequest, isVital = false }: any) => {
      let statusText = status === 'granted' ? t('ready', language) : (status === 'denied' ? t('accessDenied', language) : t('waiting', language));
      let statusColor = status === 'granted' ? "text-green-400" : (status === 'denied' ? "text-red-400" : "text-yellow-400");
      return (
        <div className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status === 'granted' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}><Icon className="w-5 h-5" /></div>
                <div><p className="font-black text-[10px] uppercase tracking-widest text-slate-400">{label}</p><p className={`text-[9px] uppercase font-black tracking-widest ${statusColor}`}>{statusText}</p></div>
            </div>
            {status !== 'granted' && onRequest && (<button onClick={onRequest} className="text-[10px] bg-orange-600 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">FIX</button>)}
        </div>
      );
  };

  if (viewStep === 'CHOICE') {
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col items-center justify-center p-6 uppercase font-sans">
            <div className="absolute top-4 left-4"><button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full text-white font-black text-[10px] tracking-widest uppercase"><Home className="w-4 h-4" /> HUB</button></div>
            <h1 className="text-4xl font-black mb-12 tracking-[0.2em] text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 uppercase leading-tight">CHOOSE YOUR PATH</h1>
            <div className="flex flex-col gap-6 w-full max-w-sm">
                <button onClick={() => setViewStep('MAKE_TEAM')} className="group relative h-40 bg-orange-600 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-105 active:scale-95">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-700 opacity-90" />
                    <div className="relative z-10 flex flex-col items-center">
                        <Users className="w-12 h-12 mb-2 text-white group-hover:scale-110 transition-transform" />
                        <span className="text-2xl font-black tracking-[0.2em] uppercase">CREATE TEAM</span>
                    </div>
                </button>
                <div className="flex items-center gap-4 text-slate-500 font-black text-[10px] tracking-widest"><div className="h-px bg-slate-700 flex-1"></div>OR<div className="h-px bg-slate-700 flex-1"></div></div>
                <button onClick={() => setViewStep('JOIN_OPTIONS')} className="group relative h-40 bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-105 active:scale-95 border border-slate-700">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 opacity-90" />
                    <div className="relative z-10 flex flex-col items-center">
                        <ScanLine className="w-12 h-12 mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-2xl font-black tracking-[0.2em] uppercase">JOIN TEAM</span>
                    </div>
                </button>
            </div>
        </div>
      );
  }

  if (viewStep === 'JOIN_OPTIONS') {
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col items-center justify-center p-6 uppercase font-sans animate-in fade-in">
            <div className="absolute top-4 left-4"><button onClick={goBack} className="p-2 bg-slate-800 rounded-full text-white"><ArrowLeft className="w-6 h-6" /></button></div>
            <h2 className="text-3xl font-black mb-12 tracking-[0.2em] uppercase text-center">JOIN MISSION</h2>
            <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
                <button onClick={() => setViewStep('JOIN_CODE')} className="bg-slate-800 border-2 border-slate-700 p-8 rounded-3xl flex flex-col items-center gap-4 hover:border-orange-500 transition-all">
                    <Keyboard className="w-12 h-12 text-orange-500" />
                    <span className="text-xl font-black tracking-widest uppercase">ENTER TEAM CODE</span>
                </button>
                <button className="bg-slate-800 border-2 border-slate-700 p-8 rounded-3xl flex flex-col items-center gap-4 hover:border-blue-500 transition-all opacity-50 cursor-not-allowed">
                    <QrCode className="w-12 h-12 text-blue-400" />
                    <span className="text-xl font-black tracking-widest uppercase">SCAN QR CODE</span>
                    <span className="text-[10px] font-bold text-slate-500 tracking-widest">COMING SOON</span>
                </button>
            </div>
        </div>
      );
  }

  if (viewStep === 'JOIN_CODE') {
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col items-center justify-center p-6 uppercase font-sans animate-in zoom-in-95 duration-300">
            <div className="absolute top-4 left-4"><button onClick={goBack} className="p-2 bg-slate-800 rounded-full text-white"><ArrowLeft className="w-6 h-6" /></button></div>
            <div className="w-full max-w-sm text-center">
                <div className="w-20 h-20 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-orange-500/50"><Hash className="w-10 h-10 text-orange-500" /></div>
                <h2 className="text-3xl font-black mb-4 tracking-[0.2em] uppercase">ENTER CODE</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">ENTER THE 6-DIGIT CODE FROM YOUR CAPTAIN'S SCREEN</p>
                <div className="relative mb-6">
                    <input 
                        type="text" 
                        maxLength={6} 
                        value={manualCode} 
                        onChange={(e) => setManualCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="000000"
                        className="w-full bg-slate-900 border-4 border-slate-800 rounded-2xl py-6 text-5xl font-mono font-black text-center text-white tracking-[0.3em] outline-none focus:border-orange-500 transition-all"
                        autoFocus
                    />
                </div>
                <button 
                    onClick={handleManualCodeSubmit}
                    disabled={manualCode.length < 6 || isLoadingLobby}
                    className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-xl tracking-[0.2em] shadow-xl disabled:opacity-30 transition-all active:scale-95"
                >
                    {isLoadingLobby ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'VERIFY CODE'}
                </button>
            </div>
        </div>
      );
  }

  if (viewStep === 'TEAM_LOBBY') {
      const activeMembers = Array.from(new Set([...dbMembers, ...lobbyMembers.map(m => m.userName)]));
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col items-center justify-center p-6 uppercase font-sans animate-in zoom-in-95 duration-500">
            <div className="absolute top-4 left-4"><button onClick={goBack} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-all"><ArrowLeft className="w-6 h-6" /></button></div>
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-600 animate-pulse" />
                <div className="text-center mb-8">
                    <div className="w-24 h-24 rounded-2xl mx-auto mb-4 overflow-hidden border-2 border-orange-500 shadow-xl">{teamPhoto ? <img src={teamPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><Users className="w-10 h-10 text-slate-600" /></div>}</div>
                    <h2 className="text-2xl font-black text-white tracking-widest uppercase truncate">{teamName}</h2>
                    <p className="text-[10px] text-orange-500 font-black tracking-[0.3em] mt-1">MISSION LOBBY</p>
                    <div className="mt-4 bg-slate-950 p-2 rounded-xl inline-block border border-slate-800">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mr-2">JOIN CODE:</span>
                        <span className="text-sm font-mono font-black text-white tracking-widest">{currentTeam?.joinCode || '------'}</span>
                    </div>
                </div>
                <div className="space-y-4 mb-8 flex-1">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2"><span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">OPERATIVES</span><span className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-bold">{activeMembers.length}</span></div>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {activeMembers.map((m, i) => (
                            <div key={i} className="p-3 rounded-xl border bg-slate-800/50 border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-[11px] font-black tracking-widest text-slate-200">{m}</span></div>
                                <span className="text-[8px] text-green-500 font-black uppercase tracking-tighter bg-green-500/10 px-1.5 rounded">READY</span>
                            </div>
                        ))}
                    </div>
                </div>
                {isCaptain ? (
                    <button onClick={handleStartMission} disabled={isLoadingLobby} className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl font-black text-lg tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">{isLoadingLobby ? <Loader2 className="w-6 h-6 animate-spin" /> : <>START MISSION <Play className="w-6 h-6" /></>}</button>
                ) : (
                    <div className="w-full py-4 bg-slate-800 border border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-1">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin mb-1" /><span className="text-[10px] font-black text-white tracking-widest uppercase">WAITING FOR CAPTAIN</span>
                    </div>
                )}
            </div>
        </div>
      );
  }

  const allSystemsReady = !!userLocation || geoPermission === 'granted';

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950 text-white overflow-y-auto uppercase font-sans">
        <div className="min-h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto relative">
            <button onClick={goBack} className="absolute top-4 left-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white transition-all"><ArrowLeft className="w-6 h-6" /></button>
            <div className="text-center mb-6 animate-in slide-in-from-top-10 duration-500">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-4 transform rotate-3"><MapPin className="w-10 h-10 text-white" /></div>
                <h1 className="text-4xl font-black tracking-tight mb-2 text-white">{isJoiningExisting ? `JOIN ${teamName}` : t('welcomeTitle', language)}</h1>
                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">{isJoiningExisting ? 'ENTER YOUR DETAILS' : t('welcomeSubtitle', language)}</p>
            </div>
            <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 pointer-events-auto">
                <div className="mb-6">
                    <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">{t('systemReadiness', language)}<span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 uppercase font-bold"><Info className="w-3 h-3" /> REQUIRED</span></h2>
                    <div className="space-y-1 bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700">
                        <StatusRow icon={MapPin} label={t('locationServices', language)} status={geoPermission} onRequest={() => navigator.geolocation.getCurrentPosition(() => setGeoPermission('granted'), () => setGeoPermission('denied'))} isVital />
                        <StatusRow icon={Camera} label={t('cameraAccess', language)} status={cameraPermission} onRequest={() => navigator.mediaDevices.getUserMedia({ video: true }).then(() => setCameraPermission('granted')).catch(() => setCameraPermission('denied'))} isVital />
                    </div>
                </div>
                {allSystemsReady && !isJoiningExisting && (
                    <div className="mb-6 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t('selectGame', language)}</h2>
                        <div className="space-y-3">
                            {availableGames.length > 0 ? (
                                <select 
                                  value={selectedGameId} 
                                  onChange={(e) => { 
                                      setSelectedGameId(e.target.value); 
                                      localStorage.setItem(STORAGE_KEY_GAME_ID, e.target.value);
                                  }} 
                                  className="w-full p-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-black tracking-widest outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer uppercase text-xs"
                                >
                                    {availableGames.map(g => (<option key={g.id} value={g.id}>{g.name} {g.distance !== null ? `(${Math.round(g.distance / 1000)}km)` : ''}</option>))}
                                </select>
                            ) : (<div className="text-center p-6 bg-slate-950 rounded-xl border border-dashed border-slate-800"><p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">NO GAMES FOUND</p></div>)}
                        </div>
                    </div>
                )}
                {allSystemsReady && (availableGames.length > 0 || isJoiningExisting) && (
                     <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 delay-100">
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{t('teamName', language)}</label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                                    <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder={t('enterTeamName', language)} disabled={isJoiningExisting} className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 text-white font-black tracking-[0.2em] text-xs outline-none transition-all uppercase ${isJoiningExisting ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-800 border-slate-700 focus:border-orange-500'}`} />
                                </div>
                            </div>
                            {!isJoiningExisting && (
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">TEAM PHOTO</label>
                                    {teamPhoto ? (
                                        <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-800 group cursor-pointer border-2 border-slate-700" onClick={() => setViewStep('TAKE_PHOTO')}>
                                            <img src={teamPhoto} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-8 h-8 text-white" /></div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setViewStep('TAKE_PHOTO')} className="w-full h-24 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-600 hover:bg-slate-800 hover:text-orange-500 hover:border-orange-500 transition-all uppercase font-black tracking-widest"><Camera className="w-8 h-8 mb-1" /><span className="text-[9px] font-black tracking-[0.3em]">TAKE TEAM PHOTO</span></button>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">YOUR NAME</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
                                    <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="ENTER YOUR NAME..." className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-800 border-2 border-orange-500/50 text-white font-black tracking-[0.2em] text-xs placeholder:text-slate-600 outline-none focus:border-orange-500 transition-all uppercase" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <button 
                  onClick={handleEnterLobby} 
                  disabled={!allSystemsReady || (!isJoiningExisting && !selectedGameId) || !teamName || !playerName || isLoadingLobby} 
                  className="w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] text-sm shadow-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-orange-600 to-red-600 text-white hover:shadow-orange-500/25"
                >
                    {isLoadingLobby ? <Loader2 className="w-6 h-6 animate-spin" /> : <>{isJoiningExisting ? 'JOIN TEAM' : 'ENTER LOBBY'} <ArrowLeft className="w-6 h-6 rotate-180" /></>}
                </button>
            </div>
        </div>
    </div>
  );
};

export default WelcomeScreen;
