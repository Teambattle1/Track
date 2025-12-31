import { Game, GamePoint, Team } from '../types';

/**
 * Check if a task is already captured
 */
export const isTaskCaptured = (game: Game, taskId: string): boolean => {
  return !!game.capturedTasks?.[taskId];
};

/**
 * Check if a task is captured by a specific team
 */
export const isTaskCapturedByTeam = (game: Game, taskId: string, teamId: string): boolean => {
  return game.capturedTasks?.[taskId] === teamId;
};

/**
 * Get the team that captured a task
 */
export const getCaptureTeam = (game: Game, taskId: string): string | null => {
  return game.capturedTasks?.[taskId] || null;
};

/**
 * Capture a task for a team
 */
export const captureTask = (
  game: Game,
  taskId: string,
  teamId: string
): Game => {
  const updated = { ...game };
  
  // Mark task as captured by this team
  updated.capturedTasks = {
    ...(game.capturedTasks || {}),
    [taskId]: teamId,
  };
  
  // Increment team's capture count
  const currentCount = game.teamCaptureCount?.[teamId] || 0;
  updated.teamCaptureCount = {
    ...(game.teamCaptureCount || {}),
    [teamId]: currentCount + 1,
  };
  
  return updated;
};

/**
 * Get visible points for a team in elimination mode
 * A team sees:
 * 1. All uncaptured tasks
 * 2. Tasks captured by their own team
 * Hidden:
 * 1. Tasks captured by other teams
 */
export const getVisiblePointsForTeam = (game: Game, teamId: string): GamePoint[] => {
  return game.points.filter(point => {
    // If not captured, it's visible
    if (!isTaskCaptured(game, point.id)) return true;
    
    // If captured by this team, it's visible
    if (isTaskCapturedByTeam(game, point.id, teamId)) return true;
    
    // Otherwise, it's hidden
    return false;
  });
};

/**
 * Record a failed attempt and start cooldown
 */
export const recordFailedAttempt = (
  game: Game,
  taskId: string,
  teamId: string
): Game => {
  const now = Date.now();
  const cooldownUntil = now + (2 * 60 * 1000); // 2 minutes from now
  
  const updated = { ...game };
  updated.failedAttempts = [
    ...(game.failedAttempts || []),
    {
      taskId,
      teamId,
      timestamp: now,
      cooldownUntil,
    },
  ];
  
  return updated;
};

/**
 * Check if a task is on cooldown for a team
 */
export const isTaskOnCooldown = (game: Game, taskId: string, teamId: string): boolean => {
  const now = Date.now();
  const attempts = game.failedAttempts || [];
  
  const recentFailure = attempts.find(
    attempt =>
      attempt.taskId === taskId &&
      attempt.teamId === teamId &&
      attempt.cooldownUntil > now
  );
  
  return !!recentFailure;
};

/**
 * Get remaining cooldown time in seconds
 */
export const getRemainingCooldownSeconds = (
  game: Game,
  taskId: string,
  teamId: string
): number => {
  const now = Date.now();
  const attempts = game.failedAttempts || [];
  
  const recentFailure = attempts.find(
    attempt =>
      attempt.taskId === taskId &&
      attempt.teamId === teamId &&
      attempt.cooldownUntil > now
  );
  
  if (!recentFailure) return 0;
  
  return Math.ceil((recentFailure.cooldownUntil - now) / 1000);
};

/**
 * Get team's captured task count
 */
export const getTeamCaptureCount = (game: Game, teamId: string): number => {
  return game.teamCaptureCount?.[teamId] || 0;
};

/**
 * Get all captured tasks for a team
 */
export const getTeamCapturedTasks = (game: Game, teamId: string): GamePoint[] => {
  if (!game.capturedTasks) return [];
  
  const capturedTaskIds = Object.entries(game.capturedTasks)
    .filter(([_, capturingTeamId]) => capturingTeamId === teamId)
    .map(([taskId]) => taskId);
  
  return game.points.filter(point => capturedTaskIds.includes(point.id));
};

/**
 * Get leaderboard standings
 */
export const getEliminationLeaderboard = (game: Game, teams: Team[]) => {
  return teams
    .map(team => ({
      team,
      captureCount: getTeamCaptureCount(game, team.id),
      capturedTasks: getTeamCapturedTasks(game, team.id),
    }))
    .sort((a, b) => b.captureCount - a.captureCount);
};

/**
 * Place a bomb at a location
 */
export const placeBomb = (
  game: Game,
  teamId: string,
  location: { lat: number; lng: number },
  duration: 30 | 60 | 120
): Game => {
  const now = Date.now();
  const bombId = `bomb-${teamId}-${now}`;
  
  const updated = { ...game };
  updated.bombs = [
    ...(game.bombs || []),
    {
      id: bombId,
      teamId,
      location,
      duration,
      createdAt: now,
      detonatesAt: now + duration * 1000,
    },
  ];
  
  return updated;
};

/**
 * Check if a location is in a bomb danger zone
 */
export const isInDangerZone = (
  location: { lat: number; lng: number },
  bombLocation: { lat: number; lng: number },
  radiusMeters: number = 30
): boolean => {
  // Simple distance calculation (not perfectly accurate for large distances)
  const lat1 = location.lat;
  const lon1 = location.lng;
  const lat2 = bombLocation.lat;
  const lon2 = bombLocation.lng;
  
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance <= radiusMeters;
};

/**
 * Get active bombs (not yet detonated)
 */
export const getActiveBombs = (game: Game) => {
  const now = Date.now();
  return (game.bombs || []).filter(bomb => bomb.detonatesAt > now);
};

/**
 * Check if team is in any active danger zone
 */
export const isTeamInDangerZone = (
  game: Game,
  teamLocation: { lat: number; lng: number }
): boolean => {
  const activeBombs = getActiveBombs(game);
  return activeBombs.some(bomb => isInDangerZone(teamLocation, bomb.location, 30));
};

/**
 * Clean up expired failed attempts
 */
export const cleanupExpiredCooldowns = (game: Game): Game => {
  const now = Date.now();
  const updated = { ...game };
  
  updated.failedAttempts = (game.failedAttempts || []).filter(
    attempt => attempt.cooldownUntil > now
  );
  
  return updated;
};

/**
 * Clean up detonated bombs
 */
export const cleanupDetonatedBombs = (game: Game): Game => {
  const now = Date.now();
  const updated = { ...game };
  
  updated.bombs = (game.bombs || []).filter(bomb => bomb.detonatesAt > now);
  
  return updated;
};

/**
 * Initialize elimination game state
 */
export const initializeEliminationGame = (game: Game, teams: Team[]): Game => {
  const updated = { ...game };
  
  // Initialize team colors
  const colors = ['#EF4444', '#F97316', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];
  updated.teamColors = {};
  teams.forEach((team, index) => {
    updated.teamColors![team.id] = colors[index % colors.length];
  });
  
  // Initialize captured tasks (empty at start)
  updated.capturedTasks = {};
  
  // Initialize team capture counts (all zero)
  updated.teamCaptureCount = {};
  teams.forEach(team => {
    updated.teamCaptureCount![team.id] = 0;
  });
  
  // Initialize failed attempts and bombs arrays
  updated.failedAttempts = [];
  updated.bombs = [];
  
  return updated;
};
