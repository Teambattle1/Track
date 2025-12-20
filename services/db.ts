import { supabase } from '../lib/supabase';
import { Game, TaskTemplate, TaskList, Team } from '../types';

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

// --- TEAMS ---

export const fetchTeams = async (gameId: string): Promise<Team[]> => {
    const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('game_id', gameId);
    
    if (error) {
        logError('fetchTeams', error);
        return [];
    }
    // Map snake_case DB columns to camelCase types
    return data ? data.map((row: any) => ({
        id: row.id,
        gameId: row.game_id,
        name: row.name,
        joinCode: row.join_code, // Map if exists
        photoUrl: row.photo_url,
        members: row.members || [],
        score: row.score || 0,
        updatedAt: row.updated_at
    })) : [];
};

export const registerTeam = async (team: Team) => {
    // Attempt 1: Try saving with all fields including join_code
    const { error } = await supabase
        .from('teams')
        .upsert({
            id: team.id,
            game_id: team.gameId,
            name: team.name,
            join_code: team.joinCode, 
            photo_url: team.photoUrl,
            members: team.members,
            score: team.score,
            updated_at: new Date().toISOString()
        });
    
    if (error) {
        console.warn("[Supabase] First attempt to register team failed. Retrying without 'join_code' in case of schema mismatch...", error.message);
        
        // Attempt 2: Retry without join_code (in case column is missing in DB)
        const { error: retryError } = await supabase
            .from('teams')
            .upsert({
                id: team.id,
                game_id: team.gameId,
                name: team.name,
                // join_code omitted
                photo_url: team.photoUrl,
                members: team.members,
                score: team.score,
                updated_at: new Date().toISOString()
            });
            
        if (retryError) {
            logError('registerTeam (Retry)', retryError);
        } else {
            console.log("[Supabase] Team registered successfully (fallback mode).");
        }
    }
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