/**
 * Database Migration: Enable GPS (radius) activation for all tasks
 * This script ensures all tasks in the database have GPS (radius) enabled
 */

import * as db from './db';
import { TaskTemplate } from '../types';

interface MigrationResult {
  total: number;
  updated: number;
  alreadyHasGps: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export const migrateAllTasksToGpsEnabled = async (): Promise<MigrationResult> => {
  const result: MigrationResult = {
    total: 0,
    updated: 0,
    alreadyHasGps: 0,
    failed: 0,
    errors: []
  };

  try {
    // Fetch all templates from the database
    console.log('[GPS Migration] Starting migration...');
    const allTemplates = await db.fetchLibrary();
    
    result.total = allTemplates.length;
    console.log(`[GPS Migration] Found ${result.total} tasks to process`);

    // Process each template
    for (const template of allTemplates) {
      try {
        const hasActivations = template.activationTypes && template.activationTypes.length > 0;
        const hasGps = hasActivations && template.activationTypes.includes('radius');

        if (hasGps) {
          // Already has GPS
          result.alreadyHasGps++;
          console.log(`[GPS Migration] Task "${template.title}" already has GPS enabled`);
        } else {
          // Update task with GPS activation, preserving existing activation methods
          const existingTypes = template.activationTypes || [];
          const updatedTemplate: TaskTemplate = {
            ...template,
            activationTypes: ['radius', ...existingTypes.filter(t => t !== 'radius')] // Add GPS while preserving QR, NFC, iBeacon, TAP
          };

          await db.saveTemplate(updatedTemplate);
          result.updated++;
          console.log(`[GPS Migration] ✓ Updated "${template.title}" with GPS activation (preserved existing: ${existingTypes.join(', ') || 'none'})`);
        }
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          id: template.id,
          error: errorMessage
        });
        console.error(`[GPS Migration] ✗ Failed to update task "${template.title}":`, errorMessage);
      }
    }

    console.log('[GPS Migration] Migration completed!');
    console.log(`[GPS Migration] Results:
      - Total tasks: ${result.total}
      - Updated: ${result.updated}
      - Already had GPS: ${result.alreadyHasGps}
      - Failed: ${result.failed}`);

    return result;
  } catch (error) {
    console.error('[GPS Migration] Fatal error during migration:', error);
    throw error;
  }
};

/**
 * Get all tasks from the library that don't have GPS enabled
 */
export const getAllTasksWithoutGps = async (): Promise<TaskTemplate[]> => {
  try {
    const allTemplates = await db.fetchLibrary();
    return allTemplates.filter(t => 
      !t.activationTypes || t.activationTypes.length === 0 || !t.activationTypes.includes('radius')
    );
  } catch (error) {
    console.error('[GPS Check] Error fetching tasks:', error);
    throw error;
  }
};

/**
 * Check if migration is needed
 */
export const checkMigrationNeeded = async (): Promise<boolean> => {
  try {
    const tasksWithoutGps = await getAllTasksWithoutGps();
    return tasksWithoutGps.length > 0;
  } catch (error) {
    console.error('[GPS Check] Error checking migration status:', error);
    return false;
  }
};
