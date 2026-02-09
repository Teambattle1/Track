
import { supabase } from '../lib/supabase';
import { Game, TaskTemplate, TaskList, Team, PlaygroundTemplate, AccountUser, AdminMessage } from '../types';
import { DEMO_TASKS, DEMO_LISTS, getDemoGames } from '../utils/demoContent';

const logError = (context: string, error: any) => {
    if (error?.code === '42P01') {
        console.warn(`[DB Service] Table missing in ${context} (42P01). Run Database Setup.`);
        return;
    }
    const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.error(`[DB Service] Error in ${context}:`, errorMsg);
};

// --- GAMES ---
export const fetchGames = async (): Promise<Game[]> => {
    try {
        const { data, error } = await supabase.from('games').select('*');
        if (error) throw error;
        if (!data) return [];
        return data.map((row: any) => ({ ...row.data, id: row.id }));
    } catch (e) {
        logError('fetchGames', e);
        return []; // Return empty for now, or offline fallback if preferred
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
    } catch (e) { logError('saveGame', e); }
};

export const deleteGame = async (id: string) => {
    try {
        await supabase.from('games').delete().eq('id', id);
        await supabase.from('teams').delete().eq('game_id', id);
    } catch (e) { logError('deleteGame', e); }
};

// --- TEAMS ---
export const fetchTeams = async (gameId: string): Promise<Team[]> => {
    try {
        const { data, error } = await supabase.from('teams').select('*').eq('game_id', gameId);
        if (error) throw error;
        if (!data) return [];
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
    } catch (e) { logError('registerTeam', e); }
};

// ATOMIC UPDATE (Fixes Race Condition Point 5)
export const updateTeamScore = async (teamId: string, delta: number) => {
    try {
        // Attempt to use RPC for atomic increment
        const { error: rpcError } = await supabase.rpc('increment_score', { team_id: teamId, amount: delta });
        
        if (rpcError) {
            // Fallback to legacy read-modify-write if RPC missing
            console.warn("RPC increment_score missing, falling back to standard update");
            const team = await fetchTeam(teamId);
            if (team) {
                const newScore = Math.max(0, team.score + delta);
                await supabase.from('teams').update({ score: newScore }).eq('id', teamId);
            }
        }
    } catch (e) {
        logError('updateTeamScore', e);
    }
};

export const updateTeamProgress = async (teamId: string, pointId: string, scoreToAdd: number) => {
    try {
        // Attempt atomic RPC first (prevents race conditions / double-scoring)
        const { error: rpcError } = await supabase.rpc('complete_task', {
            p_team_id: teamId,
            p_point_id: pointId,
            p_score_delta: scoreToAdd
        });

        if (rpcError) {
            // Fallback to client-side check if RPC doesn't exist
            console.warn("RPC complete_task missing, using fallback", rpcError.message);
            const team = await fetchTeam(teamId);
            if (team) {
                const completed = new Set(team.completedPointIds || []);
                if (!completed.has(pointId)) {
                    completed.add(pointId);
                    const { error } = await supabase.from('teams').update({
                        score: team.score + scoreToAdd,
                        completed_point_ids: Array.from(completed)
                    }).eq('id', teamId);
                    if (error) throw error;
                }
            }
        }
    } catch (e) {
        logError('updateTeamProgress', e);
    }
};

export const updateTeamName = async (teamId: string, newName: string) => {
    try {
        await supabase.from('teams').update({ name: newName, updated_at: new Date().toISOString() }).eq('id', teamId);
    } catch (e) { logError('updateTeamName', e); }
};

export const updateTeamCaptain = async (teamId: string, captainDeviceId: string) => {
    try {
        await supabase.from('teams').update({ captain_device_id: captainDeviceId, updated_at: new Date().toISOString() }).eq('id', teamId);
    } catch (e) { logError('updateTeamCaptain', e); }
};

export const updateTeamPhoto = async (teamId: string, photoUrl: string) => {
    try {
        await supabase.from('teams').update({ photo_url: photoUrl, updated_at: new Date().toISOString() }).eq('id', teamId);
    } catch (e) { logError('updateTeamPhoto', e); }
};

export const updateMemberPhoto = async (teamId: string, memberDeviceId: string, photoUrl: string) => {
    try {
        const team = await fetchTeam(teamId);
        if (!team) return;
        
        const updatedMembers = team.members.map((m: any) => {
            // Handle legacy structure
            const mId = m.deviceId || (typeof m === 'string' ? '' : '');
            const mName = m.name || (typeof m === 'string' ? m : 'Unknown');
            
            if (mId === memberDeviceId) {
                return { name: mName, deviceId: mId, photo: photoUrl };
            }
            return m;
        });

        await supabase.from('teams').update({ members: updatedMembers, updated_at: new Date().toISOString() }).eq('id', teamId);
    } catch (e) { logError('updateMemberPhoto', e); }
};

// --- LIBRARY & LISTS ---
export const fetchLibrary = async (): Promise<TaskTemplate[]> => {
    try {
        const { data, error } = await supabase.from('library').select('*');
        if (error) throw error;
        return data ? data.map((row: any) => ({ ...row.data, id: row.id })) : [];
    } catch (e) { logError('fetchLibrary', e); return []; }
};

export const saveTemplate = async (template: TaskTemplate) => {
    try {
        const { error } = await supabase.from('library').upsert({ id: template.id, data: template, updated_at: new Date().toISOString() });
        if (error) throw error;
    } catch (e) { logError('saveTemplate', e); }
};

export const deleteTemplate = async (id: string) => {
    try { await supabase.from('library').delete().eq('id', id); } catch (e) { logError('deleteTemplate', e); }
};

export const fetchTaskLists = async (): Promise<TaskList[]> => {
    try {
        const { data, error } = await supabase.from('task_lists').select('*');
        if (error) throw error;
        return data ? data.map((row: any) => ({ ...row.data, id: row.id })) : [];
    } catch (e) { logError('fetchTaskLists', e); return []; }
};

export const fetchTaskListByToken = async (token: string): Promise<TaskList | null> => {
    try {
        const { data, error } = await supabase.from('task_lists').select('*').eq('data->>shareToken', token).single();
        if (error) throw error;
        return data ? { ...data.data, id: data.id } : null;
    } catch (e) { logError('fetchTaskListByToken', e); return null; }
};

export const saveTaskList = async (list: TaskList) => {
    try {
        const { error } = await supabase.from('task_lists').upsert({ id: list.id, data: list, updated_at: new Date().toISOString() });
        if (error) throw error;
    } catch (e) { logError('saveTaskList', e); }
};

export const deleteTaskList = async (id: string) => {
    try { await supabase.from('task_lists').delete().eq('id', id); } catch (e) { logError('deleteTaskList', e); }
};

export const submitClientTask = async (listId: string, task: TaskTemplate): Promise<boolean> => {
    try {
        const { data: current } = await supabase.from('task_lists').select('*').eq('id', listId).single();
        if (!current) return false;
        
        const listData = current.data as TaskList;
        const updatedList = { ...listData, tasks: [...listData.tasks, task] };
        
        const { error } = await supabase.from('task_lists').update({ data: updatedList, updated_at: new Date().toISOString() }).eq('id', listId);
        return !error;
    } catch (e) {
        logError('submitClientTask', e);
        return false;
    }
};

// --- TAGS ---
export const fetchUniqueTags = async (): Promise<string[]> => {
    try {
        const { data: libraryData } = await supabase.from('library').select('data');
        const { data: gamesData } = await supabase.from('games').select('data');
        
        const tags = new Set<string>();
        
        libraryData?.forEach((row: any) => {
            row.data.tags?.forEach((tag: string) => tags.add(tag));
        });
        
        gamesData?.forEach((row: any) => {
            row.data.tags?.forEach((tag: string) => tags.add(tag));
        });

        return Array.from(tags).sort();
    } catch (e) {
        console.warn("Error fetching unique tags", e);
        return [];
    }
};

// --- PLAYGROUNDS ---
export const fetchPlaygroundLibrary = async (): Promise<PlaygroundTemplate[]> => {
    try {
        const { data, error } = await supabase.from('playground_library').select('*');
        if (error) throw error;
        return data ? data.map((row: any) => ({ ...row.data, id: row.id, title: row.title, isGlobal: row.is_global })) : [];
    } catch (e) { logError('fetchPlaygroundLibrary', e); return []; }
};

export const savePlaygroundTemplate = async (template: PlaygroundTemplate) => {
    try {
        const { error } = await supabase.from('playground_library').upsert({
            id: template.id, title: template.title, is_global: template.isGlobal, data: template, updated_at: new Date().toISOString()
        });
        if (error) throw error;
    } catch (e) { logError('savePlaygroundTemplate', e); }
};

export const deletePlaygroundTemplate = async (id: string) => {
    try { await supabase.from('playground_library').delete().eq('id', id); } catch (e) { logError('deletePlaygroundTemplate', e); }
};

// --- USERS ---
export const fetchAccountUsers = async (): Promise<AccountUser[]> => {
    try {
        const { data, error } = await supabase.from('account_users').select('*');
        if (error) throw error;
        return data ? data.map((row: any) => ({ ...row.data, id: row.id })) : [];
    } catch (e) { 
        if ((e as any)?.code === '42P01') throw e; 
        logError('fetchAccountUsers', e); 
        return []; 
    }
};

export const saveAccountUser = async (user: AccountUser) => {
    try {
        const { error } = await supabase.from('account_users').upsert({ id: user.id, data: user, updated_at: new Date().toISOString() });
        if (error) throw error;
    } catch (e) { logError('saveAccountUser', e); throw e; }
};

export const deleteAccountUsers = async (ids: string[]) => {
    try { await supabase.from('account_users').delete().in('id', ids); } catch (e) { logError('deleteAccountUsers', e); throw e; }
};

export const sendAccountUserMessage = async (targetUserId: string, messageText: string, senderName: string) => {
    try {
        const { data } = await supabase.from('account_users').select('data').eq('id', targetUserId).single();
        if (!data) return false;
        
        const userData = data.data as AccountUser;
        const newMessage: AdminMessage = { id: `msg-${Date.now()}`, text: messageText, sender: senderName, timestamp: Date.now(), read: false };
        const updatedUser = { ...userData, messages: [...(userData.messages || []), newMessage] };
        
        await supabase.from('account_users').update({ data: updatedUser, updated_at: new Date().toISOString() }).eq('id', targetUserId);
        return true;
    } catch (e) { logError('sendAccountUserMessage', e); return false; }
};
