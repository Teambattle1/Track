import React, { useState, useEffect } from 'react';
import { X, KeyRound, Eye, EyeOff, Check, ExternalLink, Sparkles, Palette } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [stabilityKey, setStabilityKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showStabilityKey, setShowStabilityKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [hasExistingAnthropic, setHasExistingAnthropic] = useState(false);
  const [hasExistingStability, setHasExistingStability] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check for existing keys
      try {
        const existingAnthropic = localStorage.getItem('ANTHROPIC_API_KEY');
        const existingStability = localStorage.getItem('STABILITY_API_KEY');

        if (existingAnthropic) {
          setAnthropicKey('••••••••••••••••••••');
          setHasExistingAnthropic(true);
        }
        if (existingStability) {
          setStabilityKey('••••••••••••••••••••');
          setHasExistingStability(true);
        }
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    let saved = false;

    // Save Anthropic key if provided and not masked
    const anthropicKeyTrimmed = anthropicKey.trim();
    if (anthropicKeyTrimmed && !anthropicKeyTrimmed.startsWith('•')) {
      try {
        localStorage.setItem('ANTHROPIC_API_KEY', anthropicKeyTrimmed);
        saved = true;
      } catch (error) {
        alert('Failed to save Anthropic API key');
        return;
      }
    }

    // Save Stability AI key if provided and not masked
    const stabilityKeyTrimmed = stabilityKey.trim();
    if (stabilityKeyTrimmed && !stabilityKeyTrimmed.startsWith('•')) {
      try {
        localStorage.setItem('STABILITY_API_KEY', stabilityKeyTrimmed);
        saved = true;
      } catch (error) {
        alert('Failed to save Stability AI key');
        return;
      }
    }

    if (saved) {
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onSave();
        onClose();
      }, 1500);
    } else {
      alert('Please enter at least one API key');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest">AI API KEYS</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Configure AI providers</p>
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
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Info */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">Claude (Anthropic)</strong> - Task generation, translations & text AI
              <br />
              <strong className="text-white">Stability AI</strong> - Image generation (logos, icons, backgrounds)
            </p>
          </div>

          {/* Anthropic API Key */}
          <div className="bg-slate-950 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <p className="text-xs text-purple-400 font-black uppercase tracking-wider">Claude (Anthropic) - Text AI</p>
              {hasExistingAnthropic && <span className="text-[9px] bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full font-bold">CONFIGURED</span>}
            </div>
            <div className="relative mb-2">
              <input
                type={showAnthropicKey ? 'text' : 'password'}
                value={anthropicKey}
                onChange={(e) => {
                  setAnthropicKey(e.target.value);
                  setIsSaved(false);
                }}
                placeholder="sk-ant-..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-sm text-white font-mono outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-bold text-xs transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Get API key from Anthropic Console
            </a>
          </div>

          {/* Stability AI API Key */}
          <div className="bg-slate-950 rounded-xl p-4 border border-orange-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-orange-400" />
              <p className="text-xs text-orange-400 font-black uppercase tracking-wider">Stability AI - Image Generation</p>
              {hasExistingStability && <span className="text-[9px] bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full font-bold">CONFIGURED</span>}
            </div>
            <div className="relative mb-2">
              <input
                type={showStabilityKey ? 'text' : 'password'}
                value={stabilityKey}
                onChange={(e) => {
                  setStabilityKey(e.target.value);
                  setIsSaved(false);
                }}
                placeholder="sk-..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-sm text-white font-mono outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowStabilityKey(!showStabilityKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {showStabilityKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <a
              href="https://platform.stability.ai/account/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-bold text-xs transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Get API key from Stability AI (~$0.002/image)
            </a>
          </div>

          {isSaved && (
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-300 font-bold">API Keys saved successfully!</span>
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
            disabled={isSaved}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold uppercase text-xs tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {isSaved ? 'Saved' : 'Save Keys'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
