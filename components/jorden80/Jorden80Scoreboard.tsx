/**
 * Jorden80Scoreboard - Live scoreboard for projection display
 * Shows team progress, positions, and race status in Victorian style
 */

import React, { useMemo } from 'react';
import { Game, Team, Jorden80TeamProgress, Jorden80Config } from '../../types';
import { getCity, VEHICLES, JORDEN80_CITIES } from '../../utils/jorden80/europeData';
import {
  calculateFinalScore, DEFAULT_JORDEN80_CONFIG, getJourneyProgress
} from '../../utils/jorden80/dayCalculation';
import EuropeMapCanvas from './EuropeMapCanvas';
import './styles/victorian.css';
import { Trophy, Clock, MapPin, Flag } from 'lucide-react';

interface Jorden80ScoreboardProps {
  game: Game;
  teams: Team[];
}

interface TeamRanking {
  team: Team;
  progress: Jorden80TeamProgress;
  score: number;
  daysUsed: number;
  currentCity: string;
  isFinished: boolean;
  journeyPercent: number;
}

const Jorden80Scoreboard: React.FC<Jorden80ScoreboardProps> = ({
  game,
  teams
}) => {
  const config: Jorden80Config = game.jorden80Config || DEFAULT_JORDEN80_CONFIG;
  const teamProgress = game.jorden80TeamProgress || {};

  // Calculate rankings
  const rankings = useMemo((): TeamRanking[] => {
    const ranked: TeamRanking[] = [];

    teams.forEach(team => {
      const progress = teamProgress[team.id];
      if (!progress) return;

      // Check if this team was first to finish
      const finishedTeams = Object.entries(teamProgress)
        .filter(([_, p]) => p.hasFinished)
        .sort((a, b) => (a[1].finishedAt || Infinity) - (b[1].finishedAt || Infinity));

      const isFirstToFinish = finishedTeams[0]?.[0] === team.id;

      const scoreResult = calculateFinalScore(progress, config, isFirstToFinish);

      ranked.push({
        team,
        progress,
        score: scoreResult.totalScore,
        daysUsed: progress.daysUsed,
        currentCity: progress.currentCity,
        isFinished: progress.hasFinished,
        journeyPercent: getJourneyProgress(progress, JORDEN80_CITIES.length)
      });
    });

    // Sort: finished teams first (by days), then by progress percentage, then by score
    ranked.sort((a, b) => {
      // Both finished: compare days (lower is better)
      if (a.isFinished && b.isFinished) {
        return a.daysUsed - b.daysUsed;
      }
      // One finished: finished team wins
      if (a.isFinished) return -1;
      if (b.isFinished) return 1;
      // Neither finished: compare progress, then score
      if (a.journeyPercent !== b.journeyPercent) {
        return b.journeyPercent - a.journeyPercent;
      }
      return b.score - a.score;
    });

    return ranked;
  }, [teams, teamProgress, config]);

  // Get vehicle emoji
  const getVehicleEmoji = (vehicleId: string | undefined) => {
    const vehicle = VEHICLES.find(v => v.id === vehicleId);
    return vehicle?.emoji || '🚂';
  };

  // Find first finisher
  const firstFinisher = rankings.find(r => r.isFinished);

  return (
    <div className="j80-scoreboard">
      {/* Header */}
      <div className="j80-scoreboard-header">
        <h1 className="j80-scoreboard-title">JORDEN RUNDT PÅ 80 DAGE</h1>
        <p className="j80-font-body text-lg opacity-80">
          London → Istanbul • {config.daysLimit} Dage
        </p>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map */}
          <div>
            <h2 className="j80-font-heading text-xl mb-4" style={{ color: 'var(--j80-ink-brown)' }}>
              <MapPin className="inline w-5 h-5 mr-2" />
              Holdenes Positioner
            </h2>
            <EuropeMapCanvas
              teams={teams}
              teamProgress={teamProgress}
              showAllTeams={true}
              width={600}
              height={420}
            />
          </div>

          {/* Rankings */}
          <div>
            <h2 className="j80-font-heading text-xl mb-4" style={{ color: 'var(--j80-ink-brown)' }}>
              <Trophy className="inline w-5 h-5 mr-2" />
              Rangliste
            </h2>

            <div className="space-y-3">
              {rankings.map((ranking, index) => {
                const city = getCity(ranking.currentCity);
                const rank = index + 1;

                return (
                  <div
                    key={ranking.team.id}
                    className={`j80-team-row ${ranking.isFinished ? 'ring-2 ring-[var(--j80-gold)]' : ''}`}
                  >
                    {/* Rank */}
                    <div
                      className={`j80-team-rank ${
                        rank === 1 ? 'first' : rank === 2 ? 'second' : rank === 3 ? 'third' : ''
                      }`}
                    >
                      {rank}
                    </div>

                    {/* Team Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getVehicleEmoji(ranking.team.vehicle)}</span>
                        <span
                          className="j80-font-heading text-lg truncate"
                          style={{ color: ranking.team.color || 'var(--j80-ink-brown)' }}
                        >
                          {ranking.team.name}
                        </span>
                        {ranking.isFinished && (
                          <span className="text-xl ml-1">🏁</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1">
                        <span className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
                          📍 {city?.name || 'Unknown'}
                        </span>
                        <span className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
                          {ranking.journeyPercent}% af rejsen
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div
                        className="j80-font-heading text-xl"
                        style={{ color: 'var(--j80-gold)' }}
                      >
                        {ranking.score} pt
                      </div>
                      <div
                        className="j80-font-body text-sm flex items-center justify-end gap-1"
                        style={{
                          color: ranking.daysUsed > config.daysLimit
                            ? 'var(--j80-error)'
                            : 'var(--j80-sepia)'
                        }}
                      >
                        <Clock className="w-3 h-3" />
                        Dag {ranking.daysUsed}
                      </div>
                    </div>
                  </div>
                );
              })}

              {rankings.length === 0 && (
                <div className="text-center py-12">
                  <p className="j80-font-body" style={{ color: 'var(--j80-sepia)' }}>
                    Ingen hold er startet endnu
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Winner Banner */}
        {firstFinisher && (
          <div
            className="mt-8 p-6 rounded-xl text-center j80-animate-in"
            style={{
              background: 'linear-gradient(135deg, var(--j80-gold) 0%, var(--j80-gold-dark) 100%)',
              color: 'var(--j80-ink-black)'
            }}
          >
            <div className="text-4xl mb-2">🏆</div>
            <h2 className="j80-font-heading text-2xl mb-1">
              Første Hold i Istanbul!
            </h2>
            <p className="j80-font-body text-xl">
              {firstFinisher.team.name} ankom på {firstFinisher.daysUsed} dage
            </p>
            {firstFinisher.daysUsed <= config.daysLimit && (
              <p className="j80-font-body mt-2 opacity-80">
                {config.daysLimit - firstFinisher.daysUsed} dage under grænsen! 🎉
              </p>
            )}
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="j80-card p-4 text-center">
            <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
              Deltagende Hold
            </div>
            <div className="j80-font-heading text-3xl" style={{ color: 'var(--j80-ink-brown)' }}>
              {teams.filter(t => t.isStarted).length}
            </div>
          </div>

          <div className="j80-card p-4 text-center">
            <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
              Ankommet
            </div>
            <div className="j80-font-heading text-3xl" style={{ color: 'var(--j80-success)' }}>
              {rankings.filter(r => r.isFinished).length}
            </div>
          </div>

          <div className="j80-card p-4 text-center">
            <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
              Undervejs
            </div>
            <div className="j80-font-heading text-3xl" style={{ color: 'var(--j80-gold)' }}>
              {rankings.filter(r => !r.isFinished).length}
            </div>
          </div>

          <div className="j80-card p-4 text-center">
            <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
              Hurtigste Tid
            </div>
            <div className="j80-font-heading text-3xl" style={{ color: 'var(--j80-ink-brown)' }}>
              {firstFinisher ? `${firstFinisher.daysUsed}d` : '—'}
            </div>
          </div>
        </div>

        {/* City Progress Legend */}
        <div className="mt-8 j80-card p-4">
          <h3 className="j80-font-heading text-lg mb-4" style={{ color: 'var(--j80-ink-brown)' }}>
            <Flag className="inline w-5 h-5 mr-2" />
            Ruten
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {JORDEN80_CITIES.sort((a, b) => a.tier - b.tier).map((city, i) => (
              <React.Fragment key={city.id}>
                <div
                  className="flex items-center gap-1 px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: city.tier === 0
                      ? 'var(--j80-success)'
                      : city.tier === 5
                      ? 'var(--j80-gold)'
                      : 'var(--j80-parchment-dark)',
                    color: city.tier === 0 || city.tier === 5 ? 'white' : 'var(--j80-ink-brown)'
                  }}
                >
                  <span>{city.flagEmoji}</span>
                  <span className="j80-font-body text-sm">{city.name}</span>
                </div>
                {i < JORDEN80_CITIES.length - 1 && (
                  <span style={{ color: 'var(--j80-sepia)' }}>→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Jorden80Scoreboard;
