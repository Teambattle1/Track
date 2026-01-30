/**
 * AroundTheWorldTeamLogin - Victorian styled team login/selection
 * Real-time sync with Supabase to show available team names
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Team, Game } from '../../types';
import { VICTORIAN_TEAM_NAMES, VictorianTeamName } from '../../utils/aroundtheworld/teamNames';
import { VEHICLES } from '../../utils/jorden80/europeData';
import './styles/victorian-theme.css';
import { Users, ArrowRight, Check, Loader2 } from 'lucide-react';

interface AroundTheWorldTeamLoginProps {
  game: Game;
  existingTeams: Team[];
  onJoinTeam: (teamName: string, vehicleId: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const AroundTheWorldTeamLogin: React.FC<AroundTheWorldTeamLoginProps> = ({
  game,
  existingTeams,
  onJoinTeam,
  onClose,
  isLoading = false
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('train');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get taken team names (real-time from props)
  const takenTeamIds = useMemo(() => {
    return existingTeams.map(t => {
      const victorian = VICTORIAN_TEAM_NAMES.find(v => v.name === t.name);
      return victorian?.id || '';
    }).filter(Boolean);
  }, [existingTeams]);

  // Get available team names
  const availableTeams = useMemo(() => {
    return VICTORIAN_TEAM_NAMES.filter(t => !takenTeamIds.includes(t.id));
  }, [takenTeamIds]);

  // Handle team selection
  const handleSelectTeam = (teamId: string) => {
    if (takenTeamIds.includes(teamId)) return;
    setSelectedTeamId(teamId);
    setError(null);
  };

  // Handle join
  const handleJoin = async () => {
    if (!selectedTeamId) {
      setError('Please select a team name');
      return;
    }

    const team = VICTORIAN_TEAM_NAMES.find(t => t.id === selectedTeamId);
    if (!team) return;

    setIsJoining(true);
    setError(null);

    try {
      await onJoinTeam(team.name, selectedVehicle);
    } catch (err: any) {
      setError(err.message || 'Failed to join expedition');
      setIsJoining(false);
    }
  };

  // Get selected team info
  const selectedTeam = selectedTeamId
    ? VICTORIAN_TEAM_NAMES.find(t => t.id === selectedTeamId)
    : null;

  return (
    <div className="atw-container fixed inset-0 z-[5000] flex items-center justify-center p-4">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233d2914' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      <div className="atw-card max-w-4xl w-full relative atw-animate-in" style={{ maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div className="text-center pt-8 pb-4 px-8">
          <h1 className="atw-font-heading-sc text-3xl mb-2" style={{ color: 'var(--atw-ink-brown)' }}>
            Join the Expedition
          </h1>
          <p className="atw-font-elegant text-lg" style={{ color: 'var(--atw-sepia)' }}>
            {game.name || 'Around The World in 80 Days'}
          </p>
          <div className="atw-ornament">✦</div>
        </div>

        {/* Team Selection */}
        <div className="px-8 pb-4">
          <h2 className="atw-font-heading text-lg mb-4" style={{ color: 'var(--atw-ink-brown)' }}>
            <Users className="w-5 h-5 inline mr-2" />
            Choose Your Expedition Team
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--atw-gold)' }} />
              <span className="atw-font-body ml-3" style={{ color: 'var(--atw-sepia)' }}>
                Loading available teams...
              </span>
            </div>
          ) : (
            <div className="atw-team-selector">
              {VICTORIAN_TEAM_NAMES.map(team => {
                const isTaken = takenTeamIds.includes(team.id);
                const isSelected = selectedTeamId === team.id;

                return (
                  <div
                    key={team.id}
                    onClick={() => handleSelectTeam(team.id)}
                    className={`atw-team-name-card ${isTaken ? 'taken' : ''} ${isSelected ? 'selected' : ''}`}
                    style={{
                      borderColor: isSelected ? team.color : undefined
                    }}
                  >
                    <div className="text-3xl mb-2">{team.icon}</div>
                    <div className="atw-team-name">{team.name}</div>
                    <div className="atw-team-motto">"{team.motto}"</div>

                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-5 h-5" style={{ color: 'var(--atw-ink-black)' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {availableTeams.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <p className="atw-font-heading text-lg" style={{ color: 'var(--atw-danger)' }}>
                All expedition teams have been claimed!
              </p>
              <p className="atw-font-body mt-2" style={{ color: 'var(--atw-sepia)' }}>
                Please wait for the expedition master to add more teams.
              </p>
            </div>
          )}
        </div>

        {/* Vehicle Selection */}
        {selectedTeam && (
          <div className="px-8 pb-4 atw-animate-in">
            <div className="atw-divider" />
            <h2 className="atw-font-heading text-lg mb-4" style={{ color: 'var(--atw-ink-brown)' }}>
              Select Your Mode of Transport
            </h2>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {VEHICLES.map(vehicle => (
                <button
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedVehicle === vehicle.id
                      ? 'border-[var(--atw-gold)] bg-[var(--atw-gold)]/10'
                      : 'border-[var(--atw-sepia-light)] hover:border-[var(--atw-sepia)]'
                  }`}
                >
                  <div className="text-3xl text-center">{vehicle.emoji}</div>
                  <div className="atw-font-body text-xs text-center mt-1" style={{ color: 'var(--atw-ink-brown)' }}>
                    {vehicle.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-8 mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--atw-danger)', color: 'white' }}>
            <p className="atw-font-body text-sm">{error}</p>
          </div>
        )}

        {/* Selected Team Summary */}
        {selectedTeam && (
          <div className="px-8 pb-6">
            <div className="atw-divider" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{selectedTeam.icon}</span>
                <div>
                  <h3 className="atw-font-heading text-xl" style={{ color: 'var(--atw-ink-brown)' }}>
                    {selectedTeam.name}
                  </h3>
                  <p className="atw-font-elegant" style={{ color: 'var(--atw-sepia)' }}>
                    "{selectedTeam.motto}"
                  </p>
                </div>
              </div>

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="atw-btn atw-btn-primary flex items-center gap-2"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Embark on Journey
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="px-8 py-4 text-center"
          style={{ backgroundColor: 'var(--atw-parchment-dark)', borderTop: '2px solid var(--atw-sepia-light)' }}
        >
          <p className="atw-font-elegant text-sm" style={{ color: 'var(--atw-sepia)' }}>
            "A true Englishman doesn't joke when he is talking about something as serious as a wager."
          </p>
          <p className="atw-font-body text-xs mt-1" style={{ color: 'var(--atw-sepia-light)' }}>
            — Phileas Fogg, 1872
          </p>
        </div>
      </div>
    </div>
  );
};

export default AroundTheWorldTeamLogin;
