import { GamePoint, Coordinate, Team } from '../types';
import { haversineMeters } from './geo';

/**
 * Checks if a task should be visible based on proximity triggers
 * @param point - The game point to check
 * @param userLocation - Current user/team location
 * @param team - Team object (to check discovered tasks)
 * @param mode - Game mode ('PLAY', 'EDIT', 'INSTRUCTOR')
 * @returns true if the task should be visible
 */
export function isTaskVisibleByProximity(
  point: GamePoint,
  userLocation: Coordinate | null,
  team?: Team | null,
  mode?: string
): boolean {
  // In EDIT or INSTRUCTOR mode, show all tasks
  if (mode === 'EDIT' || mode === 'INSTRUCTOR') {
    return true;
  }

  // If proximity trigger is not enabled, task is always visible
  if (!point.proximityTriggerEnabled) {
    return true;
  }

  // If no valid location for the point, can't calculate proximity
  if (!point.location) {
    return true;
  }

  // If no user location, hide the task
  if (!userLocation) {
    return false;
  }

  // Default reveal radius is 100 meters
  const revealRadius = point.proximityRevealRadius || 100;

  // Calculate distance between user and task
  const distance = haversineMeters(userLocation, point.location);

  // Check if task is within reveal radius
  const isInRange = distance <= revealRadius;

  // If task stays visible after discovery, check if team has seen it
  if (point.proximityStaysVisible !== false) { // Default is true
    // Check if team has discovered this task (either unlocked or completed)
    const hasDiscovered = team?.completedPointIds?.includes(point.id) || point.isUnlocked || point.isCompleted;
    
    if (hasDiscovered) {
      return true; // Once discovered, always visible
    }
  }

  // Otherwise, visibility depends on current proximity
  return isInRange;
}

/**
 * Gets all tasks that should be visible based on proximity
 */
export function filterTasksByProximity(
  points: GamePoint[],
  userLocation: Coordinate | null,
  team?: Team | null,
  mode?: string
): GamePoint[] {
  return points.filter(point => isTaskVisibleByProximity(point, userLocation, team, mode));
}

/**
 * Checks if a task was just discovered (entered proximity range)
 * Returns true if the task should trigger a discovery event
 */
export function checkTaskDiscovery(
  point: GamePoint,
  userLocation: Coordinate | null,
  previousLocation: Coordinate | null,
  team?: Team | null
): boolean {
  // Only check if proximity trigger is enabled
  if (!point.proximityTriggerEnabled || !point.location || !userLocation) {
    return false;
  }

  // If already discovered by team, no new discovery
  const hasDiscovered = team?.completedPointIds?.includes(point.id) || point.isUnlocked || point.isCompleted;
  if (hasDiscovered) {
    return false;
  }

  const revealRadius = point.proximityRevealRadius || 100;
  const currentDistance = haversineMeters(userLocation, point.location);
  
  // Currently in range
  const isInRange = currentDistance <= revealRadius;
  
  if (!isInRange) {
    return false; // Not in range, no discovery
  }

  // If we have previous location, check if we just entered the range
  if (previousLocation) {
    const previousDistance = haversineMeters(previousLocation, point.location);
    const wasOutOfRange = previousDistance > revealRadius;
    
    // Just entered the range!
    if (wasOutOfRange && isInRange) {
      return true;
    }
  } else {
    // No previous location, and we're in range - count as discovery
    return true;
  }

  return false;
}
