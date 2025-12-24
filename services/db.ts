
import { supabase } from '../lib/supabase';
import { Game, TaskTemplate, TaskList, Team, TeamMemberData, PlaygroundTemplate } from '../types.ts';

/**
 * Utility to wrap promises with a timeout.
 * Fixed destructuring errors by allowing 'any' for promise and returning Promise<any> to fix type inference issues.
 */
const withTimeout = (promise: any, timeoutMs: number = 8000): Promise<any> => {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DATABASE_TIMEOUT')), timeoutMs)
        )
    ]);
};

/**
 * Utility to extract a clean error message from Supabase or generic errors.
 */
export const logError = (context: string, error: any) => {
    let message = 'Unknown Error';
    let code = '';
    
    if (error) {
        if (typeof error === 'string') {
            message = error;
        } else if (error.message || error.details || error.hint) {
            message = error.message || error.details || error.hint;
            code = error.code || '';
        } else if (error.code) {
            message = `Error Code: ${error.code}`;
            code = error.code;
        } else {
            try {
                message = JSON.stringify(error);
            } catch (e) {
                message = String(error);
            }
        }
    }

    if (message.includes('Failed to fetch') || message === 'DATABASE_TIMEOUT') {
        console.warn(`[Supabase] Connection issue in '${context}'. Check network.`);
    } else if (code === '42P01' || message.includes('does not exist')) {
        console.error(`[Supabase] Missing Table/Function in '${context}'. Run SQL setup.`);
    } else {
        console.error(`[Supabase] Error in '${context}': ${message} ${code ? `(Code: ${code})` : ''}`);
    }
    
    return { message, code };
};

// --- GLOBAL UTILITIES ---

export const purgeTagGlobally = async (tagName: string) => {
    try {
        const { error } = await withTimeout(supabase.rpc('purge_tag_globally', { 
            tag_to_purge: tagName.toLowerCase() 
        }));
        if (error) {
            logError('purgeTagGlobally', error);
            throw error;
        }
    } catch (e) {
        logError('purgeTagGlobally', e);
        throw e;
    }
};

export const renameTagGlobally = async (oldTag: string, newTag: string) => {
    try {
        const { error } = await withTimeout(supabase.rpc('rename_tag_globally', { 
            old_tag: oldTag.toLowerCase(),
            new_tag: newTag.toLowerCase()
        }));
        if (error) {
            logError('renameTagGlobally', error);
            throw error;
        }
    } catch (e) {
        logError('renameTagGlobally', e);
        throw e;
    }
};

// --- ACCOUNT USERS & INVITES ---

export const fetchAccountUsers = async (): Promise<any[]> => {
  try {
    const { data, error } = await withTimeout(supabase.from('account_users').select('*'));
    if (error) { 
        logError('fetchAccountUsers', error);
        return []; 
    }
    return data ? data.map((row: any) => ({ ...row.data, id: row.id })) : [];
  } catch (e) {
      logError('fetchAccountUsers', e);
      return [];
  }
};

export const saveAccountUser = async (user: any) => {
  const { error } = await supabase.from('account_users').upsert({ 
      id: user.id, 
      data: user, 
      updated_at: new Date().toISOString() 
  });
  if (error) logError('saveAccountUser', error);
};

export const deleteAccountUsers = async (ids: string[]) => {
  const { error } = await supabase.from('account_users').delete().in('id', ids);
  if (error) logError('deleteAccountUsers', error);
};

export const fetchAccountInvites = async (): Promise<any[]> => {
  try {
    const { data, error } = await withTimeout(supabase.from('account_invites').select('*'));
    if (error) {
        logError('fetchAccountInvites', error);
        return [];
    }
    return data ? data.map((row: any) => ({ ...row.data, id: row.id })) : [];
  } catch (e) {
      logError('fetchAccountInvites', e);
      return [];
  }
};

export const saveAccountInvite = async (invite: any) => {
  const { error } = await supabase.from('account_invites').upsert({ 
      id: invite.id, 
      data: invite, 
      updated_at: new Date().toISOString() 
  });
  if (error) logError('saveAccountInvite', error);
};

export const deleteAccountInvite = async (id: string) => {
  const { error } = await supabase.from('account_invites').delete().eq('id', id);
  if (error) logError('deleteAccountInvite', error);
};

// --- GAMES ---

export const fetchGames = async (): Promise<Game[]> => {
  try {
    const { data, error } = await withTimeout(supabase.from('games').select('*'));
    if (error) { 
        logError('fetchGames', error);
        return []; 
    }
    return data ? data.map((row: any) => row.data) : [];
  } catch (e) { 
      logError('fetchGames', e); 
      return []; 
  }
};

export const saveGame = async (game: Game) => {
    try {
        const { error } = await supabase.from('games').upsert({ 
            id: game.id, 
            data: game, 
            updated_at: new Date().toISOString() 
        });
        if (error) logError('saveGame', error);
    } catch (e) {
        logError('saveGame', e);
    }
};

export const deleteGame = async (id: string) => {
  try {
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (error) logError('deleteGame', error);
  } catch (e) { logError('deleteGame', e); }
};

export const fetchTeams = async (gameId: string): Promise<Team[]> => {
    try {
        const { data, error } = await withTimeout(supabase.from('teams').select('*').eq('game_id', gameId));
        if (error) { 
            logError('fetchTeams', error); 
            return []; 
        }
        return data ? data.map((row: any) => ({
            id: row.id, 
            gameId: row.game_id, 
            name: row.name, 
            joinCode: row.join_code, 
            photoUrl: row.photo_url, 
            members: (row.members as any[]) || [], 
            score: row.score || 0,
            completedPointIds: row.completed_point_ids || [], 
            updatedAt: row.updated_at,
            captainDeviceId: row.captain_device_id,
            isStarted: row.is_started
        })) : [];
    } catch (e) { 
        logError('fetchTeams', e); 
        return []; 
    }
};

export const fetchTeam = async (teamId: string): Promise<Team | null> => {
    try {
        const { data, error } = await withTimeout(supabase.from('teams').select('*').eq('id', teamId).single(), 4000);
        if (error) return null;
        return {
            id: data.id,
            gameId: data.game_id,
            name: data.name,
            joinCode: data.join_code,
            photoUrl: data.photo_url,
            members: (data.members as any[]) || [],
            score: data.score || 0,
            completedPointIds: data.completed_point_ids || [],
            updatedAt: data.updated_at,
            captainDeviceId: data.captain_device_id,
            isStarted: data.is_started
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
            updated_at: new Date().toISOString(),
            captain_device_id: team.captainDeviceId,
            is_started: team.isStarted || false
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

export const updateTeamName = async (teamId: string, newName: string) => {
    try {
        const { error } = await supabase.from('teams').update({ 
            name: newName,
            updated_at: new Date().toISOString()
        }).eq('id', teamId);
        if (error) logError('updateTeamName', error);
    } catch (e) { logError('updateTeamName', e); }
};

export const updateTeamCaptain = async (teamId: string, captainDeviceId: string) => {
    try {
        const { error } = await supabase.from('teams').update({ 
            captain_device_id: captainDeviceId,
            updated_at: new Date().toISOString()
        }).eq('id', teamId);
        if (error) logError('updateTeamCaptain', error);
    } catch (e) { logError('updateTeamCaptain', e); }
};

export const fetchLibrary = async (): Promise<TaskTemplate[]> => {
  try {
    const { data, error } = await withTimeout(supabase.from('library').select('*'));
    if (error) { 
        logError('fetchLibrary', error); 
        return []; 
    }
    return data ? data.map((row: any) => row.data) : [];
  } catch (e: any) { 
      logError('fetchLibrary', e); 
      return []; 
  }
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
    const { data, error } = await withTimeout(supabase.from('task_lists').select('*'));
    if (error) { 
        logError('fetchTaskLists', error); 
        return []; 
    }
    return data ? data.map((row: any) => row.data) : [];
  } catch (e) { 
      logError('fetchTaskLists', e); 
      return []; 
  }
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

export const fetchTaskListByToken = async (token: string): Promise<TaskList | null> => {
    try {
        const { data, error } = await withTimeout(supabase.from('task_lists').select('*'), 5000);
        if (error) throw error;
        const found = data.find((row: any) => row.data.shareToken === token);
        return found ? found.data : null;
    } catch (e) {
        logError('fetchTaskListByToken', e);
        return null;
    }
};

export const submitClientTask = async (listId: string, task: TaskTemplate) => {
    try {
        const { data: current, error: fetchError } = await supabase.from('task_lists').select('*').eq('id', listId).single();
        if (fetchError || !current) throw new Error("List not found");
        const listData = current.data as TaskList;
        const updatedTasks = [...listData.tasks, task];
        const updatedList = { ...listData, tasks: updatedTasks };
        const { error: saveError } = await supabase.from('task_lists').update({
            data: updatedList,
            updated_at: new Date().toISOString()
        }).eq('id', listId);
        if (saveError) throw saveError;
        return true;
    } catch (e) {
        logError('submitClientTask', e);
        return false;
    }
};

export const fetchPlaygroundLibrary = async (): Promise<PlaygroundTemplate[]> => {
    try {
        const { data, error } = await withTimeout(supabase.from('playground_library').select('*'));
        if (error) { 
            if (error.code === '42P01') console.log("Playground library table missing");
            else logError('fetchPlaygroundLibrary', error); 
            return []; 
        }
        return data ? data.map((row: any) => ({
            id: row.id,
            title: row.title,
            isGlobal: row.is_global,
            playgroundData: row.data.playgroundData,
            tasks: row.data.tasks,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        })) : [];
    } catch (e) { logError('fetchPlaygroundLibrary', e); return []; }
};

export const savePlaygroundTemplate = async (template: PlaygroundTemplate) => {
    try {
        const { error } = await supabase.from('playground_library').upsert({
            id: template.id,
            title: template.title,
            is_global: template.isGlobal,
            data: { 
                playgroundData: template.playgroundData,
                tasks: template.tasks 
            },
            updated_at: new Date().toISOString()
        });
        if (error) logError('savePlaygroundTemplate', error);
    } catch (e) { logError('savePlaygroundTemplate', e); }
};

export const deletePlaygroundTemplate = async (id: string) => {
    try {
        const { error } = await supabase.from('playground_library').delete().eq('id', id);
        if (error) logError('deletePlaygroundTemplate', error);
    } catch (e) { logError('deletePlaygroundTemplate', e); }
};
