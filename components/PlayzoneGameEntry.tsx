import React, { useState, useRef } from 'react';
import { X, Smartphone, QrCode, Users, Loader2 } from 'lucide-react';

interface PlayzoneGameEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamJoin: (teamName: string) => void;
  gameName?: string;
}

const PlayzoneGameEntry: React.FC<PlayzoneGameEntryProps> = ({ isOpen, onClose, onTeamJoin, gameName = 'PLAYZONE GAME' }) => {
  const [teamName, setTeamName] = useState('');
  const [entryMethod, setEntryMethod] = useState<'qr' | 'name' | null>(null);
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleQRScan = async () => {
    setIsScanningQR(true);
    try {
      // Try to use native QR code scanner if available
      // For now, we'll use a simple input field as fallback
      if ('BarcodeDetector' in window) {
        // Use native Barcode API if available
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          
          // Note: Full QR scanning implementation would require BarcodeDetector API
          // For now, we show input field as fallback
          setEntryMethod('qr');
        }
      } else {
        // Fallback to manual QR input
        setEntryMethod('qr');
      }
    } catch (error) {
      console.error('Failed to access camera:', error);
      alert('Could not access camera. Please try entering the team name instead.');
      setIsScanningQR(false);
    }
  };

  const handleQRSubmit = () => {
    if (qrInput.trim()) {
      onTeamJoin(qrInput.trim());
      setQrInput('');
      setEntryMethod(null);
      setIsScanningQR(false);
    }
  };

  const handleNameSubmit = () => {
    if (teamName.trim()) {
      onTeamJoin(teamName.trim());
      setTeamName('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[7000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">PLAYZONE GAME</h2>
              <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">{gameName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {!entryMethod ? (
            <>
              {/* Choose Entry Method */}
              <p className="text-center text-slate-400 font-bold text-sm uppercase mb-6">
                How would you like to join?
              </p>

              <button
                onClick={handleQRScan}
                disabled={isScanningQR}
                className="w-full p-4 bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isScanningQR ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                {isScanningQR ? 'STARTING CAMERA...' : 'SCAN QR CODE'}
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-slate-500 font-bold text-xs uppercase">OR</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              <button
                onClick={() => setEntryMethod('name')}
                className="w-full p-4 bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-3"
              >
                <Users className="w-5 h-5" />
                ENTER TEAM NAME
              </button>

              <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 mt-4">
                <p className="text-xs text-teal-200 font-bold">
                  💡 <strong>Tip:</strong> Ask your team captain for the QR code or team name to access this game.
                </p>
              </div>
            </>
          ) : entryMethod === 'qr' ? (
            <>
              {/* QR Code Entry */}
              <p className="text-center text-slate-400 font-bold text-sm uppercase mb-4">
                Enter QR Code Value
              </p>

              <video
                ref={videoRef}
                className="w-full rounded-xl bg-slate-800 mb-4 hidden"
              />

              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleQRSubmit()}
                placeholder="PASTE QR CODE VALUE HERE..."
                className="w-full p-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-bold uppercase placeholder-slate-600 focus:border-purple-500 focus:outline-none transition-colors text-sm"
                autoFocus
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setEntryMethod(null); setQrInput(''); setIsScanningQR(false); }}
                  className="flex-1 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase text-sm transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={handleQRSubmit}
                  disabled={!qrInput.trim()}
                  className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold uppercase text-sm transition-colors"
                >
                  JOIN GAME
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Team Name Entry */}
              <p className="text-center text-slate-400 font-bold text-sm uppercase mb-4">
                Enter Your Team Name
              </p>

              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                placeholder="YOUR TEAM NAME..."
                className="w-full p-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-bold uppercase placeholder-slate-600 focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                autoFocus
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setEntryMethod(null); setTeamName(''); }}
                  className="flex-1 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase text-sm transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={handleNameSubmit}
                  disabled={!teamName.trim()}
                  className="flex-1 p-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-bold uppercase text-sm transition-colors"
                >
                  JOIN GAME
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayzoneGameEntry;
