import React from 'react';
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import { TeamHistory } from '../types/teamHistory';

interface TeamHistoryOverlayProps {
  teams: TeamHistory[];
  visible: boolean;
  gameStartTime?: number; // Timestamp when game/team started
}

/**
 * TeamHistoryOverlay - Renders historical team movements and task attempts
 * 
 * Visual Components:
 * - Polylines for team paths (colored per team)
 * - CircleMarkers for task attempts (traffic light colors)
 */
const TeamHistoryOverlay: React.FC<TeamHistoryOverlayProps> = ({ teams, visible, gameStartTime }) => {
  if (!visible || !teams || teams.length === 0) {
    return null;
  }

  const getTaskMarkerColor = (status: 'CORRECT' | 'WRONG' | 'SUBMITTED'): string => {
    switch (status) {
      case 'CORRECT':
        return '#22c55e'; // Green
      case 'WRONG':
        return '#ef4444'; // Red
      case 'SUBMITTED':
        return '#eab308'; // Yellow
      default:
        return '#6b7280'; // Gray fallback
    }
  };

  const getStatusLabel = (status: 'CORRECT' | 'WRONG' | 'SUBMITTED'): string => {
    switch (status) {
      case 'CORRECT':
        return '✓ CORRECT';
      case 'WRONG':
        return '✗ WRONG';
      case 'SUBMITTED':
        return '○ SUBMITTED';
      default:
        return 'UNKNOWN';
    }
  };

  // Format time as MM:SS from game start
  const formatTimeFromStart = (timestamp: number): string => {
    if (!gameStartTime) {
      return new Date(timestamp).toLocaleTimeString();
    }

    const elapsedMs = timestamp - gameStartTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <>
      {teams.map((team) => {
        // Convert path to Leaflet format
        const pathCoordinates = team.path.map((point) => [point.lat, point.lng] as [number, number]);

        return (
          <React.Fragment key={team.teamId}>
            {/* Team Path Polyline */}
            {pathCoordinates.length > 1 && (
              <Polyline
                positions={pathCoordinates}
                pathOptions={{
                  color: team.color,
                  weight: 4,
                  opacity: 0.7,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              >
                <Tooltip permanent={false} direction="top">
                  <div className="text-xs font-bold">
                    {team.teamName}
                    <div className="text-[10px] text-gray-500">
                      {team.path.length} positions
                    </div>
                  </div>
                </Tooltip>
              </Polyline>
            )}

            {/* Task Attempt Markers */}
            {team.tasks.map((task) => (
              <CircleMarker
                key={`${team.teamId}-${task.id}`}
                center={[task.coordinate.lat, task.coordinate.lng]}
                radius={8}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: getTaskMarkerColor(task.status),
                  fillOpacity: 0.9,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="text-xs">
                    <div className="font-black uppercase">{team.teamName}</div>
                    <div className="font-bold" style={{ color: getTaskMarkerColor(task.status) }}>
                      {getStatusLabel(task.status)}
                    </div>
                    {task.taskTitle && (
                      <div className="text-[10px] text-gray-600 mt-1">{task.taskTitle}</div>
                    )}
                    <div className="text-[9px] text-gray-500 mt-1">
                      Time: {formatTimeFromStart(task.timestamp)}
                    </div>
                    {gameStartTime && (
                      <div className="text-[8px] text-gray-400">
                        {new Date(task.timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default TeamHistoryOverlay;
