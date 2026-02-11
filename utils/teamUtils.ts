/**
 * Team utility functions for short codes and countdown timers.
 */

/**
 * Generate a unique team short code like "A123" — one letter + three digits.
 * Ensures uniqueness within the given set of existing codes.
 */
export const generateTeamShortCode = (existingCodes: string[]): string => {
  const existing = new Set(existingCodes.map(c => c.toUpperCase()));
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // skip I and O to avoid confusion with 1 and 0

  for (let attempt = 0; attempt < 500; attempt++) {
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const digits = String(Math.floor(Math.random() * 900) + 100); // 100-999
    const code = `${letter}${digits}`;
    if (!existing.has(code)) return code;
  }

  // Fallback: use timestamp-based
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return ts;
};

/**
 * Parse a game start time string into a Date object.
 * Supports ISO strings ("2026-02-11T14:30:00Z") and HH:mm ("14:30") format.
 * For HH:mm, assumes today's date.
 */
export const parseGameStartTime = (startTime: string): Date | null => {
  if (!startTime) return null;

  // HH:mm format
  const timeMatch = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const now = new Date();
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      now.setHours(hours, minutes, 0, 0);
      return now;
    }
    return null;
  }

  // ISO string or other Date-parseable format
  const date = new Date(startTime);
  if (isNaN(date.getTime())) return null;
  return date;
};

export type CountdownState = 'waiting_for_lobby' | 'lobby_open' | 'game_started' | 'no_timer';

export interface CountdownInfo {
  state: CountdownState;
  label: string;
  remainingMs: number; // ms until next state change (0 if no_timer or game_started)
}

/**
 * Get the current countdown state based on game timer configuration.
 *
 * @param startTime - Game start time string (ISO or HH:mm)
 * @param lobbyOpenTime - Optional lobby open time string. Defaults to startTime - 15 min.
 * @returns CountdownInfo with state, label, and remaining time.
 */
export const getCountdownState = (
  startTime?: string,
  lobbyOpenTime?: string
): CountdownInfo => {
  if (!startTime) {
    return { state: 'no_timer', label: 'NO START TIME SET', remainingMs: 0 };
  }

  const start = parseGameStartTime(startTime);
  if (!start) {
    return { state: 'no_timer', label: 'INVALID START TIME', remainingMs: 0 };
  }

  const now = Date.now();
  const startMs = start.getTime();

  // Determine lobby open time (default: 15 min before start)
  let lobbyMs = startMs - 15 * 60 * 1000;
  if (lobbyOpenTime) {
    const lobbyDate = parseGameStartTime(lobbyOpenTime);
    if (lobbyDate) lobbyMs = lobbyDate.getTime();
  }

  if (now >= startMs) {
    return { state: 'game_started', label: 'GAME IN PROGRESS', remainingMs: 0 };
  }

  if (now >= lobbyMs) {
    return { state: 'lobby_open', label: 'GAME STARTS IN', remainingMs: startMs - now };
  }

  return { state: 'waiting_for_lobby', label: 'LOBBY OPENS IN', remainingMs: lobbyMs - now };
};

/**
 * Format milliseconds into HH:MM:SS display string.
 */
export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(v => String(v).padStart(2, '0'))
    .join(':');
};
