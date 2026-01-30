/**
 * Day calculation utilities for Jorden 80 Dage
 * Handles time/day tracking for the 80 Days game mode
 */

import { Jorden80Config, Jorden80TeamProgress, Jorden80CityProgress, Jorden80TaskType } from '../../types';

// Default configuration
export const DEFAULT_JORDEN80_CONFIG: Jorden80Config = {
  startCity: 'london',
  goalCity: 'istanbul',
  daysLimit: 80,
  tasksPerCity: 3,
  dayPenaltyOnWrong: 1,
  firstArrivalBonus: 200,
  perfectCityBonus: 50,
  timeBonusThreshold: 20,
  timeBonusPoints: 100
};

/**
 * Calculate days spent on a task
 * @param taskType - Type of task (by, land, creative)
 * @param isCorrect - Whether the answer was correct
 * @param config - Game configuration
 * @returns Number of days to add
 */
export function calculateDaysForTask(
  taskType: Jorden80TaskType,
  isCorrect: boolean,
  config: Jorden80Config = DEFAULT_JORDEN80_CONFIG
): number {
  // Creative tasks always take 1 day (instructor-scored)
  if (taskType === 'creative') {
    return 1;
  }

  // Regular tasks: 1 day if correct, 1 + penalty if incorrect
  return isCorrect ? 1 : 1 + config.dayPenaltyOnWrong;
}

/**
 * Calculate days for traveling between cities
 * Currently fixed at 1 day per journey
 */
export function calculateTravelDays(): number {
  return 1;
}

/**
 * Calculate total days used so far
 */
export function calculateTotalDays(progress: Jorden80TeamProgress): number {
  return progress.daysUsed;
}

/**
 * Check if team has exceeded the day limit
 */
export function hasExceededDayLimit(
  progress: Jorden80TeamProgress,
  config: Jorden80Config = DEFAULT_JORDEN80_CONFIG
): boolean {
  return progress.daysUsed > config.daysLimit;
}

/**
 * Calculate remaining days
 */
export function getRemainingDays(
  progress: Jorden80TeamProgress,
  config: Jorden80Config = DEFAULT_JORDEN80_CONFIG
): number {
  return Math.max(0, config.daysLimit - progress.daysUsed);
}

/**
 * Count correct answers in a city
 */
export function countCorrectAnswersInCity(cityProgress: Jorden80CityProgress): number {
  let count = 0;
  if (cityProgress.byTask.completed && cityProgress.byTask.correct) count++;
  if (cityProgress.landTask.completed && cityProgress.landTask.correct) count++;
  // Creative tasks: count as correct if approved with score > 0
  if (cityProgress.creativeTask.completed && cityProgress.creativeTask.approved && cityProgress.creativeTask.score > 0) {
    count++;
  }
  return count;
}

/**
 * Check if all tasks in a city are completed
 */
export function isCityCompleted(cityProgress: Jorden80CityProgress): boolean {
  return (
    cityProgress.byTask.completed &&
    cityProgress.landTask.completed &&
    cityProgress.creativeTask.completed &&
    cityProgress.creativeTask.approved
  );
}

/**
 * Check if team got a perfect score in a city (all 3 correct)
 */
export function isPerfectCity(cityProgress: Jorden80CityProgress): boolean {
  return countCorrectAnswersInCity(cityProgress) === 3;
}

/**
 * Calculate points for a city completion
 */
export function calculateCityPoints(
  cityProgress: Jorden80CityProgress,
  config: Jorden80Config = DEFAULT_JORDEN80_CONFIG
): number {
  let points = 0;

  // Add points from individual tasks
  points += cityProgress.byTask.points;
  points += cityProgress.landTask.points;
  points += cityProgress.creativeTask.score;

  // Add perfect city bonus
  if (isPerfectCity(cityProgress)) {
    points += config.perfectCityBonus;
  }

  return points;
}

/**
 * Calculate final score with bonuses
 */
export function calculateFinalScore(
  progress: Jorden80TeamProgress,
  config: Jorden80Config = DEFAULT_JORDEN80_CONFIG,
  isFirstToFinish: boolean = false
): {
  baseScore: number;
  timeBonusApplied: boolean;
  timeBonus: number;
  firstArrivalBonus: number;
  totalScore: number;
  daysUsed: number;
} {
  // Sum up all city points
  let baseScore = 0;
  Object.values(progress.cityProgress).forEach(cityProg => {
    baseScore += calculateCityPoints(cityProg, config);
  });

  // Time bonus if finished under threshold
  const timeBonusApplied = progress.daysUsed <= config.timeBonusThreshold;
  const timeBonus = timeBonusApplied ? config.timeBonusPoints : 0;

  // First arrival bonus
  const firstArrivalBonus = isFirstToFinish ? config.firstArrivalBonus : 0;

  return {
    baseScore,
    timeBonusApplied,
    timeBonus,
    firstArrivalBonus,
    totalScore: baseScore + timeBonus + firstArrivalBonus,
    daysUsed: progress.daysUsed
  };
}

/**
 * Format days as a readable string
 */
export function formatDays(days: number): string {
  if (days === 1) return '1 dag';
  return `${days} dage`;
}

/**
 * Get progress percentage through the journey
 */
export function getJourneyProgress(progress: Jorden80TeamProgress, totalCities: number = 12): number {
  const visitedCount = progress.visitedCities.length;
  // Goal city counts as the final destination
  return Math.round((visitedCount / (totalCities - 1)) * 100);
}

/**
 * Create initial team progress
 */
export function createInitialProgress(
  teamId: string,
  config: Jorden80Config = DEFAULT_JORDEN80_CONFIG
): Jorden80TeamProgress {
  return {
    teamId,
    currentCity: config.startCity,
    visitedCities: [config.startCity],
    route: [config.startCity],
    daysUsed: 0,
    correctAnswers: 0,
    totalCorrectAnswers: 0,
    cityProgress: {
      [config.startCity]: createEmptyCityProgress()
    },
    hasFinished: false
  };
}

/**
 * Create empty city progress
 */
export function createEmptyCityProgress(): Jorden80CityProgress {
  return {
    byTask: { completed: false, correct: false, points: 0 },
    landTask: { completed: false, correct: false, points: 0 },
    creativeTask: { completed: false, score: 0, approved: false }
  };
}

/**
 * Check if team can leave the current city
 * (All tasks must be completed)
 */
export function canLeaveCity(cityProgress: Jorden80CityProgress | undefined): boolean {
  if (!cityProgress) return false;
  return isCityCompleted(cityProgress);
}
