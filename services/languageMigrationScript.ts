/**
 * Language Migration Script for Task Master
 * 
 * This script analyzes all tasks in the library and task lists,
 * detects their language from the question text, and updates
 * them to remove "GLOBAL" and set proper language.
 * 
 * Usage: Import and call runCompleteLanguageMigration() from the console
 * or add a button in the UI to trigger it.
 */

import { supabase } from '../lib/supabase';
import { detectLanguageFromText, normalizeLanguage } from '../utils/i18n';
import { TaskTemplate, TaskList } from '../types';

const logError = (context: string, error: any) => {
    console.error(`[Language Migration] Error in ${context}:`, error);
};

/**
 * Fetch all tasks from library
 */
const fetchAllLibraryTasks = async (): Promise<TaskTemplate[]> => {
    try {
        const { data, error } = await supabase
            .from('library')
            .select('id, data')
            .order('id', { ascending: true });
        
        if (error) throw error;
        if (!data) return [];
        
        return data.map((row: any) => {
            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            return { ...rowData, id: row.id };
        });
    } catch (e) {
        logError('fetchAllLibraryTasks', e);
        return [];
    }
};

/**
 * Fetch all task lists
 */
const fetchAllTaskLists = async (): Promise<TaskList[]> => {
    try {
        const { data, error } = await supabase
            .from('task_lists')
            .select('id, data')
            .order('id', { ascending: true });
        
        if (error) throw error;
        if (!data) return [];
        
        return data.map((row: any) => {
            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            return { ...rowData, id: row.id };
        });
    } catch (e) {
        logError('fetchAllTaskLists', e);
        return [];
    }
};

/**
 * Bulk migration: Analyze and fix language for ALL tasks in the library
 * This removes "GLOBAL" and detects actual language from task questions
 */
export const bulkMigrateLibraryLanguages = async (): Promise<{ updated: number; errors: number; log: string[] }> => {
    console.log('[Language Migration] Starting bulk migration for task library...');
    const log: string[] = [];
    let updated = 0;
    let errors = 0;
    
    try {
        // Fetch all library tasks
        const allTasks = await fetchAllLibraryTasks();
        log.push(`Found ${allTasks.length} tasks in library`);
        console.log(`[Language Migration] Found ${allTasks.length} tasks to process`);
        
        // Process each task
        for (const task of allTasks) {
            try {
                const currentLang = task.settings?.language || 'English';
                
                // Detect language from question text
                const detectedLanguage = detectLanguageFromText(task.task.question || '');
                
                // Only update if language changed or was GLOBAL
                const shouldUpdate = 
                    currentLang !== detectedLanguage || 
                    currentLang === 'GLOBAL' || 
                    currentLang === 'global' ||
                    !currentLang;
                
                if (shouldUpdate) {
                    const updatedTask = {
                        ...task,
                        settings: {
                            ...task.settings,
                            language: detectedLanguage
                        }
                    };
                    
                    // Save directly to database
                    const { error } = await supabase
                        .from('library')
                        .update({ 
                            data: updatedTask, 
                            updated_at: new Date().toISOString() 
                        })
                        .eq('id', task.id);
                    
                    if (error) {
                        const errorMsg = `Error updating task ${task.id}: ${error.message}`;
                        console.error(`[Language Migration] ${errorMsg}`);
                        log.push(`❌ ${errorMsg}`);
                        errors++;
                    } else {
                        const successMsg = `"${task.title}": ${currentLang} → ${detectedLanguage}`;
                        console.log(`[Language Migration] ✓ ${successMsg}`);
                        log.push(`✓ ${successMsg}`);
                        updated++;
                    }
                }
            } catch (taskError: any) {
                const errorMsg = `Error processing task ${task.id}: ${taskError.message}`;
                console.error(`[Language Migration] ${errorMsg}`);
                log.push(`❌ ${errorMsg}`);
                errors++;
            }
        }
        
        const summary = `Library Migration Complete! Updated: ${updated}, Errors: ${errors}`;
        console.log(`[Language Migration] ${summary}`);
        log.push('');
        log.push(summary);
        
        return { updated, errors, log };
    } catch (e: any) {
        const errorMsg = `Fatal error in library migration: ${e.message}`;
        logError('bulkMigrateLibraryLanguages', e);
        log.push(`❌ ${errorMsg}`);
        return { updated, errors, log };
    }
};

/**
 * Bulk migration: Fix language for all tasks in all task lists
 */
export const bulkMigrateTaskListLanguages = async (): Promise<{ updated: number; errors: number; log: string[] }> => {
    console.log('[Language Migration] Starting bulk migration for task lists...');
    const log: string[] = [];
    let updated = 0;
    let errors = 0;
    
    try {
        const allLists = await fetchAllTaskLists();
        log.push(`Found ${allLists.length} task lists`);
        console.log(`[Language Migration] Found ${allLists.length} task lists to process`);
        
        for (const list of allLists) {
            try {
                let listChanged = false;
                let tasksFixed = 0;
                
                const updatedTasks = list.tasks.map(task => {
                    const currentLang = task.settings?.language || 'English';
                    const detectedLanguage = detectLanguageFromText(task.task.question || '');
                    
                    const shouldUpdate = 
                        currentLang !== detectedLanguage || 
                        currentLang === 'GLOBAL' || 
                        currentLang === 'global' ||
                        !currentLang;
                    
                    if (shouldUpdate) {
                        listChanged = true;
                        tasksFixed++;
                        console.log(`[Language Migration] List "${list.name}" - Task "${task.title}": ${currentLang} → ${detectedLanguage}`);
                        return {
                            ...task,
                            settings: {
                                ...task.settings,
                                language: detectedLanguage
                            }
                        };
                    }
                    return task;
                });
                
                if (listChanged) {
                    const updatedList = { ...list, tasks: updatedTasks };
                    const { error } = await supabase
                        .from('task_lists')
                        .update({ 
                            data: updatedList, 
                            updated_at: new Date().toISOString() 
                        })
                        .eq('id', list.id);
                    
                    if (error) {
                        const errorMsg = `Error updating list "${list.name}": ${error.message}`;
                        console.error(`[Language Migration] ${errorMsg}`);
                        log.push(`❌ ${errorMsg}`);
                        errors++;
                    } else {
                        const successMsg = `List "${list.name}": Fixed ${tasksFixed} task(s)`;
                        console.log(`[Language Migration] ✓ ${successMsg}`);
                        log.push(`✓ ${successMsg}`);
                        updated++;
                    }
                }
            } catch (listError: any) {
                const errorMsg = `Error processing list "${list.name}": ${listError.message}`;
                console.error(`[Language Migration] ${errorMsg}`);
                log.push(`❌ ${errorMsg}`);
                errors++;
            }
        }
        
        const summary = `Task List Migration Complete! Updated: ${updated} lists, Errors: ${errors}`;
        console.log(`[Language Migration] ${summary}`);
        log.push('');
        log.push(summary);
        
        return { updated, errors, log };
    } catch (e: any) {
        const errorMsg = `Fatal error in task list migration: ${e.message}`;
        logError('bulkMigrateTaskListLanguages', e);
        log.push(`❌ ${errorMsg}`);
        return { updated, errors, log };
    }
};

/**
 * Run complete language migration for all tasks
 * This is the main function to call from the UI or console
 */
export const runCompleteLanguageMigration = async (): Promise<{ 
    totalUpdated: number; 
    totalErrors: number; 
    log: string[] 
}> => {
    console.log('=== STARTING COMPLETE LANGUAGE MIGRATION ===');
    const fullLog: string[] = ['=== LANGUAGE MIGRATION STARTED ===', ''];
    
    // Migrate library
    fullLog.push('📚 MIGRATING LIBRARY TASKS...');
    const libraryResults = await bulkMigrateLibraryLanguages();
    fullLog.push(...libraryResults.log);
    fullLog.push('');
    
    // Migrate task lists
    fullLog.push('📋 MIGRATING TASK LISTS...');
    const listResults = await bulkMigrateTaskListLanguages();
    fullLog.push(...listResults.log);
    fullLog.push('');
    
    // Summary
    const totalUpdated = libraryResults.updated + listResults.updated;
    const totalErrors = libraryResults.errors + listResults.errors;
    
    fullLog.push('=== MIGRATION COMPLETE ===');
    fullLog.push(`Library Tasks: ${libraryResults.updated} updated, ${libraryResults.errors} errors`);
    fullLog.push(`Task Lists: ${listResults.updated} updated, ${listResults.errors} errors`);
    fullLog.push(`TOTAL: ${totalUpdated} items fixed, ${totalErrors} errors`);
    
    console.log('=== MIGRATION COMPLETE ===');
    console.log(`Library Tasks: ${libraryResults.updated} updated, ${libraryResults.errors} errors`);
    console.log(`Task Lists: ${listResults.updated} updated, ${listResults.errors} errors`);
    console.log(`TOTAL: ${totalUpdated} items fixed`);
    
    return {
        totalUpdated,
        totalErrors,
        log: fullLog
    };
};
