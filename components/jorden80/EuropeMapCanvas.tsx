/**
 * EuropeMapCanvas - SVG Europe map for the 80 Days journey
 * Shows cities, routes, and team positions with Victorian styling
 */

import React, { useMemo } from 'react';
import { Jorden80City, Jorden80TeamProgress, Team } from '../../types';
import { JORDEN80_CITIES, getCity, TEAM_COLORS } from '../../utils/jorden80/europeData';
import { getAllReachableCities } from '../../utils/jorden80/routeNetwork';
import './styles/victorian.css';

interface EuropeMapCanvasProps {
  teams?: Team[];
  currentTeamId?: string;
  teamProgress?: Record<string, Jorden80TeamProgress>;
  onCityClick?: (city: Jorden80City) => void;
  showAllTeams?: boolean;
  highlightedCities?: string[];
  width?: number;
  height?: number;
  /** When true, fills parent container (100% width/height) instead of fixed dimensions */
  fullSize?: boolean;
}

const EuropeMapCanvas: React.FC<EuropeMapCanvasProps> = ({
  teams = [],
  currentTeamId,
  teamProgress = {},
  onCityClick,
  showAllTeams = false,
  highlightedCities = [],
  width = 700,
  height = 500,
  fullSize = false
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

  // Vintage map image URL (1898 Europe map - public domain)
  const vintageMapUrl = 'https://www.pillarboxblue.com/wp-content/uploads/2018/02/Europe-map-1898-s.jpg';

  return (
    <div className="j80-map-container" style={{ width: fullSize ? '100%' : width, height: fullSize ? '100%' : height, position: fullSize ? 'absolute' : 'relative', top: 0, left: 0, pointerEvents: fullSize ? 'none' : 'auto' }}>
      {/* Vintage map background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url(${vintageMapUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: '8px',
          filter: 'sepia(20%) contrast(1.1)',
          opacity: 0.95
        }}
      />

      {/* Parchment overlay for vintage effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, rgba(244,228,193,0.15) 0%, rgba(139,115,85,0.1) 100%)',
          borderRadius: '8px',
          pointerEvents: 'none'
        }}
      />

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 700 500"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Defs for effects */}
        <defs>
          <filter id="cityGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="var(--j80-gold)" floodOpacity="0.6" />
          </filter>
          <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="var(--j80-parchment)" floodOpacity="0.9" />
          </filter>
        </defs>

        {/* Route lines */}
        <g>{renderRouteLines()}</g>

        {/* City markers */}
        <g transform="translate(0, 0)">{renderCities()}</g>

        {/* Compass rose - positioned in top right */}
        <g transform="translate(640, 60)">
          <circle r="28" fill="var(--j80-parchment)" stroke="var(--j80-gold)" strokeWidth="2" opacity="0.95" />
          <circle r="20" fill="none" stroke="var(--j80-ink-brown)" strokeWidth="1" opacity="0.5" />
          <text y="5" textAnchor="middle" fontSize="18" fill="var(--j80-gold)">✦</text>
          <text y="-12" textAnchor="middle" fontSize="10" fill="var(--j80-ink-brown)" fontFamily="'Playfair Display', serif" fontWeight="bold">N</text>
          <text y="20" textAnchor="middle" fontSize="8" fill="var(--j80-ink-brown)" fontFamily="'Playfair Display', serif">S</text>
          <text x="-14" y="4" textAnchor="middle" fontSize="8" fill="var(--j80-ink-brown)" fontFamily="'Playfair Display', serif">W</text>
          <text x="14" y="4" textAnchor="middle" fontSize="8" fill="var(--j80-ink-brown)" fontFamily="'Playfair Display', serif">E</text>
        </g>

        {/* Map title banner */}
        <g transform="translate(350, 25)">
          <rect x="-100" y="-18" width="200" height="30" rx="4" fill="var(--j80-parchment)" stroke="var(--j80-gold)" strokeWidth="2" opacity="0.95" />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fontFamily="'Playfair Display SC', serif"
            fontSize="16"
            fill="var(--j80-ink-brown)"
            letterSpacing="0.15em"
            fontWeight="600"
          >
            EUROPA 1872
          </text>
        </g>
      </svg>
    </div>
  );
};

export default EuropeMapCanvas;
