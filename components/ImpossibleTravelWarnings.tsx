import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Navigation } from 'lucide-react';
import { fetchImpossibleTravelWarnings } from '../services/teamLocationTracking';
import { Coordinate } from '../types';

interface ImpossibleTravelWarning {
  teamId: string;
  teamName: string;
  location: Coordinate;
  timestamp: Date;
  speed: number; // meters per second
}

interface ImpossibleTravelWarningsProps {
  gameId: string;
  onJumpToLocation?: (location: Coordinate) => void;
}

const ImpossibleTravelWarnings: React.FC<ImpossibleTravelWarningsProps> = ({
  gameId,
  onJumpToLocation,
}) => {
  const [warnings, setWarnings] = useState<ImpossibleTravelWarning[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWarnings();
    
    // Refresh warnings every 30 seconds
    const interval = setInterval(loadWarnings, 30000);
    return () => clearInterval(interval);
  }, [gameId]);

  const loadWarnings = async () => {
    setLoading(true);
    try {
      const data = await fetchImpossibleTravelWarnings(gameId);
      setWarnings(data);
    } catch (error) {
      console.error('Error loading impossible travel warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (warnings.length === 0) return null;

  const formatSpeed = (speedMs: number) => {
    const kmh = (speedMs * 3.6).toFixed(1);
    return `${kmh} km/h`;
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="absolute top-20 right-4 z-[1300] pointer-events-auto max-w-sm">
      <div className="bg-red-900/95 border-2 border-red-600 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400 animate-pulse" />
            <div className="text-left">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Impossible Travel
              </h3>
              <p className="text-[10px] text-red-200 font-bold">
                {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
              </p>
            </div>
          </div>
          <div className="text-white">
            {isExpanded ? '▼' : '▶'}
          </div>
        </button>

        {/* Warnings List */}
        {isExpanded && (
          <div className="max-h-[400px] overflow-y-auto">
            {warnings.map((warning, index) => (
              <div
                key={`${warning.teamId}-${warning.timestamp.getTime()}`}
                className={`px-4 py-3 ${
                  index !== warnings.length - 1 ? 'border-b border-red-700' : ''
                } hover:bg-red-800/30 transition-colors`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-white">{warning.teamName}</h4>
                      <span className="px-2 py-0.5 bg-red-700 text-white text-[9px] font-black uppercase rounded-full">
                        {formatSpeed(warning.speed)}
                      </span>
                    </div>
                    <p className="text-[10px] text-red-200">
                      Exceeded walking speed limit
                    </p>
                    <p className="text-[9px] text-red-300 mt-1">
                      {formatTimestamp(warning.timestamp)}
                    </p>
                  </div>

                  {onJumpToLocation && (
                    <button
                      onClick={() => onJumpToLocation(warning.location)}
                      className="p-2 hover:bg-red-700 rounded-lg transition-colors"
                      title="Jump to location"
                    >
                      <Navigation className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Refresh Button */}
        {isExpanded && (
          <div className="px-4 py-2 border-t border-red-700 bg-red-950/50">
            <button
              onClick={loadWarnings}
              disabled={loading}
              className="w-full py-2 px-3 bg-red-700 hover:bg-red-600 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading...
                </>
              ) : (
                'Refresh Warnings'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpossibleTravelWarnings;
