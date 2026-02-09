/**
 * Initialize the "Around the World in 80" task list in the database
 * Creates it once if it doesn't exist, with all default ATW tasks
 */

import { TaskList } from '../../types';
import { getAllARWTasks } from './defaultTasks';
import * as db from '../../services/db';

const ATW_TASK_LIST_ID = 'arw-tasklist-jorden80';

export const ensureATWTaskList = async (existingLists: TaskList[]): Promise<TaskList | null> => {
    // Check if it already exists
    const existing = existingLists.find(l => l.id === ATW_TASK_LIST_ID);
    if (existing) {
        return existing;
    }

    // Create the ATW task list with all default tasks
    const allTasks = getAllARWTasks();

    const atwList: TaskList = {
        id: ATW_TASK_LIST_ID,
        name: 'Around the World in 80',
        description: 'Complete task collection for the Around the World game — 36 tasks across 12 European cities from London to Istanbul. Includes knowledge questions, geography challenges, and creative photo missions.',
        tasks: allTasks,
        color: '#92400e', // amber-800 (Victorian theme)
        iconId: 'world',
        createdAt: Date.now(),
    };

    try {
        await db.saveTaskList(atwList);
        console.log(`[ATW] Created task list "${atwList.name}" with ${allTasks.length} tasks`);
        return atwList;
    } catch (e) {
        console.error('[ATW] Failed to create task list:', e);
        return null;
    }
};
