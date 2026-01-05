/**
 * Utility functions for ensuring unique React keys when rendering tasks
 * Fixes duplicate key errors from old AI-generated tasks
 */

/**
 * Generate a guaranteed-unique key for rendering a task in a list
 * Combines the task ID with the index to prevent duplicate key errors
 * 
 * @param taskId - The task's ID (may be in old or new format)
 * @param index - The index of the task in the array
 * @returns A unique key string for React rendering
 */
export const getUniqueTaskKey = (taskId: string, index: number): string => {
  // For maximum safety, combine ID with index and a hash of the ID
  // This ensures uniqueness even if IDs are duplicated in the database
  const hash = simpleHash(taskId);
  return `task-${taskId}-${index}-${hash}`;
};

/**
 * Simple string hash function for additional uniqueness
 */
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 6);
};

/**
 * Check if a task ID is in the old format (before the fix)
 * Old format: ai-{timestamp}-{index} or ai-{timestamp}-{index}-{shortRandom}
 * New format: ai-{uniqueTimestamp}-{randomString} (10+ chars)
 * 
 * @param id - The task ID to check
 * @returns true if the ID is in the old format
 */
export const isOldAiTaskId = (id: string): boolean => {
  if (!id.startsWith('ai-')) return false;
  
  const parts = id.split('-');
  if (parts.length < 3) return true; // Very old or invalid format
  
  const lastPart = parts[parts.length - 1];
  
  // If last part is a single digit (0-9), it's definitely old format
  if (/^\d+$/.test(lastPart) && lastPart.length < 2) return true;
  
  // If last part is short (less than 7 chars), might be old format
  if (lastPart.length < 7) return true;
  
  return false;
};

/**
 * Regenerate a task ID to ensure uniqueness
 * Used for fixing old tasks during migration or import
 * 
 * @param oldId - The old task ID
 * @returns A new unique ID
 */
export const regenerateTaskId = (oldId: string): string => {
  const timestamp = Date.now();
  const random1 = Math.random().toString(36).substring(2, 9);
  const random2 = Math.random().toString(36).substring(2, 6);
  
  // Preserve the prefix if it exists (e.g., 'ai-', 'task-', etc.)
  const prefix = oldId.includes('-') ? oldId.split('-')[0] : 'task';
  
  return `${prefix}-${timestamp}-${random1}${random2}`;
};
