import React from 'react';
import { Game } from '../types';
import { Printer, Download } from 'lucide-react';

interface GameAccessPrintableProps {
  game: Game;
  qrCodeDataUrl: string | null;
  accessCode: string;
}

const GameAccessPrintable: React.FC<GameAccessPrintableProps> = ({ game, qrCodeDataUrl, accessCode }) => {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const formatGameDate = () => {
    if (game.client?.playingDate) {
      const date = new Date(game.client.playingDate);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    const date = new Date(game.createdAt || Date.now());
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatGameTime = () => {
    if (game.client?.playingDate) {
      const date = new Date(game.client.playingDate);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
    }
    return 'Not set';
  };

  return (
    <div className="space-y-4">
      {/* Print/Download Buttons */}
      <div className="flex gap-3 no-print">
        <button
          onClick={handlePrint}
          className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print Game Info
        </button>
        <button
          onClick={handleDownloadPDF}
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Printable Sheet Preview */}
      <div className="bg-white rounded-2xl overflow-hidden border-4 border-slate-800 print-sheet">
        <div className="p-12" id="printable-game-access">
          {/* Header */}
          <div className="text-center mb-8 pb-8 border-b-4 border-slate-900">
            <h1 className="text-5xl font-black text-slate-900 uppercase mb-2">
              {game.name || 'Game'}
            </h1>
            <div className="flex items-center justify-center gap-6 text-xl font-bold text-slate-700">
              <span>{formatGameDate()}</span>
              <span className="text-3xl">•</span>
              <span>{formatGameTime()}</span>
            </div>
          </div>

          {/* Main Content - Two Column Layout */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* Left Column - QR Code */}
            <div className="flex flex-col items-center justify-center bg-slate-100 p-8 rounded-2xl">
              {qrCodeDataUrl ? (
                <>
                  <img
                    src={qrCodeDataUrl}
                    alt="Game QR Code"
                    className="w-64 h-64 mb-4"
                  />
                  <p className="text-sm font-bold text-slate-600 uppercase">Scan to Join</p>
                </>
              ) : (
                <div className="w-64 h-64 bg-slate-300 rounded-xl flex items-center justify-center">
                  <p className="text-slate-500 font-bold">No QR Code</p>
                </div>
              )}
            </div>

            {/* Right Column - Access Code */}
            <div className="flex flex-col justify-center">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-slate-900 uppercase mb-4">Game Code</h2>
                <div className="bg-slate-900 p-6 rounded-2xl text-center">
                  <p className="text-6xl font-black text-white tracking-widest">
                    {accessCode || 'NOT SET'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions Section */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl border-2 border-blue-300">
            <h2 className="text-3xl font-black text-blue-900 uppercase mb-6 text-center">
              📱 How to Join the Game
            </h2>
            
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-black">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 mb-2">Access the Game</h3>
                  <p className="text-base text-slate-700 leading-relaxed">
                    <strong>Option A:</strong> Scan the QR code with your phone camera<br />
                    <strong>Option B:</strong> Visit the game website and click "Join Game"
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-black">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 mb-2">Enter Game Code</h3>
                  <p className="text-base text-slate-700 leading-relaxed">
                    Type the game code shown above: <strong className="text-blue-900 text-lg">{accessCode || '[CODE]'}</strong>
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-black">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 mb-2">Create Your Team</h3>
                  <p className="text-base text-slate-700 leading-relaxed">
                    Enter a <strong>team name</strong> - make it fun and memorable!<br />
                    Example: "The Explorers", "Team Rocket", "Quiz Masters"
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-black">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 mb-2">Join Team Lobby</h3>
                  <p className="text-base text-slate-700 leading-relaxed">
                    After creating the team, you'll enter the <strong>team lobby</strong>.<br />
                    Wait here until the game organizer starts the game.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-black">
                  5
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 mb-2">Add Team Members</h3>
                  <p className="text-base text-slate-700 leading-relaxed">
                    <strong>From another device:</strong> Scan the team QR code or enter the team name<br />
                    <strong>Each member:</strong> Enter your name when joining the team<br />
                    <strong>All members</strong> will see each other in the lobby
                  </p>
                </div>
              </div>

              {/* Step 6 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center text-2xl font-black">
                  ✓
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-900 mb-2">Ready to Play!</h3>
                  <p className="text-base text-slate-700 leading-relaxed">
                    Once all team members have joined and the organizer starts the game,<br />
                    you'll begin your adventure! <strong className="text-emerald-700">Good luck! 🎉</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-slate-300 text-center text-sm text-slate-600">
            <p className="font-bold">Need help? Contact your game organizer</p>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          .print-sheet {
            border: none !important;
            box-shadow: none !important;
          }
          
          #printable-game-access {
            page-break-inside: avoid;
          }
          
          body {
            background: white !important;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        
        @page {
          size: A4;
          margin: 1cm;
        }
      `}</style>
    </div>
  );
};

export default GameAccessPrintable;
