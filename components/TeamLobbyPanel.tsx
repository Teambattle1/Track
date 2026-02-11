import React, { useState, useEffect } from 'react';
import { X, Users, UserX, UserCheck, Shield, Zap } from 'lucide-react';
import { teamSync } from '../services/teamSync';
import { TeamMember } from '../types';
import * as db from '../services/db';

interface TeamLobbyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isCaptain: boolean;
  teamId?: string; // Optional: view specific team (not just current team)
  isDemoTeam?: boolean; // Optional: show demo badge and disable actions
  isInstructorMode?: boolean; // Optional: read-only mode for instructors
}

const TeamLobbyPanel: React.FC<TeamLobbyPanelProps> = ({ 
  isOpen, 
  onClose, 
  isCaptain,
  teamId,
  isDemoTeam = false,
  isInstructorMode = false
}) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const myDeviceId = teamSync.getDeviceId();

  useEffect(() => {
    if (!isOpen) return;

    // CASE 1: Demo Team - use mock members
    if (isDemoTeam) {
      // Generate mock members for demo
      const mockMembers: TeamMember[] = [
        {
          deviceId: 'demo-1',
          userName: 'Alex Chen',
          lastSeen: Date.now(),
          photoUrl: undefined,
          role: 'captain',
          isSolving: false,
          isRetired: false,
          deviceType: 'mobile'
        },
        {
          deviceId: 'demo-2',
          userName: 'Jordan Smith',
          lastSeen: Date.now() - 5000,
          photoUrl: undefined,
          role: 'member',
          isSolving: true,
          isRetired: false,
          deviceType: 'mobile'
        },
        {
          deviceId: 'demo-3',
          userName: 'Morgan Lee',
          lastSeen: Date.now() - 15000,
          photoUrl: undefined,
          role: 'member',
          isSolving: false,
          isRetired: false,
          deviceType: 'tablet'
        }
      ];
      setTeamMembers(mockMembers);
      return;
    }

    // CASE 2: Specific Team ID (INSTRUCTOR mode) - fetch from database
    if (teamId && teamId !== 'current') {
      setLoading(true);
      const loadTeamMembers = async () => {
        try {
          const team = await db.fetchTeam(teamId);
          if (team && team.members) {
            // Convert TeamMemberData to TeamMember format
            const members: TeamMember[] = team.members.map(m => ({
              deviceId: m.deviceId,
              userName: m.name,
              lastSeen: Date.now(),
              photoUrl: m.photo,
              role: undefined,
              isSolving: false,
              isRetired: false,
              deviceType: undefined
            }));
            setTeamMembers(members);
          }
        } catch (error) {
          console.error('[TeamLobbyPanel] Error loading team members:', error);
          setTeamMembers([]);
        } finally {
          setLoading(false);
        }
      };
      loadTeamMembers();
      return;
    }

    // CASE 3: Current Team (PLAY mode) - use teamSync subscription
    const unsubscribe = teamSync.subscribeToMembers((members) => {
      setTeamMembers(members);
    });

    // Get initial members
    setTeamMembers(teamSync.getAllMembers());

    return () => {
      unsubscribe();
    };
  }, [isOpen, teamId, isDemoTeam]);

  const handleRetirePlayer = (deviceId: string) => {
    if (isCaptain && !isInstructorMode && !isDemoTeam) {
      teamSync.retirePlayer(deviceId);
    }
  };

  const handleUnretirePlayer = (deviceId: string) => {
    if (isCaptain && !isInstructorMode && !isDemoTeam) {
      teamSync.unretirePlayer(deviceId);
    }
  };

  const handleRetireMyself = () => {
    if (isInstructorMode || isDemoTeam) return;
    if (confirm('Are you sure you want to retire from voting? Your votes will not count until you rejoin.')) {
      teamSync.retireMyself();
    }
  };

  const handleUnretireMyself = () => {
    if (isInstructorMode || isDemoTeam) return;
    teamSync.unretireMyself();
  };

  if (!isOpen) return null;

  const myMember = teamMembers.find(m => m.deviceId === myDeviceId);
  const otherMembers = teamMembers.filter(m => m.deviceId !== myDeviceId);

  // Determine header styling based on mode
  const headerColor = isDemoTeam 
    ? { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800' }
    : isInstructorMode
    ? { bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800' }
    : { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' };

  const headerIcon = isDemoTeam 
    ? <Zap className="w-8 h-8 text-orange-600 dark:text-orange-400" />
    : isInstructorMode
    ? <Shield className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
    : <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`p-6 ${headerColor.bg} border-b ${headerColor.border}`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {headerIcon}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Team Lobby</h2>
                  {isDemoTeam && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold uppercase">
                      <Zap className="w-3 h-3" />
                      Demo
                    </span>
                  )}
                  {isInstructorMode && !isDemoTeam && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold uppercase">
                      <Shield className="w-3 h-3" />
                      Preview
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {loading ? 'Loading...' : `${teamMembers.length} member${teamMembers.length !== 1 ? 's' : ''} online`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 transition-colors">
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* Captain Controls - Only show in PLAY mode for current team */}
          {isCaptain && !isInstructorMode && !isDemoTeam && (
            <div className="mb-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase">Captain Controls</p>
              </div>
              <p className="text-xs text-orange-700 dark:text-orange-300">
                You can retire members who are no longer playing. Their votes won't count.
              </p>
            </div>
          )}

          {/* Instructor Mode Badge */}
          {isInstructorMode && !isDemoTeam && (
            <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Instructor View</p>
              </div>
              <p className="text-xs text-indigo-700 dark:text-indigo-300">
                You are viewing this team's lobby. Player controls are disabled.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {/* My Card - Only show in PLAY mode without teamId */}
            {myMember && !teamId && !isInstructorMode && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {myMember.photoUrl ? (
                      <img 
                        src={myMember.photoUrl} 
                        alt={myMember.userName} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-blue-400"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-400 dark:bg-blue-600 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {myMember.userName}
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase font-black">You</span>
                        {myMember.role === 'captain' && (
                          <Shield className="w-4 h-4 text-orange-500" />
                        )}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {myMember.isRetired ? (
                          <span className="text-red-600 dark:text-red-400 font-bold">🚫 RETIRED</span>
                        ) : myMember.isSolving ? (
                          <span className="text-green-600 dark:text-green-400">📝 Solving task...</span>
                        ) : (
                          <span>✅ Active</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Self-Retire Button - Only in PLAY mode */}
                {!isInstructorMode && !isDemoTeam && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    {myMember.isRetired ? (
                      <button
                        onClick={handleUnretireMyself}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        REJOIN VOTING
                      </button>
                    ) : (
                      <button
                        onClick={handleRetireMyself}
                        className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <UserX className="w-4 h-4" />
                        RETIRE FROM VOTING
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Other Team Members */}
            {teamMembers.length > 0 && (
              <>
                {!myMember && (
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Team Members
                  </h3>
                )}
                {(myMember ? otherMembers : teamMembers).map((member) => (
                  <div 
                    key={member.deviceId}
                    className={`border-2 rounded-xl p-4 transition-all ${
                      member.isRetired 
                        ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 opacity-60' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        {member.photoUrl ? (
                          <img 
                            src={member.photoUrl} 
                            alt={member.userName} 
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <Users className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {member.userName}
                            {member.role === 'captain' && (
                              <Shield className="w-4 h-4 text-orange-500" />
                            )}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {member.isRetired ? (
                              <span className="text-red-600 dark:text-red-400 font-bold">🚫 RETIRED</span>
                            ) : member.isSolving ? (
                              <span className="text-green-600 dark:text-green-400">📝 Solving task...</span>
                            ) : (
                              <span>✅ Active</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Captain Controls - Only in PLAY mode for current team */}
                    {isCaptain && !isInstructorMode && !isDemoTeam && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        {member.isRetired ? (
                          <button
                            onClick={() => handleUnretirePlayer(member.deviceId)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <UserCheck className="w-4 h-4" />
                            ACTIVATE PLAYER
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRetirePlayer(member.deviceId)}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <UserX className="w-4 h-4" />
                            RETIRE PLAYER
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Empty State */}
            {teamMembers.length === 0 && !loading && (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  No members yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamLobbyPanel;
