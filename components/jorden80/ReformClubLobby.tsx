/**
 * ReformClubLobby - Team creation and game lobby for Jorden 80 Dage
 * Victorian-styled lobby inspired by the Reform Club from Jules Verne's novel
 */

import React, { useState, useEffect } from 'react';
import { Team, Game, Jorden80Vehicle, Jorden80TeamProgress } from '../../types';
import { TEAM_COLORS, VEHICLES, getCity } from '../../utils/jorden80/europeData';
import { createInitialProgress, DEFAULT_JORDEN80_CONFIG } from '../../utils/jorden80/dayCalculation';
import VehicleSelector from './VehicleSelector';
import { Users, Play, Clock, MapPin, Trophy, X } from 'lucide-react';
import './styles/victorian.css';

interface ReformClubLobbyProps {
  game: Game;
  teams: Team[];
  currentTeam?: Team;
  isInstructor: boolean;
  onCreateTeam: (name: string, color: string, vehicle: Jorden80Vehicle) => void;
  onJoinTeam: (teamId: string) => void;
  onStartGame: (teamId: string) => void;
  onClose: () => void;
}

const ReformClubLobby: React.FC<ReformClubLobbyProps> = ({
  game,
  teams,
  currentTeam,
  isInstructor,
  onCreateTeam,
  onJoinTeam,
  onStartGame,
  onClose
}) => {
  const [teamName, setTeamName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TEAM_COLORS[0].hex);
  const [selectedVehicle, setSelectedVehicle] = useState<Jorden80Vehicle>('train');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const config = game.jorden80Config || DEFAULT_JORDEN80_CONFIG;
  const startCity = getCity(config.startCity);

  // Get used colors
  const usedColors = new Set(teams.map(t => t.color).filter(Boolean));

  // Get available colors
  const availableColors = TEAM_COLORS.filter(c => !usedColors.has(c.hex));

  // Set first available color when opening form
  useEffect(() => {
    if (showCreateForm && availableColors.length > 0) {
      setSelectedColor(availableColors[0].hex);
    }
  }, [showCreateForm, availableColors.length]);

  const handleCreateTeam = () => {
    if (!teamName.trim()) return;
    onCreateTeam(teamName.trim(), selectedColor, selectedVehicle);
    setTeamName('');
    setShowCreateForm(false);
  };

  const getVehicleEmoji = (vehicleId: string | undefined) => {
    const vehicle = VEHICLES.find(v => v.id === vehicleId);
    return vehicle?.emoji || '🚂';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="j80-lobby min-h-screen">
      {/* Header */}
      <div className="j80-lobby-header relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 transition-colors"
        >
          <X className="w-6 h-6" style={{ color: 'var(--j80-sepia)' }} />
        </button>

        <h1 className="j80-lobby-title">The Reform Club</h1>
        <p className="j80-lobby-subtitle">London, {formatDate(new Date())}</p>

        {/* Game Info */}
        <div className="flex justify-center gap-6 mt-6">
          <div className="flex items-center gap-2" style={{ color: 'var(--j80-sepia)' }}>
            <MapPin className="w-5 h-5" />
            <span className="j80-font-body">
              {startCity?.name} → Istanbul
            </span>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--j80-sepia)' }}>
            <Clock className="w-5 h-5" />
            <span className="j80-font-body">
              Mål: Under {config.daysLimit} dage
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Teams List */}
        <div className="j80-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="j80-font-heading text-xl" style={{ color: 'var(--j80-ink-brown)' }}>
              <Users className="inline w-5 h-5 mr-2" />
              Deltagende Hold
            </h2>
            <span className="j80-font-body" style={{ color: 'var(--j80-sepia)' }}>
              {teams.length} hold
            </span>
          </div>

          {teams.length === 0 ? (
            <p className="j80-font-body text-center py-8" style={{ color: 'var(--j80-sepia)' }}>
              Ingen hold har tilmeldt sig endnu. Vær den første!
            </p>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => {
                const isCurrentTeam = currentTeam?.id === team.id;
                const progress = game.jorden80TeamProgress?.[team.id];

                return (
                  <div
                    key={team.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      isCurrentTeam
                        ? 'border-[var(--j80-gold)] bg-[var(--j80-parchment-light)]'
                        : 'border-[var(--j80-sepia)] bg-[var(--j80-parchment)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Team Color & Vehicle */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2"
                        style={{
                          backgroundColor: team.color || 'var(--j80-sepia)',
                          borderColor: 'var(--j80-ink-brown)'
                        }}
                      >
                        {getVehicleEmoji(team.vehicle)}
                      </div>

                      {/* Team Info */}
                      <div>
                        <h3 className="j80-font-heading text-lg" style={{ color: 'var(--j80-ink-brown)' }}>
                          {team.name}
                        </h3>
                        <p className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
                          {team.members.length} medlemmer
                          {progress?.hasFinished && ' • Ankommet!'}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {team.isStarted && (
                        <span
                          className="px-3 py-1 rounded-full text-sm j80-font-body"
                          style={{
                            backgroundColor: 'var(--j80-success)',
                            color: 'white'
                          }}
                        >
                          I gang
                        </span>
                      )}

                      {!currentTeam && !isInstructor && (
                        <button
                          onClick={() => onJoinTeam(team.id)}
                          className="j80-btn j80-btn-secondary text-sm"
                        >
                          Tilslut
                        </button>
                      )}

                      {isCurrentTeam && !team.isStarted && (
                        <button
                          onClick={() => onStartGame(team.id)}
                          className="j80-btn j80-btn-primary text-sm flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Start Rejsen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Team Form */}
        {!currentTeam && !isInstructor && (
          <div className="j80-card p-6">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full j80-btn j80-btn-primary flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" />
                Opret Nyt Hold
              </button>
            ) : (
              <div className="space-y-6">
                <h2 className="j80-font-heading text-xl text-center" style={{ color: 'var(--j80-ink-brown)' }}>
                  Opret Dit Hold
                </h2>

                {/* Team Name */}
                <div>
                  <label className="block j80-font-body mb-2" style={{ color: 'var(--j80-sepia)' }}>
                    Holdnavn
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Indtast holdnavn..."
                    className="j80-input w-full"
                    maxLength={30}
                  />
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block j80-font-body mb-2" style={{ color: 'var(--j80-sepia)' }}>
                    Holdfarve
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TEAM_COLORS.map((color) => {
                      const isUsed = usedColors.has(color.hex);
                      const isSelected = selectedColor === color.hex;

                      return (
                        <button
                          key={color.id}
                          onClick={() => !isUsed && setSelectedColor(color.hex)}
                          disabled={isUsed}
                          className={`w-10 h-10 rounded-full border-3 transition-all ${
                            isSelected ? 'ring-2 ring-offset-2 ring-[var(--j80-gold)]' : ''
                          } ${isUsed ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}`}
                          style={{
                            backgroundColor: color.hex,
                            borderColor: isSelected ? 'var(--j80-gold)' : 'var(--j80-ink-brown)'
                          }}
                          title={isUsed ? `${color.name} er optaget` : color.name}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Vehicle Selection */}
                <VehicleSelector
                  selectedVehicle={selectedVehicle}
                  onSelect={setSelectedVehicle}
                />

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 j80-btn j80-btn-secondary"
                  >
                    Annuller
                  </button>
                  <button
                    onClick={handleCreateTeam}
                    disabled={!teamName.trim()}
                    className="flex-1 j80-btn j80-btn-primary disabled:opacity-50"
                  >
                    Opret Hold
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructor Quick Actions */}
        {isInstructor && (
          <div className="j80-card p-6">
            <h2 className="j80-font-heading text-xl mb-4" style={{ color: 'var(--j80-ink-brown)' }}>
              <Trophy className="inline w-5 h-5 mr-2" />
              Instruktør Funktioner
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <button className="j80-btn j80-btn-secondary">
                Se Alle Fremskridt
              </button>
              <button className="j80-btn j80-btn-secondary">
                Scoreboard
              </button>
            </div>
          </div>
        )}

        {/* Rules Summary */}
        <div className="j80-card p-6 mt-6">
          <h2 className="j80-font-heading text-xl mb-4" style={{ color: 'var(--j80-ink-brown)' }}>
            Spillets Regler
          </h2>

          <div className="j80-font-body space-y-3" style={{ color: 'var(--j80-sepia)' }}>
            <p>
              <strong>1.</strong> Rejs fra London til Istanbul gennem Europa.
            </p>
            <p>
              <strong>2.</strong> I hver by skal I løse 3 opgaver: By-opgave, Land-opgave, og Kreativ opgave.
            </p>
            <p>
              <strong>3.</strong> Antal korrekte svar bestemmer hvilke destinationer I kan vælge:
            </p>
            <ul className="ml-6 list-disc">
              <li>3 korrekte = Vælg mellem alle 3 ruter</li>
              <li>2 korrekte = Vælg mellem 2 ruter</li>
              <li>0-1 korrekte = Kun 1 rute mulig</li>
            </ul>
            <p>
              <strong>4.</strong> Forkerte svar koster ekstra tid. Målet er at nå Istanbul på færrest mulige dage!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReformClubLobby;
