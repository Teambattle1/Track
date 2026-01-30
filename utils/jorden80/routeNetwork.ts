/**
 * Route network and destination algorithms for Jorden 80 Dage
 * Determines which cities teams can travel to based on their score
 */

import { CITIES_BY_ID, JORDEN80_CITIES } from './europeData';
import { Jorden80City } from '../../types';

/**
 * Get available next destinations based on current city and number of correct answers
 * @param currentCity - The city ID the team is currently in
 * @param correctAnswers - Number of correct answers (0-3) in the current city
 * @returns Array of city IDs that the team can travel to
 */
export function getNextDestinations(currentCity: string, correctAnswers: number): string[] {
  const city = CITIES_BY_ID.get(currentCity);
  if (!city || !city.connections) return [];

  // Clamp correct answers to 0-3 range
  const score = Math.max(0, Math.min(3, correctAnswers));

  // Return destinations for this score, or fall back to 0 if not defined
  return city.connections[score] || city.connections[0] || [];
}

/**
 * Check if a destination is reachable from the current city
 * @param currentCity - Current city ID
 * @param destinationCity - Target destination city ID
 * @param correctAnswers - Number of correct answers
 */
export function isDestinationReachable(
  currentCity: string,
  destinationCity: string,
  correctAnswers: number
): boolean {
  const destinations = getNextDestinations(currentCity, correctAnswers);
  return destinations.includes(destinationCity);
}

/**
 * Get the minimum correct answers needed to reach a specific destination
 * @param currentCity - Current city ID
 * @param destinationCity - Target destination city ID
 * @returns Minimum correct answers needed, or -1 if unreachable
 */
export function getMinimumScoreForDestination(
  currentCity: string,
  destinationCity: string
): number {
  const city = CITIES_BY_ID.get(currentCity);
  if (!city || !city.connections) return -1;

  for (let score = 0; score <= 3; score++) {
    const destinations = city.connections[score] || [];
    if (destinations.includes(destinationCity)) {
      return score;
    }
  }

  return -1;
}

/**
 * Get all possible routes from a city (for visualization)
 * @param currentCity - Current city ID
 * @returns Map of score -> destinations
 */
export function getAllRoutesFromCity(currentCity: string): Record<number, string[]> {
  const city = CITIES_BY_ID.get(currentCity);
  if (!city || !city.connections) return {};
  return { ...city.connections };
}

/**
 * Get cities that can be visited from a given city
 * Returns unique set of all reachable cities regardless of score
 */
export function getAllReachableCities(currentCity: string): Jorden80City[] {
  const city = CITIES_BY_ID.get(currentCity);
  if (!city || !city.connections) return [];

  const reachableIds = new Set<string>();
  Object.values(city.connections).forEach(destinations => {
    destinations.forEach(id => reachableIds.add(id));
  });

  return Array.from(reachableIds)
    .map(id => CITIES_BY_ID.get(id))
    .filter((c): c is Jorden80City => c !== undefined);
}

/**
 * Calculate the shortest possible path from start to goal
 * Using BFS to find minimum number of cities
 */
export function findShortestPath(startCity: string, goalCity: string): string[] | null {
  if (startCity === goalCity) return [startCity];

  const queue: { city: string; path: string[] }[] = [{ city: startCity, path: [startCity] }];
  const visited = new Set<string>([startCity]);

  while (queue.length > 0) {
    const { city, path } = queue.shift()!;

    // Get all reachable cities (assuming best case - 3 correct answers)
    const reachable = getNextDestinations(city, 3);

    for (const nextCity of reachable) {
      if (nextCity === goalCity) {
        return [...path, nextCity];
      }

      if (!visited.has(nextCity)) {
        visited.add(nextCity);
        queue.push({ city: nextCity, path: [...path, nextCity] });
      }
    }
  }

  return null; // No path found
}

/**
 * Get the tier progression info
 * Returns which tier a city belongs to for route visualization
 */
export function getCityTier(cityId: string): number {
  const city = CITIES_BY_ID.get(cityId);
  return city?.tier ?? -1;
}

/**
 * Check if the team has reached the goal
 */
export function hasReachedGoal(currentCity: string, goalCity: string = 'istanbul'): boolean {
  return currentCity === goalCity;
}

/**
 * Get route quality description based on score
 */
export function getRouteQuality(correctAnswers: number): {
  label: string;
  description: string;
  stars: number;
} {
  switch (correctAnswers) {
    case 3:
      return {
        label: 'Excellent',
        description: 'Alle svar korrekte! Vælg mellem alle ruter.',
        stars: 3
      };
    case 2:
      return {
        label: 'Good',
        description: 'To korrekte svar. Gode muligheder.',
        stars: 2
      };
    case 1:
      return {
        label: 'Basic',
        description: 'Ét korrekt svar. Begrænsede muligheder.',
        stars: 1
      };
    default:
      return {
        label: 'Minimal',
        description: 'Ingen korrekte svar. Kun én rute mulig.',
        stars: 0
      };
  }
}
