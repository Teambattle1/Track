import React, { useState, useEffect } from 'react';
import { Game } from '../types';
import * as db from '../services/db';
import { X, Loader2, Trophy, Clock, CheckCircle, Search } from 'lucide-react';
import { getGameDisplayId, matchesGameSearch } from '../utils/gameIdUtils';

interface ClientGameChooserProps {
  onClose: () => void;
  onSelectGame: (gameId: string) => void;
}

const ClientGameChooser: React.FC<ClientGameChooserProps> = ({ onClose, onSelectGame }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    setLoading(true);
    try {
      const allGames = await db.fetchGames();
      // Filter for active or completed games (exclude templates and planned)
      const clientGames = allGames.filter(g => 
        !g.isGameTemplate && 
        (g.status === 'active' || g.status === 'completed')
      );
      setGames(clientGames);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGames = games.filter(game =>
    matchesGameSearch(game.name, game.id, searchQuery) ||
    game.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Trophy className="w-5 h-5 text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 border-green-500 text-green-400';
      case 'completed':
        return 'bg-blue-500/20 border-blue-500 text-blue-400';
      default:
        return 'bg-gray-500/20 border-gray-500 text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-purple-500 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-wider">
              Select Game
            </h2>
            <p className="text-purple-200 text-sm mt-1">
              Choose an active or completed game to view
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-purple-500/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search games..."
              className="w-full pl-10 pr-4 py-3 bg-purple-900/30 border border-purple-500/50 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Games List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-bold">
                {searchQuery ? 'No games found matching your search' : 'No active or completed games available'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Games must be started or completed to appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGames.map(game => (
                <button
                  key={game.id}
                  onClick={() => onSelectGame(game.id)}
                  className="bg-purple-900/20 border-2 border-purple-500/30 hover:border-purple-500 rounded-xl p-4 text-left transition-all hover:scale-105 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-lg group-hover:text-purple-400 transition-colors">
                        <span className="text-purple-400">[{getGameDisplayId(game.id)}]</span> {game.name}
                      </h3>
                      {game.description && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                          {game.description}
                        </p>
                      )}
                    </div>
                    {getStatusIcon(game.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase ${getStatusColor(game.status)}`}>
                      {getStatusLabel(game.status)}
                    </div>
                    {game.points && (
                      <span className="text-xs text-gray-500">
                        {game.points.filter(p => !p.isSectionHeader).length} tasks
                      </span>
                    )}
                  </div>

                  {/* Game Stats */}
                  <div className="mt-3 pt-3 border-t border-purple-500/20 flex items-center gap-4 text-xs text-gray-400">
                    {game.timerConfig?.endingAt && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(game.timerConfig.endingAt).toLocaleDateString()}
                      </div>
                    )}
                    {game.mapStyle && (
                      <div className="capitalize">
                        {game.mapStyle.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-purple-500/30 bg-black/20">
          <p className="text-xs text-gray-400 text-center">
            💡 <strong>Tip:</strong> Share the client link with participants to view game statistics and media gallery
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClientGameChooser;
