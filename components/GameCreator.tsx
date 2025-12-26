
import React, { useState, useRef, useEffect } from 'react';
import { Game, TimerConfig, TimerMode, MapStyleId, Language } from '../types';
import { X, Gamepad2, Calendar, Building2, Upload, Search, Loader2, Clock, Hourglass, StopCircle, CheckCircle, Image as ImageIcon, Save, Edit, Map, Layers, Globe } from 'lucide-react';
import { searchLogoUrl } from '../services/ai';

interface GameCreatorProps {
  onClose: () => void;
  onCreate: (game: Partial<Game>) => void;
  baseGame?: Game; // Optional for edit mode in future
}

const MAP_STYLES: { id: MapStyleId; label: string }[] = [
    { id: 'osm', label: 'Standard' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'dark', label: 'Dark Mode' },
    { id: 'light', label: 'Light Mode' },
    { id: 'winter', label: 'Winter (Norway)' },
    { id: 'clean', label: 'Clean' },
    { id: 'voyager', label: 'Voyager' }
];

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
    { value: 'Danish', label: '🇩🇰 Danish (Dansk)' },
    { value: 'English', label: '🇬🇧 English' },
    { value: 'German', label: '🇩🇪 German (Deutsch)' },
    { value: 'Spanish', label: '🇪🇸 Spanish (Español)' },
    { value: 'French', label: '🇫🇷 French (Français)' },
    { value: 'Swedish', label: '🇸🇪 Swedish (Svenska)' },
    { value: 'Norwegian', label: '🇳🇴 Norwegian (Norsk)' },
    { value: 'Dutch', label: '🇳🇱 Dutch (Nederlands)' },
    { value: 'Belgian', label: '🇧🇪 Belgian (Vlaams)' },
    { value: 'Hebrew', label: '🇮🇱 Hebrew (Ivrit)' },
];

const GameCreator: React.FC<GameCreatorProps> = ({ onClose, onCreate, baseGame }) => {
  const [name, setName] = useState(baseGame?.name || '');
  const [description, setDescription] = useState(baseGame?.description || '');
  const [language, setLanguage] = useState<Language>(baseGame?.language || 'Danish');
  
  // Client Info
  const [clientName, setClientName] = useState(baseGame?.client?.name || '');
  
  // Date Logic: Prefer existing client date, then existing creation date, then today
  const getInitialDate = () => {
      if (baseGame?.client?.playingDate) return baseGame.client.playingDate;
      if (baseGame?.createdAt) return new Date(baseGame.createdAt).toISOString().split('T')[0];
      return new Date().toISOString().split('T')[0];
  };

  const [playingDate, setPlayingDate] = useState(getInitialDate());
  const [clientLogo, setClientLogo] = useState(baseGame?.client?.logoUrl || '');
  const [isSearchingLogo, setIsSearchingLogo] = useState(false);

  // Timer Config
  const [timerMode, setTimerMode] = useState<TimerMode>(baseGame?.timerConfig?.mode || 'none');
  const [duration, setDuration] = useState<number>(baseGame?.timerConfig?.durationMinutes || 60);
  const [endDateTime, setEndDateTime] = useState<string>(baseGame?.timerConfig?.endTime || '');
  const [timerTitle, setTimerTitle] = useState(baseGame?.timerConfig?.title || 'TIME TO END');

  // Map Config
  const [selectedMapStyle, setSelectedMapStyle] = useState<MapStyleId>(baseGame?.defaultMapStyle || 'osm');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with baseGame if it changes (e.g. when opening edit mode)
  useEffect(() => {
      if (baseGame) {
          setName(baseGame.name);
          setDescription(baseGame.description);
          setLanguage(baseGame.language || 'Danish');
          setClientName(baseGame.client?.name || '');
          setClientLogo(baseGame.client?.logoUrl || '');
          setPlayingDate(baseGame.client?.playingDate || new Date(baseGame.createdAt).toISOString().split('T')[0]);
          setSelectedMapStyle(baseGame.defaultMapStyle || 'osm');
          
          if (baseGame.timerConfig) {
              setTimerMode(baseGame.timerConfig.mode);
              setDuration(baseGame.timerConfig.durationMinutes || 60);
              setEndDateTime(baseGame.timerConfig.endTime || '');
              setTimerTitle(baseGame.timerConfig.title || 'TIME TO END');
          }
      }
  }, [baseGame]);

  const handleLogoSearch = async () => {
      if (!clientName.trim()) return;
      setIsSearchingLogo(true);
      const url = await searchLogoUrl(clientName);
      if (url) setClientLogo(url);
      else alert("No logo found for this name. Try uploading one.");
      setIsSearchingLogo(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setClientLogo(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleCreate = () => {
      if (!name.trim()) {
          alert("Game Name is required");
          return;
      }

      const newGameData: Partial<Game> = {
          name,
          description,
          language,
          defaultMapStyle: selectedMapStyle,
          client: {
              name: clientName,
              logoUrl: clientLogo,
              playingDate: playingDate
          },
          timerConfig: {
              mode: timerMode,
              durationMinutes: timerMode === 'countdown' ? duration : undefined,
              endTime: timerMode === 'scheduled_end' ? endDateTime : undefined,
              title: timerTitle
          }
      };

      onCreate(newGameData);
  };

  const isEditMode = !!baseGame;

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-950 flex flex-col items-center justify-center p-4 animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                    {isEditMode ? <Edit className="w-6 h-6 text-orange-500" /> : <Gamepad2 className="w-6 h-6 text-orange-500" />}
                    {isEditMode ? 'EDIT GAME SESSION' : 'NEW GAME SETUP'}
                </h2>
                <button onClick={onClose} className="p-2 bg-slate-900 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-900 custom-scrollbar">
                
                {/* 1. Basic Info */}
                <section>
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">1</span>
                        GAME DETAILS
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">GAME NAME</label>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. City Explorer 2025"
                                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">MISSION BRIEFING (SHOWN AT START)</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Briefing for the players shown as pop-up on start..."
                                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-orange-500 outline-none transition-colors h-20 resize-none"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">GAME LANGUAGE</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <select 
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as Language)}
                                    className="w-full pl-10 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none transition-colors uppercase appearance-none"
                                >
                                    {LANGUAGE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 italic">Sets the app interface language for all players.</p>
                        </div>
                    </div>
                </section>

                {/* 2. Client Info */}
                <section className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">2</span>
                        CLIENT & BRANDING
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CLIENT / EVENT NAME</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input 
                                            type="text" 
                                            value={clientName}
                                            onChange={(e) => setClientName(e.target.value)}
                                            placeholder="e.g. Acme Corp"
                                            className="w-full pl-10 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none transition-colors"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleLogoSearch}
                                        disabled={isSearchingLogo || !clientName}
                                        className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                        title="Auto-search Logo"
                                    >
                                        {isSearchingLogo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">PLAYING DATE</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input 
                                        type="date" 
                                        value={playingDate}
                                        onChange={(e) => setPlayingDate(e.target.value)}
                                        className="w-full pl-10 p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none transition-colors uppercase"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CLIENT LOGO</label>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-32 bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center cursor-pointer hover:border-slate-500 hover:bg-slate-700/50 transition-all relative overflow-hidden group"
                            >
                                {clientLogo ? (
                                    <div className="relative w-full h-full p-4 flex items-center justify-center bg-white/5">
                                        <img src={clientLogo} alt="Client Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Upload className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-500">
                                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <span className="text-[10px] font-bold uppercase">UPLOAD OR SEARCH</span>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Map Visuals */}
                <section className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">3</span>
                        MAP VISUALS
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {MAP_STYLES.map(style => (
                            <button
                                key={style.id}
                                onClick={() => setSelectedMapStyle(style.id)}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selectedMapStyle === style.id ? 'bg-blue-600 border-blue-400 text-white ring-2 ring-blue-500/20' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-750 hover:text-white'}`}
                            >
                                <Layers className="w-5 h-5" />
                                <span className="text-[9px] font-black uppercase tracking-wide">{style.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* 4. Timing Block */}
                <section className="bg-slate-800/50 p-5 rounded-2xl border border-slate-800">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">4</span>
                        TIMING CONFIGURATION
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        <button 
                            onClick={() => setTimerMode('none')}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${timerMode === 'none' ? 'bg-slate-700 border-white text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                        >
                            <X className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase">NO TIMER</span>
                        </button>
                        <button 
                            onClick={() => setTimerMode('countdown')}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${timerMode === 'countdown' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                        >
                            <Hourglass className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase">COUNTDOWN</span>
                        </button>
                        <button 
                            onClick={() => setTimerMode('countup')}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${timerMode === 'countup' ? 'bg-green-600 border-green-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                        >
                            <Clock className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase">RUN TIME</span>
                        </button>
                        <button 
                            onClick={() => setTimerMode('scheduled_end')}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${timerMode === 'scheduled_end' ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                        >
                            <StopCircle className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase">END AT TIME</span>
                        </button>
                    </div>

                    {timerMode !== 'none' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">TIMER LABEL</label>
                                <input 
                                    type="text" 
                                    value={timerTitle}
                                    onChange={(e) => setTimerTitle(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold outline-none uppercase"
                                />
                            </div>

                            {timerMode === 'countdown' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">DURATION (MINUTES)</label>
                                    <input 
                                        type="number" 
                                        value={duration}
                                        onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                                        className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold outline-none"
                                    />
                                </div>
                            )}

                            {timerMode === 'scheduled_end' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">END DATE & TIME</label>
                                    <input 
                                        type="datetime-local" 
                                        value={endDateTime}
                                        onChange={(e) => setEndDateTime(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </section>

            </div>

            <div className="p-6 bg-slate-950 border-t border-slate-800">
                <button 
                    onClick={handleCreate}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    {isEditMode ? <Save className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    {isEditMode ? 'SAVE CHANGES' : 'CREATE GAME MISSION'}
                </button>
            </div>
        </div>
    </div>
  );
};

export default GameCreator;
