/**
 * Utility to fix duplicate AI task IDs in the database
 * This migrates old AI tasks with format ai-{timestamp}-{index}
 * to new format with unique random suffixes
 */

import * as db from '../services/db';
import { Game } from '../types';
import { regenerateTaskId, isOldAiTaskId } from './taskKeyUtils';

interface MigrationResult {
  gamesScanned: number;
  gamesUpdated: number;
  tasksFixed: number;
  tasksMigrated: Array<{ oldId: string; newId: string; gameId: string; taskTitle: string }>;
}

/**
 * Scan all games and fix duplicate AI task IDs
 */
export const fixDuplicateAiTaskIds = async (): Promise<MigrationResult> => {
  console.log('[Migration] 🔧 Starting AI task ID migration...');

  const result: MigrationResult = {
    gamesScanned: 0,
    gamesUpdated: 0,
    tasksFixed: 0,
    tasksMigrated: []
  };

  try {
    // Fetch all games
    const games = await db.fetchGames();
    result.gamesScanned = games.length;

    console.log(`[Migration] Found ${games.length} games to scan`);

    for (const game of games) {
      let gameNeedsUpdate = false;
      const idMapping: Record<string, string> = {}; // oldId -> newId

      // Find all tasks with old AI IDs
      const updatedPoints = game.points.map(point => {
        // Check if this is an old AI task ID that needs fixing
        if (point.id.startsWith('ai-') && isOldAiTaskId(point.id)) {
          const newId = regenerateTaskId(point.id);
          idMapping[point.id] = newId;
          gameNeedsUpdate = true;
          result.tasksFixed++;

          result.tasksMigrated.push({
            oldId: point.id,
            newId: newId,
            gameId: game.id,
            taskTitle: point.title
          });

          console.log(`[Migration] 🔄 Migrating task: "${point.title}"`, {
            oldId: point.id,
            newId: newId
          });

          return {
            ...point,
            id: newId
          };
        }

        return point;
      });

      // If game has tasks that were migrated, update it
      if (gameNeedsUpdate) {
        result.gamesUpdated++;

        const updatedGame: Game = {
          ...game,
          points: updatedPoints
        };

        await db.saveGame(updatedGame);
        console.log(`[Migration] ✅ Updated game: "${game.name}" (${result.tasksFixed} tasks fixed)`);
      }
    }

    console.log('[Migration] 🎉 Migration complete:', {
      gamesScanned: result.gamesScanned,
      gamesUpdated: result.gamesUpdated,
      tasksFixed: result.tasksFixed
    });

    return result;
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    throw error;
  }
};

/**
 * Preview what the migration would do without making changes
 */
export const previewAiTaskIdMigration = async (): Promise<{
  gamesAffected: number;
  tasksToFix: number;
  preview: Array<{ gameId: string; gameName: string; tasksWithOldIds: number }>;
}> => {
  console.log('[Migration Preview] 🔍 Scanning for old AI task IDs...');

  let gamesAffected = 0;
  let tasksToFix = 0;
  const preview: Array<{ gameId: string; gameName: string; tasksWithOldIds: number }> = [];

  try {
    const games = await db.fetchGames();

    for (const game of games) {
      const oldAiTasks = game.points.filter(p => 
        p.id.startsWith('ai-') && isOldAiTaskId(p.id)
      );

      if (oldAiTasks.length > 0) {
        gamesAffected++;
        tasksToFix += oldAiTasks.length;
        preview.push({
          gameId: game.id,
          gameName: game.name,
          tasksWithOldIds: oldAiTasks.length
        });
      }
    }

    console.log('[Migration Preview] Results:', {
      totalGames: games.length,
      gamesAffected,
      tasksToFix,
      preview
    });

    return { gamesAffected, tasksToFix, preview };
  } catch (error) {
    console.error('[Migration Preview] Error:', error);
    throw error;
  }
};
