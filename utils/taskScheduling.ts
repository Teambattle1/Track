import { TaskSchedule, TimerConfig } from '../types';

/**
 * Determines if a task should be visible based on its schedule settings
 * @param schedule - The task's schedule configuration
 * @param teamStartTime - When the team started the game (unix timestamp)
 * @param timerConfig - Game timer configuration (for end time calculations)
 * @returns true if task should be visible, false if hidden by schedule
 */
export const isTaskVisibleBySchedule = (
  schedule: TaskSchedule | undefined,
  teamStartTime: number | undefined,
  timerConfig: TimerConfig | undefined
): boolean => {
  // If scheduling is not enabled or not configured, always show the task
  if (!schedule || !schedule.enabled) {
    return true;
  }

  const now = Date.now();

  switch (schedule.scheduleType) {
    case 'datetime': {
      // Show task only within the datetime range
      const showAt = schedule.showAtDateTime;
      const hideAt = schedule.hideAtDateTime;

      // If showAt is set and we haven't reached it yet, hide task
      if (showAt && now < showAt) {
        return false;
      }

      // If hideAt is set and we've passed it, hide task
      if (hideAt && now > hideAt) {
        return false;
      }

      // Task is within the visible datetime window
      return true;
    }

    case 'game_start_offset': {
      // Show task X minutes after the game/team started
      if (!teamStartTime) {
        // No team start time available - hide task until team starts
        return false;
      }

      const showAfterMinutes = schedule.showAfterMinutes || 0;
      const showAfterMs = showAfterMinutes * 60 * 1000;
      const elapsedTime = now - teamStartTime;

      // Task becomes visible after the specified offset
      return elapsedTime >= showAfterMs;
    }

    case 'game_end_offset': {
      // Show task X minutes before the game ends
      if (!timerConfig || timerConfig.mode === 'none') {
        // No timer configured - task is always visible
        return true;
      }

      // Calculate game end time based on timer mode
      let gameEndTime: number | null = null;

      if (timerConfig.mode === 'scheduled_end' && timerConfig.endTime) {
        // Parse scheduled end time (format: HH:mm)
        const [hours, minutes] = timerConfig.endTime.split(':').map(Number);
        const endDate = new Date();
        endDate.setHours(hours, minutes, 0, 0);
        gameEndTime = endDate.getTime();
      } else if (timerConfig.mode === 'countdown' && timerConfig.durationMinutes && teamStartTime) {
        // Calculate end time from countdown
        gameEndTime = teamStartTime + (timerConfig.durationMinutes * 60 * 1000);
      }

      if (!gameEndTime) {
        // Can't determine end time - show task
        return true;
      }

      const showBeforeEndMinutes = schedule.showBeforeEndMinutes || 0;
      const showBeforeEndMs = showBeforeEndMinutes * 60 * 1000;
      const timeUntilEnd = gameEndTime - now;

      // Task becomes visible when we're within X minutes of the end
      return timeUntilEnd <= showBeforeEndMs && timeUntilEnd > 0;
    }

    default:
      // Unknown schedule type - show task by default
      return true;
  }
};

/**
 * Filters an array of tasks to only include those that should be visible
 * based on their schedule settings
 */
export const filterTasksBySchedule = <T extends { schedule?: TaskSchedule }>(
  tasks: T[],
  teamStartTime: number | undefined,
  timerConfig: TimerConfig | undefined
): T[] => {
  return tasks.filter(task => 
    isTaskVisibleBySchedule(task.schedule, teamStartTime, timerConfig)
  );
};
