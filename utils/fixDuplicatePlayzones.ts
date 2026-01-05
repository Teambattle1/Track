/**
 * Utility to fix duplicate playzones in game 174
 * This script removes duplicate playground IDs and their associated tasks
 */

import * as db from '../services/db';

export const fixDuplicatePlayzones = async (gameId: string) => {
    console.log(`[FixPlayzones] Starting fix for game ${gameId}...`);
    
    // 1. Fetch the game
    const game = await db.fetchGame(gameId);
    if (!game) {
        console.error(`[FixPlayzones] Game ${gameId} not found`);
        return { success: false, error: 'Game not found' };
    }

    console.log(`[FixPlayzones] Loaded game: ${game.name}`);
    console.log(`[FixPlayzones] Current playgrounds: ${game.playgrounds?.length || 0}`);
    console.log(`[FixPlayzones] Current tasks: ${game.points?.length || 0}`);

    // 2. Identify duplicate playground IDs
    const playgrounds = game.playgrounds || [];
    const playgroundIds = playgrounds.map(pg => pg.id);
    const duplicateIds = playgroundIds.filter((id, index) => playgroundIds.indexOf(id) !== index);
    
    console.log(`[FixPlayzones] Duplicate playground IDs found:`, duplicateIds);

    if (duplicateIds.length === 0) {
        console.log(`[FixPlayzones] No duplicates found. Game is clean.`);
        return { success: true, message: 'No duplicates found' };
    }

    // 3. Keep only unique playgrounds (first occurrence of each ID)
    const uniquePlaygrounds = playgrounds.filter((pg, index) => 
        playgroundIds.indexOf(pg.id) === index
    );

    console.log(`[FixPlayzones] Removed ${playgrounds.length - uniquePlaygrounds.length} duplicate playgrounds`);
    console.log(`[FixPlayzones] Unique playgrounds:`, uniquePlaygrounds.map(pg => ({ id: pg.id, title: pg.title })));

    // 4. Get the IDs of playgrounds we're keeping
    const keptPlaygroundIds = new Set(uniquePlaygrounds.map(pg => pg.id));

    // 5. Remove tasks that belong to removed duplicate playgrounds
    // Group tasks by playground ID to see which tasks belong to duplicates
    const tasksByPlayground = (game.points || []).reduce((acc, task) => {
        const pgId = task.playgroundId || 'none';
        if (!acc[pgId]) acc[pgId] = [];
        acc[pgId].push(task);
        return acc;
    }, {} as Record<string, any[]>);

    console.log(`[FixPlayzones] Tasks by playground:`, 
        Object.entries(tasksByPlayground).map(([id, tasks]) => ({ 
            playgroundId: id, 
            taskCount: tasks.length,
            isKept: keptPlaygroundIds.has(id) || id === 'none'
        }))
    );

    // Keep only tasks that:
    // - Have no playgroundId (map tasks)
    // - Belong to kept playgrounds
    const cleanedTasks = (game.points || []).filter(task => {
        if (!task.playgroundId) return true; // Keep map tasks
        return keptPlaygroundIds.has(task.playgroundId);
    });

    const removedTasksCount = (game.points?.length || 0) - cleanedTasks.length;
    console.log(`[FixPlayzones] Removed ${removedTasksCount} tasks from duplicate playgrounds`);

    // 6. Update the game
    const updatedGame = {
        ...game,
        playgrounds: uniquePlaygrounds,
        points: cleanedTasks
    };

    console.log(`[FixPlayzones] Final state:`, {
        playgrounds: updatedGame.playgrounds.length,
        tasks: updatedGame.points.length
    });

    // 7. Save to database
    console.log(`[FixPlayzones] Saving to database...`);
    await db.saveGame(updatedGame);
    console.log(`[FixPlayzones] ✅ Game saved successfully!`);

    return {
        success: true,
        removed: {
            playgrounds: playgrounds.length - uniquePlaygrounds.length,
            tasks: removedTasksCount
        },
        final: {
            playgrounds: updatedGame.playgrounds.length,
            tasks: updatedGame.points.length
        }
    };
};
