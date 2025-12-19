import { supabase } from '../lib/supabase';
import { Game, TaskTemplate, TaskList } from '../types';

// Helper to handle errors gracefully and avoid [object Object] logging
const logError = (context: string, error: any) => {
    // 42P01 is the Postgrest code for "undefined_table"
    if (error.code === '42P01') {
        console.warn(`[Supabase] Table missing in '${context}'. Please ensure you have run the SQL setup script in your Supabase dashboard.`);
    } else {
        console.error(`[Supabase] Error in '${context}':`, error.message || error);
    }
};

// --- GAMES ---

export const fetchGames = async (): Promise<Game[]> => {
  const { data, error } = await supabase.from('games').select('*');
  if (error) {
    logError('fetchGames', error);
    return [];
  }
  return data ? data.map((row: any) => row.data) : [];
};

export const saveGame = async (game: Game) => {
  const { error } = await supabase
    .from('games')
    .upsert({ id: game.id, data: game, updated_at: new Date().toISOString() });
  
  if (error) logError('saveGame', error);
};

export const deleteGame = async (id: string) => {
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) logError('deleteGame', error);
};

// --- LIBRARY (Templates) ---

export const fetchLibrary = async (): Promise<TaskTemplate[]> => {
  const { data, error } = await supabase.from('library').select('*');
  if (error) {
    logError('fetchLibrary', error);
    return [];
  }
  return data ? data.map((row: any) => row.data) : [];
};

export const saveTemplate = async (template: TaskTemplate) => {
  const { error } = await supabase
    .from('library')
    .upsert({ id: template.id, data: template, updated_at: new Date().toISOString() });
  
  if (error) logError('saveTemplate', error);
};

export const deleteTemplate = async (id: string) => {
  const { error } = await supabase.from('library').delete().eq('id', id);
  if (error) logError('deleteTemplate', error);
};

// --- LISTS ---

export const fetchTaskLists = async (): Promise<TaskList[]> => {
  const { data, error } = await supabase.from('task_lists').select('*');
  if (error) {
    logError('fetchTaskLists', error);
    return [];
  }
  return data ? data.map((row: any) => row.data) : [];
};

export const saveTaskList = async (list: TaskList) => {
  const { error } = await supabase
    .from('task_lists')
    .upsert({ id: list.id, data: list, updated_at: new Date().toISOString() });
  
  if (error) logError('saveTaskList', error);
};

export const deleteTaskList = async (id: string) => {
  const { error } = await supabase.from('task_lists').delete().eq('id', id);
  if (error) logError('deleteTaskList', error);
};