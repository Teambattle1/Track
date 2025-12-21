
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game, Coordinate, MapStyleId, Language, TeamMember, Team, TeamMemberData } from '../types';
import { haversineMeters } from '../utils/geo';
import { t } from '../utils/i18n';
import { Camera, MapPin, CheckCircle, Users, Loader2, Languages, User, ArrowLeft, RotateCcw, X, Play, Hash, Info, Shield, Trophy, Home, ChevronDown, Lock, AlertTriangle, QrCode, ScanLine, Edit2, Check, LogOut, Target, Trash2 } from 'lucide-react';
import { teamSync } from '../services/teamSync';
import * as db from '../services/db';
import jsQR from 'jsqr';

interface WelcomeScreenProps {
  games: Game[];
  userLocation: Coordinate | null;
  onStartGame: (gameId: string, teamName: string, userName: string, mapStyle: MapStyleId) => void;
  onSetMapStyle: (style: MapStyleId) => void;
  language: Language;
  onSetLanguage: (lang: Language) => void;
  onBack?: () => void;
}

type ViewStep = 'CHOICE' | 'JOIN_OPTIONS' | 'JOIN_CODE' | 'SCAN_QR' | 'MEMBER_DETAILS' | 'TEAM_LOBBY' | 'TAKE_PHOTO';

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
    language,
    onSetLanguage,
    onBack
}) => {
  const [viewStep, setViewStep] = useState<ViewStep>('CHOICE');
  const [selectedGameId, setSelectedGameId] = useState<string>(localStorage.getItem(STORAGE_KEY_GAME_ID) || '');
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState(localStorage.getItem(STORAGE_KEY_PLAYER_NAME) || '');
  const [playerPhoto, setPlayerPhoto] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [isJoiningExisting, setIsJoiningExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isCaptain, setIsCaptain] = useState(false);
  const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  
  // Lobby Interaction States
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [fullscreenDisplay, setFullscreenDisplay] = useState<'QR' | 'CODE' | null>(null);
  const [isEditingTeamName, setIsEditingTeamName] = useState(false);
  const [editedTeamName, setEditedTeamName] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);

  // Initialize Camera when in TAKE_PHOTO or SCAN_QR mode
  useEffect(() => {
      let stream: MediaStream | null = null;

      const initCamera = async () => {
          if (viewStep === 'TAKE_PHOTO' || viewStep === 'SCAN_QR') {
              // Reset scanning state
              scanningRef.current = false;
              
              try {
                  const constraints = {
                      video: { 
                          facingMode: viewStep === 'SCAN_QR' ? 'environment' : facingMode,
                          width: { ideal: 1280 },
                          height: { ideal: 720 }
                      },
                      audio: false
                  };
                  
                  stream = await navigator.mediaDevices.getUserMedia(constraints);
                  
                  if (videoRef.current) {
                      videoRef.current.srcObject = stream;
                      // Ensure video plays (crucial for iOS Safari)
                      await videoRef.current.play().catch(e => console.warn("Video play interrupted:", e));
                  }
                  setCameraPermission('granted');
              } catch (err) {
                  console.error("Camera access denied or error:", err);
                  setCameraPermission('denied');
              }
          }
      };

      initCamera();

      return () => {
          if (stream) {
              stream.getTracks().forEach(track => track.stop());
          }
      };
  }, [viewStep, facingMode]);

  // QR Scanning Loop
  useEffect(() => {
      if (viewStep !== 'SCAN_QR') return;

      let animationFrameId: number;

      const scanTick = () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              
              if (ctx && !scanningRef.current) {
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  
                  try {
                      const code = jsQR(imageData.data, imageData.width, imageData.height, {
                          inversionAttempts: "dontInvert",
                      });

                      if (code && code.data) {
                          console.log("QR Code Found:", code.data);
                          scanningRef.current = true; // Stop scanning to process
                          verifyTeamCode(code.data).then(success => {
                              if (!success) {
                                  // Wait before scanning again to avoid spam
                                  setTimeout(() => { scanningRef.current = false; }, 2000);
                              }
                          });
                      }
                  } catch (e) {
                      console.error("QR Scan Error", e);
                  }
              }
          }
          animationFrameId = requestAnimationFrame(scanTick);
      };

      scanTick();

      return () => cancelAnimationFrame(animationFrameId);
  }, [viewStep]);

  // Filter Logic: Games active TODAY and within 500m
  const relevantGames = useMemo(() => {
      // 1. Sort all by distance first
      const allSorted = games.map(g => {
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

      // 2. Filter STRICT: Created Today + < 500m
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const strictMatches = allSorted.filter(g => {
          const gDate = new Date(g.createdAt);
          gDate.setHours(0,0,0,0);
          const isToday = gDate.getTime() === today.getTime();
          const inRange = (g.distance || 999999) <= 500;
          return isToday && inRange;
      });

      // 3. Fallback: If no strict matches found, return all available games (for testing/offsite)
      return strictMatches.length > 0 ? strictMatches : allSorted;
  }, [games, userLocation]);

  const showGameSelector = relevantGames.length > 1;

  useEffect(() => {
    // Auto-select if there's only one relevant game (or 1 fallback game)
    if (relevantGames.length === 1 && relevantGames[0].id !== selectedGameId) {
        setSelectedGameId(relevantGames[0].id);
    } else if (relevantGames.length > 1 && !selectedGameId) {
        // Default to nearest/first if multiple
        setSelectedGameId(relevantGames[0].id);
    }
  }, [relevantGames, selectedGameId]);

  useEffect(() => {
    if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
            setGeoPermission(result.state);
            result.onchange = () => setGeoPermission(result.state);
        });
    }
  }, []);

  // Poll for team updates when in lobby
  useEffect(() => {
      if (viewStep === 'TEAM_LOBBY' && targetTeamId) {
          const poll = async () => {
              const team = await db.fetchTeam(targetTeamId);
              if (team) {
                  setCurrentTeam(team);
                  
                  // Safe Captain Check
                  const myId = teamSync.getDeviceId();
                  const isNowCaptain = team.captainDeviceId === myId;
                  setIsCaptain(isNowCaptain);
                  
                  // Auto-start for members when captain starts
                  if (team.isStarted) {
                      onStartGame(team.gameId, team.name, playerName, 'osm');
                  }
              }
          };
          
          const interval = setInterval(poll, 3000);
          return () => clearInterval(interval);
      }
  }, [viewStep, targetTeamId, playerName, onStartGame]);

  const handleCapturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              if (facingMode === 'user') {
                  ctx.translate(canvas.width, 0);
                  ctx.scale(-1, 1);
              }
              ctx.drawImage(video, 0, 0);
              setPlayerPhoto(canvas.toDataURL('image/jpeg', 0.8));
              setViewStep('MEMBER_DETAILS');
          }
      }
  };

  const verifyTeamCode = async (code: string): Promise<boolean> => {
      setIsLoading(true);
      try {
          let foundTeam: Team | null = null;
          // Check all available games for the code
          for (const game of games) {
              const teams = await db.fetchTeams(game.id);
              const t = teams.find(team => team.joinCode === code);
              if (t) { foundTeam = t; break; }
          }
          
          if (foundTeam) {
              setTargetTeamId(foundTeam.id);
              setTeamName(foundTeam.name);
              
              // Ensure we select the game context so the UI can show the game name
              if (foundTeam.gameId) setSelectedGameId(foundTeam.gameId);

              setIsJoiningExisting(true);
              setViewStep('MEMBER_DETAILS');
              return true;
          } else {
              return false;
          }
      } catch (e) { 
          console.error(e); 
          return false; 
      } finally { 
          setIsLoading(false); 
      }
  };

  const handleManualCodeSubmit = async () => {
      if (manualCode.length < 6) return;
      const success = await verifyTeamCode(manualCode);
      if (!success) alert("Invalid Team Code.");
  };

  const handleEnterLobby = async () => {
      if (!playerName || !playerPhoto || (!isJoiningExisting && !teamName)) return;
      
      setIsLoading(true);
      const deviceId = teamSync.getDeviceId();
      localStorage.setItem(STORAGE_KEY_PLAYER_NAME, playerName);

      try {
          let team: Team;
          if (isJoiningExisting && targetTeamId) {
              // Re-fetch to be safe
              const existing = await db.fetchTeam(targetTeamId);
              if (!existing) throw new Error("Team not found");
              
              // Normalize existing members to robust TeamMemberData objects
              const cleanExisting: TeamMemberData[] = existing.members.map((m: any) => {
                  if (typeof m === 'string') {
                      // Handle legacy string data
                      return { name: m, deviceId: `legacy-${m}-${Date.now()}`, photo: undefined };
                  }
                  return m;
              });

              const newMember: TeamMemberData = { name: playerName, photo: playerPhoto || undefined, deviceId };
              
              // Filter out duplicate me (by deviceId OR name to be safe against double joins)
              const otherMembers = cleanExisting.filter(m => m.deviceId !== deviceId && m.name !== playerName);
              const updatedMembers = [...otherMembers, newMember];
              
              team = { ...existing, members: updatedMembers };
          } else {
              const gameId = selectedGameId;
              const cleanTeamName = teamName.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
              const generatedId = `team-${cleanTeamName}-${gameId}`;
              
              team = {
                  id: generatedId,
                  gameId,
                  name: teamName,
                  joinCode: getJoinCode(teamName),
                  members: [{ name: playerName, photo: playerPhoto || undefined, deviceId }],
                  score: 0,
                  updatedAt: new Date().toISOString(),
                  captainDeviceId: deviceId, // Creator becomes captain
                  isStarted: false
              };
          }

          // Optimistic update for instant UI feedback
          setCurrentTeam(team);
          setTargetTeamId(team.id);
          setIsCaptain(team.captainDeviceId === deviceId);
          setEditedTeamName(team.name); // Pre-fill edit field
          
          await db.registerTeam(team);
          teamSync.connect(team.gameId, team.name, playerName);
          setViewStep('TEAM_LOBBY');
      } catch (e) {
          console.error(e);
          alert("Failed to join lobby. Please check connection.");
      } finally { setIsLoading(false); }
  };

  const handleUpdateTeamName = async () => {
      if (!currentTeam || !editedTeamName.trim()) return;
      
      setIsLoading(true);
      try {
          await db.updateTeamName(currentTeam.id, editedTeamName);
          setCurrentTeam({ ...currentTeam, name: editedTeamName }); // Optimistic
          setIsEditingTeamName(false);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
  };

  const handlePromoteCaptain = async (memberDeviceId: string) => {
      if (!currentTeam || !isCaptain) return;
      
      const confirmPromote = confirm("Make this member the new Captain? You will lose captain status.");
      if (confirmPromote) {
          await db.updateTeamCaptain(currentTeam.id, memberDeviceId);
          // Local update will happen on next poll, but we can set locally too
          setCurrentTeam({ ...currentTeam, captainDeviceId: memberDeviceId });
          setIsCaptain(false);
      }
  };

  const handleKickMember = async (memberDeviceId: string, memberName: string) => {
      if (!currentTeam || !isCaptain) return;
      
      if (confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
          const remainingMembers = currentTeam.members.filter(m => {
              const mId = typeof m === 'string' ? '' : m.deviceId;
              return mId !== memberDeviceId;
          });
          
          await db.updateTeamMembers(currentTeam.id, remainingMembers as TeamMemberData[]);
          // Optimistic update
          setCurrentTeam({...currentTeam, members: remainingMembers as TeamMemberData[]});
      }
  };

  const handleLeaveTeam = async () => {
      if (!currentTeam) return;
      const myId = teamSync.getDeviceId();
      const confirmLeave = confirm("Are you sure you want to leave this team?");
      if (confirmLeave) {
          const remainingMembers = currentTeam.members.filter(m => {
              // Handle mixed types just in case
              const mId = typeof m === 'string' ? '' : m.deviceId;
              return mId !== myId;
          });
          
          await db.updateTeamMembers(currentTeam.id, remainingMembers as TeamMemberData[]);
          // If I was captain and others remain, promote first one
          if (isCaptain && remainingMembers.length > 0) {
              const nextCaptain = remainingMembers[0];
              const nextId = typeof nextCaptain === 'string' ? '' : nextCaptain.deviceId;
              if (nextId) await db.updateTeamCaptain(currentTeam.id, nextId);
          }
          teamSync.disconnect();
          setViewStep('CHOICE');
      }
  };

  const handleStartMission = async () => {
      if (!targetTeamId) return;
      setIsLoading(true);
      try {
          await db.updateTeamStatus(targetTeamId, true);
          onStartGame(selectedGameId, currentTeam?.name || teamName, playerName, 'osm');
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); setShowStartConfirm(false); }
  };

  const toggleCamera = () => {
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const goBack = () => {
      if (viewStep === 'MEMBER_DETAILS') setViewStep('CHOICE');
      else if (viewStep === 'JOIN_OPTIONS') setViewStep('CHOICE');
      else if (viewStep === 'JOIN_CODE') setViewStep('JOIN_OPTIONS');
      else if (viewStep === 'SCAN_QR') setViewStep('JOIN_OPTIONS');
      else if (viewStep === 'TAKE_PHOTO') setViewStep('MEMBER_DETAILS');
      else if (viewStep === 'TEAM_LOBBY') { 
          // Just exiting the screen, not leaving the team data
          setViewStep('CHOICE'); 
          teamSync.disconnect(); 
      }
      else if (onBack) onBack();
  };

  // --- RENDERERS ---

  if (viewStep === 'CHOICE') {
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col items-center justify-center p-6 uppercase font-sans relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />
            <div className="absolute top-4 left-4 z-10"><button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full text-white font-black text-[10px] tracking-widest uppercase hover:bg-slate-700"><Home className="w-4 h-4" /> HUB</button></div>
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-4 transform rotate-3 relative z-10"><MapPin className="w-10 h-10 text-white" /></div>
            <h1 className="text-4xl font-black mb-12 tracking-[0.2em] text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 uppercase leading-tight relative z-10">CHOOSE YOUR PATH</h1>
            <div className="flex flex-col gap-6 w-full max-w-sm relative z-10">
                <button onClick={() => { setIsJoiningExisting(false); setViewStep('MEMBER_DETAILS'); }} className="group relative h-44 bg-orange-600 rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-[1.03] active:scale-95 border-2 border-orange-500/50">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-700 opacity-90" />
                    <div className="relative z-10 flex flex-col items-center">
                        <Users className="w-12 h-12 mb-2 text-white group-hover:scale-110 transition-transform" />
                        <span className="text-2xl font-black tracking-[0.2em] uppercase">CREATE TEAM</span>
                        <span className="text-[10px] font-bold opacity-60 mt-1 text-center">FIRST PERSON JOINS HERE</span>
                    </div>
                </button>
                <div className="flex items-center gap-4 text-slate-800 font-black text-[10px] tracking-widest"><div className="h-px bg-slate-800 flex-1"></div>OR<div className="h-px bg-slate-800 flex-1"></div></div>
                <button onClick={() => setViewStep('JOIN_OPTIONS')} className="group relative h-44 bg-slate-900 rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:scale-[1.03] active:scale-95 border-2 border-slate-800">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 opacity-90" />
                    <div className="relative z-10 flex flex-col items-center">
                        <Hash className="w-12 h-12 mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-2xl font-black tracking-[0.2em] uppercase">JOIN TEAM</span>
                        <span className="text-[10px] font-bold opacity-60 mt-1">USING CODE OR QR</span>
                    </div>
                </button>
            </div>
        </div>
      );
  }

  if (viewStep === 'MEMBER_DETAILS') {
      const activeGameName = games.find(g => g.id === selectedGameId)?.name;

      return (
        <div className="fixed inset-0 z-[2000] bg-slate-950 text-white overflow-y-auto uppercase font-sans relative">
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />
            <div className="min-h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto relative z-10">
                <button onClick={goBack} className="absolute top-4 left-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white transition-all"><ArrowLeft className="w-6 h-6" /></button>
                <div className="text-center mb-6 mt-4 animate-in slide-in-from-top-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-4 transform rotate-3"><User className="w-10 h-10 text-white" /></div>
                    <h1 className="text-4xl font-black tracking-tight mb-1 text-white">{isJoiningExisting ? 'JOIN MISSION' : 'NEW TEAM'}</h1>
                    <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mb-3">IDENTIFY YOURSELF</p>
                    
                    {/* Game Name Badge */}
                    {activeGameName && (
                        <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.6)] animate-in zoom-in duration-300 border-t border-orange-400/50 mt-2 transform hover:scale-105 transition-transform">
                            <Target className="w-4 h-4 text-white drop-shadow-sm" />
                            <span className="text-sm font-black text-white uppercase tracking-[0.2em] drop-shadow-md">{activeGameName}</span>
                        </div>
                    )}
                </div>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />
                    <div className="space-y-6 relative z-10">
                        {!isJoiningExisting && (
                            <>
                                {showGameSelector ? (
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">SELECT GAME</label>
                                        <div className="relative">
                                            <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-800 border-2 border-slate-700 text-white font-black tracking-widest outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer uppercase text-xs">
                                                {relevantGames.map(g => (<option key={g.id} value={g.id}>{g.name} {g.distance !== null && g.distance <= 500 ? '📍' : ''}</option>))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex items-center gap-3">
                                        <div className="p-2 bg-orange-600 rounded-lg"><MapPin className="w-4 h-4 text-white" /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ACTIVE GAME</p>
                                            <p className="text-sm font-black text-white">{relevantGames.find(g => g.id === selectedGameId)?.name || "Loading..."}</p>
                                        </div>
                                    </div>
                                )}
                                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">TEAM NAME</label>
                                    <div className="relative"><Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" /><input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="ENTER TEAM NAME..." className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-700 bg-slate-800 text-white font-black tracking-[0.2em] text-xs outline-none focus:border-orange-500 transition-all uppercase" /></div>
                                </div>
                            </>
                        )}
                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">YOUR NAME</label>
                            <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" /><input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="OPERATIVE NAME..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-800 border-2 border-orange-500/50 text-white font-black tracking-[0.2em] text-xs placeholder:text-slate-600 outline-none focus:border-orange-500 transition-all uppercase" /></div>
                        </div>
                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex justify-between"><span>PROFILE PHOTO</span> {playerPhoto ? <span className="text-green-500 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> READY</span> : <span className="text-red-500 flex items-center gap-1">REQUIRED</span>}</label>
                            {playerPhoto ? (
                                <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-slate-800 group cursor-pointer border-2 border-green-500/50 shadow-lg" onClick={() => setViewStep('TAKE_PHOTO')}>
                                    <img src={playerPhoto} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><RotateCcw className="w-8 h-8 text-white" /></div>
                                </div>
                            ) : (
                                <button onClick={() => setViewStep('TAKE_PHOTO')} className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-600 hover:bg-slate-800 hover:text-orange-500 hover:border-orange-500 transition-all uppercase font-black tracking-widest relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <Camera className="w-8 h-8 mb-1 relative z-10" />
                                    <span className="text-[9px] font-black tracking-[0.3em] relative z-10">TAKE PROFILE PHOTO</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={handleEnterLobby} 
                        disabled={!playerName || !playerPhoto || (!isJoiningExisting && !teamName) || isLoading} 
                        className="w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed mt-8 relative z-10 bg-gradient-to-r from-orange-600 to-red-600 text-white border border-white/10"
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>{isJoiningExisting ? 'SYNC & JOIN' : 'CREATE LOBBY'} <ArrowLeft className="w-6 h-6 rotate-180" /></>}
                    </button>
                </div>
            </div>
        </div>
      );
  }

  if (viewStep === 'JOIN_OPTIONS') {
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col items-center justify-center p-6 uppercase font-sans animate-in fade-in relative">
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />
            <div className="absolute top-4 left-4 z-10"><button onClick={goBack} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700"><ArrowLeft className="w-6 h-6" /></button></div>
            <h2 className="text-3xl font-black mb-12 tracking-[0.2em] uppercase text-center relative z-10">JOIN MISSION</h2>
            <div className="grid grid-cols-2 gap-4 w-full max-w-lg relative z-10">
                <button onClick={() => setViewStep('JOIN_CODE')} className="bg-slate-900 border-2 border-slate-800 p-8 rounded-3xl flex flex-col items-center gap-4 hover:border-orange-500 transition-all group shadow-xl">
                    <Hash className="w-12 h-12 text-orange-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-black tracking-widest uppercase text-center">ENTER CODE</span>
                </button>
                <button onClick={() => setViewStep('SCAN_QR')} className="bg-slate-900 border-2 border-slate-800 p-8 rounded-3xl flex flex-col items-center gap-4 hover:border-blue-500 transition-all group shadow-xl">
                    <QrCode className="w-12 h-12 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-black tracking-widest uppercase text-center">SCAN QR</span>
                </button>
            </div>
        </div>
      );
  }

  if (viewStep === 'JOIN_CODE') {
    return (
      <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col items-center justify-center p-6 uppercase font-sans animate-in zoom-in-95 relative">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />
          <div className="absolute top-4 left-4 z-10"><button onClick={goBack} className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700"><ArrowLeft className="w-6 h-6" /></button></div>
          <div className="w-full max-w-sm text-center relative z-10">
              <div className="w-20 h-20 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-orange-500/50"><Hash className="w-10 h-10 text-orange-500" /></div>
              <h2 className="text-3xl font-black mb-4 tracking-[0.2em] uppercase">ENTER CODE</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">GET THE 6-DIGIT CODE FROM YOUR CAPTAIN</p>
              <div className="relative mb-8">
                  <input type="text" maxLength={6} value={manualCode} onChange={(e) => setManualCode(e.target.value.replace(/[^0-9]/g, ''))} placeholder="000000" className="w-full bg-slate-900 border-4 border-slate-800 rounded-2xl py-6 text-5xl font-mono font-black text-center text-white tracking-[0.3em] outline-none focus:border-orange-500 transition-all shadow-inner" autoFocus />
              </div>
              <button onClick={handleManualCodeSubmit} disabled={manualCode.length < 6 || isLoading} className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black text-xl tracking-[0.2em] shadow-xl disabled:opacity-30 transition-all active:scale-95">
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'VERIFY CODE'}
              </button>
          </div>
      </div>
    );
  }

  if (viewStep === 'SCAN_QR') {
      return (
        <div className="fixed inset-0 z-[2100] bg-black text-white flex flex-col uppercase font-sans overflow-hidden">
            <div className="relative flex-1 overflow-hidden">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted autoPlay playsInline />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Scanner Overlay */}
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                    <div className="w-64 h-64 border-4 border-orange-500 rounded-3xl relative animate-pulse shadow-[0_0_100px_rgba(249,115,22,0.3)]">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white -mt-1 -ml-1 rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white -mt-1 -mr-1 rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white -mb-1 -ml-1 rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white -mb-1 -mr-1 rounded-br-xl" />
                        <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full text-orange-500/20 animate-ping" />
                    </div>
                    <p className="mt-8 text-sm font-black tracking-widest uppercase text-white drop-shadow-md">ALIGN QR CODE IN FRAME</p>
                </div>
            </div>
            
            <div className="p-8 bg-slate-950 border-t border-slate-800 flex justify-center items-center relative shadow-2xl shrink-0">
                <button onClick={goBack} className="absolute left-8 p-4 bg-slate-900 rounded-2xl hover:bg-slate-800 transition-all"><ArrowLeft className="w-6 h-6" /></button>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SCANNING...</div>
            </div>
        </div>
      );
  }

  if (viewStep === 'TEAM_LOBBY') {
      const activeMembers = currentTeam?.members || [];
      return (
        <div className="fixed inset-0 z-[2000] bg-slate-950 text-white flex flex-col font-sans relative overflow-hidden animate-in fade-in duration-500">
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />
            
            {/* Lobby Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950 flex flex-col gap-4 z-10 shadow-xl shrink-0">
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-4">
                        {isEditingTeamName && isCaptain ? (
                            <div className="flex items-center gap-2 mb-2">
                                <input 
                                    type="text" 
                                    value={editedTeamName} 
                                    onChange={(e) => setEditedTeamName(e.target.value)} 
                                    className="bg-slate-900 border border-slate-700 text-white text-xl font-black uppercase rounded p-1 w-full"
                                    autoFocus
                                />
                                <button onClick={handleUpdateTeamName} className="p-1 bg-green-600 rounded hover:bg-green-700"><Check className="w-5 h-5"/></button>
                                <button onClick={() => setIsEditingTeamName(false)} className="p-1 bg-slate-700 rounded hover:bg-slate-600"><X className="w-5 h-5"/></button>
                            </div>
                        ) : (
                            <h1 className="text-2xl sm:text-3xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 truncate flex items-center gap-2">
                                {currentTeam?.name}
                                {isCaptain && (
                                    <button onClick={() => { setIsEditingTeamName(true); setEditedTeamName(currentTeam?.name || ''); }} className="text-slate-600 hover:text-white transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                )}
                            </h1>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <button onClick={() => setFullscreenDisplay('QR')} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 transition-all">
                                <QrCode className="w-3 h-3" /> <span className="text-[10px] font-black tracking-widest">QR</span>
                            </button>
                            <button onClick={() => setFullscreenDisplay('CODE')} className="bg-orange-600/20 hover:bg-orange-600/30 text-orange-500 px-3 py-1.5 rounded-lg border border-orange-500/30 flex items-center gap-2 transition-all">
                                <Hash className="w-3 h-3" /> <span className="text-[10px] font-black tracking-widest font-mono">{currentTeam?.joinCode}</span>
                            </button>
                            <div className="bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase border border-slate-700">{activeMembers.length} OPERATIVES</div>
                        </div>
                    </div>
                    <button onClick={goBack} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full text-white shrink-0"><X className="w-6 h-6" /></button>
                </div>
            </div>

            {/* Member Grid - Fullscreen & Responsive */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 z-10 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto pb-24">
                    {activeMembers.map((member, i) => {
                        // Handle both legacy string and new object member types
                        const memberName = typeof member === 'string' ? member : member.name;
                        const memberPhoto = typeof member === 'string' ? null : member.photo;
                        const memberId = typeof member === 'string' ? null : member.deviceId;
                        
                        const isSelf = memberId === teamSync.getDeviceId();
                        const isMemberCaptain = memberId === currentTeam?.captainDeviceId;
                        
                        return (
                            <div key={i} onClick={() => isSelf && setViewStep('TAKE_PHOTO')} className={`group relative bg-slate-900 border-2 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 shadow-2xl transition-all aspect-square flex flex-col items-center justify-center ${isSelf ? 'border-orange-500 ring-2 sm:ring-4 ring-orange-500/10 cursor-pointer hover:scale-105' : 'border-slate-800 hover:border-slate-700'}`}>
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/footprints.png')]" />
                                
                                {isMemberCaptain && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-3 py-1 rounded-full font-black text-[8px] sm:text-[9px] tracking-[0.2em] flex items-center gap-1 shadow-lg border border-orange-400 uppercase z-20 whitespace-nowrap">
                                        <Shield className="w-3 h-3" /> CAPTAIN
                                    </div>
                                )}

                                <div className="flex-1 flex flex-col items-center justify-center w-full">
                                    <div className={`w-20 h-20 sm:w-32 sm:h-32 rounded-full mb-3 sm:mb-4 border-4 overflow-hidden shadow-inner bg-slate-800 shrink-0 relative ${isSelf ? 'border-orange-500' : 'border-slate-700'}`}>
                                        {memberPhoto ? <img src={memberPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="w-8 h-8 sm:w-12 sm:h-12 text-slate-700" /></div>}
                                        {isSelf && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Edit2 className="w-6 h-6 sm:w-8 sm:h-8 text-white drop-shadow-md" />
                                            </div>
                                        )}
                                    </div>
                                    <h3 className={`text-sm sm:text-xl font-black tracking-widest uppercase text-center truncate w-full ${isSelf ? 'text-white' : 'text-slate-400'}`}>{memberName}</h3>
                                    
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[8px] sm:text-[9px] font-black text-green-500 tracking-widest uppercase">READY</span>
                                    </div>

                                    {/* Promote Button (Captain Only) */}
                                    {isCaptain && !isMemberCaptain && !isSelf && memberId && (
                                        <div className="absolute bottom-4 right-4 flex gap-1 z-20">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handlePromoteCaptain(memberId); }}
                                                className="bg-slate-800 p-2 rounded-full border border-slate-600 hover:bg-orange-600 hover:border-orange-500 text-slate-400 hover:text-white transition-all shadow-lg"
                                                title="Promote to Captain"
                                            >
                                                <Shield className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleKickMember(memberId, memberName); }}
                                                className="bg-slate-800 p-2 rounded-full border border-slate-600 hover:bg-red-600 hover:border-red-500 text-slate-400 hover:text-white transition-all shadow-lg"
                                                title="Remove Member"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Leave Team Button (Top Left Overlay or Footer) */}
            <button 
                onClick={handleLeaveTeam}
                className="absolute top-24 left-6 z-20 bg-slate-900/50 backdrop-blur text-red-500 hover:text-red-400 hover:bg-slate-900 px-3 py-1.5 rounded-lg border border-red-900/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
            >
                <LogOut className="w-3 h-3" /> Leave Team
            </button>

            {/* Sticky Action Bar */}
            <div className="p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 z-20 flex justify-center absolute bottom-0 left-0 right-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                {isCaptain ? (
                    <div className="w-full max-w-sm flex flex-col gap-4">
                        <button onClick={() => setShowStartConfirm(true)} disabled={isLoading} className="w-full py-4 sm:py-5 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl font-black text-lg sm:text-xl tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 text-white border border-white/10">
                            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>{currentTeam?.isStarted ? 'RESUME MISSION' : 'START MISSION'} <Play className="w-6 h-6 sm:w-8 sm:h-8" /></>}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 py-2">
                        <div className="bg-slate-900 px-6 py-3 rounded-full border border-slate-800 flex items-center gap-3">
                            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                            <span className="text-[10px] sm:text-[11px] font-black text-slate-300 tracking-[0.2em] uppercase text-center">WAITING FOR CAPTAIN...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Captain Confirmation Modal */}
            {showStartConfirm && (
                <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-slate-900 border-2 border-orange-500 w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl relative animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-orange-500/50">
                            <AlertTriangle className="w-8 h-8 text-orange-500" />
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">START GAME?</h2>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-wide mb-8">
                            Are all {activeMembers.length} members ready on the team?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleStartMission} 
                                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95"
                            >
                                YES, START
                            </button>
                            <button 
                                onClick={() => setShowStartConfirm(false)} 
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all"
                            >
                                WAIT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Code/QR Overlay */}
            {fullscreenDisplay && (
                <div className="fixed inset-0 z-[3000] bg-black flex flex-col items-center justify-center p-8 animate-in fade-in cursor-pointer" onClick={() => setFullscreenDisplay(null)}>
                    <button onClick={() => setFullscreenDisplay(null)} className="absolute top-6 right-6 p-4 bg-slate-900 rounded-full text-white hover:bg-slate-800"><X className="w-8 h-8" /></button>
                    
                    {fullscreenDisplay === 'QR' && (
                        <div className="text-center w-full flex flex-col items-center animate-in zoom-in-95">
                            <div className="bg-white p-4 rounded-3xl mb-8 shadow-2xl mx-auto max-w-sm w-full aspect-square flex items-center justify-center">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(currentTeam?.joinCode || '')}`} alt="Team QR" className="w-full h-full object-contain" />
                            </div>
                            <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] mb-2">SCAN TO JOIN</h2>
                            <p className="text-orange-500 font-bold text-xl tracking-widest uppercase">{currentTeam?.name}</p>
                        </div>
                    )}

                    {fullscreenDisplay === 'CODE' && (
                        <div className="text-center w-full animate-in zoom-in-95">
                            <p className="text-slate-500 font-bold text-2xl uppercase tracking-[0.5em] mb-8">TEAM CODE</p>
                            <h2 className="text-[15vw] leading-none font-black text-white tracking-tighter font-mono break-all">{currentTeam?.joinCode}</h2>
                            <p className="text-orange-500 font-bold text-xl tracking-widest mt-8 uppercase">{currentTeam?.name}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[2100] bg-black text-white flex flex-col uppercase font-sans overflow-hidden">
        <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted autoPlay playsInline />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white/50 rounded-full border-dashed animate-spin-slow pointer-events-none" />
        </div>
        <div className="p-8 bg-slate-950 border-t border-slate-800 flex justify-between items-center relative shadow-2xl">
            <button onClick={goBack} className="p-4 bg-slate-900 rounded-2xl hover:bg-slate-800 transition-all"><X className="w-8 h-8" /></button>
            <button onClick={handleCapturePhoto} className="w-24 h-24 rounded-full border-[6px] border-white bg-white/20 hover:bg-white/40 transition-all transform active:scale-90 shadow-2xl"></button>
            <button onClick={toggleCamera} className="p-4 bg-slate-900 rounded-2xl hover:bg-slate-800 transition-all"><RotateCcw className="w-8 h-8" /></button>
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-4 py-2 rounded-xl font-black text-xs tracking-widest shadow-xl">ALIGN FACE IN CENTER</div>
        </div>
    </div>
  );
};

export default WelcomeScreen;
