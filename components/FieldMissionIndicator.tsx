import React, { useMemo } from 'react';
import { Coordinate } from '../types';
import { haversineMeters } from '../utils/geo';
import { Compass, Navigation, MapPin, CheckCircle } from 'lucide-react';

interface FieldMissionIndicatorProps {
  userLocation: Coordinate | null;
  targetLocation: Coordinate;
  radius: number;
  hint?: string;
  isActive: boolean;
  onArrived?: () => void;
}

/**
 * FieldMissionIndicator - GPS compass and distance indicator for field missions
 * Shows direction and distance to GPS target, with arrival detection
 */
const FieldMissionIndicator: React.FC<FieldMissionIndicatorProps> = ({
  userLocation,
  targetLocation,
  radius,
  hint,
  isActive,
  onArrived
}) => {
  // Calculate distance and bearing
  const { distance, bearing, isWithinRadius } = useMemo(() => {
    if (!userLocation) {
      return { distance: null, bearing: 0, isWithinRadius: false };
    }

    const dist = haversineMeters(userLocation, targetLocation);

    // Calculate bearing (direction to target)
    const lat1 = userLocation.lat * Math.PI / 180;
    const lat2 = targetLocation.lat * Math.PI / 180;
    const dLng = (targetLocation.lng - userLocation.lng) * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearingRad = Math.atan2(y, x);
    const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;

    return {
      distance: dist,
      bearing: bearingDeg,
      isWithinRadius: dist <= radius
    };
  }, [userLocation, targetLocation, radius]);

  // Trigger arrival callback
  React.useEffect(() => {
    if (isWithinRadius && isActive && onArrived) {
      onArrived();
    }
  }, [isWithinRadius, isActive, onArrived]);

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Get distance color based on proximity
  const getDistanceColor = (meters: number): string => {
    if (meters <= radius) return 'text-green-400';
    if (meters <= radius * 2) return 'text-yellow-400';
    if (meters <= radius * 5) return 'text-orange-400';
    return 'text-white';
  };

  // Get progress percentage (for visual indicator)
  const getProgressPercentage = (meters: number): number => {
    if (meters <= radius) return 100;
    const maxShowDistance = radius * 10; // Show progress from 10x radius
    if (meters >= maxShowDistance) return 0;
    return Math.round(100 - ((meters - radius) / (maxShowDistance - radius)) * 100);
  };

  if (!isActive) return null;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border-2 border-cyan-500/60 rounded-2xl p-4 shadow-xl animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-cyan-600/30 rounded-lg">
          <MapPin className="w-4 h-4 text-cyan-400" />
        </div>
        <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">Field Mission</span>
      </div>

      {/* Main Content */}
      {userLocation ? (
        <div className="space-y-3">
          {/* Compass and Distance */}
          <div className="flex items-center gap-4">
            {/* Compass */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              {isWithinRadius ? (
                <div className="w-14 h-14 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center animate-pulse">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              ) : (
                <div className="relative w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-600">
                  {/* Compass Rose */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Navigation
                      className="w-8 h-8 text-cyan-400 transition-transform duration-300"
                      style={{ transform: `rotate(${bearing}deg)` }}
                    />
                  </div>
                  {/* Cardinal Points */}
                  <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500">N</span>
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500">S</span>
                  <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-500">W</span>
                  <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-500">E</span>
                </div>
              )}
            </div>

            {/* Distance Display */}
            <div className="flex-1">
              {isWithinRadius ? (
                <div className="text-center">
                  <div className="text-2xl font-black text-green-400 uppercase">
                    You're Here!
                  </div>
                  <div className="text-xs text-green-300/80 mt-1">
                    Within {radius}m radius
                  </div>
                </div>
              ) : (
                <div>
                  <div className={`text-3xl font-black ${distance ? getDistanceColor(distance) : 'text-slate-400'}`}>
                    {distance ? formatDistance(distance) : '---'}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">
                    to destination
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {!isWithinRadius && distance && (
            <div className="space-y-1">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                  style={{ width: `${getProgressPercentage(distance)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 uppercase">
                <span>Far</span>
                <span>Target ({radius}m)</span>
              </div>
            </div>
          )}

          {/* Hint */}
          {hint && !isWithinRadius && (
            <div className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Hint
              </div>
              <div className="text-xs text-slate-300">
                {hint}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <Compass className="w-8 h-8 text-slate-500 mx-auto mb-2 animate-pulse" />
          <div className="text-xs text-slate-400">
            Waiting for GPS signal...
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldMissionIndicator;
