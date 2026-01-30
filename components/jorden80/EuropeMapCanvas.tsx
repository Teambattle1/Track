/**
 * EuropeMapCanvas - SVG Europe map for the 80 Days journey
 * Shows cities, routes, and team positions with Victorian styling
 */

import React, { useMemo } from 'react';
import { Jorden80City, Jorden80TeamProgress, Team } from '../../types';
import { JORDEN80_CITIES, getCity, TEAM_COLORS } from '../../utils/jorden80/europeData';
import { getAllReachableCities } from '../../utils/jorden80/routeNetwork';

interface EuropeMapCanvasProps {
  teams: Team[];
  currentTeamId?: string;
  teamProgress: Record<string, Jorden80TeamProgress>;
  onCityClick?: (city: Jorden80City) => void;
  showAllTeams?: boolean;
  highlightedCities?: string[];
  width?: number;
  height?: number;
}

const EuropeMapCanvas: React.FC<EuropeMapCanvasProps> = ({
  teams,
  currentTeamId,
  teamProgress,
  onCityClick,
  showAllTeams = false,
  highlightedCities = [],
  width = 700,
  height = 500
}) => {
  // Calculate team positions
  const teamPositions = useMemo(() => {
    const positions: Record<string, { city: Jorden80City; team: Team; progress: Jorden80TeamProgress }[]> = {};

    teams.forEach(team => {
      const progress = teamProgress[team.id];
      if (!progress) return;

      const city = getCity(progress.currentCity);
      if (!city) return;

      if (!positions[city.id]) {
        positions[city.id] = [];
      }
      positions[city.id].push({ city, team, progress });
    });

    return positions;
  }, [teams, teamProgress]);

  // Get current team's progress
  const currentProgress = currentTeamId ? teamProgress[currentTeamId] : undefined;
  const currentCity = currentProgress ? getCity(currentProgress.currentCity) : undefined;

  // Get visited cities for current team
  const visitedCities = useMemo(() => {
    if (!currentProgress) return new Set<string>();
    return new Set(currentProgress.visitedCities);
  }, [currentProgress]);

  // Get reachable cities from current position
  const reachableCities = useMemo(() => {
    if (!currentCity) return new Set<string>();
    const reachable = getAllReachableCities(currentCity.id);
    return new Set(reachable.map(c => c.id));
  }, [currentCity]);

  // Draw route lines between connected cities
  const renderRouteLines = () => {
    const lines: React.ReactNode[] = [];
    const drawnPairs = new Set<string>();

    JORDEN80_CITIES.forEach(city => {
      if (!city.connections) return;

      // Get all unique connected cities
      const connectedIds = new Set<string>();
      Object.values(city.connections).forEach(dests => {
        dests.forEach(d => connectedIds.add(d));
      });

      connectedIds.forEach(destId => {
        const pairKey = [city.id, destId].sort().join('-');
        if (drawnPairs.has(pairKey)) return;
        drawnPairs.add(pairKey);

        const destCity = getCity(destId);
        if (!destCity) return;

        // Check if this route was traveled
        const isTraveled = currentProgress?.route.some((c, i) => {
          const next = currentProgress.route[i + 1];
          return (c === city.id && next === destId) || (c === destId && next === city.id);
        });

        lines.push(
          <line
            key={pairKey}
            x1={city.position.x}
            y1={city.position.y}
            x2={destCity.position.x}
            y2={destCity.position.y}
            className={`j80-route-line ${isTraveled ? 'traveled' : ''}`}
          />
        );
      });
    });

    return lines;
  };

  // Render city markers
  const renderCities = () => {
    return JORDEN80_CITIES.map(city => {
      const isVisited = visitedCities.has(city.id);
      const isCurrent = currentCity?.id === city.id;
      const isReachable = reachableCities.has(city.id);
      const isHighlighted = highlightedCities.includes(city.id);
      const isStart = city.tier === 0;
      const isGoal = city.tier === 5;

      // Teams at this city
      const teamsHere = teamPositions[city.id] || [];
      const otherTeamsHere = teamsHere.filter(t => t.team.id !== currentTeamId);

      // Determine city state for styling
      const isLocked = !isVisited && !isCurrent && !isReachable && !isStart;

      return (
        <g
          key={city.id}
          className="j80-city-marker"
          style={{
            transform: `translate(${city.position.x}px, ${city.position.y}px)`
          }}
          onClick={() => onCityClick?.(city)}
        >
          {/* City dot */}
          <circle
            cx={0}
            cy={0}
            r={isGoal ? 16 : isStart ? 14 : 12}
            className={`j80-city-dot ${
              isCurrent ? 'current' : isVisited ? 'visited' : isLocked ? 'locked' : ''
            }`}
            style={{
              fill: isCurrent
                ? 'var(--j80-team-red)'
                : isVisited
                ? 'var(--j80-success)'
                : isGoal
                ? 'var(--j80-gold)'
                : isReachable
                ? 'var(--j80-gold-light)'
                : 'var(--j80-sepia-light)',
              stroke: isHighlighted ? 'var(--j80-gold)' : 'var(--j80-ink-brown)',
              strokeWidth: isHighlighted ? 4 : 3,
              cursor: onCityClick ? 'pointer' : 'default'
            }}
          />

          {/* Flag emoji for visited/current */}
          {(isCurrent || isVisited || isGoal) && (
            <text
              x={0}
              y={4}
              textAnchor="middle"
              fontSize={isGoal ? 16 : 12}
              style={{ pointerEvents: 'none' }}
            >
              {isGoal ? '🏁' : city.flagEmoji}
            </text>
          )}

          {/* City label */}
          <text
            x={0}
            y={isGoal ? 28 : 24}
            textAnchor="middle"
            className="j80-city-label"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: isGoal || isStart ? 13 : 11,
              fontWeight: isCurrent || isGoal ? 700 : 600,
              fill: isLocked ? 'var(--j80-sepia-light)' : 'var(--j80-ink-brown)',
              textShadow: '1px 1px 2px var(--j80-parchment)'
            }}
          >
            {city.name}
          </text>

          {/* Other teams markers */}
          {showAllTeams && otherTeamsHere.length > 0 && (
            <g>
              {otherTeamsHere.slice(0, 4).map((item, i) => {
                const angle = (i * 90 - 45) * (Math.PI / 180);
                const radius = 22;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <circle
                    key={item.team.id}
                    cx={x}
                    cy={y}
                    r={8}
                    fill={item.team.color || 'var(--j80-sepia)'}
                    stroke="var(--j80-parchment)"
                    strokeWidth={2}
                  />
                );
              })}
              {otherTeamsHere.length > 4 && (
                <text
                  x={28}
                  y={4}
                  fontSize={10}
                  fill="var(--j80-sepia)"
                  fontFamily="'Playfair Display', serif"
                >
                  +{otherTeamsHere.length - 4}
                </text>
              )}
            </g>
          )}
        </g>
      );
    });
  };

  return (
    <div className="j80-map-container" style={{ width, height }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 700 500"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'var(--j80-ocean-blue)' }}
      >
        {/* Map background - simplified Europe shape */}
        <defs>
          <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--j80-land-green)" />
            <stop offset="100%" stopColor="var(--j80-land-dark)" />
          </linearGradient>

          <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Simplified Europe landmass */}
        <path
          d="M 150,120
             Q 200,80 300,100
             Q 400,80 500,120
             Q 600,100 650,180
             Q 680,280 620,380
             Q 580,450 520,470
             Q 400,460 300,450
             Q 200,440 150,380
             Q 120,300 150,200
             Q 140,150 150,120 Z"
          fill="url(#landGradient)"
          filter="url(#mapShadow)"
          opacity="0.9"
        />

        {/* British Isles */}
        <ellipse cx="200" cy="200" rx="60" ry="80" fill="url(#landGradient)" filter="url(#mapShadow)" opacity="0.9" />

        {/* Scandinavia hint */}
        <path
          d="M 350,50 Q 400,60 420,120 Q 440,80 480,60 Q 500,100 470,150 Q 400,140 350,50 Z"
          fill="url(#landGradient)"
          filter="url(#mapShadow)"
          opacity="0.7"
        />

        {/* Italy hint */}
        <path
          d="M 380,340 Q 400,400 420,450 Q 380,460 360,420 Q 350,380 380,340 Z"
          fill="url(#landGradient)"
          filter="url(#mapShadow)"
          opacity="0.9"
        />

        {/* Turkey/Asia Minor */}
        <path
          d="M 580,380 Q 640,360 680,400 Q 700,450 650,470 Q 600,460 580,420 Q 570,400 580,380 Z"
          fill="url(#landGradient)"
          filter="url(#mapShadow)"
          opacity="0.9"
        />

        {/* Route lines */}
        <g>{renderRouteLines()}</g>

        {/* City markers */}
        <g transform="translate(0, 0)">{renderCities()}</g>

        {/* Compass rose */}
        <g transform="translate(630, 80)">
          <circle r="30" fill="var(--j80-parchment)" stroke="var(--j80-gold)" strokeWidth="2" />
          <text y="5" textAnchor="middle" fontSize="20" fill="var(--j80-ink-brown)">☼</text>
          <text y="-15" textAnchor="middle" fontSize="10" fill="var(--j80-ink-brown)" fontFamily="'Playfair Display', serif">N</text>
        </g>

        {/* Map title */}
        <text
          x="350"
          y="35"
          textAnchor="middle"
          fontFamily="'Playfair Display SC', serif"
          fontSize="20"
          fill="var(--j80-ink-brown)"
          letterSpacing="0.15em"
        >
          EUROPA 1872
        </text>
      </svg>
    </div>
  );
};

export default EuropeMapCanvas;
