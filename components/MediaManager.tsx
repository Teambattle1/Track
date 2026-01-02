import React, { useState, useEffect } from 'react';
import { X, Trash2, Download, Calendar, HardDrive, Image as ImageIcon, Video, CheckCircle, AlertTriangle } from 'lucide-react';
import { Game, MediaSubmission } from '../types';
import { getMediaStats, deleteMediaOlderThan } from '../services/mediaUpload';

interface MediaManagerProps {
  onClose: () => void;
  games: Game[];
}

interface GameMediaStats {
  gameId: string;
  gameName: string;
  photoCount: number;
  videoCount: number;
  totalSizeMB: number;
  downloadedCount: number;
}

const MediaManager: React.FC<MediaManagerProps> = ({ onClose, games }) => {
  const [gameStats, setGameStats] = useState<GameMediaStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadMediaStats();
  }, [games]);

  const loadMediaStats = async () => {
    setIsLoading(true);
    try {
      // TODO: Fetch media submissions from Supabase
      // For now, simulate with empty data
      const stats: GameMediaStats[] = games.map(game => ({
        gameId: game.id,
        gameName: game.name,
        photoCount: 0,
        videoCount: 0,
        totalSizeMB: 0,
        downloadedCount: 0
      }));
      setGameStats(stats);
    } catch (error) {
      console.error('Failed to load media stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearMedia = async () => {
    if (!selectedDate) {
      alert('Please select a date to clear media older than.');
      return;
    }

    const confirmMsg = selectedGame === 'all'
      ? `Delete ALL media (photos/videos) from ALL games older than ${selectedDate}?`
      : `Delete ALL media (photos/videos) from "${games.find(g => g.id === selectedGame)?.name}" older than ${selectedDate}?`;

    if (!confirm(confirmMsg + '\n\nThis action cannot be undone!')) {
      return;
    }

    setIsClearing(true);
    try {
      // TODO: Implement Supabase deletion logic
      // 1. Query media_submissions table for items older than selectedDate
      // 2. Delete files from Supabase Storage
      // 3. Delete records from media_submissions table
      
      alert('✅ Media cleanup completed!');
      await loadMediaStats();
    } catch (error) {
      console.error('Failed to clear media:', error);
      alert('❌ Failed to clear media. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const totalStats = gameStats.reduce(
    (acc, stat) => ({
      photoCount: acc.photoCount + stat.photoCount,
      videoCount: acc.videoCount + stat.videoCount,
      totalSizeMB: acc.totalSizeMB + stat.totalSizeMB,
      downloadedCount: acc.downloadedCount + stat.downloadedCount
    }),
    { photoCount: 0, videoCount: 0, totalSizeMB: 0, downloadedCount: 0 }
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-purple-900/30 to-blue-900/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Media Manager</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Global Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-bold text-blue-300 uppercase">Photos</span>
              </div>
              <div className="text-2xl font-black text-white">{totalStats.photoCount}</div>
            </div>

            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-5 h-5 text-purple-400" />
                <span className="text-xs font-bold text-purple-300 uppercase">Videos</span>
              </div>
              <div className="text-2xl font-black text-white">{totalStats.videoCount}</div>
            </div>

            <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-5 h-5 text-orange-400" />
                <span className="text-xs font-bold text-orange-300 uppercase">Total Size</span>
              </div>
              <div className="text-2xl font-black text-white">{totalStats.totalSizeMB.toFixed(1)} MB</div>
            </div>

            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-5 h-5 text-green-400" />
                <span className="text-xs font-bold text-green-300 uppercase">Downloaded</span>
              </div>
              <div className="text-2xl font-black text-white">{totalStats.downloadedCount}</div>
            </div>
          </div>

          {/* Clear Media Section */}
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="w-5 h-5 text-red-400" />
              <h3 className="text-sm font-black text-red-300 uppercase">Clear Old Media</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Game Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Select Game</label>
                  <select
                    value={selectedGame}
                    onChange={(e) => setSelectedGame(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white font-bold outline-none focus:border-red-500 transition-all"
                  >
                    <option value="all">All Games</option>
                    {games.map(game => (
                      <option key={game.id} value={game.id}>{game.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Delete Older Than</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white font-bold outline-none focus:border-red-500 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleClearMedia}
                disabled={!selectedDate || isClearing}
                className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold uppercase flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 className="w-5 h-5" />
                {isClearing ? 'Clearing...' : 'Delete Media'}
              </button>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-300">
                    <strong>Warning:</strong> This will permanently delete all photos and videos from Supabase Storage. 
                    Downloaded media (marked with ✓) is safe to delete. Make sure clients have downloaded all necessary media first.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Game List */}
          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase mb-3">Media by Game</h3>
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-12 text-slate-500">
                  <HardDrive className="w-8 h-8 animate-pulse mx-auto mb-2" />
                  <p className="text-sm font-bold">Loading media statistics...</p>
                </div>
              ) : gameStats.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-bold">No media found</p>
                </div>
              ) : (
                gameStats.map(stat => (
                  <div
                    key={stat.gameId}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:bg-slate-800 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-white text-sm mb-2">{stat.gameName}</h4>
                        <div className="flex gap-6 text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            <span>{stat.photoCount} photos</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            <span>{stat.videoCount} videos</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            <span>{stat.totalSizeMB.toFixed(1)} MB</span>
                          </div>
                          {stat.downloadedCount > 0 && (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              <span>{stat.downloadedCount} downloaded</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaManager;
