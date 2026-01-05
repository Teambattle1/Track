import React, { useState, useRef } from 'react';
import { Game } from '../types';
import { 
  Clock, 
  Plus, 
  Minus, 
  Eye, 
  EyeOff, 
  Upload, 
  Trash2, 
  Lock, 
  Unlock,
  RefreshCw,
  AlertTriangle,
  Check,
  Image as ImageIcon
} from 'lucide-react';
import { uploadImage } from '../services/storage';

interface ChangeZonePanelProps {
  game: Game;
  onUpdateGame: (updates: Partial<Game>) => void;
}

const ChangeZonePanel: React.FC<ChangeZonePanelProps> = ({ game, onUpdateGame }) => {
  const [isEnabled, setIsEnabled] = useState(game.changeZone?.enabled || false);
  const [targetTime, setTargetTime] = useState<string>(() => {
    if (game.changeZone?.targetTime) {
      const date = new Date(game.changeZone.targetTime);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    return '12:00';
  });
  const [showOnTeamView, setShowOnTeamView] = useState(game.changeZone?.showOnTeamView || false);
  const [message, setMessage] = useState(game.changeZone?.message || '');
  const [imageUrl, setImageUrl] = useState(game.changeZone?.imageUrl || '');
  const [requireCode, setRequireCode] = useState(game.changeZone?.requireCode !== undefined ? game.changeZone.requireCode : true);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateChangeZone = (updates: Partial<NonNullable<Game['changeZone']>>) => {
    const currentChangeZone = game.changeZone || {
      enabled: false,
      showOnTeamView: false,
      message: '',
      requireCode: true,
      hasTriggered: false
    };

    onUpdateGame({
      changeZone: {
        ...currentChangeZone,
        ...updates
      }
    });
  };

  const handleToggleEnable = (enabled: boolean) => {
    setIsEnabled(enabled);
    updateChangeZone({ enabled });
  };

  const handleTimeChange = (newTime: string) => {
    setTargetTime(newTime);
    
    // Convert HH:MM to Unix timestamp (today at that time)
    const [hours, minutes] = newTime.split(':').map(Number);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    
    // If time is in the past, set it for tomorrow
    if (target.getTime() < now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    updateChangeZone({ 
      targetTime: target.getTime(),
      hasTriggered: false // Reset trigger when time changes
    });
  };

  const adjustTime = (minutes: number) => {
    const [hours, mins] = targetTime.split(':').map(Number);
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins, 0);
    current.setMinutes(current.getMinutes() + minutes);

    const newTime = `${current.getHours().toString().padStart(2, '0')}:${current.getMinutes().toString().padStart(2, '0')}`;
    handleTimeChange(newTime);
  };

  const handleToggleTeamView = (show: boolean) => {
    setShowOnTeamView(show);
    updateChangeZone({ showOnTeamView: show });
  };

  const handleMessageChange = (newMessage: string) => {
    setMessage(newMessage);
    updateChangeZone({ message: newMessage });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
      updateChangeZone({ imageUrl: url });
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Kunne ikke uploade billede. Prøv igen.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    updateChangeZone({ imageUrl: undefined });
  };

  const handleToggleRequireCode = (required: boolean) => {
    setRequireCode(required);
    updateChangeZone({ requireCode: required });
  };

  const handleReset = () => {
    if (!window.confirm('Reset CHANGEZONE countdown? Dette vil nulstille alt og tillade en ny countdown.')) {
      return;
    }

    setIsEnabled(false);
    setTargetTime('12:00');
    setShowOnTeamView(false);
    setMessage('');
    setImageUrl('');
    setRequireCode(true);

    onUpdateGame({
      changeZone: {
        enabled: false,
        showOnTeamView: false,
        message: '',
        requireCode: true,
        hasTriggered: false
      }
    });
  };

  return (
    <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-4 flex items-center justify-between border-b-2 border-orange-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">CHANGEZONE</h3>
            <p className="text-[10px] font-bold text-orange-200 uppercase tracking-wider">Countdown til zoneændring</p>
          </div>
        </div>
        
        <button
          onClick={() => handleToggleEnable(!isEnabled)}
          className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${
            isEnabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          {isEnabled ? 'AKTIV' : 'INAKTIV'}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Time Picker with +/- buttons */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Tidspunkt
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustTime(-1)}
              disabled={!isEnabled}
              className="w-12 h-12 bg-red-600/20 hover:bg-red-600/30 disabled:bg-slate-800 disabled:opacity-50 border border-red-600/50 rounded-xl flex items-center justify-center text-red-500 disabled:text-slate-600 transition-all hover:scale-110 active:scale-95"
              title="Træk 1 minut fra"
            >
              <Minus className="w-5 h-5" />
            </button>

            <input
              type="time"
              value={targetTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              disabled={!isEnabled}
              className="flex-1 px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white font-mono text-2xl text-center font-black tracking-widest focus:outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />

            <button
              onClick={() => adjustTime(1)}
              disabled={!isEnabled}
              className="w-12 h-12 bg-green-600/20 hover:bg-green-600/30 disabled:bg-slate-800 disabled:opacity-50 border border-green-600/50 rounded-xl flex items-center justify-center text-green-500 disabled:text-slate-600 transition-all hover:scale-110 active:scale-95"
              title="Tilføj 1 minut"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Show on Team View Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2">
            {showOnTeamView ? (
              <Eye className="w-4 h-4 text-green-500" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-500" />
            )}
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Vis countdown på TEAMVIEW
            </span>
          </div>
          <button
            onClick={() => handleToggleTeamView(!showOnTeamView)}
            disabled={!isEnabled}
            className={`w-14 h-7 rounded-full transition-all relative ${
              showOnTeamView ? 'bg-green-600' : 'bg-slate-700'
            } ${!isEnabled && 'opacity-50 cursor-not-allowed'}`}
          >
            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
              showOnTeamView ? 'translate-x-7' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Message Editor */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Besked til spillere
          </label>
          <textarea
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            disabled={!isEnabled}
            placeholder="Skriv en besked der vises når countdown når 00:00..."
            className="w-full h-32 px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white text-sm resize-none focus:outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          />
          <p className="text-xs text-slate-500 mt-1">
            Tip: Du kan bruge HTML formatering (&lt;b&gt;, &lt;i&gt;, &lt;br&gt;, etc.)
          </p>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Billede (valgfrit)
          </label>
          
          {imageUrl ? (
            <div className="relative">
              <img 
                src={imageUrl} 
                alt="Change Zone" 
                className="w-full h-40 object-cover rounded-xl border-2 border-orange-500"
              />
              <button
                onClick={handleRemoveImage}
                disabled={!isEnabled}
                className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!isEnabled || uploading}
                className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:text-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider">Uploader...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Upload billede</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Require Code Toggle */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Lukke-mekanisme
          </label>
          <div className="space-y-2">
            <button
              onClick={() => handleToggleRequireCode(false)}
              disabled={!isEnabled}
              className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                !requireCode
                  ? 'bg-green-600/20 border-green-600 text-green-500'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              } ${!isEnabled && 'opacity-50 cursor-not-allowed'}`}
            >
              <Unlock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Teams må lukke med OK knap
              </span>
            </button>

            <button
              onClick={() => handleToggleRequireCode(true)}
              disabled={!isEnabled}
              className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                requireCode
                  ? 'bg-orange-600/20 border-orange-600 text-orange-500'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              } ${!isEnabled && 'opacity-50 cursor-not-allowed'}`}
            >
              <Lock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Kræv instruktør kode (4027)
              </span>
            </button>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-xl flex items-center justify-center gap-2 text-red-500 font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reset Countdown</span>
        </button>
      </div>
    </div>
  );
};

export default ChangeZonePanel;
