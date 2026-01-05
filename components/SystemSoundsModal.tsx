import React, { useState, useRef } from 'react';
import { X, Volume2, Play, Upload, Loader2, Check } from 'lucide-react';
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

interface SystemSoundsModalProps {
  onClose: () => void;
}

const SystemSoundsModal: React.FC<SystemSoundsModalProps> = ({ onClose }) => {
  // Sound Settings State
  const [correctSoundUrl, setCorrectSoundUrl] = useState(getGlobalCorrectSound());
  const [incorrectSoundUrl, setIncorrectSoundUrl] = useState(getGlobalIncorrectSound());
  const [volume, setVolume] = useState(getGlobalVolume());
  const [soundsSaved, setSoundsSaved] = useState(false);
  const [isUploadingCorrect, setIsUploadingCorrect] = useState(false);
  const [isUploadingIncorrect, setIsUploadingIncorrect] = useState(false);
  const correctSoundInputRef = useRef<HTMLInputElement>(null);
  const incorrectSoundInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-purple-600 w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-purple-800 bg-gradient-to-r from-purple-900/40 to-violet-900/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500 flex items-center justify-center">
                <Volume2 className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wider">SYSTEM SOUNDS</h2>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">
                  Global Audio Settings
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div className="bg-purple-900/20 border border-purple-700 rounded-xl p-4">
            <p className="text-sm text-purple-200 leading-relaxed">
              <strong className="text-white">Global sound settings</strong> for correct and incorrect answer feedback. 
              Choose from built-in sounds or upload custom MP3/WAV files. These settings can be overridden per-game in the game settings.
            </p>
          </div>

          {/* Sound Settings Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-6">
            {/* Volume Slider */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-black uppercase tracking-widest text-slate-400">Volume</label>
                <span className="text-lg font-bold text-white">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Correct Sound Selection */}
            <div>
              <label className="block text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                ✓ Correct Answer Sound
              </label>
              <select
                value={correctSoundUrl}
                onChange={(e) => setCorrectSoundUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              >
                {CORRECT_SOUNDS.map(sound => (
                  <option key={sound.id} value={sound.url}>
                    {sound.name} - {sound.description}
                  </option>
                ))}
                {!CORRECT_SOUNDS.find(s => s.url === correctSoundUrl) && correctSoundUrl && (
                  <option value={correctSoundUrl}>Custom Upload</option>
                )}
              </select>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => playSound(correctSoundUrl, volume)}
                  className="flex-1 px-4 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 text-green-400 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> Preview
                </button>
                <button
                  onClick={() => correctSoundInputRef.current?.click()}
                  disabled={isUploadingCorrect}
                  className="flex-1 px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 text-purple-400 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingCorrect ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isUploadingCorrect ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              <input
                ref={correctSoundInputRef}
                type="file"
                accept="audio/*"
                onChange={handleUploadCorrectSound}
                className="hidden"
              />
            </div>

            {/* Incorrect Sound Selection */}
            <div>
              <label className="block text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                ✗ Incorrect Answer Sound
              </label>
              <select
                value={incorrectSoundUrl}
                onChange={(e) => setIncorrectSoundUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              >
                {INCORRECT_SOUNDS.map(sound => (
                  <option key={sound.id} value={sound.url}>
                    {sound.name} - {sound.description}
                  </option>
                ))}
                {!INCORRECT_SOUNDS.find(s => s.url === incorrectSoundUrl) && incorrectSoundUrl && (
                  <option value={incorrectSoundUrl}>Custom Upload</option>
                )}
              </select>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => playSound(incorrectSoundUrl, volume)}
                  className="flex-1 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> Preview
                </button>
                <button
                  onClick={() => incorrectSoundInputRef.current?.click()}
                  disabled={isUploadingIncorrect}
                  className="flex-1 px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 text-purple-400 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingIncorrect ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isUploadingIncorrect ? 'Uploading...' : 'Upload'}
                </button>
              </div>
              <input
                ref={incorrectSoundInputRef}
                type="file"
                accept="audio/*"
                onChange={handleUploadIncorrectSound}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 bg-slate-950">
          <button
            onClick={() => {
              setGlobalCorrectSound(correctSoundUrl);
              setGlobalIncorrectSound(incorrectSoundUrl);
              setGlobalVolume(volume);
              setSoundsSaved(true);
              setTimeout(() => setSoundsSaved(false), 2000);
            }}
            className={`w-full px-4 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${
              soundsSaved
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {soundsSaved ? (
              <>
                <Check className="w-4 h-4" />
                SAVED!
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                SAVE GLOBAL SOUNDS
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSoundsModal;
