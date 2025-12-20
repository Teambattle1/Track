
import { supabase } from '../lib/supabase.ts';
import { Game, TaskTemplate, TaskList, Team } from '../types.ts';

const logError = (context: string, error: any) => {
    const message = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    if (message.includes('Failed to fetch')) {
        console.warn(`[Supabase] Network connection failed in '${context}'. Check internet and API keys.`);
    } else if (error?.code === '42P01' || message.includes('Could not find the table')) {
        console.error(`[Supabase] Table missing in '${context}'. Use Admin panel to run SQL setup.`);
    } else {
        console.error(`[Supabase] Error in '${context}':`, error);
    }
    return message;
};

export const fetchGames = async (): Promise<Game[]> => {
  try {
    const { data, error } = await supabase.from('games').select('*');
    if (error) { logError('fetchGames', error); return []; }
    return data ? data.map((row: any) => row.data) : [];
  } catch (e) { logError('fetchGames', e); return []; }
};

export const saveGame = async (game: Game) => {
  try {
    const { error } = await supabase.from('games').upsert({ 
        id: game.id, 
        data: game, 
        updated_at: new Date().toISOString() 
    });
    if (error) logError('saveGame', error);
  } catch (e) { logError('saveGame', e); }
};

export const deleteGame = async (id: string) => {
  try {
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (error) logError('deleteGame', error);
  } catch (e) { logError('deleteGame', e); }
};

export const fetchTeams = async (gameId: string): Promise<Team[]> => {
    try {
        const { data, error } = await supabase.from('teams').select('*').eq('game_id', gameId);
        if (error) { logError('fetchTeams', error); return []; }
        return data ? data.map((row: any) => ({
            id: row.id, 
            gameId: row.game_id, 
            name: row.name, 
            joinCode: row.join_code, 
            photoUrl: row.photo_url, 
            members: row.members || [], 
            score: row.score || 0,
            completedPointIds: row.completed_point_ids || [], 
            updatedAt: row.updated_at
        })) : [];
    } catch (e) { logError('fetchTeams', e); return []; }
};

export const fetchTeam = async (teamId: string): Promise<Team | null> => {
    try {
        const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
        if (error) return null;
        return {
            id: data.id,
            gameId: data.game_id,
            name: data.name,
            joinCode: data.join_code,
            photoUrl: data.photo_url,
            members: data.members || [],
            score: data.score || 0,
            completedPointIds: data.completed_point_ids || [],
            updatedAt: data.updated_at
        };
    } catch (e) { return null; }
};

export const registerTeam = async (team: Team) => {
    try {
        const payload = {
            id: team.id, 
            game_id: team.gameId, 
            name: team.name, 
            join_code: team.joinCode, 
            photo_url: team.photoUrl, 
            members: team.members, 
            score: team.score,
            completed_point_ids: team.completedPointIds || [], 
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('teams').upsert(payload);
        if (error) logError('registerTeam', error);
    } catch (e) { logError('registerTeam', e); }
};

export const updateTeamProgress = async (teamId: string, completedPointId: string, newScore: number) => {
    try {
        const team = await fetchTeam(teamId);
        if (!team) return;

        const updatedPoints = Array.from(new Set([...(team.completedPointIds || []), completedPointId]));
        
        const { error } = await supabase.from('teams').update({ 
            completed_point_ids: updatedPoints,
            score: newScore,
            updated_at: new Date().toISOString()
        }).eq('id', teamId);

        if (error) logError('updateTeamProgress', error);
    } catch (e) { logError('updateTeamProgress', e); }
};

export const updateTeamScore = async (teamId: string, scoreDelta: number) => {
    try {
        const { data, error } = await supabase.from('teams').select('score').eq('id', teamId).single();
        if (error) throw error;
        if (data) {
            const newScore = (data.score || 0) + scoreDelta;
            await supabase.from('teams').update({ score: newScore }).eq('id', teamId);
        }
    } catch (e) { logError('updateTeamScore', e); }
};

export const fetchLibrary = async (): Promise<TaskTemplate[]> => {
  try {
    const { data, error } = await supabase.from('library').select('*');
    if (error) { logError('fetchLibrary', error); return []; }
    return data ? data.map((row: any) => row.data) : [];
  } catch (e: any) { logError('fetchLibrary', e); return []; }
};

export const saveTemplate = async (template: TaskTemplate) => {
  try {
    const { error } = await supabase.from('library').upsert({ 
        id: template.id, 
        data: template, 
        updated_at: new Date().toISOString() 
    });
    if (error) logError('saveTemplate', error);
  } catch (e) { logError('saveTemplate', e); }
};

export const deleteTemplate = async (id: string) => {
  try {
    const { error } = await supabase.from('library').delete().eq('id', id);
    if (error) logError('deleteTemplate', error);
  } catch (e) { logError('deleteTemplate', e); }
};

export const fetchTaskLists = async (): Promise<TaskList[]> => {
  try {
    const { data, error } = await supabase.from('task_lists').select('*');
    if (error) { logError('fetchTaskLists', error); return []; }
    return data ? data.map((row: any) => row.data) : [];
  } catch (e) { logError('fetchTaskLists', e); return []; }
};

export const saveTaskList = async (list: TaskList) => {
  try {
    const { error } = await supabase.from('task_lists').upsert({ 
        id: list.id, 
        data: list, 
        updated_at: new Date().toISOString() 
    });
    if (error) logError('saveTaskList', error);
  } catch (e) { logError('saveTaskList', e); }
};

export const deleteTaskList = async (id: string) => {
  try {
    const { error } = await supabase.from('task_lists').delete().eq('id', id);
    if (error) logError('deleteTaskList', error);
  } catch (e) { logError('deleteTaskList', e); }
};
