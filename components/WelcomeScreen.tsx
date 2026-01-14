import React, { useState, useRef } from 'react';
import { Game, MapStyleId, Language, Coordinate, Team } from '../types';
import { Play, Users, MapPin, Globe, ArrowLeft, LogOut, Plus, Search, RefreshCw, Clock, User, Hash, Camera, ChevronDown, QrCode, Image as ImageIcon, X, Home, Check, Shield, Smartphone } from 'lucide-react';
import { t } from '../utils/i18n';
import { haversineMeters } from '../utils/geo';
import * as db from '../services/db';
import { teamSync } from '../services/teamSync';
import jsQR from 'jsqr';
import AvatarCreator from './AvatarCreator';
import { getGameDisplayId } from '../utils/gameIdUtils';

interface WelcomeScreenProps {
  games: Game[];
  userLocation: Coordinate | null;
  onStartGame: (gameId: string, teamName: string, userName: string, teamPhoto: string | null, style: MapStyleId) => void;
  onSetMapStyle: (style: MapStyleId) => void;
  language: Language;
  onSetLanguage: (lang: Language) => void;
  onBack: () => void;
  onInstructorLogin?: () => void; // New prop for cheat code
}

type ScreenMode = 'MENU' | 'CREATE_TEAM' | 'JOIN_OPTIONS' | 'JOIN_CODE' | 'JOIN_QR' | 'LOBBY_WAIT' | 'RECOVER_DEVICE';

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  games, 
  userLocation, 
  onStartGame, 
  onSetMapStyle, 
  language, 
  onSetLanguage, 
  onBack, 
  onInstructorLogin
}) => {
  const [mode, setMode] = useState<ScreenMode>('MENU');
  
  // Selection State
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id || '');
  const [teamName, setTeamName] = useState('');
  const [teamPhoto, setTeamPhoto] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  
  // Join Flow State
  const [joinCode, setJoinCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Recovery State
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Sorting games by distance for default selection logic if needed
  const sortedGames = [...games].sort((a, b) => {
      if (!userLocation) return 0;
      const aLoc = a.points[0]?.location;
      const bLoc = b.points[0]?.location;
      if (!aLoc && !bLoc) return 0;
      if (!aLoc) return 1;
      if (!bLoc) return -1;
      return haversineMeters(userLocation, aLoc) - haversineMeters(userLocation, bLoc);
  });

  const selectedGame = games.find(g => g.id === selectedGameId) || sortedGames[0];

  const handleStart = () => {
      if (selectedGameId && teamName && userName && userPhoto) {
          localStorage.setItem('geohunt_temp_user_photo', userPhoto);
          onStartGame(selectedGameId, teamName, userName, teamPhoto, 'osm');
      }
  };

  const handleJoinByCode = async () => {
      if (!joinCode) return;

      // CHEAT CODE CHECK
      if (joinCode === '999999' && onInstructorLogin) {
          onInstructorLogin();
          return;
      }

      // In a real implementation, we would look up the team by code
      // For this UI demo, we'll simulate finding a team or just start if valid
      alert("Join logic would verify code: " + joinCode);
  };

  // Handle recovery code submission
  const handleRecoverySubmit = async () => {
      if (!recoveryCode || recoveryCode.length < 6) return;

      setRecoveryLoading(true);
      setRecoveryError(null);

      try {
          const recoveryData = await teamSync.reconnectWithCode(recoveryCode);

          if (!recoveryData) {
              setRecoveryError('Invalid or expired recovery code. Please try again.');
              setRecoveryLoading(false);
              return;
          }

          // Successfully recovered - start the game with recovered identity
          onStartGame(
              recoveryData.gameId,
              recoveryData.teamName,
              recoveryData.userName,
              null, // teamPhoto not stored in recovery
              'osm'
          );
      } catch (e) {
          console.error('[Recovery] Error:', e);
          setRecoveryError('Something went wrong. Please try again.');
          setRecoveryLoading(false);
      }
  };

  // QR Scanning Logic
  React.useEffect(() => {
      let animationFrameId: number;
      let activeStream: MediaStream | null = null;
      
      const scan = () => {
          if (videoRef.current && canvasRef.current && isScanning) {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              
              if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
                  canvas.height = video.videoHeight;
                  canvas.width = video.videoWidth;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const code = jsQR(imageData.data, imageData.width, imageData.height, {
                      inversionAttempts: "dontInvert",
                  });

                  if (code) {
                      setJoinCode(code.data);
                      setMode('JOIN_CODE'); // Switch to code view with filled code
                      setIsScanning(false);
                      return;
                  }
              }
              animationFrameId = requestAnimationFrame(scan);
          }
      };

      if (isScanning) {
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
              .then(stream => {
                  activeStream = stream;
                  if (videoRef.current) {
                      videoRef.current.srcObject = stream;
                      videoRef.current.setAttribute("playsinline", "true");
                      videoRef.current.play();
                      requestAnimationFrame(scan);
                  } else {
                      // Component unmounted before promise resolved
                      stream.getTracks().forEach(t => t.stop());
                  }
              })
              .catch(err => console.error("Error accessing camera", err));
      }

      return () => {
          cancelAnimationFrame(animationFrameId);
          if (activeStream) {
              activeStream.getTracks().forEach(track => track.stop());
          }
          if (videoRef.current && videoRef.current.srcObject) {
              const stream = videoRef.current.srcObject as MediaStream;
              stream.getTracks().forEach(track => track.stop());
          }
      };
  }, [isScanning]);

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 text-white flex flex-col font-sans overflow-hidden">
        {/* Background with Footprints Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/footprints.png')] opacity-10 pointer-events-none" />
        
        {/* ==================== VIEW: MAIN MENU ==================== */}
        {mode === 'MENU' && (
            <div className="flex flex-col h-full items-center relative">
                {/* BACK BUTTON TO HUB */}
                <button 
                    onClick={onBack} 
                    className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 hover:scale-110 active:scale-95"
                    title="Return to Hub"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-6 pt-12 text-center z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg mb-6">
                        <MapPin className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-slate-200 mb-2">
                        CHOOSE YOUR PATH
                    </h1>
                </div>

                <div className="flex-1 flex flex-col justify-center px-6 gap-6 z-10 max-w-sm w-full pb-20">
                    {/* Create Team Button - ORANGE */}
                    <button 
                        onClick={() => {
                            if (games.length > 0) setSelectedGameId(games[0].id);
                            setMode('CREATE_TEAM');
                        }}
                        className="group relative h-40 bg-gradient-to-r from-orange-600 to-red-600 rounded-3xl flex flex-col items-center justify-center shadow-xl hover:scale-[1.02] transition-transform border-t border-orange-400 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
                        <div className="relative z-10 flex flex-col items-center">
                            <Users className="w-10 h-10 text-white mb-3" />
                            <span className="text-2xl font-black uppercase tracking-widest text-white leading-none mb-2">CREATE TEAM</span>
                            <span className="text-[10px] font-bold text-orange-100 uppercase tracking-widest opacity-80">FIRST PERSON JOINS HERE</span>
                        </div>
                    </button>

                    <div className="flex items-center gap-4 text-slate-700 font-black text-[10px] tracking-widest uppercase">
                        <div className="h-px bg-slate-800 flex-1"></div>OR<div className="h-px bg-slate-800 flex-1"></div>
                    </div>

                    {/* Join Team Button - BLUE/DARK */}
                    <button 
                        onClick={() => setMode('JOIN_OPTIONS')}
                        className="group relative h-40 bg-slate-900 border-2 border-slate-800 hover:border-blue-500/50 rounded-3xl flex flex-col items-center justify-center shadow-xl hover:scale-[1.02] transition-transform overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center">
                            <Hash className="w-10 h-10 text-blue-500 mb-3" />
                            <span className="text-2xl font-black uppercase tracking-widest text-white leading-none mb-2">JOIN TEAM</span>
                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-200 uppercase tracking-widest transition-colors">USING CODE OR QR</span>
                        </div>
                    </button>
                </div>
            </div>
        )}

        {/* ==================== VIEW: CREATE TEAM ==================== */}
        {mode === 'CREATE_TEAM' && (
            <div className="flex flex-col h-full items-center bg-slate-950 overflow-y-auto custom-scrollbar">
                <div className="w-full max-w-sm p-6 flex flex-col items-center pb-20">
                    <button onClick={() => setMode('MENU')} className="self-start p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white mb-4">
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-[2rem] flex items-center justify-center shadow-2xl mb-4 relative">
                        <User className="w-12 h-12 text-white" />
                    </div>

                    <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-1">NEW TEAM</h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mb-6">IDENTIFY YOURSELF</p>

                    {/* Game Badge */}
                    {selectedGame && (
                        <div className="bg-orange-600/20 border border-orange-500/50 text-orange-500 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest mb-8 shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                            [{getGameDisplayId(selectedGame.id)}] {selectedGame.name}
                        </div>
                    )}

                    {/* Form Container */}
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-6 shadow-xl">
                        
                        {/* 1. Game Select */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">SELECT GAME</label>
                            <div className="relative">
                                <select 
                                    value={selectedGameId}
                                    onChange={(e) => setSelectedGameId(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white font-bold outline-none appearance-none text-sm uppercase tracking-wide focus:border-blue-500 transition-colors"
                                >
                                    {sortedGames.map(g => (
                                        <option key={g.id} value={g.id}>[{getGameDisplayId(g.id)}] {g.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* 2. Team Name & Avatar */}
                        <div className="space-y-4 pt-4 border-t border-slate-800/50">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">TEAM NAME</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Users className="w-4 h-4" /></div>
                                    <input 
                                        type="text" 
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        placeholder="ENTER TEAM NAME..."
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 pl-12 text-white font-bold outline-none text-sm uppercase tracking-wide focus:border-blue-500 transition-colors placeholder-slate-600"
                                    />
                                </div>
                            </div>

                            {/* Team Avatar (New Requirement) */}
                            <div>
                                <div className="flex justify-between items-center mb-2 ml-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TEAM AVATAR</label>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${teamPhoto ? 'text-green-500' : 'text-slate-600'}`}>{teamPhoto ? 'READY' : 'OPTIONAL'}</span>
                                </div>
                                
                                {!teamPhoto ? (
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-2">
                                        <AvatarCreator 
                                            onConfirm={(img) => setTeamPhoto(img)} 
                                            title="CREATE YOUR TEAM"
                                            placeholder="e.g. Cyberpunk Wolf Pack Neon"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-2xl border border-slate-700">
                                        <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-green-500">
                                            <img src={teamPhoto} className="w-full h-full object-cover" alt="Team" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-white uppercase mb-1">TEAM PHOTO SET</p>
                                            <button onClick={() => setTeamPhoto(null)} className="text-[10px] font-black text-slate-400 uppercase hover:text-white underline">CHANGE</button>
                                        </div>
                                        <Check className="w-6 h-6 text-green-500 mr-2" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. User Name & Avatar */}
                        <div className="space-y-4 pt-4 border-t border-slate-800/50">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">YOUR NAME</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500"><User className="w-4 h-4" /></div>
                                    <input 
                                        type="text" 
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        placeholder="OPERATIVE NAME..."
                                        className="w-full bg-slate-800/50 border border-orange-500/50 rounded-xl p-4 pl-12 text-white font-bold outline-none text-sm uppercase tracking-wide focus:border-orange-500 transition-colors placeholder-slate-600 shadow-[0_0_10px_rgba(234,88,12,0.1)]"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2 ml-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PROFILE AVATAR</label>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${userPhoto ? 'text-green-500' : 'text-red-500'}`}>{userPhoto ? 'READY' : 'REQUIRED'}</span>
                                </div>
                                
                                {!userPhoto ? (
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-2">
                                        <AvatarCreator 
                                            onConfirm={(img) => setUserPhoto(img)} 
                                            title="CREATE YOUR AGENT"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-2xl border border-slate-700">
                                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-green-500">
                                            <img src={userPhoto} className="w-full h-full object-cover" alt="Profile" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-white uppercase mb-1">AVATAR SET</p>
                                            <button onClick={() => setUserPhoto(null)} className="text-[10px] font-black text-slate-400 uppercase hover:text-white underline">CHANGE</button>
                                        </div>
                                        <Check className="w-6 h-6 text-green-500 mr-2" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button 
                            onClick={handleStart}
                            disabled={!teamName || !userName || !selectedGameId || !userPhoto}
                            className="w-full bg-slate-700 hover:bg-orange-600 text-white py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            CREATE LOBBY <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </button>

                    </div>
                </div>
            </div>
        )}

        {/* ==================== VIEW: JOIN OPTIONS ==================== */}
        {mode === 'JOIN_OPTIONS' && (
            <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-950">
                <button onClick={() => setMode('MENU')} className="absolute top-6 left-6 p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <h1 className="text-3xl font-black text-white uppercase tracking-[0.2em] mb-12">JOIN MISSION</h1>

                <div className="flex gap-4 w-full max-w-lg">
                    {/* Enter Code Button */}
                    <button
                        onClick={() => setMode('JOIN_CODE')}
                        className="flex-1 aspect-square bg-slate-900 border-2 border-slate-800 hover:border-orange-500/50 rounded-3xl flex flex-col items-center justify-center gap-4 group transition-all"
                    >
                        <Hash className="w-16 h-16 text-orange-500 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black text-white uppercase tracking-widest">ENTER CODE</span>
                    </button>

                    {/* Scan QR Button */}
                    <button
                        onClick={() => { setMode('JOIN_QR'); setIsScanning(true); }}
                        className="flex-1 aspect-square bg-slate-900 border-2 border-slate-800 hover:border-blue-500/50 rounded-3xl flex flex-col items-center justify-center gap-4 group transition-all"
                    >
                        <QrCode className="w-16 h-16 text-blue-500 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black text-white uppercase tracking-widest">SCAN QR</span>
                    </button>
                </div>

                {/* Recover Device Button */}
                <button
                    onClick={() => { setMode('RECOVER_DEVICE'); setRecoveryError(null); setRecoveryCode(''); }}
                    className="mt-8 px-6 py-3 bg-slate-900/50 border border-slate-800 hover:border-green-500/50 rounded-xl flex items-center gap-3 group transition-all"
                >
                    <Smartphone className="w-5 h-5 text-green-500" />
                    <span className="text-xs font-black text-slate-400 group-hover:text-green-400 uppercase tracking-widest transition-colors">RECOVER FROM ANOTHER DEVICE</span>
                </button>
            </div>
        )}

        {/* ==================== VIEW: JOIN CODE INPUT ==================== */}
        {mode === 'JOIN_CODE' && (
            <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-950">
                <button onClick={() => setMode('JOIN_OPTIONS')} className="absolute top-6 left-6 p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-full max-w-sm text-center">
                    <Hash className="w-12 h-12 text-orange-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-8">ENTER MISSION CODE</h2>
                    
                    <input 
                        type="text" 
                        maxLength={6}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="000000"
                        className="w-full bg-slate-900 border-2 border-slate-800 focus:border-orange-500 rounded-2xl p-6 text-center text-4xl font-black text-white outline-none tracking-[0.5em] mb-8 placeholder-slate-800 font-mono transition-colors"
                        autoFocus
                    />

                    <button 
                        onClick={handleJoinByCode}
                        disabled={joinCode.length < 6}
                        className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg transition-all"
                    >
                        CONFIRM CODE
                    </button>
                </div>
            </div>
        )}

        {/* ==================== VIEW: JOIN QR SCANNER ==================== */}
        {mode === 'JOIN_QR' && (
            <div className="flex flex-col h-full bg-black">
                <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                    <button onClick={() => { setIsScanning(false); setMode('JOIN_OPTIONS'); }} className="p-2 bg-black/50 rounded-full text-white">
                        <X className="w-6 h-6" />
                    </button>
                    <span className="text-xs font-black text-white uppercase tracking-widest">SCAN MISSION QR</span>
                    <div className="w-10"></div>
                </div>

                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanner Overlay */}
                    <div className="relative z-10 w-64 h-64 border-2 border-blue-500 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] flex items-center justify-center">
                        <div className="w-60 h-60 border border-blue-500/30 rounded-2xl animate-pulse" />
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-lg" />
                    </div>
                </div>
            </div>
        )}

        {/* ==================== VIEW: RECOVER DEVICE ==================== */}
        {mode === 'RECOVER_DEVICE' && (
            <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-950">
                <button onClick={() => setMode('JOIN_OPTIONS')} className="absolute top-6 left-6 p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-full max-w-sm text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6">
                        <Smartphone className="w-8 h-8 text-white" />
                    </div>

                    <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">RECOVER ACCESS</h2>
                    <p className="text-xs text-slate-500 mb-8 leading-relaxed">
                        Enter the 6-digit recovery code from your original device to continue playing on this device.
                    </p>

                    <input
                        type="text"
                        maxLength={6}
                        value={recoveryCode}
                        onChange={(e) => {
                            setRecoveryCode(e.target.value.toUpperCase());
                            setRecoveryError(null);
                        }}
                        placeholder="XXXXXX"
                        className="w-full bg-slate-900 border-2 border-slate-800 focus:border-green-500 rounded-2xl p-6 text-center text-4xl font-black text-white outline-none tracking-[0.5em] mb-4 placeholder-slate-800 font-mono transition-colors"
                        autoFocus
                        disabled={recoveryLoading}
                    />

                    {recoveryError && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-4 text-xs font-bold">
                            {recoveryError}
                        </div>
                    )}

                    <button
                        onClick={handleRecoverySubmit}
                        disabled={recoveryCode.length < 6 || recoveryLoading}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        {recoveryLoading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                RECOVERING...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                RECOVER MY GAME
                            </>
                        )}
                    </button>

                    <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider leading-relaxed">
                            Don't have a recovery code? On your original device, tap the BACKUP button during gameplay to generate one.
                        </p>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default WelcomeScreen;
