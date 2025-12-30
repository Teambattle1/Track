/**
 * Game Change Log Utility
 * Handles tracking major changes in a game with defensive coding practices
 * Explicit handling of null, undefined, and empty states
 */

import { Game, GameChangeLogEntry } from '../types';

/**
 * Create a new game change log entry
 * @param action - Description of the action taken
 * @param userId - ID of the user who made the change (required)
 * @param userName - Name of the user (will default if not provided)
 * @param details - Optional additional details about the change
 * @returns GameChangeLogEntry object
 */
export const createGameLogEntry = (
  action: string | null | undefined,
  userId: string | null | undefined,
  userName: string | null | undefined = 'Unknown User',
  details?: Record<string, any>
): GameChangeLogEntry | null => {
  // Defensive checks: handle null/undefined/empty inputs
  if (!action || typeof action !== 'string') {
    console.warn('[gameLog] Invalid action provided:', action);
    return null;
  }

  if (!userId || typeof userId !== 'string') {
    console.warn('[gameLog] Invalid userId provided:', userId);
    return null;
  }

  // Trim and validate action string
  const trimmedAction = action.trim();
  if (trimmedAction.length === 0) {
    console.warn('[gameLog] Action string is empty after trimming');
    return null;
  }

  // Sanitize userName - default to 'Unknown User' if not provided or invalid
  const sanitizedUserName = !userName || typeof userName !== 'string' 
    ? 'Unknown User'
    : userName.trim().length > 0 
      ? userName.trim() 
      : 'Unknown User';

  // Create log entry with current timestamp
  const logEntry: GameChangeLogEntry = {
    timestamp: Date.now(),
    user: userId,
    action: trimmedAction
  };

  // Optionally include details if provided and valid
  if (details && typeof details === 'object' && Object.keys(details).length > 0) {
    // Store metadata as JSON string to avoid circular references
    try {
      (logEntry as any).metadata = JSON.stringify(details);
    } catch (e) {
      console.warn('[gameLog] Could not stringify metadata:', e);
      // Continue without metadata if serialization fails
    }
  }

  return logEntry;
};

/**
 * Add a log entry to a game's change log
 * @param game - The game object
 * @param entry - The log entry to add
 * @returns Updated game object with new log entry
 */
export const addLogEntryToGame = (
  game: Game | null | undefined,
  entry: GameChangeLogEntry | null | undefined
): Game | null => {
  // Defensive check: ensure game is valid
  if (!game || typeof game !== 'object') {
    console.warn('[gameLog] Invalid game object provided:', game);
    return null;
  }

  // Defensive check: ensure entry is valid
  if (!entry || typeof entry !== 'object') {
    console.warn('[gameLog] Invalid log entry provided:', entry);
    return game; // Return unchanged game if entry is invalid
  }

  // Ensure changeLog array exists
  const changeLog = Array.isArray(game.changeLog) ? [...game.changeLog] : [];

  // Add new entry
  changeLog.push(entry);

  // Limit history to prevent unbounded growth (keep last 1000 entries)
  const MAX_HISTORY = 1000;
  if (changeLog.length > MAX_HISTORY) {
    console.warn(`[gameLog] Change log exceeded ${MAX_HISTORY} entries, trimming oldest entries`);
    changeLog.splice(0, changeLog.length - MAX_HISTORY);
  }

  // Return updated game
  return {
    ...game,
    changeLog
  };
};

/**
 * Log a major game change with comprehensive details
 * Wraps createGameLogEntry and addLogEntryToGame
 * @param game - The game object
 * @param action - What changed
 * @param userId - Who made the change
 * @param userName - Readable user name
 * @param details - Optional change details (what was modified)
 * @returns Updated game with log entry, or null if operation failed
 */
export const logGameChange = (
  game: Game | null | undefined,
  action: string | null | undefined,
  userId: string | null | undefined,
  userName: string | null | undefined,
  details?: Record<string, any>
): Game | null => {
  // Validate game
  if (!game) {
    console.error('[gameLog] Cannot log change: game is null/undefined');
    return null;
  }

  // Create log entry
  const entry = createGameLogEntry(action, userId, userName, details);

  // If entry creation failed, log it and return unchanged game
  if (!entry) {
    console.error('[gameLog] Failed to create log entry for action:', action);
    return game;
  }

  // Add entry to game
  const updatedGame = addLogEntryToGame(game, entry);

  if (!updatedGame) {
    console.error('[gameLog] Failed to add log entry to game');
    return game;
  }

  return updatedGame;
};

/**
 * Get formatted log entries for display
 * @param game - The game object
 * @param limit - Maximum number of entries to return (default: all)
 * @returns Array of formatted log entries, or empty array if none found
 */
export const getFormattedLogs = (
  game: Game | null | undefined,
  limit?: number
): Array<{
  timestamp: number;
  date: string;
  time: string;
  user: string;
  action: string;
}> => {
  // Defensive check: ensure game exists
  if (!game || typeof game !== 'object') {
    return [];
  }

  // Get changelog, default to empty array
  const changeLog = Array.isArray(game.changeLog) ? game.changeLog : [];

  // If no changes, return empty array
  if (changeLog.length === 0) {
    return [];
  }

  // Map and format entries
  let entries = changeLog
    .filter((entry: any): entry is GameChangeLogEntry => {
      // Defensive filter: ensure entry is valid
      return entry !== null && 
             entry !== undefined && 
             typeof entry === 'object' &&
             typeof entry.timestamp === 'number' &&
             typeof entry.action === 'string';
    })
    .map((entry: GameChangeLogEntry) => {
      // Create Date object safely
      let dateObj: Date;
      try {
        dateObj = new Date(entry.timestamp);
        // Validate date
        if (isNaN(dateObj.getTime())) {
          dateObj = new Date();
        }
      } catch (e) {
        console.warn('[gameLog] Invalid timestamp:', entry.timestamp);
        dateObj = new Date();
      }

      // Format date and time
      const date = dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const time = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Safely get user string
      const user = entry.user && typeof entry.user === 'string' ? entry.user : 'Unknown User';

      // Safely get action string
      const action = entry.action && typeof entry.action === 'string' ? entry.action : 'Unknown action';

      return {
        timestamp: entry.timestamp,
        date,
        time,
        user,
        action
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

  // Apply limit if specified
  if (typeof limit === 'number' && limit > 0) {
    entries = entries.slice(0, limit);
  }

  return entries;
};

/**
 * Get statistics about game changes
 * @param game - The game object
 * @returns Object containing change statistics
 */
export const getGameLogStats = (game: Game | null | undefined) => {
  // Defensive check
  if (!game || typeof game !== 'object') {
    return {
      totalChanges: 0,
      uniqueUsers: 0,
      latestChange: null,
      earliestChange: null
    };
  }

  const changeLog = Array.isArray(game.changeLog) ? game.changeLog : [];

  if (changeLog.length === 0) {
    return {
      totalChanges: 0,
      uniqueUsers: 0,
      latestChange: null,
      earliestChange: null
    };
  }

  // Filter valid entries
  const validEntries = changeLog.filter((entry: any): entry is GameChangeLogEntry => {
    return entry !== null && 
           entry !== undefined && 
           typeof entry === 'object' &&
           typeof entry.timestamp === 'number';
  });

  // Get unique users safely
  const users = new Set<string>();
  validEntries.forEach(entry => {
    if (entry.user && typeof entry.user === 'string') {
      users.add(entry.user);
    }
  });

  // Get latest and earliest changes
  if (validEntries.length === 0) {
    return {
      totalChanges: 0,
      uniqueUsers: users.size,
      latestChange: null,
      earliestChange: null
    };
  }

  const sorted = [...validEntries].sort((a, b) => b.timestamp - a.timestamp);
  
  return {
    totalChanges: validEntries.length,
    uniqueUsers: users.size,
    latestChange: new Date(sorted[0]?.timestamp || 0),
    earliestChange: new Date(sorted[sorted.length - 1]?.timestamp || 0)
  };
};

/**
 * Clear game change log (administrative action)
 * @param game - The game object
 * @param reason - Reason for clearing (optional)
 * @returns Updated game with empty change log
 */
export const clearGameLog = (
  game: Game | null | undefined,
  reason?: string
): Game | null => {
  if (!game) {
    return null;
  }

  console.warn(
    '[gameLog] Game log cleared',
    reason ? `Reason: ${reason}` : ''
  );

  return {
    ...game,
    changeLog: []
  };
};

/**
 * Export game log as JSON
 * @param game - The game object
 * @returns JSON string or null if invalid
 */
export const exportGameLog = (game: Game | null | undefined): string | null => {
  if (!game || !Array.isArray(game.changeLog)) {
    return null;
  }

  try {
    const exported = {
      gameId: game.id || 'unknown',
      gameName: game.name || 'Unknown Game',
      exportDate: new Date().toISOString(),
      totalEntries: game.changeLog.length,
      entries: game.changeLog
    };

    return JSON.stringify(exported, null, 2);
  } catch (e) {
    console.error('[gameLog] Failed to export log:', e);
    return null;
  }
};
