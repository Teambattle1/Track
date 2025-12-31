import React, { useState, useEffect } from 'react';
import { X, KeyRound, Eye, EyeOff, Check, ExternalLink } from 'lucide-react';

interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Try to load existing key (masked)
      try {
        const existing = localStorage.getItem('GEMINI_API_KEY');
        if (existing) {
          setGeminiKey('••••••••••••••••••••');
        }
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    const key = geminiKey.trim();
    if (!key || key.startsWith('•')) {
      alert('Please enter a valid API key');
      return;
    }

    try {
      localStorage.setItem('GEMINI_API_KEY', key);
      setIsSaved(true);
      setGeminiKey('');
      setTimeout(() => {
        setIsSaved(false);
        onSave();
        onClose();
      }, 1500);
    } catch (error) {
      alert('Failed to save API key');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest">GEMINI API KEY</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Required for AI features</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-300 mb-3 leading-relaxed">
              AI features (background generation, task creation, etc.) require a Google Gemini API key. 
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Get your free API key from Google AI Studio
            </a>
          </div>

          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Your API Key</p>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => {
                  setGeminiKey(e.target.value);
                  setIsSaved(false);
                }}
                placeholder="sk-..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-sm text-white font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isSaved && (
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-300 font-bold">API Key saved successfully!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold uppercase text-xs tracking-widest transition-colors border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaved || !geminiKey.trim()}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white rounded-lg font-bold uppercase text-xs tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {isSaved ? 'Saved' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeminiApiKeyModal;
