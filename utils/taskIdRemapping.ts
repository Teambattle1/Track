import { GamePoint, TaskAction } from '../types';

/**
 * Remaps all targetId references in task logic using an ID mapping table.
 * 
 * CRITICAL: When importing playzones from templates to games, tasks get new IDs.
 * However, their logic.onOpen/onCorrect/onIncorrect arrays still reference the OLD template IDs.
 * This function updates all targetId references to point to the new game IDs.
 * 
 * @param tasks - Array of tasks with new IDs but old targetId references
 * @param idMap - Mapping of old template IDs to new game IDs
 * @returns Tasks with properly remapped targetId references
 */
export function remapTaskLogicTargets(
  tasks: GamePoint[],
  idMap: Map<string, string>
): GamePoint[] {
  console.log('[TaskIdRemapping] Starting ID remapping...', {
    taskCount: tasks.length,
    mappingSize: idMap.size,
    idMapEntries: Array.from(idMap.entries())
  });

  return tasks.map(task => {
    if (!task.logic) {
      return task; // No logic to remap
    }

    // Helper function to remap a single action array
    const remapActions = (actions: TaskAction[] | undefined): TaskAction[] | undefined => {
      if (!actions || actions.length === 0) return actions;

      return actions.map(action => {
        // If action has a targetId, remap it
        if (action.targetId) {
          const oldTargetId = action.targetId;
          const newTargetId = idMap.get(oldTargetId);

          if (newTargetId) {
            console.log(`[TaskIdRemapping] ✅ Remapped: "${task.title}" action "${oldTargetId}" → "${newTargetId}"`);
            return {
              ...action,
              targetId: newTargetId
            };
          } else {
            console.warn(`[TaskIdRemapping] ⚠️ NO MAPPING found for targetId "${oldTargetId}" in task "${task.title}"`);
            return action; // Keep original if no mapping (might be a playground ID or other reference)
          }
        }

        return action; // No targetId to remap
      });
    };

    // Remap all logic arrays
    const remappedLogic = {
      ...task.logic,
      onOpen: remapActions(task.logic.onOpen),
      onCorrect: remapActions(task.logic.onCorrect),
      onIncorrect: remapActions(task.logic.onIncorrect)
    };

    return {
      ...task,
      logic: remappedLogic
    };
  });
}

/**
 * Creates an ID mapping table from template tasks to new game tasks.
 * 
 * @param templateTasks - Original template tasks with old IDs
 * @param newTasks - New game tasks with new IDs (must be in same order)
 * @returns Map of oldId -> newId
 */
export function createTaskIdMap(
  templateTasks: GamePoint[],
  newTasks: GamePoint[]
): Map<string, string> {
  const idMap = new Map<string, string>();

  if (templateTasks.length !== newTasks.length) {
    console.error('[TaskIdRemapping] ❌ CRITICAL: Template and new task arrays have different lengths!', {
      templateCount: templateTasks.length,
      newCount: newTasks.length
    });
    throw new Error('Template and new task arrays must have same length for ID mapping');
  }

  templateTasks.forEach((templateTask, index) => {
    const oldId = templateTask.id;
    const newId = newTasks[index].id;
    idMap.set(oldId, newId);

    console.log(`[TaskIdRemapping] 🗺️ Map entry: "${templateTask.title}" (${oldId}) → (${newId})`);
  });

  return idMap;
}

/**
 * Validates that all targetId references in tasks are valid (point to existing tasks).
 * 
 * @param tasks - Tasks to validate
 * @returns Validation results
 */
export function validateTaskReferences(tasks: GamePoint[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const taskIds = new Set(tasks.map(t => t.id));

  tasks.forEach(task => {
    if (!task.logic) return;

    const allActions = [
      ...(task.logic.onOpen || []),
      ...(task.logic.onCorrect || []),
      ...(task.logic.onIncorrect || [])
    ];

    allActions.forEach(action => {
      if (action.targetId) {
        // Check if targetId exists in tasks
        if (!taskIds.has(action.targetId)) {
          // Could be a playground ID (not an error)
          if (action.targetId.startsWith('pg-')) {
            warnings.push(`Task "${task.title}" has action targeting playground "${action.targetId}"`);
          } else {
            errors.push(`Task "${task.title}" has action targeting non-existent task "${action.targetId}"`);
          }
        }
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
