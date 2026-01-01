/**
 * Team History Demo Service
 * Generates sample team movement and task attempt data for testing
 */

import { TeamHistory, TaskAttempt } from '../types/teamHistory';
import { Coordinate } from '../types';

/**
 * Generates a random coordinate offset from a center point
 */
const randomOffset = (center: Coordinate, maxOffsetKm: number): Coordinate => {
  // Rough conversion: 1 degree ≈ 111 km at equator
  const maxOffsetDeg = maxOffsetKm / 111;
  return {
    lat: center.lat + (Math.random() - 0.5) * maxOffsetDeg,
    lng: center.lng + (Math.random() - 0.5) * maxOffsetDeg,
  };
};

/**
 * Generates a realistic path between two points
 */
const generatePath = (
  start: Coordinate,
  end: Coordinate,
  numPoints: number,
  startTime: number,
  duration: number
): Array<{ lat: number; lng: number; timestamp: number }> => {
  const path = [];
  const timeStep = duration / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const ratio = i / (numPoints - 1);
    // Add some randomness to make path more realistic
    const noise = (Math.random() - 0.5) * 0.0005;
    path.push({
      lat: start.lat + (end.lat - start.lat) * ratio + noise,
      lng: start.lng + (end.lng - start.lng) * ratio + noise,
      timestamp: startTime + i * timeStep,
    });
  }

  return path;
};

/**
 * Generates sample team history data for demonstration
 */
export const generateDemoTeamHistory = (
  gameCenter: Coordinate = { lat: 55.6761, lng: 12.5683 }, // Default: Copenhagen
  numTeams: number = 3
): TeamHistory[] => {
  const teams: TeamHistory[] = [];
  const teamNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  const teamColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
  
  const now = Date.now();
  const gameStartTime = now - 3600000; // 1 hour ago

  for (let i = 0; i < Math.min(numTeams, teamNames.length); i++) {
    const teamId = `demo-team-${i}`;
    const teamName = teamNames[i];
    const teamColor = teamColors[i];

    // Generate starting point
    const startPoint = randomOffset(gameCenter, 0.5);
    
    // Generate 5-8 task attempts
    const numTasks = 5 + Math.floor(Math.random() * 4);
    const tasks: TaskAttempt[] = [];
    const taskPath: Array<{ lat: number; lng: number; timestamp: number }> = [];

    let currentPoint = startPoint;
    let currentTime = gameStartTime;

    // Add starting position
    taskPath.push({ ...currentPoint, timestamp: currentTime });

    for (let j = 0; j < numTasks; j++) {
      // Generate next task location
      const nextPoint = randomOffset(gameCenter, 0.8);
      const travelTime = 300000 + Math.random() * 600000; // 5-15 minutes
      
      // Generate path to next task
      const pathSegment = generatePath(currentPoint, nextPoint, 10, currentTime, travelTime);
      taskPath.push(...pathSegment);
      
      currentTime += travelTime;
      currentPoint = nextPoint;

      // Determine task status (randomized)
      const rand = Math.random();
      let status: 'CORRECT' | 'WRONG' | 'SUBMITTED';
      if (rand < 0.6) status = 'CORRECT';
      else if (rand < 0.8) status = 'WRONG';
      else status = 'SUBMITTED';

      tasks.push({
        id: `task-${teamId}-${j}`,
        coordinate: { lat: nextPoint.lat, lng: nextPoint.lng },
        status,
        timestamp: currentTime,
        taskTitle: `Task ${j + 1}`,
      });
    }

    teams.push({
      teamId,
      teamName,
      color: teamColor,
      path: taskPath,
      tasks,
    });
  }

  return teams;
};
