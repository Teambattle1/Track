import { supabase } from '../lib/supabase';
import { Game, TaskTemplate, TaskList, Team, PlaygroundTemplate } from '../types';

const logError = (context: string, error: any) => {
    console.error(`[DB Service] Error in ${context}:`, error);
};

// --- GAMES ---

export const fetchGames = async (): Promise<Game[]> => {
    try {
        const { data, error } = await supabase.from('games').select('*');
        if (error) throw error;
        return data.map((row: any) => ({ ...row.data, id: row.id }));
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
        if (error) throw error;
    } catch (e) {
        logError('saveGame', e);
    }
};

export const deleteGame = async (id: string) => {
    try {
        await supabase.from('games').delete().eq('id', id);
        await supabase.from('teams').delete().eq('game_id', id);
    } catch (e) {
        logError('deleteGame', e);
    }
};

// --- TEAMS ---

export const fetchTeams = async (gameId: string): Promise<Team[]> => {
    try {
        const { data, error } = await supabase.from('teams').select('*').eq('game_id', gameId);
        if (error) throw error;
        
        return data.map((row: any) => ({
            id: row.id,
            gameId: row.game_id,
            name: row.name,
            joinCode: row.join_code,
            photoUrl: row.photo_url,
            members: row.members,
            score: row.score,
            updatedAt: row.updated_at,
            captainDeviceId: row.captain_device_id,
            isStarted: row.is_started,
            completedPointIds: row.completed_point_ids || []
        }));
    } catch (e) {
        logError('fetchTeams', e);
        return [];
    }
};

export const fetchTeam = async (teamId: string): Promise<Team | null> => {
    try {
        const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
        if (error) throw error;
        if (!data) return null;
        return {
            id: data.id,
            gameId: data.game_id,
            name: data.name,
            joinCode: data.join_code,
            photoUrl: data.photo_url,
            members: data.members,
            score: data.score,
            updatedAt: data.updated_at,
            captainDeviceId: data.captain_device_id,
            isStarted: data.is_started,
            completedPointIds: data.completed_point_ids || []
        };
    } catch (e) {
        logError('fetchTeam', e);
        return null;
    }
};

export const registerTeam = async (team: Team) => {
    try {
        const { error } = await supabase.from('teams').insert({
            id: team.id,
            game_id: team.gameId,
            name: team.name,
            join_code: team.joinCode,
            photo_url: team.photoUrl,
            members: team.members,
            score: team.score,
            updated_at: team.updatedAt,
            captain_device_id: team.captainDeviceId,
            is_started: team.isStarted,
            completed_point_ids: team.completedPointIds
        });
        if (error) throw error;
    } catch (e) {
        logError('registerTeam', e);
    }
};

export const updateTeamScore = async (teamId: string, delta: number) => {
    try {
        const team = await fetchTeam(teamId);
        if (team) {
            const newScore = Math.max(0, team.score + delta);
            const { error } = await supabase.from('teams').update({ score: newScore }).eq('id', teamId);
            if (error) throw error;
        }
    } catch (e) {
        logError('updateTeamScore', e);
    }
};

export const updateTeamProgress = async (teamId: string, pointId: string, newScore: number) => {
    try {
        const team = await fetchTeam(teamId);
        if (team) {
            const completed = new Set(team.completedPointIds || []);
            completed.add(pointId);
            const { error } = await supabase.from('teams').update({ 
                score: newScore,
                completed_point_ids: Array.from(completed)
            }).eq('id', teamId);
            if (error) throw error;
        }
    } catch (e) {
        logError('updateTeamProgress', e);
    }
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

export const updateTeamPhoto = async (teamId: string, photoBase64: string) => {
    try {
        const { error } = await supabase.from('teams').update({
            photo_url: photoBase64,
            updated_at: new Date().toISOString()
        }).eq('id', teamId);
        if (error) logError('updateTeamPhoto', error);
    } catch (e) { logError('updateTeamPhoto', e); }
};

export const updateMemberPhoto = async (teamId: string, memberDeviceId: string, photoBase64: string) => {
    try {
        const team = await fetchTeam(teamId);
        if (!team) return;
        
        const updatedMembers = team.members.map((m: any) => {
            const mId = typeof m === 'string' ? '' : m.deviceId;
            const mName = typeof m === 'string' ? m : m.name;
            const mPhoto = typeof m === 'string' ? null : m.photo;
            
            if (mId === memberDeviceId) {
                return { name: mName, deviceId: mId, photo: photoBase64 };
            }
            return typeof m === 'string' ? { name: m, deviceId: '', photo: null } : m;
        });

        const { error } = await supabase.from('teams').update({
            members: updatedMembers,
            updated_at: new Date().toISOString()
        }).eq('id', teamId);
        
        if (error) logError('updateMemberPhoto', error);
    } catch (e) { logError('updateMemberPhoto', e); }
};

// --- LIBRARY (TASKS) ---

export const fetchLibrary = async (): Promise<TaskTemplate[]> => {
    try {
        const { data, error } = await supabase.from('library').select('*');
        if (error) throw error;
        return data.map((row: any) => ({ ...row.data, id: row.id }));
    } catch (e) {
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
        if (error) throw error;
    } catch (e) {
        logError('saveTemplate', e);
    }
};

export const deleteTemplate = async (id: string) => {
    try {
        await supabase.from('library').delete().eq('id', id);
    } catch (e) {
        logError('deleteTemplate', e);
    }
};

// --- TASK LISTS ---

export const fetchTaskLists = async (): Promise<TaskList[]> => {
    try {
        const { data, error } = await supabase.from('task_lists').select('*');
        if (error) throw error;
        return data.map((row: any) => ({ ...row.data, id: row.id }));
    } catch (e) {
        logError('fetchTaskLists', e);
        return [];
    }
};

export const fetchTaskListByToken = async (token: string): Promise<TaskList | null> => {
    try {
        const { data, error } = await supabase
            .from('task_lists')
            .select('*')
            .eq('data->>shareToken', token)
            .single();
            
        if (error) throw error;
        if (!data) return null;
        return { ...data.data, id: data.id };
    } catch (e) {
        logError('fetchTaskListByToken', e);
        return null;
    }
};

export const saveTaskList = async (list: TaskList) => {
    try {
        const { error } = await supabase.from('task_lists').upsert({ 
            id: list.id, 
            data: list,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    } catch (e) {
        logError('saveTaskList', e);
    }
};

export const deleteTaskList = async (id: string) => {
    try {
        await supabase.from('task_lists').delete().eq('id', id);
    } catch (e) {
        logError('deleteTaskList', e);
    }
};

export const submitClientTask = async (listId: string, task: TaskTemplate): Promise<boolean> => {
    try {
        const { data: current, error: fetchError } = await supabase.from('task_lists').select('*').eq('id', listId).single();
        if (fetchError) throw fetchError;
        
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

// --- PLAYGROUND LIBRARY ---

export const fetchPlaygroundLibrary = async (): Promise<PlaygroundTemplate[]> => {
    try {
        const { data, error } = await supabase.from('playground_library').select('*');
        if (error) throw error;
        return data.map((row: any) => ({ ...row.data, id: row.id, title: row.title, isGlobal: row.is_global }));
    } catch (e) {
        logError('fetchPlaygroundLibrary', e);
        return [];
    }
};

export const savePlaygroundTemplate = async (template: PlaygroundTemplate) => {
    try {
        const { error } = await supabase.from('playground_library').upsert({
            id: template.id,
            title: template.title,
            is_global: template.isGlobal,
            data: template,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    } catch (e) {
        logError('savePlaygroundTemplate', e);
    }
};

export const deletePlaygroundTemplate = async (id: string) => {
    try {
        await supabase.from('playground_library').delete().eq('id', id);
    } catch (e) {
        logError('deletePlaygroundTemplate', e);
    }
};

// --- TAGS MANAGEMENT (RPC) ---

export const purgeTagGlobally = async (tag: string) => {
    try {
        const { error } = await supabase.rpc('purge_tag_globally', { tag_to_purge: tag });
        if (error) throw error;
    } catch (e) {
        logError('purgeTagGlobally', e);
    }
};

export const renameTagGlobally = async (oldTag: string, newTag: string) => {
    try {
        const { error } = await supabase.rpc('rename_tag_globally', { old_tag: oldTag, new_tag: newTag });
        if (error) throw error;
    } catch (e) {
        logError('renameTagGlobally', e);
    }
};

// --- ACCOUNT USERS & INVITES ---

interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: string;
  updatedAt: string;
  updatedBy: string;
}

interface UserInvite {
  id: string;
  email: string;
  role: string;
  sentAt: string;
  status: 'pending' | 'expired';
}

export const fetchAccountUsers = async (): Promise<AccountUser[]> => {
    try {
        const { data, error } = await supabase.from('account_users').select('*');
        if (error) throw error;
        return data.map((row: any) => ({ ...row.data, id: row.id }));
    } catch (e) {
        logError('fetchAccountUsers', e);
        return [];
    }
};

export const saveAccountUser = async (user: AccountUser) => {
    try {
        const { error } = await supabase.from('account_users').upsert({
            id: user.id,
            data: user,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    } catch (e) {
        logError('saveAccountUser', e);
    }
};

export const deleteAccountUsers = async (ids: string[]) => {
    try {
        const { error } = await supabase.from('account_users').delete().in('id', ids);
        if (error) throw error;
    } catch (e) {
        logError('deleteAccountUsers', e);
    }
};

export const fetchAccountInvites = async (): Promise<UserInvite[]> => {
    try {
        const { data, error } = await supabase.from('account_invites').select('*');
        if (error) throw error;
        return data.map((row: any) => ({ ...row.data, id: row.id }));
    } catch (e) {
        logError('fetchAccountInvites', e);
        return [];
    }
};

export const saveAccountInvite = async (invite: UserInvite) => {
    try {
        const { error } = await supabase.from('account_invites').upsert({
            id: invite.id,
            data: invite,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    } catch (e) {
        logError('saveAccountInvite', e);
    }
};

export const deleteAccountInvite = async (id: string) => {
    try {
        const { error } = await supabase.from('account_invites').delete().eq('id', id);
        if (error) throw error;
    } catch (e) {
        logError('deleteAccountInvite', e);
    }
};
