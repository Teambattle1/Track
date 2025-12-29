import { supabase } from '../lib/supabase';
import { Game, GamePoint, TaskTemplate, TaskList, Team, PlaygroundTemplate, AccountUser, AdminMessage, Coordinate, GameChangeLogEntry } from '../types';
import { DEMO_TASKS, DEMO_LISTS, getDemoGames } from '../utils/demoContent';

const logError = (context: string, error: any) => {
    if (error?.code === '42P01') {
        console.warn(`[DB Service] Table missing in ${context} (42P01). Run Database Setup.`);
        return;
    }

    // Enhanced error logging
    const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    const errorDetails = {
        message: errorMsg,
        code: error?.code,
        status: error?.status,
        statusText: error?.statusText,
        name: error?.name
    };

    console.error(`[DB Service] Error in ${context}:`, errorMsg);
    if (Object.values(errorDetails).some(v => v !== undefined)) {
        console.error(`[DB Service] Error details:`, errorDetails);
    }
};

// Configuration for large table fetches
const CHUNK_SIZE = 100; // Fetch 100 rows at a time
const TAGS_CHUNK_SIZE = 20; // Smaller chunks for tag fetching (large data objects)
const FETCH_TIMEOUT_MS = 30000; // 30 second timeout per chunk
const TAGS_FETCH_TIMEOUT_MS = 5000; // 5 second timeout for tag fetches (fail fast)

// Retry helper for timeout errors with exponential backoff
const retryWithBackoff = async <T>(fn: () => Promise<T>, context: string, maxRetries = 2, timeoutMs?: number): Promise<T> => {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Add timeout wrapper if specified
            if (timeoutMs) {
                return await Promise.race([
                    fn(),
                    new Promise<T>((_, reject) =>
                        setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
                    )
                ]);
            }
            return await fn();
        } catch (e: any) {
            lastError = e;
            // Detect timeout errors more robustly
            const isTimeout =
                e?.message?.includes('timeout') ||
                e?.message?.includes('canceling statement') ||
                e?.code === 'QUERY_TIMEOUT' ||
                e?.code === '57014'; // Postgres timeout error code

            if (!isTimeout || attempt === maxRetries - 1) throw e;

            const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 second wait
            console.warn(`[DB Service] Timeout in ${context}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
};

// Fetch large tables in chunks to prevent timeout
const fetchInChunks = async <T>(
    query: (offset: number, limit: number) => Promise<{ data: any[] | null; error: any }>,
    context: string,
    chunkSize: number = CHUNK_SIZE,
    timeoutMs?: number
): Promise<T[]> => {
    const results: T[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const { data, error } = await retryWithBackoff(
                () => query(offset, chunkSize),
                `${context}[offset=${offset}]`,
                2, // Reduced retries for tag fetches with short timeout
                timeoutMs
            );

            if (error) {
                const errorMessage = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
                console.error(`[DB Service] Query error at offset ${offset}:`, errorMessage);
                throw error;
            }

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                results.push(...data);
                if (data.length < chunkSize) {
                    hasMore = false;
                } else {
                    offset += chunkSize;
                }
            }
        } catch (e) {
            logError(context, e);
            // On first chunk failure, log additional context
            if (offset === 0) {
                console.error(`[DB Service] Initial fetch failed for ${context}. Check database connection and table permissions.`);
            }
            hasMore = false; // Stop trying to fetch more chunks if we hit an error
        }
    }

    return results;
};

// --- GAMES ---
export const fetchGames = async (): Promise<Game[]> => {
    try {
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('games').select('id, data, updated_at').range(offset, offset + limit - 1),
            'fetchGames',
            CHUNK_SIZE
        );
        return rows.map((row: any) => {
            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            return { ...rowData, id: row.id, dbUpdatedAt: row.updated_at };
        });
    } catch (e) {
        logError('fetchGames', e);
        // Try fallback: fetch without chunking as last resort
        try {
            console.warn('[DB Service] Attempting fetchGames fallback (no chunking)...');
            const { data, error } = await supabase.from('games').select('id, data, updated_at').limit(10000);
            if (error) throw error;
            if (!data) return [];
            return data.map((row: any) => {
                const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                return { ...rowData, id: row.id, dbUpdatedAt: row.updated_at };
            });
        } catch (fallbackError) {
            logError('fetchGames[fallback]', fallbackError);
            return [];
        }
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

export const fetchGame = async (id: string): Promise<Game | null> => {
    try {
        const result = await retryWithBackoff(
            () => supabase.from('games').select('id, data, updated_at').eq('id', id).single(),
            `fetchGame(${id})`
        );
        const { data, error } = result;
        if (error) throw error;
        if (!data) return null;
        return { ...data.data, id: data.id, dbUpdatedAt: data.updated_at };
    } catch (e) {
        logError('fetchGame', e);
        return null;
    }
};

export const updateGameItemLocation = async (
    gameId: string,
    itemId: string,
    location: Coordinate,
    opts?: { user?: string; action?: string }
): Promise<Game | null> => {
    try {
        const game = await fetchGame(gameId);
        if (!game) return null;

        const updatedAt = new Date().toISOString();

        const changeEntry: GameChangeLogEntry = {
            timestamp: Date.now(),
            user: opts?.user || 'Unknown',
            action: opts?.action || 'Moved Item'
        };

        const updatedGame: Game = {
            ...game,
            dbUpdatedAt: updatedAt,
            lastModifiedBy: opts?.user || game.lastModifiedBy,
            changeLog: [...(game.changeLog || []), changeEntry],
            points: game.points.map(p => p.id === itemId ? { ...p, location } : p),
            playgrounds: (game.playgrounds || []).map(pg => pg.id === itemId ? { ...pg, location } : pg),
            dangerZones: (game.dangerZones || []).map(z => z.id === itemId ? { ...z, location } : z)
        };

        await saveGame(updatedGame);
        return updatedGame;
    } catch (e) {
        logError('updateGameItemLocation', e);
        return null;
    }
};

export const patchGamePoints = async (
    gameId: string,
    patches: { pointId: string; patch: Partial<GamePoint> }[],
    opts?: { user?: string; action?: string }
): Promise<Game | null> => {
    try {
        const game = await fetchGame(gameId);
        if (!game) return null;

        const updatedAt = new Date().toISOString();

        const changeEntry: GameChangeLogEntry = {
            timestamp: Date.now(),
            user: opts?.user || 'Unknown',
            action: opts?.action || 'Patched Points'
        };

        const patchMap = new Map(patches.map(p => [p.pointId, p.patch]));

        const updatedGame: Game = {
            ...game,
            dbUpdatedAt: updatedAt,
            lastModifiedBy: opts?.user || game.lastModifiedBy,
            changeLog: [...(game.changeLog || []), changeEntry],
            points: game.points.map(p => {
                const patch = patchMap.get(p.id);
                return patch ? ({ ...p, ...patch } as GamePoint) : p;
            })
        };

        await saveGame(updatedGame);
        return updatedGame;
    } catch (e) {
        logError('patchGamePoints', e);
        return null;
    }
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
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('teams').select('id, game_id, name, join_code, photo_url, members, score, updated_at, captain_device_id, is_started, completed_point_ids').eq('game_id', gameId).range(offset, offset + limit - 1),
            `fetchTeams(${gameId})`,
            CHUNK_SIZE
        );
        const data = rows;
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
        const { data, error } = await supabase.from('teams').select('id, game_id, name, join_code, photo_url, members, score, updated_at, captain_device_id, is_started, completed_point_ids').eq('id', teamId).single();
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

export const updateTeamProgress = async (teamId: string, pointId: string, newScore: number) => {
    try {
        const team = await fetchTeam(teamId);
        if (team) {
            const completed = new Set(team.completedPointIds || []);
            // Check if already completed to prevent double-score logic on client side before calling this
            // But we reinforce here:
            if (!completed.has(pointId)) {
                completed.add(pointId);
                const { error } = await supabase.from('teams').update({ 
                    score: newScore, // Caller should calculate score, OR we use RPC logic separately
                    completed_point_ids: Array.from(completed)
                }).eq('id', teamId);
                if (error) throw error;
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
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('library').select('id, data').range(offset, offset + limit - 1),
            'fetchLibrary',
            CHUNK_SIZE
        );
        return rows.map((row: any) => {
            // Handle both direct data objects and stringified JSON
            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            return { ...rowData, id: row.id };
        });
    } catch (e) {
        logError('fetchLibrary', e);
        // Try fallback: fetch without chunking as last resort
        try {
            console.warn('[DB Service] Attempting fetchLibrary fallback (no chunking)...');
            const { data, error } = await supabase.from('library').select('id, data').limit(10000);
            if (error) throw error;
            if (!data) return [];
            return data.map((row: any) => {
                const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                return { ...rowData, id: row.id };
            });
        } catch (fallbackError) {
            logError('fetchLibrary[fallback]', fallbackError);
            return [];
        }
    }
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
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('task_lists').select('id, data').range(offset, offset + limit - 1),
            'fetchTaskLists',
            CHUNK_SIZE
        );
        return rows.map((row: any) => {
            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            return { ...rowData, id: row.id };
        });
    } catch (e) {
        logError('fetchTaskLists', e);
        // Try fallback: fetch without chunking as last resort
        try {
            console.warn('[DB Service] Attempting fetchTaskLists fallback (no chunking)...');
            const { data, error } = await supabase.from('task_lists').select('id, data').limit(10000);
            if (error) throw error;
            if (!data) return [];
            return data.map((row: any) => {
                const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                return { ...rowData, id: row.id };
            });
        } catch (fallbackError) {
            logError('fetchTaskLists[fallback]', fallbackError);
            return [];
        }
    }
};

export const fetchTaskListByToken = async (token: string): Promise<TaskList | null> => {
    try {
        const result = await retryWithBackoff(
            () => supabase.from('task_lists').select('id, data').eq('data->>shareToken', token).single(),
            `fetchTaskListByToken(${token})`
        );
        const { data, error } = result;
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
        const { data: current } = await supabase.from('task_lists').select('id, data').eq('id', listId).single();
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
// Cache for unique tags to avoid repeated expensive queries
let tagsCache: string[] = [];
let tagsCacheFetchTime = 0;
const TAGS_CACHE_DURATION_MS = 60000; // Cache tags for 60 seconds

export const fetchUniqueTags = async (): Promise<string[]> => {
    // Return cached tags if fresh
    if (tagsCache.length > 0 && Date.now() - tagsCacheFetchTime < TAGS_CACHE_DURATION_MS) {
        return tagsCache;
    }

    try {
        const tags = new Set<string>();
        let fetchedAny = false;

        // Fetch library tags in smaller chunks with aggressive timeout
        try {
            const libraryRows = await fetchInChunks(
                (offset, limit) => supabase.from('library').select('data').range(offset, offset + limit - 1),
                'fetchUniqueTags[library]',
                TAGS_CHUNK_SIZE,
                TAGS_FETCH_TIMEOUT_MS
            );

            libraryRows?.forEach((row: any) => {
                row.data?.tags?.forEach((tag: string) => tags.add(tag));
            });

            if (libraryRows.length > 0) fetchedAny = true;
        } catch (e: any) {
            console.warn('[DB Service] Skipping library tags (timeout or error)', e?.message || e);
            // Fail gracefully - library tags are optional
        }

        // Fetch games tags in smaller chunks with aggressive timeout
        try {
            const gamesRows = await fetchInChunks(
                (offset, limit) => supabase.from('games').select('data').range(offset, offset + limit - 1),
                'fetchUniqueTags[games]',
                TAGS_CHUNK_SIZE,
                TAGS_FETCH_TIMEOUT_MS
            );

            gamesRows?.forEach((row: any) => {
                row.data?.tags?.forEach((tag: string) => tags.add(tag));
            });

            if (gamesRows.length > 0) fetchedAny = true;
        } catch (e: any) {
            console.warn('[DB Service] Skipping games tags (timeout or error)', e?.message || e);
            // Fail gracefully - games tags are optional
        }

        const result = Array.from(tags).sort();

        // Cache the result if we fetched anything
        if (fetchedAny) {
            tagsCache = result;
            tagsCacheFetchTime = Date.now();
        }

        return result;
    } catch (e) {
        console.warn('[DB Service] Error fetching unique tags', e);
        // Return cached tags even if stale, or empty array if no cache
        return tagsCache;
    }
};

// --- PLAYGROUNDS ---
export const fetchPlaygroundLibrary = async (): Promise<PlaygroundTemplate[]> => {
    try {
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('playground_library').select('id, title, is_global, data').range(offset, offset + limit - 1),
            'fetchPlaygroundLibrary',
            CHUNK_SIZE
        );
        return rows.map((row: any) => ({ ...row.data, id: row.id, title: row.title, isGlobal: row.is_global }));
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
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('account_users').select('id, data').range(offset, offset + limit - 1),
            'fetchAccountUsers',
            CHUNK_SIZE
        );
        return rows.map((row: any) => ({ ...row.data, id: row.id }));
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
