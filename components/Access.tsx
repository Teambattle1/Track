import React, { useState, useEffect } from 'react';
import { KeyRound, Play, QrCode, Loader2, CheckCircle, XCircle } from 'lucide-react';
import * as db from '../services/db';
import { Game } from '../types';

interface AccessProps {
  onGameSelected: (gameId: string) => void;
  onBack: () => void;
}

const Access: React.FC<AccessProps> = ({ onGameSelected, onBack }) => {
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validGame, setValidGame] = useState<Game | null>(null);

  // Check URL params for code (from QR scan)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAccessCode(code.toUpperCase());
      // Auto-validate if code is in URL
      handleValidateCode(code);
    }
  }, []);

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
      // Fetch all games and find matching access code
      const games = await db.fetchGames();
      const matchingGame = games.find(
        game => game.accessCode?.toUpperCase() === codeToValidate
      );

      if (matchingGame) {
        setValidGame(matchingGame);
        setValidationError(null);
      } else {
        setValidationError('Invalid access code. Please check and try again.');
        setValidGame(null);
      }
    } catch (error) {
      console.error('Error validating access code:', error);
      setValidationError('Failed to validate code. Please try again.');
      setValidGame(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePlayGame = () => {
    if (validGame) {
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      onGameSelected(validGame.id);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleValidateCode();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 mb-4">
            <KeyRound className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-wider mb-2">
            Game Access
          </h1>
          <p className="text-slate-400 text-sm">
            Enter your access code or scan QR code to join
          </p>
        </div>

        {/* Access Code Input Card */}
        <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-3xl p-8 shadow-2xl">
          <div className="space-y-6">
            {/* Input Section */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-3 tracking-wide">
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
                className="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl px-6 py-5 text-white text-2xl font-bold uppercase tracking-widest text-center outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                disabled={isValidating}
              />
            </div>

            {/* Validation Message */}
            {validationError && (
              <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 rounded-xl p-4">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{validationError}</p>
              </div>
            )}

            {/* Valid Game Message */}
            {validGame && (
              <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-300 mb-1">Access Code Valid!</p>
                    <p className="text-xs text-green-400/80">Ready to join: <strong>{validGame.name}</strong></p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {!validGame ? (
                <button
                  onClick={() => handleValidateCode()}
                  disabled={isValidating || !accessCode.trim()}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-2xl font-black text-lg uppercase tracking-wide transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
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
              ) : (
                <button
                  onClick={handlePlayGame}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl font-black text-lg uppercase tracking-wide transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl animate-pulse hover:animate-none"
                >
                  <Play className="w-6 h-6" />
                  Let Me Play!
                </button>
              )}

              <button
                onClick={onBack}
                className="w-full py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold text-sm uppercase tracking-wide transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>

        {/* QR Code Hint */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-slate-500 text-xs">
            <QrCode className="w-4 h-4" />
            <span>Have a QR code? Scan it to auto-fill the code</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Access;
