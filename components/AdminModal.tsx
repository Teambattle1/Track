import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Game } from '../types';
import { X, KeyRound, Eye, EyeOff, Trash2, Download, Book, Zap, Loader2, Check, Volume2, Play, Upload } from 'lucide-react';
import { generateFeatureCatalogPDF } from '../utils/pdfGenerator';
import { migrateAllTasksToGpsEnabled } from '../services/migrationGpsActivation';
import { uploadImage } from '../services/storage';
import {
  CORRECT_SOUNDS,
  INCORRECT_SOUNDS,
  getGlobalCorrectSound,
  getGlobalIncorrectSound,
  getGlobalVolume,
  setGlobalCorrectSound,
  setGlobalIncorrectSound,
  setGlobalVolume,
  playSound
} from '../utils/sounds';

interface AdminModalProps {
  games: Game[];
  onClose: () => void;
  onDeleteGame: (id: string) => void;
  initialShowSql?: boolean;
  onLibraryUpdated?: () => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ onClose, onLibraryUpdated }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [hasStoredGeminiKey, setHasStoredGeminiKey] = useState(false);

  const [isMigratingGps, setIsMigratingGps] = useState(false);
  const [gpsMigrationResult, setGpsMigrationResult] = useState<any | null>(null);

  // Sound Settings State
  const [correctSoundUrl, setCorrectSoundUrl] = useState(getGlobalCorrectSound());
  const [incorrectSoundUrl, setIncorrectSoundUrl] = useState(getGlobalIncorrectSound());
  const [volume, setVolume] = useState(getGlobalVolume());
  const [soundsSaved, setSoundsSaved] = useState(false);
  const [isUploadingCorrect, setIsUploadingCorrect] = useState(false);
  const [isUploadingIncorrect, setIsUploadingIncorrect] = useState(false);
  const correctSoundInputRef = useRef<HTMLInputElement>(null);
  const incorrectSoundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      try {
          const existing = localStorage.getItem('GEMINI_API_KEY');
          setHasStoredGeminiKey(!!existing);
      } catch {
          setHasStoredGeminiKey(false);
      }
  }, []);

  const geminiStatus = useMemo(() => {
      if (geminiSaved) return 'SAVED';
      return hasStoredGeminiKey ? 'KEY SET' : 'NOT SET';
  }, [geminiSaved, hasStoredGeminiKey]);

  // Sound Upload Handlers
  const handleUploadCorrectSound = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate audio file
      if (!file.type.startsWith('audio/')) {
          alert('Please upload an audio file (MP3, WAV, etc.)');
          return;
      }

      setIsUploadingCorrect(true);
      try {
          const url = await uploadImage(file, 'game-assets');
          if (url) {
              setCorrectSoundUrl(url);
          } else {
              alert('Failed to upload sound file');
          }
      } catch (error) {
          console.error('Upload error:', error);
          alert('Failed to upload sound file');
      } finally {
          setIsUploadingCorrect(false);
          if (correctSoundInputRef.current) {
              correctSoundInputRef.current.value = '';
          }
      }
  };

  const handleUploadIncorrectSound = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate audio file
      if (!file.type.startsWith('audio/')) {
          alert('Please upload an audio file (MP3, WAV, etc.)');
          return;
      }

      setIsUploadingIncorrect(true);
      try {
          const url = await uploadImage(file, 'game-assets');
          if (url) {
              setIncorrectSoundUrl(url);
          } else {
              alert('Failed to upload sound file');
          }
      } catch (error) {
          console.error('Upload error:', error);
          alert('Failed to upload sound file');
      } finally {
          setIsUploadingIncorrect(false);
          if (incorrectSoundInputRef.current) {
              incorrectSoundInputRef.current.value = '';
          }
      }
  };

  // NOTE: Supabase setup SQL was moved to the SUPABASE module (System Tools).

  const handleMigrateGpsActivation = async () => {
      setIsMigratingGps(true);
      try {
          const result = await migrateAllTasksToGpsEnabled();
          setGpsMigrationResult(result);
          console.log('GPS Migration Result:', result);

          // Notify parent to reload the library
          if (onLibraryUpdated) {
              onLibraryUpdated();
          }
      } catch (error) {
          console.error('Migration failed:', error);
          setGpsMigrationResult({
              error: error instanceof Error ? error.message : 'Unknown error'
          });
      } finally {
          setIsMigratingGps(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-500"/> AI SETTINGS
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">AI KEY • EXPORTS • MIGRATIONS</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">

          {/* AI Settings */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                          <KeyRound className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                          <p className="text-xs font-black uppercase tracking-widest text-white">AI (GEMINI) API KEY</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                              Status: <span className={geminiStatus === 'NOT SET' ? 'text-red-400' : 'text-green-400'}>{geminiStatus}</span>
                          </p>
                          <p className="text-[10px] text-slate-600 font-bold mt-2 leading-snug">
                              Stored locally in this browser so AI task generation works in deployed mode.
                          </p>
                      </div>
                  </div>
              </div>

              <div className="mt-4 flex gap-2">
                  <div className="flex-1 relative">
                      <input
                          type={showGeminiKey ? 'text' : 'password'}
                          value={geminiKey}
                          onChange={(e) => {
                              setGeminiKey(e.target.value);
                              setGeminiSaved(false);
                          }}
                          placeholder="Paste Gemini API key"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-xs text-white font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                          type="button"
                          onClick={() => setShowGeminiKey(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title={showGeminiKey ? 'Hide key' : 'Show key'}
                      >
                          {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                  </div>

                  <button
                      type="button"
                      onClick={() => {
                          const next = geminiKey.trim();
                          if (!next) return;
                          try {
                              localStorage.setItem('GEMINI_API_KEY', next);
                              setHasStoredGeminiKey(true);
                              setGeminiSaved(true);
                              setGeminiKey('');
                              setTimeout(() => setGeminiSaved(false), 2000);
                          } catch {
                              // ignore
                          }
                      }}
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors"
                  >
                      <Check className="w-4 h-4 inline-block mr-1" /> SAVE
                  </button>

                  <button
                      type="button"
                      onClick={() => {
                          try {
                              localStorage.removeItem('GEMINI_API_KEY');
                          } catch {
                              // ignore
                          }
                          setHasStoredGeminiKey(false);
                          setGeminiSaved(false);
                          setGeminiKey('');
                      }}
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors border border-slate-700"
                      title="Clear stored key"
                  >
                      <Trash2 className="w-4 h-4" />
                  </button>
              </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                ADMIN USE ONLY
            </p>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
