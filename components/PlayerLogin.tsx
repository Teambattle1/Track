import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Play, QrCode, Loader2, CheckCircle, XCircle, Camera, Globe, Users, Hash, ArrowLeft, User, X, Smartphone, MapPin, ChevronDown, Check } from 'lucide-react';
import * as db from '../services/db';
import { teamSync } from '../services/teamSync';
import { Game, Language } from '../types';
import QRScannerModal from './QRScannerModal';
import AvatarCreator from './AvatarCreator';
import { getApprovedLanguagesForGame } from '../utils/translationValidation';
import { getFlag } from '../utils/i18n';
import { getGameDisplayId } from '../utils/gameIdUtils';
import jsQR from 'jsqr';

interface PlayerLoginProps {
  onComplete: (gameId: string, teamName: string, userName: string, teamPhoto: string | null) => void;
  onBack: () => void;
  /** Pre-selected game — skips intro + game code step, goes straight to CREATE_TEAM */
  preSelectedGame?: Game;
}

type PlayerLoginStep = 'GAME_CODE' | 'TEAM_MENU' | 'CREATE_TEAM' | 'JOIN_OPTIONS' | 'JOIN_CODE' | 'JOIN_QR' | 'RECOVER_DEVICE';

const PlayerLogin: React.FC<PlayerLoginProps> = ({ onComplete, onBack, preSelectedGame }) => {
  // --- INTRO ANIMATION ---
  const hasAutoCode = new URLSearchParams(window.location.search).get('code');
  const [showIntro, setShowIntro] = useState(!hasAutoCode && !preSelectedGame);
  const [introFading, setIntroFading] = useState(false);

  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => {
        setIntroFading(true);
        setTimeout(() => setShowIntro(false), 600);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  const skipIntro = () => {
    if (showIntro && !introFading) {
      setIntroFading(true);
      setTimeout(() => setShowIntro(false), 600);
    }
  };

  // --- STEP STATE ---
  const [step, setStep] = useState<PlayerLoginStep>(preSelectedGame ? 'CREATE_TEAM' : 'GAME_CODE');

  // --- GAME CODE STATE ---
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validGame, setValidGame] = useState<Game | null>(preSelectedGame || null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('English');
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>(['English']);

  // --- TEAM CREATE STATE ---
  const [teamName, setTeamName] = useState('');
  const [teamPhoto, setTeamPhoto] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);

  // --- JOIN STATE ---
  const [joinCode, setJoinCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- RECOVERY STATE ---
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // --- AUTO-FILL FROM URL PARAMS ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAccessCode(code.toUpperCase());
      handleValidateCode(code);
    }
  }, []);

  // --- GAME CODE VALIDATION ---
  const handleValidateCode = async (code?: string) => {
    const codeToValidate = (code || accessCode).trim().toUpperCase();
    if (!codeToValidate) {
      setValidationError('Please enter an access code');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setValidGame(null);

    try {
      const games = await db.fetchGames();
      const matchingGame = games.find(
        game => game.accessCode?.toUpperCase() === codeToValidate
      );

      if (matchingGame) {
        setValidGame(matchingGame);
        setValidationError(null);
        const approvedLangs = getApprovedLanguagesForGame(matchingGame);
        setAvailableLanguages(approvedLangs);
        const gameLanguage = matchingGame.language as Language || 'English';
        if (approvedLangs.includes(gameLanguage)) {
          setSelectedLanguage(gameLanguage);
        } else {
          setSelectedLanguage('English');
        }
      } else {
        setValidationError('Invalid access code. Please check and try again.');
        setValidGame(null);
        setAvailableLanguages(['English']);
        setSelectedLanguage('English');
      }
    } catch (error) {
      console.error('Error validating access code:', error);
      setValidationError('Failed to validate code. Please try again.');
      setValidGame(null);
    } finally {
      setIsValidating(false);
    }
  };

  // --- QR SCAN HANDLER (game code) ---
  const handleQRScan = async (scannedData: string) => {
    setShowQRScanner(false);
    let gameIdOrCode = scannedData.trim().toUpperCase();

    if (scannedData.includes('code=')) {
      const codeMatch = scannedData.match(/code=([^&]+)/);
      if (codeMatch) {
        gameIdOrCode = codeMatch[1];
      }
    }

    if (gameIdOrCode.toLowerCase().startsWith('game-')) {
      setIsValidating(true);
      try {
        const games = await db.fetchGames();
        const game = games.find(g => g.id === gameIdOrCode.toLowerCase());
        if (game) {
          setValidGame(game);
          setAccessCode('');
          setValidationError(null);
          const approvedLangs = getApprovedLanguagesForGame(game);
          setAvailableLanguages(approvedLangs);
          const gameLanguage = game.language as Language || 'English';
          if (approvedLangs.includes(gameLanguage)) {
            setSelectedLanguage(gameLanguage);
          } else {
            setSelectedLanguage('English');
          }
        } else {
          setValidationError('Game not found. Please try again.');
          setValidGame(null);
        }
      } catch (error) {
        console.error('Error fetching game:', error);
        setValidationError('Failed to fetch game. Please try again.');
        setValidGame(null);
      } finally {
        setIsValidating(false);
      }
    } else {
      setAccessCode(gameIdOrCode);
      setValidationError(null);
      setValidGame(null);
      handleValidateCode(gameIdOrCode);
    }
  };

  // --- CONTINUE TO TEAM MENU ---
  const handleContinueToTeam = () => {
    if (validGame) {
      localStorage.setItem(`game_${validGame.id}_language`, selectedLanguage);
      window.history.replaceState({}, '', window.location.pathname);
      setStep('TEAM_MENU');
    }
  };

  // --- CREATE TEAM SUBMIT ---
  const handleCreateTeam = () => {
    if (validGame && teamName && userName) {
      if (userPhoto) {
        localStorage.setItem('geohunt_temp_user_photo', userPhoto);
      }
      onComplete(validGame.id, teamName, userName, teamPhoto);
    }
  };

  // --- JOIN BY CODE ---
  const handleJoinByCode = async () => {
    if (!joinCode) return;
    // TODO: Look up team by code and join
    alert("Join logic would verify code: " + joinCode);
  };

  // --- RECOVERY ---
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
      onComplete(
        recoveryData.gameId,
        recoveryData.teamName,
        recoveryData.userName,
        null
      );
    } catch (e) {
      console.error('[Recovery] Error:', e);
      setRecoveryError('Something went wrong. Please try again.');
      setRecoveryLoading(false);
    }
  };

  // --- QR SCANNING FOR JOIN ---
  useEffect(() => {
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
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code) {
            setJoinCode(code.data);
            setStep('JOIN_CODE');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleValidateCode();
    }
  };

  // ========================================
  // INTRO ANIMATION
  // ========================================
  if (showIntro) {
    return (
      <div
        className={`fixed inset-0 z-[5000] bg-[#0a0e1a] flex items-center justify-center p-4 cursor-pointer transition-opacity duration-500 ${introFading ? 'opacity-0' : 'opacity-100'}`}
        onClick={skipIntro}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/footprints.png')] opacity-5 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,88,12,0.08),transparent_70%)] pointer-events-none" />

        <div className="text-center relative z-10">
          {/* Animated Globe */}
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-700/20 border border-orange-500/30 mb-8 shadow-[0_0_60px_rgba(234,88,12,0.3)]">
            <Globe className="w-16 h-16 text-orange-500" style={{ animation: 'spin 8s linear infinite' }} />
          </div>

          {/* Welcome Text */}
          <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.4em] mb-3" style={{ animation: 'fadeInUp 0.8s ease-out 0.3s both' }}>
            Welcome to
          </p>

          {/* TEAMTRACK */}
          <h1 className="text-6xl sm:text-7xl font-black uppercase tracking-wider mb-2" style={{ animation: 'fadeInUp 0.8s ease-out 0.5s both' }}>
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
              TEAMTRACK
            </span>
          </h1>

          {/* by TEAMBATTLE */}
          <p className="text-lg font-bold text-slate-400 uppercase tracking-[0.3em]" style={{ animation: 'fadeInUp 0.8s ease-out 0.7s both' }}>
            by <span className="text-orange-400/80 font-black">TEAMBATTLE</span>
          </p>

          {/* Animated GPS pin indicator */}
          <div className="mt-10 flex items-center justify-center gap-2" style={{ animation: 'fadeInUp 0.8s ease-out 1s both' }}>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>

          {/* Tap to skip hint */}
          <p className="mt-8 text-[10px] text-slate-600 uppercase tracking-widest" style={{ animation: 'fadeInUp 0.8s ease-out 1.5s both' }}>
            Tap anywhere to continue
          </p>
        </div>

        {/* CSS keyframes */}
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ========================================
  // STEP: GAME_CODE
  // ========================================
  if (step === 'GAME_CODE') {
    return (
      <div className="fixed inset-0 z-[5000] bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-600 to-orange-700 mb-4">
              <KeyRound className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white uppercase tracking-wider mb-2">
              Join Game
            </h1>
            <p className="text-slate-400 text-sm">
              Enter your game code or scan QR to play
            </p>
          </div>

          {/* Access Code Input Card */}
          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-3xl p-8 shadow-2xl shadow-orange-600/40 ring-1 ring-orange-500/30" style={{ animation: 'glowPulse 3s ease-in-out infinite' }}>
            <style>{`
              @keyframes glowPulse {
                0%, 100% { box-shadow: 0 25px 50px -12px rgba(234, 88, 12, 0.4), 0 0 30px rgba(234, 88, 12, 0.15); }
                50% { box-shadow: 0 25px 50px -12px rgba(234, 88, 12, 0.6), 0 0 50px rgba(234, 88, 12, 0.25); }
              }
            `}</style>
            <div className="space-y-6">
              {/* Input */}
              <div>
                <label className="block text-xs font-bold text-white/80 uppercase mb-3 tracking-wide">
                  Enter Game Code
                </label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value.toUpperCase());
                    setValidationError(null);
                    setValidGame(null);
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="GAME2026"
                  maxLength={20}
                  className="w-full bg-slate-900/90 border-2 border-slate-800 rounded-2xl px-6 py-5 text-white text-2xl font-bold uppercase tracking-widest text-center outline-none focus:border-white focus:ring-4 focus:ring-white/20 transition-all placeholder:text-slate-500"
                  disabled={isValidating}
                  autoFocus
                />
              </div>

              {/* Error */}
              {validationError && (
                <div className="flex items-center gap-3 bg-red-900/50 border border-red-300/50 rounded-xl p-4">
                  <XCircle className="w-5 h-5 text-red-100 flex-shrink-0" />
                  <p className="text-sm text-red-100 font-bold">{validationError}</p>
                </div>
              )}

              {/* Valid Game */}
              {validGame && (
                <div className="space-y-4">
                  <div className="bg-green-900/50 border border-green-300/50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-100 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-green-100 mb-1">Game Found!</p>
                        <p className="text-xs text-green-100/90">Ready to join: <strong>{validGame.name}</strong></p>
                      </div>
                    </div>
                  </div>

                  {/* Language Selector */}
                  {availableLanguages.length > 1 && (
                    <div className="bg-slate-900/90 border-2 border-slate-800 rounded-xl p-4">
                      <label className="block text-xs font-bold text-white/80 uppercase mb-3 tracking-wide flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Select Game Language
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {availableLanguages.map(lang => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setSelectedLanguage(lang)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${
                              selectedLanguage === lang
                                ? 'bg-orange-600 text-white shadow-lg scale-105'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <span className="text-xl">{getFlag(lang)}</span>
                            <span className="uppercase tracking-wide">{lang}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {!validGame ? (
                  <>
                    <button
                      onClick={() => handleValidateCode()}
                      disabled={isValidating || !accessCode.trim()}
                      className="w-full py-4 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-700/50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-lg uppercase tracking-wide transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-6 h-6" />
                          Verify Code
                        </>
                      )}
                    </button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-gradient-to-br from-orange-600 to-orange-700 text-white/70 font-bold">OR</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowQRScanner(true)}
                      className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-lg uppercase tracking-wide transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl border border-white/10 hover:border-white/20"
                    >
                      <Camera className="w-6 h-6" />
                      Scan Game QR
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleContinueToTeam}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl font-black text-lg uppercase tracking-wide transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl animate-pulse hover:animate-none"
                  >
                    <Play className="w-6 h-6" />
                    Continue
                  </button>
                )}

              </div>
            </div>
          </div>

          {/* QR Hint */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-slate-400 text-xs">
              <QrCode className="w-4 h-4" />
              <span>Have a QR code? Scan it to auto-fill the code</span>
            </div>
          </div>
        </div>

        {/* QR Scanner Modal */}
        <QRScannerModal
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScan}
        />
      </div>
    );
  }

  // ========================================
  // STEP: TEAM_MENU
  // ========================================
  if (step === 'TEAM_MENU') {
    return (
      <div className="fixed inset-0 z-[5000] bg-slate-950 text-white flex flex-col font-sans overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/footprints.png')] opacity-10 pointer-events-none" />

        <div className="flex flex-col h-full items-center relative">
          {/* Back Button */}
          <button
            onClick={() => setStep('GAME_CODE')}
            className="absolute top-6 left-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 hover:scale-110 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="p-6 pt-12 text-center z-10">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>

            {/* Game Badge */}
            {validGame && (
              <div className="bg-orange-600/20 border border-orange-500/50 text-orange-400 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest mb-4 inline-block shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                {validGame.name}
              </div>
            )}

            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-slate-200 mb-2">
              CHOOSE YOUR PATH
            </h1>
          </div>

          <div className="flex-1 flex flex-col justify-center px-6 gap-6 z-10 max-w-sm w-full pb-20">
            {/* Create Team */}
            <button
              onClick={() => setStep('CREATE_TEAM')}
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

            {/* Join Team */}
            <button
              onClick={() => setStep('JOIN_OPTIONS')}
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
      </div>
    );
  }

  // ========================================
  // STEP: CREATE_TEAM
  // ========================================
  if (step === 'CREATE_TEAM') {
    return (
      <div className="fixed inset-0 z-[5000] bg-slate-950 text-white flex flex-col font-sans overflow-hidden">
        <div className="flex flex-col h-full items-center overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-sm p-6 flex flex-col items-center pb-20">
            <button onClick={() => preSelectedGame ? onBack() : setStep('TEAM_MENU')} className="self-start p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white mb-4">
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-[2rem] flex items-center justify-center shadow-2xl mb-4 relative">
              <User className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-1">NEW TEAM</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mb-4">IDENTIFY YOURSELF</p>

            {/* Game Badge */}
            {validGame && (
              <div className="bg-orange-600/20 border border-orange-500/50 text-orange-500 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest mb-8 shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                [{getGameDisplayId(validGame.id)}] {validGame.name}
              </div>
            )}

            {/* Form */}
            <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-6 shadow-xl">
              {/* Team Name */}
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

              {/* Team Avatar */}
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

              {/* Divider */}
              <div className="border-t border-slate-800/50" />

              {/* User Name */}
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

              {/* User Avatar */}
              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PROFILE AVATAR</label>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${userPhoto ? 'text-green-500' : 'text-slate-600'}`}>{userPhoto ? 'READY' : 'OPTIONAL'}</span>
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

              {/* Submit */}
              <button
                onClick={handleCreateTeam}
                disabled={!teamName || !userName}
                className="w-full bg-slate-700 hover:bg-orange-600 text-white py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                START PLAYING <Play className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // STEP: JOIN_OPTIONS
  // ========================================
  if (step === 'JOIN_OPTIONS') {
    return (
      <div className="fixed inset-0 z-[5000] bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <button onClick={() => setStep('TEAM_MENU')} className="absolute top-6 left-6 p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Game Badge */}
        {validGame && (
          <div className="bg-orange-600/20 border border-orange-500/50 text-orange-400 px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest mb-8 shadow-[0_0_15px_rgba(234,88,12,0.3)]">
            {validGame.name}
          </div>
        )}

        <h1 className="text-3xl font-black text-white uppercase tracking-[0.2em] mb-12">JOIN MISSION</h1>

        <div className="flex gap-4 w-full max-w-lg">
          {/* Enter Code */}
          <button
            onClick={() => setStep('JOIN_CODE')}
            className="flex-1 aspect-square bg-slate-900 border-2 border-slate-800 hover:border-orange-500/50 rounded-3xl flex flex-col items-center justify-center gap-4 group transition-all"
          >
            <Hash className="w-16 h-16 text-orange-500 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-black text-white uppercase tracking-widest">ENTER CODE</span>
          </button>

          {/* Scan QR */}
          <button
            onClick={() => { setStep('JOIN_QR'); setIsScanning(true); }}
            className="flex-1 aspect-square bg-slate-900 border-2 border-slate-800 hover:border-blue-500/50 rounded-3xl flex flex-col items-center justify-center gap-4 group transition-all"
          >
            <QrCode className="w-16 h-16 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-black text-white uppercase tracking-widest">SCAN QR</span>
          </button>
        </div>

        {/* Recover */}
        <button
          onClick={() => { setStep('RECOVER_DEVICE'); setRecoveryError(null); setRecoveryCode(''); }}
          className="mt-8 px-6 py-3 bg-slate-900/50 border border-slate-800 hover:border-green-500/50 rounded-xl flex items-center gap-3 group transition-all"
        >
          <Smartphone className="w-5 h-5 text-green-500" />
          <span className="text-xs font-black text-slate-400 group-hover:text-green-400 uppercase tracking-widest transition-colors">RECOVER FROM ANOTHER DEVICE</span>
        </button>
      </div>
    );
  }

  // ========================================
  // STEP: JOIN_CODE
  // ========================================
  if (step === 'JOIN_CODE') {
    return (
      <div className="fixed inset-0 z-[5000] bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <button onClick={() => setStep('JOIN_OPTIONS')} className="absolute top-6 left-6 p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-full max-w-sm text-center">
          <Hash className="w-12 h-12 text-orange-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-8">ENTER TEAM CODE</h2>

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
    );
  }

  // ========================================
  // STEP: JOIN_QR
  // ========================================
  if (step === 'JOIN_QR') {
    return (
      <div className="fixed inset-0 z-[5000] bg-black text-white flex flex-col">
        <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
          <button onClick={() => { setIsScanning(false); setStep('JOIN_OPTIONS'); }} className="p-2 bg-black/50 rounded-full text-white">
            <X className="w-6 h-6" />
          </button>
          <span className="text-xs font-black text-white uppercase tracking-widest">SCAN TEAM QR</span>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          <div className="relative z-10 w-64 h-64 border-2 border-blue-500 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] flex items-center justify-center">
            <div className="w-60 h-60 border border-blue-500/30 rounded-2xl animate-pulse" />
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-lg" />
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // STEP: RECOVER_DEVICE
  // ========================================
  if (step === 'RECOVER_DEVICE') {
    return (
      <div className="fixed inset-0 z-[5000] bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <button onClick={() => setStep('JOIN_OPTIONS')} className="absolute top-6 left-6 p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white">
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
                <Loader2 className="w-5 h-5 animate-spin" />
                RECOVERING...
              </>
            ) : (
              <>
                <Smartphone className="w-5 h-5" />
                RECOVER MY GAME
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default PlayerLogin;
