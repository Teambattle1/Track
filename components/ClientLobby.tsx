import React, { useState, useEffect } from 'react';
import { Game, Team } from '../types';
import * as db from '../services/db';
import { Trophy, BarChart3, Image as ImageIcon, Copy, Check, ArrowLeft, Loader2 } from 'lucide-react';
import ClientRanking from './ClientRanking';
import ClientStats from './ClientStats';
import ClientMediaGallery from './ClientMediaGallery';

interface ClientLobbyProps {
  gameId: string;
  onBack: () => void;
}

type ClientView = 'ranking' | 'stats' | 'gallery';

const ClientLobby: React.FC<ClientLobbyProps> = ({ gameId, onBack }) => {
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ClientView>('ranking');
  const [linkCopied, setLinkCopied] = useState(false);

  // Check URL parameter for tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'gallery' || tabParam === 'stats') {
      setActiveView(tabParam as ClientView);
    }
  }, []);

  // Load game and teams
  useEffect(() => {
    loadGameData();
  }, [gameId]);

  const loadGameData = async () => {
    setLoading(true);
    try {
      const [gameData, teamsData] = await Promise.all([
        db.fetchGame(gameId),
        db.fetchTeams(gameId)
      ]);
      
      setGame(gameData);
      setTeams(teamsData);
    } catch (error) {
      console.error('Failed to load game data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/client/${gameId}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white font-bold">Loading Game Data...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-bold text-xl mb-4">Game Not Found</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const clientLogo = game.description || '';
  const gameName = game.name || 'Game Statistics';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/30 border-b border-purple-500/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-bold">Back</span>
            </button>

            {/* Game Info */}
            <div className="text-center flex-1">
              {clientLogo && (
                <p className="text-purple-300 text-sm font-bold uppercase tracking-wider mb-1">
                  {clientLogo}
                </p>
              )}
              <h1 className="text-2xl font-black text-white uppercase tracking-wider">
                {gameName}
              </h1>
            </div>

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors"
              title="Copy Client Link"
            >
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-center gap-3">
          {/* Ranking Button - Pin Shape */}
          <button
            onClick={() => setActiveView('ranking')}
            className={`relative group transition-all duration-300 ${
              activeView === 'ranking' ? 'scale-110' : 'scale-100 opacity-70 hover:opacity-100'
            }`}
          >
            <div className={`w-24 h-32 relative ${activeView === 'ranking' ? 'drop-shadow-2xl' : ''}`}>
              {/* Pin Drop Shape */}
              <svg viewBox="0 0 100 140" className="w-full h-full">
                <defs>
                  <linearGradient id="rankingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#fbbf24', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#f59e0b', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <path
                  d="M 50 0 C 25 0, 10 20, 10 45 C 10 70, 50 110, 50 140 C 50 110, 90 70, 90 45 C 90 20, 75 0, 50 0 Z"
                  fill={activeView === 'ranking' ? 'url(#rankingGrad)' : '#6b7280'}
                  stroke="#fff"
                  strokeWidth="2"
                />
              </svg>
              {/* Icon */}
              <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '25%' }}>
                <Trophy className="w-10 h-10 text-white" />
              </div>
            </div>
            <p className="text-center mt-2 font-black text-xs text-white uppercase tracking-wider">
              Ranking
            </p>
          </button>

          {/* Stats Button - Pin Shape */}
          <button
            onClick={() => setActiveView('stats')}
            className={`relative group transition-all duration-300 ${
              activeView === 'stats' ? 'scale-110' : 'scale-100 opacity-70 hover:opacity-100'
            }`}
          >
            <div className={`w-24 h-32 relative ${activeView === 'stats' ? 'drop-shadow-2xl' : ''}`}>
              <svg viewBox="0 0 100 140" className="w-full h-full">
                <defs>
                  <linearGradient id="statsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#2563eb', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <path
                  d="M 50 0 C 25 0, 10 20, 10 45 C 10 70, 50 110, 50 140 C 50 110, 90 70, 90 45 C 90 20, 75 0, 50 0 Z"
                  fill={activeView === 'stats' ? 'url(#statsGrad)' : '#6b7280'}
                  stroke="#fff"
                  strokeWidth="2"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '25%' }}>
                <BarChart3 className="w-10 h-10 text-white" />
              </div>
            </div>
            <p className="text-center mt-2 font-black text-xs text-white uppercase tracking-wider">
              Stats
            </p>
          </button>

          {/* Gallery Button - Pin Shape */}
          <button
            onClick={() => setActiveView('gallery')}
            className={`relative group transition-all duration-300 ${
              activeView === 'gallery' ? 'scale-110' : 'scale-100 opacity-70 hover:opacity-100'
            }`}
          >
            <div className={`w-24 h-32 relative ${activeView === 'gallery' ? 'drop-shadow-2xl' : ''}`}>
              <svg viewBox="0 0 100 140" className="w-full h-full">
                <defs>
                  <linearGradient id="galleryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#14b8a6', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#0d9488', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <path
                  d="M 50 0 C 25 0, 10 20, 10 45 C 10 70, 50 110, 50 140 C 50 110, 90 70, 90 45 C 90 20, 75 0, 50 0 Z"
                  fill={activeView === 'gallery' ? 'url(#galleryGrad)' : '#6b7280'}
                  stroke="#fff"
                  strokeWidth="2"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '25%' }}>
                <ImageIcon className="w-10 h-10 text-white" />
              </div>
            </div>
            <p className="text-center mt-2 font-black text-xs text-white uppercase tracking-wider">
              Gallery
            </p>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-black/20 border border-purple-500/20 rounded-2xl p-6 backdrop-blur-sm">
          {activeView === 'ranking' && <ClientRanking teams={teams} gameId={gameId} />}
          {activeView === 'stats' && <ClientStats game={game} teams={teams} />}
          {activeView === 'gallery' && <ClientMediaGallery gameId={gameId} game={game} teams={teams} />}
        </div>
      </div>
    </div>
  );
};

export default ClientLobby;
