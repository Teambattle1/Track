import React, { useState, useEffect } from 'react';
import { X, Users, Shield, Search, RefreshCw, ChevronRight } from 'lucide-react';
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
    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#111111] border-2 border-orange-500/20 rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,1)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 bg-black/80 border-b border-orange-500/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-orange-600/15 rounded-2xl flex items-center justify-center border-2 border-orange-500/30">
                <Shield className="w-7 h-7 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wider">TEAM LOBBIES</h2>
                <p className="text-sm text-slate-300 font-black uppercase tracking-[0.2em] mt-0.5">
                  SELECT A TEAM TO VIEW LOBBY
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* Search Bar */}
          {teams.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="SEARCH TEAMS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white text-black placeholder:text-slate-400 rounded-xl border-2 border-slate-300 focus:border-orange-500/50 focus:outline-none text-sm font-black uppercase tracking-wider shadow-sm"
              />
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          )}

          {/* Teams List */}
          {!loading && (
            <>
              {filteredTeams.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-14 h-14 text-gray-500 mx-auto mb-4" />
                  <p className="text-lg font-black text-white uppercase tracking-wider">
                    {teams.length === 0 ? 'NO TEAMS YET' : 'NO TEAMS MATCH'}
                  </p>
                  <p className="text-sm text-slate-300 font-bold uppercase tracking-wider mt-2">
                    {teams.length === 0 ? 'NO TEAMS HAVE JOINED THIS GAME YET' : 'TRY A DIFFERENT SEARCH'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTeams.map(team => (
                    <button
                      key={team.id}
                      onClick={() => {
                        onSelectTeam(team.id);
                        onClose();
                      }}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl bg-black/60 border-2 border-gray-700/50 hover:border-orange-500/50 hover:bg-gray-900/80 transition-all text-left group"
                    >
                      {team.photoUrl ? (
                        <img src={team.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-gray-600 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center border-2 border-gray-600 shrink-0"
                             style={team.color ? { backgroundColor: team.color + '20', borderColor: team.color + '40' } : {}}>
                          <Users className="w-6 h-6 text-gray-400" style={team.color ? { color: team.color } : {}} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-white uppercase tracking-wider truncate">
                          {team.name}
                        </h3>
                        <p className="text-sm text-slate-300 font-bold uppercase tracking-widest mt-0.5">
                          {team.members?.length || 0} MEMBERS · <span className="text-orange-400 font-black">{team.score || 0} PTS</span>
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500 shrink-0 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/60 border-t border-orange-500/10 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-800 border border-gray-600 text-white rounded-xl font-black uppercase tracking-wider text-sm hover:bg-gray-700 transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamsLobbySelector;
