import React, { useState, useEffect } from 'react';
import { X, Users, Shield } from 'lucide-react';
import { Team } from '../types';
import * as db from '../services/db';

interface TeamsLobbySelectorProps {
  gameId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectTeam: (teamId: string) => void;
}

const TeamsLobbySelector: React.FC<TeamsLobbySelectorProps> = ({
  gameId,
  isOpen,
  onClose,
  onSelectTeam
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load teams when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadTeams = async () => {
      setLoading(true);
      try {
        const teamsData = await db.fetchTeams(gameId);
        setTeams(teamsData);
      } catch (error) {
        console.error('[TeamsLobbySelector] Error loading teams:', error);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [isOpen, gameId]);

  if (!isOpen) return null;

  // Filter teams based on search query
  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-blue-100 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Team Lobbies</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Select a team to view their lobby details
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1 rounded-full hover:bg-black/10 transition-colors"
            >
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search teams by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin">
                <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full" />
              </div>
            </div>
          )}

          {/* Teams List */}
          {!loading && (
            <>
              {filteredTeams.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    {teams.length === 0 ? 'No teams yet' : 'No teams match your search'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTeams.map(team => {
                    const tc = team.color || '#3b82f6'; // fallback blue
                    return (
                      <button
                        key={team.id}
                        onClick={() => {
                          onSelectTeam(team.id);
                          onClose();
                        }}
                        className="w-full text-left p-4 rounded-xl transition-all group"
                        style={{
                          backgroundColor: tc + '10',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: tc + '30',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = tc + '60'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = tc + '30'; }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-white text-xl uppercase tracking-wider transition-colors">
                              {team.name}
                            </h3>
                            <div className="flex items-center gap-4 mt-2 text-sm font-black uppercase tracking-widest" style={{ color: tc }}>
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {team.members?.length || 0} MEMBERS
                              </span>
                              <span className="flex items-center gap-1">
                                {team.score || 0} PTS
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-4 p-3 rounded-lg transition-colors"
                               style={{ backgroundColor: tc + '20', color: tc }}>
                            <Shield className="w-5 h-5" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamsLobbySelector;
