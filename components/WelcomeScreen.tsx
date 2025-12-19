import React, { useState, useEffect } from 'react';
import { Game, Coordinate, MapStyleId, Language } from '../types';
import { haversineMeters } from '../utils/geo';
import { t } from '../utils/i18n';
import { Camera, MapPin, CheckCircle, XCircle, Settings, Users, PlayCircle, Loader2, Globe, Languages, QrCode, Mic, HardDrive, Lock, Info, AlertTriangle, Hammer } from 'lucide-react';

interface WelcomeScreenProps {
  games: Game[];
  userLocation: Coordinate | null;
  onStartGame: (gameId: string, teamName: string, mapStyle: MapStyleId) => void;
  onSetMapStyle: (style: MapStyleId) => void;
  language: Language;
  onSetLanguage: (lang: Language) => void;
  onOpenEditor?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
    games, 
    userLocation, 
    onStartGame, 
    onSetMapStyle,
    language,
    onSetLanguage,
    onOpenEditor
}) => {
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [teamName, setTeamName] = useState('');
  const [mapStyle, setMapStyleInternal] = useState<MapStyleId>('osm');
  
  // Checks
  const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [storagePermission, setStoragePermission] = useState<'granted' | 'denied'>('denied');
  
  const [showQr, setShowQr] = useState(false);
  const [permissionHelp, setPermissionHelp] = useState<string | null>(null);
  
  // Device Detection
  const [isIOS, setIsIOS] = useState(false);

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
    }
    
    // Check Storage (Synchronous)
    try {
        localStorage.setItem('geohunt_test', '1');
        localStorage.removeItem('geohunt_test');
        setStoragePermission('granted');
    } catch(e) {
        setStoragePermission('denied');
    }
    
    // Auto-select best game
    if (userLocation && games.length > 0) {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Find games created today OR within 10km
        const nearby = games.filter(g => {
            if (g.points.length === 0) return false;
            // Center of game (avg of points)
            const center = {
                lat: g.points.reduce((sum, p) => sum + p.location.lat, 0) / g.points.length,
                lng: g.points.reduce((sum, p) => sum + p.location.lng, 0) / g.points.length,
            };
            const dist = haversineMeters(userLocation, center);
            const gDate = new Date(g.createdAt);
            
            // Logic: Created today OR within 10km
            const isToday = gDate >= today;
            return isToday || dist < 10000;
        });
        
        if (nearby.length > 0) {
            setSelectedGameId(nearby[0].id);
        } else if (games.length > 0) {
            setSelectedGameId(games[games.length - 1].id); // Fallback to newest
        }
    }
  }, [userLocation, games]);

  const requestCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraPermission('granted');
          stream.getTracks().forEach(t => t.stop());
      } catch (e) {
          setCameraPermission('denied');
          setPermissionHelp('Camera');
      }
  };

  const requestMicrophone = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicPermission('granted');
          stream.getTracks().forEach(t => t.stop());
      } catch (e) {
          setMicPermission('denied');
          setPermissionHelp('Microphone');
      }
  };

  const requestGeo = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
          () => setGeoPermission('granted'),
          () => { setGeoPermission('denied'); setPermissionHelp('Location'); }
      );
  };

  const selectedGame = games.find(g => g.id === selectedGameId);

  // Reusable Status Row
  const StatusRow = ({ 
      icon: Icon, 
      label, 
      status, 
      onRequest, 
      isVital = false 
  }: { icon: any, label: string, status: 'granted' | 'denied' | 'prompt' | 'unknown', onRequest?: () => void, isVital?: boolean }) => {
      
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
          action = (
              <button onClick={() => setPermissionHelp(label)} className="text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1 rounded-full transition-colors border border-red-500/30 font-bold uppercase tracking-wide">
                  {t('fix', language)}
              </button>
          );
      } else {
          // Prompt/Unknown
          statusText = isVital ? t('waiting', language) : t('check', language);
          action = onRequest ? (
              <button onClick={onRequest} className="text-[10px] bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded-full transition-colors font-bold uppercase tracking-wide">
                  {isVital ? t('enable', language) : t('check', language)}
              </button>
          ) : <Loader2 className="w-4 h-4 animate-spin text-orange-400" />;
      }

      return (
        <div className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status === 'granted' ? 'bg-green-500/20 text-green-400' : (status === 'denied' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400')}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <p className="font-bold text-sm text-slate-200">{label}</p>
                    <p className={`text-[10px] uppercase font-bold tracking-wider ${statusColor}`}>{statusText}</p>
                </div>
            </div>
            {action}
        </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900 text-white overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto relative">
            
            {/* Header */}
            <div className="text-center mb-6 animate-in slide-in-from-top-10 duration-500">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-4 transform rotate-3">
                    <MapPin className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-black tracking-tight mb-2 text-white">{t('welcomeTitle', language)}</h1>
                <p className="text-gray-400 text-lg font-medium">{t('welcomeSubtitle', language)}</p>
            </div>

            {/* Permission Help Modal Overlay - IOS SPECIFIC */}
            {permissionHelp && (
                <div className="fixed inset-0 z-[2100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-sm w-full text-center relative shadow-2xl">
                        <button onClick={() => setPermissionHelp(null)} className="absolute top-3 right-3 text-slate-500 hover:text-white"><XCircle className="w-6 h-6" /></button>
                        
                        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">{isIOS ? "iOS Permission Help" : t('permHelpTitle', language)}</h3>
                        
                        <div className="text-left bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4 mb-6">
                            {isIOS ? (
                                <>
                                    <div className="flex gap-3">
                                        <div className="bg-white/10 w-6 h-6 rounded flex items-center justify-center font-bold text-xs">1</div>
                                        <div>
                                            <p className="text-sm font-bold text-orange-400 mb-1">If using Safari:</p>
                                            <p className="text-xs text-slate-300">Tap the <span className="font-bold text-white">"Aa"</span> or <span className="font-bold text-white">Puzzle</span> icon in the address bar (bottom or top). Select <span className="font-bold text-white">Website Settings</span>, then set Location to <span className="font-bold text-white">Allow</span>.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="bg-white/10 w-6 h-6 rounded flex items-center justify-center font-bold text-xs">2</div>
                                        <div>
                                            <p className="text-sm font-bold text-blue-400 mb-1">If using Chrome:</p>
                                            <p className="text-xs text-slate-300">Tap the <span className="font-bold text-white">Three Dots (...)</span> menu. Go to <span className="font-bold text-white">Settings</span> {'>'} <span className="font-bold text-white">Content Settings</span> {'>'} <span className="font-bold text-white">Location</span>.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="bg-white/10 w-6 h-6 rounded flex items-center justify-center font-bold text-xs">3</div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-200 mb-1">System Settings:</p>
                                            <p className="text-xs text-slate-300">Go to iPhone <span className="font-bold text-white">Settings</span> App {'>'} <span className="font-bold text-white">Privacy</span> {'>'} <span className="font-bold text-white">Location Services</span>. Ensure it is ON and your browser is set to "While Using".</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-slate-300 text-sm">{t('permHelpDesc', language)}</p>
                                    <p className="text-xs text-orange-300 mt-2">{t('permHelpInstruction', language)}</p>
                                    <p className="text-xs text-slate-400 mt-2 italic">On Android Chrome, tap the Lock icon left of the URL.</p>
                                </>
                            )}
                        </div>

                        <button 
                            onClick={() => { setPermissionHelp(null); window.location.reload(); }}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold transition-colors"
                        >
                            {t('permHelpButton', language)}
                        </button>
                    </div>
                </div>
            )}

            {/* System Checks */}
            <div className="w-full bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-700 backdrop-blur-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">{t('systemReadiness', language)}</h3>
                
                <div className="space-y-1">
                    <StatusRow 
                        icon={MapPin} 
                        label={t('locationServices', language)}
                        status={userLocation ? 'granted' : geoPermission}
                        onRequest={requestGeo}
                        isVital={true}
                    />
                    <StatusRow 
                        icon={Camera} 
                        label={t('cameraAccess', language)} 
                        status={cameraPermission}
                        onRequest={requestCamera}
                    />
                    <StatusRow 
                        icon={Mic} 
                        label={t('microphoneAccess', language)} 
                        status={micPermission}
                        onRequest={requestMicrophone}
                    />
                    <StatusRow 
                        icon={HardDrive} 
                        label={t('storageAccess', language)} 
                        status={storagePermission}
                    />
                </div>
            </div>

            {/* Game Setup Form */}
            <div className="w-full space-y-4 animate-in slide-in-from-bottom-10 duration-500 delay-100">
                
                {/* Settings Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-orange-400"><Languages className="w-4 h-4" /></div>
                        <select 
                            value={language}
                            onChange={(e) => onSetLanguage(e.target.value as Language)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl py-3 pl-10 pr-3 appearance-none focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer hover:bg-slate-750"
                        >
                            <option value="English">English</option>
                            <option value="Danish">Danish</option>
                            <option value="German">German</option>
                            <option value="Spanish">Spanish</option>
                        </select>
                    </div>
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-orange-400"><Globe className="w-4 h-4" /></div>
                        <select 
                            value={mapStyle}
                            onChange={(e) => { setMapStyleInternal(e.target.value as MapStyleId); onSetMapStyle(e.target.value as MapStyleId); }}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl py-3 pl-10 pr-3 appearance-none focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer hover:bg-slate-750"
                        >
                            <option value="osm">Standard Map</option>
                            <option value="satellite">Satellite</option>
                            <option value="dark">Dark Mode</option>
                            <option value="light">Light Mode</option>
                        </select>
                    </div>
                </div>

                {/* Game Selector */}
                <div className="relative">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block ml-1">{t('selectGame', language)}</label>
                    <select 
                        value={selectedGameId}
                        onChange={(e) => setSelectedGameId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-lg font-bold rounded-xl py-4 px-4 appearance-none focus:ring-2 focus:ring-orange-500 outline-none transition-all cursor-pointer hover:border-slate-600"
                    >
                        {games.length === 0 && <option>{t('noGames', language)}</option>}
                        {games.map(g => (
                            <option key={g.id} value={g.id}>{g.name} ({g.points.length} tasks)</option>
                        ))}
                    </select>
                    {selectedGame && (
                        <div className="absolute right-3 top-9">
                            <button onClick={() => setShowQr(!showQr)} className="p-2 text-gray-400 hover:text-white bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
                                <QrCode className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* QR Display */}
                {showQr && selectedGame && (
                    <div className="bg-white p-4 rounded-xl flex flex-col items-center animate-in zoom-in-95">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedGame.id)}`} 
                            alt="Game QR" 
                            className="w-32 h-32"
                        />
                        <p className="text-slate-900 font-bold text-xs mt-2">{t('scanJoin', language)}</p>
                    </div>
                )}

                {/* Team Name */}
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block ml-1">{t('teamName', language)}</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-focus-within:text-orange-400 transition-colors"><Users className="w-5 h-5" /></div>
                        <input 
                            type="text" 
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder={t('enterTeamName', language)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-lg font-bold rounded-xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-slate-600 transition-all hover:border-slate-600"
                        />
                    </div>
                    <div className="flex items-center gap-2 mt-2 px-1">
                        <Info className="w-4 h-4 text-slate-500" />
                        <p className="text-[10px] text-slate-400">Join same team name on multiple phones to play together.</p>
                    </div>
                </div>

                <button 
                    onClick={() => {
                        if (selectedGameId && teamName) {
                            onStartGame(selectedGameId, teamName, mapStyle);
                        }
                    }}
                    disabled={!selectedGameId || !teamName || !userLocation}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xl font-black py-5 rounded-2xl shadow-xl shadow-orange-900/20 flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 disabled:transform-none"
                >
                    <PlayCircle className="w-8 h-8" />
                    {t('startAdventure', language)}
                </button>
                
                {!userLocation && (
                    <p className="text-center text-xs text-orange-400 animate-pulse font-medium bg-orange-400/10 py-2 rounded-lg">{t('waitingGps', language)}</p>
                )}

                {/* BYPASS BUTTON */}
                <button 
                    onClick={onOpenEditor}
                    className="w-full py-3 text-slate-500 text-xs font-bold hover:text-white hover:bg-slate-800 rounded-xl transition-colors mt-2 flex items-center justify-center gap-2"
                >
                    <Hammer className="w-3 h-3" /> Manage Games / Editor (Skip GPS)
                </button>

            </div>
        </div>
    </div>
  );
};

export default WelcomeScreen;