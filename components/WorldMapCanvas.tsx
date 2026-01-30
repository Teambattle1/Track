import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Destination, TeamDestinationProgress, Team, Coordinate, WorldMapStyle } from '../types';
import {
  Flag, Lock, CheckCircle, MapPin, Compass, Users, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';

interface TeamPosition {
  teamId: string;
  teamName: string;
  destinationId: string;
  color?: string;
  photoUrl?: string;
}

interface WorldMapCanvasProps {
  destinations: Destination[];
  teamProgress: TeamDestinationProgress[];
  teams: Team[];
  currentTeamId?: string;
  mapStyle: WorldMapStyle;
  mapImageUrl?: string;
  showTeamPositions: boolean;
  onDestinationClick: (destination: Destination) => void;
  selectedDestinationId?: string;
  fieldMissionDestinationId?: string;
}

// Default world map SVG background
const DEFAULT_WORLD_MAP = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" fill="none">
  <rect width="1000" height="500" fill="#1e293b"/>
  <path d="M150 100 L200 80 L250 90 L300 70 L350 85 L400 75 L420 90 L450 80 L470 95 L490 85 L500 100 L490 120 L470 130 L440 125 L410 140 L380 135 L350 145 L320 140 L290 150 L260 145 L230 155 L200 150 L170 160 L150 150 L140 130 L150 110 Z" fill="#334155" stroke="#475569" stroke-width="2"/>
  <path d="M500 100 L550 90 L600 95 L650 85 L700 100 L750 95 L800 110 L830 105 L860 120 L880 115 L900 130 L890 150 L870 160 L840 155 L810 165 L780 160 L750 170 L720 165 L690 175 L660 170 L630 180 L600 175 L570 185 L540 180 L510 190 L490 180 L480 160 L490 140 L500 120 Z" fill="#334155" stroke="#475569" stroke-width="2"/>
  <path d="M550 200 L600 190 L650 200 L700 195 L750 210 L780 205 L800 220 L820 215 L840 230 L860 225 L880 240 L870 260 L850 270 L820 265 L790 275 L760 270 L730 280 L700 275 L670 285 L640 280 L610 290 L580 285 L550 295 L530 285 L520 265 L530 245 L540 225 Z" fill="#334155" stroke="#475569" stroke-width="2"/>
  <path d="M100 200 L150 210 L200 200 L250 215 L300 205 L350 220 L390 215 L420 230 L400 250 L370 260 L340 255 L310 265 L280 260 L250 270 L220 265 L190 275 L160 270 L130 280 L110 270 L100 250 L110 230 Z" fill="#334155" stroke="#475569" stroke-width="2"/>
  <path d="M700 300 L750 290 L800 300 L850 295 L900 310 L920 330 L910 360 L880 380 L840 375 L800 390 L760 385 L720 400 L680 395 L650 405 L630 395 L640 370 L660 350 L690 330 Z" fill="#334155" stroke="#475569" stroke-width="2"/>
  <path d="M150 320 L200 310 L250 320 L300 315 L350 330 L380 350 L370 380 L340 400 L300 395 L260 410 L220 405 L180 420 L150 410 L130 390 L140 360 L150 340 Z" fill="#334155" stroke="#475569" stroke-width="2"/>
</svg>
`)}`;

// Map region presets
const MAP_REGIONS: Record<WorldMapStyle, { viewBox: string; label: string }> = {
  world: { viewBox: '0 0 100 100', label: 'World' },
  europe: { viewBox: '40 15 25 25', label: 'Europe' },
  asia: { viewBox: '55 20 35 35', label: 'Asia' },
  americas: { viewBox: '5 15 40 50', label: 'Americas' },
  africa: { viewBox: '35 30 30 40', label: 'Africa' },
  custom: { viewBox: '0 0 100 100', label: 'Custom' }
};

/**
 * WorldMapCanvas - Interactive world map with destination markers
 * Supports pan/zoom, destination markers with states, and team positions
 */
const WorldMapCanvas: React.FC<WorldMapCanvasProps> = ({
  destinations,
  teamProgress,
  teams,
  currentTeamId,
  mapStyle,
  mapImageUrl,
  showTeamPositions,
  onDestinationClick,
  selectedDestinationId,
  fieldMissionDestinationId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Get destination state
  const getDestinationState = useCallback((destination: Destination) => {
    if (!currentTeamId) {
      return { isUnlocked: destination.unlockOrder === 0, isCompleted: false };
    }

    const progress = teamProgress.find(
      tp => tp.teamId === currentTeamId && tp.destinationId === destination.id
    );

    return {
      isUnlocked: progress?.isUnlocked ?? destination.unlockOrder === 0,
      isCompleted: progress?.isCompleted ?? false
    };
  }, [currentTeamId, teamProgress]);

  // Get team positions on map
  const teamPositions: TeamPosition[] = React.useMemo(() => {
    if (!showTeamPositions) return [];

    return teams.map(team => {
      // Find the team's current destination (last unlocked but not completed)
      const teamProgressItems = teamProgress.filter(tp => tp.teamId === team.id && tp.isUnlocked);
      const currentProgress = teamProgressItems
        .filter(tp => !tp.isCompleted)
        .sort((a, b) => {
          const destA = destinations.find(d => d.id === a.destinationId);
          const destB = destinations.find(d => d.id === b.destinationId);
          return (destA?.unlockOrder ?? 0) - (destB?.unlockOrder ?? 0);
        })[0];

      // If no current destination, use the last completed one
      const lastCompleted = teamProgressItems
        .filter(tp => tp.isCompleted)
        .sort((a, b) => {
          const destA = destinations.find(d => d.id === a.destinationId);
          const destB = destinations.find(d => d.id === b.destinationId);
          return (destB?.unlockOrder ?? 0) - (destA?.unlockOrder ?? 0);
        })[0];

      const destinationId = currentProgress?.destinationId || lastCompleted?.destinationId || destinations[0]?.id;

      return {
        teamId: team.id,
        teamName: team.name,
        destinationId: destinationId || '',
        color: team.color,
        photoUrl: team.photoUrl
      };
    }).filter(tp => tp.destinationId);
  }, [teams, teamProgress, destinations, showTeamPositions]);

  // Handle zoom
  const handleZoom = (delta: number) => {
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Handle pan start
  const handlePanStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsPanning(true);
    const point = 'touches' in e ? e.touches[0] : e;
    setPanStart({ x: point.clientX - offset.x, y: point.clientY - offset.y });
  };

  // Handle pan move
  const handlePanMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isPanning) return;
    const point = 'touches' in e ? e.touches[0] : e;
    setOffset({
      x: point.clientX - panStart.x,
      y: point.clientY - panStart.y
    });
  }, [isPanning, panStart]);

  // Handle pan end
  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Add/remove pan listeners
  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanEnd);
      window.addEventListener('touchmove', handlePanMove);
      window.addEventListener('touchend', handlePanEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
      window.removeEventListener('touchmove', handlePanMove);
      window.removeEventListener('touchend', handlePanEnd);
    };
  }, [isPanning, handlePanMove, handlePanEnd]);

  // Reset view
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-slate-900 select-none"
      onWheel={handleWheel}
    >
      {/* Map Container */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.2s ease-out'
        }}
        onMouseDown={handlePanStart}
        onTouchStart={handlePanStart}
      >
        {/* Map Background */}
        <div className="absolute inset-0">
          <img
            src={mapImageUrl || DEFAULT_WORLD_MAP}
            alt="World Map"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* Grid Overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Latitude lines */}
            {[20, 40, 60, 80].map(y => (
              <line key={`lat-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="white" strokeWidth="0.2" />
            ))}
            {/* Longitude lines */}
            {[20, 40, 60, 80].map(x => (
              <line key={`lng-${x}`} x1={x} y1="0" x2={x} y2="100" stroke="white" strokeWidth="0.2" />
            ))}
          </svg>
        </div>

        {/* Destination Markers */}
        {destinations.map(destination => {
          const { isUnlocked, isCompleted } = getDestinationState(destination);
          const isSelected = selectedDestinationId === destination.id;
          const isFieldMission = fieldMissionDestinationId === destination.id;

          // Get teams at this destination
          const teamsHere = teamPositions.filter(tp => tp.destinationId === destination.id);
          const isCurrentTeamHere = teamsHere.some(tp => tp.teamId === currentTeamId);

          return (
            <div
              key={destination.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${destination.position.x}%`,
                top: `${destination.position.y}%`,
                zIndex: isSelected ? 100 : isCompleted ? 10 : isUnlocked ? 20 : 5
              }}
            >
              {/* Connection Lines (to show unlock path) */}
              {/* TODO: Add connection lines between destinations */}

              {/* Destination Marker */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDestinationClick(destination);
                }}
                className={`group relative transition-all duration-300 ${
                  isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                {/* Pulse Ring for Current Team's Active Destination */}
                {isCurrentTeamHere && !isCompleted && (
                  <div className="absolute inset-0 -m-4 animate-ping">
                    <div className="w-full h-full rounded-full bg-cyan-500/30" />
                  </div>
                )}

                {/* Field Mission Indicator */}
                {isFieldMission && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="w-6 h-6 rounded-full bg-orange-600 border-2 border-orange-400 flex items-center justify-center animate-bounce">
                      <Compass className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}

                {/* Main Marker */}
                <div
                  className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl transition-all duration-300 ${
                    isSelected
                      ? 'scale-125 ring-4 ring-white/50'
                      : 'group-hover:scale-110'
                  } ${
                    isCompleted
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-green-400'
                      : isUnlocked
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-2 border-cyan-400 group-hover:from-cyan-400 group-hover:to-blue-500'
                        : 'bg-slate-700 border-2 border-slate-500 opacity-50'
                  }`}
                  style={
                    destination.color && isUnlocked
                      ? { background: `linear-gradient(135deg, ${destination.color}, ${destination.color}aa)`, borderColor: destination.color }
                      : undefined
                  }
                >
                  {!isUnlocked ? (
                    <Lock className="w-6 h-6 text-slate-400" />
                  ) : isCompleted ? (
                    <CheckCircle className="w-7 h-7 text-white" />
                  ) : (
                    destination.flagEmoji || <Flag className="w-6 h-6 text-white" />
                  )}
                </div>

                {/* Destination Name Label */}
                <div className={`absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shadow-lg ${
                    isCompleted
                      ? 'bg-green-900/90 text-green-200 border border-green-700'
                      : isUnlocked
                        ? 'bg-slate-900/90 text-white border border-slate-700'
                        : 'bg-slate-800/90 text-slate-400 border border-slate-600'
                  }`}>
                    {destination.name}
                  </div>
                </div>

                {/* Team Avatars */}
                {showTeamPositions && teamsHere.length > 0 && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex -space-x-2">
                    {teamsHere.slice(0, 4).map((tp, i) => (
                      <div
                        key={tp.teamId}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] font-bold shadow-lg ${
                          tp.teamId === currentTeamId
                            ? 'border-cyan-400 bg-cyan-600 text-white z-10'
                            : 'border-slate-600 bg-slate-700 text-slate-300'
                        }`}
                        style={tp.color ? { borderColor: tp.color, backgroundColor: `${tp.color}cc` } : undefined}
                        title={tp.teamName}
                      >
                        {tp.photoUrl ? (
                          <img src={tp.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          tp.teamName.charAt(0).toUpperCase()
                        )}
                      </div>
                    ))}
                    {teamsHere.length > 4 && (
                      <div className="w-6 h-6 rounded-full border-2 border-slate-600 bg-slate-800 text-white flex items-center justify-center text-[8px] font-bold">
                        +{teamsHere.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        <button
          onClick={() => handleZoom(0.2)}
          className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-600 text-white flex items-center justify-center hover:bg-slate-700 transition-colors shadow-lg"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => handleZoom(-0.2)}
          className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-600 text-white flex items-center justify-center hover:bg-slate-700 transition-colors shadow-lg"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={resetView}
          className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-600 text-white flex items-center justify-center hover:bg-slate-700 transition-colors shadow-lg"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Map Style Label */}
      <div className="absolute top-4 left-4 z-20">
        <div className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-600 text-[10px] font-bold text-slate-300 uppercase tracking-wider shadow-lg">
          {MAP_REGIONS[mapStyle]?.label || 'World'} Map
        </div>
      </div>

      {/* Team Count Indicator */}
      {showTeamPositions && teams.length > 0 && (
        <div className="absolute top-4 right-4 z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-600 shadow-lg">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white">{teams.length} Teams</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldMapCanvas;
